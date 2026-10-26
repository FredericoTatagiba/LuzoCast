import { ref, watch, type Ref } from 'vue';

/** `ref` que lembra o valor entre aberturas do app (localStorage, tolerante a falhas). */
export function usePersistentRef<T>(key: string, initial: T): Ref<T> {
  let start = initial;
  try {
    const raw = localStorage.getItem(`luzocast:${key}`);
    if (raw !== null) start = JSON.parse(raw) as T;
  } catch {
    /* storage indisponível ou valor corrompido: usa o padrão */
  }
  const r = ref(start) as Ref<T>;
  watch(r, (v) => {
    try {
      localStorage.setItem(`luzocast:${key}`, JSON.stringify(v));
    } catch {
      /* ignora */
    }
  });
  return r;
}
