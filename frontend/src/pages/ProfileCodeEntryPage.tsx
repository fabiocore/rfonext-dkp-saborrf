import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function ProfileCodeEntryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    navigate(`/perfil/${trimmed}`);
  }

  return (
    <section>
      <h1>{t('profileEntry.title')}</h1>
      <p className="subtitle">{t('profileEntry.subtitle')}</p>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('profileEntry.placeholder') as string}
          autoFocus
          style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
        />
        <button type="submit" disabled={!code.trim()}>
          {t('profileEntry.submit')}
        </button>
      </form>
    </section>
  );
}
