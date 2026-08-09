import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCharacters,
  fetchGuildSettings,
  regenerateProfileCode,
  updateCharacter,
  type Character,
  type MembershipStatus,
} from '../../api/client';
import { EyeIcon } from '../../components/EyeIcon';

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

  return (
    <tr>
      <td>{character.gameName}</td>
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
        {status === 'ALT' ? (
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
        ) : (
          '-'
        )}
      </td>
      <td>{new Date(character.lastSeenAt).toLocaleDateString('pt-BR')}</td>
      <td>
        <select value={membershipStatus} onChange={(e) => setMembershipStatus(e.target.value as MembershipStatus)}>
          <option value="ACTIVE">Ativo na Guild</option>
          <option value="UNKNOWN">Desconhecido</option>
          <option value="LEFT">Saiu</option>
        </select>
      </td>
      <td>
        <span className={receivesBrc ? 'badge badge-yes' : 'badge badge-no'}>
          {receivesBrc ? `Recebe ${currencyAbbr}` : `Não recebe ${currencyAbbr}`}
        </span>
      </td>
      <td>{character.balance}</td>
      <td>
        <input
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          placeholder="Usuário ou ID"
          style={{ width: 130 }}
        />
      </td>
      <td>
        {character.profileAccessCode ? (
          <ProfileCodeCell characterId={character.id} code={character.profileAccessCode} gameName={character.gameName} />
        ) : (
          '—'
        )}
      </td>
      <td>
        <button type="button" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
          Salvar
        </button>
      </td>
    </tr>
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
        (aplica na hora, sem aprovação). Se algum nível parecer errado, ajuste direto aqui na coluna "Nível".
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>Personagem</th>
            <th>Status</th>
            <th>Nível</th>
            <th>Principal vinculado</th>
            <th>Última vez visto</th>
            <th>Interação</th>
            <th>{currencyAbbr}</th>
            <th>Saldo</th>
            <th>Discord ID</th>
            <th>Código de perfil</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {charactersQuery.data?.map((character) => (
            <CharacterRow key={character.id} character={character} allPrincipals={principals} currencyAbbr={currencyAbbr} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
