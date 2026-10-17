const KEY = "oficio-recent";

export function rememberProvider(userId: string, providerId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string[]>;
    const next = [providerId, ...(all[userId] ?? []).filter((id) => id !== providerId)].slice(0, 8);
    all[userId] = next;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* el historial local es opcional */
  }
}

export function recentProviderIds(userId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, string[]>;
    return all[userId] ?? [];
  } catch {
    return [];
  }
}
