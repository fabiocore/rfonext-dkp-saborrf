/** Avatar padrão — silhueta genérica, usado sempre que o personagem ainda não definiu um avatar próprio. */
export function DefaultAvatar({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="var(--bg-elevated-2)" />
      <circle cx="32" cy="25" r="12" fill="var(--border)" />
      <path d="M8 60c2-14 12-22 24-22s22 8 24 22" fill="var(--border)" />
    </svg>
  );
}
