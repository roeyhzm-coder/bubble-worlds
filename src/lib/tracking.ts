import type { Bubble, SessionOutcome, StreakMode, ToolTemplate } from "../types";
import { todayKey } from "./defaults";

function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function dayDiff(a: string, b: string): number {
  const ms = parseDay(b).getTime() - parseDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

function uniqueSorted(history: string[]): string[] {
  return [...new Set(history)].sort();
}

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Sunday-based week start (Israeli week) for a YYYY-MM-DD key. */
export function weekStartKey(key: string): string {
  const date = parseDay(key);
  date.setDate(date.getDate() - date.getDay());
  return dateKey(date);
}

function clampFrequency(value: number): number {
  return Math.min(7, Math.max(1, Math.round(value || 7)));
}

export function trackingProgress(bubble: Bubble): {
  done: number;
  target: number;
  ratio: number;
} {
  const logged = uniqueSorted(bubble.tracking_history ?? []).length;
  const done = Math.max(0, logged + (bubble.done_offset ?? 0));
  const target = Math.max(1, bubble.target_days || 1);
  return { done, target, ratio: Math.min(1, done / target) };
}

export function weeklyProgress(bubble: Bubble): { done: number; target: number; left: number } {
  const today = todayKey();
  const start = weekStartKey(today);
  const done = uniqueSorted(bubble.tracking_history ?? []).filter(
    (day) => day >= start && day <= today,
  ).length;
  return {
    done,
    target: clampFrequency(bubble.weekly_frequency),
    left: 7 - parseDay(today).getDay(),
  };
}

export const DEFAULT_SESSION_TARGET = 10;

/** Counter template: opportunities taken vs. the goal (no dates involved). */
export function sessionProgress(bubble: Bubble): { done: number; target: number; ratio: number } {
  const done = Math.max(0, Math.round(bubble.session_count ?? 0));
  const target = Math.max(1, Math.round(bubble.session_target || DEFAULT_SESSION_TARGET));
  return { done, target, ratio: Math.min(1, done / target) };
}

export const SESSION_LOG_LIMIT = 50;

export function asSessionLog(value: unknown): SessionOutcome[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is SessionOutcome => entry === "done" || entry === "missed")
    .slice(-SESSION_LOG_LIMIT);
}

/** Counter template: every logged outing (taken + missed) and the conversion rate. */
export function sessionOpportunities(bubble: Bubble): {
  taken: number;
  missed: number;
  total: number;
  accuracy: number | null;
  recent: SessionOutcome[];
} {
  const taken = Math.max(0, Math.round(bubble.session_taken ?? 0));
  const missed = Math.max(0, Math.round(bubble.session_missed ?? 0));
  const total = taken + missed;
  return {
    taken,
    missed,
    total,
    accuracy: total > 0 ? Math.round((taken / total) * 100) : null,
    recent: asSessionLog(bubble.session_log).slice(-10),
  };
}

/** Patch that logs one outing: +1/-1 on the count (min 0) plus the outcome history. */
export function logSessionOutcome(bubble: Bubble, outcome: SessionOutcome): Partial<Bubble> {
  const count = Math.max(0, Math.round(bubble.session_count ?? 0));
  const taken = outcome === "done";
  return {
    session_count: Math.min(100000, Math.max(0, count + (taken ? 1 : -1))),
    session_taken: Math.max(0, Math.round(bubble.session_taken ?? 0)) + (taken ? 1 : 0),
    session_missed: Math.max(0, Math.round(bubble.session_missed ?? 0)) + (taken ? 0 : 1),
    session_log: [...asSessionLog(bubble.session_log), outcome].slice(-SESSION_LOG_LIMIT),
  };
}

export const DEFAULT_DAILY_TARGET = 2;
export const MAX_DAILY = 50;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function clampDaily(value: number, min: number): number {
  return Math.min(MAX_DAILY, Math.max(min, Math.round(value || 0)));
}

/** Sanitizes a YYYY-MM-DD → positive number map (zero / invalid entries are dropped). */
export function asDayMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!DAY_KEY.test(key) || typeof raw !== "number" || !Number.isFinite(raw) || raw < 1) continue;
    out[key] = clampDaily(raw, 1);
  }
  return out;
}

/** Multi-daily template: default times per day for days without their own target. */
export function baseDailyTarget(bubble: Pick<Bubble, "daily_target">): number {
  return clampDaily(bubble.daily_target || DEFAULT_DAILY_TARGET, 1);
}

/** That date's override, else the item's default, else 2. */
export function dayTargetForDate(
  bubble: Pick<Bubble, "daily_target" | "daily_targets_by_date">,
  date: string,
): number {
  const override = bubble.daily_targets_by_date?.[date];
  return override && override > 0 ? clampDaily(override, 1) : baseDailyTarget(bubble);
}

