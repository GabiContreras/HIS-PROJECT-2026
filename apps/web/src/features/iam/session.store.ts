import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi } from './api';
import { setAccessToken } from '../../shared/http.ts';
import type { Account, Role, Session } from './types.ts';

export const useSessionStore = defineStore('session', () => {
  const account = ref<Account | null>(null);
  const restored = ref(false);

  const isAuthenticated = computed(() => account.value !== null);
  const role = computed<Role | null>(() => account.value?.rol ?? null);
  const fullName = computed(() =>
    account.value ? `${account.value.nombre} ${account.value.apellido}` : '',
  );

  function apply(session: Session): void {
    setAccessToken(session.accessToken);
    account.value = session.account;
  }

  function clear(): void {
    setAccessToken(null);
    account.value = null;
  }

  async function login(email: string, password: string): Promise<void> {
    apply(await authApi.login(email, password));
  }

  async function refreshSession(): Promise<boolean> {
    try {
      apply(await authApi.refresh());
      return true;
    } catch {
      clear();
      return false;
    }
  }

  async function restore(): Promise<void> {
    if (restored.value) return;
    await refreshSession();
    restored.value = true;
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  }

  return { account, restored, isAuthenticated, role, fullName, login, refreshSession, restore, logout, clear };
});