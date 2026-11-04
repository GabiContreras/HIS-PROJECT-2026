export const MIN_BIRTH_DATE = '1900-01-01';

export type BirthDateError = 'FUTURE' | 'TOO_OLD';

// Fechas en formato YYYY-MM-DD: se pueden comparar como texto.
export function validateBirthDate(
  birth: string,
  today: string,
): BirthDateError | null {
  if (birth > today) return 'FUTURE';
  if (birth < MIN_BIRTH_DATE) return 'TOO_OLD';
  return null;
}
