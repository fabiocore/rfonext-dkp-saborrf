# Changelog — RFONext DKP

> Histórico de alterações do projeto, pra consulta futura e troubleshooting.
> Formato: mais recente no topo. Cada entrada linka o(s) arquivo(s) principais mexidos quando relevante.
> **A partir de 2026-08-09, todo pedido de mudança do usuário deve gerar uma entrada aqui.**

## 2026-08-09 — Avatares prontos (DiceBear) na tela de perfil + correção de header quebrado no mobile

**Contexto**: dois pedidos do usuário na mesma mensagem. (1) reportou "a interface quebrou", anexando um print da Home — a olho nu o print parecia normal, mas investigando no browser em várias larguras encontrei o problema real: em telas estreitas (celular), o header público (`PublicLayout`) não tinha nenhum breakpoint — o nome da guild, os links de navegação e o seletor de idioma ficavam todos espremidos numa única linha flex, forçando os 6 links a quebrarem em coluna vertical alta e apertada dentro do cabeçalho (feio e confuso, mas sem erro de JS/rede — confirmei console e network limpos). (2) confirmou "Vamos usar o Dicebear então" pra avatares prontos, depois de eu propor a opção (serviço open-source/gratuito de avatares gerados por seed, sem precisar hospedar nada).

**Fix do header** (`frontend/src/layouts/PublicLayout.tsx`, `frontend/src/App.css`): a causa raiz não era só mobile — mesmo em desktop normal, o header público (`app-shell` tem `max-width: 760px` de propósito, layout em coluna centralizada) não tinha largura suficiente pra caber nome da guild + 6 links de navegação + seletor de idioma numa linha só, então o item mais comprido sempre quebrava pra uma coluna vertical apertada dentro do cabeçalho. O usuário sugeriu a solução certa: header em **2 linhas fixas** — nome da guild sozinho em cima, navegação + bandeiras de idioma embaixo (nova classe `.app-header-main` + `.app-header-bottom`, isolada só do `PublicLayout`, sem afetar os outros headers mais simples do site que só têm nome + idioma). Também trocou **"Meu Perfil"/"My Profile"/"Mi Perfil"** por só **"Perfil"/"Profile"** no menu (rótulo mais curto, todas as 3 línguas), e o seletor de idioma **PT/EN/ES virou bandeirinhas SVG** (`FlagIcon.tsx`, inline, sem baixar nada — Brasil/EUA/Espanha simplificadas), ocupando bem menos espaço horizontal. Testado em 375px (celular), 700px e desktop — header cabe numa linha limpa em qualquer largura, nas 3 línguas (inclusive espanhol, que tem os rótulos mais longos: "Subastas"/"Extracto").

**Avatares prontos via DiceBear**: nova whitelist server-side (`backend/src/profile/avatar-presets.ts`) com 8 avatares fixos (estilo `adventurer`, seeds fixas — determinístico, sem hospedar imagem nenhuma, só referencia a URL pública do DiceBear). `GET /public/profile/avatar-presets` lista as opções; `PUT /public/profile/:code/avatar-preset` (body `{ presetKey }`) aplica — valida a key contra a whitelist antes (rejeita qualquer coisa fora da lista, `400`), então o membro nunca consegue setar uma URL arbitrária. Reaproveita o `ProfileService.updateAvatar` já existente (mesmo método usado pelo upload de arquivo). `ProfilePage.tsx` ganhou uma galeria de 8 miniaturas clicáveis (acima do campo de upload já existente) — clicar aplica na hora (mesma regra de sempre: avatar não passa por aprovação), com anel roxo marcando a opção atual.

**Testado ao vivo**: `GET avatar-presets` retornou as 8 URLs; apliquei um preset na Agrute via curl (200, `avatarUrl` mudou pra URL do DiceBear) e testei uma key inválida (`400`, rejeitado); na tela visualmente cliquei em 2 presets diferentes e confirmei via DOM que o anel de seleção e o avatar grande no topo sempre batem com o preset realmente aplicado no backend. Avatar de teste da Agrute revertido pra `null` ao final (não é preferência real da conta dela).

## 2026-08-09 — Código de perfil: mascarado por padrão com "olhinho" + gerar novo a qualquer momento

**Contexto**: o usuário revisou a tela de Personagens e pediu 2 ajustes no código de perfil recém-criado: (1) o código de 12 caracteres aparecia em texto puro na tabela — devia ficar mascarado por padrão, com um ícone de olho pra revelar/ocultar; (2) GM ou conselho precisa poder gerar um código novo a qualquer momento (ex: suspeita de vazamento, membro perdeu o código antigo).

**Backend**: `CharactersService.regenerateProfileAccessCode(id)` (reaproveita o helper `uniqueProfileCode()` já usado no backfill automático) + `POST /characters/:id/regenerate-profile-code` (herda `@Roles('GM', 'COUNCIL')` do controller — os dois papéis podem gerar). Gerar um código novo sobrescreve o antigo na hora; o código anterior para de funcionar imediatamente (não fica um período de transição).

**Frontend**: novo `EyeIcon.tsx` (SVG com `<mask>`, olho aberto/riscado). `CharactersPage.tsx` ganhou `ProfileCodeCell` — mostra `••••••••••••` por padrão, botão de olho alterna pra revelar o código real (só aí aparece o botão "Copiar", pra não incentivar copiar um valor que nem tá visível), e botão "Gerar novo" com confirmação nativa antes de disparar a troca (avisa que o código atual para de funcionar na hora).

**Testado ao vivo**: via curl, código antigo da Agrute (`F2FB74CRHCW8`) respondia 200 em `GET /public/profile/:code`; chamei o endpoint de regenerar como GM, recebi o novo código (`LAMBW36JK3WS`); confirmei que o código antigo passou a responder 404 e o novo responde 200. Visualmente: todas as linhas da tabela mostravam mascarado por padrão; cliquei no olho da Agrute e o código real apareceu junto com o botão Copiar; cliquei de novo e voltou a mascarar. Nota: o código de perfil real da Agrute ficou trocado como efeito colateral desse teste (não é dado sintético — é uma personagem real da guild) — se alguém já tinha compartilhado o código antigo dela, precisa pegar o novo na tela de Personagens.

## 2026-08-09 — Perfil self-service do membro (Discord ID, avatar, pedido de nível com aprovação)

**Contexto**: pedido novo e grande — "personalizar experiência", incluindo ID do Discord por personagem e um painel de configurações self-service. Antes de implementar, levantei 4 pontos genuinamente ambíguos/de alto risco (nível afeta elegibilidade em leilão) e perguntei: (1) atualização de nível aplica na hora ou precisa de aprovação → **precisa de aprovação**; (2) troca de avatar entra nessa rodada ou só o avatar padrão → **troca já entra**; (3) como o membro recebe o código → **GM/conselho compartilha manualmente, mesmo padrão do leilão**; (4) validar ID do Discord como número → **sim, validar 17-19 dígitos**.

**Modelo**: `Character` ganhou `discordId`, `avatarUrl`, `profileAccessCode` (12 caracteres, alfabeto seguro sem 0/O/1/I, gerado automaticamente — `CharactersService.ensureAllPrincipalsHaveProfileCodes`, chamado a cada `findAll()`, então backfilla sozinho quem já existia e quem for promovido de Alt pra Principal depois, sem migração de dados nem botão manual). Novo model `LevelChangeRequest` (`PENDING`/`APPROVED`/`REJECTED`) — pedido de nível **nunca** aplica direto; só quando aprovado é que `Character.level` muda (migration `20260809190000_character_profile`).

**Backend** (`backend/src/profile/`, novo módulo):
- Público, sem login (`@Public()`, código como credencial — mesmo modelo do código de leilão): `GET/PUT /public/profile/:code`, `PUT :code/avatar` e `POST :code/level-request` (os 2 últimos com upload de imagem direto no endpoint — sem endpoint de upload genérico público, pra não abrir uma porta de upload sem controle de acesso).
- Admin (`LevelRequestsController`, GM+conselho): listar por status, aprovar, rejeitar (motivo obrigatório, mesmo padrão de outras ações destrutivas/negativas do sistema). Só 1 solicitação `PENDING` por personagem por vez.

**Frontend**: `/perfil` (entrada de código, espelha `/codigo`) e `/perfil/:code` (tela do membro — avatar com fallback padrão em SVG, ID do Discord, nível atual + formulário de pedido + histórico de solicitações com status). Admin: `CharactersPage.tsx` ganhou colunas Discord ID (editável) e Código de perfil (com Copiar); nova página "Solicitações de Nível" com print, aprovar/rejeitar. i18n nas 3 línguas (página pública, como as demais).

**Testado ao vivo, ponta a ponta, com upload de imagem real**: gerei os 51 códigos de perfil reais pra guild inteira (confirmado backfill automático), busquei o perfil da Agrute pelo código, testei validação de Discord ID (rejeitou "fulano#1234", aceitou 18 dígitos), submeti um pedido de nível com print real — nível não mudou até eu aprovar como GM (66→70 confirmado só depois da aprovação); testei bloqueio de 2ª solicitação enquanto uma está pendente; testei rejeição (motivo obrigatório, nível não muda, não dá pra revisar de novo depois); testei troca de avatar (aplicou na hora, sem aprovação). Conferido visualmente nas telas pública e admin. Dados de teste (nível/Discord ID/avatar/solicitações da Agrute) revertidos ao final — o código de perfil real dela permanece, assim como os 51 gerados pra guild inteira.

## 2026-08-09 — Frequência de atividade generalizada pra N vezes por período (diário/semanal/mensal)

**Contexto**: o usuário pediu explicitamente pra parar e confirmar o design antes de implementar ("não temos pressa... temos que entregar muito bem") — a correção anterior só suportava 1x por semana, e ele quer estar preparado pra atividades futuras que aconteçam 2x, 3x etc. no mesmo período. Propus o design por escrito, o usuário confirmou, e só então implementei.

**Modelo final**: `Activity.emissionMode` (`DAILY`/`RISING_EDGE`) virou `Activity.recurrencePeriod` (`DAILY`/`WEEKLY`/`MONTHLY`, migration `20260809180000_activity_recurrence_period` — renomeia o enum e a coluna, então os 7 já classificados como `RISING_EDGE` viram `WEEKLY` automaticamente, sem retrabalho) + novo campo `maxOccurrencesPerPeriod` (padrão 1). O reset é sempre às 07h GMT-3 (diário todo dia, semanal toda segunda, mensal todo dia 1º — confirmado pelo GM, fixo, não configurável por atividade). `LedgerService.canEmitPeriodic` combina duas checagens: (1) hoje é uma ocorrência nova? (dia anterior mais recente **dentro do mesmo período** não pode estar marcado); (2) o total já emitido nesse período está abaixo do limite?

