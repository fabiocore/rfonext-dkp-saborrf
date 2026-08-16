# Changelog — RFONext DKP

## 2026-08-16 — Permite voltar a participar de um item depois de desistir

Antes, desistir de um item de leilão era permanente: `placeBid` e `matchLeadingBid` ("Igualar Lance") rejeitavam qualquer tentativa de lance de quem já tinha desistido daquele item específico. Passa a ser permitido dar um novo lance a qualquer momento — a marca de desistência (`AuctionItemWithdrawal`) é removida no mesmo passo do novo lance, sem apagar o histórico de lances (`Bid` continua append-only) nem mexer na regra de resolução automática quando só resta 1 concorrente ativo (se esse já foi o caso, o item resolveu sozinho e não tem mais volta — comportamento inalterado).

Como o lance antigo (de antes da desistência) continua contando pro cálculo de "seu lance anterior", o novo lance ainda precisa ser maior que ele, não só maior que o líder atual — mesma regra que já existia pra qualquer lance novo, sem exceção. Efeito colateral aceito: quem desistiu de uma aposta all-in (via "Igualar") só consegue voltar se conseguir mais saldo do que tinha antes.

Backend: `placeBid`/`matchLeadingBid` (`auctions.service.ts`) não rejeitam mais quem já desistiu, e limpam a marca de desistência dentro da mesma transação do novo lance. 4 testes de integração novos cobrindo: re-lance normal limpa a marca; novo lance ainda precisa superar o próprio lance anterior; "Igualar" funciona pra quem desistiu; item já resolvido continua bloqueado pra sempre (63/63 testes no total). Frontend: `PlayerAuctionPage.tsx` volta a mostrar o formulário de lance e o botão "Igualar" mesmo depois de desistir (antes sumiam por completo); a mensagem "você desistiu" ganhou o complemento "mas ainda pode dar um novo lance" e para de aparecer junto com "item já vencido por outro jogador" quando o item já resolveu (bug pego durante a validação manual). i18n atualizado nos 3 idiomas. Validado manualmente no dev local com um leilão de teste temporário (3 personagens, cenários de re-lance simples, re-lance abaixo do próprio lance anterior — corretamente rejeitado — e "Igualar" após desistência num empate de 3), limpo depois.

## 2026-08-16 — Sistema de votação para tópicos

Nova feature independente do leilão, sem alterar nenhuma mecânica existente (ver `PREMISSAS.md` seção 14 pra regras completas). GM ou Vice-GM cria e publica tópicos de votação (título, descrição, opções, seleção única ou múltipla) — Conselho não tem acesso a essa área. Só 1 tópico aberto por vez, travado por lock consultivo no publish (mesmo padrão de `AuctionsService`).

Jogador vota com o próprio código de perfil (o mesmo do `/perfil`), sem login, e pode trocar de voto livremente enquanto o tópico está aberto. Só Principal com `membershipStatus: ACTIVE` pode votar. Resultado fica escondido até o jogador votar (depois disso vê tudo: quem votou, nível atual ao vivo, opção escolhida, mensagem opcional). GM/Vice-GM pode ocultar mensagem inadequada — some do público, mas continua visível só pra GM/Vice-GM. Encerramento manual (com motivo obrigatório) ou automático num horário agendado; depois de encerrado o resultado vira público pra todo mundo, sem código. Link "VOTAÇÃO" no menu público (após "Meu Perfil") só aparece com tópico aberto.

Backend: 4 modelos novos (`VotingTopic`/`VotingOption`/`Vote`/`VoteSelection`, migration puramente aditiva), `VotingService` com 15 testes de integração novos (59/59 no total, suite inteira verde), controller de staff + controller público, cron de expiração automática. Frontend: página pública de votação (cédula + resultado), páginas de admin (lista + detalhe/moderação), link condicional no menu, i18n completo (pt-BR/en/es) nas telas públicas — admin fica só em português, mesmo padrão do resto do painel. Validado manualmente ponta a ponta no dev local: criação, publicação, voto, troca de voto (com pré-preenchimento correto da cédula), bloqueio de resultado pra quem não votou, ocultar/reexibir mensagem, encerramento manual e desaparecimento do link no menu.

## 2026-08-14 — Renomeia e reordena o menu público

Menu público (topo de toda página pública) reordenado: ícone da casinha, Jogadores, Leilões, Livro-Razão, Meu Perfil (antes: Início, Leilões, Saldos, Extrato, Perfil). Renomeado nos 3 idiomas — pt-BR: Saldos→Jogadores, Extrato→Livro-Razão, Perfil→Meu Perfil; en: Balances→Players, Profile→My Profile (Ledger já estava certo); es: Saldos→Jugadores, Extracto→Libro Mayor, Perfil→Mi Perfil. Só o menu (`PublicLayout.tsx` + chaves `nav.*`) — rotas, títulos de página e o resto do texto de cada tela não mudaram.

## 2026-08-14 — Fix: campos da linha expansível de Personagens quase alinhavam com a tabela

`.detail-grid` usava colunas de largura fixa (`grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`), que por coincidência de largura ficavam *quase* embaixo das colunas da tabela acima (Status, Nível etc.) sem alinhar de verdade — como as larguras reais da tabela variam por conteúdo, o resultado parecia bugado em vez de intencional. Trocado pra `display: flex` com `flex-wrap: wrap` — cada campo ocupa só o espaço do próprio conteúdo, sem fingir alinhamento com nada de cima. Lê como um bloco compacto separado, não como uma continuação torta das colunas.

## 2026-08-14 — Personagens: remove código de leilão da linha expansível

A linha de detalhe recém-criada (ver entrada anterior) mostrava os dois códigos — perfil e leilão. A pedido do usuário, o código de leilão saiu de cena por completo desse card: nem visualizar, nem gerar novo, só o código de perfil continua ali. `AuctionCodeCell` (componente que só existia nesse arquivo) removido. Nada muda pro jogador — ele continua vendo e regenerando o próprio código de leilão em `/perfil`, e o backend/endpoint de regeneração continuam existindo (só não têm mais botão nessa tela específica).

## 2026-08-14 — Tela de Personagens: tabela enxuta + linha expansível

A tabela de Personagens tinha 12 colunas e exigia scroll lateral o tempo todo. Apresentei 3 opções visuais num mockup (cards empilhados, tabela enxuta + linha expansível, grid de cards) — escolhida a segunda.

Tabela principal reduzida a 6 colunas (Personagem, Status, Nível, Interação, Saldo, Salvar) — cabe sem rolar de lado. Campos usados com menos frequência (Principal vinculado, Última vez visto, Discord ID, Código de perfil, Código de leilão) ficam atrás de um botão "▸" que expande a linha no lugar, sem modal. Alt sem Principal vinculado ganha um badge "sem vínculo" já na linha resumida, pra não precisar expandir todo mundo procurando cadastro incompleto. Puramente visual — nenhuma lógica de edição/salvamento mudou, mesmo componente e mutation de sempre.

## 2026-08-14 — Proteção desativada não pode mais ser anexada a item de leilão (trava no backend)

O dropdown de "Adicionar item" no rascunho de leilão já filtrava proteção desativada (`.filter(p => p.isActive)`), mas isso sozinho era uma garantia frágil — só de UI. Confirmado com uma chamada direta à API (`fetch` manual, bypassando o formulário) que `addItem`/`updateItem` aceitavam qualquer `protectionId`, mesmo de proteção desativada, sem nenhuma checagem no servidor.

Adicionada validação de verdade em `AuctionsService` (`addItem` e `updateItem`, os dois únicos pontos que aceitam `protectionId`, válidos só com o leilão em rascunho/aguardando aprovação): rejeita com mensagem clara se a proteção estiver desativada ou não existir. 6 testes de integração novos (aceita ativa, rejeita desativada, rejeita inexistente, aceita sem proteção, aceita limpar a proteção num update). Verificado manualmente que a chamada direta à API que antes funcionava agora é rejeitada (400).

## 2026-08-14 — Identidade visual dourada pros cards de leilão na home

Apresentadas 3 opções de cor pra diferenciar "Leilões em Andamento" de "Próximos Eventos" (que usam o mesmo roxo hoje): laranja reaproveitando `--warning`, dourado novo, ou verde reaproveitando `--success`. Escolhido dourado. Token novo `--gold`/`--gold-hover`/`--gold-bg`/`--gold-border` em `index.css`; `CountdownBadge` ganhou prop `tone` ('accent' | 'gold'); cards de leilão na home ganharam borda esquerda + título dourados. Verificado visualmente lado a lado no dev local (leilão dourado em cima, evento roxo embaixo).

