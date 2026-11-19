import { onBeforeUnmount, onMounted } from 'vue';
import { useBedsStore } from '../stores/beds.store';

export function useBedsRealtime(): void {
  const store = useBedsStore();
  onMounted(store.connect);
  onBeforeUnmount(store.disconnect);
}
