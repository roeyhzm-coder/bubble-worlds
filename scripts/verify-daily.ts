// Build-time checks for the daily-task merge (run by `npm run build` before bundling).
// Node strips the types; only daily.ts is loaded, and it has no runtime imports.
import {
  DAILY_SLOT_COUNT,
  applyDailyRollover,
  asDailyTasks,
  dateTasks,
  mergeDailyTasks,
  patchDailyTask,
  reorderDateTasks,
  setDateImportant,
  setDateStars,
  toggleDailyImportant,
  updateDailyTaskDetails,
} from "../src/lib/daily.ts";
import type { DailyTask } from "../src/types.ts";
import {
  asHabitTopics,
  deleteHabitTopic,
  groupByTopic,
  habitTopicList,
  mergeHabitTopics,
  renameHabitTopic,
} from "../src/lib/habitTopics.ts";

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

// 7. Drag-and-drop reorder keeps exactly the same 6 rows, leaves a starred row in its slot,
//    and its newer stamps beat a stale cloud copy of the old order.
{
  const base = applyDailyRollover([], today).map((item, n) => ({
    ...item,
    text: `t${n}`,
    updated_at: 5,
    ...(n === 0 ? { is_black_star: true } : {}),
  }));
  const regularIds = dateTasks(base, today).filter((item) => !item.is_black_star).map((item) => item.id);
  const wanted = [...regularIds].reverse();
  const reordered = reorderDateTasks(base, today, wanted, 99);
  const rows = dateTasks(reordered, today);
  const sameSet = rows.length === DAILY_SLOT_COUNT && new Set(rows.map((item) => item.id)).size === DAILY_SLOT_COUNT;
  const starKept = rows[0].is_black_star === true && rows[0].id === base[0].id;
  const order = rows.filter((item) => !item.is_black_star).map((item) => item.id);
  check("reorder keeps 6 unique rows and the starred slot", sameSet && starKept, JSON.stringify(rows.map((r) => r.id)));
  check("reorder applies the dragged order", JSON.stringify(order) === JSON.stringify(wanted));
  const merged = dateTasks(mergeDailyTasks(reordered, base), today).filter((item) => !item.is_black_star);
  check(
    "new order survives a merge with the stale cloud order",
    merged.length === DAILY_SLOT_COUNT - 1 && JSON.stringify(merged.map((item) => item.id)) === JSON.stringify(wanted),
    JSON.stringify(merged.map((item) => item.id)),
  );
  const bogus = reorderDateTasks(base, today, [regularIds[0], regularIds[0]], 99);
  check("reorder with duplicate / foreign ids is a no-op", bogus === base);
}

// 8. Task notes: parsed from the cloud JSON, kept by reorder / rollover / merge, newest edit wins,
//    and a row holding only a note is never purged or trimmed as a blank slot.
{
  const parsed = asDailyTasks([{ id: "day-n", text: "דוח", date: today, notes: "שלב 1 · שלב 2" }]);
  check("notes are parsed from the daily_tasks JSON", parsed[0]?.notes === "שלב 1 · שלב 2");

  const base = applyDailyRollover([], today).map((item, n) => ({
    ...item,
    text: `t${n}`,
    updated_at: 5,
    ...(n === 1 ? { notes: "פרטים ארוכים" } : {}),
  }));
  const noteId = base[1].id;
  const reordered = reorderDateTasks(base, today, [...base.map((item) => item.id)].reverse(), 99);
  const rows = dateTasks(reordered, today);
  check(
    "reorder keeps notes and 6 slots",
    rows.length === DAILY_SLOT_COUNT && rows.find((item) => item.id === noteId)?.notes === "פרטים ארוכים",
  );

  const edited = updateDailyTaskDetails(base, noteId, { notes: "גרסה חדשה" }, 200);
  const editedRow = edited.find((item) => item.id === noteId);
  check("details update stamps updated_at", editedRow?.notes === "גרסה חדשה" && editedRow.updated_at === 200);
  check("details update with no change is a no-op", updateDailyTaskDetails(base, noteId, { notes: "פרטים ארוכים" }, 300) === base);
  const mergedA = mergeDailyTasks(edited, base).find((item) => item.id === noteId);
  const mergedB = mergeDailyTasks(base, edited).find((item) => item.id === noteId);
  check("newer note wins the merge (both orders)", mergedA?.notes === "גרסה חדשה" && mergedB?.notes === "גרסה חדשה");
  const cleared = updateDailyTaskDetails(edited, noteId, { notes: "" }, 300);
  const clearMerged = mergeDailyTasks(edited, cleared).find((item) => item.id === noteId);
  check("newer note clear beats older note", clearMerged?.notes === "", JSON.stringify(clearMerged));
  const tieMerged = mergeDailyTasks(base, base.map((item) => ({ ...item, notes: undefined }))).find((item) => item.id === noteId);
  check("equal-stamp field merge keeps the note", tieMerged?.notes === "פרטים ארוכים");

  const rolled = dateTasks(
    applyDailyRollover([task("day-r", "להמשיך", yesterday, { notes: "הערה", updated_at: 1 })], today),
    today,
  );
  const carried = rolled.find((item) => item.id === "day-r");
  check("rollover keeps notes", carried?.notes === "הערה" && carried.rollover_count === 1 && rolled.length === DAILY_SLOT_COUNT);

  const noteOnly = [
    task("day-o", "", yesterday, { notes: "רק פתק", updated_at: 1 }),
    ...Array.from({ length: 6 }, (_, n) => task(`day-b${n}`, "", today, { order_index: n })),
  ];
  const kept = dateTasks(applyDailyRollover(noteOnly, today), today);
  check(
    "note-only row is not purged or trimmed as blank",
    kept.some((item) => item.id === "day-o" && item.notes === "רק פתק") && kept.length === DAILY_SLOT_COUNT,
    JSON.stringify(kept.map((item) => item.id)),
  );
}