**Bug real encontrado durante os próprios testes, corrigido antes de entregar**: a 1ª versão do `canEmitPeriodic` olhava pro dia anterior mais recente **sem limitar ao período atual** — testando o cenário mensal (checked em 05/out, ainda checked em 20/out, checked de novo em 02/nov), a emissão de novembro foi **incorretamente bloqueada**, porque o dia anterior mais recente (20/out, de um mês diferente) ainda estava marcado. Corrigido limitando a busca do "dia anterior" só ao período atual (`referenceDate: { gte: periodStart, lt: referenceDate }`) — cruzar a fronteira do período agora sempre libera uma emissão nova, independente do estado do período anterior. Sem esse teste específico (mensal, não só semanal), esse bug teria ido pra produção.

**Testado ao vivo, 3 cenários diferentes**: (1) atividade semanal com limite 2 — simulei uma semana com 2 ocorrências reais (com reset false no meio) mais uma 3ª tentativa genuína na mesma semana — pagou as 2 primeiras, bloqueou corretamente a 3ª por já ter batido o limite; (2) atividade mensal com limite 1 — pegou exatamente o bug acima, e confirmei a correção depois; (3) reconfirmei que as 7 atividades reais (Raid de Guilda etc.) mantiveram `WEEKLY`/limite 1 intactas depois da migration de rename. Dados de teste totalmente revertidos ao final de cada rodada.

## 2026-08-09 — Regra de reset semanal aplicada de verdade (Segunda 07h GMT-3), não mais heurística

**Contexto**: logo depois da correção anterior (RISING_EDGE baseado em "o dia anterior estava desmarcado?"), o GM informou a regra real e exata do jogo: **Verificado/Doar/Atividade da Guilda resetam todo dia; todas as outras atividades resetam semanalmente, toda segunda-feira às 07h GMT-3** — um horário fixo do jogo em si, não configurável por atividade.

Isso permitiu uma implementação melhor do que a heurística anterior: em vez de `wasUncheckedBefore` (que dependia de o import ter capturado algum dia com o flag `false` no meio — frágil se o GM pular a importação bem no dia do reset), `LedgerService.alreadyEmittedThisWeek` agora verifica diretamente se **já existe uma transação emitida** pra aquele personagem+atividade dentro da mesma semana civil (segunda a domingo, UTC, via novo helper `mondayOfWeekUtc`). Funciona corretamente mesmo que o flag nunca apareça como `false` entre duas ocorrências (testei exatamente esse cenário: 3 dias todos com `checked=true`, sendo o 1º e o 3º em semanas diferentes — emitiu certo nos dois, sem nunca ter visto um dia `false` no meio).

**Aplicado às 7 atividades reais desta guild** que se encaixam na regra "todas as outras" — `Raid de Guilda`, `Expedição da Guilda`, `Confronto pelo Paraíso`, `Campo de Batalha de Aço`, `Escaramuça`, `Fortaleza Albern`, `Guerra de Mineração` — todas marcadas como `RISING_EDGE`. `Verificado`, `Doar`, `Atividade da Guilda` e a composta `Diária` continuam `DAILY` (correto, resetam todo dia).

**Testado ao vivo**: simulei 3 dias reais (terça de uma semana, domingo da mesma semana ainda marcado, segunda da semana seguinte com o reset) — emitiu na terça (nova semana), zero no domingo (mesma semana), emitiu de novo na segunda seguinte (semana nova). Dados de teste revertidos ao final.

## 2026-08-09 — Correção de bug real: eventos "grudentos" pagando em dobro; pré-cadastro sem digitação

**Contexto**: o usuário questionou uma afirmação minha da rodada anterior ("a frequência de emissão já é resolvida sozinha pelo XML, sem precisar de configuração") e pediu a fonte. Ao verificar contra os dados reais importados desta guild (em vez de só o código), descobri que eu estava **errado** — e o erro não era hipotético, já tinha causado pagamento em dobro de verdade.

**O bug**: `Raid de Guilda` e `Expedição da Guilda` continuavam com `checked=true` no dia **seguinte** ao evento real (o flag do jogo não "reseta" todo dia pra essas colunas, ao contrário de `Verificado`). Como o sistema emitia toda vez que via `checked=true` num dia novo, isso pagou o mesmo evento **duas vezes** pra 51 combinações de personagem×atividade já nos dados reais desta guild (confirmado com consulta direta no banco, não suposição).

**A correção** (`Activity.emissionMode`, migration `20260809170000_activity_emission_mode`): cada atividade agora tem um modo de emissão que o **GM classifica manualmente** (pedi explicitamente antes de implementar — não dá pra adivinhar com segurança só pelo nome da atividade):
- **`DAILY`** (padrão, comportamento antigo preservado): emite toda vez que aparecer marcado naquele dia.
- **`RISING_EDGE`**: só emite na transição false/sem-registro → true; dias seguintes com o flag ainda marcado são ignorados até ele voltar a false e marcar de novo (nova ocorrência). Implementado em `LedgerService.wasUncheckedBefore` — olha o dia anterior mais recente com registro pra decidir se é continuação ou ocorrência nova. Funciona tanto pra atividades simples quanto compostas.
- Nova coluna "Frequência" em Atividades do Jogo (`ActivitiesPage.tsx`) com um aviso explicando o risco, pra o GM revisar `Raid de Guilda`/`Expedição da Guilda` (e qualquer atividade parecida) e marcar como `RISING_EDGE`.

**Testado ao vivo com simulação de 5 dias reais**: criei uma atividade de teste em `RISING_EDGE`, simulei o padrão exato observado nos dados reais (dia 1 sem marcar, dias 2-3 marcado — mesmo evento —, dia 4 sem marcar, dia 5 marcado — evento novo). Resultado: emitiu no dia 2 (ocorrência nova), **zero** no dia 3 (continuação, corretamente ignorado), zero no dia 4, e emitiu de novo no dia 5 (nova ocorrência) — exatamente 2 emissões pro personagem de teste, nunca 3 ou mais. Dados de teste totalmente revertidos ao final.

**Sobre o ponto 4 (pré-cadastro), segunda correção**: o usuário esclareceu que eu também não tinha entendido — a ideia não era um formulário de texto livre (que ainda arriscaria erro de digitação), e sim usar os nomes que **já são conhecidos** por terem aparecido em imports reais desta guild. Reescrevi `CreateKnownActivityForm` como uma lista de checkboxes com os 10 nomes reais já observados (Verificado, Doar, Atividade da Guilda, Raid de Guilda, Expedição da Guilda, Confronto pelo Paraíso, Campo de Batalha de Aço, Escaramuça, Fortaleza Albern, Guerra de Mineração) — zero campo de texto, o GM só marca e define valor. A lista filtra automaticamente o que já existe (pra esta guild, os 10 já existem, então o formulário fica escondido — testado e confirmado na tela).

## 2026-08-09 — Reenviar XML no mesmo dia sem duplicar emissão; pré-cadastrar atividades conhecidas

**Contexto**: o jogo republica o XML do dia depois que mais gente faz check-in/doação/atividade, então o GM às vezes baixa cedo e precisava reenviar mais tarde — mas a importação rejeitava qualquer 2ª tentativa pra mesma data. Antes de implementar, levantei 2 riscos reais que a mudança introduziria e perguntei ao usuário como tratar cada um (ambos confirmados com a opção recomendada).

**1. Reenvio da mesma data agora é permitido** (`ImportService.importXmlFile`) — removida a trava que rejeitava uma 2ª importação processada pra mesma `referenceDate`. A garantia contra emissão duplicada não muda: já existia e é sólida (`LedgerService.emitOnce` só cria transação se ainda não existir uma pro mesmo personagem+atividade+dia) — o reenvio só emite pra quem ficou de fora do arquivo anterior.

**2. Status "Saiu" só é reavaliado na 1ª importação de cada data** — risco identificado antes de implementar: se `markMissingAsLeft` rodasse em TODO reenvio (não só no primeiro), reenviar um arquivo antigo ou incompleto por engano poderia marcar como "Saiu" gente que está ativa há dias. Confirmado com o usuário: `isFirstImportForDate` agora rastreia se já existe uma importação processada pra aquela data ANTES da atual — `markMissingAsLeft` só roda quando é `true`. Reenvios (mesmo dia ou corrigindo um dia antigo) sempre atualizam check-ins/emissões, nunca voltam a mexer em quem "Saiu".

**3. Frequência de emissão (diária vs. semanal vs. outras)** — confirmado que não precisa de nenhuma mudança: não existe teto/configuração de frequência no sistema. Cada atividade-coluna emite quando o XML daquele dia específico mostra ela marcada — se o jogo só marca algo 1x/semana, a emissão só acontece 1x/semana porque é isso que o dado de origem diz, não uma regra do sistema. Já suporta qualquer cadência futura sem mudança de código.

**4. Pré-cadastrar atividades conhecidas** (`ActivitiesService.createKnownActivity`, `POST /activities/known`) — nova opção em "Atividades do Jogo" pra criar diretamente uma atividade com nome+valor antes do primeiro import real (alternativa mais direta ao truque de "importar um XML só de cabeçalho"). Risco identificado antes de implementar: o import casa atividades por **nome exato** (maiúsculas/acentos/espaços) — se o nome pré-cadastrado não bater com a coluna real, o import cria uma segunda atividade duplicada (com o nome certo, mas valor 0) e o valor pré-configurado nunca é usado, silenciosamente. Confirmado com o usuário: além do aviso no formulário, toda importação agora retorna e exibe (na tela de Importações) os nomes exatos das atividades novas detectadas naquele arquivo (`ImportService.newActivityNames`) — se aparecer um nome parecido mas diferente do pré-cadastrado, fica óbvio na hora.

**Testado ao vivo, ponta a ponta, com XMLs reais construídos pra isso**: subi 3 arquivos pra mesma data sintética (mesma coluna nova, roster cheio no 1º pra não mexer em "Saiu", depois um reenvio com só 3 personagens) — confirmado no banco que cada personagem recebeu a emissão **exatamente uma vez**, mesmo aparecendo "marcado" nos 3 arquivos, e que os ~37 personagens fora do reenvio pequeno continuaram `ACTIVE` (não viraram "Saiu"). Depois pré-cadastrei uma atividade com valor 7, subi o primeiro import real com essa coluna, e confirmei que a emissão já saiu com o valor certo (7, não 0) e que nenhuma atividade duplicada foi criada. Dados de teste totalmente revertidos ao final (activities, check-ins, emissões, import batches, e o `lastSeenAt` que tinha avançado pra data sintética).