## 2026-08-14 — Leilões em andamento na home, com countdown próprio

Nova seção "Leilões em Andamento" entre "Avisos" e "Próximos Eventos" — lista todo leilão `OPEN`, com título, contagem de itens, link "Ver" e um countdown ao vivo até o `expiresAt` (mesmo componente `CountdownBadge` do "Próximos Eventos", agora com `label`/`nowLabel` configuráveis pra dizer "Encerra em" em vez de "Começa em"). Some sozinha sem nenhum leilão aberto. Verificado no dev local com 2 leilões de teste (um encerrando em 30min, outro em 2 dias) confirmando countdowns independentes e o link levando pro painel público certo.

## 2026-08-14 — Fix: checkbox empilhado acima do nome nas telas de seleção de personagens

`.checkbox-grid label` não definia `flex-direction` nem `font-weight` — dentro de um `.settings-form` (que define `flex-direction: column` e `font-weight: 600` nos labels), essas propriedades vazavam pro grid de checkboxes, empilhando o checkbox acima do nome do personagem em vez de ao lado (confuso pra selecionar rápido). Corrigido com `flex-direction: row` e `font-weight: normal` explícitos em `.checkbox-grid label` — um único ponto no CSS, corrige de uma vez em Emissão Manual, Atividades do Jogo, Eventos Personalizados e criação de Leilão (todas usam o mesmo componente).

## 2026-08-14 — Nível mínimo visível no leilão + coluna de saldo reservado em Saldos

**Pedido 1**: jogador que esqueceu de cadastrar o nível antes do leilão começar — ele consegue atualizar depois e o leilão libera sozinho? Validado antes de mexer em qualquer coisa (a pedido do usuário, com 2 leilões reais em andamento em produção): **sim, já funcionava** — elegibilidade é recalculada do zero em toda requisição (nunca fica "congelada" no nível de quando o leilão abriu), e nível é self-service com aplicação imediata. O único gap real era a mensagem de erro: só dizia "não atinge o requisito", sem dizer nível mínimo, nível atual, ou como corrigir.

**Fix**: mensagem agora mostra o nível mínimo exigido e o nível atual do personagem, com link direto "Atualizar meu nível" pro `/perfil/:código` dele — o código de perfil passou a vir junto na resposta do leilão (mesmo personagem, campo que já existia no banco, só nunca era devolvido nessa rota). **Nenhuma regra de elegibilidade foi tocada** — só a exibição da mensagem.

**Pedido 2**: coluna "Saldo" em `/saldo` mostrava o total, escondendo que parte já estava presa num lance líder de leilão aberto. Novas colunas **"Reservado em Leilão"** e **"Disponível"**.

**Cautela explícita do usuário** (2 leilões reais em andamento): a regra de "quanto está reservado" foi **duplicada** numa função nova e separada (`auction-hold.util.ts`, pura, testada), em vez de reaproveitar `AuctionsService.computeHoldTx` — o motor de leilão (`placeBid`, `matchLeadingBid`, `resolvePendingItem`) não foi tocado em nenhuma linha. Testado com um lance real de teste num personagem real do dev local, confirmando saldo/reservado/disponível corretos, e limpo depois.

**Testes**: 8 testes unitários novos de `auction-hold.util.ts` (líder sozinho, quem não lidera não retém nada, empate retém todo mundo, só conta o melhor lance de cada um, desistência libera, soma entre vários itens, item sem lance não gera hold, lista vazia). Suite completa: 38/38 passando.

## 2026-08-14 — Countdown ao vivo nos cards de "Próximos Eventos"

**Pedido**: countdown ao lado direito de cada card na home, um por evento (não um único countdown compartilhado).

Novo componente `CountdownBadge.tsx` — atualiza a cada segundo (dias/horas/min/seg, formato monoespaçado), 1 instância por card, cada uma com seu próprio `setInterval` isolado, sem estado compartilhado entre elas. Card de evento (`HomePage.tsx`) virou um flex row: conteúdo original à esquerda, badge do countdown à direita; empilha verticalmente em telas estreitas (≤480px). Quando o horário chega, o badge muda pra "Começando agora!" em verde. i18n nos 3 idiomas.

Verificado visualmente no dev local (desktop e mobile) com evento real já cadastrado ("Confronto pelo Paraíso"), incluindo o tick ao vivo dos segundos.

## 2026-08-14 — Igualar Lance (all-in) + desempate por 2d6 com reroll em empate

**Pedido**: quem não tem saldo pra superar o lance líder (+1) mas tem exatamente o suficiente pra empatar ficava sem opção — o campo de lance manual bloqueia isso pelo atributo HTML `min`. Levantamento antes de implementar (a pedido do usuário) descobriu que o **backend já aceitava** lance = líder desde sempre (`placeBid` só exige "≥ líder", nunca exigiu "líder + 1" de verdade — isso é só a sugestão mostrada na tela); a trava era 100% de UI. Aproveitado pra também corrigir um gap real no desempate: o dado antigo (1d100) empatava silenciosamente na ordem da lista sem avisar nem rolar de novo.

**"Igualar Lance"**: botão novo, separado do campo de lance normal, **sempre visível** quando há líder e o jogador não está empatado com ele — mas o usuário pediu explicitamente que só aceite quando for uma aposta **all-in de verdade** (saldo disponível == lance líder, exato). Backend: novo endpoint dedicado `POST /player-auctions/:code/items/:itemId/match-bid` → `AuctionsService.matchLeadingBid`, que calcula o valor sozinho (nunca vem do jogador) e devolve o motivo exato de qualquer rejeição: saldo insuficiente (com o valor que falta), saldo maior que o líder (não é all-in — usa o campo normal), já liderando, ou sem líder pra igualar ainda.

**Desempate por 2 dados de 6 lados, com reroll em empate**: trocado o 1d100 por 2d6 por pessoa (soma 2–12), extraído em `dice-tiebreak.util.ts` (função pura, RNG injetável). Se o maior valor empatar entre 2+ pessoas, só esse subgrupo rola de novo — quem já perdeu não volta — até decidir. Todas as rodadas ficam guardadas (não só a final) e aparecem no painel público (`/leiloes/:id`) com os 2 dados de cada pessoa por rodada e um aviso explícito de empate quando é o caso ("empate — dados rolados de novo"). Leilões já encerrados com o formato antigo (1 dado, 1 rodada) continuam exibindo certo — o painel reconhece os dois formatos.

**Testes (TDD, mesmo processo da rodada anterior)**:
- `dice-tiebreak.util.spec.ts` — 7 testes unitários: 1 candidato, sem empate, empate resolvido numa 2ª rodada só entre quem empatou, 3 candidatos (quem perde não volta), empates seguidos até decidir, trava de segurança contra empate infinito, erro sem candidato.
- `auctions.service.spec.ts` (primeiros testes desse arquivo) — 7 testes de integração contra Postgres real: aceita saldo exatamente igual (all-in), rejeita já-líder, rejeita saldo menor, rejeita saldo maior (não é all-in), rejeita sem líder pra igualar, rejeita nível insuficiente, rejeita código inválido.

**Validação manual completa no dev local** (via browser real, além dos automatizados): os 3 cenários de saldo do Igualar Lance (exato/insuficiente/excedente) com as mensagens de erro certas, e um empate real de 2d6 forçado (rodada 1 empatou 7×7, rodada 2 decidiu) conferido na tela pública com o aviso de reroll exibido corretamente. Dados de teste limpos do banco de dev depois.

## 2026-08-14 — Puxar participantes de atividades semanais na criação do leilão (com testes automatizados)

**Pedido**: marcar participante de leilão um por um era repetitivo, já que o import já sabe quem fez Raid/Expedição/Confronto pelo Paraíso etc. naquela semana. Pedido explícito do usuário, dada a complexidade: **testes automatizados escritos antes da implementação**, validação completa no ambiente de desenvolvimento antes de ir pra produção, e dev/prod sempre na mesma versão (sem gap entre os dois).

**A nuance real (identificada em discussão antes de implementar)**: o "checked" do jogo gruda em todo import até o reset semanal — duas pessoas do mesmo evento podem ter `sourceReferenceDate` em **dias diferentes** dentro da mesma semana, dependendo de qual import cada uma apareceu marcada primeiro. Buscar só pela data exata mais recente perderia gente. A solução busca pela **janela da semana civil** (segunda a domingo) que contém a emissão mais recente, reaproveitando a mesma lógica de calendário que decide "isso é uma emissão nova?" (`periodStartUtc`/`nextPeriodStartUtc`, extraídos de `LedgerService` pra `backend/src/common/period.util.ts`, testável isoladamente).

