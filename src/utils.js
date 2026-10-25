// Display helpers only. Business rules (tax, fees, windows) come from GET /api/config, never hard-coded here.
export const formatPrice = (n, currency = 'USD') =>
  n.toLocaleString('en-US', { style: 'currency', currency });

// Times are stored in UTC and always shown in the airport's own timezone.
export const formatTime = (iso, timeZone) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(iso));

export const formatDate = (iso, timeZone) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone }).format(new Date(iso));

export function formatDuration(fromIso, toIso) {
  const mins = Math.round((new Date(toIso) - new Date(fromIso)) / 60000);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

// YYYY-MM-DD for <input type="date">, from the browser's local calendar.
export const toDateInput = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