## 2026-08-09 — GM apaga leilão/item em qualquer status (com reversão de queima); rótulo do imposto

**1. Rótulo "Dia do corte semanal" → "Dia da coleta de impostos semanal"** — ajuste de texto pedido pelo usuário em `SettingsPage.tsx` (só esse rótulo; "Horário do corte semanal" ficou como estava, não foi pedido).

**2. Controle total do GM sobre leilões (`AuctionsService.forceDeleteAuction`/`forceDeleteItem`)** — antes só dava pra apagar leilão/item em `DRAFT`/`PENDING_APPROVAL` (`deleteDraft`/`removeItem`, sem consequência financeira possível). Agora o GM (só GM, novos endpoints `DELETE /auctions/:id/force` e `DELETE /auctions/:id/items/:itemId/force`, sempre com motivo obrigatório) pode apagar em **qualquer status** — rascunho, aberto ou encerrado.

- **A regra mais delicada aqui**: um item já **vencido** tem uma queima real registrada no ledger (`AUCTION_WIN_BURN`), e o ledger é **append-only** — nunca se apaga ou edita uma transação (PREMISSAS.md seção 4, reforçado a sessão inteira). Apagar esse item não podia significar apagar a queima também. Solução: antes de apagar o item, o sistema cria automaticamente uma transação de **reversão** (`AUCTION_WIN_REVERSAL`, novo valor do enum `LedgerTransactionType`, migration `20260809160000_auction_win_reversal`) creditando o vencedor de volta no valor exato do lance — daí sim apaga o item. O `auctionItemId` da queima original fica `NULL` (a FK já era `ON DELETE SET NULL`, confirmado direto no Postgres antes de implementar), mas a transação em si nunca some.
- Itens ainda `PENDING` (sem vencedor) não geram reversão — só são apagados, já que holds nunca foram débito real.
- `AUCTION_WIN_REVERSAL` foi adicionado ao Extrato Público (`getPublicFeed`) — é a única forma de essa reversão ficar visível depois que o leilão/item deixa de existir (diferente da queima original, que normalmente aparece na página do próprio leilão).
- Frontend (`AuctionBuilderPage.tsx`): botão "Apagar leilão (qualquer status)" no topo e "Apagar item (forçado)" por linha da tabela de itens, visíveis só pro GM, com `prompt()` pro motivo + `confirm()` de dupla checagem antes de executar (mesmo padrão de "Encerrar leilão"/"Encerrar item").

**Testado ao vivo, ponta a ponta, com dinheiro de verdade envolvido**: criei um leilão de teste, publiquei, dei um lance de 15 como jogador via código de acesso, esperei o cron de expiração (roda a cada minuto) resolver o item como vencido de verdade (saldo caiu 101→86), depois apaguei o leilão inteiro pelo endpoint novo — saldo voltou pra 101 exatamente, e o extrato/banco mostram as duas transações (queima original -15 e reversão +15) lado a lado, pra sempre. Confirmado também que apagar sem motivo é bloqueado (400) e que apagar um rascunho comum continua funcionando.

## 2026-08-09 — Horário do imposto, backup/restore via admin, emissão manual em lote, aviso fixo

**Contexto**: 4 pedidos do usuário nessa rodada — segurança do imposto com saldo insuficiente (só precisava de confirmação, já estava seguro), horário configurável do corte semanal, backup/restore pela UI, e emissão manual pra vários jogadores + aviso fixo na home.

**1. Confirmado: imposto semanal nunca trava nem deixa saldo negativo** — `LedgerService.runWeeklyTax` já calculava `taxAmount` a partir do saldo disponível e pulava (`continue`) qualquer personagem com `taxAmount <= 0`, sem criar transação, sem erro, sem travar o loop dos demais. Nenhuma mudança de código necessária, só confirmação/explicação.

**2. Horário configurável do corte semanal** (`GuildSettings.weeklyTaxTimeUtcMinutes`, migration `20260809140000_weekly_tax_time`) — antes só o dia da semana era configurável (hora fixa em 05:00 UTC no código). `WeeklyTaxCronService` agora roda a cada 5 minutos (`*/5 * * * *`) e só executa quando dia **e** horário batem com o configurado (janela de 5min). `SettingsPage.tsx` ganhou um campo de hora, e o dia/hora são convertidos entre o fuso do GM e UTC reaproveitando `localWeekdaysAndTimeToUtc`/`utcWeekdaysAndTimeToLocal` (mesmo utilitário já usado pra agenda recorrente de Atividades) — inclusive o cuidado de o horário local "virar o dia" ao converter (testado: Segunda 23:30 local UTC-3 → Terça 02:30 UTC, corretamente).

**3. Backup e restore pela UI** (`/admin/backup`, GM-only) — novo módulo `backend/src/backup` usando `pg_dump`/`psql` conectando direto via `DATABASE_URL` (sem `docker exec`/socket do Docker). Precisou instalar `postgresql-client-16` nos Dockerfiles (dev e prod) via repositório oficial da PostgreSQL — o client genérico do Debian bookworm é a v15, que o `pg_dump` recusa usar contra um servidor v16 ("server version mismatch"). Backup: `GET /admin/backup` baixa um `.sql` (`pg_dump --clean --if-exists`, então o próprio arquivo já sabe se limpar ao restaurar). Restore: `POST /admin/backup/restore` exige upload do arquivo + digitar "RESTAURAR" (validado no backend também, não só na tela) — sobrescreve o banco inteiro na hora. Cobre só o banco, não as imagens enviadas (`uploads/`). **Testado ao vivo, de ponta a ponta, contra o banco de dev real**: baixei um backup via API, confirmei que restaurar sem/com confirmação errada é bloqueado (400), depois restaurei esse mesmo backup de volta (idempotente, já que são os mesmos dados) — contagem de linhas e saldo de um personagem batendo exatamente antes/depois, app respondendo normal e login do GM funcionando em seguida.

**4. Emissão Manual do GM agora aceita vários jogadores de uma vez** — antes `recordGmManualAdjustment` só aceitava 1 `characterId`; virou `characterIds: string[]`, todos recebendo o mesmo valor/motivo/print numa única transação de banco (`$transaction`, tudo ou nada). `ManualAdjustmentPage.tsx` virou uma grade de checkboxes (mesmo padrão de participantes de leilão) com "Selecionar todos"/"Desmarcar todos". Motivação do usuário: cobrir o caso de o XML do dia sair tarde (07h GMT-3) e ele precisar creditar manualmente quem ficaria sem receber. Testado via API: 2 personagens, 1 requisição, os 2 saldos subiram corretamente.

**5. Aviso Fixo na home, editável só pelo GM** — novo campo `GuildSettings.pinnedAnnouncementText` (migration `20260809150000_pinned_announcement`, já populado com o texto pedido: "Faça seu Check-in, doação e atividade até às 21h GMT-3..."). Fica num card vermelho de destaque no topo da home, **separado** do Mural normal (que continua existindo por baixo, sem mudança). Só o GM pode editar — novo endpoint dedicado `PUT /guild-settings/pinned-announcement` (`@Roles('GM')`); o endpoint geral de configurações (`PUT /guild-settings`, GM+Conselho) foi alterado pra reconstruir o payload explicitamente e ignorar esse campo mesmo que alguém tente mandar — testado: Conselho não consegue mudar o aviso fixo pela rota geral, só o GM pela rota dedicada.

## 2026-08-09 — Imposto semanal: arredondamento correto, corte manual pelo GM, visível no Extrato

**Contexto**: discussão com o usuário sobre a corretude do imposto semanal levantou 3 pontos, todos implementados nesta rodada.

**1. Arredondamento do imposto** — antes usava `Math.floor` puro (10,6 virava 10, perdendo 0,6 sempre). Regra combinada com o usuário: acima de x,5 arredonda **pra cima** (10,6 → 11); em x,5 exato ou abaixo arredonda **pra baixo** (10,5 → 10; 10,4 → 10). Reescrito com aritmética inteira (`numerator % 100`, sem dividir em ponto flutuante antes de decidir o lado do arredondamento) em `LedgerService.runWeeklyTax`, pra nunca ter erro de precisão de float na hora de decidir se arredonda pra cima ou pra baixo.

**2. Corte semanal manual, restrito ao GM** — novo botão "Rodar corte semanal agora" em Configurações, visível só pro GM (`user?.role === 'GM'`). Fluxo: `prompt()` pede o motivo (obrigatório, cancelar aborta) → `confirm()` mostra um resumo do que vai acontecer (percentual, dia automático configurado, motivo digitado) antes de executar de verdade — mesmo padrão já usado em "Encerrar leilão" e "Apagar rascunho". Backend: novo endpoint `POST /ledger/weekly-tax/run-now` (`@Roles('GM')`, exclusivo — Conselho não acessa), valida motivo obrigatório, chama `LedgerService.runWeeklyTax({ manual: true, reason, triggeredById })`. Novos campos em `WeeklyTaxRun` (`triggeredManually`, `reason`, `triggeredById`, migration `20260809130000_weekly_tax_run_manual_trigger`) e o motivo também fica gravado em cada `LedgerTransaction` gerada (mesmo padrão de `Emissão Manual`/`Evento Manual`). Adicionado também `GET /ledger/weekly-tax/runs` + uma tabela de histórico em Configurações (data, automático/manual, %, personagens taxados, total queimado, motivo) — dá pro GM ver quando foi a última execução antes de decidir se vale rodar de novo, evitando taxar a mesma semana duas vezes sem querer.

**3. Queima do imposto agora aparece no Extrato Público** — `LedgerService.getPublicFeed` incluía só `TRANSFER_OUT`, `GM_MANUAL_ADJUSTMENT`, `MANUAL_EVENT_EMISSION`, `ACTIVITY_EMISSION`; adicionado `WEEKLY_TAX_BURN`. Novo rótulo "Imposto semanal" (`feed.typeWeeklyTax`) nas 3 traduções.

