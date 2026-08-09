import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  fetchAvatarPresets,
  fetchProfile,
  selectAvatarPreset,
  submitLevelChangeRequest,
  updateProfileAvatar,
  updateProfileDiscordId,
} from '../api/client';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { DefaultAvatar } from '../components/DefaultAvatar';

const LEVEL_STATUS_LABEL_KEY: Record<string, string> = {
  PENDING: 'profile.levelStatusPending',
  APPROVED: 'profile.levelStatusApproved',
  REJECTED: 'profile.levelStatusRejected',
};

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', code],
    queryFn: () => fetchProfile(code!),
    enabled: !!code,
  });

  const [discordId, setDiscordId] = useState('');
  const [discordError, setDiscordError] = useState<string | null>(null);
  const [discordSuccess, setDiscordSuccess] = useState(false);

  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [requestedLevel, setRequestedLevel] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [levelError, setLevelError] = useState<string | null>(null);
  const [levelSuccess, setLevelSuccess] = useState(false);
  const [levelAutoApproved, setLevelAutoApproved] = useState(false);

  const discordMutation = useMutation({
    mutationFn: () => updateProfileDiscordId(code!, discordId.trim()),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', code], data);
      setDiscordError(null);
      setDiscordSuccess(true);
      setTimeout(() => setDiscordSuccess(false), 3000);
    },
    onError: (err: any) => setDiscordError(err?.response?.data?.message ?? (t('profile.discordError') as string)),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => updateProfileAvatar(code!, file),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', code], data);
      setAvatarError(null);
    },
    onError: (err: any) => setAvatarError(err?.response?.data?.message ?? (t('profile.avatarError') as string)),
  });

  const avatarPresetsQuery = useQuery({ queryKey: ['avatar-presets'], queryFn: fetchAvatarPresets });

  const avatarPresetMutation = useMutation({
    mutationFn: (presetKey: string) => selectAvatarPreset(code!, presetKey),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', code], data);
      setAvatarError(null);
    },
    onError: (err: any) => setAvatarError(err?.response?.data?.message ?? (t('profile.avatarError') as string)),
  });

  const levelMutation = useMutation({
    mutationFn: () => submitLevelChangeRequest(code!, Number(requestedLevel), proofFile!),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', code], data);
      setRequestedLevel('');
      setProofFile(null);
      setLevelError(null);
      setLevelAutoApproved(data.levelChangeRequests[0]?.status === 'APPROVED');
      setLevelSuccess(true);
      setTimeout(() => setLevelSuccess(false), 4000);
    },
    onError: (err: any) => setLevelError(err?.response?.data?.message ?? (t('profile.levelError') as string)),
  });

  if (profileQuery.isLoading) return <div className="app-shell">{t('profile.loading')}</div>;
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <Link to="/" className="guild-name" style={{ textDecoration: 'none', color: 'inherit' }}>
            {t('profile.backHome')}
          </Link>
          <LanguageSwitcher />
        </header>
        <p className="form-error">{t('profile.invalidCode')}</p>
      </div>
    );
  }

  const { character, levelChangeRequests } = profileQuery.data;
  const pendingRequest = levelChangeRequests.find((r) => r.status === 'PENDING');

  function handleDiscordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDiscordError(null);
    discordMutation.mutate();
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    avatarMutation.mutate(file);
  }

  function handleLevelSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLevelError(null);
    if (!requestedLevel || !proofFile) return;
    levelMutation.mutate();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="guild-name">{character.gameName}</span>
        <LanguageSwitcher />
      </header>
      <p>
        <Link to="/">{t('profile.backHome')}</Link>
      </p>
      <main>
        <section>
          <h2>{t('profile.avatarTitle')}</h2>
          {character.avatarUrl ? (
            <img
              src={character.avatarUrl}
              alt={character.gameName}
              style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <DefaultAvatar size={96} />
          )}
          {avatarPresetsQuery.data && avatarPresetsQuery.data.length > 0 && (
            <>
              <p className="subtitle" style={{ marginTop: 12 }}>
                {t('profile.avatarPresetsSubtitle')}
              </p>
              <div className="avatar-preset-grid">
                {avatarPresetsQuery.data.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={`avatar-preset-btn${character.avatarUrl === preset.url ? ' selected' : ''}`}
                    disabled={avatarPresetMutation.isPending}
                    onClick={() => avatarPresetMutation.mutate(preset.key)}
                    aria-label={t('profile.avatarPresetChoose')}
                  >
                    <img src={preset.url} alt="" width={56} height={56} />
                  </button>
                ))}
              </div>
            </>
          )}
          <label className="inline-form" style={{ marginTop: 12 }}>
            <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={avatarMutation.isPending} />
          </label>
          {(avatarMutation.isPending || avatarPresetMutation.isPending) && (
            <p className="subtitle">{t('common.loading')}</p>
          )}
          {avatarError && <p className="form-error">{avatarError}</p>}
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>{t('profile.discordTitle')}</h2>
          <p className="subtitle">{t('profile.discordSubtitle')}</p>
          <form className="inline-form" onSubmit={handleDiscordSubmit}>
            <input
              value={discordId || character.discordId || ''}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder={t('profile.discordPlaceholder') as string}
              required
            />
            <button type="submit" disabled={discordMutation.isPending}>
              {t('profile.discordSave')}
            </button>
          </form>
          {discordError && <p className="form-error">{discordError}</p>}
          {discordSuccess && <p className="form-success">{t('profile.discordSaved')}</p>}
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>{t('profile.levelTitle')}</h2>
          <p>
            {character.level ? t('profile.levelCurrent', { level: character.level }) : t('profile.levelNoLevel')}
          </p>

          {levelSuccess && (
            <p className="form-success">
              {t(levelAutoApproved ? 'profile.levelAutoApproved' : 'profile.levelSubmitted')}
            </p>
          )}

          {pendingRequest ? (
            <p className="subtitle">
              {t('profile.levelPending', {
                level: pendingRequest.requestedLevel,
                date: new Date(pendingRequest.createdAt).toLocaleDateString(i18n.language),
              })}
            </p>
          ) : (
            <>
              <p className="subtitle">{t('profile.levelSubtitle')}</p>
              <form className="settings-form" onSubmit={handleLevelSubmit}>
                <label>
                  {t('profile.levelNewValue')}
                  <input
                    type="number"
                    min={1}
                    value={requestedLevel}
                    onChange={(e) => setRequestedLevel(e.target.value)}
                    style={{ width: 90 }}
                    required
                  />
                </label>
                <label>
                  {t('profile.levelProof')}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    required
                  />
                </label>
                {levelError && <p className="form-error">{levelError}</p>}
                <button type="submit" disabled={levelMutation.isPending || !requestedLevel || !proofFile}>
                  {t('profile.levelSubmit')}
                </button>
              </form>
            </>
          )}

          {levelChangeRequests.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>{t('profile.levelHistoryTitle')}</h3>
              <table className="data-table">
                <tbody>
                  {levelChangeRequests.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.createdAt).toLocaleDateString(i18n.language)}</td>
                      <td>{r.requestedLevel}</td>
                      <td>
                        {t(LEVEL_STATUS_LABEL_KEY[r.status], { reason: r.rejectReason })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
