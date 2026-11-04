
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearPacienteDto } from './crear-paciente.dto.js';

describe('CrearPacienteDto', () => {
  it('acepta los datos válidos de un paciente', async () => {
    const dto = plainToInstance(CrearPacienteDto, {
      nombre: 'Ada',
      apellido: 'Lovelace',
      documento: '12345678',
      fechaNacimiento: '1990-12-10',
      telefono: '1112345678',
    });

    const errores = await validate(dto);

    expect(errores).toHaveLength(0);
  });

  it('rechaza un nombre compuesto solo por espacios', async () => {
    const dto = plainToInstance(CrearPacienteDto, {
      nombre: '   ',
      apellido: 'Lovelace',
      documento: '12345678',
      fechaNacimiento: '1990-12-10',
    });

    const errores = await validate(dto);

    expect(errores.some((error) => error.property === 'nombre')).toBe(true);
  });

  it('rechaza un apellido compuesto solo por espacios', async () => {
    const dto = plainToInstance(CrearPacienteDto, {
      nombre: 'Ada',
      apellido: '   ',
      documento: '12345678',
      fechaNacimiento: '1990-12-10',
    });

    const errores = await validate(dto);

    expect(errores.some((error) => error.property === 'apellido')).toBe(true);
  });

  it('rechaza un documento con espacios al principio o al final', async () => {
    const dto = plainToInstance(CrearPacienteDto, {
      nombre: 'Ada',
      apellido: 'Lovelace',
      documento: ' 12345678 ',
      fechaNacimiento: '1990-12-10',
    });

    const errores = await validate(dto);

    expect(errores.some((error) => error.property === 'documento')).toBe(true);
  });

  it('rechaza un nombre de más de 100 caracteres', async () => {
    const dto = plainToInstance(CrearPacienteDto, {
      nombre: 'A'.repeat(101),
      apellido: 'Lovelace',
      documento: '12345678',
      fechaNacimiento: '1990-12-10',
    });

    const errores = await validate(dto);

    expect(errores.some((error) => error.property === 'nombre')).toBe(true);
  });

 it('rechaza una fecha de nacimiento futura', async () => {
  const fechaFutura = new Date();
  fechaFutura.setDate(fechaFutura.getDate() + 10);

  const dto = plainToInstance(CrearPacienteDto, {
    nombre: 'Ada',
    apellido: 'Lovelace',
    documento: '12345678',
    fechaNacimiento: fechaFutura.toISOString().slice(0, 10),
  });

  const errores = await validate(dto);

  expect(
    errores.some((error) => error.property === 'fechaNacimiento'),
  ).toBe(true);
 });

  it('rechaza una fecha de nacimiento inexistente', async () => {
    const dto = plainToInstance(CrearPacienteDto, {
      nombre: 'Ada',
      apellido: 'Lovelace',
      documento: '12345678',
      fechaNacimiento: '2024-02-30',
    });

    const errores = await validate(dto);

    expect(
      errores.some((error) => error.property === 'fechaNacimiento'),
    ).toBe(true);
  });

});
