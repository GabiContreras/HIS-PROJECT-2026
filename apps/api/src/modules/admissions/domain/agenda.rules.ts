export interface BloqueAgenda {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

const CLINIC_OPEN_MINUTES = 8 * 60;
const CLINIC_CLOSE_MINUTES = 20 * 60;

export function minutosDe(hora: string): number {
  const [hour, minute] = hora.split(':').map(Number);
  return hour * 60 + minute;
}

export function diaSemanaDe(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

export function entraEnAgenda(params: {
  bloques: BloqueAgenda[];
  horaInicioDefault: string;
  horaFinDefault: string;
  fecha: string;
  minutoInicio: number;
  duracion: number;
  fechasBloqueadas: ReadonlySet<string>;
}): boolean {
  if (params.fechasBloqueadas.has(params.fecha)) return false;
  const fin = params.minutoInicio + params.duracion;
  if (params.bloques.length === 0) {
    return (
      params.minutoInicio >= minutosDe(params.horaInicioDefault) &&
      fin <= minutosDe(params.horaFinDefault)
    );
  }
  const dia = diaSemanaDe(params.fecha);
  return params.bloques.some(
    (bloque) =>
      bloque.diaSemana === dia &&
      params.minutoInicio >= minutosDe(bloque.horaInicio) &&
      fin <= minutosDe(bloque.horaFin),
  );
}

export function validarBloques(bloques: BloqueAgenda[]): string | null {
  for (const bloque of bloques) {
    const inicio = minutosDe(bloque.horaInicio);
    const fin = minutosDe(bloque.horaFin);
    if (inicio < CLINIC_OPEN_MINUTES || fin > CLINIC_CLOSE_MINUTES) {
      return 'Los bloques deben estar dentro del horario de la clínica (08:00 a 20:00).';
    }
    if (inicio >= fin) {
      return 'La hora de inicio debe ser anterior a la hora de fin.';
    }
  }
  for (let dia = 0; dia < 7; dia += 1) {
    const delDia = bloques
      .filter((bloque) => bloque.diaSemana === dia)
      .map((bloque) => [minutosDe(bloque.horaInicio), minutosDe(bloque.horaFin)])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < delDia.length; i += 1) {
      if (delDia[i][0] < delDia[i - 1][1]) {
        return 'Los bloques de un mismo día no pueden superponerse.';
      }
    }
  }
  return null;
}