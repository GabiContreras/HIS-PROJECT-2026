export interface VitalSign {
  id: string;
  pacienteId: string;
  paciente: string;
  sistolica: number;
  diastolica: number;
  frecuenciaCardiaca: number;
  temperatura: number;
  fechaHora: string; // ISO
  registradoPor: string;
  critico: boolean;
  nota: string;
}

export type VitalSignInput = Pick<
  VitalSign,
  'pacienteId' | 'paciente' | 'sistolica' | 'diastolica' | 'frecuenciaCardiaca' | 'temperatura'
>;

/** Por encima de esta temperatura se destaca en rojo y se avisa al médico de guardia. */
export const CRITICAL_TEMPERATURE = 39;

const NORMAL = {
  sistolica: { label: 'Presión sistólica', min: 90, max: 140, unit: 'mmHg' },
  diastolica: { label: 'Presión diastólica', min: 60, max: 90, unit: 'mmHg' },
  frecuenciaCardiaca: { label: 'Frecuencia cardíaca', min: 50, max: 110, unit: 'lpm' },
  temperatura: { label: 'Temperatura', min: 35, max: 38, unit: '°C' },
} as const;

// Límites fisiológicos: fuera de ellos es casi seguro un error de carga.
const POSSIBLE = {
  sistolica: [50, 260],
  diastolica: [30, 160],
  frecuenciaCardiaca: [20, 250],
  temperatura: [30, 45],
} as const;

type Field = keyof typeof NORMAL;
const FIELDS = Object.keys(NORMAL) as Field[];

export function validateInput(input: VitalSignInput): string[] {
  return FIELDS.flatMap((field) => {
    const [min, max] = POSSIBLE[field];
    const value = input[field];
    return Number.isFinite(value) && value >= min && value <= max
      ? []
      : [`${NORMAL[field].label}: ingresá un valor entre ${min} y ${max} ${NORMAL[field].unit}.`];
  });
}

export function evaluate(input: VitalSignInput): { critico: boolean; fueraDeRango: string[] } {
  const fueraDeRango = FIELDS.filter((f) => input[f] < NORMAL[f].min || input[f] > NORMAL[f].max).map(
    (f) => NORMAL[f].label,
  );
  return { critico: input.temperatura > CRITICAL_TEMPERATURE, fueraDeRango };
}

const minutesAgo = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

// Datos de prueba en memoria mientras no exista el endpoint de signos vitales.
const records: VitalSign[] = [
  { id: '1', pacienteId: 'mock-1', paciente: 'Carlos López', sistolica: 120, diastolica: 80, frecuenciaCardiaca: 76, temperatura: 36.7, fechaHora: minutesAgo(25), registradoPor: 'Martín Torres', critico: false, nota: 'Controles de signos vitales realizados con éxito.' },
  { id: '2', pacienteId: 'mock-2', paciente: 'Ana Rojas', sistolica: 118, diastolica: 76, frecuenciaCardiaca: 82, temperatura: 37.1, fechaHora: minutesAgo(70), registradoPor: 'Martín Torres', critico: false, nota: 'Controles de signos vitales realizados con éxito.' },
];

export async function listVitalSigns(): Promise<VitalSign[]> {
  return records.map((r) => ({ ...r })); // TODO: http.get<VitalSign[]>('/signos-vitales')
}

export async function addVitalSign(input: VitalSignInput, nurse: string): Promise<VitalSign> {
  const problems = validateInput(input);
  if (problems.length > 0) throw new Error(problems.join(' '));
  const { critico, fueraDeRango } = evaluate(input);
  const record: VitalSign = {
    ...input,
    id: crypto.randomUUID(),
    fechaHora: new Date().toISOString(),
    registradoPor: nurse,
    critico,
    nota:
      fueraDeRango.length === 0
        ? 'Controles de signos vitales realizados con éxito.'
        : `Valores fuera de rango: ${fueraDeRango.join(', ')}.`,
  };
  records.unshift(record); // TODO: http.post('/signos-vitales', input)
  return { ...record };
}
