import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function EnterCodePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    navigate(`/oferta/${trimmed}`);
  }

  return (
    <section>
      <h1>{t('codeEntry.title')}</h1>
      <p className="subtitle">{t('codeEntry.subtitle')}</p>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t('codeEntry.placeholder') as string}
          autoFocus
          style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
        />
        <button type="submit" disabled={!code.trim()}>
          {t('codeEntry.submit')}
        </button>
      </form>
    </section>
  );
}
