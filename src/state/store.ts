import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { repairDone, repairStrayListItems } from "../lib/repair";
import { loadLocal, saveLocal } from "../lib/storage";
import { syncBubbleExtras } from "../lib/supabase";
import type { AppSnapshot } from "../types";

const EXTRAS_SYNC_DELAY_MS = 700;

/** Shared snapshot plumbing every domain hook builds on. */
export interface Store {
  snapshot: AppSnapshot;
  /** Always the latest committed snapshot, readable from callbacks without re-binding. */
  snapshotRef: MutableRefObject<AppSnapshot>;
  setSnapshot: Dispatch<SetStateAction<AppSnapshot>>;
  /** Realtime echoes of our own writes are ignored until this time (ms). */
  ignoreRemoteUntil: MutableRefObject<number>;
  applyingRemote: MutableRefObject<boolean>;
  /** Functional update for small edits (saved to localStorage by the persist effect). */
  mutate: (updater: (prev: AppSnapshot) => AppSnapshot) => void;
  /** Synchronous replace + immediate local save, for deletes, moves and undo. */
  commit: (next: AppSnapshot, quietMs?: number) => void;
  /** Debounced per-item merge of bubble_extras into the cloud. */
  scheduleExtrasSync: () => void;
}

export function useStore(): Store {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => {
    const local = loadLocal();
    // Rescue habits that became floating bubbles; the persist effect saves the fix locally.
    return repairDone() ? local : repairStrayListItems(local).snapshot;
  });
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const ignoreRemoteUntil = useRef(0);
  const applyingRemote = useRef(false);
  const extrasTimer = useRef<number | null>(null);

  const mutate = useCallback((updater: (prev: AppSnapshot) => AppSnapshot) => {
    ignoreRemoteUntil.current = Date.now() + 900;
    setSnapshot((prev) => updater(prev));
  }, []);

  const commit = useCallback((next: AppSnapshot, quietMs = 2500) => {
    ignoreRemoteUntil.current = Date.now() + quietMs;
    snapshotRef.current = next;
    setSnapshot(next);
    saveLocal(next);
  }, []);

  const scheduleExtrasSync = useCallback(() => {
    if (extrasTimer.current) window.clearTimeout(extrasTimer.current);
    extrasTimer.current = window.setTimeout(() => {
      extrasTimer.current = null;
      ignoreRemoteUntil.current = Date.now() + 1500;
      const current = snapshotRef.current;
      void syncBubbleExtras(current.bubbles, current.deletedIds);
    }, EXTRAS_SYNC_DELAY_MS);
  }, []);

  return useMemo(
    () => ({
      snapshot,
      snapshotRef,
      setSnapshot,
      ignoreRemoteUntil,
      applyingRemote,
      mutate,
      commit,
      scheduleExtrasSync,
    }),
    [commit, mutate, scheduleExtrasSync, snapshot],
  );
}