**Testes (primeiros do projeto — Jest já vinha configurado no scaffold, nunca usado)**:
- `period.util.spec.ts` — 10 testes unitários puros da matemática de semana/mês (segunda, domingo, virada de mês, virada de ano).
- `activities.service.spec.ts` — 6 testes de integração de verdade contra o Postgres do dev (sem mock), cobrindo exatamente a nuance acima: mesma semana em dias diferentes soma certo; semana anterior não entra; atividade sem emissão não quebra; múltiplas atividades resolvidas independentemente.

**Backend**: `ActivitiesService.getRecentWeeklyParticipants(activityIds)` + `GET /activities/recent-participants?activityIds=`. Sem hardcode de nomes de atividade — funciona pra qualquer atividade `recurrencePeriod: WEEKLY` cadastrada, hoje ou no futuro.

**Frontend** (`AuctionBuilderPage.tsx`, seção Participantes): novo bloco "Puxar participantes de atividades semanais" — checkboxes de todas as atividades semanais, cada uma já mostrando a janela de semana usada e quantas pessoas foram encontradas (ou "sem emissão registrada ainda") antes de aplicar. Botão aplica a **união** de todas as marcadas, **substituindo** a seleção de participantes atual — decisões confirmadas com o usuário antes de implementar.

**Testado**: suite completa (`npm test`, 16/16) rodando junto sem conflito; teste manual ponta a ponta no navegador criando um leilão de teste de verdade — confirmado que "Raid de Guilda" com emissões sintéticas em dois dias diferentes da mesma semana retornou os 2 personagens certos, e que "Expedição da Guilda" (dado real de import) mostrou 26 pessoas da semana de 03-09/08. Participantes salvos corretamente no banco via API. Dados de teste (automatizados e manuais) sempre limpos ao final.

## 2026-08-14 — Jogador pode gerar novo código de leilão + título em destaque

## 2026-08-14 — Jogador pode gerar novo código de leilão + título em destaque

**Pedido**: depois do código de leilão virar fixo por personagem, usuário pediu que o próprio jogador também consiga gerar um novo (não só GM/conselho pelo admin) e que o título "Código de Leilão" no perfil ficasse destacado em laranja.

**Backend**: `ProfileService.regenerateAuctionCode(code)` — resolve o personagem pelo código de perfil (mesma credencial de sempre), chama o `CharactersService.regenerateAuctionAccessCode` já existente (mesmo usado pelo admin) e devolve o perfil atualizado. Novo endpoint público `POST /public/profile/:code/regenerate-auction-code`.

**Frontend**: botão "Gerar novo código" ao lado do "Copiar" na seção Código de Leilão do perfil, com confirmação (mesmo texto de aviso do botão equivalente no admin — código antigo para de funcionar na hora). Novo token `--warning` (laranja, `#fb923c`) em `index.css` e classe `.title-warning` — aplicada só nesse `<h2>`, não em títulos de seção em geral.

**Testado ao vivo**: regenerei o código de um personagem real via API, confirmei o código antigo retornando "Código inválido" em `/player-auctions/:código` e o novo funcionando normalmente; revertido ao final. Conferido visualmente no navegador: botão aparece, título renderiza com `rgb(251, 146, 60)` (o `--warning`). `tsc -b && vite build` / `nest build` limpos.

## 2026-08-14 — Código de leilão fixo por personagem (não era mais por leilão)

## 2026-08-14 — Código de leilão fixo por personagem (não era mais por leilão)

**Pedido**: usuário reportou que o código de leilão era gerado de novo a cada leilão publicado, e redistribuir pra todo mundo toda vez estava "insano". Pediu um código **fixo por personagem**, consultável no próprio `/perfil`, separado do código de perfil — mas reforçou que o código não pode liberar acesso a leilões que a pessoa não participou (só quem está marcado como participante consegue ofertar; quem não participou já pode ver qualquer leilão pela página pública, sem código).

**Mudança estrutural**: como o mesmo personagem pode participar de mais de um leilão aberto ao mesmo tempo, `/oferta/:código` deixou de levar direto pros itens de UM leilão — virou uma central pessoal: lista os leilões abertos em que aquele código participa (1 aberto → entra direto, mesma experiência de sempre; 2+ → escolhe qual; 0 → mensagem simples).

**Backend**: novo `Character.auctionAccessCode` (formato `LLLLNN`, mesmo de sempre, gerado automaticamente pra todo Principal — mesmo padrão idempotente do código de perfil). Removido `AuctionParticipant.accessCode` (migration `20260814000000_fixed_auction_code`) — não fazia mais sentido, cada leilão publicado não gera código nenhum. `AuctionsService.resolveParticipant` passou a resolver o personagem pelo código fixo primeiro, e só então confirmar que ele está marcado como participante do leilão pedido (`ForbiddenException` clara se não estiver — o código nunca libera leilão que a pessoa não participou). Novo `getMyAuctions(code)` alimenta a central; `getParticipantView` ganhou `auctionId` como segundo parâmetro. `ProfileService.getProfile` devolve o código também (com backfill on-demand, `CharactersService.ensureAuctionCodeFor`, pra não depender do admin ter aberto Personagens antes).

**Frontend**: `ProfilePage.tsx` ganhou seção "Código de Leilão" com botão copiar. `PlayerAuctionPage.tsx` virou duas telas (`PlayerAuctionHubPage` em `/oferta/:código` e `PlayerAuctionDetailPage` em `/oferta/:código/:auctionId`). `CharactersPage.tsx` (admin) ganhou coluna "Código de leilão" (mascarado + olho + gerar novo + copiar, mesmo padrão do de perfil — extraído `CopyCodeButton` pra um componente compartilhado). `AuctionBuilderPage.tsx` perdeu a coluna de código dos participantes — nada mais pra distribuir por leilão.

**Testado ao vivo, ponta a ponta**: criei 2 personagens participantes + 1 não-participante, publiquei 2 leilões com os mesmos 2 participantes — confirmei que o código fixo de um personagem lista os **2** leilões na central, sem eu ter gerado/distribuído nada novo pro segundo leilão. Dei lance em ambos (via curl e depois via navegador de verdade, incluindo o botão "Dar lance"), confirmei o saldo reservado somando os dois. Confirmei que o personagem não-participante recebe `403 Forbidden` ("Você não participou deste leilão.") ao tentar acessar o leilão diretamente pela URL, e que a central dele mostra lista vazia. Confirmei código totalmente inválido retornando 404. `tsc -b && vite build` e `nest build` limpos nos dois containers. Dados de teste removidos ao final.

## 2026-08-14 — Fix real: desistência não fecha mais o item como "Não reclamado" antes da hora

## 2026-08-14 — Fix real: desistência não fecha mais o item como "Não reclamado" antes da hora

**Bug reportado**: quando o único jogador com lance num item desistia, o item virava "Não reclamado" imediatamente — mesmo com o leilão ainda aberto por dias. Isso tirava a chance de outros elegíveis que ainda não tinham dado lance disputarem o item até o prazo real.

**Causa**: `withdrawFromItem` (`auctions.service.ts`) resolvia o item na hora pra `UNCLAIMED` assim que a contagem de concorrentes ativos caía pra 0, em vez de deixar `PENDING` e só decidir isso no fechamento de verdade do leilão.

**Fix**: removido esse fechamento antecipado. Com 0 concorrentes ativos, o item agora só fica `PENDING` — igual ao caminho que já existia pra "2+ concorrentes, nada muda". A resolução real continua acontecendo em `resolvePendingItem` (compartilhada entre expiração automática e encerramento manual), que já tratava corretamente "0 lances ativos no fechamento → Não reclamado" — só não devia rodar antes da hora. Comportamento intocado: quando sobra exatamente 1 concorrente ativo, ele continua vencendo na hora (não era o bug reportado).

**Testado ao vivo**: item com 1 lance, esse jogador desiste — confirmado `PENDING` (não `UNCLAIMED`), `minBid` resetado pro mínimo configurado; um segundo personagem deu lance novo no mesmo item com sucesso; os dois desistiram (0 ativos de novo) — confirmado ainda `PENDING`; encerrei o leilão manualmente — só aí virou `UNCLAIMED`. Testado também o caminho intocado: item com 2 lances, um desiste, sobra 1 — confirmado `WON` na hora, sem esperar o fechamento. Dados de teste removidos ao final.

