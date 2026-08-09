/** Bandeiras simplificadas (sem brasão/estrelas), só pra identificar o idioma no seletor com menos largura que o texto "PT/EN/ES". */
export function FlagIcon({ country }: { country: 'BR' | 'US' | 'ES' }) {
  if (country === 'BR') {
    return (
      <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
        <rect width="20" height="14" rx="2" fill="#1a7a3c" />
        <polygon points="10,2 18,7 10,12 2,7" fill="#f7d117" />
        <circle cx="10" cy="7" r="3" fill="#1c3f94" />
      </svg>
    );
  }
  if (country === 'US') {
    return (
      <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
        <rect width="20" height="14" rx="2" fill="#fff" />
        <g fill="#c8102e">
          <rect y="0" width="20" height="1.55" />
          <rect y="3.1" width="20" height="1.55" />
          <rect y="6.2" width="20" height="1.55" />
          <rect y="9.3" width="20" height="1.55" />
          <rect y="12.4" width="20" height="1.6" />
        </g>
        <rect width="9" height="7.75" fill="#1c3f94" />
      </svg>
    );
  }
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
      <rect width="20" height="14" rx="2" fill="#aa151b" />
      <rect y="3.5" width="20" height="7" fill="#f1bf00" />
    </svg>
  );
}
