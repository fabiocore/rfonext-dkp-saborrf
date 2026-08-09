# RFONext DKP — Runbook de Deploy

> Este documento assume o modelo definido em [PREMISSAS.md](PREMISSAS.md) seção 10: **sem multi-tenant**. Cada guild nova é um deploy inteiramente separado (seu próprio banco, seus próprios containers, seu próprio domínio). Se você vai atender N guilds, vai repetir este processo N vezes.

## 1. Requisitos no servidor

- Docker + Docker Compose (v2) instalados.
- Um domínio ou subdomínio apontando pro servidor (ex: `sabor.rfonextdkp.com`), se for publicar na internet.
- Se for usar [Dokploy](https://dokploy.com): crie um novo projeto, aponte pro repositório (ou faça upload dos arquivos), e configure o Dokploy pra usar `docker-compose.prod.yml` como fonte. O Dokploy cuida do proxy reverso e do certificado TLS — você só precisa garantir que o serviço `web` (porta 80) seja o alvo do domínio.

## 2. Primeiro deploy de uma guild nova

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
   - **Troque a senha do GM imediatamente** — hoje isso é feito recriando a conta via banco, já que não existe autoatendimento de troca de senha do próprio GM na UI (só o GM redefine senha de conselho, não a própria). Se quiser trocar, ajuste `GM_BOOTSTRAP_PASSWORD` no `.env`, apague a linha do GM na tabela `User` e suba de novo — ele recria com o novo valor.
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

## 5. Uploads (prints e imagens)

Ficam no volume Docker `uploads` (`/app/uploads` dentro do container `api`), servidos em `/uploads/...`. Esse volume não é coberto pelo `pg_dump` — se quiser incluir os prints no backup, copie o volume separadamente:
```bash
docker run --rm -v <nome-do-volume-uploads>:/data -v "$PWD/backups":/backup alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /data .
```

## 6. Múltiplas guilds no mesmo servidor

Cada guild precisa de:
- Seu próprio `.env` (credenciais e segredos diferentes).
- Seu próprio nome de projeto no Compose (`docker compose -p nome-da-guild -f docker-compose.prod.yml up -d`) pra não colidir nomes de container/volume com outra guild no mesmo host.
- Seu próprio domínio/subdomínio apontado pro serviço `web` daquele projeto.

Não há nenhum dado compartilhado entre guilds — bancos, volumes e containers são inteiramente isolados por design.
