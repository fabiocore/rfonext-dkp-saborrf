import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchGuildSettings, fetchPublicAnnouncements, fetchPublicEvents, type PublicEvent } from '../api/client';
import { nextOccurrenceOf } from '../utils/scheduleTimezone';

interface UpcomingOccurrence {
  event: PublicEvent;
  when: Date;
}

/** Fim da semana atual (domingo 23:59:59.999 no fuso de quem está vendo) — se hoje já é domingo, o "fim da semana" é hoje mesmo. */
function endOfWeek(from: Date): Date {
  const end = new Date(from);
  const daysUntilSunday = (7 - end.getDay()) % 7; // getDay(): 0=domingo..6=sábado
  end.setDate(end.getDate() + daysUntilSunday);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getUpcomingOccurrences(events: PublicEvent[]): UpcomingOccurrence[] {
  const now = new Date();
  const horizon = endOfWeek(now);
  const occurrences: UpcomingOccurrence[] = [];

  for (const event of events) {
    if (event.scheduleType === 'ONE_TIME' && event.scheduleOneTimeAt) {
      const when = new Date(event.scheduleOneTimeAt);
      if (when >= now && when <= horizon) occurrences.push({ event, when });
    } else if (event.scheduleType === 'RECURRING' && event.scheduleTimeUtcMinutes !== null) {
      for (const weekdayUtc of event.scheduleWeekdaysUtc) {
        const when = nextOccurrenceOf(weekdayUtc, event.scheduleTimeUtcMinutes, now);
        if (when <= horizon) occurrences.push({ event, when });
      }
    }
  }

  return occurrences.sort((a, b) => a.when.getTime() - b.when.getTime());
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const announcementsQuery = useQuery({ queryKey: ['public-announcements'], queryFn: fetchPublicAnnouncements });
  const eventsQuery = useQuery({ queryKey: ['public-events'], queryFn: fetchPublicEvents });
  const settingsQuery = useQuery({ queryKey: ['guild-settings'], queryFn: fetchGuildSettings });
  const currencyAbbr = settingsQuery.data?.currencyAbbr ?? '';

  const upcoming = useMemo(() => getUpcomingOccurrences(eventsQuery.data ?? []), [eventsQuery.data]);

  return (
    <section>
      {settingsQuery.data?.pinnedAnnouncementText && (
        <div className="pinned-announcement">
          <strong>{t('home.pinnedTitle')}</strong>
          <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{settingsQuery.data.pinnedAnnouncementText}</p>
        </div>
      )}

      <h1>{t('home.announcementsTitle')}</h1>

      {announcementsQuery.data?.length === 0 && <p>{t('home.noAnnouncements')}</p>}

      {announcementsQuery.data?.map((a) => (
        <div key={a.id} className="auction-item-card">
          <h3>{a.title}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            {new Date(a.createdAt).toLocaleDateString()}
          </p>
        </div>
      ))}

      <h2 style={{ marginTop: 28 }}>{t('home.upcomingTitle')}</h2>

      {upcoming.length === 0 && <p>{t('home.noUpcoming')}</p>}

      {upcoming.map(({ event, when }, index) => (
        <div key={`${event.id}-${index}`} className="auction-item-card">
          {event.imageUrl && (
            <img src={event.imageUrl} alt={event.name} style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8 }} />
          )}
          <h3>{event.name}</h3>
          <p>
            {when.toLocaleDateString(i18n.language, { weekday: 'long', day: '2-digit', month: '2-digit' })} —{' '}
            {when.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p>
            <strong>{t('common.amount', { amount: event.brcValue, currencyAbbr })}</strong>
          </p>
        </div>
      ))}
    </section>
  );
}
