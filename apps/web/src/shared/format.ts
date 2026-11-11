export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

export function displayName(apiName: string): string {
  const at = apiName.indexOf(', ');
  return at === -1 ? apiName : `${apiName.slice(at + 2)} ${apiName.slice(0, at)}`;
}

export const formatDate = (isoDate: string): string =>
  new Date(`${isoDate.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const isToday = (iso: string): boolean => new Date(iso).toDateString() === new Date().toDateString();

export const formatMoney = (amount: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

export const minutesSince = (iso: string): number => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

export function greeting(name: string | undefined): string {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  return name ? `${salutation}, ${name}` : salutation;
}

export function longDate(): string {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export const formatDocument = (documento: string): string =>
  /^\d+$/.test(documento) ? Number(documento).toLocaleString('es-AR') : documento;