**Testado ao vivo**: validado que `POST /ledger/weekly-tax/run-now` rejeita sem motivo (400) e sem autenticação (401); disparado um corte manual de teste real (10%, 40 personagens taxados de 42 Principais — os 2 restantes tinham saldo disponível zerado após desconto de holds de 4 leilões abertos no momento), conferido que os valores batem com a nova regra de arredondamento, que aparece no histórico de Configurações e no Extrato Público com o motivo anexado; revertido em seguida (transações + `WeeklyTaxRun` apagados) por ser um corte de teste, não um corte real da guild — os personagens voltaram ao saldo de antes.

## 2026-08-09 — Leilão com data/hora de término exata; login do GM renomeado

**1. Leilão: data/hora de término exata em vez de duração fixa de 24h** — antes, `AuctionsService.publish` sempre calculava `expiresAt = now + 24h` no momento da publicação. Agora o conselho/GM define a **data e hora exata** em que o leilão fecha, numa nova etapa antes de publicar:
- **Schema**: novo campo `Auction.scheduledEndAt` (nullable, migration `20260809120000_auction_scheduled_end_at`).
- **Backend**: novo endpoint `PUT /auctions/:id/schedule` (`AuctionsService.setSchedule`) — só editável em `DRAFT`/`PENDING_APPROVAL`, valida que a data é real e está no futuro. `approve()`/`publish()` agora exigem `scheduledEndAt` definido e no futuro antes de publicar (senão bloqueia com mensagem clara); `publish()` usa esse valor como `expiresAt` em vez de calcular +24h.
- **Frontend**: `AuctionBuilderPage.tsx` ganhou uma seção "Data/hora de término" com um campo `datetime-local` (fuso do navegador de quem está cadastrando, convertido corretamente pra UTC ao salvar e de volta ao exibir — mesmo cuidado de fuso já usado em `scheduleTimezone.ts` pra agenda recorrente, mas aqui é um instante único, não um padrão semanal). Botão "Publicar agora"/"Aprovar publicação" fica desabilitado até a data ser salva.
- Todas as menções a "24h" nos comentários do código e no `PREMISSAS.md` (seção 7) foram atualizadas pra refletir a nova regra.
- **Testado ao vivo**: criei um leilão de teste, tentei publicar sem definir a data (bloqueado, botão desabilitado), defini `10/08/2026 15:30` (fuso do navegador) e salvei, publiquei — status mostrou corretamente "expira em 10/08/2026, 15:30:00"; confirmado via API que o valor gravado em UTC bateu com o offset esperado do fuso (18:30 UTC = 15:30 em UTC-3). Leilão de teste encerrado em seguida (`closeAuction`, motivo registrado) pra não deixar leilão fake aberto.

**2. Login do GM: "gm" → "guildmaster"** — trocado o usuário padrão de bootstrap em `AuthService.onModuleInit` (fallback quando `GM_BOOTSTRAP_USERNAME` não está setado) e nos 3 arquivos de configuração (`backend/.env.example`, `.env.production.example`, `docker-compose.yml`). Como a conta de GM deste ambiente de dev já tinha sido criada com o username antigo (bootstrap só roda se não existir nenhum GM no banco), o registro existente foi renomeado diretamente no banco (`UPDATE "User" SET username='guildmaster' WHERE username='gm'`) pra manter consistência sem precisar recriar a conta. **Testado**: login com "gm" agora rejeitado (401); login com "guildmaster" + senha atual funciona normalmente.

## 2026-08-09 — Extrato: 25 itens por página, rótulo renomeado, filtro por data

**Contexto**: pedido de 3 ajustes na página de Extrato Público (`TransparencyFeedPage.tsx`).

**1. 25 itens por página** — já era o padrão em `LedgerService.getPublicFeed` (`pageSize: 25`); confirmado ao vivo via API (`"pageSize":25,"total":265,"totalPages":11`), sem necessidade de mudança de código.

**2. Rótulo "Emissão automática (import)" → "Nova emissão por import"** — trocado nas 3 traduções (`feed.typeActivityEmission` em `pt-BR.json`/`en.json`/`es.json`: "Nova emissão por import" / "New issuance from import" / "Nueva emisión por import"). Testado ao vivo (locale ES): cards do extrato mostrando "Nueva emisión por import" corretamente.

**3. Filtro por data (range ou dia específico)** — além do filtro por jogador já existente. Backend: `LedgerService.getPublicFeed`/`PublicController.getFeed` agora aceitam `fromDate`/`toDate` opcionais, filtrando por `createdAt` — interpretados como **dia civil em UTC** (`T00:00:00.000Z`/`T23:59:59.999Z`), mesma convenção já usada em `ImportBatch.referenceDate` e `ManualEventBatch.occurrenceDate`, sem conversão pelo fuso do navegador. Frontend: dois campos `type="date"` ("De"/"Até") na página de Extrato, com botão "Limpar datas" que só aparece quando algum dos dois está preenchido. Testado ao vivo: filtro num dia sem transações mostrou corretamente "Nada por aqui ainda."; filtro no dia de hoje mostrou os 265 registros; "Limpar datas" restaurou a lista completa.

## 2026-08-09 — Ícone de engrenagem, "Próximos Eventos" só da semana, saldos na Transferência, Extrato com emissões de import

**1. Ícone de engrenagem parecia sol** — o desenho anterior (círculo + 8 raios finos saindo do centro) é literalmente o padrão de ícone de "sol". Redesenhado em `GearIcon.tsx` com uma técnica diferente: um corpo circular sólido (`fill`) + 8 dentes retangulares grossos que se sobrepõem à borda do círculo (não raios soltos saindo do centro) + um furo central de verdade via `<mask>` SVG (não uma cor de fundo fixa, que quebraria em qualquer contexto que não fosse o fundo exato usado). Testei renderizando o SVG isolado, ampliado — lê claramente como engrenagem agora.

**2. "Próximos Eventos" mostrava a semana inteira rolante (7 dias a partir de agora), não a semana atual** — trocado pra calcular o fim da **semana civil atual** (domingo 23:59:59) em vez de "agora + 7 dias" (`HomePage.tsx`, nova função `endOfWeek`). Se hoje já é domingo, o fim da semana é hoje mesmo, então só eventos de hoje aparecem — exatamente o exemplo que o usuário deu. Testado ao vivo: com o servidor em domingo 09/08, os eventos recorrentes de segunda/quarta que apareciam antes corretamente sumiram, restando só os de hoje.

**3. Transferência: saldo insuficiente + visibilidade dos saldos** — duas partes:
- **Backend**: `LedgerService.recordTransfer` agora valida o saldo do personagem de origem *antes* de criar a transação, com mensagem clara ("Saldo insuficiente pra essa transferência. Saldo atual: X.") — antes só a trigger de banco (backstop silencioso) impediria, retornando um erro cru de SQL. Testado via API: transferência de 99999 corretamente rejeitada com a mensagem nova.
- **Frontend**: `TransferPage.tsx` agora mostra o saldo atual de "De" e "Para" assim que selecionados, e o saldo projetado de cada um *depois* da transferência, atualizando ao digitar o valor — além de um aviso e botão desabilitado se o valor exceder o saldo de quem envia. Testado ao vivo: Agrute (98) → BASSON (108), valor 5 → mostrou "93" e "113" corretamente; valor 999 → aviso "Agrute só tem 98 DKP disponível" e botão desabilitado.

**4. Extrato não mostrava emissões automáticas de import de XML** — `LedgerService.getPublicFeed` só incluía `TRANSFER_OUT`, `GM_MANUAL_ADJUSTMENT` e `MANUAL_EVENT_EMISSION`; adicionado `ACTIVITY_EMISSION` à lista, com o nome da atividade de origem (`sourceActivity`) incluído na resposta e exibido no card ("Atividade: Raid de Guilda"). Testado ao vivo: extrato agora mostra "Emissão automática (import)" com o nome da atividade e a data/hora certas.

## 2026-08-09 — Botão "Salvar" redundante + Proteções: desativar (não apagar) + labels claros

**1. "Salvar componentes"/"Salvar agenda" redundante** — desde que os botões viraram ícones (engrenagem = "Opções", calendário = "Agenda"), o texto do botão de salvar *dentro* de cada seção repetia a mesma palavra que já estava no tooltip que a abriu. Trocado por só "Salvar" nos dois lugares (`ComponentsEditor` e `ScheduleEditor` em `ActivitiesPage.tsx`).

**2. Proteções: não dava pra apagar, e os campos do formulário de criação não tinham legenda** — duas coisas:
- **Apagar de verdade não é seguro aqui**: leilões antigos podem ter itens que referenciam uma Proteção (`AuctionItem.protectionId`), e apagar quebraria esse histórico — por isso o modelo já tinha um campo `isActive` desde o início (documentado em PREMISSAS.md como soft-delete), só nunca tinha sido ligado a nenhum botão na UI. Adicionado botão "Desativar"/"Reativar" por proteção: uma proteção desativada some da lista de opções na hora de cadastrar um item novo de leilão (`AuctionBuilderPage.tsx` agora filtra por `isActive`), mas continua aparecendo na tela de Proteções (esmaecida, com badge "Desativada") pra manter o histórico e permitir reativar.
- **Formulário de criação sem legenda**: os 4 campos (`CreateProtectionForm`) usavam só `placeholder`, que some assim que o usuário começa a digitar e não é visível de cara. Convertido pro mesmo padrão de label visível e persistente usado no resto do admin, com texto explicando o que cada campo faz (ex: "Nível mínimo do personagem — quem tem nível abaixo disso não consegue ofertar..."). O rótulo de "Lance mínimo" também usa a sigla da moeda configurada (`DKP`, no caso), não mais fixo.

**Testado**: desativei PCE1 — sumiu do dropdown de proteção ao criar um item de leilão novo, continuou aparecendo (esmaecida, "Desativada") na tela de Proteções; reativei de volta. Confirmado botão do editor de componentes mostrando só "Salvar".

## 2026-08-09 — 3 bugs reportados: moeda hardcoded, seleção automática, apagar rascunho

**1. "BRC" fixo no código, ignorando o nome da moeda configurado** — o usuário mudou a sigla da moeda pra "DKP" nas Configurações, mas a tela de Personagens continuava mostrando "BRC" na coluna e nos badges "Recebe BRC"/"Não recebe BRC". Busquei por todo o admin e encontrei o mesmo problema em mais lugares (viola a premissa "nada de BRC fixo no código" já documentada) — corrigido em todos: `CharactersPage.tsx` (coluna, badge, texto de ajuda), `CustomEventsPage.tsx` (label do valor sugerido, botão "Distribuir X", texto de ajuda, mensagem de erro), `ActivitiesPage.tsx` (label do valor), `ImportsPage.tsx` (textos de ajuda). Todos agora buscam `GuildSettings.currencyAbbr` em vez de hardcode. Testado ao vivo: tela de Personagens mostrando "DKP" corretamente em toda parte.

