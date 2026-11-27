// Weekly-target scorecard (Israeli Sun–Sat weeks). Pure and import-free so the
// build-time verify script can load it directly under Node's type stripping.

/**
 * Progressive color ladder driven by the completion count against the weekly target:
 * zero → one → two → three (still below target) → met (count === target) → exceeded.
 */
export type WeekTier = "zero" | "one" | "two" | "three" | "met" | "exceeded";

export interface WeekStat {
  /** Sunday of the week (YYYY-MM-DD). */
  start: string;
  /** Saturday of the week (YYYY-MM-DD). */
  end: string;
  count: number;
  target: number;
  /** False only for the current (still open) week. */
  closed: boolean;
  /**
   * False when the habit started after this week ended (a brand-new habit), so the week is
   * shown as "הרגל חדש" instead of a missed 0/X.
   */
  applicable: boolean;
  tier: WeekTier;
  /** count / target, capped at 1, for progress bars. */
  ratio: number;
}

export interface WeeklyScorecard {
  target: number;
  /** Exactly two weeks: [current week, last week]. */
  weeks: WeekStat[];
}

export const WEEK_COUNT = 2;
export const WEEK_LABELS = ["השבוע", "שבוע שעבר"] as const;
export const WEEKLY_TARGET_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
export const NEW_HABIT_LABEL = "הרגל חדש";
/** The unified frequency control's "no weekly quota" option. */
export const EVERY_DAY_LABEL = "כל יום (רגיל)";

export const TIER_LABELS: Record<WeekTier, string> = {
  zero: "לא בוצע",
  one: "התחלה",
  two: "בתנופה",
  three: "התקדמות טובה",
  met: "עמדת ביעד",
  exceeded: "מעל היעד",
};

/** Third-person wording for the AI report. */
export const TIER_REPORT_LABELS: Record<WeekTier, string> = {
  zero: "לא בוצע",
  one: "התחלה",
  two: "בתנופה",
  three: "התקדמות טובה",
  met: "עמד ביעד",
  exceeded: "מעל היעד",
};

/**
 * The `dark:` variants only apply under Tailwind's class strategy (tailwind.config.js), which
 * the app never toggles today, so a dark-mode phone keeps the same light chips as the rest of the UI.
 */
export const TIER_STYLES: Record<WeekTier, { chip: string; bar: string; dot: string }> = {
  zero: {
    chip: "bg-stone-200/90 text-stone-600 border-stone-300 dark:bg-stone-800/80 dark:text-stone-400 dark:border-stone-700",
    bar: "bg-stone-400",
    dot: "bg-stone-400",
  },
  one: {
    chip: "bg-orange-100/80 text-orange-800 border-orange-300/70 dark:bg-orange-950/45 dark:text-orange-300 dark:border-orange-800/60",
    bar: "bg-orange-400",
    dot: "bg-orange-400",
  },
  two: {
    chip: "bg-amber-100/90 text-amber-800 border-amber-300/80 dark:bg-amber-950/45 dark:text-amber-300 dark:border-amber-700/60",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
  },
  three: {
    chip: "bg-lime-100/90 text-lime-800 border-lime-300/80 dark:bg-lime-950/45 dark:text-lime-300 dark:border-lime-700/60",
    bar: "bg-lime-500",
    dot: "bg-lime-500",
  },
  met: {
    chip: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500/40",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  exceeded: {
    chip: "bg-teal-500/15 text-teal-700 border-teal-500/50 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-500/50",
    bar: "bg-teal-500",
    dot: "bg-teal-500",
  },
};

/** Neutral chip for a week before the habit existed. */
export const NEW_HABIT_STYLE = "bg-slate-50 text-slate-500 border-slate-200 border-dashed";

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

interface FrequencySource {
  weekly_target?: number | null;
  weekly_frequency?: number;
}

/**
 * The single weekly target for a habit. `weekly_target` (bubble_extras) wins; otherwise a legacy
 * `weekly_frequency` of 1–6 set through the retired "⚡ תדירות" picker is read as the target, so
 * old choices keep working without rewriting any stored data. 7 / unset = every day, no quota.
 */
