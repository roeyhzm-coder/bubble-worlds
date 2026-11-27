import type { AppSnapshot, Bubble, ToolTemplate, TriangleType } from "../types";
import { groupByTopic, habitTopicList } from "./habitTopics";
import { baseDailyTarget, formatCredit, itemStreak, multiDailyProgress, sessionProgress, trackingProgress } from "./tracking";
import { findTriangle } from "./triangles";
import {
  NEW_HABIT_LABEL,
  TIER_REPORT_LABELS,
  WEEK_LABELS,
  addDays,
  adherenceRate,
  effectiveWeeklyTarget,
  habitFrequency,
  israeliWeekStart,
  normalizeDurationMin,
  weeklyCounts,
  weeklyScorecard,
  type WeeklyScorecard,
} from "./weeklyTracking";

/** Templates that are habits (repeatable, tracked over time). */
export const HABIT_TEMPLATES: readonly ToolTemplate[] = ["tracking", "multi_daily", "counter"];

/** Templates whose check-ins carry dates, so a weekly target can be measured. */
export function supportsWeeklyTarget(template: ToolTemplate | undefined): boolean {
  return template === "tracking" || template === "multi_daily";
}

export interface HabitRow {
  item: Bubble;
  type: TriangleType;
  /** "World › parent list" for orientation. */
  place: string;
  scorecard: WeeklyScorecard | null;
}

export function itemPlace(snapshot: AppSnapshot, item: Bubble): string {
  const world = snapshot.categories.find((c) => c.id === item.category_id)?.name ?? "";
  const parent = item.parent_bubble_id
    ? snapshot.bubbles.find((b) => b.id === item.parent_bubble_id)?.title ?? ""
    : "";
  return [world, parent].filter(Boolean).join(" › ") || "ללא עולם";
}

/** Active habits: non-archived triangle items of a habit template, or any item given a topic. */
export function collectHabits(snapshot: AppSnapshot, today: string): HabitRow[] {
  const rows: HabitRow[] = [];
  for (const item of snapshot.bubbles) {
    if (item.archived) continue;
    const type = findTriangle(snapshot.triangleTypes, item.triangle_id);
    if (!type) continue;
    if (!HABIT_TEMPLATES.includes(type.template) && !item.habit_topic?.trim()) continue;
    rows.push({
      item,
      type,
      place: itemPlace(snapshot, item),
      scorecard: supportsWeeklyTarget(type.template) ? weeklyScorecard(item, today) : null,
    });
  }
  return rows;
}

/** Sessions per week × minutes per session (0 when either is unknown). */
export function weeklyMinutes(row: HabitRow): number {
  const minutes = normalizeDurationMin(row.item.habit_duration_min);
  if (minutes === null) return 0;
  const { template } = row.type;
  if (!supportsWeeklyTarget(template)) return 0;
  const days = habitFrequency(row.item);
  const perDay = template === "multi_daily" ? baseDailyTarget(row.item) : 1;
  return minutes * days * perDay;
}

export interface HabitSummary {
  habits: number;
  topics: number;
  weeklyMinutes: number;
  /** % of habits whose last week (when it applied) met their target, or null with no weekly targets. */
  adherence: number | null;
}

export function summarizeHabits(rows: readonly HabitRow[]): HabitSummary {
  const topics = new Set(rows.map((row) => row.item.habit_topic?.trim().toLocaleLowerCase()).filter(Boolean));
  return {
    habits: rows.length,
    topics: topics.size,
    weeklyMinutes: rows.reduce((sum, row) => sum + weeklyMinutes(row), 0),
    adherence: adherenceRate(rows.map((row) => row.scorecard)),
  };
}

function templateName(template: ToolTemplate): string {
  switch (template) {
    case "tracking":
      return "מעקב הרגל יומי";
    case "multi_daily":
      return "מספר פעמים ביום";
    case "counter":
      return "מונה הזדמנויות";
    case "action":
      return "משימה";
    case "thought":
      return "מחשבה";
  }
}

function frequencyLine(row: HabitRow): string {
  const { item, type } = row;
  const parts: string[] = [];
  const target = effectiveWeeklyTarget(item);
  if (type.template === "counter") {
    const s = sessionProgress(item);
    parts.push(`מונה: ${s.done}/${s.target} פעמים`);
  } else {
    parts.push(target !== null ? `יעד שבועי: ${target} פעמים בשבוע` : "מעקב יומי (ללא יעד שבועי)");
    if (type.template === "multi_daily") {
      const m = multiDailyProgress(item);
      parts.push(`${baseDailyTarget(item)} פעמים ביום`);
      parts.push(`יעד ימים: ${m.target} ימים (התקדמות ${formatCredit(m.credit)}/${m.target}, רצף ${itemStreak(item)})`);
    } else {
      const p = trackingProgress(item);
      parts.push(`יעד ימים: ${p.target} ימים (התקדמות ${p.done}/${p.target}, רצף ${itemStreak(item)})`);
    }
  }
  const minutes = normalizeDurationMin(item.habit_duration_min);
  parts.push(minutes !== null ? `זמן משוער: ${minutes} דקות לפעם` : "זמן משוער: לא הוגדר");
  return parts.join(" | ");
}

