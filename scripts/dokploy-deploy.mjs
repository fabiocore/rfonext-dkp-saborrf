#!/usr/bin/env node
// Cria (ou atualiza) um ambiente completo de uma guild no Dokploy: projeto,
// ambiente (dev/prod), app Compose puxando do Git via SSH deploy key,
// dominio com TLS, variaveis de ambiente/segredos, e dispara o deploy.
//
// Idempotente: pode rodar de novo pro mesmo (guildSlug, envName) sem
// duplicar recursos nem sobrescrever segredos ja gerados - so atualiza o
// compose file/dominio e redisponibiliza.
//
// Uso:
//   DOKPLOY_URL=https://... DOKPLOY_API_KEY=... \
//   node scripts/dokploy-deploy.mjs \
//     --guild saborrf --env dev --domain sabor-dev.rfonext-dkp.cloud \
//     --repo git@github.com:usuario/repo.git --branch main \
//     --ssh-key-name saborrf-deploy-key --ssh-private-key-file ./deploy_key --ssh-public-key-file ./deploy_key.pub
//
// Ver scripts/README-dokploy-deploy.md pra explicacao completa.

import { readFileSync } from 'node:fs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}

const DOKPLOY_URL = process.env.DOKPLOY_URL;
const DOKPLOY_API_KEY = process.env.DOKPLOY_API_KEY;
if (!DOKPLOY_URL || !DOKPLOY_API_KEY) {
  console.error('Defina DOKPLOY_URL e DOKPLOY_API_KEY no ambiente.');
  process.exit(1);
}

const guildSlug = arg('guild');
const envName = arg('env'); // "dev" ou "prod" (ou qualquer nome)
const domain = arg('domain');
const repo = arg('repo'); // git@github.com:usuario/repo.git
const branch = arg('branch', 'main');
const composePath = arg('compose-path', 'docker-compose.dokploy.yml');
const sshKeyName = arg('ssh-key-name');
const sshPrivateKeyFile = arg('ssh-private-key-file');
const sshPublicKeyFile = arg('ssh-public-key-file');
const skipDeploy = flag('skip-deploy');

if (!guildSlug || !envName || !domain || !repo || !sshKeyName || !sshPrivateKeyFile || !sshPublicKeyFile) {
  console.error(
    'Uso: node dokploy-deploy.mjs --guild <slug> --env <dev|prod> --domain <host> --repo <git-ssh-url> ' +
      '--ssh-key-name <nome> --ssh-private-key-file <path> --ssh-public-key-file <path> [--branch main] [--compose-path docker-compose.dokploy.yml] [--skip-deploy]',
  );
  process.exit(1);
}