// 9. Important flag (tier 2): parsed, kept by reorder / rollover / move / text + note edits,
//    newest edit wins a merge, cleared by starring or emptying the row, never on a Black Star.
{
  const parsed = asDailyTasks([
    { id: "day-i", text: "דחוף", date: today, is_important: true },
    { id: "day-bs", text: "קדוש", date: today, is_important: true, is_black_star: true },
  ]);
  check(
    "is_important is parsed, and dropped on a Black Star",
    parsed[0]?.is_important === true && parsed[1]?.is_important === undefined && parsed[1]?.is_black_star === true,
  );

  const base = applyDailyRollover([], today).map((item, n) => ({ ...item, text: `t${n}`, updated_at: 5 }));
  const ids = base.map((item) => item.id);
  const flagged = setDateImportant(base, today, [ids[1], ids[3]], 50);
  const stamps = flagged.map((item) => item.updated_at);
  check(
    "setDateImportant flags exactly the chosen rows and stamps only them",
    flagged.filter((item) => item.is_important).map((item) => item.id).join() === [ids[1], ids[3]].join() &&
      stamps.filter((stamp) => stamp === 50).length === 2,
  );
  check("setDateImportant with the same set is a no-op", setDateImportant(flagged, today, [ids[3], ids[1]], 60) === flagged);
  const unflagged = setDateImportant(flagged, today, [ids[1]], 70);
  check(
    "unflagging stamps only the changed row",
    unflagged.find((item) => item.id === ids[3])?.is_important === false &&
      unflagged.find((item) => item.id === ids[3])?.updated_at === 70 &&
      unflagged.find((item) => item.id === ids[1])?.updated_at === 50,
  );

  const reordered = dateTasks(reorderDateTasks(flagged, today, [...ids].reverse(), 99), today);
  check(
    "reorder keeps is_important and 6 slots",
    reordered.length === DAILY_SLOT_COUNT &&
      reordered.filter((item) => item.is_important).map((item) => item.id).sort().join() === [ids[1], ids[3]].sort().join(),
  );

  const merged = mergeDailyTasks(base, flagged);
  const mergedRev = mergeDailyTasks(flagged, base);
  const flagsOf = (rows: DailyTask[]) => rows.filter((item) => item.is_important).map((item) => item.id).sort().join();
  check("flag survives a merge with an older remote copy (both orders)", flagsOf(merged) === flagsOf(flagged) && flagsOf(mergedRev) === flagsOf(flagged));
  check("newer unflag beats an older flag", flagsOf(mergeDailyTasks(flagged, unflagged)) === ids[1]);

  const rolled = dateTasks(
    applyDailyRollover([task("day-ri", "להמשיך", yesterday, { is_important: true, updated_at: 1 })], today),
    today,
  );
  const carried = rolled.find((item) => item.id === "day-ri");
  check("rollover keeps is_important", carried?.is_important === true && carried.rollover_count === 1 && rolled.length === DAILY_SLOT_COUNT);

  const moved = patchDailyTask(flagged, ids[1], { date: key(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) }, 80);
  check("moving a task to tomorrow keeps is_important", moved.find((item) => item.id === ids[1])?.is_important === true);

  const retitled = patchDailyTask(flagged, ids[1], { text: "שם חדש" }, 81);
  const noted = updateDailyTaskDetails(flagged, ids[1], { notes: "פרטים" }, 82);
  check(
    "editing text / notes keeps is_important",
    retitled.find((item) => item.id === ids[1])?.is_important === true && noted.find((item) => item.id === ids[1])?.is_important === true,
  );
  const viaModal = updateDailyTaskDetails(base, ids[2], { is_important: true }, 83);
  check("note modal toggle flags a task and stamps it", viaModal.find((item) => item.id === ids[2])?.is_important === true && viaModal.find((item) => item.id === ids[2])?.updated_at === 83);
  check("note modal toggle is a no-op when unchanged", updateDailyTaskDetails(viaModal, ids[2], { is_important: true }, 84) === viaModal);

  const emptied = patchDailyTask(flagged, ids[1], { text: "" }, 85).find((item) => item.id === ids[1]);
  check("clearing a slot's text resets is_important", emptied?.is_important === false && emptied.updated_at === 85);

  const starred = setDateStars(flagged, today, [ids[1]], 90);
  const star = starred.find((item) => item.id === ids[1]);
  check("promoting to Black Star clears is_important", star?.is_black_star === true && star.is_important === false && star.updated_at === 90);
  const starredViaPatch = patchDailyTask(flagged, ids[3], { is_black_star: true }, 91).find((item) => item.id === ids[3]);
  check("starring via a row patch clears is_important too", starredViaPatch?.is_important === false);
  check("a Black Star can't be flagged important", setDateImportant(starred, today, [ids[1], ids[3]], 95).find((item) => item.id === ids[1])?.is_important === false);
  check("toggle on a Black Star is a no-op", toggleDailyImportant(starred, ids[1], 96) === starred);
  check("toggle flips a regular task", toggleDailyImportant(base, ids[0], 97).find((item) => item.id === ids[0])?.is_important === true);
  check("an untitled slot can't be flagged", setDateImportant(applyDailyRollover([], today), today, ids.slice(0, 1), 98).every((item) => !item.is_important));

  const deleted = new Set([ids[1]]);
  const afterDelete = dateTasks(applyDailyRollover(flagged.filter((item) => item.id !== ids[1]), today, { deleted }), today);
  const resurrected = mergeDailyTasks(afterDelete, flagged, deleted).some((item) => item.id === ids[1]);
  check("trash-deleted important task never returns via a stale copy", !resurrected);
  check(
    "6-slot limit holds with important tasks",
    dateTasks(mergeDailyTasks(flagged, applyDailyRollover([], today)), today).length === DAILY_SLOT_COUNT,
  );
}

