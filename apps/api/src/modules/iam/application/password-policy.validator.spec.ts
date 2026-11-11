import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAdminDto } from '../api/dto/create-admin.dto.js';
import { PasswordPolicyValidator } from './password-policy.validator.js';

describe('PasswordPolicyValidator', () => {
  const validator = new PasswordPolicyValidator();

  it('acepta una contraseña que cumple todas las reglas', () => {
    expect(validator.validate('ClaveSegura135')).toBe(true);
    expect(validator.validate('Hospital2468!')).toBe(true);
  });

  it.each([
    ['no es un texto', 12345678],
    ['es null', null],
    ['es undefined', undefined],
  ])('rechaza cuando %s', (_caso, valor) => {
    expect(validator.validate(valor)).toBe(false);
  });

  it('rechaza menos de 8 caracteres', () => {
    expect(validator.validate('Clave13')).toBe(false);
    expect(validator.validate('Clave135')).toBe(true); // 8 exactos
  });

  it('rechaza si falta una mayúscula', () => {
    expect(validator.validate('clavesegura135')).toBe(false);
  });

  it('rechaza si falta un número', () => {
    expect(validator.validate('ClaveSegura')).toBe(false);
  });

  it.each([
    ['ascendentes', 'ClaveSegura12'],
    ['descendentes', 'ClaveSegura21'],
    ['ascendentes en el medio', 'Clave45Segura'],
    ['una secuencia larga', 'Clave123456'],
  ])('rechaza dígitos consecutivos %s', (_caso, password) => {
    expect(validator.validate(password)).toBe(false);
  });

  it('acepta dígitos repetidos o no contiguos en valor', () => {
    expect(validator.validate('ClaveSegura11')).toBe(true);
    expect(validator.validate('ClaveSegura13')).toBe(true);
    expect(validator.validate('Clave1Segura2')).toBe(true); // 1 y 2 no están juntos
  });

  it('informa la política completa en el mensaje', () => {
    expect(validator.defaultMessage({} as never)).toBe(
      'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y no contener números consecutivos.',
    );
  });

  it('se aplica en los DTO que reciben contraseñas', async () => {
    const base = { nombre: 'María', apellido: 'González', email: 'maria@ejemplo.com' };
    const invalida = await validate(plainToInstance(CreateAdminDto, { ...base, password: 'ClaveSegura123' }));
    const valida = await validate(plainToInstance(CreateAdminDto, { ...base, password: 'ClaveSegura135' }));
    expect(invalida.map((e) => e.property)).toEqual(['password']);
    expect(valida).toHaveLength(0);
  });
});
