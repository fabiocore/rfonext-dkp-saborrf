# RFONext DKP — Runbook de Deploy

> Este documento assume o modelo definido em [PREMISSAS.md](PREMISSAS.md) seção 10: **sem multi-tenant**. Cada guild nova é um deploy inteiramente separado (seu próprio banco, seus próprios containers, seu próprio domínio). Se você vai atender N guilds, vai repetir este processo N vezes.

## 0. Deploy via Dokploy (padrão atual — recomendado)

Desde 2026-08-09, todo deploy novo (SaborRF e futuras guilds) usa [Dokploy](https://dokploy.com) via `scripts/dokploy-deploy.sh`, que automatiza tudo abaixo por chamada de API — ver seção 8 pra detalhes completos e o passo a passo de uma guild nova do zero. Resumo do modelo:

- **1 projeto Dokploy por guild**, com **2 ambientes dentro dele**: `dev` (pra validar antes de liberar) e `production` (o que os jogadores usam de verdade). Cada ambiente tem seu próprio banco, containers, domínio e segredos — totalmente isolados um do outro, mesmo estando na mesma guild.
- **Cada ambiente novo já nasce zerado** — banco novo, sem imports, sem leilões, sem nada — porque é literalmente um volume Postgres novo. Não existe passo de "resetar", é assim por construção.
- **Fonte do build**: Dokploy puxa o código via Git (deploy key SSH só de leitura) a partir de um repositório privado no GitHub — não é upload manual nem imagem pré-buildada. O compose usado é o `docker-compose.dokploy.yml` (variante sem publicar porta 80 no host — o Traefik do próprio Dokploy roteia os domínios pela rede interna do Docker; ver seção 8).
- **Promover dev → prod**: hoje é reconfigurar manualmente o ambiente `production` (mesmo domínio final, sem os dados de teste do dev) — não existe ainda um "clonar dev pra prod" automático, e não deveria haver, já que os dados de teste do dev nunca devem ir pra produção.

## 1. Requisitos no servidor (deploy manual, sem o script — Docker Compose puro)

- Docker + Docker Compose (v2) instalados.
- Um domínio ou subdomínio apontando pro servidor (ex: `sabor.rfonextdkp.com`), se for publicar na internet.
- Se for usar o Dokploy manualmente pela UI (sem o script): crie um projeto, um ambiente, aponte o app Compose pro repositório Git (upload direto de texto **não funciona** pra esse projeto — os serviços usam `build: context:`, que exige o código-fonte junto, não só o YAML), e use `docker-compose.dokploy.yml` como `composePath`. O Dokploy cuida do proxy reverso (Traefik) e do certificado TLS — configure o domínio apontando pro serviço `web`, porta `80`, **sem publicar porta no host**.

## 2. Primeiro deploy de uma guild nova (Docker Compose puro, sem Dokploy)

1. Copie o projeto pra uma pasta própria dessa guild (ou configure como um projeto separado no Dokploy).
2. Copie `.env.production.example` para `.env` na raiz e preencha:
   - `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — credenciais do banco, únicas por guild.
   - `JWT_SECRET` — gere com `openssl rand -hex 32`. Nunca reaproveite entre guilds.
   - `GM_BOOTSTRAP_USERNAME` / `GM_BOOTSTRAP_PASSWORD` — a primeira conta de GM é criada automaticamente com esses valores na primeira subida (ver `backend/src/auth/auth.service.ts`).
3. Suba tudo:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   As migrations do Prisma rodam automaticamente no boot do container `api` (`npx prisma migrate deploy`, embutido no `backend/Dockerfile`).
4. Acesse `https://SEU-DOMINIO/admin/login` e entre com `GM_BOOTSTRAP_USERNAME`/`GM_BOOTSTRAP_PASSWORD`.
   - **Troque a senha do GM imediatamente** em **Admin > Minha Senha** (`/admin/change-password`) — e aproveite pra já definir um código de recuperação ali mesmo (seção 5 abaixo), pra não depender de acesso ao servidor se esquecer a senha depois.
5. Vá em **Configurações** e preencha a identidade da guild: nome, nome da moeda, sigla, idioma padrão, % de imposto semanal e dia do corte. Isso é o que aparece nas páginas públicas e na página do jogador — não fica nada disso fixo no código (PREMISSAS.md seção 10).
6. Crie as contas de conselho que precisar em **Conselho** (só o GM vê).
7. Importe o primeiro XML do jogo em **Importações** pra popular o roster.

## 3. Atualizando uma guild já no ar

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
Migrations novas do Prisma (se houver) rodam sozinhas no boot do `api`. Não precisa de downtime manual — o Compose recria só os containers que mudaram.

## 4. Backup e restauração do banco

- Backup manual: `./scripts/backup-db.sh` (salva em `./backups/`, compactado, mantém os últimos 14).
- Agende diário via cron do host, por exemplo:
  ```
  0 5 * * * cd /caminho/da/guild && ./scripts/backup-db.sh >> backups/backup.log 2>&1
  ```
- Restaurar: `./scripts/restore-db.sh backups/rfonext_dkp_AAAAMMDD_HHMMSS.sql.gz` (pede confirmação, sobrescreve o banco atual).
- Guarde os backups fora do próprio servidor de tempos em tempos (S3, outro disco, etc.) — o script só cuida do dump local.

## 5. Recuperação de senha do GM

Dois mecanismos (adicionados em 2026-08-09), pra cobrir "esqueci a senha e não consigo nem logar" — diferente da troca de senha comum (`/admin/change-password`), que exige já estar logado. Ver também PREMISSAS.md seção 8.

- **Código de recuperação (self-service, não precisa de acesso ao servidor)**: se o GM (ou qualquer conta) definiu um código de recuperação previamente em **Admin > Minha Senha**, basta ir em `/admin/recuperar-senha` (link "Esqueci minha senha" na tela de login), informar usuário + código, e definir uma senha nova na hora. É o caminho recomendado — configure isso **antes** de precisar.
- **Reset via servidor (último recurso, só pro GM, exige acesso ao Dokploy/terminal)**: se ninguém tiver um código de recuperação definido, rode dentro do container `api`:
  ```bash
  docker compose exec api node dist/scripts/reset-gm-password.js
  ```
  (No Dokploy: aba **Terminal** do serviço `api` do ambiente certo, mesmo comando.) O script encontra a conta com papel GM, gera uma senha numérica aleatória, atualiza direto no banco e imprime a nova senha no terminal — anote na hora, ela não é mostrada de novo. Troque por uma senha definitiva assim que conseguir logar.

## 6. Uploads (prints e imagens)

Ficam no volume Docker `uploads` (`/app/uploads` dentro do container `api`), servidos em `/uploads/...`. Esse volume não é coberto pelo `pg_dump` — se quiser incluir os prints no backup, copie o volume separadamente:
```bash
docker run --rm -v <nome-do-volume-uploads>:/data -v "$PWD/backups":/backup alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /data .
```

## 7. Múltiplas guilds no mesmo servidor

Cada guild precisa de:
- Seu próprio `.env` (credenciais e segredos diferentes).
- Seu próprio nome de projeto no Compose (`docker compose -p nome-da-guild -f docker-compose.prod.yml up -d`) pra não colidir nomes de container/volume com outra guild no mesmo host.
- Seu próprio domínio/subdomínio apontado pro serviço `web` daquele projeto.

Não há nenhum dado compartilhado entre guilds — bancos, volumes e containers são inteiramente isolados por design.

## 8. Deploy via Dokploy com `scripts/dokploy-deploy.sh`

### 8.1. Pré-requisitos (uma vez só, por guild)

1. **Repositório Git privado** com o código dessa guild (GitHub, GitLab, Bitbucket ou Gitea — o script usa Git puro via SSH, então qualquer um serve). O Dokploy só vai *ler* dele, nunca escreve.
2. **Deploy key SSH** dedicada, gerada localmente (nunca reaproveitar entre guilds):
   ```bash
   mkdir -p .dokploy/keys
   ssh-keygen -t ed25519 -C "dokploy-deploy-<guild>" -f .dokploy/keys/<guild>_deploy_key -N ""
   ```
   Adicione a chave **pública** (`.pub`) nas Settings → Deploy keys do repositório, com "Allow write access" marcado — só é necessário pra você (ou o script) conseguir dar o primeiro `git push`; o Dokploy só precisa de leitura, mas reaproveitar a mesma chave é mais simples e não é um risco real (write access de uma deploy key só afeta aquele repositório específico).
   `.dokploy/` já está no `.gitignore` — a chave privada nunca é versionada.
3. **API key do Dokploy**: gerada no próprio painel (perfil → API/Tokens). Trate como senha — nunca cole em arquivo versionado.

### 8.2. Rodando o script

```bash
export DOKPLOY_URL=https://SEU-PAINEL-DOKPLOY
export DOKPLOY_API_KEY=xxxxxxxxxxxxxxxx

./scripts/dokploy-deploy.sh \
  --guild minhaguild \
  --env dev \
  --domain minhaguild-dev.seudominio.com \
  --repo git@github.com:usuario/minhaguild.git \
  --branch main \
  --ssh-key-name minhaguild-deploy-key \
  --ssh-private-key-file .dokploy/keys/minhaguild_deploy_key \
  --ssh-public-key-file .dokploy/keys/minhaguild_deploy_key.pub
```

O script (roda num container Node descartável — não precisa de Node instalado no host):
1. Cria o projeto no Dokploy se não existir (nome = `--guild`).
2. Cria o ambiente (`--env`, ex. `dev`/`production`) dentro do projeto se não existir.
3. Registra a deploy key SSH no Dokploy se não existir.
4. Cria o app Compose (`<guild>-web`) apontando pro repositório via essa chave, usando `docker-compose.dokploy.yml`.
5. **Só na primeira vez** (app novo): gera `POSTGRES_PASSWORD`, `JWT_SECRET` e `GM_BOOTSTRAP_PASSWORD` aleatórios e aplica como variáveis de ambiente do Compose — nunca reaproveitados entre ambientes ou guilds. A senha do GM aparece **uma única vez** no terminal — anote na hora.
6. Cria o domínio com HTTPS/Let's Encrypt, associado ao serviço `web` (porta 80 interna, sem publicar no host — o Traefik do Dokploy cuida do roteamento).
7. Dispara o deploy (a menos que passe `--skip-deploy`).

É **idempotente**: rodar de novo com os mesmos `--guild`/`--env` não duplica nada nem troca segredos já gerados — só reaplica a config de origem/domínio e redispara o deploy (útil depois de um `git push` novo, se `autoDeploy` não estiver disparando sozinho).

### 8.3. Promovendo dev → prod

Depois que o GM validar o ambiente `dev`, rode o mesmo comando trocando `--env` e `--domain`:
```bash
./scripts/dokploy-deploy.sh \
  --guild minhaguild --env production --domain minhaguild.seudominio.com \
  --repo git@github.com:usuario/minhaguild.git --branch main \
  --ssh-key-name minhaguild-deploy-key \
  --ssh-private-key-file .dokploy/keys/minhaguild_deploy_key \
  --ssh-public-key-file .dokploy/keys/minhaguild_deploy_key.pub
```
Isso cria um ambiente **irmão**, com banco e segredos totalmente novos e independentes do `dev` — nenhum dado de teste vaza pra produção porque não existe cópia de dados entre ambientes, só de configuração/deploy.

### 8.4. Por que `docker-compose.dokploy.yml` e não `docker-compose.prod.yml`

O Dokploy roda seu próprio Traefik ocupando as portas 80/443 do host pra rotear todos os domínios de todos os projetos. `docker-compose.prod.yml` (pensado pra Docker Compose puro, sem Dokploy) publica `80:80` direto no host — o que colide com o Traefik. `docker-compose.dokploy.yml` é idêntico, só sem essa publicação; o Traefik alcança o serviço `web` pela rede interna do Docker, usando a porta configurada no domínio (seção 8.2, passo 6).