/**
 * Times done on a date. A day checked in before the item had per-day counts (e.g. switched
 * over from the habit tracker) counts as fully done, so converting never loses progress.
 */
export function dayCount(
  bubble: Pick<Bubble, "daily_counts" | "daily_target" | "daily_targets_by_date" | "tracking_history">,
  date: string,
): number {
  const stored = bubble.daily_counts?.[date];
  if (typeof stored === "number") return clampDaily(stored, 0);
  return (bubble.tracking_history ?? []).includes(date) ? dayTargetForDate(bubble, date) : 0;
}

export function isDateComplete(bubble: Bubble, date: string): boolean {
  const target = dayTargetForDate(bubble, date);
  return target > 0 && dayCount(bubble, date) >= target;
}

export function dayProgress(bubble: Bubble, date = todayKey()): { count: number; target: number; complete: boolean } {
  const count = dayCount(bubble, date);
  const target = dayTargetForDate(bubble, date);
  return { count, target, complete: count >= target };
}

/**
 * Patch that sets one date's count and target, then mirrors completion into tracking_history
 * so target days, weekly frequency, streaks and the trophy keep using the shared engine.
 */
export function setDayProgress(bubble: Bubble, date: string, count: number, target: number): Partial<Bubble> {
  const nextCount = clampDaily(count, 0);
  const nextTarget = clampDaily(target, 1);
  const daily_counts = { ...(bubble.daily_counts ?? {}) };
  if (nextCount > 0) daily_counts[date] = nextCount;
  else delete daily_counts[date];
  const daily_targets_by_date = { ...(bubble.daily_targets_by_date ?? {}) };
  if (nextTarget === baseDailyTarget(bubble)) delete daily_targets_by_date[date];
  else daily_targets_by_date[date] = nextTarget;
  const history = bubble.tracking_history ?? [];
  return {
    daily_counts,
    daily_targets_by_date,
    tracking_history: nextCount >= nextTarget ? markDone(history, date) : removeDate(history, date),
  };
}

export type DayAction = "plus" | "minus" | "target_plus" | "target_minus" | "cycle";

/**
 * "plus" past the day's target raises the target with it, so a 3rd session on a 2x day
 * stays a completed 3/3 in one tap. "cycle" steps 0 → target, then back to 0.
 */
export function dayActionPatch(bubble: Bubble, date: string, action: DayAction): Partial<Bubble> {
  const { count, target } = dayProgress(bubble, date);
  switch (action) {
    case "plus":
      return setDayProgress(bubble, date, count + 1, count >= target ? count + 1 : target);
    case "minus":
      return setDayProgress(bubble, date, count - 1, target);
    case "target_plus":
      return setDayProgress(bubble, date, count, target + 1);
    case "target_minus":
      return setDayProgress(bubble, date, count, target - 1);
    case "cycle":
      return setDayProgress(bubble, date, count >= target ? 0 : count + 1, target);
  }
}

/**
 * Changes the default per-day target. Past days keep the target they were logged against
 * (frozen as overrides) so history never flips; today and future days follow the new value.
 */
export function dailyBasePatch(bubble: Bubble, next: number): Partial<Bubble> {
  const base = clampDaily(next, 1);
  const previous = baseDailyTarget(bubble);
  const today = todayKey();
  const daily_targets_by_date = { ...(bubble.daily_targets_by_date ?? {}) };
  if (base !== previous) {
    for (const date of Object.keys(bubble.daily_counts ?? {})) {
      if (date < today && !daily_targets_by_date[date]) daily_targets_by_date[date] = previous;
    }
  }
  if (daily_targets_by_date[today] === base) delete daily_targets_by_date[today];
  const updated: Bubble = { ...bubble, daily_target: base, daily_targets_by_date };
  const history = bubble.tracking_history ?? [];
  const todayStored = typeof bubble.daily_counts?.[today] === "number";
  return {
    daily_target: base,
    daily_targets_by_date,
    // Only re-evaluate today when it has a real count; a legacy check-in stays a check-in.
    ...(todayStored
      ? {
          tracking_history: isDateComplete(updated, today)
            ? markDone(history, today)
            : removeDate(history, today),
        }
      : {}),
  };
}

/** Share of a date's target that was done, capped at 1 (2 of 3 → 0.67 of a day). */
export function dayFraction(bubble: Bubble, date: string): number {
  const target = dayTargetForDate(bubble, date);
  return Math.min(1, dayCount(bubble, date) / target);
}

/** Every date with at least one session (full check-ins included). */
export function activeDays(bubble: Pick<Bubble, "tracking_history" | "daily_counts">): string[] {
  const counted = Object.entries(bubble.daily_counts ?? {})
    .filter(([, count]) => count > 0)
    .map(([date]) => date);
  return uniqueSorted([...(bubble.tracking_history ?? []), ...counted]);
}

/**
 * Multi-daily template: each day earns done/target of a day (max 1), summed into the
 * day goal, so partial days still move the item forward. Rounded to one decimal.
 */
