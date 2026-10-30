import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markRepairDone, repairDone, repairStrayListItems } from "../lib/repair";
import { backupLocal, downloadBackup, mergeSnapshots, saveLocal } from "../lib/storage";
import {
  fetchRemoteSnapshot,
  forcePushSnapshotToCloud,
  isCloudEnabled,
  pushSnapshotToCloud,
  subscribeRealtime,
  syncDeletedIds,
  type PushResult,
} from "../lib/supabase";
import type { AppSnapshot } from "../types";
import type { Store } from "./store";

/** Realtime echoes of a force push are ignored for this long (ms). */
const FORCE_PUSH_QUIET_MS = 5000;

function failedPush(snapshot: AppSnapshot, error: unknown): PushResult {
  return {
    ok: false,
    categories: snapshot.categories.length,
    bubbles: snapshot.bubbles.length,
    errors: [error instanceof Error ? error.message : String(error)],
  };
}

/**
 * Same data, fresh clocks: every per-item extras entry and daily task is stamped now, so the
 * last-write-wins merges on other devices accept this device's copy instead of a stale one.
 */
function stampForForcePush(snapshot: AppSnapshot, now: number): AppSnapshot {
  return {
    ...snapshot,
    bubbles: snapshot.bubbles.map((bubble) => ({ ...bubble, extras_updated_at: now })),
    dailyTasks: snapshot.dailyTasks.map((task) => ({ ...task, updated_at: now })),
  };
}

export interface CloudSync {
  cloud: boolean;
  syncing: boolean;
  lastPush: PushResult | null;
  pushToCloud: () => Promise<PushResult>;
  /** Overwrites the cloud with this device's local state: no fetch, no merge. */
  forcePushLocalToCloud: () => Promise<PushResult>;
  exportBackup: () => void;
}

/** Local persistence, startup cloud merge, realtime updates and manual push/backup. */
export function useCloudSync(store: Store): CloudSync {
  const { snapshot, snapshotRef, setSnapshot, ignoreRemoteUntil, applyingRemote, commit } = store;
  const [syncing, setSyncing] = useState(false);
  const [lastPush, setLastPush] = useState<PushResult | null>(null);
  const pushingRef = useRef<Promise<PushResult> | null>(null);

  const pushToCloud = useCallback((): Promise<PushResult> => {
    if (pushingRef.current) return pushingRef.current;
    setSyncing(true);
    const current = snapshotRef.current;
    backupLocal(current);
    const run = pushSnapshotToCloud(current)
      .catch((error: unknown): PushResult => failedPush(current, error))
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

  const forcingRef = useRef<Promise<PushResult> | null>(null);

  const forcePushLocalToCloud = useCallback((): Promise<PushResult> => {
    if (forcingRef.current) return forcingRef.current;
    setSyncing(true);
    const run = (async (): Promise<PushResult> => {
      // Let a regular push already in flight finish first so it can't land after the overwrite.
      await pushingRef.current?.catch(() => null);
      const local = snapshotRef.current;
      backupLocal(local);
      const stamped = stampForForcePush(local, Date.now());
      commit(stamped, FORCE_PUSH_QUIET_MS);
      try {
        return await forcePushSnapshotToCloud(stamped);
      } catch (error) {
        return failedPush(stamped, error);
      }
    })()
      .then((result) => {
        ignoreRemoteUntil.current = Date.now() + FORCE_PUSH_QUIET_MS;
        setLastPush(result);
        if (!result.ok) console.warn("force push failed", result.errors);
        return result;
      })
      .finally(() => {
        forcingRef.current = null;
        setSyncing(false);
      });
    forcingRef.current = run;
    return run;
  }, [commit, ignoreRemoteUntil, snapshotRef]);

  const exportBackup = useCallback(() => {
    backupLocal(snapshotRef.current);
    downloadBackup(snapshotRef.current);
  }, [snapshotRef]);

  useEffect(() => {
    saveLocal(snapshot);
  }, [snapshot]);

  // Every new tombstone (delete) or removed one (undo) is merged into the shared deleted_ids,
  // so other devices drop the item instead of syncing their stale copy back.
  const syncedTombstones = useRef(new Set(snapshot.deletedIds ?? []));
  useEffect(() => {
    const next = new Set(snapshot.deletedIds ?? []);
    const prev = syncedTombstones.current;
    const added = [...next].some((id) => !prev.has(id));
    const restored = [...prev].filter((id) => !next.has(id));
    if (!added && !restored.length) return;
    syncedTombstones.current = next;
    if (isCloudEnabled) void syncDeletedIds([...next], restored);
  }, [snapshot.deletedIds]);

  useEffect(() => {
    let cancelled = false;
    backupLocal(snapshotRef.current);
    void (async () => {
      let remote: AppSnapshot | null = null;
      try {
        remote = await fetchRemoteSnapshot();
      } catch (error) {
        console.warn("startup cloud fetch failed; keeping local data", error);
      }
      if (!remote || cancelled) return;
      let combined: AppSnapshot;
      try {
        // Device data wins: every local item and field survives, remote only fills gaps
        // (except per-item extras, where the newer edit wins).
        combined = mergeSnapshots(snapshotRef.current, remote, "local");
      } catch (error) {
        console.warn("startup cloud merge failed; keeping local data", error);
        return;
      }
      applyingRemote.current = true;
      // Runs again on the cloud-merged data: the startup push below writes the rescue to Supabase.
      const repairing = !repairDone();
      const merged = repairing ? repairStrayListItems(combined).snapshot : combined;
      snapshotRef.current = merged;
      setSnapshot(merged);
      saveLocal(merged);
      queueMicrotask(() => {
        applyingRemote.current = false;
      });
      void pushToCloud().then((result) => {
        if (repairing && result.ok) markRepairDone();
      });
    })();
    if (!isCloudEnabled && !repairDone()) markRepairDone();
    const unsubscribe = subscribeRealtime((remote) => {
      if (applyingRemote.current || Date.now() < ignoreRemoteUntil.current) return;
      applyingRemote.current = true;
      setSnapshot((local) => {
        try {
          return mergeSnapshots(local, remote, "remote");
        } catch (error) {
          console.warn("realtime merge failed; keeping local data", error);
          return local;
        }
      });
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
    () => ({ cloud: isCloudEnabled, syncing, lastPush, pushToCloud, forcePushLocalToCloud, exportBackup }),
    [exportBackup, forcePushLocalToCloud, lastPush, pushToCloud, syncing],
  );
}