export function effectiveWeeklyTarget(item: FrequencySource): number | null {
  const target = normalizeWeeklyTarget(item.weekly_target);
  if (target !== null) return target;
  const legacy = normalizeWeeklyTarget(item.weekly_frequency);
  return legacy !== null && legacy < 7 ? legacy : null;
}

/** Days per week the streak logic expects (7 = every day). */
export function habitFrequency(item: FrequencySource): number {
  return effectiveWeeklyTarget(item) ?? 7;
}

/**
 * Patch for the unified frequency control: both fields move together so the streak (column)
 * and the scorecard (extras) can never disagree again. `null` = every day, no weekly quota.
 */
export function weeklyTargetPatch(target: number | null): { weekly_target: number | null; weekly_frequency: number } {
  const next = normalizeWeeklyTarget(target);
  return { weekly_target: next, weekly_frequency: next ?? 7 };
}

/** Positive minutes (max 24h), or null. */
export function normalizeDurationMin(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 1 ? Math.min(1440, rounded) : null;
}

/** Color tier for `count` completions against `target` (see WeekTier). */
export function weekTier(count: number, target: number): WeekTier {
  const goal = Math.max(1, Math.round(target));
  const done = Math.max(0, Math.round(count));
  if (done > goal) return "exceeded";
  if (done === goal) return "met";
  if (done === 0) return "zero";
  // A single step short of a small target (1 of 2) already reads as "building momentum".
  if (done === 1) return goal <= 2 ? "two" : "one";
  if (done === 2) return "two";
  return "three";
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

/**
 * First day the habit existed: the earlier of its creation day and its oldest check-in
 * (imported or back-filled history can predate `created_at`). Null when neither is known.
 */
export function habitStartDay(item: { created_at?: string; tracking_history?: readonly string[] }): string | null {
  let start: string | null = null;
  if (typeof item.created_at === "string" && item.created_at) {
    const created = DAY_KEY.test(item.created_at) ? parseDay(item.created_at) : new Date(item.created_at);
    if (!Number.isNaN(created.getTime())) start = localDayKey(created);
  }
  for (const day of item.tracking_history ?? []) {
    if (DAY_KEY.test(day) && (start === null || day < start)) start = day;
  }
  return start;
}

/** Current week + last week, or null when the item has no weekly target. */
export function weeklyScorecard(
  item: {
    tracking_history?: readonly string[];
    weekly_target?: number | null;
    weekly_frequency?: number;
    created_at?: string;
  },
  today: string,
): WeeklyScorecard | null {
  const target = effectiveWeeklyTarget(item);
  if (target === null) return null;
  const counts = weeklyCounts(item.tracking_history ?? [], today);
  const current = israeliWeekStart(today);
  const start = habitStartDay(item);
  const weeks: WeekStat[] = Array.from({ length: WEEK_COUNT }, (_, back) => {
    const weekStart = addDays(current, -7 * back);
    const end = addDays(weekStart, 6);
    const count = counts.get(weekStart) ?? 0;
    return {
      start: weekStart,
      end,
      count,
      target,
      closed: back > 0,
      // The current week always applies; an earlier week only if the habit existed by its end.
      applicable: back === 0 || start === null || start <= end,
      tier: weekTier(count, target),
      ratio: Math.min(1, count / target),
    };
  });
  return { target, weeks };
}

/** True for a habit whose only tracked week is the current one. */
export function isNewHabit(card: WeeklyScorecard): boolean {
  return card.weeks.slice(1).every((week) => !week.applicable);
}

/** Share of applicable closed weeks (last week) that met or beat the target, or null if none apply. */
export function adherenceRate(cards: readonly (WeeklyScorecard | null)[]): number | null {
  let hit = 0;
  let total = 0;
  for (const card of cards) {
    if (!card) continue;
    for (const week of card.weeks) {
      if (!week.closed || !week.applicable) continue;
      total += 1;
      if (week.count >= week.target) hit += 1;
    }
  }
  return total ? Math.round((hit / total) * 100) : null;
}
