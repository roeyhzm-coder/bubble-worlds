import { useCallback, useMemo } from "react";
import { newId } from "../lib/defaults";
import { upsertSetting } from "../lib/supabase";
import type { Bubble, Success } from "../types";
import type { Store } from "./store";
import type { UndoStack } from "./useUndoStack";

export interface SuccessesState {
  addSuccess: (input: {
    title: string;
    notes?: string;
    source_type?: Success["source_type"];
    category_name?: string;
  }) => string;
  saveBubbleAsSuccess: (id: string) => string | null;
  archiveBubbleAsSuccess: (id: string) => string | null;
  saveDailyAsSuccess: (id: string) => string | null;
  updateSuccess: (id: string, patch: Partial<Success>) => void;
  deleteSuccess: (id: string) => void;
}

export function useSuccessesState(
  store: Store,
  updateBubble: (id: string, patch: Partial<Bubble>) => void,
  undo: UndoStack,
): SuccessesState {
  const { snapshotRef, mutate, commit } = store;
  const { recordUndo } = undo;

  const persistSuccesses = useCallback((successes: Success[]) => {
    void upsertSetting("successes", successes);
    return successes;
  }, []);

  const addSuccess = useCallback(
    (input: { title: string; notes?: string; source_type?: Success["source_type"]; category_name?: string }) => {
      const title = input.title.trim();
      const id = newId("win");
      if (!title) return id;
      mutate((prev) => {
        const success: Success = {
          id,
          title,
          notes: input.notes?.trim() ?? "",
          source_type: input.source_type ?? "manual",
          created_at: new Date().toISOString(),
          category_name: input.category_name?.trim() ?? "",
        };
        return { ...prev, successes: persistSuccesses([success, ...prev.successes]) };
      });
      return id;
    },
    [mutate, persistSuccesses],
  );

  const saveBubbleAsSuccess = useCallback(
    (id: string) => {
      const bubble = snapshotRef.current.bubbles.find((item) => item.id === id);
      if (!bubble) return null;
      const category = snapshotRef.current.categories.find((item) => item.id === bubble.category_id);
      return addSuccess({
        title: bubble.title || "הצלחה",
        notes: bubble.notes,
        source_type: "bubble",
        category_name: category?.name ?? "",
      });
    },
    [addSuccess, snapshotRef],
  );

  /** Saves a completed item to the vault and hides it from active lists; its data is kept. */
  const archiveBubbleAsSuccess = useCallback(
    (id: string) => {
      const successId = saveBubbleAsSuccess(id);
      if (successId) updateBubble(id, { archived: true });
      return successId;
    },
    [saveBubbleAsSuccess, updateBubble],
  );

  const saveDailyAsSuccess = useCallback(
    (id: string) => {
      const task = snapshotRef.current.dailyTasks.find((item) => item.id === id);
      if (!task?.text.trim()) return null;
      return addSuccess({ title: task.text.trim(), notes: "", source_type: "daily", category_name: "משימות יומיות" });
    },
    [addSuccess, snapshotRef],
  );

  const updateSuccess = useCallback(
    (id: string, patch: Partial<Success>) => {
      mutate((prev) => ({
        ...prev,
        successes: persistSuccesses(prev.successes.map((item) => (item.id === id ? { ...item, ...patch } : item))),
      }));
    },
    [mutate, persistSuccesses],
  );

  const deleteSuccess = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      const success = current.successes.find((item) => item.id === id);
      const deletedIds = [...new Set([...(current.deletedIds ?? []), id])];
      const successes = persistSuccesses(current.successes.filter((item) => item.id !== id));
      const next = { ...current, successes, deletedIds };
      commit(next);
      recordUndo(`"${success?.title ?? "הצלחה"}" נמחקה מההצלחות`, current, next);
    },
    [commit, persistSuccesses, recordUndo, snapshotRef],
  );

  return useMemo(
    () => ({
      addSuccess,
      saveBubbleAsSuccess,
      archiveBubbleAsSuccess,
      saveDailyAsSuccess,
      updateSuccess,
      deleteSuccess,
    }),
    [addSuccess, archiveBubbleAsSuccess, deleteSuccess, saveBubbleAsSuccess, saveDailyAsSuccess, updateSuccess],
  );
}
