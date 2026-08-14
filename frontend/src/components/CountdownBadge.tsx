import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

function msRemaining(target: Date): number {
  return Math.max(0, target.getTime() - Date.now());
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Countdown ao vivo (atualiza a cada segundo) até um instante específico —
 * usado 1 por card (evento ou leilão), cada um com seu próprio horário e
 * seu próprio `setInterval`, sem estado compartilhado entre eles.
 * `label`/`nowLabel` deixam o texto configurável — "Começa em" pra eventos
 * futuros, "Encerra em" pra leilões em andamento, por exemplo. `tone`
 * troca a cor (roxo padrão vs. dourado, usado nos cards de leilão pra
 * diferenciar visualmente de "Próximos Eventos").
 */
export function CountdownBadge({
  target,
  label,
  nowLabel,
  tone = 'accent',
}: {
  target: Date;
  label?: string;
  nowLabel?: string;
  tone?: 'accent' | 'gold';
}) {
  const { t } = useTranslation();
  const targetMs = target.getTime();
  const [remaining, setRemaining] = useState(() => msRemaining(target));

  useEffect(() => {
    setRemaining(msRemaining(target));
    const id = setInterval(() => setRemaining(msRemaining(target)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMs]);

  const toneClass = tone === 'gold' ? ' countdown-badge-gold' : '';

  if (remaining <= 0) {
    return (
      <div className="countdown-badge countdown-badge-now">
        <span className="countdown-badge-value">{nowLabel ?? t('home.countdownNow')}</span>
      </div>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className={`countdown-badge${toneClass}`}>
      <span className="countdown-badge-label">{label ?? t('home.countdownLabel')}</span>
      <span className="countdown-badge-value">
        {days > 0 && `${days}${t('home.countdownDaysAbbr')} `}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}