## 2026-08-12 — Trocado pixel-art/personas por avataaars/micah (feedback visual real)

**Contexto**: usuário revisou os 36 avatares publicados na rodada anterior e reportou que 2 dos 4 estilos (`pixel-art` e `personas`) ficaram feios comparado com os outros dois (`adventurer`, `bottts`). Em vez de chutar substitutos, montei uma prévia (artifact HTML, tokens visuais do próprio app, SVGs reais embutidos inline — nenhuma chamada externa) com 6 estilos candidatos do DiceBear lado a lado (avataaars, notionists, micah, open-peeps, big-smile, croodles), 4 exemplos cada. Usuário escolheu **avataaars** e **micah**.

**Fix**: `avatar-presets.ts` — `pixel-art`/`personas` trocados por `avataaars`/`micah`, 9 seeds cada (mesma contagem de antes, 36 no total). Personagens que já tinham escolhido um avatar dos estilos removidos **não quebram** — a URL antiga continua resolvendo normalmente (DiceBear ainda serve esses estilos, só paramos de oferecer no grid); só não vão mais aparecer com o anel de "selecionado" se abrirem a tela de novo.

**Testado ao vivo**: confirmei os 2 estilos novos resolvendo (HTTP 200) antes de trocar; endpoint de presets retornando as 36 chaves nos 4 estilos certos; conferido visualmente no navegador.

## 2026-08-12 — Avatares: 32 → 36 + badge de saldo centralizado e verde

## 2026-08-12 — Avatares: 32 → 36 + badge de saldo centralizado e verde

**Avatares**: mais 1 seed em cada um dos 4 estilos (9 cada agora) — `Zephyr` (adventurer), `Servo` (bottts), `Joystick` (pixel-art), `Iris` (personas).

**Badge de saldo**: usuário pediu pra mover da lateral (colado no nome) pro **centro** da barra do topo, e trocar a cor de roxo pra **verde**. Centralizar de verdade (não só "no meio do espaço sobrando" do `justify-content: space-between`, que desloca dependendo da largura do nome/bandeiras) exigiu `position: absolute` + `transform: translate(-50%,-50%)` numa nova classe `.app-header-centered-badge`, com `.app-header` ganhando `position: relative`. Cor trocada pra reaproveitar `.badge-yes` (verde, já usado nos badges "Recebe DKP") em vez do `.badge-accent` novo (removido — ficou sem uso).

**Testado ao vivo**: confirmei 36 presets no endpoint; visualmente em 1280×720 e 375×700 (mobile) — badge centralizado sem sobrepor nome nem bandeiras nos dois tamanhos.

## 2026-08-12 — Avatares: 26 → 32 (balanceado, 8 por estilo)

## 2026-08-12 — Avatares: 26 → 32 (balanceado, 8 por estilo)

Pedido rápido depois da rodada anterior: mais opções ainda. `avatar-presets.ts` foi de 6 pra 8 seeds em `bottts`, `pixel-art` e `personas` — agora os 4 estilos têm 8 cada (32 no total, era 6+6+6+8 desbalanceado). Testado: `/api/public/profile/avatar-presets` retornando as 32 opções.

## 2026-08-12 — Saldo de BRC no perfil + avatares com mais variedade (8 → 26, 4 estilos)

## 2026-08-12 — Saldo de BRC no perfil + avatares com mais variedade (8 → 26, 4 estilos)

**Pedido**: usuário pediu pra mostrar o saldo de BRC na tela de perfil (`/perfil/:código`) e aumentar as opções de avatar, misturando estilos diferentes (não só mais rostos parecidos no estilo único que já existia).

**1. Saldo no perfil**: `ProfileService.getProfile` (backend) passou a somar as transações do ledger do personagem (mesma regra de sempre, nunca um campo solto) e devolver `balance`. Frontend mostra um badge roxo ao lado do nome, no topo da página (ex: "LINDERBERG · 48 DKP") — sempre visível, sem precisar rolar. Nova classe `.badge-accent` no `App.css`.

**2. Avatares com mais variedade**: `avatar-presets.ts` (backend) foi de 8 pra 26 opções, misturando 4 estilos do DiceBear — `adventurer` (o estilo único de antes, seeds mantidos pra quem já tinha escolhido continuar reconhecido), `bottts` (robôs), `pixel-art` (retro 8-bit) e `personas` (ilustração flat moderna). Zero mudança de schema — é só uma lista estática maior; o grid do frontend já lida com qualquer quantidade (flex-wrap).

**Testado ao vivo**: confirmei os 4 estilos do DiceBear resolvendo (HTTP 200) antes de usar; testei `/api/public/profile/:código` retornando `balance` batendo com o valor da tela Saldos; testei o endpoint de presets retornando as 26 opções; selecionei um avatar novo (robô `bottts`) pela tela de perfil de verdade — confirmei o preview atualizando, o anel de "selecionado" no grid, e a chamada `PUT .../avatar-preset` retornando 200. Avatar de teste revertido ao final (personagem real do roster, não sintético).

## 2026-08-12 — Setas de rolagem nas tabelas (scrollbar sozinha não bastava)

## 2026-08-12 — Setas de rolagem nas tabelas (scrollbar sozinha não bastava)

**Contexto**: mesmo depois da scrollbar estilizada (entrada anterior), usuário reportou que nem clicar-e-arrastar funcionava mais. Em vez de insistir em depender de arrastar a scrollbar (varia demais entre mouse/SO/navegador), pedido explícito: incluir rolagem lateral com botões.

**Fix**: novo componente `frontend/src/components/TableScroll.tsx` — substitui a `<div className="table-scroll">` crua usada nas 13 tabelas (12 páginas). Mostra dois botões, "← Rolar" e "Rolar →", **fixos logo acima da tabela** (não no fim da lista) — aparecem só quando há conteúdo pra rolar naquela direção (ficam desabilitados/ocultos nas pontas), e cada clique rola 320px com animação suave (`scrollBy({ left, behavior: 'smooth' })`). Não depende de arrastar nada, clique simples resolve.

**Testado ao vivo**: em viewport 1280×720, cliquei "Rolar →" repetidas vezes na tela Personagens — tabela rolou revelando as colunas seguintes (Principal vinculado, Última vez visto, Interação, DKP, Saldo, Discord ID) e "← Rolar" ficou habilitado; cliquei "← Rolar" e voltou ao início, com "← Rolar" desabilitado de novo. `tsc --noEmit` e `npm run build` limpos.

## 2026-08-12 — Tabelas do admin: scroll horizontal descobrível + texto parando de quebrar

## 2026-08-12 — Tabelas do admin: scroll horizontal descobrível + texto parando de quebrar

**Contexto**: usuário reportou, com print, que em notebook (tela menor) a tabela de Personagens não dava nenhuma pista de que dava pra rolar pra direita — só descobriu arrastando às cegas — e que cabeçalhos/botões apareciam quebrados em duas linhas ("ÚLTIMA VEZ" / "VISTO", "GERAR" / "NOVO").

**Causa raiz**: a tabela (`.data-table`/`.leaderboard-table`) não tinha `min-width`, então o navegador preferia espremer colunas e quebrar texto a deixar a tabela ultrapassar a tela. O scroll horizontal também estava no bloco inteiro da página (`.admin-content`), não só na tabela — rolar pra direita fazia o texto de instrução do topo sumir junto. E não havia nenhuma pista visual (sombra, scrollbar estilizada) indicando que tinha mais conteúdo pra ver.

**Fix** (`App.css` + 12 arquivos de página): nova classe `.table-scroll` envolvendo cada `<table>` — cabeçalho/instrução da página ficam sempre visíveis, só a tabela rola. Tabela passou a usar `width: max-content; min-width: 100%` (nunca comprime a ponto de quebrar texto) e `white-space: nowrap` nos cabeçalhos e botões de ação. Scrollbar do `.table-scroll` estilizada pra ficar sempre visível, grossa (12px) e na cor de destaque (roxo) — bem mais fácil de notar que a scrollbar fina padrão do SO. Aplicado nas 9 telas admin (`data-table`) e 3 páginas públicas (`leaderboard-table`) que usam essas classes, não só Personagens.