async function api(path, body) {
  const res = await fetch(`${DOKPLOY_URL}/api/${path}`, {
    method: 'POST',
    headers: { 'x-api-key': DOKPLOY_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}: ${text}`);
  }
  return json;
}

async function apiGet(path, params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${DOKPLOY_URL}/api/${path}${qs}`, {
    headers: { 'x-api-key': DOKPLOY_API_KEY },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function ensureProject() {
  const all = await apiGet('project.all');
  const existing = all.find((p) => p.name === guildSlug);
  if (existing) {
    console.log(`Projeto "${guildSlug}" ja existe (${existing.projectId}).`);
    return existing;
  }
  const created = await api('project.create', { name: guildSlug, description: `RFONext DKP - ${guildSlug}` });
  console.log(`Projeto "${guildSlug}" criado (${created.project.projectId}).`);
  return created.project;
}

async function ensureEnvironment(projectId) {
  // project.create ja cria um ambiente default "production" junto - reusa
  // se for esse o nome pedido, senao cria um novo.
  const project = await apiGet('project.one', { projectId });
  const existing = (project.environments || []).find((e) => e.name === envName);
  if (existing) {
    console.log(`Ambiente "${envName}" ja existe (${existing.environmentId}).`);
    return existing;
  }
  const created = await api('environment.create', { name: envName, projectId, description: `Ambiente ${envName}` });
  console.log(`Ambiente "${envName}" criado (${created.environmentId}).`);
  return created;
}

async function ensureSshKey() {
  const all = await apiGet('sshKey.all');
  const existing = all.find((k) => k.name === sshKeyName);
  if (existing) {
    console.log(`SSH key "${sshKeyName}" ja existe (${existing.sshKeyId}).`);
    return existing;
  }
  const user = await apiGet('user.get');
  const created = await api('sshKey.create', {
    name: sshKeyName,
    privateKey: readFileSync(sshPrivateKeyFile, 'utf8'),
    publicKey: readFileSync(sshPublicKeyFile, 'utf8'),
    organizationId: user.organizationId,
  });
  console.log(`SSH key "${sshKeyName}" criada (${created.sshKeyId}).`);
  return created;
}

async function ensureCompose(environmentId) {
  const project = await apiGet('project.all');
  for (const p of project) {
    for (const env of p.environments || []) {
      const found = (env.compose || []).find((c) => c.name === `${guildSlug}-web` && env.environmentId === environmentId);
      if (found) {
        console.log(`Compose app ja existe (${found.composeId}).`);
        return { composeId: found.composeId, isNew: false };
      }
    }
  }
  const created = await api('compose.create', { name: `${guildSlug}-web`, environmentId });
  console.log(`Compose app criado (${created.composeId}).`);
  return { composeId: created.composeId, isNew: true };
}

async function ensureDomain(composeId) {
  // domain.create precisa vir com todos os campos desde a criacao -
  // domain.update sozinho nao consegue re-ligar composeId depois.
  const existingList = await apiGet('domain.byComposeId', { composeId }).catch(() => []);
  const existing = (existingList || []).find((d) => d.host === domain);
  if (existing) {
    console.log(`Dominio "${domain}" ja associado a esse app.`);
    return existing;
  }
  const created = await api('domain.create', {
    host: domain,
    domainType: 'compose',
    composeId,
    serviceName: 'web',
    port: 80,
    https: true,
    certificateType: 'letsencrypt',
  });
  console.log(`Dominio "${domain}" criado e associado.`);
  return created;
}

async function main() {
  const project = await ensureProject();
  const environment = await ensureEnvironment(project.projectId);
  const sshKey = await ensureSshKey();
  const { composeId, isNew } = await ensureCompose(environment.environmentId);

  await api('compose.update', {
    composeId,
    sourceType: 'git',
    customGitUrl: repo,
    customGitBranch: branch,
    customGitSSHKeyId: sshKey.sshKeyId,
    composePath,
  });
  console.log('Fonte do compose configurada (git via deploy key).');

  if (isNew) {
    const env = [
      `POSTGRES_USER=${guildSlug}_${envName}`,
      `POSTGRES_PASSWORD=${randomHex(16)}`,
      `POSTGRES_DB=rfonext_dkp_${envName}`,
      `JWT_SECRET=${randomHex(32)}`,
      `JWT_EXPIRES_IN=12h`,
      `GM_BOOTSTRAP_USERNAME=guildmaster`,
      `GM_BOOTSTRAP_PASSWORD=${randomHex(8)}`,
      '',
    ].join('\n');
    await api('compose.update', { composeId, env });
    console.log('Segredos gerados e aplicados (novo app - nunca reaproveitados de outro ambiente/guild).');
    console.log('>>> GM_BOOTSTRAP_PASSWORD (anote agora, so aparece aqui):');
    console.log(env.match(/GM_BOOTSTRAP_PASSWORD=(.*)/)[1]);
  } else {
    console.log('App ja existia - mantendo env vars/segredos atuais (rode compose.update manual se quiser trocar).');
  }

  await ensureDomain(composeId);

  if (!skipDeploy) {
    await api('compose.deploy', { composeId });
    console.log('Deploy disparado. Acompanhe pelo painel do Dokploy ou via deployment.allByCompose.');
  }

  console.log('\nPronto:');
  console.log(`  Projeto:    ${guildSlug} (${project.projectId})`);
  console.log(`  Ambiente:   ${envName} (${environment.environmentId})`);
  console.log(`  Compose:    ${composeId}`);
  console.log(`  Dominio:    https://${domain}`);
}

main().catch((err) => {
  console.error('Falhou:', err.message);
  process.exit(1);
});
