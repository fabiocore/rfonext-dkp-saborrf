import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCharacters,
  fetchGuildSettings,
  regenerateAuctionCode,
  regenerateProfileCode,
  updateCharacter,
  type Character,
  type MembershipStatus,
} from '../../api/client';
import { EyeIcon } from '../../components/EyeIcon';
import { TableScroll } from '../../components/TableScroll';
import { CopyCodeButton } from '../../components/CopyCodeButton';

function ProfileCodeCell({ characterId, code, gameName }: { characterId: string; code: string; gameName: string }) {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateProfileCode(characterId),
    onSuccess: () => {
      setVisible(true);
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });

  function handleRegenerate() {
    if (
      !confirm(
        `Gerar um novo código de perfil pra "${gameName}"? O código atual para de funcionar na hora — se o membro já tinha esse código salvo em algum lugar, ele vai precisar do novo.`,
      )
    ) {
      return;
    }
    regenerateMutation.mutate();
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <code>{visible ? code : '••••••••••••'}</code>
      <button
        type="button"
        className="icon-btn"
        title={visible ? 'Ocultar código' : 'Mostrar código'}
        aria-label={visible ? 'Ocultar código' : 'Mostrar código'}
        onClick={() => setVisible((v) => !v)}
      >
        <EyeIcon open={visible} />
      </button>
      {visible && <CopyCodeButton code={code} />}
      <button type="button" onClick={handleRegenerate} disabled={regenerateMutation.isPending}>
        Gerar novo
      </button>
    </span>
  );
}

/** Código de leilão fixo (2026-08-14) — mesmo padrão do código de perfil acima, mascarado por padrão. */
function AuctionCodeCell({ characterId, code, gameName }: { characterId: string; code: string; gameName: string }) {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateAuctionCode(characterId),
    onSuccess: () => {
      setVisible(true);
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });

  function handleRegenerate() {
    if (
      !confirm(
        `Gerar um novo código de leilão pra "${gameName}"? O código atual para de funcionar na hora — se o membro já tinha esse código salvo em algum lugar, ele vai precisar do novo.`,
      )
    ) {
      return;
    }
    regenerateMutation.mutate();
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <code>{visible ? code : '••••••'}</code>
      <button
        type="button"
        className="icon-btn"
        title={visible ? 'Ocultar código' : 'Mostrar código'}
        aria-label={visible ? 'Ocultar código' : 'Mostrar código'}
        onClick={() => setVisible((v) => !v)}
      >
        <EyeIcon open={visible} />
      </button>
      {visible && <CopyCodeButton code={code} />}
      <button type="button" onClick={handleRegenerate} disabled={regenerateMutation.isPending}>
        Gerar novo
      </button>
    </span>
  );
}

