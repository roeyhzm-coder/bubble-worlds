import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteBubbleRemote,
  deleteCategoryRemote,
  upsertBubble,
  upsertCategory,
  upsertSetting,
} from "../lib/supabase";
import type { AppSnapshot, Bubble } from "../types";
import type { Store } from "./store";

const UNDO_WINDOW_MS = 5000;

interface UndoEntry {
  id: number;
  label: string;
  before: AppSnapshot;
  after: AppSnapshot;
}

export interface UndoToastState {
  id: number;
  label: string;
}

export interface UndoStack {
  undoToast: UndoToastState | null;
  /** Remembers an action (state before and right after it) so it can be reverted for 5s. */
  recordUndo: (label: string, before: AppSnapshot, after: AppSnapshot) => void;
  undoLast: () => void;
  dismissUndo: () => void;
}

interface Restored<T> {
  list: T[];
  /** Rows put back (deleted or changed by the action). */
  restored: T[];
  /** Rows the action created, now removed again. */
  removed: T[];
  changed: boolean;
}

/**
 * Reverts only the rows the action touched (identity differs between before/after), on top of
 * the current list, so unrelated edits made during the undo window are kept.
 */
function restoreRows<T extends { id: string }>(current: T[], before: T[], after: T[]): Restored<T> {
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const afterById = new Map(after.map((row) => [row.id, row]));
  const touched = new Set<string>();
  for (const [id, row] of beforeById) if (afterById.get(id) !== row) touched.add(id);
  for (const id of afterById.keys()) if (!beforeById.has(id)) touched.add(id);
  if (!touched.size) return { list: current, restored: [], removed: [], changed: false };

  const restored: T[] = [];
  const removed: T[] = [];
  const list = current.filter((row) => {
    if (!touched.has(row.id) || beforeById.has(row.id)) return true;
    removed.push(row);
    return false;
  });
  for (const id of touched) {
    const original = beforeById.get(id);
    if (!original) continue;
    restored.push(original);
    const at = list.findIndex((row) => row.id === id);
    if (at >= 0) {
      list[at] = original;
    } else {
      // Put a deleted row back where it used to sit.
      const index = before.findIndex((row) => row.id === id);
      list.splice(Math.min(index, list.length), 0, original);
    }
  }
  return { list, restored, removed, changed: true };
}

export function useUndoStack(store: Store): UndoStack {
  const { snapshotRef, commit, scheduleExtrasSync } = store;
  const [entry, setEntry] = useState<UndoEntry | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!entry) return;
    const timer = window.setTimeout(() => setEntry(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [entry]);

  const recordUndo = useCallback((label: string, before: AppSnapshot, after: AppSnapshot) => {
    seq.current += 1;
    setEntry({ id: seq.current, label, before, after });
  }, []);

  const undoLast = useCallback(() => {
    if (!entry) return;
    setEntry(null);
    const current = snapshotRef.current;
    const now = Date.now();
    const categories = restoreRows(current.categories, entry.before.categories, entry.after.categories);
    const bubbleRows = restoreRows(current.bubbles, entry.before.bubbles, entry.after.bubbles);
    // Restored items get a fresh extras clock so their counters/order win the next cloud merge.
    const stamped = new Map<string, Bubble>(
      bubbleRows.restored.map((row) => [row.id, { ...row, extras_updated_at: now }]),
    );
    const bubbles = bubbleRows.list.map((row) => stamped.get(row.id) ?? row);
    const dailyRows = restoreRows(current.dailyTasks, entry.before.dailyTasks, entry.after.dailyTasks);
    // A restored task outranks the stale copies other devices still hold.
    const restoredDaily = new Set(dailyRows.restored.map((row) => row.id));
    const daily = {
      ...dailyRows,
      list: dailyRows.list.map((row) => (restoredDaily.has(row.id) ? { ...row, updated_at: now } : row)),
    };
    const wins = restoreRows(current.successes, entry.before.successes, entry.after.successes);

    const back = new Set([
      ...categories.restored.map((row) => row.id),
      ...bubbleRows.restored.map((row) => row.id),
      ...daily.restored.map((row) => row.id),
      ...wins.restored.map((row) => row.id),
    ]);
    const gone = [
      ...categories.removed.map((row) => row.id),
      ...bubbleRows.removed.map((row) => row.id),
    ];
    const deletedIds = [
      ...new Set([...(current.deletedIds ?? []).filter((id) => !back.has(id)), ...gone]),
    ];

    commit({
      ...current,
      categories: categories.list,
      bubbles,
      dailyTasks: daily.list,
      successes: wins.list,
      deletedIds,
    });

    void (async () => {
      // Parents before children so restored bubbles never point at a missing category row.
      await Promise.all(categories.restored.map((row) => upsertCategory(row)));
      await Promise.all([...stamped.values()].map((row) => upsertBubble(row)));
      if (bubbleRows.removed.length) await deleteBubbleRemote(bubbleRows.removed.map((row) => row.id));
      await Promise.all(categories.removed.map((row) => deleteCategoryRemote(row.id)));
    })();
    if (daily.changed) void upsertSetting("daily_tasks", daily.list);
    if (wins.changed) void upsertSetting("successes", wins.list);
    if (bubbleRows.changed) scheduleExtrasSync();
  }, [commit, entry, scheduleExtrasSync, snapshotRef]);

  const dismissUndo = useCallback(() => setEntry(null), []);

  return useMemo(
    () => ({
      undoToast: entry ? { id: entry.id, label: entry.label } : null,
      recordUndo,
      undoLast,
      dismissUndo,
    }),
    [dismissUndo, entry, recordUndo, undoLast],
  );
}