**2. Seleção automática de participantes elegíveis não funcionava de verdade** — a rodada anterior só tinha implementado o *filtro* (esconder quem não é elegível) mais um botão "Selecionar todos" que exigia clique manual; o usuário esperava que os elegíveis já viessem marcados. `AuctionBuilderPage.tsx`: quando não há participantes salvos ainda e o GM não mexeu manualmente em nada, a seleção agora parte automaticamente de todos os elegíveis (em vez de vazia) — clicar numa caixa ou nos botões Selecionar/Desmarcar todos continua sobrepondo essa escolha automática, como antes. Testado: item com proteção PCE1 (nível 57+) — os 3 personagens elegíveis já aparecem marcados sem nenhum clique.

**3. Não dava pra apagar um rascunho de leilão** — só existia a opção de publicar; um rascunho criado por engano, ou de teste, ficava preso pra sempre. Adicionado `AuctionsService.deleteDraft` (só permitido em `DRAFT`/`PENDING_APPROVAL` — um leilão já publicado usa "Encerrar leilão" com motivo, nunca é apagado, pra preservar histórico público) + `DELETE /auctions/:id`. Botão "Apagar rascunho" na tela do leilão (volta pra lista depois) e "Apagar" direto na lista, os dois com confirmação. Testado via API: rascunho apagado com sucesso e confirmado sumido; tentativa de apagar o leilão real "Boss Summon" (`OPEN`) corretamente bloqueada.

## 2026-08-09 — Menu admin agrupado por seção

**Contexto**: o menu lateral do admin tinha crescido pra 11 itens numa lista só, sem hierarquia. Alinhei com o usuário 5 agrupamentos por função antes de implementar:

- **Dados do Jogo**: Importações, Personagens.
- **Atividades & Conteúdo Público**: Atividades do Jogo, Eventos Personalizados, Mural.
- **Leilões**: Leilões, Proteções.
- **Ledger**: Transferência, Emissão manual (GM).
- **Sistema**: Conselho (GM), Configurações.

**Alterado**: `AdminLayout.tsx` — nav agora é uma lista de `<div className="admin-nav-group">`, cada um com um rótulo de seção (`admin-nav-group-label`) fixo acima dos links do grupo, com um separador sutil entre grupos. Puramente visual/estrutural — nenhuma rota, permissão ou comportamento de navegação mudou. No mobile (nav vira linha horizontal), os rótulos de seção somem e os links continuam todos visíveis, só sem separação por grupo (simplificação aceitável pro admin, que é majoritariamente uso desktop).

## 2026-08-09 — Emissão só no momento do import (nunca retroativa) + import padrão sem personagens

**Contexto**: discussão com o usuário sobre os "valores novos" reportados na rodada anterior (Raid de Guilda / Expedição da Guilda pagando retroativo quando o valor foi definido) revelou que o comportamento retroativo era **errado por design**, não um bug isolado. Regra correta, confirmada com o usuário: o valor de uma Atividade é só "a régua vigente agora" — emissão de BRC só acontece no **momento do import**, usando o valor atual; mudar um valor depois **nunca** reprocessa dias já importados, só passa a valer pros próximos. Isso também destrava o pedido de ter um "import padrão" (só atividades, sem personagens) pra configurar os valores reais antes do primeiro import de produção.

**Alterado (breaking, intencional)**
- Removida a emissão retroativa: `LedgerService.recordEmissionsForActivity()` (varria todo o histórico de check-ins toda vez que uma Activity era criada/editada/tinha componentes alterados) foi **deletada** — nenhum caller restante. `ActivitiesService.createManual/update/setComponents` não chamam mais nada do Ledger; `ActivitiesModule` não depende mais do `LedgerModule`.
- `ImportService.importXmlFile`: `markMissingAsLeft` só roda se o arquivo tiver pelo menos 1 linha de personagem (`rows.length > 0`) — um arquivo "padrão" (só cabeçalho) não prova ausência de ninguém, então não pode marcar todo mundo como "Saiu".
- `ImportsPage.tsx`: texto explicando as duas mudanças — que a emissão usa sempre o valor no momento do import, e como usar um arquivo só-cabeçalho pra configurar uma guild nova antes do primeiro import real.

**Testado**: com o container reiniciado (achei de cara que meu primeiro teste rodou contra o código antigo, sem hot-reload — revertido e refeito), editar o valor de "Verificado" (de 0 pra 7, atividade com 163 check-ins reais marcados) não criou **nenhuma** transação nova — confirmando que parou de reprocessar histórico. Upload de um XML sintético só com a linha de cabeçalho (3 colunas, uma delas nova) confirmou `rowCount: 0`, `newCharactersDetected: 0`, `emittedCount: 0`, a atividade nova criada travada em valor 0, e **nenhum** personagem existente marcado como "Saiu" (contagem de LEFT antes/depois idêntica). Dados de teste revertidos depois.

**Nota**: como combinado com o usuário, as emissões retroativas já feitas antes dessa correção (Agrute/BASSON/Emmerick recebendo por Raid de Guilda/Expedição da Guilda) **não foram revertidas** — ambiente de desenvolvimento, tudo zera na hora de ir pra produção, e ter saldo nos personagens ajuda nos testes.

## 2026-08-09 — Import de XML em lote + bloqueio de data duplicada; double-check do botão de desistir

**Contexto**: dois pedidos — (1) double-check de que o botão "Desistir deste item" só aparece pra quem realmente deu lance; (2) poder importar vários arquivos XML de uma vez (pra colocar em dia dias esquecidos), com o sistema detectando a data pelo nome do arquivo e nunca reprocessando uma data já computada.

**Double-check (1)**: já estava correto — `PlayerAuctionPage.tsx` já condicionava o botão a `item.ownAmount > 0` (característica de ter dado lance de verdade). Confirmado ao vivo com dado real: BASSON, que não tem lance no item "Braço t2" do leilão "Boss Summon", recebe `ownAmount: 0` da API e o botão corretamente não aparece pra ele. Nenhuma mudança de código necessária.

**Adicionado (2)**
- `ImportsPage.tsx`: input de arquivo agora aceita seleção múltipla (`multiple`). Os arquivos selecionados são ordenados pelo nome (que já ordena cronologicamente, dado o padrão `AAAAMMDD_HHMMSS_...`) e enviados um por um, sequencialmente — cada resultado (sucesso / pulado por já processado / erro) aparece na tela conforme processa, sem travar o restante do lote se um arquivo tiver problema.
- `ImportService.importXmlFile`: nova checagem de dedup por **data de referência** (além da já existente por nome de arquivo exato) — se já existe um `ImportBatch` `PROCESSED` pra aquela data (mesmo com nome de arquivo diferente), rejeita com 409 e indica qual arquivo já cobriu a data. Fecha a lacuna real: antes, dois arquivos com nomes diferentes mas a mesma data embutida no nome seriam processados os dois (inofensivo na prática, graças ao upsert de check-in e ao `emitOnce` idempotente do ledger, mas não deveria ser permitido de qualquer forma).

**Testado**: reenvio de um arquivo com data já processada (nome diferente) corretamente rejeitado com a mensagem nova; simulação da sequência exata que o lote faz (arquivo com data nova processado normalmente, arquivo com data repetida rejeitado logo em seguida) confirmada via API direta. Dados de teste (import sintético da data nova) revertidos depois.

**Nota de transparência**: durante os testes, percebi valores novos sendo salvos em "Raid de Guilda" e "Expedição da Guilda" (provavelmente você ou o conselho mexendo no painel ao mesmo tempo) — isso disparou emissão retroativa legítima do sistema pra quem já tinha check-in nessas atividades nos dias 07 e 08 mas ainda não tinha sido pago (comportamento correto e documentado, "PREMISSAS.md seção 5"). Não toquei nesses dados, só verifiquei que não eram duplicata nem resultado dos meus próprios testes antes de deixar como está.

## 2026-08-09 — Reforma visual completa (tema escuro, inspirado em referência do usuário)

**Contexto**: o usuário apontou que a interface estava "meio estática" (CSS quase cru do scaffold do Vite, sem sistema de design) e anexou 4 telas de um dashboard de servidor de jogo (RUSTSTREET) como referência — tema escuro, roxo vibrante, cards arredondados, nav em pills, tabelas limpas. Pediu explicitamente pra melhorar a interface "como um todo" **sem mexer em nada na mecânica atual**.

**Decisões tomadas** (perguntei ao usuário sobre as duas, não obtive resposta, segui com a opção recomendada em cada uma — reversível se ele preferir o outro caminho):
- Site passou a ser **só tema escuro** (removida a alternância clara/escura por preferência do SO) — as 4 imagens de referência não mostram nenhuma variante clara.
- Adicionada a fonte **"Rajdhani"** (Google Fonts) pra títulos/nav/botões — condensada, bold, caixa-alta, mais perto do visual da referência; texto corrido continua na fonte do sistema.

**Alterado**
- `frontend/src/index.css`: reescrito com um sistema de tokens novo (`--bg`, `--bg-elevated`, `--accent` roxo, `--success`/`--danger`, raios de borda), tema único escuro.
- `frontend/src/App.css`: reescrito por completo, reaproveitando **todos** os nomes de classe já usados no JSX (`.card`, `.badge`, `.data-table`, `.settings-form`, `.pagination`, etc.) — confirmado via grep que 100% das classes usadas em qualquer página do app têm regra correspondente no CSS novo. Botões e inputs viraram estilo global (antes só cobriam contextos admin, deixando botões públicos como "Ofertar"/"Desistir" sem estilo — corrigido durante o teste).
- `frontend/index.html`: título da aba, `<link>` da fonte, `color-scheme: dark`.
- `frontend/src/layouts/PublicLayout.tsx`: trocado `Link` por `NavLink` nos itens do menu público, único jeito de o CSS de estado ativo (pill preenchida de roxo) funcionar — o menu admin já usava `NavLink`.
- **Nada de lógica, dados, rotas ou regras de negócio mudou** — só CSS e essa troca pontual de componente de navegação.

**Testado**: navegado por página representativa de cada padrão visual do app — Home, Leilões (lista + detalhe com resultado/desempate), Saldo, Extrato, Código, tela de lance via código, e no admin: Login/Importações, Personagens, Leilão (builder completo com todos os botões novos de desistência/encerramento), Configurações, Eventos Personalizados, Atividades do Jogo, lista de Leilões — todas renderizando corretamente, sem erros novos no console, type-check limpo.