function performanceLine(row: HabitRow, today: string): string {
  if (!supportsWeeklyTarget(row.type.template)) return "אין נתוני תאריכים (מונה הזדמנויות)";
  if (row.scorecard) {
    return row.scorecard.weeks
      .map((week, i) => {
        if (!week.applicable) return `${WEEK_LABELS[i]}: ${NEW_HABIT_LABEL} (טרם התחיל)`;
        return `${WEEK_LABELS[i]}: ${week.count}/${week.target} (${TIER_REPORT_LABELS[week.tier]})`;
      })
      .join(" | ");
  }
  const counts = weeklyCounts(row.item.tracking_history ?? [], today);
  const current = israeliWeekStart(today);
  return WEEK_LABELS.map((label, i) => `${label}: ${counts.get(addDays(current, -7 * i)) ?? 0} ימים`).join(" | ");
}

function oneLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, " / ").trim();
}

export function buildHabitReport(snapshot: AppSnapshot, today: string, candidate: string): string {
  const rows = collectHabits(snapshot, today);
  const summary = summarizeHabits(rows);
  const topics = habitTopicList(snapshot.habitTopics);
  const lines: string[] = [];
  lines.push("# ביקורת מערך ההרגלים שלי (Habit Stack Audit)");
  lines.push(`תאריך: ${today}`);
  lines.push("");
  lines.push("## סיכום");
  lines.push(`- הרגלים פעילים: ${summary.habits}`);
  lines.push(`- תחומים מכוסים: ${summary.topics}`);
  lines.push(`- זמן שבועי משוער: ${summary.weeklyMinutes} דקות (${formatCredit(Math.round((summary.weeklyMinutes / 60) * 10) / 10)} שעות)`);
  lines.push(
    `- עמידה ביעדים שבועיים (שבוע שעבר): ${summary.adherence === null ? "אין יעדים שבועיים מוגדרים" : `${summary.adherence}%`}`,
  );
  lines.push("- שבוע = ראשון עד שבת.");
  lines.push("");
  lines.push("## ההרגלים לפי תחום");
  for (const group of groupByTopic(rows.map((row) => ({ ...row, habit_topic: row.item.habit_topic })), topics)) {
    lines.push("");
    lines.push(`### תחום: ${group.label} (${group.items.length})`);
    for (const row of group.items) {
      lines.push("");
      lines.push(`#### ${row.item.title.trim() || "ללא שם"}`);
      lines.push(`- מיקום: ${row.place} · סוג: ${row.type.name} (${templateName(row.type.template)})`);
      lines.push(`- למה / תועלת: ${row.item.habit_why?.trim() ? oneLine(row.item.habit_why) : "לא הוגדר"}`);
      if (row.item.notes?.trim()) lines.push(`- הערות / הסכם אישי: ${oneLine(row.item.notes)}`);
      lines.push(`- תדירות, משך ויעד: ${frequencyLine(row)}`);
      lines.push(`- ביצוע בפועל (השבוע ושבוע שעבר): ${performanceLine(row, today)}`);
    }
  }
  if (rows.length === 0) lines.push("", "(אין עדיין הרגלים פעילים)");
  const idea = candidate.trim();
  if (idea) {
    lines.push("");
    lines.push("## הרגל חדש שאני שוקל להוסיף:");
    lines.push(oneLine(idea));
  }
  lines.push("");
  lines.push("## מה אני מבקש ממך");
  lines.push("אתה יועץ הרגלים ותפוקה. נתח את מערך ההרגלים שלמעלה והחזר תשובה מסודרת בעברית:");
  lines.push("1. חפיפות וסתירות: אילו הרגלים חופפים, מתחרים על אותו זמן/אנרגיה, או סותרים זה את זה?");
  lines.push("2. הרגלים עם עמידה נמוכה ביעד: מה לפשט, להחליף, לצמצם או לוותר עליו — ולמה?");
  lines.push("3. עומס כולל: הערך את העומס הקוגניטיבי והפיזי השבועי (כולל הזמן המשוער) והאם הוא בר-קיימא.");
  lines.push("4. אופטימיזציה: איך לשרשר הרגלים (habit stacking), לתזמן אותם ביום, ולמקסם את ההשפעה.");
  if (idea) lines.push("5. ההרגל החדש: האם להוסיף אותו, איך לשלב אותו במערך הקיים, ומה כדאי להוריד או להקל בשבילו?");
  lines.push("סיים ב-3 צעדים מעשיים ומדויקים לשבוע הקרוב.");
  return lines.join("\n");
}
