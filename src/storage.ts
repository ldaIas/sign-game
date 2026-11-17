// localStorage can be missing or throw (private mode, blocked site data); the
// game then just doesn't remember anything.

export function loadJSON<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) as string) as T | null; } catch { return null; }
}

export function saveJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

export function loadItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function saveItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}
