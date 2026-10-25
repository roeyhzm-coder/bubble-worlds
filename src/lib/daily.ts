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
      updated_at: typeof row.updated_at === "number" && Number.isFinite(row.updated_at) ? row.updated_at : 0,
    }));
}

/**
 * Default rows get the same id on every device (`day-<date>-slot-<n>`), so two devices that
 * open a new day merge into one set of 6 instead of 12. Ids already used or deleted are skipped.
 */
export function slotId(date: string, taken: ReadonlySet<string>): string {
  for (let n = 0; ; n += 1) {
    const id = `day-${date}-slot-${n}`;
    if (!taken.has(id)) return id;
  }
}

/** A row added with "+" (stamped now). Default slots come from padSlots instead. */
export function emptyDailyTask(date: string, order_index: number): DailyTask {
  return {
    id: newId("day"),
    text: "",
    completed: false,
    date,
    rollover_count: 0,
    order_index,
    updated_at: Date.now(),
  };
}

/**
 * Deleted ids never come back, and on a shared id the newer edit (`updated_at`) wins, so a
 * task cleared or deleted at 10:05 beats the stale 08:00 copy still held by another device.
 * Equal stamps (legacy rows) fall back to the newer date, then a field merge where the second
 * argument wins.
 */
export function mergeDailyTasks(
  local: DailyTask[],
  remote: DailyTask[],
  deleted: ReadonlySet<string> = new Set(),
): DailyTask[] {
  const map = new Map<string, DailyTask>();
  for (const item of local) if (!deleted.has(item.id)) map.set(item.id, item);
  for (const item of remote) {
    if (deleted.has(item.id)) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    const prevStamp = prev.updated_at ?? 0;
    const itemStamp = item.updated_at ?? 0;
    if (prevStamp !== itemStamp) {
      map.set(item.id, itemStamp > prevStamp ? item : prev);
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
  return applyDailyRollover([...map.values()], todayKey(), { deleted });
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

/**
 * Fills a date up to DAILY_SLOT_COUNT with deterministic blank slots. They carry
 * updated_at 0, so a late device's fresh blank never beats a slot already typed elsewhere.
 */
function padSlots(rows: DailyTask[], date: string, taken: ReadonlySet<string>): DailyTask[] {
  const padded = rows.map((item, order_index) => ({ ...item, order_index }));
  const used = new Set([...taken, ...padded.map((item) => item.id)]);
  while (padded.length < DAILY_SLOT_COUNT) {
    const id = slotId(date, used);
    used.add(id);
    padded.push({ ...emptyDailyTask(date, padded.length), id, updated_at: 0 });
  }
  return padded;
}

function textKey(task: Pick<DailyTask, "text">): string {
  return task.text.trim().replace(/\s+/g, " ");
}

/**
 * The same unfinished task carried over under two ids (an old copy from another device)
 * shows once: the newest edit stays, ties keep the higher rollover count.
 */
function dedupeCarriedText(rows: DailyTask[]): DailyTask[] {
  const groups = new Map<string, DailyTask[]>();
  for (const item of rows) {
    if (item.completed || isBlank(item)) continue;
    const key = textKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const drop = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < 2 || !group.some((item) => item.rollover_count > 0)) continue;
    const keep = [...group].sort(
      (a, b) =>
        (b.updated_at ?? 0) - (a.updated_at ?? 0) ||
        b.rollover_count - a.rollover_count ||
        a.order_index - b.order_index,
    )[0];
    for (const item of group) if (item.id !== keep.id) drop.add(item.id);
  }
  return drop.size ? rows.filter((item) => !drop.has(item.id)) : rows;
}

export interface DailyNormalizeOptions {
  /** Drop blank rows that push a date past DAILY_SLOT_COUNT (load + cloud merge). */
  trimBlanks?: boolean;
  /** Tombstoned task ids: dropped, and never reused for a new default slot. */
  deleted?: ReadonlySet<string>;
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
  { trimBlanks = true, deleted = new Set<string>() }: DailyNormalizeOptions = {},
): DailyTask[] {
  const rolled: DailyTask[] = [];
  const todayItems: DailyTask[] = [];
  const archive: DailyTask[] = [];
  const future = new Map<string, DailyTask[]>();
  let newDay = false;

  for (const task of tasks) {
    if (deleted.has(task.id)) continue;
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
  let combined = dedupeCarriedText([
    ...rolled.sort((a, b) => a.order_index - b.order_index),
    ...todayItems
      .filter((item) => !rolledIds.has(item.id))
      .sort((a, b) => a.order_index - b.order_index),
  ]).map((item, order_index) => ({ ...item, order_index }));

  if (trimBlanks || newDay) combined = capBlankSlots(combined);
  if (newDay || combined.length === 0) {
    combined = padSlots(combined, today, new Set([...deleted, ...tasks.map((item) => item.id)]));
  }

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
export function ensureDateSlots(
  tasks: DailyTask[],
  date: string,
  deleted: ReadonlySet<string> = new Set(),
): DailyTask[] {
  const taken = new Set([...deleted, ...tasks.map((item) => item.id)]);
  const fitted = padSlots(capBlankSlots(dateTasks(tasks, date)), date, taken);
  return [...tasks.filter((item) => item.date !== date), ...fitted];
}

export function ensureTodaySlots(
  tasks: DailyTask[],
  today = todayKey(),
  deleted: ReadonlySet<string> = new Set(),
): DailyTask[] {
  return ensureDateSlots(tasks, today, deleted);
}

export function bangs(count: number): string {
  if (count <= 0) return "";
  return "!".repeat(Math.min(count, 8));
}
