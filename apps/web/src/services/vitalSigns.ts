import { displayName } from '../shared/format';
import { http } from '../shared/http';

export interface VitalSign {
  id: string;
  pacienteId: string;
  paciente: string;
  sistolica: number;
  diastolica: number;
  frecuenciaCardiaca: number;
  temperatura: number;
  fechaHora: string;
  registradoPor: string;
  critico: boolean;
  nota: string;
}

export type VitalSignInput = Pick<
  VitalSign,
  'pacienteId' | 'paciente' | 'sistolica' | 'diastolica' | 'frecuenciaCardiaca' | 'temperatura'
>;

export const CRITICAL_TEMPERATURE = 39;

const NORMAL = {
  sistolica: { label: 'Presión sistólica', unit: 'mmHg' },
  diastolica: { label: 'Presión diastólica', unit: 'mmHg' },
  frecuenciaCardiaca: { label: 'Frecuencia cardíaca', unit: 'lpm' },
  temperatura: { label: 'Temperatura', unit: '°C' },
} as const;

const POSSIBLE = {
  sistolica: [50, 260],
  diastolica: [30, 160],
  frecuenciaCardiaca: [20, 250],
  temperatura: [30, 45],
} as const;

export type Field = keyof typeof NORMAL;
const FIELDS = Object.keys(NORMAL) as Field[];

export function isValid(field: Field, value: number): boolean {
  const [min, max] = POSSIBLE[field];
  return Number.isFinite(value) && value >= min && value <= max;
}

export function validateInput(input: VitalSignInput): string[] {
  return FIELDS.flatMap((field) => {
    const [min, max] = POSSIBLE[field];
    return isValid(field, input[field])
      ? []
      : [`${NORMAL[field].label}: ingresá un valor entre ${min} y ${max} ${NORMAL[field].unit}.`];
  });
}

interface ControlDto extends Omit<VitalSign, 'paciente' | 'registradoPor'> {
  paciente: string;
  registradoPor: string;
  fueraDeRango: string[];
}

function toRecord({ fueraDeRango: _fueraDeRango, ...dto }: ControlDto): VitalSign {
  return { ...dto, paciente: displayName(dto.paciente), registradoPor: displayName(dto.registradoPor) };
}

export async function listVitalSigns(): Promise<VitalSign[]> {
  const controls = await http.get<ControlDto[]>('/signos-vitales/controles');
  return controls.map(toRecord);
}

export async function addVitalSign(input: VitalSignInput): Promise<VitalSign> {
  const problems = validateInput(input);
  if (problems.length > 0) throw new Error(problems.join(' '));
  const saved = await http.post<ControlDto>('/signos-vitales/controles', {
    pacienteId: input.pacienteId,
    sistolica: input.sistolica,
    diastolica: input.diastolica,
    frecuenciaCardiaca: input.frecuenciaCardiaca,
    temperatura: input.temperatura,
  });
  return toRecord(saved);
}
