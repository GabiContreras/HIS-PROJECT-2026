import { Matches } from 'class-validator';

const MEDIA_HORA = /^([01]\d|2[0-3]):(00|30)$/;

/** Jornada laboral del médico, en bloques de 30 min, dentro de 08:00–20:00. */
export class HorarioMedicoDto {
  @Matches(MEDIA_HORA, { message: 'horaInicio debe ser HH:00 o HH:30.' })
  horaInicio: string;

  @Matches(MEDIA_HORA, { message: 'horaFin debe ser HH:00 o HH:30.' })
  horaFin: string;
}
