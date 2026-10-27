import { createRouter, createWebHistory } from 'vue-router';
import AppShell from './AppShell.vue';
import { useSessionStore } from '../features/iam/session.store';
import type { Role } from '../features/iam/types';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    roles?: Role[];
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      meta: { public: true },
      component: () => import('../features/iam/views/LoginView.vue'),
    },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', name: 'dashboard', component: () => import('../features/dashboard/DashboardView.vue') },
        {
          path: 'usuarios',
          name: 'users',
          meta: { roles: ['ADMINISTRATIVO'] },
          component: () => import('../features/iam/views/UsersView.vue'),
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