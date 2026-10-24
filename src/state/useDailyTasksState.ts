import { useCallback, useMemo, useState } from "react";
import { applyDailyRollover, dateTasks, emptyDailyTask, ensureDateSlots } from "../lib/daily";
import { todayKey } from "../lib/defaults";
import { upsertSetting } from "../lib/supabase";
import type { DailyTask } from "../types";
import type { Store } from "./store";
import type { UndoStack } from "./useUndoStack";

export interface DailyTasksState {
  addDailyTask: () => string;
  updateDailyTask: (id: string, patch: Partial<DailyTask>) => void;
  deleteDailyTask: (id: string) => void;
  toggleDailyTask: (id: string) => void;
  dailyViewDate: string;
  setDailyViewDate: (date: string) => void;
  moveDailyTask: (id: string, date: string) => void;
}

export function useDailyTasksState(store: Store, undo: UndoStack): DailyTasksState {
  const { snapshotRef, mutate, commit } = store;
  const { recordUndo } = undo;
  const [dailyViewDate, setDailyViewDateState] = useState(() => todayKey());

  const persistDaily = useCallback((dailyTasks: DailyTask[]) => {
    // No blank trimming here: a row just added with "+" must survive until it gets text.
    const next = applyDailyRollover(dailyTasks, todayKey(), { trimBlanks: false });
    void upsertSetting("daily_tasks", next);
    return next;
  }, []);

  const setDailyViewDate = useCallback(
    (date: string) => {
      setDailyViewDateState(date);
      mutate((prev) => ({ ...prev, dailyTasks: persistDaily(ensureDateSlots(prev.dailyTasks, date)) }));
    },
    [mutate, persistDaily],
  );

  const addDailyTask = useCallback(() => {
    const date = dailyViewDate || todayKey();
    const id = emptyDailyTask(date, 0).id;
    mutate((prev) => {
      const order_index = dateTasks(prev.dailyTasks, date).length;
      const dailyTasks = persistDaily([...prev.dailyTasks, { ...emptyDailyTask(date, order_index), id }]);
      return { ...prev, dailyTasks };
    });
    return id;
  }, [dailyViewDate, mutate, persistDaily]);

  const updateDailyTask = useCallback(
    (id: string, patch: Partial<DailyTask>) => {
      mutate((prev) => ({
        ...prev,
        dailyTasks: persistDaily(prev.dailyTasks.map((item) => (item.id === id ? { ...item, ...patch } : item))),
      }));
    },
    [mutate, persistDaily],
  );

  const deleteDailyTask = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      const task = current.dailyTasks.find((item) => item.id === id);
      if (!task) return;
      // No refill: deleting rows may leave fewer than 6 for the day.
      const next = { ...current, dailyTasks: persistDaily(current.dailyTasks.filter((item) => item.id !== id)) };
      commit(next, 900);
      // Blank rows vanish without ceremony; only real tasks get an undo toast.
      if (task.text.trim()) recordUndo(`המשימה "${task.text.trim()}" נמחקה`, current, next);
    },
    [commit, persistDaily, recordUndo, snapshotRef],
  );

  const toggleDailyTask = useCallback(
    (id: string) => {
      mutate((prev) => ({
        ...prev,
        dailyTasks: persistDaily(
          prev.dailyTasks.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)),
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
        const slot = target.find((item) => !item.text.trim());
        const updated = prev.dailyTasks
          .filter((item) => item.id !== slot?.id)
          .map((item) =>
            item.id === id
              ? {
                  ...item,
                  date,
                  rollover_count: date > today ? 0 : item.rollover_count,
                  order_index: slot ? slot.order_index : target.length,
                }
              : item,
          );
        return { ...prev, dailyTasks: persistDaily(updated) };
      });
    },
    [mutate, persistDaily],
  );

  return useMemo(
    () => ({
      addDailyTask,
      updateDailyTask,
      deleteDailyTask,
      toggleDailyTask,
      dailyViewDate,
      setDailyViewDate,
      moveDailyTask,
    }),
    [addDailyTask, dailyViewDate, deleteDailyTask, moveDailyTask, setDailyViewDate, toggleDailyTask, updateDailyTask],
  );
}