**Ressalva conhecida, não resolvida agora**: em tabelas muito longas (Personagens tem 57 linhas), a barra horizontal só fica visível depois de rolar até o fim da lista — segue precisando de scroll vertical primeiro. Resolver isso direito exigiria limitar a altura da tabela com scroll vertical próprio (grid com cabeçalho fixo), fora do escopo combinado agora.

**Testado ao vivo**: verificado em viewport 1280×720 (notebook) nas telas Personagens e Atividades — cabeçalhos numa linha só, texto de instrução fixo enquanto a tabela rola, scrollbar roxa visível e funcional (testada arrastando). `tsc --noEmit` e `npm run build` limpos.

## 2026-08-12 — Detalhe do dado de desempate também na tela admin do leilão

**Contexto**: usuário levantou um cenário pra testar — dois jogadores com o mesmo saldo disponível (150 BRC) disputando o mesmo item, o segundo sem conseguir dar +1 por falta de saldo. Simulei ponta a ponta (dois personagens de teste, 150 BRC cada, os dois dando all-in de 150, leilão encerrado manualmente) e confirmei: o segundo lance de 150 é **aceito mesmo empatando** com o líder — a validação real do backend exige só "≥ líder atual", não "líder + 1" (o "+1" é só uma sugestão da tela, não uma trava). Isso é necessário: se fosse trava de +1, o segundo jogador nunca conseguiria forçar o desempate. Ao encerrar, o dado rodou automaticamente (15 vs 77), só o vencedor teve o valor queimado no ledger, e o perdedor manteve o saldo intacto.

**Gap encontrado durante o teste**: a tela pública do leilão já mostrava os valores do dado de cada participante empatado (`auctions.diceTiebreak`), mas a tela **admin** (`AuctionBuilderPage.tsx`) só mostrava vencedor + valor, sem o detalhe do dado. Corrigido — agora mostra "Desempate no dado: Nome1 valor1, Nome2 valor2" abaixo do vencedor, mesma fonte de dados (`item.diceRollDetail`) já exposta pela API.

Corrigido também um trecho desatualizado do `PREMISSAS.md` (seção 7) que descrevia o "+1" como obrigatório pra superar o líder — não reflete o comportamento real desde sempre, só foi notado agora com esse teste.

**Testado ao vivo**: simulação completa (personagens de teste, all-in empatado, encerramento manual, dado, ledger, e verificação visual da tela admin no navegador) — dados de teste removidos ao final.

> Histórico de alterações do projeto, pra consulta futura e troubleshooting.
> Formato: mais recente no topo. Cada entrada linka o(s) arquivo(s) principais mexidos quando relevante.
> **A partir de 2026-08-09, todo pedido de mudança do usuário deve gerar uma entrada aqui.**

## 2026-08-09 — Primeiro deploy de produção

**Ambiente `production` criado no Dokploy** (projeto `saborrf`, ambiente já existia vazio desde a criação do projeto — nunca configurado até agora): `https://sabor.rfonext-dkp.cloud`, com banco/segredos/domínio totalmente novos e independentes do `dev` (nenhum dado de teste migrado — nasce zerado, por design, PREMISSAS.md seção 10). `GM_BOOTSTRAP_PASSWORD` gerado e anotado na hora da criação.

Confirmado ao vivo: home (200), `/admin/login` (200), `/api/public/balances` retornando lista vazia (esperado — ambiente novo, sem import ainda). Tag `deployed/prod` criada apontando pro mesmo commit de `deployed/dev` — nada pendente de promoção no momento da criação.

**Pendente pro GM**: entrar em `https://sabor.rfonext-dkp.cloud/admin/login` com `guildmaster`/senha gerada, trocar a senha imediatamente (Minha Senha), definir um código de recuperação, preencher Configurações (nome da guild, moeda, imposto semanal), criar contas de conselho, e importar o primeiro XML — mesmos passos de "primeiro deploy de uma guild nova" (DEPLOY.md seção 2, passos 4-7), já que produção é um ambiente novo, não uma cópia do dev.

## 2026-08-09 — Versionamento dev/prod: tags git móveis + script de redeploy de rotina

**Pedido**: usuário percebeu que não existe hoje nenhuma forma de saber "o que já está validado no dev mas ainda não foi promovido pra produção" — problema real, já que tanto o app `dev` quanto o futuro `production` no Dokploy apontam pro mesmo branch `main`, e cada deploy é disparado manualmente por ambiente, sem vínculo com o `git push`.

**Solução escolhida** (entre tag móvel vs. branch `production` dedicado — usuário preferiu a tag, mais leve): `deployed/dev` e `deployed/prod`, tags git que sempre apontam pro commit realmente ao vivo em cada ambiente. Criado `scripts/dokploy-redeploy.sh` — dispara o deploy via API, espera `composeStatus: done`, e só então move a tag (se o deploy falhar, a tag não se move, então nunca mente sobre o que está no ar). `deployed/prod` só passa a existir quando o ambiente `production` for criado.

Consulta de "o que falta promover": `git log deployed/prod..deployed/dev --oneline`. Documentado em `DEPLOY.md` seção 8.5.

**Testado ao vivo**: rodei o script contra o compose app real do dev (`u-Eq45ktBL7LOUEFC-urp`) — disparou o deploy, esperou concluir (`composeStatus: done`), moveu e empurrou a tag `deployed/dev` pro commit atual. Confirmado com `git log deployed/dev -1`.

## 2026-08-09 — Avatar do personagem na página Saldos

**Pedido**: usuário pediu pra usar o avatar customizado (já existente desde a feature de Perfil — presets DiceBear ou upload próprio) também na página pública Saldos (`/saldo`), que até então só mostrava texto puro (Personagem/Nível/Saldo).

**Implementado**: avatar circular pequeno (32px) ao lado do nome, na própria coluna Personagem — reaproveitando exatamente o mesmo padrão já usado em `ProfilePage.tsx` (`avatarUrl` quando definido, fallback `DefaultAvatar` SVG quando não). `LedgerService.getBalances` passou a selecionar `avatarUrl` do personagem; `BalanceEntry` (client.ts) ganhou o campo; `BalancesPage.tsx` renderiza `<img>` ou `<DefaultAvatar size={32} />` dentro de um `<span>` flex antes do nome.

**Testado ao vivo**: confirmei `avatarUrl: null` aparecendo na resposta de `/api/public/balances`; inspecionei o DOM renderizado confirmando o SVG de fallback (32×32) quando não há avatar; setei um avatar de teste (DiceBear) direto no banco pra um personagem, recarreguei, e confirmei o `<img>` renderizando com o src/estilo certos; revertido o avatar de teste ao final.

## 2026-08-09 — Recuperação de senha do GM: código de recuperação self-service + script de reset via servidor

**Contexto**: usuário já satisfeito com a troca de senha self-service (`/admin/change-password`), perguntou o que dava pra fazer pra recuperar acesso caso esqueça a senha e nem consiga logar (cenário diferente — troca exige estar logado). Propus 3 opções (script server-side, código de recuperação, e-mail com serviço externo) e o usuário escolheu implementar as duas primeiras, descartando e-mail por exigir infraestrutura externa nova.

**A. Código de recuperação (self-service)**: novo campo `User.recoveryCodeHash` (+ `recoveryCodeUpdatedAt`, migration `20260809220000_user_recovery_code`). Qualquer conta (GM/Vice-GM/Conselho) pode definir um código (mín. 10 caracteres) em **Admin > Minha Senha**, exigindo a senha atual pra evitar troca por quem só tem a sessão aberta. Se travar depois, `/admin/recuperar-senha` (público, link "Esqueci minha senha" na tela de login) aceita usuário + código + senha nova. Código é **reutilizável** (não expira nem é consumido no uso) — decisão deliberada pra manter simples, já que é um app pequeno de guild, não internet-scale; erro de usuário/código sempre retorna a mesma mensagem genérica pra não revelar qual dos dois está errado. `AuthService.setRecoveryCode` / `getRecoveryCodeStatus` / `recoverPassword` em `backend/src/auth/auth.service.ts`; endpoints em `auth.controller.ts` (`POST/GET /auth/recovery-code`, `POST /auth/recover-password`, público). Frontend: card novo em `ChangePasswordPage.tsx`, página nova `RecoverPasswordPage.tsx`, link em `LoginPage.tsx`.

