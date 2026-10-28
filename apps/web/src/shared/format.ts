export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

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
