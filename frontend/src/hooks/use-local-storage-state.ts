import { useCallback, useState } from "react";
import { readStored, writeStored, type StorageArea } from "@/lib/storage";

function useStoredState<T>(
  which: StorageArea,
  key: string,
  fallback: T,
  isValid?: (v: unknown) => v is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => readStored(which, key, fallback, isValid));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeStored(which, key, next);
    },
    [which, key],
  );
  return [value, update];
}

/** useState backed by localStorage. Never throws; falls back to in-memory state. */
export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  isValid?: (v: unknown) => v is T,
): [T, (next: T) => void] {
  return useStoredState("local", key, fallback, isValid);
}

/** useState backed by sessionStorage: survives a reload but stays with this tab. */
export function useSessionStorageState<T>(
  key: string,
  fallback: T,
  isValid?: (v: unknown) => v is T,
): [T, (next: T) => void] {
  return useStoredState("session", key, fallback, isValid);
}
