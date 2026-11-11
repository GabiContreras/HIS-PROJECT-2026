export const MAX_AGE_YEARS = 115;

export type BirthDateError = 'FUTURE' | 'TOO_OLD';

export function validateBirthDate(
  birth: string,
  today: string,
): BirthDateError | null {
  const oldestBirth = `${Number(today.slice(0, 4)) - (MAX_AGE_YEARS + 1)}${today.slice(4)}`;
  if (birth > today) return 'FUTURE';
  if (birth <= oldestBirth) return 'TOO_OLD';
  return null;
}
