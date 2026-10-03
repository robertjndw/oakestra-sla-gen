import { useCallback, useState } from "react";

function read<T>(key: string, fallback: T, isValid?: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid && !isValid(parsed) ? fallback : (parsed as T);
  } catch {
    // storage blocked or the stored value is not JSON: behave as if nothing was saved
    return fallback;
  }
}

/** useState backed by localStorage. Never throws; falls back to in-memory state. */
export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  isValid?: (v: unknown) => v is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback, isValid));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // private mode or blocked site data: the value just won't persist
      }
    },
    [key],
  );
  return [value, update];
}
