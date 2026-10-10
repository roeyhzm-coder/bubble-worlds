import type { AppSnapshot } from "../types";
import { EMPTY_SNAPSHOT, STORAGE_KEY, mergeSeed } from "./defaults";

export function loadLocal(): AppSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mergeSeed(EMPTY_SNAPSHOT);
    const parsed = JSON.parse(raw) as Partial<AppSnapshot>;
    return mergeSeed({
      categories: parsed.categories ?? [],
      bubbles: parsed.bubbles ?? [],
      colorRoles: parsed.colorRoles ?? EMPTY_SNAPSHOT.colorRoles,
      pageLabels: parsed.pageLabels ?? EMPTY_SNAPSHOT.pageLabels,
      listViews: parsed.listViews ?? {},
    });
  } catch {
    return mergeSeed(EMPTY_SNAPSHOT);
  }
}

export function saveLocal(snapshot: AppSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function mergeSnapshots(local: AppSnapshot, remote: AppSnapshot): AppSnapshot {
  const cats = new Map(local.categories.map((c) => [c.id, c]));
  for (const cat of remote.categories) cats.set(cat.id, cat);
  const bubs = new Map(local.bubbles.map((b) => [b.id, b]));
  for (const bub of remote.bubbles) bubs.set(bub.id, bub);
  return mergeSeed({
    categories: [...cats.values()],
    bubbles: [...bubs.values()],
    colorRoles: { ...local.colorRoles, ...remote.colorRoles },
    pageLabels: { ...local.pageLabels, ...remote.pageLabels },
    listViews: { ...local.listViews, ...remote.listViews },
  });
}