// Habit topics: newer list wins, renames follow linked habits, deletes never remove habits.
{
  const older = { items: ["A"], updated_at: 10 };
  const newer = { items: ["B"], updated_at: 20 };
  check("newer topic list wins either way", mergeHabitTopics(older, newer) === newer && mergeHabitTopics(newer, older) === newer);
  check("unset side never beats a set list", mergeHabitTopics(undefined, older) === older && mergeHabitTopics(older, undefined) === older);
  check("corrupt topics payload counts as unset", asHabitTopics("{bad") === undefined && asHabitTopics({ items: "x" }) === undefined);
  check("defaults shown until first edit, empty list kept after", habitTopicList(undefined).length > 0 && habitTopicList({ items: [], updated_at: 1 }).length === 0);
  const habits = [
    { id: "h1", habit_topic: "כושר" },
    { id: "h2", habit_topic: "" },
  ];
  const renamed = renameHabitTopic({ items: ["כושר"], updated_at: 1 }, habits, "כושר", "ספורט", 50);
  check("rename re-stamps linked habits", renamed.ok && renamed.bubbles[0]?.habit_topic === "ספורט" && renamed.bubbles[0]?.extras_updated_at === 50 && renamed.changedIds.length === 1);
  const removed = deleteHabitTopic({ items: ["כושר"], updated_at: 1 }, habits, "כושר", 60);
  check("delete clears the topic but keeps every habit", removed.ok && removed.bubbles.length === 2 && removed.bubbles[0]?.habit_topic === "" && removed.setting.items.length === 0);
  const grouped = groupByTopic(habits, ["כושר"]);
  check("untopiced habits group last", grouped.length === 2 && grouped[1]?.topic === null);
}

if (failures) {
  console.error(`verify-daily: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("verify-daily: all checks passed");
