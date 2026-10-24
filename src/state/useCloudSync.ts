import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { backupLocal, downloadBackup, mergeSnapshots, saveLocal } from "../lib/storage";
import {
  fetchRemoteSnapshot,
  isCloudEnabled,
  pushSnapshotToCloud,
  subscribeRealtime,
  type PushResult,
} from "../lib/supabase";
import type { Store } from "./store";

export interface CloudSync {
  cloud: boolean;
  syncing: boolean;
  lastPush: PushResult | null;
  pushToCloud: () => Promise<PushResult>;
  exportBackup: () => void;
}

/** Local persistence, startup cloud merge, realtime updates and manual push/backup. */
export function useCloudSync(store: Store): CloudSync {
  const { snapshot, snapshotRef, setSnapshot, ignoreRemoteUntil, applyingRemote } = store;
  const [syncing, setSyncing] = useState(false);
  const [lastPush, setLastPush] = useState<PushResult | null>(null);
  const pushingRef = useRef<Promise<PushResult> | null>(null);

  const pushToCloud = useCallback((): Promise<PushResult> => {
    if (pushingRef.current) return pushingRef.current;
    setSyncing(true);
    const current = snapshotRef.current;
    backupLocal(current);
    const run = pushSnapshotToCloud(current)
      .catch(
        (error: unknown): PushResult => ({
          ok: false,
          categories: current.categories.length,
          bubbles: current.bubbles.length,
          errors: [error instanceof Error ? error.message : String(error)],
        }),
      )
      .then((result) => {
        setLastPush(result);
        if (!result.ok) console.warn("cloud push failed", result.errors);
        return result;
      })
      .finally(() => {
        pushingRef.current = null;
        setSyncing(false);
      });
    pushingRef.current = run;
    return run;
  }, [snapshotRef]);

  const exportBackup = useCallback(() => {
    backupLocal(snapshotRef.current);
    downloadBackup(snapshotRef.current);
  }, [snapshotRef]);

  useEffect(() => {
    saveLocal(snapshot);
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;
    backupLocal(snapshotRef.current);
    void (async () => {
      const remote = await fetchRemoteSnapshot();
      if (!remote || cancelled) return;
      applyingRemote.current = true;
      // Device data wins: every local item and field survives, remote only fills gaps
      // (except per-item extras, where the newer edit wins).
      const merged = mergeSnapshots(snapshotRef.current, remote, "local");
      snapshotRef.current = merged;
      setSnapshot(merged);
      saveLocal(merged);
      queueMicrotask(() => {
        applyingRemote.current = false;
      });
      void pushToCloud();
    })();
    const unsubscribe = subscribeRealtime((remote) => {
      if (applyingRemote.current || Date.now() < ignoreRemoteUntil.current) return;
      applyingRemote.current = true;
      setSnapshot((local) => mergeSnapshots(local, remote, "remote"));
      queueMicrotask(() => {
        applyingRemote.current = false;
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyingRemote, ignoreRemoteUntil, pushToCloud, setSnapshot, snapshotRef]);

  return useMemo(
    () => ({ cloud: isCloudEnabled, syncing, lastPush, pushToCloud, exportBackup }),
    [exportBackup, lastPush, pushToCloud, syncing],
  );
}
