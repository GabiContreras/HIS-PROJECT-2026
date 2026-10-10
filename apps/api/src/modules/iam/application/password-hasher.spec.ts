import { PasswordHasher } from './password-hasher.js';
import { PasswordPolicyValidator } from './password-policy.validator.js';

describe('PasswordHasher', () => {
  it('hashes passwords and verifies only the matching value', async () => {
    const hasher = new PasswordHasher();
    const hash = await hasher.hash('CorrectHorse4');

    expect(hash).not.toContain('CorrectHorse4');
    await expect(hasher.verify('CorrectHorse4', hash)).resolves.toBe(true);
    await expect(hasher.verify('WrongHorse4', hash)).resolves.toBe(false);
  });
});

describe('PasswordPolicyValidator', () => {
  const validator = new PasswordPolicyValidator();

  it('requires eight characters, uppercase and a digit without sequential digits', () => {
    expect(validator.validate('CorrectHorse4')).toBe(true);
    expect(validator.validate('short4')).toBe(false);
    expect(validator.validate('lowercase4')).toBe(false);
    expect(validator.validate('Uppercase')).toBe(false);
    expect(validator.validate('Abcdefg12')).toBe(false);
    expect(validator.validate('Abcdefg54')).toBe(false);
  });
});
