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

export function itemStreak(bubble: Bubble): number {
  const base = computeStreak(bubble.tracking_history ?? [], bubble.streak_mode, bubble.weekly_frequency);
  return Math.max(0, base + (bubble.streak_offset ?? 0));
}

/** True when a triangle item reached its goal and unlocks the trophy action. */
export function isItemCompleted(bubble: Bubble, template: ToolTemplate | undefined): boolean {
  if (!template) return false;
  if (template === "action") return Boolean(bubble.action_done);
  if (template === "thought") return Boolean(bubble.challenge_done);
  if (bubble.challenge_done) return true;
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
