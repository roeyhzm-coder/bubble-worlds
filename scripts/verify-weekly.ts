// Build-time checks for weekly habit tracking (run by `npm run verify` before bundling).
// Node strips the types; weeklyTracking.ts is import-free and rows.ts only loads types.ts.
import {
  WEEK_LABELS,
  adherenceRate,
  effectiveWeeklyTarget,
  habitFrequency,
  habitStartDay,
  isNewHabit,
  israeliWeekStart,
  normalizeWeeklyTarget,
  weekTier,
  weeklyScorecard,
  weeklyTargetPatch,
  type WeekTier,
} from "../src/lib/weeklyTracking.ts";
import { toBubbleRow } from "../src/lib/rows.ts";
import { BUBBLE_EXTRA_KEYS, type Bubble } from "../src/types.ts";

let failures = 0;
function check(name: string, ok: boolean): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures += 1;
}

// Thursday 2026-11-26: current week Sun 22.11 – Sat 28.11, last week 15.11 – 21.11.
const TODAY = "2026-11-26";

// Sun–Sat weeks and tolerant parsing.
{
  check("week starts on Sunday", israeliWeekStart(TODAY) === "2026-11-22" && israeliWeekStart("2026-11-22") === "2026-11-22");
  check("Saturday stays in its week", israeliWeekStart("2026-11-28") === "2026-11-22");
  check("weekly target outside 1–7 is ignored", normalizeWeeklyTarget(0) === null && normalizeWeeklyTarget(9) === null && normalizeWeeklyTarget("3") === null);
}

// Exactly two weeks: this week + last week.
{
  const card = weeklyScorecard(
    {
      weekly_target: 3,
      created_at: "2026-10-01T08:00:00.000Z",
      tracking_history: ["2026-11-22", "2026-11-23", "2026-11-23", "2026-11-17", "2026-11-08", "2026-12-30"],
    },
    TODAY,
  );
  check("only 2 week labels", WEEK_LABELS.length === 2 && WEEK_LABELS[0] === "השבוע" && WEEK_LABELS[1] === "שבוע שעבר");
  check("scorecard returns exactly 2 weeks", card?.weeks.length === 2);
  check(
    "weeks are the current Sun–Sat week then last week",
    card?.weeks[0]?.start === "2026-11-22" && card.weeks[0].end === "2026-11-28" && card.weeks[1]?.start === "2026-11-15",
  );
  check("counts distinct past days per week (future + older weeks ignored)", card?.weeks[0]?.count === 2 && card.weeks[1]?.count === 1);
  check("current week is open, last week closed", card?.weeks[0]?.closed === false && card.weeks[1]?.closed === true);
  check("established habit: both weeks apply", card?.weeks.every((week) => week.applicable) === true && !isNewHabit(card));
  check("no target means no scorecard", weeklyScorecard({ tracking_history: ["2026-11-22"] }, TODAY) === null);
}

// New-habit grace: a habit created 4 days ago (this week) is never a 0/X miss for last week.
{
  const created = new Date(2026, 10, 22, 9, 30).toISOString(); // Sunday, 4 days before TODAY
  const card = weeklyScorecard({ weekly_target: 4, created_at: created, tracking_history: ["2026-11-24"] }, TODAY);
  check("habit start = creation day", habitStartDay({ created_at: created }) === "2026-11-22");
  check("new habit: last week is not applicable", card?.weeks[1]?.applicable === false && card.weeks[0]?.applicable === true);
  check("new habit flagged as new", card !== null && isNewHabit(card));
  check("new habit's empty last week doesn't hurt adherence", adherenceRate([card]) === null);
  const backfilled = weeklyScorecard({ weekly_target: 4, created_at: created, tracking_history: ["2026-11-19"] }, TODAY);
  check("older check-ins make last week applicable again", backfilled?.weeks[1]?.applicable === true && backfilled.weeks[1].count === 1);
  const lastSaturday = weeklyScorecard({ weekly_target: 2, created_at: new Date(2026, 10, 21, 20).toISOString() }, TODAY);
  check("habit created during last week still counts last week", lastSaturday?.weeks[1]?.applicable === true);
  const legacy = weeklyScorecard({ weekly_target: 2, tracking_history: [] }, TODAY);
  check("unknown start never hides a week", legacy?.weeks[1]?.applicable === true);
}