**B. Reset via servidor (último recurso, só GM, exige acesso ao Dokploy/terminal)**: `backend/src/scripts/reset-gm-password.ts` — script standalone (Prisma direto, sem passar pela API) que acha a conta GM, gera senha numérica aleatória, atualiza o hash no banco e imprime a senha nova no terminal. Compila junto no build normal do Nest (`dist/scripts/reset-gm-password.js`), sem precisar de `ts-node` em produção. Rodável via `docker compose exec api node dist/scripts/reset-gm-password.js` ou pelo terminal do serviço `api` no Dokploy. Documentado em `DEPLOY.md` (nova seção 5; seções 5-7 renumeradas pra 6-8).

**Testado ao vivo, ponta a ponta**: rodei o script de reset via `docker compose exec` e confirmei login com a senha gerada. Testei os endpoints via curl (código curto rejeitado, senha atual errada rejeitada, código certo aceito, status refletindo `isSet`/`updatedAt`, recuperação com código errado/usuário inexistente retornando o mesmo erro genérico, recuperação certa trocando a senha e permitindo login, confirmando que o código continua válido pra uso seguinte). Repeti o fluxo completo pelo navegador (Claude Browser): defini o código em Minha Senha, fiz logout, cliquei "Esqueci minha senha", errei o código (mensagem genérica apareceu), acertei, e logei com a senha nova. `tsc --noEmit` e `npm run build` limpos nos dois containers. GM restaurado ao estado padrão de dev (`change-me-on-first-login`, sem código de recuperação) ao final.

## 2026-08-09 — 3 pedidos sobre leilão: código no topo da página, lance mínimo, e bug real no encerramento manual

**1. Código de acesso movido pro topo de "Leilões"**: em vez de uma página separada (`/codigo`), o campo agora fica direto em `/leiloes`, logo abaixo do título — pedido explícito pra reduzir passos. `EnterCodePage.tsx` apagado, lógica virou um componente inline (`CodeEntryForm`) em `PublicAuctionsListPage.tsx`. Link "Código" removido do menu; `/codigo` agora redireciona pra `/leiloes` (não quebra link salvo por alguém). URL direta `/oferta/:código` continua igual.

**2. Bug real: lance mínimo pedia +1 mesmo sem nenhum lance ainda**. Usuário: proteção com lance mínimo 30, jogador só conseguia ofertar a partir de 31. Causa: `PlayerAuctionPage.tsx` calculava `minNext` somando **+1 sempre**, mesmo quando `leadingAmount` era 0 (ninguém tinha dado lance ainda) — o "+1" só faz sentido pra **superar** um lance já existente, não pro primeiro lance. O backend (`placeBid`) já validava certo (aceitava exatamente o mínimo); o bug era só no valor sugerido/mínimo do campo no frontend. Fix: backend passou a expor um `minBid` já resolvido por item (`getParticipantView` — proteção ou padrão da guild, sem +1 quando não há lance líder), frontend usa esse valor direto em vez de recalcular.

**3. Bug real, mais sério: encerrar o leilão manualmente cancelava itens que já tinham vencedor de verdade**. Usuário: "quando o GM encerra o leilão também vale como leilão normal" — ou seja, itens com lance real deveriam resolver igual ao fechamento natural, não virar "Cancelado" perdendo o vencedor. Confirmado no código: `closeAuction` simplesmente marcava **todo** item ainda `PENDING` como `CANCELLED` com o motivo digitado, mesmo que já tivesse lances válidos — bem diferente de `resolveExpiredAuctions` (cron do fechamento natural), que resolve cada item pro maior lance (empate no dado), queima o valor do vencedor, e marca `WON`. Extraído `resolvePendingItem` (método compartilhado com a mesma lógica de resolução) e `closeAuction` passou a usá-lo — encerrar manualmente agora resolve os itens de verdade (vencedor real quando tem lance, "Não reclamado" quando não tem), só o motivo continua obrigatório e documentando por que fechou antes da hora. Também adicionado: a tela admin do leilão agora mostra o **nome do vencedor + valor** em cada item resolvido (`AuctionBuilderPage.tsx` — antes só dizia "Vencido" sem dizer quem), facilitando a entrega dos itens.

**Testado ao vivo, ponta a ponta**: criei um leilão de teste com proteção de lance mínimo 30, confirmei o backend expondo `minBid: 30` (não 31) antes de qualquer lance, dei um lance de exatamente 30 (aceito), encerrei o leilão manualmente com motivo — confirmei `resolutionStatus: "WON"` com `winningBid` certo (Agrute, 30) em vez de `CANCELLED`, e confirmei a queima de -30 no ledger. Testei também o "Apagar leilão" depois (reversão automática creditando os 30 de volta — comportamento existente, confirmado que continua funcionando com o novo fluxo de resolução). Testei a navegação do código na página Leilões e o redirect de `/codigo`. Dados de teste revertidos ao final (leilão apagado, proteção desativada).

## 2026-08-09 — Tradução de conteúdo (Avisos etc.): avaliado e descartado; fix de `lang` pro navegador sugerir tradução

**Contexto**: usuário perguntou se dava pra traduzir automaticamente o que ele escreve (Mural, Aviso Fixo, Eventos) pra EN/ES, já que o seletor de idioma hoje só troca a interface, nunca o conteúdo livre (sempre em pt-BR). Apresentei as opções (tradução automática ao salvar, botão de tradução com revisão, campos manuais, ou deixar o navegador sugerir) e os provedores possíveis (DeepL, Google Cloud Translation, Azure Translator, IA). Usuário decidiu **não** integrar nenhum serviço externo — não quer criar cadastro em mais site nenhum — e optou por só facilitar a sugestão nativa de tradução do navegador (ex: "Traduzir esta página?" do Chrome).

**Fix real encontrado nesse meio-tempo**: `frontend/index.html` tinha `<html lang="en">` **fixo**, herdado do scaffold original do Vite e nunca corrigido — mesmo com a página inteira (interface + conteúdo) em português na maior parte do tempo. Isso atrapalha a detecção de idioma do navegador (um dos sinais que ele usa pra decidir se oferece tradução). Corrigido:
- `index.html`: valor estático inicial trocado pra `lang="pt-BR"` (reflete a realidade — é o idioma padrão/majoritário do site).
- `frontend/src/i18n/index.ts`: novo listener `i18n.on('languageChanged', ...)` mantém `document.documentElement.lang` sincronizado com o idioma da interface escolhido no seletor PT/EN/ES, em tempo real — útil principalmente pra quando o visitante troca pra EN/ES mas o conteúdo livre (Avisos etc.) continua em português, ajudando o navegador a notar a mistura e sugerir tradução.

**Testado ao vivo**: confirmei via console do navegador que `document.documentElement.lang` começa `"pt-BR"` e muda pra `"en"` na hora ao clicar o seletor de idioma, sem reload.
## 2026-08-09 — Remoção total da fila de aprovação de nível + bug real na lista de participantes de leilão

**Contexto**: dois problemas reportados na mesma mensagem.

**1. Fila de aprovação de nível removida**: não estava funcionando bem na prática. Pedido explícito: membro edita o próprio nível direto no perfil, aplica na hora, sem aprovação de ninguém; print de comprovação vira opcional; tela admin "Solicitações de Nível" sai do ar; GM/conselho continua podendo corrigir qualquer nível direto na tela de Personagens, como sempre.
- **Migration** (`20260809210000_remove_level_approval_and_char_link`): `LevelChangeRequest` virou log histórico simples — `requestedLevel` renomeado pra `level`, `proofImageUrl` agora nullable, removidos `status`/`reviewedById`/`reviewedAt`/`rejectReason` (e o enum `LevelChangeRequestStatus` inteiro). Também removida a coluna `Character.linkedUserId` — só existia pra pular a fila de aprovação quando o personagem era de um GM/Vice-GM/Conselho; sem fila, perdeu completamente a função (decisão de limpar tomada nesta sessão, não pedida explicitamente — avisado ao usuário).
- **Backend**: `ProfileService.submitLevelChangeRequest` virou `updateLevel` — aplica o nível na hora numa transação, cria o log (print opcional). Endpoint mudou de `POST .../level-request` pra `PUT .../level`. `level-requests.controller.ts` (fila admin: listar/aprovar/rejeitar) apagado inteiro. `GET /users/all` (só existia pra popular o dropdown de vínculo) também removido.
- **Frontend**: `ProfilePage.tsx` — formulário de nível simplificado (sem banner de "pendente", sem status), histórico mostra data + nível + link opcional pro print. `CharactersPage.tsx` perdeu a coluna "Conta vinculada". Rota/nav "Solicitações de Nível" removidos. `LevelRequestsPage.tsx` apagado.