## 2026-08-09 — Desistência de item, encerramento antecipado do GM, e código de leilão mais curto

**Contexto**: 3 pedidos sobre o motor de leilão — (1) jogador poder desistir de um item em que já deu lance, com o valor reservado voltando pra carteira; (2) se todos desistirem o item vira "Não reclamado", e se sobrar só 1 com lance ele vence na hora — com cuidado extra pra não travar a última pessoa de conseguir desistir; (3) GM poder encerrar um item ou o leilão inteiro antes da hora, com motivo obrigatório, liberando saldo reservado na hora; (4) código de acesso mais curto e fácil de decorar, formato LLLLNN.

**Adicionado**
- `AuctionItemWithdrawal` (nova tabela): registra a desistência de um personagem num item específico — o `Bid` em si nunca é apagado (append-only, transparência total), só passa a ser ignorado nos cálculos de líder/hold/vitória.
- `AuctionsService.withdrawFromItem`: trava por **item** (advisory lock, diferente do lock por personagem usado em `placeBid`) — serializa desistências concorrentes no mesmo item, pra garantir que a contagem de "quem ainda está dentro" nunca fica inconsistente. Se restar 0 concorrentes ativos → item vira `UNCLAIMED`. Se restar exatamente 1 → ele vence na hora (cria `AUCTION_WIN_BURN`, sem precisar esperar a expiração de 24h). Se restar mais de 1, nada muda.
- Novo valor no enum `AuctionItemResolutionStatus`: `CANCELLED`, com `AuctionItem.cancelReason` e `Auction.closeReason` — GM (só GM, não conselho) pode encerrar um item específico (`POST /auctions/:id/items/:itemId/cancel`) ou o leilão inteiro (`POST /auctions/:id/close`), ambos com motivo obrigatório. Encerrar o leilão inteiro cancela em cascata todo item ainda `PENDING` com o mesmo motivo.
- Botão "Desistir deste item" na tela do jogador (`PlayerAuctionPage`), com confirmação; botões "Encerrar item" / "Encerrar leilão inteiro" na tela do GM (`AuctionBuilderPage`), pedindo o motivo via prompt.
- Nova linha "Reservado em lances" na tela do jogador, mostrando explicitamente quanto do saldo está retido — nome sugerido pro conceito que antes só existia como "hold" internamente, sem rótulo visível na UI.
- Formato do código de acesso mudou de 10 caracteres aleatórios pra **LLLLNN** (4 letras + 2 números, ex: `EHDS77`) — mais fácil de decorar e digitar de cabeça. Códigos já emitidos no formato antigo continuam válidos até o leilão deles fechar (a mudança só afeta leilões publicados dali pra frente).

**Corrigido (bug real, pré-existente, encontrado nesta rodada)**: o cron de resolução de leilões expirados (`resolveExpiredAuctions`) processava **todos** os itens de um leilão expirado, sem checar se algum já tinha sido resolvido antes da hora — um item resolvido cedo (por desistência ou cancelamento do GM) seria reprocessado ao expirar as 24h, causando **queima duplicada de BRC** pro mesmo vencedor, ou sobrescrevendo um cancelamento. Agora o cron só toca itens ainda `PENDING`. Esse gap era inofensivo antes (nada resolvia um item cedo), mas virou alcançável com as duas features novas desta rodada — corrigido junto.

**Testado**: leilão de teste com 3 participantes — 1ª desistência (2 restam, item continua ativo, re-lance da pessoa que desistiu é bloqueado); 2ª desistência (resta 1, vitória automática confirmada com queima correta); vencedor não consegue desistir de item já resolvido; item com um único lance que desiste sozinho vira "Não reclamado". Segundo leilão de teste — cancelamento de item com motivo obrigatório (rejeitado sem motivo), saldo reservado liberado na hora; encerramento do leilão inteiro cancelando em cascata o item ainda pendente. Formato de código novo confirmado (`EHDS77`, `BQMV33`, `YTGN98`). Dados de teste revertidos manualmente depois — saldos de Agrute/BASSON/Emmerick conferidos batendo com os valores originais.

## 2026-08-09 — Filtro de elegibilidade + imagem no cadastro de item de leilão

**Contexto**: 3 fricções apontadas na tela de criação de leilão (`/admin/auctions/:id`).

**Adicionado**
- Filtro automático de **Participantes** por elegibilidade: assim que o leilão tem ao menos 1 item, a grade de checkboxes só mostra quem bate o requisito de nível de **pelo menos um** item atual (mesma regra do backend que decide quem recebe código — `AuctionsService.isEligible`, replicada no frontend em `isEligibleForItem`). Quem não bate requisito de nenhum item some da lista, com uma nota explicando quantos foram escondidos e por quê (não recebem código de qualquer forma).
- Botões **"Selecionar todos" / "Desmarcar todos"** acima da grade — operam sobre a lista já filtrada, então quando não há proteção restringindo (todos elegíveis), 1 clique marca todo mundo em vez de clicar item por item.
- Campo de **imagem** no formulário "Adicionar item" (reaproveitando `ImageUploadInput`) — o backend já aceitava `imageUrl` no item desde a Fase 3, só faltava o campo na UI. Miniatura agora aparece na tabela de itens do admin, e a imagem em tamanho maior aparece no painel público do leilão (`PublicAuctionDetailPage`) e na tela de lance via código (`PlayerAuctionPage`) — ambos os endpoints já devolviam `imageUrl`, só faltava renderizar.

**Testado**: adicionado item de teste com proteção PCE1 (nível mínimo 57) — grade de participantes caiu de 42 pra exatamente os 3 personagens com nível ≥ 57; "Selecionar todos" marcou os 3 corretamente. Item de teste com `imageUrl` confirmado renderizando miniatura na tabela do admin. Dados de teste revertidos depois. (`frontend/src/pages/admin/AuctionBuilderPage.tsx`, `frontend/src/pages/PublicAuctionDetailPage.tsx`, `frontend/src/pages/PlayerAuctionPage.tsx`)

## 2026-08-09 — Ponto de entrada público pro código de leilão

**Contexto**: o usuário percebeu que o sistema gera códigos de acesso de leilão (e o admin já tem um botão "Copiar" pra cada um), mas não havia como um jogador realmente *usar* o código — a rota `/oferta/:code` sempre funcionou, mas só era alcançável digitando a URL manualmente, sem nenhum link ou formulário público apontando pra ela.

**Adicionado**
- Link **"Código"** no menu público (`frontend/src/layouts/PublicLayout.tsx`), entre "Leilões" e "Saldos".
- Nova página `EnterCodePage.tsx` (rota `/codigo`) — campo de texto (maiúsculas automáticas, já que os códigos gerados só usam letras maiúsculas/números) que redireciona pra `/oferta/:código` ao submeter. Código inválido reaproveita a tela de erro que a `PlayerAuctionPage` já tinha (`player.invalidCode`).
- Chaves i18n `nav.code` e namespace `codeEntry.*` nos 3 idiomas (pt-BR/en/es).

**Testado**: peguei um código real de um leilão aberto no banco (`Boss Summon`), digitei em minúsculas na nova tela, confirmei o redirecionamento e o carregamento correto da visão do personagem (saldo, item, formulário de lance); testado também código inválido, caindo corretamente na tela de erro existente.

## 2026-08-09 — Eventos Personalizados: telas separadas por origem + fluxo de distribuição/encerramento

**Contexto**: o usuário apontou que o fluxo anterior (evento manual ligado à Activity, ver seção abaixo) não ficou bom — o menu "Atividades" ainda misturava atividades do jogo com eventos personalizados, e a emissão continuava numa tela genérica "Evento Manual" desconectada da lista de eventos publicados. Pedido: separar por origem (Atividades do Jogo vs. Eventos Personalizados) e mover a distribuição de BRC pra dentro da própria tela/card do evento, com um botão "Distribuir BRC" que também encerra o evento.

**Decisão tomada com o usuário**: perguntado explicitamente sobre o que "encerrar" significa pra um evento **recorrente**, a resposta foi um meio-termo — "Distribuir BRC" fecha só aquela ocorrência (evento recorrente continua ativo pra próxima semana), mas precisa existir uma ação separada pra encerrar o evento inteiro (parar todas as ocorrências futuras) quando for o caso.

**Adicionado**
- `ManualEventBatch.occurrenceDate` (data, opcional) + índice único `(activityId, occurrenceDate)` — identifica qual ocorrência de um evento recorrente está sendo paga e impede pagar a mesma ocorrência duas vezes (erro 400 amigável se tentar). Migração `20260809090000_manual_event_occurrence_date`. (`backend/prisma/schema.prisma`, `backend/src/ledger/ledger.service.ts`)
- Regra de encerramento automático: distribuir BRC pra um evento **não recorrente** (`NONE`/`ONE_TIME`) encerra ele sozinho (só existe 1 ocorrência possível); pra um evento **recorrente**, distribuir não encerra nada — encerrar todas as ocorrências futuras é uma ação manual separada ("Encerrar evento" no card), com "Reabrir" disponível. Reaproveita o campo `Activity.isActive` já existente (que já gateava o Painel de Eventos).
- Menu **"Atividades"** renomeado pra **"Atividades do Jogo"** (`/admin/activities`) — lista agora filtrada pra mostrar só o que vem de colunas do XML + atividades compostas (ex: "Diária"). O formulário de criação virou "Criar atividade composta", exigindo selecionar ao menos 1 componente XML na hora de criar (evita um estado intermediário confuso onde a atividade recém-criada ficaria temporariamente indistinguível de um Evento Personalizado). (`frontend/src/pages/admin/ActivitiesPage.tsx`)
- Menu **"Evento manual"** virou **"Eventos Personalizados"** (`/admin/custom-events`, nova página `CustomEventsPage.tsx`, substitui `ManualEventPage.tsx`) — publicação (nome + valor sugerido + agenda + imagem, tudo num formulário só, já nasce visível no Painel de Eventos) e distribuição (expandida no próprio card do evento: data da ocorrência, valor, print, participantes) ficam na mesma tela, junto com "Encerrar evento"/"Reabrir" e um resumo de quantas distribuições já foram feitas.

**Corrigido durante o teste**: exibição de `occurrenceDate` (um valor de data pura, sem hora) usando `toLocaleDateString` do navegador causava erro de 1 dia pra quem está em fuso negativo (ex: 11/08 virava 10/08 em UTC-3, porque meia-noite UTC já é o dia anterior em São Paulo) — corrigido formatando a partir dos componentes da string ISO diretamente, sem reinterpretar pelo fuso local.

