import { useId } from 'react';

export function GearIcon() {
  const maskId = useId();
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <circle cx="12" cy="12" r="3.2" fill="black" />
        </mask>
      </defs>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        <circle cx="12" cy="12" r="8" />
        <rect x="10.5" y="0.5" width="3" height="5" rx="1" />
        <rect x="10.5" y="18.5" width="3" height="5" rx="1" />
        <rect x="0.5" y="10.5" width="5" height="3" rx="1" />
        <rect x="18.5" y="10.5" width="5" height="3" rx="1" />
        <rect x="10.5" y="0.5" width="3" height="5" rx="1" transform="rotate(45 12 12)" />
        <rect x="10.5" y="0.5" width="3" height="5" rx="1" transform="rotate(135 12 12)" />
        <rect x="10.5" y="0.5" width="3" height="5" rx="1" transform="rotate(225 12 12)" />
        <rect x="10.5" y="0.5" width="3" height="5" rx="1" transform="rotate(315 12 12)" />
      </g>
    </svg>
  );
}
