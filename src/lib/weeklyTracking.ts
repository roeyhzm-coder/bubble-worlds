// Weekly-target scorecard (Israeli Sun–Sat weeks). Pure and import-free so the
// build-time verify script can load it directly under Node's type stripping.

export type WeekVerdict = "perfect" | "met" | "close" | "below" | "progress";

export interface WeekStat {
  /** Sunday of the week (YYYY-MM-DD). */
  start: string;
  /** Saturday of the week (YYYY-MM-DD). */
  end: string;
  count: number;
  target: number;
  /** False only for the current (still open) week. */
  closed: boolean;
  verdict: WeekVerdict;
  /** count / target, capped at 1, for progress bars. */
  ratio: number;
}

export interface WeeklyScorecard {
  target: number;
  /** [current week, last week, 2 weeks ago, 3 weeks ago]. */
  weeks: WeekStat[];
}

export const WEEK_LABELS = ["השבוע", "שבוע שעבר", "לפני שבועיים", "לפני 3 שבועות"] as const;
export const WEEKLY_TARGET_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export const VERDICT_LABELS: Record<WeekVerdict, string> = {
  perfect: "מושלם",
  met: "עמדת ביעד",
  close: "טוב — כמעט",
  below: "מתחת ליעד",
  progress: "בתהליך",
};

/** Third-person wording for the AI report. */
export const VERDICT_REPORT_LABELS: Record<WeekVerdict, string> = {
  perfect: "מושלם",
  met: "עמד ביעד",
  close: "טוב — כמעט",
  below: "מתחת ליעד",
  progress: "בתהליך",
};

/**
 * Light-theme classes only: the app has no dark theme and Tailwind's media-based `dark:`
 * variants would recolor these chips on a dark-mode phone while the rest of the UI stays light.
 */
export const VERDICT_STYLES: Record<WeekVerdict, { chip: string; bar: string; dot: string }> = {
  perfect: { chip: "bg-teal-500/15 text-teal-600 border-teal-500/40", bar: "bg-teal-500", dot: "bg-teal-500" },
  met: { chip: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  close: { chip: "bg-amber-500/15 text-amber-700 border-amber-500/40", bar: "bg-amber-500", dot: "bg-amber-500" },
  below: { chip: "bg-rose-500/10 text-rose-600 border-rose-500/30", bar: "bg-rose-400", dot: "bg-rose-400" },
  progress: { chip: "bg-sky-500/10 text-sky-700 border-sky-500/30", bar: "bg-sky-500", dot: "bg-sky-400" },
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(key: string, days: number): string {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return localDayKey(date);
}

/** Sunday (local time) of the week containing `key`. */
export function israeliWeekStart(key: string): string {
  const date = parseDay(key);
  date.setDate(date.getDate() - date.getDay());
  return localDayKey(date);
}

/** 1–7, or null for "no weekly quota" (anything else that was stored). */
export function normalizeWeeklyTarget(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= 7 ? rounded : null;
}

/** Positive minutes (max 24h), or null. */
export function normalizeDurationMin(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 1 ? Math.min(1440, rounded) : null;
}

export function weekVerdict(count: number, target: number, closed: boolean): WeekVerdict {
  if (count > target || (count === target && target >= 6)) return "perfect";
  if (count === target) return "met";
  if ((target - count === 1 && target >= 3) || count / target >= 0.75) return "close";
  return closed ? "below" : "progress";
}

/**
 * Distinct completed days per Sun–Sat week. `tracking_history` already holds one entry per
 * fully completed day for both the habit tracker and the multi-daily (Cyan) template, which
 * mirrors a day into it only once that day's count reaches its target, so partial days don't count.
 */
export function weeklyCounts(history: readonly string[], today: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const day of new Set(history)) {
    if (!DAY_KEY.test(day) || day > today) continue;
    const week = israeliWeekStart(day);
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  return counts;
}

/** Current week + the last 3 closed weeks, or null when the item has no weekly target. */
export function weeklyScorecard(
  item: { tracking_history?: readonly string[]; weekly_target?: number | null },
  today: string,
): WeeklyScorecard | null {
  const target = normalizeWeeklyTarget(item.weekly_target);
  if (target === null) return null;
  const counts = weeklyCounts(item.tracking_history ?? [], today);
  const current = israeliWeekStart(today);
  const weeks: WeekStat[] = [0, 1, 2, 3].map((back) => {
    const start = addDays(current, -7 * back);
    const count = counts.get(start) ?? 0;
    const closed = back > 0;
    return {
      start,
      end: addDays(start, 6),
      count,
      target,
      closed,
      verdict: weekVerdict(count, target, closed),
      ratio: Math.min(1, count / target),
    };
  });
  return { target, weeks };
}

/** Share of closed weeks (of the last 3) that met or beat the target, or null if none apply. */
export function adherenceRate(cards: readonly (WeeklyScorecard | null)[]): number | null {
  let hit = 0;
  let total = 0;
  for (const card of cards) {
    if (!card) continue;
    for (const week of card.weeks) {
      if (!week.closed) continue;
      total += 1;
      if (week.count >= week.target) hit += 1;
    }
  }
  return total ? Math.round((hit / total) * 100) : null;
}
