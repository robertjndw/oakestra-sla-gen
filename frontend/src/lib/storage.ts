export type StorageArea = "local" | "session";

// Looked up on every call: touching window.localStorage itself throws when site data is blocked.
const area = (which: StorageArea): Storage => (which === "local" ? localStorage : sessionStorage);

/** Never throws: blocked storage, missing keys, bad JSON and invalid shapes all give `fallback`. */
export function readStored<T>(
  which: StorageArea,
  key: string,
  fallback: T,
  isValid?: (v: unknown) => v is T,
): T {
  try {
    const raw = area(which).getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid && !isValid(parsed) ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/** Best effort. Never throws. False when the value was not saved. */
export function writeStored(which: StorageArea, key: string, value: unknown): boolean {
  try {
    area(which).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // private mode, blocked site data or a full quota: the value just won't persist
    return false;
  }
}

export function removeStored(which: StorageArea, key: string): void {
  try {
    area(which).removeItem(key);
  } catch {
    // same as writeStored: nothing to clean up if storage is unavailable
  }
}
