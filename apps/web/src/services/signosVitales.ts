export interface SignoVital {
  tipo: string; // Ej: 'Presión arterial', 'Frecuencia cardíaca'
  valor: string;
  fechaHora: string;
}

const SIGNOS_VITALES_MOCK: SignoVital[] = [
  { tipo: 'Presión arterial', valor: '120/80', fechaHora: '2026-06-07 08:30' },
  { tipo: 'Frecuencia cardíaca', valor: '75 lpm', fechaHora: '2026-06-07 08:30' }
];

export async function listarSignosVitales(pacienteId?: string): Promise<SignoVital[]> {
  // TODO: http.get('/signos-vitales') cuando exista el endpoint
  return SIGNOS_VITALES_MOCK;
}