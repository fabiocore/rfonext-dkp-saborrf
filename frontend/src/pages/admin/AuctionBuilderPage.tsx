import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addAuctionItem,
  approveAuction,
  cancelAuctionItem,
  closeAuction,
  deleteAuctionDraft,
  fetchActivities,
  fetchAuctionStaff,
  fetchCharacters,
  fetchGuildSettings,
  fetchProtections,
  fetchRecentActivityParticipants,
  forceDeleteAuction,
  forceDeleteAuctionItem,
  isGmLevel,
  removeAuctionItem,
  setAuctionParticipants,
  setAuctionSchedule,
} from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ImageUploadInput } from '../../components/ImageUploadInput';
import { TableScroll } from '../../components/TableScroll';

/** Converte um ISO (UTC) pro valor de um <input type="datetime-local">, no fuso de quem está vendo. */
function isoToDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Caminho inverso — o valor de um <input type="datetime-local"> é sempre hora local de quem digitou, então `new Date(...)` já interpreta certo; só precisamos do ISO (UTC) pra mandar pro backend. */
function datetimeLocalValueToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING_APPROVAL: 'Aguardando aprovação',
  OPEN: 'Aberto',
  CLOSED: 'Encerrado',
};

function AddItemForm({ auctionId }: { auctionId: string }) {
  const queryClient = useQueryClient();
  const protectionsQuery = useQuery({ queryKey: ['protections'], queryFn: fetchProtections });
  const [name, setName] = useState('');
  const [protectionId, setProtectionId] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => addAuctionItem(auctionId, { name, protectionId: protectionId || null, imageUrl }),
    onSuccess: () => {
      setName('');
      setProtectionId('');
      setImageUrl(null);
      queryClient.invalidateQueries({ queryKey: ['auction-staff', auctionId] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <label>
        Nome do item
        <input placeholder="Nome do item" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Proteção
        <select value={protectionId} onChange={(e) => setProtectionId(e.target.value)}>
          <option value="">Sem proteção</option>
          {protectionsQuery.data?.filter((p) => p.isActive).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.description}
            </option>
          ))}
        </select>
      </label>
      <label>
        Imagem (opcional)
        <ImageUploadInput value={imageUrl} onChange={setImageUrl} />
      </label>
      <button type="submit" disabled={mutation.isPending}>
        Adicionar item
      </button>
    </form>
  );
}

