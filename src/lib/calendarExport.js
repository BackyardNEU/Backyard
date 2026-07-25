function toCalendarDate(isoString) {
  return new Date(isoString)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapeIcs(text) {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

export function buildGoogleCalendarUrl(event) {
  const title = event.club_name || 'Club Event';
  const details = event.event_description || '';
  const start = toCalendarDate(event.start_time);
  const end = toCalendarDate(event.end_time);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcsFile(event) {
  const title = event.club_name || 'Club Event';
  const description = event.event_description || '';
  const start = toCalendarDate(event.start_time);
  const end = toCalendarDate(event.end_time);
  const uid = `${event.id || Date.now()}@backyard.app`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Backyard//Club Events//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `UID:${uid}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'event.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
