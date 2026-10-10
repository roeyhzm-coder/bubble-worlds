import type { DailyTask } from "../types";

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const DAILY_SLOT_COUNT = 6;

export function asDailyTasks(value: unknown): DailyTask[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row, index) => ({
      id: typeof row.id === "string" && row.id ? row.id : newId("day"),
      text: typeof row.text === "string" ? row.text : "",
      completed: Boolean(row.completed),
      date: typeof row.date === "string" && row.date ? row.date : todayKey(),
      rollover_count: Math.max(0, Number(row.rollover_count) || 0),
      order_index: typeof row.order_index === "number" ? row.order_index : index,
    }));
}

export function emptyDailyTask(date: string, order_index: number): DailyTask {
  return {
    id: newId("day"),
    text: "",
    completed: false,
    date,
    rollover_count: 0,
    order_index,
  };
}

export function mergeDailyTasks(local: DailyTask[], remote: DailyTask[]): DailyTask[] {
  const map = new Map<string, DailyTask>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    const newerDate = item.date > prev.date ? item : prev.date > item.date ? prev : null;
    if (newerDate) {
      map.set(item.id, newerDate);
      continue;
    }
    map.set(item.id, {
      ...prev,
      ...item,
      text: item.text || prev.text,
      completed: item.completed || prev.completed,
      rollover_count: Math.max(item.rollover_count, prev.rollover_count),
    });
  }
  return applyDailyRollover([...map.values()]);
}

export function applyDailyRollover(tasks: DailyTask[], today = todayKey()): DailyTask[] {
  const rolled: DailyTask[] = [];
  const todayItems: DailyTask[] = [];
  const archive: DailyTask[] = [];
  const future: DailyTask[] = [];

  for (const task of tasks) {
    if (task.date > today) {
      future.push(task);
      continue;
    }
    if (task.date === today) {
      todayItems.push(task);
      continue;
    }
    if (task.completed) {
      archive.push(task);
      continue;
    }
    if (!task.text.trim()) continue;
    rolled.push({
      ...task,
      date: today,
      rollover_count: task.rollover_count + 1,
    });
  }

  const rolledIds = new Set(rolled.map((item) => item.id));
  const combined = [
    ...rolled.sort((a, b) => a.order_index - b.order_index),
    ...todayItems
      .filter((item) => !rolledIds.has(item.id))
      .sort((a, b) => a.order_index - b.order_index),
  ].map((item, order_index) => ({ ...item, order_index }));

  while (combined.length < DAILY_SLOT_COUNT) {
    combined.push(emptyDailyTask(today, combined.length));
  }

  return [
    ...combined,
    ...archive.sort((a, b) => b.date.localeCompare(a.date) || a.order_index - b.order_index),
    ...future,
  ];
}

export function todayTasks(tasks: DailyTask[], today = todayKey()): DailyTask[] {
  return tasks
    .filter((item) => item.date === today)
    .sort((a, b) => a.order_index - b.order_index);
}

export function archivedTasks(tasks: DailyTask[], today = todayKey()): DailyTask[] {
  return tasks
    .filter((item) => item.date < today && item.completed && item.text.trim())
    .sort((a, b) => b.date.localeCompare(a.date) || a.order_index - b.order_index)
    .slice(0, 21);
}

export function ensureTodaySlots(tasks: DailyTask[], today = todayKey()): DailyTask[] {
  const current = todayTasks(tasks, today);
  if (current.length >= DAILY_SLOT_COUNT) return tasks;
  const extras = Array.from({ length: DAILY_SLOT_COUNT - current.length }, (_, index) =>
    emptyDailyTask(today, current.length + index),
  );
  return [...tasks, ...extras];
}

export function bangs(count: number): string {
  if (count <= 0) return "";
  return "!".repeat(Math.min(count, 8));
}
