import { BUBBLE_EXTRA_KEYS, type AppSnapshot, type Bubble } from "../types";
import { mergeDailyTasks } from "./daily";
import { EMPTY_SNAPSHOT, STORAGE_KEY, mergeSeed } from "./defaults";
import { mergeSuccesses } from "./successes";

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
      dailyTasks: Array.isArray(parsed.dailyTasks) ? parsed.dailyTasks : [],
      successes: Array.isArray(parsed.successes) ? parsed.successes : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
    });
  } catch {
    // Keep the unreadable payload instead of letting the next save overwrite it.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(`${STORAGE_KEY}-corrupt-${Date.now()}`, raw);
    } catch {
      /* storage unavailable */
    }
    return mergeSeed(EMPTY_SNAPSHOT);
  }
}

export function saveLocal(snapshot: AppSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("local save failed", error);
  }
}

export const BACKUP_KEY = `${STORAGE_KEY}-backup`;

/** Stores a full copy of the device snapshot before any cloud merge touches it. */
export function backupLocal(snapshot: AppSnapshot): void {
  try {
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({ saved_at: new Date().toISOString(), snapshot }),
    );
  } catch (error) {
    console.warn("local backup failed", error);
  }
}

/** Downloads the snapshot as a JSON file the user can keep outside the browser. */
export function downloadBackup(snapshot: AppSnapshot): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `bubble-worlds-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export type MergePreference = "local" | "remote";

function fillBlanks<T extends object>(primary: T, secondary?: T): T {
  if (!secondary) return primary;
  const out = { ...secondary, ...primary } as Record<string, unknown>;
  const fallback = secondary as Record<string, unknown>;
  for (const [field, value] of Object.entries(out)) {
    if (value === undefined || value === null) out[field] = fallback[field] ?? value;
  }
  return out as T;
}

function mergeById<T extends { id: string }>(
  local: T[],
  remote: T[],
  deleted: Set<string>,
  prefer: MergePreference,
): T[] {
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const localIds = new Set(local.map((item) => item.id));
  const merged = local
    .filter((item) => !deleted.has(item.id))
    .map((item) => {
      const other = remoteById.get(item.id);
      return prefer === "local" ? fillBlanks(item, other) : other ? fillBlanks(other, item) : item;
    });
  for (const item of remote) {
    if (!localIds.has(item.id) && !deleted.has(item.id)) merged.push(item);
  }
  return merged;
}

/**
 * Extras fields follow the side whose `extras_updated_at` is newer, per item, regardless of
 * `prefer`, so edits from another device are never lost to a stale local copy (or vice versa).
 * Equal clocks (including legacy items with none) keep the `prefer` result untouched.
 */
function mergeBubbleExtras(merged: Bubble[], local: Bubble[], remote: Bubble[]): Bubble[] {
  const localById = new Map(local.map((item) => [item.id, item]));
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  return merged.map((item) => {
    const l = localById.get(item.id);
    const r = remoteById.get(item.id);
    if (!l || !r) return item;
    const lt = l.extras_updated_at ?? 0;
    const rt = r.extras_updated_at ?? 0;
    if (lt === rt) return item;
    const winner = lt > rt ? l : r;
    const next: Record<string, unknown> = { ...item, extras_updated_at: Math.max(lt, rt) };
    for (const key of BUBBLE_EXTRA_KEYS) next[key] = winner[key];
    return next as unknown as Bubble;
  });
}

/**
 * Never drops local data: every local category, bubble, task, success and setting survives.
 * Remote-only items are added. `prefer` only decides whose field values win on shared ids:
 * "local" (default, startup + manual push) or "remote" (live updates from another device).
 */
export function mergeSnapshots(
  local: AppSnapshot,
  remote: AppSnapshot,
  prefer: MergePreference = "local",
): AppSnapshot {
  const deleted = new Set(local.deletedIds ?? []);
  const pick = <V extends object>(l: V, r: V): V =>
    prefer === "local" ? { ...r, ...l } : { ...l, ...r };
  // mergeDailyTasks / mergeSuccesses let their second argument win on shared ids.
  const [dailyA, dailyB] =
    prefer === "local" ? [remote.dailyTasks, local.dailyTasks] : [local.dailyTasks, remote.dailyTasks];
  const [winsA, winsB] =
    prefer === "local" ? [remote.successes, local.successes] : [local.successes, remote.successes];

  return mergeSeed({
    categories: mergeById(local.categories, remote.categories, deleted, prefer),
    bubbles: mergeBubbleExtras(
      mergeById(local.bubbles, remote.bubbles, deleted, prefer),
      local.bubbles,
      remote.bubbles,
    ),
    colorRoles: pick(local.colorRoles, remote.colorRoles),
    pageLabels: pick(local.pageLabels, remote.pageLabels),
    listViews: pick(local.listViews, remote.listViews),
    triangleTypes: mergeById(local.triangleTypes ?? [], remote.triangleTypes ?? [], new Set(), prefer),
    dailyTasks: mergeDailyTasks(dailyA ?? [], dailyB ?? []).filter((item) => !deleted.has(item.id)),
    successes: mergeSuccesses(winsA ?? [], winsB ?? []).filter((item) => !deleted.has(item.id)),
    deletedIds: [...deleted],
  });
}
