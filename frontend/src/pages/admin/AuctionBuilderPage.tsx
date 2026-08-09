import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addAuctionItem,
  approveAuction,
  cancelAuctionItem,
  closeAuction,
  deleteAuctionDraft,
  fetchAuctionStaff,
  fetchCharacters,
  fetchProtections,
  forceDeleteAuction,
  forceDeleteAuctionItem,
  removeAuctionItem,
  setAuctionParticipants,
  setAuctionSchedule,
  type AuctionItem,
  type Character,
} from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ImageUploadInput } from '../../components/ImageUploadInput';

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

/** Mesma regra do backend (AuctionsService.isEligible): sem proteção = todos elegíveis; com proteção = level do personagem >= level mínimo dela. */
function isEligibleForItem(character: Character, item: AuctionItem): boolean {
  if (!item.protectionId || !item.protection) return true;
  return (character.level ?? 0) >= item.protection.minLevel;
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

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

export function AuctionBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const auctionQuery = useQuery({
    queryKey: ['auction-staff', id],
    queryFn: () => fetchAuctionStaff(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });
  const charactersQuery = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });

  const auction = auctionQuery.data;
  const editable = auction?.status === 'DRAFT' || auction?.status === 'PENDING_APPROVAL';
  const principals = (charactersQuery.data ?? []).filter((c) => c.status === 'PRINCIPAL' && c.membershipStatus === 'ACTIVE');

  // Mesma regra de elegibilidade do backend: se o leilão já tem algum item,
  // só mostra quem bate o requisito de nível de PELO MENOS um item (sem
  // proteção em qualquer item = todo mundo elegível) — quem não bate nenhum
  // não recebe código de qualquer forma, então listá-lo só atrapalharia.
  const eligiblePrincipals =
    auction && auction.items.length > 0
      ? principals.filter((c) => auction.items.some((item) => isEligibleForItem(c, item)))
      : principals;

  const [selectedParticipants, setSelectedParticipants] = useState<Set<string> | null>(null);
  // Sem override manual do GM ainda: se já existem participantes salvos,
  // parte deles; senão, seleciona todo mundo elegível automaticamente (em
  // vez de começar vazio) — assim que o GM mexer numa caixa ou clicar
  // Selecionar/Desmarcar todos, a escolha dele passa a mandar.
  const participantIds =
    selectedParticipants ??
    new Set(
      auction && auction.participants.length > 0
        ? auction.participants.map((p) => p.characterId)
        : eligiblePrincipals.map((c) => c.id),
    );

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

      {auction.status === 'OPEN' && user?.role === 'GM' && (
        <button type="button" onClick={handleCloseAuction} disabled={closeAuctionMutation.isPending}>
          Encerrar leilão inteiro
        </button>
      )}{' '}
      {user?.role === 'GM' && (
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
                {item.resolutionStatus === 'WON' && `Vencido`}
                {item.resolutionStatus === 'CANCELLED' && `Encerrado pelo GM: ${item.cancelReason}`}
              </td>
              <td>{item.withdrawals.map((w) => w.character.gameName).join(', ') || '—'}</td>
              <td>
                {editable && (
                  <button type="button" onClick={() => removeItemMutation.mutate(item.id)}>
                    Remover
                  </button>
                )}
                {!editable && auction.status === 'OPEN' && item.resolutionStatus === 'PENDING' && user?.role === 'GM' && (
                  <button type="button" onClick={() => handleCancelItem(item.id, item.name)} disabled={cancelItemMutation.isPending}>
                    Encerrar item
                  </button>
                )}{' '}
                {user?.role === 'GM' && (
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

      <h3>Participantes</h3>
      {editable ? (
        <>
          <p className="subtitle">
            {auction.items.length === 0
              ? 'Adicione itens primeiro pra filtrar automaticamente por elegibilidade.'
              : eligiblePrincipals.length < principals.length
                ? `Só personagens elegíveis em pelo menos 1 item aparecem aqui (${principals.length - eligiblePrincipals.length} não elegível(is) escondido(s)) — quem não bate requisito de nenhum item não recebe código de qualquer forma.`
                : 'Nenhum item tem proteção restringindo nível — todos os Principais são elegíveis.'}
          </p>
          <div>
            <button type="button" onClick={() => setSelectedParticipants(new Set(eligiblePrincipals.map((c) => c.id)))}>
              Selecionar todos
            </button>{' '}
            <button type="button" onClick={() => setSelectedParticipants(new Set())}>
              Desmarcar todos
            </button>
          </div>
          <div className="checkbox-grid">
            {eligiblePrincipals.map((c) => (
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Personagem</th>
              <th>Código</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {auction.participants.map((p) => (
              <tr key={p.id}>
                <td>{p.character.gameName}</td>
                <td>{p.accessCode ?? '— (sem item elegível)'}</td>
                <td>{p.accessCode && <CopyCodeButton code={p.accessCode} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            GM publica direto. Conselho precisa de 2 aprovações distintas — aprovações até agora: {auction.approvals.length}/2.
          </p>
          <button
            type="button"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || !auction.scheduledEndAt || (user?.role === 'COUNCIL' && alreadyApproved)}
          >
            {user?.role === 'GM' ? 'Publicar agora' : alreadyApproved ? 'Você já aprovou' : 'Aprovar publicação'}
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
