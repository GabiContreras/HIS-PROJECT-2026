export const MAX_AGE_YEARS = 115;

export type BirthDateError = 'FUTURE' | 'TOO_OLD';

// Fechas en formato YYYY-MM-DD: se pueden comparar como texto.
// Con 115 años cumplidos todavía se admite; el día que cumpliría 116 ya no.
export function validateBirthDate(
  birth: string,
  today: string,
): BirthDateError | null {
  const oldestBirth = `${Number(today.slice(0, 4)) - (MAX_AGE_YEARS + 1)}${today.slice(4)}`;
  if (birth > today) return 'FUTURE';
  if (birth <= oldestBirth) return 'TOO_OLD';
  return null;
}
