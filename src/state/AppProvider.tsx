import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AppSnapshot } from "../types";
import { useStore } from "./store";
import { useAppearanceState, type AppearanceState } from "./useAppearanceState";
import { useBubblesState, type BubblesState } from "./useBubblesState";
import { useCloudSync, type CloudSync } from "./useCloudSync";
import { useDailyTasksState, type DailyTasksState } from "./useDailyTasksState";
import { useNavigationState, type NavigationState } from "./useNavigationState";
import { useSuccessesState, type SuccessesState } from "./useSuccessesState";
import { useUndoStack, type UndoStack } from "./useUndoStack";

/**
 * The single `useApp()` surface. Each domain lives in its own hook under src/state/;
 * this provider only wires them together and flattens their APIs.
 */
export type AppContextValue = { snapshot: AppSnapshot } & Omit<NavigationState, "setComposer" | "resolveParent"> &
  BubblesState &
  AppearanceState &
  DailyTasksState &
  SuccessesState &
  CloudSync &
  Omit<UndoStack, "recordUndo">;

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const cloud = useCloudSync(store);
  const undo = useUndoStack(store);
  const nav = useNavigationState(store);
  const bubbles = useBubblesState(store, nav, undo);
  const appearance = useAppearanceState(store, bubbles.updateBubble);
  const daily = useDailyTasksState(store, undo);
  const successes = useSuccessesState(store, bubbles.updateBubble, undo);

  const value = useMemo<AppContextValue>(() => {
    const { setComposer: _setComposer, resolveParent: _resolveParent, ...navigation } = nav;
    const { recordUndo: _recordUndo, ...undoApi } = undo;
    return {
      snapshot: store.snapshot,
      ...navigation,
      ...bubbles,
      ...appearance,
      ...daily,
      ...successes,
      ...cloud,
      ...undoApi,
    };
  }, [appearance, bubbles, cloud, daily, nav, store.snapshot, successes, undo]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
