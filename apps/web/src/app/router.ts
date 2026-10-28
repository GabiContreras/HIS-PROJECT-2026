import { createRouter, createWebHistory } from 'vue-router';
import AppShell from './AppShell.vue';
import { useSessionStore } from '../features/iam/session.store';
import type { Role } from '../features/iam/types';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    roles?: Role[];
    title?: string;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      meta: { public: true, title: 'Iniciar sesión' },
      component: () => import('../features/iam/views/LoginView.vue'),
    },
    {
      path: '/',
      component: AppShell,
      children: [
        {
          path: '',
          name: 'dashboard',
          meta: { title: 'Panel' },
          component: () => import('../features/dashboard/DashboardView.vue'),
        },
        {
          path: 'usuarios',
          name: 'users',
          meta: { roles: ['ADMINISTRATIVO'], title: 'Usuarios' },
          component: () => import('../features/iam/views/UsersView.vue'),
        },
        {
          path: 'usuarios/:id',
          name: 'user-detail',
          meta: { roles: ['ADMINISTRATIVO'], title: 'Detalle de usuario' },
          component: () => import('../features/iam/views/UserDetailView.vue'),
        },
        {
          path: 'turnos',
          name: 'appointments',
          meta: { roles: ['MEDICO', 'ADMINISTRATIVO'], title: 'Turnos' },
          component: () => import('../features/admissions/AppointmentView.vue'),
        },
        {
          path: 'camas',
          name: 'beds',
          meta: { title: 'Camas' },
          component: () => import('../features/beds/BedsView.vue'),
        },

        {
          path: 'camas/:id',
          name: 'bed-detail',
          meta: { title: 'Detalle de cama' },
          props: true,
          component: () => import('../features/beds/BedDetailView.vue'),
        },
        {
          path: 'pacientes',
          name: 'patients',
          meta: { title: 'Pacientes' },
          component: () => import('../features/patients/PatientsView.vue'),
        },
        {
          path: 'insumos',
          name: 'inventory',
          meta: { roles: ['ENFERMERO', 'ADMINISTRATIVO'], title: 'Insumos' },
          component: () => import('../features/inventory/InventoryView.vue'),
        },
        {
          path: 'enfermeria',
          meta: { roles: ['ENFERMERO', 'MEDICO'], title: 'Enfermería' },
          component: () => import('../features/nursing/NursingView.vue'),
          redirect: { name: 'vital-signs' },
          children: [
            {
              path: 'signos-vitales',
              name: 'vital-signs',
              meta: { title: 'Signos vitales' },
              component: () => import('../features/nursing/VitalSignsView.vue'),
            },
            {
              path: 'medicaciones',
              name: 'medications',
              meta: { title: 'Medicaciones' },
              component: () => import('../features/nursing/MedicationsView.vue'),
            },
            {
              path: 'protocolo',
              name: 'protocol',
              meta: { title: 'Protocolo de ingreso' },
              component: () => import('../features/nursing/ProtocolView.vue'),
            },
          ],
        },
        {
          path: 'facturacion',
          name: 'billing',
          meta: { roles: ['ADMINISTRATIVO'], title: 'Facturación' },
          component: () => import('../features/billing/BillingView.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const session = useSessionStore();
  await session.restore();

  if (to.meta.public) {
    return session.isAuthenticated && to.name === 'login' ? { name: 'dashboard' } : true;
  }
  if (!session.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  const allowed = to.meta.roles;
  if (allowed && (session.role === null || !allowed.includes(session.role))) {
    return { name: 'dashboard' };
  }
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · HIS` : 'HIS';
});
//Ejemplo ruta navegacion
//router.push({ name: 'bed-detail', params: { id } })
//<RouterLink :to="{ name: 'vital-signs' }">