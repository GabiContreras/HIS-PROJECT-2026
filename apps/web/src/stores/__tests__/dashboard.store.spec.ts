import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
  listTriage: vi.fn(),
  listVitalSigns: vi.fn(),
  beds: [] as any[],
  inventoryItems: [] as any[],
  appointments: [] as any[],
  role: null as string | null,
  bedsLoad: vi.fn(),
  inventoryLoad: vi.fn(),
  appointmentsLoad: vi.fn(),
}));

vi.mock('../../composables/useBeds', () => ({
  useBeds: () => ({
    beds: ref(mocks.beds),
    loading: ref(false),
    error: ref(null),
    load: mocks.bedsLoad,
  }),
}));

vi.mock('../../composables/useInventory', () => ({
  useInventory: () => ({
    items: ref(mocks.inventoryItems),
    loading: ref(false),
    error: ref(null),
    lowStock: ref([]),
    load: mocks.inventoryLoad,
  }),
}));

vi.mock('../../features/admissions/useAppointments', () => ({
  useAppointments: () => ({
    turnos: ref(mocks.appointments),
    cargando: ref(false),
    error: ref(null),
    cargar: mocks.appointmentsLoad,
  }),
}));

vi.mock('../../features/iam/session.store', () => ({
  useSessionStore: () => ({
    role: mocks.role,
  }),
}));

vi.mock('../../services/triage', () => ({
  listTriage: mocks.listTriage,
}));

vi.mock('../../services/vitalSigns', () => ({
  listVitalSigns: mocks.listVitalSigns,
}));

import { useDashboardStore } from '../dashboard.store';

describe('Dashboard Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    mocks.beds = [];
    mocks.inventoryItems = [];
    mocks.appointments = [];
    mocks.role = null;

    mocks.listTriage.mockResolvedValue([]);
    mocks.listVitalSigns.mockResolvedValue([]);
    mocks.bedsLoad.mockResolvedValue(undefined);
    mocks.inventoryLoad.mockResolvedValue(undefined);
    mocks.appointmentsLoad.mockResolvedValue(undefined);
  });

  it('debe comenzar con las listas vacías', () => {
    const store = useDashboardStore();

    expect(store.beds).toHaveLength(0);
    expect(store.items).toHaveLength(0);
    expect(store.triage).toHaveLength(0);
    expect(store.latestVitalSigns).toHaveLength(0);
  });
  it('debe calcular correctamente el total de camas ocupadas y disponibles', () => {
  mocks.beds = [
    { id: '1', numero: '101', sector: 'A', estado: 'OCUPADA' },
    { id: '2', numero: '102', sector: 'A', estado: 'DISPONIBLE' },
    { id: '3', numero: '103', sector: 'B', estado: 'OCUPADA' },
  ];

  const store = useDashboardStore();

  expect(store.totalBeds).toBe(3);
  expect(store.occupiedBeds).toBe(2);
  expect(store.availableBeds).toBe(1);
});

it('debe permitir ver la agenda a médicos y administrativos', () => {
  mocks.role = 'MEDICO';
  const store = useDashboardStore();

  expect(store.canSeeAgenda).toBe(true);
});
it('no debe permitir ver la agenda a enfermeros', () => {
  mocks.role = 'ENFERMERO';
  const store = useDashboardStore();

  expect(store.canSeeAgenda).toBe(false);
});
});