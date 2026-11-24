import { useCallback, useMemo, useState } from "react";
import {
  applyDailyRollover,
  dateTasks,
  emptyDailyTask,
  ensureDateSlots,
  hasDailyContent,
  patchDailyTask,
  reorderDateTasks,
  setDateImportant,
  setDateStars,
  toggleDailyImportant as applyToggleImportant,
  updateDailyTaskDetails as applyTaskDetails,
} from "../lib/daily";
import { todayKey } from "../lib/defaults";
import { upsertSetting } from "../lib/supabase";
import type { DailyTask } from "../types";
import type { Store } from "./store";
import type { UndoStack } from "./useUndoStack";

export interface DailyTasksState {
  addDailyTask: () => string;
  updateDailyTask: (id: string, patch: Partial<DailyTask>) => void;
  /** Note modal save: title, notes and/or important flag, stamped now; a no-op when nothing changed. */
  updateDailyTaskDetails: (id: string, details: { text?: string; notes?: string; is_important?: boolean }) => void;
  deleteDailyTask: (id: string) => void;
  toggleDailyTask: (id: string) => void;
  dailyViewDate: string;
  setDailyViewDate: (date: string) => void;
  moveDailyTask: (id: string, date: string) => void;
  /** Makes exactly `ids` the starred focus tasks of `date` (0, 1 or many). */
  setDailyStars: (date: string, ids: string[]) => void;
  /** Makes exactly `ids` the important (flagged) tasks of `date`; Black Stars are ignored. */
  setDailyImportant: (date: string, ids: string[]) => void;
  /** Flips one task's important flag. */
  toggleDailyTaskImportant: (id: string) => void;
  /** Drag-and-drop: `ids` (that date's rows, or a subset) take their slots in this order. */
  reorderDailyTasks: (date: string, ids: string[]) => void;
}

