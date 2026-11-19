import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import type { Role } from '../../iam/types';
import type { Bed, BedStatus } from '../../../services/beds';
import { useBedsStore } from '../../../stores/beds.store';
import { useSessionStore } from '../../iam/session.store';
import BedDetailView from '../BedDetailView.vue';

vi.mock('../../../shared/http', () => {
  class ApiError extends Error {}
  return { ApiError, http: { get: vi.fn(), post: vi.fn(), stream: vi.fn() }, setAccessToken: vi.fn() };
});

const ASSIGN = 'Asignar cama';
const BLOCK = 'Bloquear por mantenimiento';
const DISCHARGE = 'Registrar alta o traslado';
const CLEAN = 'Confirmar limpieza';
const UNBLOCK = 'Habilitar cama';
const ALL_ACTIONS = [ASSIGN, BLOCK, DISCHARGE, CLEAN, UNBLOCK];

const ALLOWED: Record<BedStatus, Record<Role, string[]>> = {
  DISPONIBLE: { ADMINISTRATIVO: [ASSIGN, BLOCK], MEDICO: [ASSIGN], ENFERMERO: [] },
  OCUPADA: { ADMINISTRATIVO: [DISCHARGE], MEDICO: [DISCHARGE], ENFERMERO: [] },
  EN_LIMPIEZA: { ADMINISTRATIVO: [CLEAN], MEDICO: [], ENFERMERO: [CLEAN] },
  MANTENIMIENTO: { ADMINISTRATIVO: [UNBLOCK], MEDICO: [], ENFERMERO: [] },
};

async function render(role: Role, estado: BedStatus): Promise<string> {
  const pinia = createPinia();
  setActivePinia(pinia);
  const session = useSessionStore();
  session.account = { id: 'u1', nombre: 'Ana', apellido: 'Paz', email: 'a@b.c', rol: role, estado: 'ACTIVO', esSuperadmin: false };
  const store = useBedsStore();
  const bed: Bed = {
    id: 'b1',
    numero: '01',
    sector: 'Clínica Médica',
    habitacion: '101',
    estado,
    paciente: estado === 'OCUPADA' ? { id: 'p1', nombre: 'Ana Rojas' } : null,
    motivoBloqueo: estado === 'MANTENIMIENTO' ? 'Pintura' : null,
    activa: true,
  };
  store.beds = [bed];
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/camas', name: 'beds', component: { template: '<div />' } }],
  });
  const app = createSSRApp(BedDetailView, { id: 'b1' });
  app.use(router).use(pinia);
  return renderToString(app);
}

describe('BedDetailView: acciones visibles por rol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const roles: Role[] = ['ADMINISTRATIVO', 'MEDICO', 'ENFERMERO'];
  const estados: BedStatus[] = ['DISPONIBLE', 'OCUPADA', 'EN_LIMPIEZA', 'MANTENIMIENTO'];

  for (const estado of estados) {
    for (const role of roles) {
      it(`${role} con la cama en ${estado}`, async () => {
        const html = await render(role, estado);

        const expected = ALLOWED[estado][role];
        for (const action of ALL_ACTIONS) {
          expect(html.includes(action), `${action} para ${role} en ${estado}`).toBe(expected.includes(action));
        }
      });
    }
  }

  it('pide el médico responsable solo al administrativo', async () => {
    expect(await render('ADMINISTRATIVO', 'DISPONIBLE')).toContain('Médico responsable');
    expect(await render('MEDICO', 'DISPONIBLE')).not.toContain('Médico responsable');
  });

  it('muestra el motivo del bloqueo y la ubicación de la cama', async () => {
    const html = await render('ENFERMERO', 'MANTENIMIENTO');

    expect(html).toContain('Pintura');
    expect(html).toContain('Clínica Médica · Habitación 101');
  });
});