**2. Bug real: lista de participantes de leilão escondia gente que devia aparecer**. Usuário: "não aparece as pessoas que fizeram o evento para eu incluir" — confirmou o fluxo esperado: **Participantes** = todo Principal ativo que recebe DKP (escolha manual do GM/conselho, sem relação com proteção de item); **elegibilidade por item** (nível vs. Proteção) só decide quem pode **ofertar** naquele item específico, depois de já estar participando.
- **Causa raiz**: `AuctionBuilderPage.tsx` pré-filtrava a lista de checkboxes pra só mostrar quem era elegível em pelo menos 1 item do leilão (`eligiblePrincipals`) — com itens de proteção alta, isso escondia a maioria do roster (45 de 47 no caso reportado). O mesmo filtro também existia no **backend**, em `AuctionsService.publish`: só gerava código de acesso pra participantes elegíveis em algum item, pulando os outros silenciosamente.
- **Fix**: lista de participantes agora mostra sempre todo Principal ativo/DKP (`principals`, sem filtro). Backend gera código pra **todo** participante marcado, sem checar elegibilidade de item nenhum. A elegibilidade por item continua sendo checada corretamente no momento do **lance** (inalterado, já funcionava certo). Default de seleção mudou de "pré-marca todo mundo elegível" pra "começa vazio" — não fazia sentido pré-marcar o roster inteiro como tendo participado de um evento específico.

**Testado ao vivo**: nível — atualizei direto via perfil público sem print (aplicou na hora) e com print (log registrado com a URL); confirmei `/level-requests` retornando 404. Leilão — criei uma Proteção de teste com nível mínimo 95 (ninguém no teste qualifica), marquei 2 participantes reais como presentes, publiquei, e confirmei que **ambos** receberam código de acesso mesmo sem qualificar pro único item; confirmei que a tentativa de lance nesse item retornou 403 (nível insuficiente) — participação e elegibilidade por item funcionando como camadas independentes, do jeito certo. Dados de teste revertidos ao final (leilão apagado, proteção desativada, nível da Agrute revertido pro valor real).

## 2026-08-09 — Fix real de fuso horário em data/hora única de Atividades/Eventos + ajustes de UI

**Bug real, confirmado e corrigido**: usuário reportou que um evento marcado pra 21h BRT aparecia como 18:00. Causa: `<input type="datetime-local">` devolve uma string SEM fuso (ex: "2026-08-09T21:00"); o código mandava essa string crua pro backend, que roda em UTC dentro do container — `new Date("2026-08-09T21:00")` no backend foi interpretado como 21h **UTC** (não 21h BRT), gravando 3h adiantado. Confirmado testando: `date` do container mostra UTC; `new Date('2026-08-09T21:00')` no `node` do container realmente retorna `21:00:00.000Z`. Afetava tanto "Data/hora" de Eventos Personalizados quanto de Atividades (mesmo componente `ScheduleEditor`, reusado pelas duas telas) — nos dois sentidos: ao salvar (grava errado) e ao reabrir pra editar (pré-preenchia errado também).

**Fix**: novas funções em `scheduleTimezone.ts` — `localDatetimeInputToUtcIso` (converte a string do input, interpretada no fuso do navegador de quem preenche, pra ISO UTC de verdade antes de mandar pro backend) e `utcIsoToLocalDatetimeInput` (caminho inverso, pra reabrir o formulário de edição com a hora certa no fuso de quem está editando). Aplicado em `CustomEventsPage.tsx` (criar evento) e `ActivitiesPage.tsx` (`ScheduleEditor`, usado nas duas telas).

**Testado ao vivo**: criei um evento de teste às 21h (fuso America/Sao_Paulo, confirmado via `Intl.DateTimeFormat` no navegador) — a tela de admin mostrou "21:00" corretamente, e o valor bruto no banco ficou `2026-08-11 00:00:00` (UTC), exatamente 21h BRT do dia anterior — bate. Evento de teste removido ao final.

**Outros 3 pedidos na mesma mensagem**:
- **"Corte semanal" → "Imposto semanal"**: conferido que nunca tinha sido renomeado antes (o resto da tela já usava "Imposto semanal" em outros campos — só "Horário do corte semanal" e o bloco de disparo manual ainda diziam "corte"). Unificado em `SettingsPage.tsx`.
- **"Nome da atividade composta" ocupando a tela**: `CreateCompositeActivityForm` (em `ActivitiesPage.tsx`) virou colapsável — mostra só um botão "+ Criar atividade composta" por padrão, expande ao clicar (com botão "Cancelar" pra fechar de novo).
- **Fluxo de proteção de leilão**: investigado o modelo atual (não implementada mudança nenhuma ainda — ver resposta ao usuário na conversa): existem 2 camadas já implementadas — "Participantes" (quem participou do evento fonte, marcado manualmente, só eles recebem código de acesso) e elegibilidade por item (automática: nível do personagem vs. nível mínimo da Proteção escolhida pro item, sem lista manual separada por item). Perguntado ao usuário o que especificamente sente como complicado nesse fluxo antes de alterar.

## 2026-08-09 — Papel Vice-GM, vínculo personagem↔conta (nível auto-aprovado) e ID do Discord mais flexível