export function useDailyTasksState(store: Store, undo: UndoStack): DailyTasksState {
  const { snapshotRef, mutate, commit } = store;
  const { recordUndo } = undo;
  const [dailyViewDate, setDailyViewDateState] = useState(() => todayKey());

  const persistDaily = useCallback((dailyTasks: DailyTask[], deletedIds: string[] = []) => {
    // No blank trimming here: a row just added with "+" must survive until it gets text.
    const next = applyDailyRollover(dailyTasks, todayKey(), {
      trimBlanks: false,
      deleted: new Set(deletedIds),
    });
    void upsertSetting("daily_tasks", next);
    return next;
  }, []);

  const setDailyViewDate = useCallback(
    (date: string) => {
      setDailyViewDateState(date);
      mutate((prev) => {
        const deleted = new Set(prev.deletedIds ?? []);
        return { ...prev, dailyTasks: persistDaily(ensureDateSlots(prev.dailyTasks, date, deleted), prev.deletedIds) };
      });
    },
    [mutate, persistDaily],
  );

  const addDailyTask = useCallback(() => {
    const date = dailyViewDate || todayKey();
    const id = emptyDailyTask(date, 0).id;
    mutate((prev) => {
      const order_index = dateTasks(prev.dailyTasks, date).length;
      const dailyTasks = persistDaily(
        [...prev.dailyTasks, { ...emptyDailyTask(date, order_index), id }],
        prev.deletedIds,
      );
      return { ...prev, dailyTasks };
    });
    return id;
  }, [dailyViewDate, mutate, persistDaily]);

  const updateDailyTask = useCallback(
    (id: string, patch: Partial<DailyTask>) => {
      mutate((prev) => ({
        ...prev,
        dailyTasks: persistDaily(
          patchDailyTask(prev.dailyTasks, id, patch),
          prev.deletedIds,
        ),
      }));
    },
    [mutate, persistDaily],
  );

  const updateDailyTaskDetails = useCallback(
    (id: string, details: { text?: string; notes?: string; is_important?: boolean }) => {
      mutate((prev) => {
        const dailyTasks = applyTaskDetails(prev.dailyTasks, id, details);
        if (dailyTasks === prev.dailyTasks) return prev;
        return { ...prev, dailyTasks: persistDaily(dailyTasks, prev.deletedIds) };
      });
    },
    [mutate, persistDaily],
  );

  const deleteDailyTask = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      const task = current.dailyTasks.find((item) => item.id === id);
      if (!task) return;
      // The id becomes a tombstone (synced as deleted_ids), so no device's stale copy, and no
      // rolled-over "!" copy of it, can bring the task back. No refill: fewer than 6 rows may stay.
      const deletedIds = [...new Set([...(current.deletedIds ?? []), id])];
      const dailyTasks = persistDaily(
        current.dailyTasks.filter((item) => item.id !== id),
        deletedIds,
      );
      const next = { ...current, dailyTasks, deletedIds };
      commit(next, 900);
      // Blank rows vanish without ceremony; only real tasks get an undo toast.
      if (hasDailyContent(task)) recordUndo(`המשימה "${task.text.trim() || "עם פתק"}" נמחקה`, current, next);
    },
    [commit, persistDaily, recordUndo, snapshotRef],
  );

  const toggleDailyTask = useCallback(
    (id: string) => {
      mutate((prev) => ({
        ...prev,
        dailyTasks: persistDaily(
          prev.dailyTasks.map((item) =>
            item.id === id ? { ...item, completed: !item.completed, updated_at: Date.now() } : item,
          ),
          prev.deletedIds,
        ),
      }));
    },
    [mutate, persistDaily],
  );

  const moveDailyTask = useCallback(
    (id: string, date: string) => {
      mutate((prev) => {
        const current = prev.dailyTasks.find((item) => item.id === id);
        if (!current) return prev;
        const today = todayKey();
        // The moved task takes the first blank slot on the target date instead of adding a row.
        const target = dateTasks(prev.dailyTasks, date);
        // A row holding only a note is not a free slot.
        const slot = target.find((item) => !hasDailyContent(item));
        const updated = prev.dailyTasks
          .filter((item) => item.id !== slot?.id)
          .map((item) =>
            item.id === id
              ? {
                  ...item,
                  date,
                  rollover_count: date > today ? 0 : item.rollover_count,
                  order_index: slot ? slot.order_index : target.length,
                  updated_at: Date.now(),
                }
              : item,
          );
        return { ...prev, dailyTasks: persistDaily(updated, prev.deletedIds) };
      });
    },
    [mutate, persistDaily],
  );

  const setDailyStars = useCallback(
    (date: string, ids: string[]) => {
      mutate((prev) => ({
        ...prev,
        dailyTasks: persistDaily(setDateStars(prev.dailyTasks, date, ids), prev.deletedIds),
      }));
    },
    [mutate, persistDaily],
  );

  const setDailyImportant = useCallback(
    (date: string, ids: string[]) => {
      mutate((prev) => {
        const dailyTasks = setDateImportant(prev.dailyTasks, date, ids);
        if (dailyTasks === prev.dailyTasks) return prev;
        return { ...prev, dailyTasks: persistDaily(dailyTasks, prev.deletedIds) };
      });
    },
    [mutate, persistDaily],
  );

  const toggleDailyTaskImportant = useCallback(
    (id: string) => {
      mutate((prev) => {
        const dailyTasks = applyToggleImportant(prev.dailyTasks, id);
        if (dailyTasks === prev.dailyTasks) return prev;
        return { ...prev, dailyTasks: persistDaily(dailyTasks, prev.deletedIds) };
      });
    },
    [mutate, persistDaily],
  );

  const reorderDailyTasks = useCallback(
    (date: string, ids: string[]) => {
      mutate((prev) => {
        const reordered = reorderDateTasks(prev.dailyTasks, date, ids);
        if (reordered === prev.dailyTasks) return prev;
        return { ...prev, dailyTasks: persistDaily(reordered, prev.deletedIds) };
      });
    },
    [mutate, persistDaily],
  );

  return useMemo(
    () => ({
      addDailyTask,
      updateDailyTask,
      updateDailyTaskDetails,
      deleteDailyTask,
      toggleDailyTask,
      dailyViewDate,
      setDailyViewDate,
      moveDailyTask,
      setDailyStars,
      setDailyImportant,
      toggleDailyTaskImportant,
      reorderDailyTasks,
    }),
    [
      addDailyTask,
      dailyViewDate,
      deleteDailyTask,
      moveDailyTask,
      reorderDailyTasks,
      setDailyImportant,
      setDailyStars,
      setDailyViewDate,
      toggleDailyTaskImportant,
      toggleDailyTask,
      updateDailyTask,
      updateDailyTaskDetails,
    ],
  );
}