export function AuctionBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const gmLevel = isGmLevel(user?.role);
  const queryClient = useQueryClient();

  const auctionQuery = useQuery({
    queryKey: ['auction-staff', id],
    queryFn: () => fetchAuctionStaff(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });
  const charactersQuery = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? '';
  const activitiesQuery = useQuery({ queryKey: ['activities'], queryFn: fetchActivities });
  const weeklyActivities = (activitiesQuery.data ?? []).filter((a) => a.recurrencePeriod === 'WEEKLY');
  const weeklyActivityIds = weeklyActivities.map((a) => a.id);
  // Busca a semana mais recente de TODAS as atividades semanais de uma vez
  // (não só as marcadas) — mostra a informação (semana/quantas pessoas) na
  // hora, antes do GM decidir o que marcar, em vez de um passo "às cegas".
  const recentParticipantsQuery = useQuery({
    queryKey: ['recent-activity-participants', weeklyActivityIds.join(',')],
    queryFn: () => fetchRecentActivityParticipants(weeklyActivityIds),
    enabled: weeklyActivityIds.length > 0,
  });
  const [checkedActivityIds, setCheckedActivityIds] = useState<Set<string>>(new Set());

  const auction = auctionQuery.data;
  const editable = auction?.status === 'DRAFT' || auction?.status === 'PENDING_APPROVAL';
  // Participantes = quem participou do EVENTO fonte do leilão, sem relação
  // nenhuma com proteção de item (isso é decidido por nível na hora do
  // lance, item a item — ver isEligibleForItem). A lista pra escolher é
  // sempre todo Principal ativo que recebe DKP; nada aqui é pré-filtrado
  // por elegibilidade de item (bug corrigido em 2026-08-09 — a lista
  // escondia quem não batia nível de nenhum item, mesmo sendo participante
  // real do evento).
  const principals = (charactersQuery.data ?? []).filter((c) => c.status === 'PRINCIPAL' && c.membershipStatus === 'ACTIVE');

  const [selectedParticipants, setSelectedParticipants] = useState<Set<string> | null>(null);
  // Sem override manual do GM ainda: se já existem participantes salvos,
  // parte deles; senão, começa vazio — é uma escolha manual de quem
  // participou do evento, não faz sentido pré-marcar todo o roster ativo.
  const participantIds =
    selectedParticipants ?? new Set(auction?.participants.map((p) => p.characterId) ?? []);

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => removeAuctionItem(id!, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auction-staff', id] }),
  });

  const saveParticipantsMutation = useMutation({
    mutationFn: () => setAuctionParticipants(id!, Array.from(participantIds)),
    onSuccess: () => {
      setSelectedParticipants(null);
      queryClient.invalidateQueries({ queryKey: ['auction-staff', id] });
    },
  });

  // Mesmo padrão de override do `selectedParticipants` acima: começa "sem
  // override" e usa o valor salvo no servidor; assim que o GM mexe no campo,
  // a escolha dele passa a mandar até salvar (o refetch a cada 5s não
  // atropela o que ele está digitando).
  const [scheduledEndAtOverride, setScheduledEndAtOverride] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const scheduledEndAtInput = scheduledEndAtOverride ?? isoToDatetimeLocalValue(auction?.scheduledEndAt ?? null);

  const saveScheduleMutation = useMutation({
    mutationFn: () => {
      const iso = datetimeLocalValueToIso(scheduledEndAtInput);
      if (!iso) throw new Error('Defina uma data/hora válida.');
      return setAuctionSchedule(id!, iso);
    },
    onSuccess: () => {
      setScheduledEndAtOverride(null);
      setScheduleError(null);
      queryClient.invalidateQueries({ queryKey: ['auction-staff', id] });
    },
    onError: (err: any) => setScheduleError(err?.response?.data?.message ?? err?.message ?? 'Falha ao salvar data de término.'),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveAuction(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auction-staff', id] }),
    onError: (err: any) => setScheduleError(err?.response?.data?.message ?? 'Falha ao publicar.'),
  });

  const cancelItemMutation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) => cancelAuctionItem(id!, itemId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auction-staff', id] }),
  });

  const closeAuctionMutation = useMutation({
    mutationFn: (reason: string) => closeAuction(id!, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auction-staff', id] }),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: () => deleteAuctionDraft(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions-staff'] });
      navigate('/admin/auctions');
    },
  });

  function handleDeleteDraft(title: string) {
    if (!confirm(`Apagar o rascunho "${title}"? Isso remove os itens e a lista de participantes marcados. Não dá pra desfazer.`)) return;
    deleteDraftMutation.mutate();
  }

  const [forceDeleteError, setForceDeleteError] = useState<string | null>(null);

  const forceDeleteAuctionMutation = useMutation({
    mutationFn: (reason: string) => forceDeleteAuction(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auctions-staff'] });
      navigate('/admin/auctions');
    },
    onError: (err: any) => setForceDeleteError(err?.response?.data?.message ?? 'Falha ao apagar o leilão.'),
  });

  const forceDeleteItemMutation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) => forceDeleteAuctionItem(id!, itemId, reason),
    onSuccess: () => {
      setForceDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['auction-staff', id] });
    },
    onError: (err: any) => setForceDeleteError(err?.response?.data?.message ?? 'Falha ao apagar o item.'),
  });

  // Controle total do GM (PREMISSAS.md seção 7.2): apaga leilão/item em
  // qualquer status, mesmo aberto ou encerrado — diferente de "Apagar
  // rascunho"/"Remover" (só em rascunho, sem motivo). Se o item já tinha
  // vencedor com queima real, uma reversão de crédito é criada automaticamente
  // (a queima original nunca é apagada — visível pra sempre no extrato).
  function handleForceDeleteAuction(title: string) {
    const reason = prompt(
      `Motivo pra apagar o leilão "${title}" (mesmo estando aberto/encerrado) — obrigatório:`,
    );
    if (!reason?.trim()) return;
    const confirmed = confirm(
      `Isso apaga o leilão "${title}" inteiro, com todos os itens e lances — pra sempre. Itens já vencidos recebem uma reversão de crédito automática (a queima original continua no extrato). Não dá pra desfazer. Confirma?`,
    );
    if (!confirmed) return;
    setForceDeleteError(null);
    forceDeleteAuctionMutation.mutate(reason.trim());
  }

  function handleForceDeleteItem(itemId: string, itemName: string) {
    const reason = prompt(`Motivo pra apagar o item "${itemName}" (mesmo já resolvido) — obrigatório:`);
    if (!reason?.trim()) return;
    const confirmed = confirm(
      `Isso apaga o item "${itemName}" pra sempre. Se ele já tinha vencedor, o valor volta pro personagem automaticamente (a queima original continua no extrato). Não dá pra desfazer. Confirma?`,
    );
    if (!confirmed) return;
    setForceDeleteError(null);
    forceDeleteItemMutation.mutate({ itemId, reason: reason.trim() });
  }

  function handleCancelItem(itemId: string, itemName: string) {
    const reason = prompt(`Motivo pra encerrar "${itemName}" antes da hora (obrigatório):`);
    if (!reason?.trim()) return;
    cancelItemMutation.mutate({ itemId, reason: reason.trim() });
  }

  function handleCloseAuction() {
    const reason = prompt('Motivo pra encerrar o leilão inteiro antes da hora (obrigatório):');
    if (!reason?.trim()) return;
    closeAuctionMutation.mutate(reason.trim());
  }

  function toggleParticipant(characterId: string) {
    const next = new Set(participantIds);
    if (next.has(characterId)) next.delete(characterId);
    else next.add(characterId);
    setSelectedParticipants(next);
  }

  function toggleActivityCheck(activityId: string) {
    const next = new Set(checkedActivityIds);
    if (next.has(activityId)) next.delete(activityId);
    else next.add(activityId);
    setCheckedActivityIds(next);
  }

  /**
   * Substitui a seleção de participantes pela união de quem recebeu as
   * atividades marcadas na semana mais recente de cada uma — pedido do
   * usuário (2026-08-14): a lista de participantes já vem pronta do
   * import, não devia precisar checar um por um manualmente toda vez.
   */
  function applyActivitySelection() {
    const results = recentParticipantsQuery.data ?? [];
    const principalIds = new Set(principals.map((c) => c.id));
    const union = new Set<string>();
    for (const result of results) {
      if (!checkedActivityIds.has(result.activityId)) continue;
      for (const characterId of result.characterIds) {
        if (principalIds.has(characterId)) union.add(characterId);
      }
    }
    setSelectedParticipants(union);
  }

  if (!auction) return <p>Carregando...</p>;

  const alreadyApproved = auction.approvals.some((a) => a.userId === user?.id);

  return (
    <section>
      <h2>{auction.title}</h2>
      <p className="subtitle">
        Status: <strong>{STATUS_LABEL[auction.status] ?? auction.status}</strong>
        {auction.expiresAt && auction.status === 'OPEN' && (
          <> — expira em {new Date(auction.expiresAt).toLocaleString('pt-BR')}</>
        )}
        {auction.closeReason && <> — Motivo do encerramento: {auction.closeReason}</>}
      </p>

      {auction.status === 'OPEN' && gmLevel && (
        <button type="button" onClick={handleCloseAuction} disabled={closeAuctionMutation.isPending}>
          Encerrar leilão inteiro
        </button>
      )}{' '}
      {gmLevel && (
        <button
          type="button"
          onClick={() => handleForceDeleteAuction(auction.title)}
          disabled={forceDeleteAuctionMutation.isPending}
        >
          Apagar leilão (qualquer status)
        </button>
      )}
      {forceDeleteError && <p className="form-error">{forceDeleteError}</p>}

      <h3>Itens</h3>
      {editable && <AddItemForm auctionId={auction.id} />}
      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th>Imagem</th>
            <th>Item</th>
            <th>Proteção</th>
            <th>Resultado</th>
            <th>Desistências</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {auction.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} style={{ maxWidth: 60, maxHeight: 60, borderRadius: 4 }} />
                )}
              </td>
              <td>{item.name}</td>
              <td>{item.protection ? `${item.protection.name} (nível ${item.protection.minLevel}+, mín. ${item.protection.minBid})` : 'Nenhuma'}</td>
              <td>
                {item.resolutionStatus === 'PENDING' && 'Em andamento'}
                {item.resolutionStatus === 'UNCLAIMED' && 'Não reclamado — será randomizado no jogo'}
                {item.resolutionStatus === 'WON' && item.winningBid && (
                  <>
                    <strong>
                      {item.winningBid.character.gameName} — {item.winningBid.amount}
                    </strong>
                    {Array.isArray((item.diceRollDetail as any)?.rolls) && (
                      <div className="subtitle">
                        Desempate no dado: {(item.diceRollDetail as any).rolls.map((r: any) => `${r.gameName} ${r.roll}`).join(', ')}
                      </div>
                    )}
                  </>
                )}
                {item.resolutionStatus === 'CANCELLED' && `Encerrado pelo GM: ${item.cancelReason}`}
              </td>
              <td>{item.withdrawals.map((w) => w.character.gameName).join(', ') || '—'}</td>
              <td>
                {editable && (
                  <button type="button" onClick={() => removeItemMutation.mutate(item.id)}>
                    Remover
                  </button>
                )}
                {!editable && auction.status === 'OPEN' && item.resolutionStatus === 'PENDING' && gmLevel && (
                  <button type="button" onClick={() => handleCancelItem(item.id, item.name)} disabled={cancelItemMutation.isPending}>
                    Encerrar item
                  </button>
                )}{' '}
                {gmLevel && (
                  <button
                    type="button"
                    onClick={() => handleForceDeleteItem(item.id, item.name)}
                    disabled={forceDeleteItemMutation.isPending}
                  >
                    Apagar item (forçado)
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>

      <h3>Participantes</h3>
      {editable ? (
        <>
          <p className="subtitle">
            Marque quem participou do evento (todo Principal ativo que recebe DKP aparece aqui, independente de
            nível). Assim que publicar, cada um já consegue entrar com o próprio código de leilão (fixo, consultado
            no perfil dele — não precisa distribuir nada novo). Se algum item tiver proteção, quem não bate o nível
            mínimo consegue ver mas não consegue dar lance só naquele item específico.
          </p>
          {weeklyActivities.length > 0 && (
            <div className="auction-item-card" style={{ marginBottom: 12 }}>
              <h4 style={{ marginTop: 0 }}>Puxar participantes de atividades semanais</h4>
              <p className="subtitle">
                Marque as atividades do evento e clique em aplicar — substitui a seleção abaixo pela união de quem
                recebeu {currencyAbbr} nelas na semana mais recente (segunda a domingo civil), não num dia exato.
              </p>
              {weeklyActivities.map((activity) => {
                const info = recentParticipantsQuery.data?.find((r) => r.activityId === activity.id);
                return (
                  <label key={activity.id} style={{ display: 'block', marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={checkedActivityIds.has(activity.id)}
                      onChange={() => toggleActivityCheck(activity.id)}
                    />{' '}
                    {activity.name}{' '}
                    <span className="subtitle">
                      {recentParticipantsQuery.isLoading && '(carregando...)'}
                      {info && !info.weekStart && '— sem emissão registrada ainda'}
                      {info && info.weekStart && info.weekEnd && (
                        <>
                          — semana de {new Date(info.weekStart).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a{' '}
                          {new Date(new Date(info.weekEnd).getTime() - 86400000).toLocaleDateString('pt-BR', {
                            timeZone: 'UTC',
                          })}{' '}
                          ({info.characterIds.length} pessoa{info.characterIds.length === 1 ? '' : 's'})
                        </>
                      )}
                    </span>
                  </label>
                );
              })}
              <button type="button" onClick={applyActivitySelection} disabled={checkedActivityIds.size === 0}>
                Aplicar seleção ({checkedActivityIds.size} atividade{checkedActivityIds.size === 1 ? '' : 's'} marcada
                {checkedActivityIds.size === 1 ? '' : 's'})
              </button>
            </div>
          )}

          <div>
            <button type="button" onClick={() => setSelectedParticipants(new Set(principals.map((c) => c.id)))}>
              Selecionar todos
            </button>{' '}
            <button type="button" onClick={() => setSelectedParticipants(new Set())}>
              Desmarcar todos
            </button>
          </div>
          <div className="checkbox-grid">
            {principals.map((c) => (
              <label key={c.id}>
                <input type="checkbox" checked={participantIds.has(c.id)} onChange={() => toggleParticipant(c.id)} />
                {c.gameName} {c.level ? `(nível ${c.level})` : ''}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => saveParticipantsMutation.mutate()} disabled={saveParticipantsMutation.isPending}>
            Salvar participantes
          </button>
        </>
      ) : (
        <>
        <p className="subtitle">
          Cada participante entra com o próprio código de leilão fixo (consulte em Personagens ou no perfil dele —
          não muda de leilão pra leilão).
        </p>
        <TableScroll>
        <table className="data-table">
          <thead>
            <tr>
              <th>Personagem</th>
            </tr>
          </thead>
          <tbody>
            {auction.participants.map((p) => (
              <tr key={p.id}>
                <td>{p.character.gameName}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableScroll>
        </>
      )}

      {editable && (
        <>
          <h3>Data/hora de término</h3>
          <p className="subtitle">
            O leilão fecha exatamente nessa data/hora (fuso do seu navegador) — precisa estar definida e no futuro antes de publicar.
          </p>
          <label>
            Término do leilão
            <input
              type="datetime-local"
              value={scheduledEndAtInput}
              onChange={(e) => setScheduledEndAtOverride(e.target.value)}
            />
          </label>{' '}
          <button
            type="button"
            onClick={() => saveScheduleMutation.mutate()}
            disabled={saveScheduleMutation.isPending || !scheduledEndAtInput}
          >
            Salvar data de término
          </button>
          {scheduleError && <p className="form-error">{scheduleError}</p>}

          <h3>Publicação</h3>
          <p className="subtitle">
            GM/Vice-GM publica direto. Conselho precisa de 2 aprovações distintas — aprovações até agora:{' '}
            {auction.approvals.length}/2.
          </p>
          <button
            type="button"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || !auction.scheduledEndAt || (!gmLevel && alreadyApproved)}
          >
            {gmLevel ? 'Publicar agora' : alreadyApproved ? 'Você já aprovou' : 'Aprovar publicação'}
          </button>{' '}
          <button
            type="button"
            onClick={() => handleDeleteDraft(auction.title)}
            disabled={deleteDraftMutation.isPending}
          >
            Apagar rascunho
          </button>
        </>
      )}
    </section>
  );
}