**Testado**: criado evento recorrente de teste, confirmado que aparece no Painel de Eventos da home junto com os do jogo; distribuição de 2 ocorrências diferentes confirmada (evento continuou "Ativo" depois, como esperado pra recorrente); tentativa de repetir a mesma ocorrência corretamente rejeitada; "Encerrar evento" testado via API (o `confirm()` do navegador é descartado automaticamente pela ferramenta de automação, então o clique real no botão não foi possível de validar ponta a ponta) — evento moveu pra "Encerrados", sumiu do Painel de Eventos, "Reabrir" ficou disponível. Dados de teste revertidos manualmente depois.

## 2026-08-09 — Eventos Personalizados: liga a emissão manual ao evento cadastrado

**Contexto**: o usuário apontou que "Eventos Personalizados" tem duas partes — (1) cadastrar o evento pra aparecer no site com data/hora, e (2) depois pagar quem participou, manualmente, já que não existe arquivo do jogo pra provar presença num evento personalizado. A parte 1 já existia (Activity MANUAL + agenda + Painel de Eventos). A parte 2 também já existia (Evento Manual com Print), mas **desconectada** da parte 1 — confirmando a suspeita do usuário de que a implementação anterior só cobria isso parcialmente: uma Activity MANUAL simples podia ter um "Valor em BRC" configurado, mas esse valor nunca emitia nada sozinho (o mecanismo de emissão automática depende de `ActivityCheckIn`, que só é criado durante import de XML) — e a tela de Evento Manual não tinha como saber que evento cadastrado ela estava pagando, exigindo digitar o título de novo à mão.

**Adicionado**
- `ManualEventBatch.activityId` (opcional, FK pra `Activity`) — liga uma emissão manual ao evento personalizado cadastrado na tela Atividades. Migração `20260809080000_manual_event_activity_link`. (`backend/prisma/schema.prisma`, `backend/src/ledger/ledger.service.ts`)
- Tela "Evento Manual" (`/admin/ledger/manual-event`) ganhou um seletor "Evento cadastrado (opcional)", listando as Activities manuais simples (não compostas — essas já emitem sozinhas a partir do XML e não precisam de pagamento manual). Selecionar um evento trava o título e pré-preenche o valor a partir do `Activity.brcValue`, mas o valor continua editável (o mesmo evento recorrente pode pagar diferente em ocorrências diferentes). Selecionar "Nenhum" mantém o fluxo antigo de bônus avulso com título livre. (`frontend/src/pages/admin/ManualEventPage.tsx`)
- Esclarecido na tela Atividades que, pra um evento manual simples, o "Valor" é **só uma sugestão** pro formulário de Evento Manual — nunca emite BRC sozinho. (`frontend/src/pages/admin/ActivitiesPage.tsx`)

**Testado**: criada uma Activity de teste ("Guerra Teste E2E", manual, simples, valor 15), confirmado que ela aparece no seletor da tela Evento Manual e pré-preenche título/valor; emissão de teste via API confirmou o `activityId` gravado corretamente no `ManualEventBatch`. Dados de teste revertidos manualmente depois.

## 2026-08-09 — Novo status automático "Saiu" + coluna de Saldo na tela de Personagens

**Contexto**: a lista de personagens já era sempre baseada no XML mais recente, mas quem sumia do arquivo continuava marcado "Ativo na Guild" indefinidamente — poluindo a tela de Personagens com quem já saiu da guild de verdade. Diferente do "Desconhecido" (julgamento manual sobre interação), ausência do XML é um fato objetivo, então esse novo status é 100% automático.

**Adicionado**
- Terceiro valor no enum `MembershipStatus`: `LEFT` ("Saiu"). Migração `20260809050000_character_membership_left`.
- `CharactersService.markMissingAsLeft()`: chamado pelo `ImportService` ao final de cada import — compara o roster do XML com o banco e marca `LEFT` quem não consta mais no arquivo (sobrescreve `ACTIVE` ou `UNKNOWN`, já que ausência do arquivo é mais forte que qualquer julgamento manual anterior).
- `CharactersService.upsertFromImport()`: se um personagem marcado `LEFT` reaparece num import futuro, volta pra `ACTIVE` sozinho, sem ação manual — confirmado com o usuário via pergunta direta antes de implementar (a alternativa seria exigir reativação manual do GM).
- Nova coluna **Saldo** na tela admin de Personagens (`/admin/characters`), pra permitir consultar quanto um personagem tinha quando saiu — `CharactersService.findAll()` agora agrega o saldo (`SUM` do ledger) de cada personagem numa única query em lote.
- Dropdown "Interação" ganhou a opção "Saiu"; texto de ajuda da página atualizado pra explicar os 3 estados.

**Testado**: subida real de um XML sintético (cópia do último import real, com uma linha removida) confirmou a transição automática pra "Saiu"; reenvio do arquivo completo confirmou a reativação automática pra "Ativo na Guild". Dados de teste (2 `ImportBatch`, check-ins e emissões de BRC do dia sintético) foram revertidos manualmente depois pra não poluir o ledger real da guild. (`backend/prisma/schema.prisma`, `backend/src/characters/characters.service.ts`, `backend/src/import/import.service.ts`, `frontend/src/pages/admin/CharactersPage.tsx`, `frontend/src/api/client.ts`)

## 2026-08-09 — Elegibilidade de BRC reforçada no backend + paginação de Saldos e Extrato

**Contexto**: pedido do usuário pra fazer um "double check" de que só personagens elegíveis a receber BRC (Principal + "Ativo na Guild") aparecem/podem ser alvo de transferência, emissão ou queima em qualquer superfície do sistema — incluindo a tela de saldo público, não só as telas administrativas.

**Corrigido (defesa em profundidade)**
- `LedgerService`: os dropdowns do frontend (Transferência, Evento Manual, Ajuste Manual GM, Builder de Leilão) já filtravam corretamente por `status=PRINCIPAL` + `membershipStatus=ACTIVE`, mas o backend aceitava qualquer `characterId` sem validar de novo — uma chamada direta à API conseguia burlar o filtro do frontend. Adicionado `assertCharactersEligibleForBrc()`, chamado no início de `recordManualEventBatch`, `recordTransfer` e `recordGmManualAdjustment`; rejeita com 400 e lista os personagens não elegíveis pelo nome. Testado via chamada direta à API contra um personagem ALT — corretamente rejeitado. (`backend/src/ledger/ledger.service.ts`)
- `LedgerService.getBalances()` (tela pública de Saldos) passou a filtrar `membershipStatus=ACTIVE` também — antes só filtrava por `status=PRINCIPAL`, então um Principal marcado "Desconhecido" ainda aparecia na lista pública mesmo sem mais receber BRC. Confirmado que a contagem retornada bate exatamente com `PRINCIPAL + ACTIVE` no banco.

**Alterado**
- Tela de **Saldos** (`/saldo`) agora pagina em **25 por página** (antes mostrava todos de uma vez). `LedgerService.getBalances({page, pageSize})` retorna `{items, total, page, pageSize, totalPages}`; `PublicController` aceita `?page=&pageSize=`. (`backend/src/ledger/ledger.service.ts`, `backend/src/public/public.controller.ts`, `frontend/src/pages/BalancesPage.tsx`)
- Tela de **Extrato** (`/extrato`) teve o tamanho de página padrão reduzido de 50 pra **25**. O dropdown "Filtrar por jogador" (que precisa da lista completa de personagens, não só uma página) passou a pedir `fetchBalances({ pageSize: 100 })` em vez do array antigo sem paginação. (`backend/src/ledger/ledger.service.ts`, `frontend/src/pages/TransparencyFeedPage.tsx`)
- `frontend/src/api/client.ts`: `fetchBalances()` mudou de retornar um array plano pra um objeto paginado (`PaginatedBalances`).

## 2026-08-09 — Página de Eventos removida (consolidada na home)

**Removido**
- Página/rota `/eventos` e o link "Eventos" do menu — a seção "Próximos Eventos" da home já cobre essa necessidade, então manter as duas seria duplicar manutenção. `frontend/src/pages/EventsCalendarPage.tsx` deletado; `/eventos` agora cai no catch-all e redireciona pra `/`. Chaves de i18n órfãs (`nav.events`, namespace `events.*`) removidas dos 3 idiomas.

**Alterado**
- `HomePage.tsx`: seção "Próximos Eventos" ganhou exibição de imagem (paridade com a página removida). Confirmado que já mostrava **todas** as ocorrências da semana sem limite artificial — o pedido do usuário serviu de dupla-checagem, não havia bug aqui.
- Texto de ajuda da tela admin de Atividades atualizado (não menciona mais "calendário de eventos" como página separada).

## 2026-08-09 — Home pública redesenhada + menu reordenado

**Alterado**
- **Mural de Avisos**: limitado a **2 avisos ao mesmo tempo** (validado no backend e no frontend — formulário de criação some quando atinge o limite, com contador "X/2"). Tentativa de criar um 3º direto pela API também é bloqueada (400). (`backend/src/announcements/announcements.service.ts`)
- **Home (`/`)**: removida a seção "Acesso rápido" (redundante com o menu). Adicionada a seção **"Próximos Eventos"**: calcula a próxima ocorrência real (data de verdade, não só o nome do dia) de cada atividade recorrente dentro dos próximos 7 dias, e mostra convertido pro fuso horário de quem está vendo — reaproveita a mesma lógica de conversão UTC↔local da Fase 5. Nova função `nextOccurrenceOf()` em `frontend/src/utils/scheduleTimezone.ts`. (`frontend/src/pages/HomePage.tsx`)
- **Menu público reordenado** por ordem de interesse: ícone de casa (Início) → Eventos → Leilões → **Saldos** (antes "Saldo", no singular — corrigido porque é o saldo de todos, não de um só) → Extrato. Ícone de casa novo em `frontend/src/components/HomeIcon.tsx`. (`frontend/src/layouts/PublicLayout.tsx`)

**Corrigido**
- **Bug real de estado obsoleto na tela de Atividades**: `ActivityRow` guardava `brcValue`/`showOnEventsPanel` num `useState` inicializado só no primeiro carregamento. Salvar o formulário de **Agenda** da mesma linha invalidava a lista e trazia dado novo do servidor, mas o `useState` do formulário principal não se resincronizava — um clique em "Salvar" nesse formulário depois disso sobrescrevia `showOnEventsPanel` com o valor antigo (foi assim que a atividade "Diária" perdeu o `showOnEventsPanel=true` sem ninguém mexer nela diretamente). Corrigido incluindo `updatedAt` no `key` da linha (`key={\`${activity.id}-${activity.updatedAt}\`}`), forçando remontar — e resincronizar todo estado local — sempre que o servidor mudar algo. Vale como padrão pra qualquer linha de tabela editável com mais de um formulário independente. (`frontend/src/pages/admin/ActivitiesPage.tsx`)

