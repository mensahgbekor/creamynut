export const PREPARATION_DAYS = 7;

export function estimatedDispatchDate(createdAt: string): string {
  const date = new Date(createdAt);
  date.setUTCDate(date.getUTCDate() + PREPARATION_DAYS);
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Accra' });
}
