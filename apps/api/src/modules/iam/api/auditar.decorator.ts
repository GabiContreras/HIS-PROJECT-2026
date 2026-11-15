import { SetMetadata } from '@nestjs/common';

export const AUDITAR_KEY = 'auditar';

export interface AuditarMetadata {
  accion: string;
  recurso: string;
  pacienteParam?: string;
}

export const Auditar = (
  accion: string,
  recurso: string,
  pacienteParam?: string,
): MethodDecorator & ClassDecorator =>
  SetMetadata<string, AuditarMetadata>(AUDITAR_KEY, {
    accion,
    recurso,
    pacienteParam,
  });