import type { ActionStep, AppSnapshot, Bubble, ColorRoles, PageLabels, WorldKind } from "../types";
import { applyDailyRollover, asDailyTasks } from "./daily";
import { asSuccesses } from "./successes";
import { inferTriangleId, mergeTriangleTypes } from "./triangles";

export const EMPTY_ITEM_TOOLS = {
  triangle_id: null as string | null,
  due_at: null as string | null,
  due_label: "",
  action_done: false,
  action_steps: [] as ActionStep[],
};

export const STORAGE_KEY = "bubble-worlds-v1";

export const DEFAULT_COLOR_ROLES: ColorRoles = {
  active_tracking: "#38bdf8",
  focus: "#34d399",
  deep_thought: "#f472b6",
  default: "#94a3b8",
};

export const PALETTE = [
  "#818cf8",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#fb7185",
  "#a78bfa",
  "#22d3ee",
  "#94a3b8",
  "#f59e0b",
];

export const DEFAULT_PAGE_LABELS: PageLabels = {
  map: "עולמות",
  hub: "מוקדי פוקוס",
  daily: "משימות יומיות",
  successes: "הצלחות",
  studio: "ניהול משולשים",
};

export const EMPTY_SNAPSHOT: AppSnapshot = {
  categories: [],
  bubbles: [],
  colorRoles: { ...DEFAULT_COLOR_ROLES },
  pageLabels: { ...DEFAULT_PAGE_LABELS },
  listViews: {},
  triangleTypes: [],
  dailyTasks: [],
  successes: [],
  deletedIds: [],
};

function asWorldKind(value: unknown): WorldKind | null {
  return value === "bubbles" || value === "list" ? value : null;
}

export function mergeSeed(snapshot: AppSnapshot): AppSnapshot {
  const deleted = new Set(snapshot.deletedIds ?? []);
  const categories = (Array.isArray(snapshot.categories) ? snapshot.categories : []).filter(
    (item) => !deleted.has(item.id),
  );
  const bubbles = unstickClusteredBubbles(
    (Array.isArray(snapshot.bubbles) ? snapshot.bubbles : []).filter((item) => !deleted.has(item.id)),
  );
  return {
    categories: categories.map((category) => {
      const hasChildren = bubbles.some(
        (bubble) => bubble.category_id === category.id && bubble.parent_bubble_id === null,
      );
      return {
        ...category,
        container_type:
          asWorldKind(category.container_type) ?? (hasChildren ? "bubbles" : null),
      };
    }),
    bubbles: bubbles.map((bubble) => {
      const hasChildren = bubbles.some((child) => child.parent_bubble_id === bubble.id);
      const triangle_id = inferTriangleId(bubble);
      return {
        ...bubble,
        container_type:
          asWorldKind(bubble.container_type) ?? (hasChildren ? "bubbles" : null),
        triangle_id,
        due_at: bubble.due_at ?? null,
        due_label: bubble.due_label ?? "",
        action_done: Boolean(bubble.action_done),
        action_steps: Array.isArray(bubble.action_steps) ? bubble.action_steps : [],
        tracking_history: Array.isArray(bubble.tracking_history) ? bubble.tracking_history : [],
        notes: bubble.notes ?? "",
        title: bubble.title ?? "",
      };
    }),
    colorRoles: { ...DEFAULT_COLOR_ROLES, ...snapshot.colorRoles },
    pageLabels: { ...DEFAULT_PAGE_LABELS, ...snapshot.pageLabels },
    listViews: { ...snapshot.listViews },
    triangleTypes: mergeTriangleTypes(snapshot.triangleTypes ?? []),
    dailyTasks: applyDailyRollover(asDailyTasks(snapshot.dailyTasks)),
    successes: asSuccesses(snapshot.successes).filter((item) => !deleted.has(item.id)),
    deletedIds: [...deleted],
  };
}

export function layoutRing(index: number, total: number): { x: number; y: number } {
  const count = Math.max(total, 1);
  if (count === 1) return { x: 50, y: 44 };
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  const radius = count <= 3 ? 26 : count <= 6 ? 30 : 33;
  return {
    x: Number((50 + Math.cos(angle) * radius).toFixed(2)),
    y: Number((50 + Math.sin(angle) * radius).toFixed(2)),
  };
}

export function unstickClusteredBubbles(bubbles: Bubble[]): Bubble[] {
  const groups = new Map<string, Bubble[]>();
  for (const bubble of bubbles) {
    const key = `${bubble.category_id}::${bubble.parent_bubble_id ?? "root"}`;
    const list = groups.get(key) ?? [];
    list.push(bubble);
    groups.set(key, list);
  }
  const next = new Map(bubbles.map((bubble) => [bubble.id, bubble]));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const cx = group.reduce((sum, item) => sum + item.position_x, 0) / group.length;
    const cy = group.reduce((sum, item) => sum + item.position_y, 0) / group.length;
    const clustered = group.every(
      (item) => Math.hypot(item.position_x - cx, item.position_y - cy) < 7,
    );
    if (!clustered) continue;
    group.forEach((item, index) => {
      const pos = layoutRing(index, group.length);
      next.set(item.id, { ...item, position_x: pos.x, position_y: pos.y });
    });
  }
  return bubbles.map((bubble) => next.get(bubble.id) ?? bubble);
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
