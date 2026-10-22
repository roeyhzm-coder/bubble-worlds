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

function isBlank(task: Pick<DailyTask, "text">): boolean {
  return !task.text || task.text.trim() === "";
}

/**
 * Keeps every row with text; blank rows are capped so the date shows at most
 * DAILY_SLOT_COUNT rows in total (the earliest blanks survive).
 */
function capBlankSlots(rows: DailyTask[]): DailyTask[] {
  const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
  let blankRoom = Math.max(0, DAILY_SLOT_COUNT - sorted.filter((item) => !isBlank(item)).length);
  return sorted.filter((item) => {
    if (!isBlank(item)) return true;
    if (blankRoom <= 0) return false;
    blankRoom -= 1;
    return true;
  });
}

function padSlots(rows: DailyTask[], date: string): DailyTask[] {
  const padded = rows.map((item, order_index) => ({ ...item, order_index }));
  while (padded.length < DAILY_SLOT_COUNT) padded.push(emptyDailyTask(date, padded.length));
  return padded;
}

export interface DailyNormalizeOptions {
  /** Drop blank rows that push a date past DAILY_SLOT_COUNT (load + cloud merge). */
  trimBlanks?: boolean;
}

/**
 * Past dates: blank rows are purged, completed rows stay as the archive, and unfinished
 * rows with text roll into today (+1 rollover). Today is padded to DAILY_SLOT_COUNT only
 * on a new day (something rolled or was purged) or when it has no rows at all, so manual
 * deletes below 6 stick.
 */
export function applyDailyRollover(
  tasks: DailyTask[],
  today = todayKey(),
  { trimBlanks = true }: DailyNormalizeOptions = {},
): DailyTask[] {
  const rolled: DailyTask[] = [];
  const todayItems: DailyTask[] = [];
  const archive: DailyTask[] = [];
  const future = new Map<string, DailyTask[]>();
  let newDay = false;

  for (const task of tasks) {
    if (task.date > today) {
      future.set(task.date, [...(future.get(task.date) ?? []), task]);
      continue;
    }
    if (task.date === today) {
      todayItems.push(task);
      continue;
    }
    if (isBlank(task)) {
      newDay = true;
      continue;
    }
    if (task.completed) {
      archive.push(task);
      continue;
    }
    newDay = true;
    rolled.push({
      ...task,
      date: today,
      rollover_count: task.rollover_count + 1,
    });
  }

  const rolledIds = new Set(rolled.map((item) => item.id));
  let combined = [
    ...rolled.sort((a, b) => a.order_index - b.order_index),
    ...todayItems
      .filter((item) => !rolledIds.has(item.id))
      .sort((a, b) => a.order_index - b.order_index),
  ].map((item, order_index) => ({ ...item, order_index }));

  if (trimBlanks || newDay) combined = capBlankSlots(combined);
  if (newDay || combined.length === 0) combined = padSlots(combined, today);

  const futureRows = [...future.values()].flatMap((rows) =>
    trimBlanks ? capBlankSlots(rows) : rows,
  );

  return [
    ...combined,
    ...archive.sort((a, b) => b.date.localeCompare(a.date) || a.order_index - b.order_index),
    ...futureRows,
  ];
}

export function tomorrowKey(from = new Date()): string {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  return todayKey(next);
}

export function dateTasks(tasks: DailyTask[], date: string): DailyTask[] {
  return tasks
    .filter((item) => item.date === date)
    .sort((a, b) => a.order_index - b.order_index);
}

export function todayTasks(tasks: DailyTask[], today = todayKey()): DailyTask[] {
  return dateTasks(tasks, today);
}

export function archivedTasks(tasks: DailyTask[], today = todayKey()): DailyTask[] {
  return tasks
    .filter((item) => item.date < today && item.completed && item.text.trim())
    .sort((a, b) => b.date.localeCompare(a.date) || a.order_index - b.order_index)
    .slice(0, 21);
}

/** Fits a date to DAILY_SLOT_COUNT rows: pads blanks, trims surplus blanks, never drops text. */
export function ensureDateSlots(tasks: DailyTask[], date: string): DailyTask[] {
  const fitted = padSlots(capBlankSlots(dateTasks(tasks, date)), date);
  return [...tasks.filter((item) => item.date !== date), ...fitted];
}

export function ensureTodaySlots(tasks: DailyTask[], today = todayKey()): DailyTask[] {
  return ensureDateSlots(tasks, today);
}

export function bangs(count: number): string {
  if (count <= 0) return "";
  return "!".repeat(Math.min(count, 8));
}