export function multiDailyProgress(bubble: Bubble): {
  credit: number;
  target: number;
  ratio: number;
  today: { count: number; target: number; fraction: number };
} {
  const credit = Math.max(0, Math.round((rawMultiDailyCredit(bubble) + (bubble.done_offset ?? 0)) * 10) / 10);
  const target = Math.max(1, bubble.target_days || 1);
  const { count, target: todayTarget } = dayProgress(bubble);
  return {
    credit,
    target,
    ratio: Math.min(1, credit / target),
    today: { count, target: todayTarget, fraction: Math.min(1, count / todayTarget) },
  };
}

/** Unrounded credit before done_offset, so a manual edit can store the exact difference. */
export function rawMultiDailyCredit(bubble: Bubble): number {
  return activeDays(bubble).reduce((sum, date) => sum + dayFraction(bubble, date), 0);
}

/** "12.6" / "3": one decimal only when it carries information. */
export function formatCredit(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Clears check-ins, per-day counts and per-day targets (the default per-day target is kept). */
export function resetMultiDailyPatch(): Partial<Bubble> {
  return {
    tracking_history: [],
    done_offset: 0,
    streak_offset: 0,
    daily_counts: {},
    daily_targets_by_date: {},
  };
}

/**
 * Weekly-target streak: consecutive weeks that met the target add their check-ins.
 * The current week never breaks the streak while its target can still be reached.
 */
function weeklyStreak(days: string[], frequency: number): number {
  const today = todayKey();
  const counts = new Map<string, number>();
  for (const day of days) {
    if (day > today) continue;
    const week = weekStartKey(day);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const current = weekStartKey(today);
  const currentCount = counts.get(current) ?? 0;
  const openDays = 6 - parseDay(today).getDay() + (days.includes(today) ? 0 : 1);
  if (currentCount + openDays < frequency) return currentCount;
  let streak = currentCount;
  const cursor = parseDay(current);
  for (;;) {
    cursor.setDate(cursor.getDate() - 7);
    const count = counts.get(dateKey(cursor)) ?? 0;
    if (count < frequency) break;
    streak += count;
  }
  return streak;
}

export function computeStreak(
  history: string[],
  mode: StreakMode,
  weeklyFrequency: number,
): number {
  const days = uniqueSorted(history);
  if (days.length === 0) return 0;
  if (mode === "cumulative") return days.length;
  const frequency = clampFrequency(weeklyFrequency);
  if (frequency < 7) return weeklyStreak(days, frequency);

  const today = todayKey();
  const last = days[days.length - 1];
  if (dayDiff(last, today) > 1 && mode === "strict") return 0;

  let streak = 1;
  for (let i = days.length - 1; i > 0; i -= 1) {
    const gap = dayDiff(days[i - 1], days[i]);
    if (gap === 1) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

/** Days with any session count toward the streak (multi-daily partial days included). */
export function itemStreak(bubble: Bubble): number {
  const base = computeStreak(activeDays(bubble), bubble.streak_mode, bubble.weekly_frequency);
  return Math.max(0, base + (bubble.streak_offset ?? 0));
}

/** True when a triangle item reached its goal and unlocks the trophy action. */
export function isItemCompleted(bubble: Bubble, template: ToolTemplate | undefined): boolean {
  if (!template) return false;
  if (template === "action") return Boolean(bubble.action_done);
  if (template === "thought") return Boolean(bubble.challenge_done);
  if (bubble.challenge_done) return true;
  if (template === "multi_daily") {
    const multi = multiDailyProgress(bubble);
    return multi.credit >= multi.target;
  }
  const progress = template === "counter" ? sessionProgress(bubble) : trackingProgress(bubble);
  return progress.done >= progress.target;
}

export function markDone(history: string[], date = todayKey()): string[] {
  return uniqueSorted([...history, date]);
}

export function removeLastDay(history: string[]): string[] {
  const days = uniqueSorted(history);
  days.pop();
  return days;
}

export function removeDate(history: string[], date = todayKey()): string[] {
  return uniqueSorted(history).filter((day) => day !== date);
}

export function toggleDate(history: string[], date: string): string[] {
  return hasDate(history, date) ? removeDate(history, date) : markDone(history, date);
}

export function hasDate(history: string[], date = todayKey()): boolean {
  return uniqueSorted(history).includes(date);
}

export function statusLabel(status: Bubble["status"]): string {
  switch (status) {
    case "active_tracking":
      return "מעקב פעיל";
    case "focus":
      return "בפוקוס כרגע";
    case "deep_thought":
      return "מחשבה עמוקה";
    default:
      return "רגיל";
  }
}

export function streakModeLabel(mode: StreakMode): string {
  switch (mode) {
    case "strict":
      return "רצף קפדני";
    case "flexible":
      return "רצף גמיש";
    case "cumulative":
      return "מצטבר";
  }
}
