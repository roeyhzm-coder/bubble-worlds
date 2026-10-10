import type { Bubble, StreakMode } from "../types";
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

export function trackingProgress(bubble: Bubble): {
  done: number;
  target: number;
  ratio: number;
} {
  const done = uniqueSorted(bubble.tracking_history ?? []).length;
  const target = Math.max(1, bubble.target_days || 1);
  return { done, target, ratio: Math.min(1, done / target) };
}

export function computeStreak(
  history: string[],
  mode: StreakMode,
  weeklyFrequency: number,
): number {
  const days = uniqueSorted(history);
  if (days.length === 0) return 0;
  if (mode === "cumulative") return days.length;

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
    if (mode === "flexible") {
      const allowedGap = Math.max(1, 8 - weeklyFrequency);
      if (gap <= allowedGap) {
        streak += 1;
        continue;
      }
    }
    break;
  }
  return streak;
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