// Progressive color ladder.
{
  const tiers = (target: number, counts: number[]): WeekTier[] => counts.map((count) => weekTier(count, target));
  const five = tiers(5, [0, 1, 2, 3, 4, 5, 6]);
  check("target 5 ladder", five.join() === ["zero", "one", "two", "three", "three", "met", "exceeded"].join());
  check("0/1/2/3/target/>target are distinct tiers", new Set([five[0], five[1], five[2], five[3], five[5], five[6]]).size === 6);
  check("target 2 ladder", tiers(2, [0, 1, 2, 3]).join() === ["zero", "two", "met", "exceeded"].join());
  check("target 3 ladder", tiers(3, [0, 1, 2, 3, 4]).join() === ["zero", "one", "two", "met", "exceeded"].join());
  check("target 1 ladder", tiers(1, [0, 1, 2]).join() === ["zero", "met", "exceeded"].join());
  check("target 7 ladder", tiers(7, [3, 6, 7]).join() === ["three", "three", "met"].join());
}

// Unified frequency: legacy weekly_frequency is read as the target, the control writes both fields.
{
  check("weekly_target wins over legacy frequency", effectiveWeeklyTarget({ weekly_target: 4, weekly_frequency: 2 }) === 4);
  check("legacy frequency 1–6 becomes the target", effectiveWeeklyTarget({ weekly_frequency: 3 }) === 3);
  check("frequency 7 = every day, no quota", effectiveWeeklyTarget({ weekly_frequency: 7 }) === null && habitFrequency({ weekly_frequency: 7 }) === 7);
  check("legacy-only habit still gets a scorecard", weeklyScorecard({ weekly_frequency: 3, tracking_history: [] }, TODAY)?.target === 3);
  const none = weeklyTargetPatch(null);
  const three = weeklyTargetPatch(3);
  check("every-day option clears both fields", none.weekly_target === null && none.weekly_frequency === 7);
  check("a target sets both fields", three.weekly_target === 3 && three.weekly_frequency === 3);
}

// toBubbleRow strips every bubble_extras key (no new columns ever reach bw_bubbles).
{
  const bubble = {
    id: "b1",
    parent_bubble_id: null,
    category_id: "c1",
    title: "ריצה",
    notes: "",
    color: "#000",
    status: "active",
    position_x: 0,
    position_y: 0,
    size_multiplier: 1,
    created_at: "2026-11-22T09:30:00.000Z",
    is_tracking: true,
    target_days: 120,
    weekly_frequency: 3,
    tracking_history: ["2026-11-24"],
    streak_mode: "strict",
    weekly_target: 3,
    habit_topic: "כושר",
    habit_why: "בריאות",
    habit_duration_min: 30,
    challenge_done: false,
    order_index: 2,
    routine_time: "morning",
    extras_updated_at: 123,
  } as unknown as Bubble;
  const row = toBubbleRow(bubble) as Record<string, unknown>;
  const leaked = BUBBLE_EXTRA_KEYS.filter((key) => key in row);
  check(`toBubbleRow strips extras keys (leaked: ${leaked.join(", ") || "none"})`, leaked.length === 0);
  check("toBubbleRow strips the local extras clock", !("extras_updated_at" in row));
  check("toBubbleRow keeps custom day goals and history", row.target_days === 120 && row.weekly_frequency === 3 && Array.isArray(row.tracking_history));
}

if (failures) {
  console.error(`verify-weekly: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("verify-weekly: all checks passed");