function CharacterRow({
  character,
  allPrincipals,
  currencyAbbr,
}: {
  character: Character;
  allPrincipals: Character[];
  currencyAbbr: string;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(character.status);
  const [level, setLevel] = useState(character.level ?? '');
  const [linkedPrincipalId, setLinkedPrincipalId] = useState(character.linkedPrincipalId ?? '');
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>(character.membershipStatus);
  const [discordId, setDiscordId] = useState(character.discordId ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      updateCharacter(character.id, {
        status,
        level: status === 'PRINCIPAL' && level !== '' ? Number(level) : null,
        linkedPrincipalId: status === 'ALT' && linkedPrincipalId ? linkedPrincipalId : null,
        membershipStatus,
        discordId: discordId.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
    },
  });

  const dirty =
    status !== character.status ||
    String(level) !== String(character.level ?? '') ||
    linkedPrincipalId !== (character.linkedPrincipalId ?? '') ||
    membershipStatus !== character.membershipStatus ||
    discordId.trim() !== (character.discordId ?? '');

  const receivesBrc = status === 'PRINCIPAL' && membershipStatus === 'ACTIVE';
  const missingLink = status === 'ALT' && !linkedPrincipalId;

  return (
    <>
      <tr>
        <td>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
            title={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </td>
        <td>
          {character.gameName}
          {missingLink && (
            <span className="badge badge-no" style={{ marginLeft: 6 }}>
              sem vínculo
            </span>
          )}
        </td>
        <td>
          <select value={status} onChange={(e) => setStatus(e.target.value as Character['status'])}>
            <option value="PRINCIPAL">Principal</option>
            <option value="ALT">Alt</option>
            <option value="ALT_ONLY">AltOnly</option>
          </select>
        </td>
        <td>
          {status === 'PRINCIPAL' ? (
            <input
              type="number"
              min={1}
              value={level}
              onChange={(e) => setLevel(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width: 70 }}
            />
          ) : (
            '-'
          )}
        </td>
        <td>
          <select value={membershipStatus} onChange={(e) => setMembershipStatus(e.target.value as MembershipStatus)}>
            <option value="ACTIVE">Ativo na Guild</option>
            <option value="UNKNOWN">Desconhecido</option>
            <option value="LEFT">Saiu</option>
          </select>
        </td>
        <td>{character.balance}</td>
        <td>
          <button type="button" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
            Salvar
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td></td>
          <td colSpan={6}>
            <div className="detail-grid">
              <div>
                <div className="field-label">Recebe {currencyAbbr}</div>
                <span className={receivesBrc ? 'badge badge-yes' : 'badge badge-no'}>
                  {receivesBrc ? `Recebe ${currencyAbbr}` : `Não recebe ${currencyAbbr}`}
                </span>
              </div>
              {status === 'ALT' && (
                <div>
                  <div className="field-label">Principal vinculado</div>
                  <select value={linkedPrincipalId} onChange={(e) => setLinkedPrincipalId(e.target.value)}>
                    <option value="">Selecione o Principal</option>
                    {allPrincipals
                      .filter((p) => p.id !== character.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.gameName}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <div className="field-label">Última vez visto</div>
                {new Date(character.lastSeenAt).toLocaleDateString('pt-BR')}
              </div>
              <div>
                <div className="field-label">Discord ID</div>
                <input
                  value={discordId}
                  onChange={(e) => setDiscordId(e.target.value)}
                  placeholder="Usuário ou ID"
                  style={{ width: 130 }}
                />
              </div>
              <div>
                <div className="field-label">Código de perfil</div>
                {character.profileAccessCode ? (
                  <ProfileCodeCell
                    characterId={character.id}
                    code={character.profileAccessCode}
                    gameName={character.gameName}
                  />
                ) : (
                  '—'
                )}
              </div>
              <div>
                <div className="field-label">Código de leilão</div>
                {character.auctionAccessCode ? (
                  <AuctionCodeCell
                    characterId={character.id}
                    code={character.auctionAccessCode}
                    gameName={character.gameName}
                  />
                ) : (
                  '—'
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function CharactersPage() {
  const charactersQuery = useQuery({ queryKey: ['characters'], queryFn: fetchCharacters });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? 'BRC';

  const principals = useMemo(
    () => (charactersQuery.data ?? []).filter((c) => c.status === 'PRINCIPAL'),
    [charactersQuery.data],
  );

  return (
    <section>
      <h2>Personagens</h2>
      <p className="subtitle">
        A lista vem dos XMLs importados. Marque Principal / Alt / AltOnly e defina o nível de cada Principal.
        "Última vez visto" é só informativo (vem automático do import). O campo "Interação" tem 3 valores:
        personagem novo entra como "Ativo na Guild" por padrão; "Desconhecido" você ou o conselho marcam
        manualmente quando o personagem aparece nos imports mas não interage de verdade com os membros; "Saiu" o
        próprio sistema marca sozinho quando o personagem não consta mais no XML mais recente importado — e volta
        pra "Ativo na Guild" sozinho também, se ele reaparecer num import futuro. Qualquer status diferente de
        "Ativo na Guild" para de receber {currencyAbbr} e de participar de leilões novos. O Saldo continua visível
        mesmo depois que o personagem sai, pra consulta histórica. O "Código de perfil" (12 caracteres, gerado
        automaticamente pra todo Principal) dá acesso à tela pública de perfil — compartilhe manualmente com o
        membro (Discord etc.); lá ele informa o próprio ID do Discord, troca o avatar, e edita o próprio nível
        (aplica na hora, sem aprovação). O "Código de leilão" (formato curto, fixo por personagem desde 2026-08-14)
        dá acesso a qualquer leilão em que ele for marcado como participante — não muda a cada leilão novo, o
        próprio membro também consegue ver ele na tela de perfil. Se algum nível parecer errado, ajuste direto aqui
        na coluna "Nível". Clique na seta pra abrir vínculo de Alt, última vez visto, Discord e os códigos de cada
        personagem.
      </p>

      <TableScroll>
      <table className="data-table">
        <thead>
          <tr>
            <th></th>
            <th>Personagem</th>
            <th>Status</th>
            <th>Nível</th>
            <th>Interação</th>
            <th>Saldo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {charactersQuery.data?.map((character) => (
            <CharacterRow key={character.id} character={character} allPrincipals={principals} currencyAbbr={currencyAbbr} />
          ))}
        </tbody>
      </table>
      </TableScroll>
    </section>
  );
}
