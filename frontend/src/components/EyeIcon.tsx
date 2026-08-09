import { useId } from 'react';

/** Ícone de olho (visível) / olho riscado (oculto), pra alternar mascaramento de valores sensíveis. */
export function EyeIcon({ open }: { open: boolean }) {
  const maskId = useId();
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="24" height="24" fill="white" />
            <circle cx="12" cy="12" r="3" fill="black" />
          </mask>
        </defs>
        <path
          d="M2 12C4 7 8 4 12 4s8 3 10 8c-2 5-6 8-10 8s-8-3-10-8Z"
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <circle cx="12" cy="12" r="3" fill="black" />
        </mask>
      </defs>
      <path
        d="M2 12C4 7 8 4 12 4s8 3 10 8c-2 5-6 8-10 8s-8-3-10-8Z"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
      <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
