import type { AppSnapshot, Bubble, Category } from "../types";
import { mergeDailyTasks } from "./daily";
import { EMPTY_SNAPSHOT, STORAGE_KEY, mergeSeed } from "./defaults";
import { mergeSuccesses } from "./successes";

const RECENT_MS = 5 * 60 * 1000;

function isRecent(createdAt: string): boolean {
  const time = Date.parse(createdAt);
  return Number.isFinite(time) && Date.now() - time < RECENT_MS;
}

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
    return mergeSeed(EMPTY_SNAPSHOT);
  }
}

export function saveLocal(snapshot: AppSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function overlayCategory(remote: Category, local?: Category): Category {
  if (!local) return remote;
  const remoteZero = remote.position_x === 0 && remote.position_y === 0;
  return {
    ...remote,
    position_x: remoteZero ? local.position_x : remote.position_x,
    position_y: remoteZero ? local.position_y : remote.position_y,
    container_type: remote.container_type ?? local.container_type ?? null,
  };
}

function overlayBubble(remote: Bubble, local?: Bubble): Bubble {
  if (!local) return remote;
  const remoteZero = remote.position_x === 0 && remote.position_y === 0;
  return {
    ...remote,
    position_x: remoteZero ? local.position_x : remote.position_x,
    position_y: remoteZero ? local.position_y : remote.position_y,
    container_type: remote.container_type ?? local.container_type ?? null,
    triangle_id: remote.triangle_id !== undefined ? remote.triangle_id : local.triangle_id,
    due_at: remote.due_at ?? local.due_at ?? null,
    due_label: remote.due_label || local.due_label || "",
    action_done: remote.action_done || local.action_done,
    action_steps: remote.action_steps?.length ? remote.action_steps : local.action_steps ?? [],
  };
}

export function mergeSnapshots(local: AppSnapshot, remote: AppSnapshot): AppSnapshot {
  const deleted = new Set([...(local.deletedIds ?? []), ...(remote.deletedIds ?? [])]);
  const localCats = new Map(local.categories.map((item) => [item.id, item]));
  const localBubs = new Map(local.bubbles.map((item) => [item.id, item]));
  const remoteCatIds = new Set(remote.categories.map((item) => item.id));
  const remoteBubIds = new Set(remote.bubbles.map((item) => item.id));

  const categories = [
    ...remote.categories
      .filter((item) => !deleted.has(item.id))
      .map((item) => overlayCategory(item, localCats.get(item.id))),
    ...local.categories.filter(
      (item) => !remoteCatIds.has(item.id) && !deleted.has(item.id) && isRecent(item.created_at),
    ),
  ];
  const bubbles = [
    ...remote.bubbles
      .filter((item) => !deleted.has(item.id))
      .map((item) => overlayBubble(item, localBubs.get(item.id))),
    ...local.bubbles.filter(
      (item) => !remoteBubIds.has(item.id) && !deleted.has(item.id) && isRecent(item.created_at),
    ),
  ];

  const types = new Map((remote.triangleTypes ?? []).map((item) => [item.id, item]));
  for (const type of local.triangleTypes ?? []) {
    if (!types.has(type.id)) types.set(type.id, type);
  }

  return mergeSeed({
    categories,
    bubbles,
    colorRoles: { ...local.colorRoles, ...remote.colorRoles },
    pageLabels: { ...local.pageLabels, ...remote.pageLabels },
    listViews: { ...local.listViews, ...remote.listViews },
    triangleTypes: [...types.values()],
    dailyTasks: mergeDailyTasks(local.dailyTasks ?? [], remote.dailyTasks ?? []),
    successes: mergeSuccesses(local.successes ?? [], remote.successes ?? []),
    deletedIds: [...deleted],
  });
}
