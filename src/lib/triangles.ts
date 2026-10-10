import type { ActionStep, Bubble, BubbleStatus, ToolTemplate, TriangleType } from "../types";

function localId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export const TRI_TRACK = "tri-track";
export const TRI_ACTION = "tri-action";
export const TRI_THOUGHT = "tri-thought";

export const DEFAULT_TRIANGLE_TYPES: TriangleType[] = [
  {
    id: TRI_TRACK,
    name: "מעקב הרגלים",
    color: "#38bdf8",
    template: "tracking",
    order_index: 0,
  },
  {
    id: TRI_ACTION,
    name: "משימה עכשיו",
    color: "#34d399",
    template: "action",
    order_index: 1,
  },
  {
    id: TRI_THOUGHT,
    name: "חקירה והעמקה",
    color: "#f472b6",
    template: "thought",
    order_index: 2,
  },
];

export const WEEKDAYS = [
  { index: 0, label: "ראשון" },
  { index: 1, label: "שני" },
  { index: 2, label: "שלישי" },
  { index: 3, label: "רביעי" },
  { index: 4, label: "חמישי" },
  { index: 5, label: "שישי" },
  { index: 6, label: "שבת" },
] as const;

export function asTemplate(value: unknown): ToolTemplate {
  return value === "action" || value === "thought" || value === "tracking"
    ? value
    : "tracking";
}

export function asTriangleTypes(value: unknown): TriangleType[] {
  if (!Array.isArray(value)) return [...DEFAULT_TRIANGLE_TYPES];
  const parsed = value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row, index) => ({
      id: typeof row.id === "string" && row.id ? row.id : localId("tri"),
      name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : "סוג חדש",
      color: typeof row.color === "string" && row.color ? row.color : "#94a3b8",
      template: asTemplate(row.template),
      order_index: typeof row.order_index === "number" ? row.order_index : index,
    }));
  return mergeTriangleTypes(parsed);
}

export function mergeTriangleTypes(existing: TriangleType[]): TriangleType[] {
  const map = new Map<string, TriangleType>();
  for (const item of DEFAULT_TRIANGLE_TYPES) map.set(item.id, item);
  for (const item of existing) map.set(item.id, { ...map.get(item.id), ...item });
  return [...map.values()].sort((a, b) => a.order_index - b.order_index);
}

export function asActionSteps(value: unknown): ActionStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: typeof row.id === "string" && row.id ? row.id : localId("step"),
      title: typeof row.title === "string" ? row.title : "",
      done: Boolean(row.done),
    }));
}

export function findTriangle(
  types: TriangleType[],
  id: string | null | undefined,
): TriangleType | undefined {
  if (!id) return undefined;
  return types.find((item) => item.id === id);
}

export function inferTriangleId(
  bubble: Pick<Bubble, "triangle_id" | "is_tracking" | "status">,
): string | null {
  if (bubble.triangle_id) return bubble.triangle_id;
  if (bubble.is_tracking || bubble.status === "active_tracking") return TRI_TRACK;
  if (bubble.status === "focus") return TRI_ACTION;
  if (bubble.status === "deep_thought") return TRI_THOUGHT;
  return null;
}

export function clearTrianglePatch(defaultColor: string): Partial<Bubble> {
  return {
    triangle_id: null,
    color: defaultColor,
    is_tracking: false,
    status: "default",
  };
}

export function trianglePatch(type: TriangleType): Partial<Bubble> {
  const status: BubbleStatus =
    type.template === "tracking"
      ? "active_tracking"
      : type.template === "action"
        ? "focus"
        : "deep_thought";
  return {
    triangle_id: type.id,
    color: type.color,
    is_tracking: type.template === "tracking",
    status,
  };
}

export function nextWeekdayIso(dayIndex: number): string {
  const now = new Date();
  const delta = (dayIndex - now.getDay() + 7) % 7;
  const date = new Date(now);
  date.setDate(now.getDate() + delta);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dueText(item: Pick<Bubble, "due_at" | "due_label">): string {
  if (item.due_label?.trim()) return item.due_label.trim();
  if (!item.due_at) return "";
  const date = item.due_at.slice(0, 10);
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00`).getDay()];
  return weekday ? `עד יום ${weekday.label} · ${date}` : date;
}
