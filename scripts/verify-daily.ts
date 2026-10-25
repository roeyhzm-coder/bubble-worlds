// Build-time checks for the daily-task merge (run by `npm run build` before bundling).
// Node strips the types; only daily.ts is loaded, and it has no runtime imports.
import {
  DAILY_SLOT_COUNT,
  applyDailyRollover,
  dateTasks,
  mergeDailyTasks,
} from "../src/lib/daily.ts";
import type { DailyTask } from "../src/types.ts";

function key(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const now = new Date();
const today = key(now);
const yesterday = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures += 1;
}

function task(id: string, text: string, date: string, extra: Partial<DailyTask> = {}): DailyTask {
  return { id, text, completed: false, date, rollover_count: 0, order_index: 0, updated_at: 0, ...extra };
}

// 1. A rolled-over "!" task deleted today stays deleted against a stale cloud copy.
{
  const stale = [task("day-x", "להתקשר לבנק", yesterday, { rollover_count: 1, updated_at: 1000 })];
  const deleted = new Set(["day-x"]);
  const local = applyDailyRollover([], today, { deleted });
  const a = mergeDailyTasks(stale, local, deleted);
  const b = mergeDailyTasks(local, stale, deleted);
  const resurrected = [...a, ...b].some((item) => item.id === "day-x" || item.text === "להתקשר לבנק");
  check("deleted rolled-over task never returns (both merge orders)", !resurrected);
}

// 2. Two devices that each opened the same new day merge into exactly 6 slots.
{
  const deviceA = applyDailyRollover([task("day-old", "", yesterday)], today);
  const deviceB = applyDailyRollover([task("day-old2", "", yesterday)], today);
  const merged = dateTasks(mergeDailyTasks(deviceA, deviceB), today);
  check(
    `two fresh devices merge to ${DAILY_SLOT_COUNT} slots`,
    merged.length === DAILY_SLOT_COUNT,
    `got ${merged.length}`,
  );
}

// 3. Legacy random-id blanks from two devices are trimmed back to 6 rows, text kept.
{
  const blanks = (prefix: string) =>
    Array.from({ length: 5 }, (_, n) => task(`${prefix}-${n}`, "", today, { order_index: n + 1 }));
  const deviceA = [task("day-t1", "אימון", today), ...blanks("day-a")];
  const deviceB = [task("day-t2", "קניות", today), ...blanks("day-b")];
  const merged = dateTasks(mergeDailyTasks(deviceA, deviceB), today);
  const texts = merged.filter((item) => item.text.trim()).length;
  check("12 legacy rows collapse to 6 (2 text + 4 blank)", merged.length === 6 && texts === 2, `got ${merged.length}/${texts}`);
}

// 4. Clearing a task at 10:05 beats the 08:00 copy with text.
{
  const stale = [task("day-s", "ישן", today, { updated_at: 8 })];
  const cleared = [task("day-s", "", today, { updated_at: 10 })];
  const merged = mergeDailyTasks(cleared, stale).find((item) => item.id === "day-s");
  check("newer clear wins over older text", merged?.text === "", JSON.stringify(merged));
}

// 5. A late device's fresh blank slot never wipes a slot typed on another device.
{
  const late = applyDailyRollover([], today);
  const typedId = late[0].id;
  const typed = [{ ...late[0], text: "לכתוב", updated_at: 5 }, ...late.slice(1)];
  const merged = mergeDailyTasks(typed, late).find((item) => item.id === typedId);
  check("typed slot survives a blank deterministic slot", merged?.text === "לכתוב", JSON.stringify(merged));
}

// 6. The same carried-over text under two ids shows once.
{
  const rows = [
    task("day-1", "מתכון", today, { rollover_count: 2, updated_at: 3 }),
    task("day-2", "מתכון ", today, { rollover_count: 1, updated_at: 1 }),
  ];
  const merged = dateTasks(applyDailyRollover(rows, today), today).filter((item) => item.text.trim());
  check("duplicate carried-over text is deduplicated", merged.length === 1 && merged[0].id === "day-1");
}

if (failures) {
  console.error(`verify-daily: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("verify-daily: all checks passed");
