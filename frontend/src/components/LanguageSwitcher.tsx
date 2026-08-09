import { useTranslation } from 'react-i18next';
import { FlagIcon } from './FlagIcon';

const LANGUAGES: { code: string; country: 'BR' | 'US' | 'ES'; label: string }[] = [
  { code: 'pt-BR', country: 'BR', label: 'Português' },
  { code: 'en', country: 'US', label: 'English' },
  { code: 'es', country: 'ES', label: 'Español' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="language-switcher">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          className={i18n.resolvedLanguage === lang.code ? 'active' : ''}
          onClick={() => i18n.changeLanguage(lang.code)}
          title={lang.label}
          aria-label={lang.label}
        >
          <FlagIcon country={lang.country} />
        </button>
      ))}
    </div>
  );
}
