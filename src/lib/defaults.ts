import type { AppSnapshot, Bubble, Category, ColorRoles, PageLabels, WorldKind } from "../types";

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

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "cat-self",
    name: "מטרות לעצמי",
    color: "#818cf8",
    position_x: 50,
    position_y: 20,
    order_index: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    container_type: "bubbles",
  },
  {
    id: "cat-desires",
    name: "רצונות",
    color: "#f472b6",
    position_x: 80,
    position_y: 40,
    order_index: 1,
    created_at: "2026-01-01T00:00:01.000Z",
    container_type: "bubbles",
  },
  {
    id: "cat-work",
    name: "תעסוקה",
    color: "#38bdf8",
    position_x: 70,
    position_y: 74,
    order_index: 2,
    created_at: "2026-01-01T00:00:02.000Z",
    container_type: "bubbles",
  },
  {
    id: "cat-fitness",
    name: "כושר ותזונה",
    color: "#34d399",
    position_x: 30,
    position_y: 74,
    order_index: 3,
    created_at: "2026-01-01T00:00:03.000Z",
    container_type: "bubbles",
  },
  {
    id: "cat-life",
    name: "דרך חיים",
    color: "#fbbf24",
    position_x: 20,
    position_y: 40,
    order_index: 4,
    created_at: "2026-01-01T00:00:04.000Z",
    container_type: "bubbles",
  },
];

export const DEFAULT_BUBBLES: Bubble[] = [
  {
    id: "bub-meditate",
    parent_bubble_id: null,
    category_id: "cat-self",
    title: "מדיטציה",
    notes: "10 דקות בבוקר לפני המסכים.",
    color: "#38bdf8",
    status: "active_tracking",
    position_x: 32,
    position_y: 34,
    size_multiplier: 1,
    created_at: "2026-01-01T00:01:00.000Z",
    is_tracking: true,
    target_days: 30,
    weekly_frequency: 7,
    tracking_history: [],
    streak_mode: "flexible",
    container_type: null,
  },
  {
    id: "bub-read",
    parent_bubble_id: null,
    category_id: "cat-self",
    title: "קריאה",
    notes: "לסיים ספר בחודש.",
    color: "#34d399",
    status: "focus",
    position_x: 68,
    position_y: 58,
    size_multiplier: 1,
    created_at: "2026-01-01T00:01:01.000Z",
    is_tracking: false,
    target_days: 30,
    weekly_frequency: 5,
    tracking_history: [],
    streak_mode: "flexible",
    container_type: null,
  },
  {
    id: "bub-japan",
    parent_bubble_id: null,
    category_id: "cat-desires",
    title: "טיול ליפן",
    notes: "לאסוף רעיונות למסלול, תקציב ועונה.",
    color: "#f472b6",
    status: "deep_thought",
    position_x: 50,
    position_y: 48,
    size_multiplier: 1.1,
    created_at: "2026-01-01T00:01:02.000Z",
    is_tracking: false,
    target_days: 30,
    weekly_frequency: 3,
    tracking_history: [],
    streak_mode: "cumulative",
    container_type: null,
  },
  {
    id: "bub-portfolio",
    parent_bubble_id: null,
    category_id: "cat-work",
    title: "תיק עבודות",
    notes: "לעדכן פרויקט אחד השבוע.",
    color: "#34d399",
    status: "focus",
    position_x: 46,
    position_y: 40,
    size_multiplier: 1,
    created_at: "2026-01-01T00:01:03.000Z",
    is_tracking: false,
    target_days: 60,
    weekly_frequency: 5,
    tracking_history: [],
    streak_mode: "flexible",
    container_type: null,
  },
  {
    id: "bub-walk",
    parent_bubble_id: null,
    category_id: "cat-fitness",
    title: "הליכה",
    notes: "8,000 צעדים או 40 דקות.",
    color: "#38bdf8",
    status: "active_tracking",
    position_x: 38,
    position_y: 46,
    size_multiplier: 1,
    created_at: "2026-01-01T00:01:04.000Z",
    is_tracking: true,
    target_days: 120,
    weekly_frequency: 5,
    tracking_history: [],
    streak_mode: "flexible",
    container_type: null,
  },
  {
    id: "bub-sleep",
    parent_bubble_id: null,
    category_id: "cat-life",
    title: "שינה קבועה",
    notes: "כיבוי בשעה 23:00.",
    color: "#38bdf8",
    status: "active_tracking",
    position_x: 54,
    position_y: 44,
    size_multiplier: 1,
    created_at: "2026-01-01T00:01:05.000Z",
    is_tracking: true,
    target_days: 60,
    weekly_frequency: 7,
    tracking_history: [],
    streak_mode: "strict",
    container_type: null,
  },
];

export const DEFAULT_PAGE_LABELS: PageLabels = {
  map: "מפת עולמות",
  hub: "מוקדי פוקוס",
};

export const EMPTY_SNAPSHOT: AppSnapshot = {
  categories: [],
  bubbles: [],
  colorRoles: { ...DEFAULT_COLOR_ROLES },
  pageLabels: { ...DEFAULT_PAGE_LABELS },
  listViews: {},
};

function restoreSeedPosition<T extends { id: string; position_x: number; position_y: number }>(
  item: T,
  seeds: T[],
): T {
  if (item.position_x !== 0 || item.position_y !== 0) return item;
  const seed = seeds.find((s) => s.id === item.id);
  if (!seed) return item;
  return { ...item, position_x: seed.position_x, position_y: seed.position_y };
}

function asWorldKind(value: unknown): WorldKind | null {
  return value === "bubbles" || value === "list" ? value : null;
}

export function mergeSeed(snapshot: AppSnapshot): AppSnapshot {
  const catIds = new Set(snapshot.categories.map((c) => c.id));
  const bubIds = new Set(snapshot.bubbles.map((b) => b.id));
  const categories = [
    ...snapshot.categories.map((c) => restoreSeedPosition(c, DEFAULT_CATEGORIES)),
    ...DEFAULT_CATEGORIES.filter((c) => !catIds.has(c.id)),
  ];
  const bubbles = unstickClusteredBubbles([
    ...snapshot.bubbles.map((b) => restoreSeedPosition(b, DEFAULT_BUBBLES)),
    ...DEFAULT_BUBBLES.filter((b) => !bubIds.has(b.id)),
  ]);
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
      return {
        ...bubble,
        container_type:
          asWorldKind(bubble.container_type) ?? (hasChildren ? "bubbles" : null),
      };
    }),
    colorRoles: { ...DEFAULT_COLOR_ROLES, ...snapshot.colorRoles },
    pageLabels: { ...DEFAULT_PAGE_LABELS, ...snapshot.pageLabels },
    listViews: { ...snapshot.listViews },
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
