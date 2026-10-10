import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'passwordPolicy', async: false })
export class PasswordPolicyValidator implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length < 8) return false;
    if (!/[A-Z]/.test(value) || !/[0-9]/.test(value)) return false;

    for (let index = 1; index < value.length; index += 1) {
      const previous = Number(value[index - 1]);
      const current = Number(value[index]);
      if (
        Number.isInteger(previous) &&
        Number.isInteger(current) &&
        Math.abs(previous - current) === 1
      ) {
        return false;
      }
    }
    return true;
  }

  defaultMessage(_arguments: ValidationArguments): string {
    return 'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y no contener números consecutivos.';
  }
}