## 2026-08-09 — Status de interação com a guild (substitui o `isActive` automático)

**Contexto**: a correção anterior deste mesmo dia (ver seção abaixo) separou "Presença no jogo" de "BRC" na tela de Personagens, mas ainda usava `Character.isActive`, um booleano 100% automático (setado pelo import). Discussão com o usuário revelou o problema de fundo: **ter check nas atividades do jogo não prova interação real com os membros da guild** — um personagem pode cumprir tarefas automáticas sem nunca interagir de verdade. Um booleano automático não capturava isso.

**Alterado**
- `Character.isActive: Boolean` → `Character.membershipStatus: MembershipStatus` (enum `ACTIVE` | `UNKNOWN`, exibido como "Ativo na Guild" / "Desconhecido"). Migração `20260809040000_character_membership_status`.
- Comportamento acordado com o usuário: setado automaticamente pra `ACTIVE` **só na criação** (primeira vez que o personagem aparece num import). Depois disso, **nunca muda sozinho** — nem se o personagem sumir dos imports, nem se reaparecer. Só GM/conselho muda manualmente, na tela de Personagens.
- **`Desconhecido` para de receber BRC** — `LedgerService.recordActivityEmissionsForBatch` e `recordEmissionsForActivity` agora só emitem pra `status=PRINCIPAL` + `membershipStatus=ACTIVE` (helper `getEligibleCharacterIds()`). Testado: personagem marcado "Desconhecido" com checkmark real numa atividade não recebeu BRC quando o valor da atividade foi definido; um personagem "Ativo" com o mesmo checkmark recebeu normalmente.
- **`Desconhecido` para de poder ser marcado como participante de leilão** — `AuctionsService.setParticipants` filtra por `membershipStatus=ACTIVE` em vez de `isActive=true`. Testado: tentativa de marcar um personagem "Desconhecido" como participante foi silenciosamente ignorada.
- `CharactersService.deactivateMissing()` removido — não existe mais nenhuma lógica automática de mudança de status por ausência no import. `lastSeenAt` continua sendo atualizado automaticamente e exibido como referência informativa na UI ("Última vez visto"), mas não decide nada sozinho.
- Saldo/histórico de um personagem `Desconhecido` continua intacto e visível pra sempre (o ledger nunca é apagado) — só as emissões *novas* e a elegibilidade pra leilão *novo* são afetadas.

## 2026-08-09 — Correções pós-Fase 5

**Corrigido**
- **Status de Alt/AltOnly confuso com "Inativo"**: a tela de Personagens misturava dois conceitos diferentes numa coluna só ("Presença"). Separado em duas colunas independentes: *Presença no jogo* (só sobre aparecer ou não nos imports — `Character.isActive`, depois substituído por `membershipStatus`, ver seção acima) e *BRC* (badge "Recebe BRC"/"Não recebe BRC"). Nenhuma mudança de dado nesta etapa, só clareza de UI. (`frontend/src/pages/admin/CharactersPage.tsx`)
- **Nome corrompido "Po??o Rara"**: dado de teste com encoding quebrado (digitado via terminal numa sessão anterior), corrigido direto no banco. Confirmado que não havia mais nenhum outro registro corrompido.
- **"Saldo" não é ranking**: a página que antes se chamava "Ranking" (ordenada por saldo, decrescente, com coluna de posição) foi renomeada pra "Saldo por Jogador" — ordem alfabética, sem coluna de posição. Reflete que saldo de BRC não é uma disputa/competição. Renomeado de ponta a ponta: endpoint `/public/leaderboard` → `/public/balances`, `LedgerService.getLeaderboard()` → `getBalances()`, página `LeaderboardPage.tsx` → `BalancesPage.tsx`, chaves de i18n `leaderboard.*` → `balances.*`.

**Adicionado**
- **Extrato público paginado e filtrável**: `GET /public/feed` agora aceita `page`, `pageSize` (padrão 50, máx 100) e `characterId`. Frontend com filtro por jogador (dropdown) e paginação (Anterior/Próxima). (`backend/src/ledger/ledger.service.ts`, `frontend/src/pages/TransparencyFeedPage.tsx`)
- **Mural de avisos (Announcement)**: modelo novo, CRUD GM/Conselho em `/admin/announcements`, leitura pública em `GET /public/announcements`. Usado pra chamada de eventos, mudanças de regra, pedidos etc. — fica fixo até ser editado/removido manualmente (sem expiração automática). (`backend/src/announcements/*`, `frontend/src/pages/admin/AnnouncementsPage.tsx`)
- **Home pública com conteúdo**: antes a rota `/` era a lista de saldos direto; agora é uma home de verdade com o mural de avisos em destaque + cards de acesso rápido (Saldo, Leilões — com contador de quantos estão abertos agora —, Eventos, Extrato). Saldo virou sua própria rota `/saldo`. (`frontend/src/pages/HomePage.tsx`)
- **Link de volta pro site**: a página do jogador via código (`/oferta/:code`), que antes era uma ilha sem navegação nenhuma, ganhou link "← Voltar ao site" tanto no caso de código válido quanto inválido/expirado.
- **Agenda recorrente por dia da semana + horário, com conversão de fuso horário**: antes a recorrência era um campo de texto livre (ex: "toda terça às 20h"). Agora o admin marca os dias da semana (Domingo–Sábado) e um horário via `<input type="time">`, **no fuso do navegador de quem está cadastrando**. Isso é convertido pro UTC antes de salvar (`Activity.scheduleWeekdaysUtc: Int[]`, `Activity.scheduleTimeUtcMinutes: Int?`), e reconvertido pro fuso de **quem está vendo** o calendário público — cada visitante vê no horário dele, não no horário de quem cadastrou. Lógica de conversão isolada em `frontend/src/utils/scheduleTimezone.ts` (documenta a limitação conhecida: não é timezone-aware o ano todo, usa uma semana de referência fixa — pode haver 1h de diferença em troca de horário de verão entre o cadastro e a data real do evento). Campo antigo `scheduleRecurrenceRule` removido.

**Migração de banco**: `20260809030000_schedule_weekdays_and_announcements` — remove `Activity.scheduleRecurrenceRule`, adiciona `Activity.scheduleWeekdaysUtc`/`scheduleTimeUtcMinutes`, cria tabela `Announcement`.

---

## 2026-08-09 — Fase 5: i18n, marca e deploy

- i18n completo (pt-BR/en/es) em todas as páginas públicas e na página do jogador via código (admin fica só em português por ora — uso interno da equipe da guild).
- Removidos os últimos "BRC" fixos no código — tudo vem de `GuildSettings.currencyName`/`currencyAbbr`.
- `docker-compose.prod.yml` com build de produção (multi-stage, sem porta de banco exposta), validado com build real dos dois Dockerfiles.
- `scripts/backup-db.sh` / `scripts/restore-db.sh`, com rotação dos últimos 14 backups.
- [DEPLOY.md](DEPLOY.md): runbook de deploy (primeira subida, troca de senha do GM, backup, atualização, múltiplas guilds no mesmo servidor).
- PREMISSAS.md atualizado: imposto semanal incide sobre saldo *disponível* (não sobre holds de leilão aberto) — correção de design descoberta durante a implementação, evita colisão entre corte semanal e vitória de leilão. Documentado `defaultMinBid`.

## 2026-08-09 — Fase 4: Transparência pública

- Extrato público (`/extrato`): transferências e emissões manuais do GM, com print clicável.
- Calendário de eventos (`/eventos`): endpoint `GET /public/events`, editor de agenda + imagem na tela de Atividades.
- Painel de leilões já vinha da Fase 3 — com isso, toda a transparência pública sem login definida no PREMISSAS.md seção 9 ficou completa.

## 2026-08-09 — Fase 3: Ledger completo e motor de leilão

- Ledger completo: evento manual com print, transferência entre membros, Emissão Manual do GM (crédito ou queima avulsa), upload de imagens (`UploadsModule`, servido em `/uploads`).
- Corte semanal automático (cron diário, só dispara no dia configurado) incidindo sobre saldo disponível.
- Motor de leilão inteiro: rascunho → aprovação (GM direto ou 2 conselheiros) → publicação, elegibilidade por proteção/nível, código único por (personagem, leilão) só pra quem é elegível em algum item, lance com hold cruzado entre leilões simultâneos (trava por advisory lock no Postgres), expiração automática em 24h, desempate no dado só entre empatados.
- Validado com teste real de hold cruzado (personagem líder em 3 itens de 2 leilões ao mesmo tempo, sem conseguir prometer mais BRC do que tinha) e teste real de desempate forçado.

## 2026-08-09 — Fase 2: Auth e admin do catálogo

- Login JWT com bootstrap automático da conta de GM. Guard global: toda rota exige token por padrão, `@Public()`/`@Roles()` liberam/restringem.
- Contas de conselho: só o GM cria/reseta (senha numérica de 10 dígitos, mostrada uma única vez).
- Catálogo de Proteções (PCE) com CRUD completo.
- Painel admin: Importações, Personagens, Atividades (com montador de atividade composta), Proteções, Conselho, Configurações.

## 2026-08-08 — Fase 1: Fundação e ingestão de XML

- Scaffold do projeto (NestJS + React + PostgreSQL, tudo via Docker — sem precisar de Node instalado no host).
- Parser do XML do jogo lendo pelo `ss:StyleID` da célula (não pelos glifos Wingdings, que não são confiáveis).
- Dedup de importação por nome de arquivo, upsert/inativação automática de personagem, catálogo de Atividades com suporte a atividade composta (N colunas do XML precisam estar todas marcadas — ex: "Diária" = Verificado + Doar + Atividade da Guilda).
- Ledger como fonte única de saldo (nunca um campo mutável), com emissão retroativa quando uma atividade recém-criada (valor 0) recebe um valor > 0.
- Ranking público inicial (depois corrigido pra "Saldo" na correção de 2026-08-09, ver acima).

---

*Ver também: [PREMISSAS.md](PREMISSAS.md) (regras de negócio) e [DEPLOY.md](DEPLOY.md) (runbook de produção).*