**Contexto**: 3 pedidos na mesma mensagem, depois de testar o ambiente dev. (1) ID do Discord rejeitava `FabioSilva#5674` (formato usuário#tag) — usuário achou a validação errada demais. (2) GM/Conselho já editam nível livremente pela tela de Personagens, mas o próprio pedido deles via `/perfil` ainda caía na fila de aprovação — queria que aplicasse na hora nesse caso. (3) Pedido de um papel novo "Vice-GM" com os mesmos direitos do GM em tudo, e uma forma de marcar na tela de Personagens quem é GM/Vice-GM/Conselho. Perguntei 3 pontos antes de implementar (respostas do usuário): aceitar usuário/tag do Discord além do ID numérico; vincular personagem à conta de login existente (não um campo solto); sem limite de quantidade de contas no sistema.

**ID do Discord mais flexível**: `isValidDiscordHandle` (novo util compartilhado, `backend/src/common/discord-handle.util.ts` — antes a regex vivia duplicada em `characters.service.ts` e `profile.service.ts`) aceita ID numérico (17-19 dígitos) **ou** usuário/tag (`fulano`, `fulano#1234`). Textos de ajuda atualizados nas 3 línguas explicando as duas opções.

**Papel Vice-GM**: novo valor no enum `UserRole` (migration `20260809200000_vice_gm_and_character_link`) com **os mesmos direitos do GM em tudo** — adicionado em todo `@Roles('GM')`/`@Roles('GM','COUNCIL')` do backend (conselho, emissão manual, corte semanal manual, aviso fixo, backup, force-delete de leilão, e o caso especial de publicar leilão direto sem precisar de 2 aprovações). `UsersController`/`UsersService` generalizados de "só Conselho" pra gerenciar Conselho+Vice-GM juntos (`/users/staff`, antes `/users/council`) — tela renomeada pra "Equipe (Conselho e Vice-GM)", com seletor de papel ao criar. Sem limite de quantidade de contas (1 Vice-GM/6 conselheiros é só o planejamento da guild, não uma trava do sistema).

**Vínculo personagem↔conta + nível auto-aprovado**: novo campo `Character.linkedUserId` (FK única, opcional, mesma migration) — configurado na tela de Personagens via dropdown (`GET /users/all`, lista mínima de todas as contas). Quando o personagem vinculado a uma conta GM/Vice-GM/Conselho pede atualização de nível pelo **próprio** perfil público, `ProfileService.submitLevelChangeRequest` aplica o nível na hora (transação: `Character.level` atualizado + `LevelChangeRequest` já criado como `APPROVED`, com `reviewedById` da própria conta) — sem passar pela fila de mais ninguém. Personagem sem vínculo continua sempre passando pela aprovação normal. Mensagem de sucesso na tela de perfil diferencia os dois casos ("aguarde revisão" vs. "aplicou na hora").

**Testado ao vivo, ponta a ponta**: criei uma conta Vice-GM de teste, vinculei ao personagem real da Agrute, pedi atualização de nível pelo perfil público dela — aplicou na hora (nível mudou de 66→90, `LevelChangeRequest` já `APPROVED`); testei que um personagem sem vínculo (BASSON) continua caindo em `PENDING` normalmente; testei bloqueio de vínculo duplicado (2º personagem tentando vincular à mesma conta → erro claro); testei Discord com usuário+tag, só usuário, e um valor realmente inválido (rejeitado); testei que Vice-GM consegue acessar endpoints antes GM-only (`/users/staff`, `/admin/backup`) e que Conselho continua bloqueado deles (403). Tudo revertido ao final (contas de teste apagadas, vínculo e níveis voltados ao estado original).


## 2026-08-09 — Fix: pedido de nível "não aparecia" na tela de perfil

**Contexto**: usuário reportou que testou o pedido de atualização de nível no próprio personagem e "não apareceu nada" depois de enviar.

**Causa raiz, confirmada testando ao vivo (curl + simulação de submit real na UI via input file/change events)**: o backend e a leitura funcionavam perfeitamente (confirmado via curl: pedido criado, aparece na fila admin) — o bug era puramente de renderização. A mensagem de sucesso (`form-success`) vivia dentro do mesmo bloco `{pendingRequest ? (...resumo pendente...) : (...formulário + mensagem de sucesso...)}`. Como a própria resposta da mutation já inclui o pedido `PENDING` recém-criado, `pendingRequest` vira verdadeiro no mesmo re-render em que o sucesso acontece — o React troca imediatamente pro branch do resumo, e o branch que mostraria "Solicitação enviada!" nunca chega a renderizar. Pra quem não reparasse na troca sutil de texto, realmente parecia que nada tinha acontecido (mesmo o pedido tendo sido criado e reaparecendo certinho num reload).

**Fix**: `frontend/src/pages/ProfilePage.tsx` — movida a mensagem de sucesso pra fora do ternário, sempre visível independente de qual branch (formulário vs. resumo pendente) está renderizando.

**Testado ao vivo**: reproduzido o bug exato (submit via simulação de evento de arquivo real na UI — não só curl), confirmado que a mensagem não aparecia antes do fix e aparece corretamente depois ("Solicitação enviada! Aguarde a revisão do GM/conselho." junto com o resumo "Você tem uma solicitação pendente"), sem duplicar o pedido no banco. Dados de teste (personagem Agrute) revertidos ao final.
## 2026-08-09 — Troca de senha self-service (GM e Conselho)

**Contexto**: até agora não existia nenhuma forma de trocar a própria senha logado — a única opção documentada no `DEPLOY.md` era recriar a conta de GM direto no banco. Pedido explícito pra resolver isso.

**Backend**: `AuthService.changePassword(userId, currentPassword, newPassword)` — confere a senha atual via bcrypt antes de aceitar a troca (`401` se errada), exige mínimo de 8 caracteres na nova (`400` se curta). Novo endpoint `POST /auth/change-password`, autenticado (funciona pra GM e Conselho, já que os dois logam com usuário/senha) — não precisa de `@Roles`, é sempre sobre o próprio usuário logado (via `@CurrentUser()`), nunca sobre outra conta.

**Frontend**: nova página `/admin/change-password` ("Minha Senha", link no grupo "Sistema" do menu, visível pros dois papéis), formulário com senha atual + nova + confirmação, validação de que as duas novas batem antes de enviar.

**Bug real pego durante o teste manual**: o interceptor global do axios tratava *qualquer* `401` como "sessão expirada" e deslogava o usuário automaticamente — inclusive o `401` de "senha atual incorreta", que é uma resposta esperada da própria troca de senha, não uma sessão inválida. Resultado: errar a senha atual uma vez te chutava pra tela de login. Corrigido excluindo `/auth/login` e `/auth/change-password` desse comportamento automático (client.ts) — esses dois endpoints tratam o próprio `401` inline, sem precisar do logout global.

**Testado ao vivo**: via curl (senha atual errada → `401` com mensagem clara; nova senha curta → `400`; troca válida → sucesso, login com senha antiga passa a falhar e com a nova funciona) e na UI (mesma sequência, incluindo confirmar que o bug do logout automático sumiu depois do fix). Senha do GM de dev revertida ao valor padrão ao final do teste.
## 2026-08-09 — Deploy em produção via Dokploy: ambiente dev criado e validado, script de deploy reutilizável

**Contexto**: pedido de preparação pra produção — usar Dokploy (self-hosted em `rfonext-dkp.cloud`), com ambiente dev e prod separados por guild, cada deploy novo começando zerado, e um script reaproveitável pra futuras guilds (intenção white-label). Instrução explícita do usuário: criar só o `dev` primeiro pra validação, prod só depois de aprovação.

**Configuração do MCP/API**: o servidor MCP `@dokploy/mcp` precisa de `npx`, que não existe neste host (só Docker, por design do projeto) — `.mcp.json` foi configurado rodando o MCP dentro de um container `node:20-alpine` (`docker run --rm -i ...`), gitignored (contém a API key em texto puro). Também corrigido: a URL do painel é `https://rfonext-dkp.cloud` (porta 443 direto), não `:3000` como informado inicialmente.

**Estrutura no Dokploy** (mapeada por tentativa via API, já que a doc pública não detalha o modelo exato): Projeto → Ambiente → App Compose → Domínio. Um projeto `saborrf` foi criado; `project.create` já gera um ambiente `production` padrão automaticamente, e um ambiente `dev` foi criado ao lado — nenhum dado é compartilhado entre eles.

**Descoberta importante — upload direto de Compose não serve pra esse projeto**: o Dokploy só aceita `git`/`github`/`gitlab`/`bitbucket`/`gitea`/`raw` como fonte; `raw` (colar o YAML) falha porque nossos serviços usam `build: context: ./backend`/`./frontend` — precisa do código-fonte junto, não só o texto do compose. Isso reverteu a escolha inicial do usuário ("upload direto, sem Git") — depois de confirmar com ele, criamos um repositório privado no GitHub (`fabiocore/rfonext-dkp-saborrf`) via deploy key SSH (gerada localmente, sem precisar de token nem `gh` CLI), e configuramos o Dokploy pra clonar por Git usando a mesma chave (`sshKey.create`).

**Segunda descoberta — porta 80 colidindo com o Traefik do Dokploy**: o `docker-compose.prod.yml` original publica `80:80` no host, que é exatamente a porta que o próprio Traefik do Dokploy usa pra rotear todos os domínios — o deploy buildava certo mas o container `web` falhava ao subir ("port is already allocated"). Criado `docker-compose.dokploy.yml` (variante idêntica, sem publicar porta — o Traefik alcança o serviço pela rede interna do Docker via config do domínio). `docker-compose.prod.yml` continua valendo pra quem sobe sem Dokploy.

**Bug real pego pelo build de produção**: `tsc -b` (usado no build real, mais estrito que o `tsc --noEmit` usado em dev) acusou `currencyAbbr` declarado e nunca lido em `ProtectionRow` (`ProtectionsPage.tsx`) — a prop existia mas a linha do "Lance mínimo" na tabela nunca mostrava a sigla da moeda (diferente do formulário de criar proteção, logo abaixo, que já mostrava). Corrigido exibindo a sigla ao lado do input, em vez de só remover a prop.

**`scripts/dokploy-deploy.mjs` + `scripts/dokploy-deploy.sh`** (novo): automatiza tudo que foi feito manualmente — cria projeto/ambiente/app Compose/domínio se não existirem (idempotente, não duplica nem sobrescreve segredos já gerados numa segunda execução), gera `POSTGRES_PASSWORD`/`JWT_SECRET`/`GM_BOOTSTRAP_PASSWORD` aleatórios só na primeira vez (nunca reaproveitados entre ambientes/guilds), configura a fonte Git com deploy key, e dispara o deploy. Roda num container Node descartável (`docker run node:20-alpine`), consistente com "sem Node no host". Documentado em `DEPLOY.md` seção 7 (pré-requisitos, uso, fluxo de promoção dev→prod).

**Testado ao vivo, ponta a ponta**: build do backend e frontend passou limpo (após o fix do `ProtectionsPage`), deploy concluído (`composeStatus: done`), `https://sabor-dev.rfonext-dkp.cloud` responde HTTP 200 com certificado TLS válido (Let's Encrypt, emitido automaticamente), Home mostra estado zerado ("Nenhum aviso", "Nenhum evento", nome de guild ainda no placeholder — confirma banco novo/limpo), login do GM (`guildmaster` + senha gerada) funcionou, painel admin carregou todas as seções. Script de deploy testado em modo idempotente contra esse mesmo ambiente (`--skip-deploy`) — reconheceu tudo como já existente, sem duplicar nada.

**Pendente**: promoção pra `production` (domínio `sabor.rfonext-dkp.cloud`) aguardando validação do usuário no ambiente dev, conforme instrução explícita dele.

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
