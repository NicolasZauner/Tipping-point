// Per-viewer conveniences only (language, theme, your own saved scenarios). Storage can throw inside
// the artifact frame or a private window, so every access is guarded and has a default.
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storageWorks(): boolean {
  const probe = "tipping-point:probe";
  if (!writeStored(probe, 1)) return false;
  try {
    globalThis.localStorage.removeItem(probe);
  } catch {
    /* ignore */
  }
  return true;
}
