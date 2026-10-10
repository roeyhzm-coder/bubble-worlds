import type { AppSnapshot } from "../types";
import { EMPTY_SNAPSHOT, STORAGE_KEY, mergeSeed } from "./defaults";

export function loadLocal(): AppSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mergeSeed(EMPTY_SNAPSHOT);
    const parsed = JSON.parse(raw) as Partial<AppSnapshot>;
    return mergeSeed({
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      bubbles: Array.isArray(parsed.bubbles) ? parsed.bubbles : [],
      colorRoles: parsed.colorRoles ?? EMPTY_SNAPSHOT.colorRoles,
      pageLabels: parsed.pageLabels ?? EMPTY_SNAPSHOT.pageLabels,
      listViews: parsed.listViews ?? {},
      triangleTypes: Array.isArray(parsed.triangleTypes) ? parsed.triangleTypes : [],
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
  for (const cat of remote.categories) {
    const prev = cats.get(cat.id);
    const remoteZero = cat.position_x === 0 && cat.position_y === 0;
    const keep =
      remoteZero && prev && (prev.position_x !== 0 || prev.position_y !== 0)
        ? { ...cat, position_x: prev.position_x, position_y: prev.position_y }
        : cat;
    cats.set(cat.id, {
      ...keep,
      container_type: keep.container_type ?? prev?.container_type ?? null,
    });
  }
  const bubs = new Map(local.bubbles.map((b) => [b.id, b]));
  for (const bub of remote.bubbles) {
    const prev = bubs.get(bub.id);
    const remoteZero = bub.position_x === 0 && bub.position_y === 0;
    const keep =
      remoteZero && prev && (prev.position_x !== 0 || prev.position_y !== 0)
        ? { ...bub, position_x: prev.position_x, position_y: prev.position_y }
        : bub;
    bubs.set(bub.id, {
      ...keep,
      container_type: keep.container_type ?? prev?.container_type ?? null,
      triangle_id: keep.triangle_id ?? prev?.triangle_id ?? null,
      due_at: keep.due_at ?? prev?.due_at ?? null,
      due_label: keep.due_label || prev?.due_label || "",
      action_done: keep.action_done || Boolean(prev?.action_done),
      action_steps:
        keep.action_steps?.length ? keep.action_steps : prev?.action_steps ?? [],
    });
  }
  const types = new Map((local.triangleTypes ?? []).map((item) => [item.id, item]));
  for (const type of remote.triangleTypes ?? []) types.set(type.id, type);
  return mergeSeed({
    categories: [...cats.values()],
    bubbles: [...bubs.values()],
    colorRoles: { ...local.colorRoles, ...remote.colorRoles },
    pageLabels: { ...local.pageLabels, ...remote.pageLabels },
    listViews: { ...local.listViews, ...remote.listViews },
    triangleTypes: [...types.values()],
  });
}
