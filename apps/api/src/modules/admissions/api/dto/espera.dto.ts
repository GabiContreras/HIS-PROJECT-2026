import { IsOptional, IsUUID, Matches } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class AgregarEsperaDto {
  @IsUUID()
  medicoId: string;

  @IsUUID()
  pacienteId: string;

  /** Día de la clínica (AAAA-MM-DD) para el que espera un horario. */
  @Matches(FECHA, { message: 'fecha debe tener el formato AAAA-MM-DD.' })
  fecha: string;
}

export class EsperaFiltroDto {
  @IsOptional()
  @IsUUID()
  medicoId?: string;

  @IsOptional()
  @Matches(FECHA, { message: 'fecha debe tener el formato AAAA-MM-DD.' })
  fecha?: string;
}
