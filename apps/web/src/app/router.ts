import { createRouter, createWebHistory } from 'vue-router';
import AppShell from './AppShell.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', name: 'dashboard', component: () => import('../features/dashboard/DashboardView.vue') },
        { path: 'usuarios', name: 'users', component: () => import('../features/iam/views/UsersView.vue') },
      ],
    },
  ],
});