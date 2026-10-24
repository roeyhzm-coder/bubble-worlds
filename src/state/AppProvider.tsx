import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EMPTY_ITEM_TOOLS, PALETTE, freeSlot, layoutRing, newId, todayKey } from "../lib/defaults";
import { DEFAULT_TRIANGLE_TYPES, clearTrianglePatch, trianglePatch } from "../lib/triangles";
import { backupLocal, downloadBackup, loadLocal, mergeSnapshots, saveLocal } from "../lib/storage";
import {
  collectBubbleExtras,
  deleteBubbleRemote,
  deleteCategoryRemote,
  fetchRemoteSnapshot,
  isCloudEnabled,
  pushSnapshotToCloud,
  subscribeRealtime,
  type PushResult,
  upsertBubble,
  upsertCategory,
  upsertColorRoles,
  upsertSetting,
} from "../lib/supabase";
import { markDone, removeDate, removeLastDay, toggleDate } from "../lib/tracking";
import type {
  AppSnapshot,
  Breadcrumb,
  Bubble,
  BubbleStatus,
  Category,
  ColorRoles,
  DailyTask,
  DrillNode,
  PageLabels,
  Success,
  TriangleType,
  WorldKind,
} from "../types";
import { applyDailyRollover, dateTasks, emptyDailyTask, ensureDateSlots } from "../lib/daily";

interface AppContextValue {
  snapshot: AppSnapshot;
  cloud: boolean;
  page: number;
  setPage: (page: number) => void;
  drill: DrillNode;
  setDrill: (node: DrillNode) => void;
  breadcrumbs: Breadcrumb[];
  currentTitle: string;
  visibleCategories: Category[];
  visibleBubbles: Bubble[];
  childrenOf: (bubbleId: string) => Bubble[];
  composer:
    | { mode: "create"; type: "category" | "bubble" }
    | { mode: "edit"; type: "category" | "bubble"; id: string }
    | null;
  openCreate: (type: "category" | "bubble") => void;
  openEditor: (target: { type: "category" | "bubble"; id: string }) => void;
  closeComposer: () => void;
  commitCreate: (input: {
    name: string;
    color: string;
    size_multiplier: number;
  }) => void;
  addListItem: (title: string) => string | null;
  setPageLabels: (labels: Partial<PageLabels>) => void;
  currentWorldKind: WorldKind | null;
  lockWorldKind: (kind: WorldKind) => void;
  requestCreate: () => void;
  focusListAdd: number;
  drillKey: string;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  updateBubble: (id: string, patch: Partial<Bubble>) => void;
  deleteCategory: (id: string) => void;
  deleteBubble: (id: string) => void;
  /** Moves items into a category/bubble container; returns how many actually moved. */
  moveItems: (ids: string[], target: DrillNode) => number;
  /** Creates a new list (bubble, or category at root) at a level and moves items into it. */
  splitIntoNewList: (name: string, ids: string[], at: DrillNode) => DrillNode | null;
  moveNode: (
    type: "category" | "bubble",
    id: string,
    x: number,
    y: number,
  ) => void;
  applyStatusColor: (status: BubbleStatus, color: string) => void;
  markToday: (id: string) => void;
  unmarkToday: (id: string) => void;
  minusDay: (id: string) => void;
  resetTracking: (id: string) => void;
  toggleTrackingDate: (id: string, date: string) => void;
  setTriangleType: (id: string, triangleId: string | null) => void;
  addTriangleType: () => string;
  updateTriangleType: (id: string, patch: Partial<TriangleType>) => void;
  deleteTriangleType: (id: string) => void;
  moveTriangleType: (id: string, direction: -1 | 1) => void;
  addDailyTask: () => string;
  updateDailyTask: (id: string, patch: Partial<DailyTask>) => void;
  deleteDailyTask: (id: string) => void;
  toggleDailyTask: (id: string) => void;
  dailyViewDate: string;
  setDailyViewDate: (date: string) => void;
  moveDailyTask: (id: string, date: string) => void;
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
  syncing: boolean;
  lastPush: PushResult | null;
  pushToCloud: () => Promise<PushResult>;
  exportBackup: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const EXTRA_PATCH_KEYS = [
  "challenge_done",
  "done_offset",
  "streak_offset",
  "archived",
  "session_count",
  "session_target",
  "session_taken",
  "session_missed",
  "session_log",
  "routine_time",
] as const;

function clampPos(n: number): number {
  return Math.min(92, Math.max(8, n));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => loadLocal());
  const [page, setPage] = useState(0);
  const [drill, setDrill] = useState<DrillNode>({ kind: "root" });
  const [composer, setComposer] = useState<
    | { mode: "create"; type: "category" | "bubble" }
    | { mode: "edit"; type: "category" | "bubble"; id: string }
    | null
  >(null);
  const [focusListAdd, setFocusListAdd] = useState(0);
  const [dailyViewDate, setDailyViewDateState] = useState(() => todayKey());
  const applyingRemote = useRef(false);
  const ignoreRemoteUntil = useRef(0);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
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
  }, []);

  const exportBackup = useCallback(() => {
    backupLocal(snapshotRef.current);
    downloadBackup(snapshotRef.current);
  }, []);

  const persist = useCallback((next: AppSnapshot) => {
    saveLocal(next);
  }, []);

  useEffect(() => {
    persist(snapshot);
  }, [snapshot, persist]);

  useEffect(() => {
    let cancelled = false;
    backupLocal(snapshotRef.current);
    void (async () => {
      const remote = await fetchRemoteSnapshot();
      if (!remote || cancelled) return;
      applyingRemote.current = true;
      // Device data wins: every local item and field survives, remote only fills gaps.
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
  }, [pushToCloud]);

  const mutate = useCallback((updater: (prev: AppSnapshot) => AppSnapshot) => {
    ignoreRemoteUntil.current = Date.now() + 900;
    setSnapshot((prev) => updater(prev));
  }, []);

  const resolveParent = useCallback(() => {
    const current = snapshotRef.current;
    let categoryId = current.categories[0]?.id;
    let parent: string | null = null;
    if (drill.kind === "category") categoryId = drill.id;
    if (drill.kind === "bubble") {
      const parentBubble = current.bubbles.find((b) => b.id === drill.id);
      categoryId = parentBubble?.category_id ?? categoryId;
      parent = drill.id;
    }
    return { categoryId, parent };
  }, [drill]);

  const commitCreate = useCallback(
    (input: { name: string; color: string; size_multiplier: number }) => {
      const name = input.name.trim() || "בועה חדשה";
      if (composer?.mode === "create" && composer.type === "category") {
        const slot = layoutRing(
          snapshotRef.current.categories.length,
          snapshotRef.current.categories.length + 1,
        );
        const cat: Category = {
          id: newId("cat"),
          name,
          color: input.color,
          position_x: slot.x,
          position_y: slot.y,
          order_index: snapshotRef.current.categories.length,
          created_at: new Date().toISOString(),
          container_type: null,
        };
        mutate((prev) => ({ ...prev, categories: [...prev.categories, cat] }));
        void upsertCategory(cat);
        setComposer(null);
        return;
      }
      const { categoryId, parent } = resolveParent();
      if (!categoryId) {
        setComposer({ mode: "create", type: "category" });
        return;
      }
      const siblings = snapshotRef.current.bubbles.filter(
        (item) =>
          item.category_id === categoryId &&
          item.parent_bubble_id === parent,
      );
      const slot = layoutRing(siblings.length, siblings.length + 1);
      const bubble: Bubble = {
        id: newId("bub"),
        parent_bubble_id: parent,
        category_id: categoryId,
        title: name,
        notes: "",
        color: input.color,
        status: "default",
        position_x: slot.x,
        position_y: slot.y,
        size_multiplier: input.size_multiplier,
        created_at: new Date().toISOString(),
        is_tracking: false,
        target_days: 30,
        weekly_frequency: 7,
        tracking_history: [],
        streak_mode: "flexible",
        container_type: null,
        ...EMPTY_ITEM_TOOLS,
      };
      mutate((prev) => {
        const categories = parent
          ? prev.categories
          : prev.categories.map((category) =>
              category.id === categoryId && !category.container_type
                ? { ...category, container_type: "bubbles" as const }
                : category,
            );
        const bubbles = parent
          ? prev.bubbles.map((item) =>
              item.id === parent && !item.container_type
                ? { ...item, container_type: "bubbles" as const }
                : item,
            )
          : prev.bubbles;
        const lockedCat = !parent ? categories.find((c) => c.id === categoryId) : undefined;
        const lockedParent = parent ? bubbles.find((b) => b.id === parent) : undefined;
        if (lockedCat && lockedCat.container_type === "bubbles") void upsertCategory(lockedCat);
        if (lockedParent && lockedParent.container_type === "bubbles") {
          void upsertBubble(lockedParent);
        }
        return { ...prev, categories, bubbles: [...bubbles, bubble] };
      });
      void upsertBubble(bubble);
      setComposer(null);
    },
    [composer, mutate, resolveParent],
  );

  const addListItem = useCallback(
    (title: string) => {
      const { categoryId, parent } = resolveParent();
      if (!categoryId) return null;
      const siblings = snapshotRef.current.bubbles.filter(
        (item) =>
          item.category_id === categoryId &&
          item.parent_bubble_id === parent,
      );
      const slot = layoutRing(siblings.length, siblings.length + 1);
      const bubble: Bubble = {
        id: newId("bub"),
        parent_bubble_id: parent,
        category_id: categoryId,
        title: title.trim() || "פריט חדש",
        notes: "",
        status: "default",
        position_x: slot.x,
        position_y: slot.y,
        size_multiplier: 1,
        created_at: new Date().toISOString(),
        is_tracking: false,
        target_days: 30,
        weekly_frequency: 7,
        tracking_history: [],
        streak_mode: "flexible",
        container_type: null,
        ...EMPTY_ITEM_TOOLS,
        triangle_id: null,
        color: snapshotRef.current.colorRoles.default,
      };
      mutate((prev) => {
        const categories = parent
          ? prev.categories
          : prev.categories.map((category) =>
              category.id === categoryId && !category.container_type
                ? { ...category, container_type: "list" as const }
                : category,
            );
        const bubbles = parent
          ? prev.bubbles.map((item) =>
              item.id === parent && !item.container_type
                ? { ...item, container_type: "list" as const }
                : item,
            )
          : prev.bubbles;
        const lockedCat = !parent ? categories.find((c) => c.id === categoryId) : undefined;
        const lockedParent = parent ? bubbles.find((b) => b.id === parent) : undefined;
        if (lockedCat && lockedCat.container_type === "list") void upsertCategory(lockedCat);
        if (lockedParent && lockedParent.container_type === "list") {
          void upsertBubble(lockedParent);
        }
        return { ...prev, categories, bubbles: [...bubbles, bubble] };
      });
      void upsertBubble(bubble);
      return bubble.id;
    },
    [mutate, resolveParent],
  );

  const setPageLabels = useCallback(
    (labels: Partial<PageLabels>) => {
      mutate((prev) => {
        const pageLabels = { ...prev.pageLabels, ...labels };
        void upsertSetting("page_labels", pageLabels);
        return { ...prev, pageLabels };
      });
    },
    [mutate],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Category>) => {
      mutate((prev) => {
        const categories = prev.categories.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        );
        const next = { ...prev, categories };
        const updated = categories.find((c) => c.id === id);
        if (updated) void upsertCategory(updated);
        return next;
      });
    },
    [mutate],
  );

  const updateBubble = useCallback(
    (id: string, patch: Partial<Bubble>) => {
      mutate((prev) => {
        const bubbles = prev.bubbles.map((b) =>
          b.id === id ? { ...b, ...patch } : b,
        );
        const next = { ...prev, bubbles };
        const updated = bubbles.find((b) => b.id === id);
        if (EXTRA_PATCH_KEYS.some((key) => key in patch)) {
          void upsertSetting("bubble_extras", collectBubbleExtras(bubbles));
        }
        if (updated) void upsertBubble(updated);
        return next;
      });
    },
    [mutate],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      const related = current.bubbles.filter((b) => b.category_id === id).map((b) => b.id);
      const deletedIds = [...new Set([...(current.deletedIds ?? []), id, ...related])];
      const next = {
        ...current,
        categories: current.categories.filter((c) => c.id !== id),
        bubbles: current.bubbles.filter((b) => b.category_id !== id),
        deletedIds,
      };
      ignoreRemoteUntil.current = Date.now() + 2500;
      setSnapshot(next);
      saveLocal(next);
      void deleteCategoryRemote(id);
      if (related.length) void deleteBubbleRemote(related);
      if (drill.kind === "category" && drill.id === id) setDrill({ kind: "root" });
      setComposer(null);
    },
    [drill],
  );

  const descendantIds = useCallback((id: string, list: Bubble[]): string[] => {
    const kids = list.filter((b) => b.parent_bubble_id === id).map((b) => b.id);
    return kids.flatMap((kid) => [kid, ...descendantIds(kid, list)]);
  }, []);

  const deleteBubble = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      const remove = [id, ...descendantIds(id, current.bubbles)];
      const deletedIds = [...new Set([...(current.deletedIds ?? []), ...remove])];
      const next = {
        ...current,
        bubbles: current.bubbles.filter((b) => !remove.includes(b.id)),
        deletedIds,
      };
      ignoreRemoteUntil.current = Date.now() + 2500;
      setSnapshot(next);
      saveLocal(next);
      void deleteBubbleRemote(remove);
      if (drill.kind === "bubble" && remove.includes(drill.id)) setDrill({ kind: "root" });
      setComposer(null);
    },
    [descendantIds, drill],
  );

  /**
   * Re-parents items into a container (category top level or a bubble), giving each a free
   * canvas slot and carrying descendants along when the category changes. Items that would
   * end up inside themselves are skipped. Persists locally and to the cloud; returns the count.
   */
  const relocate = useCallback(
    (
      base: AppSnapshot,
      ids: string[],
      target: { categoryId: string; parent: string | null },
    ): { next: AppSnapshot; changed: Bubble[]; moved: number } => {
      const byId = new Map(base.bubbles.map((b) => [b.id, b]));
      const chain = new Set<string>();
      for (let cursor = target.parent; cursor; cursor = byId.get(cursor)?.parent_bubble_id ?? null) {
        if (chain.has(cursor)) break;
        chain.add(cursor);
      }
      const moving = ids.filter((id) => {
        const item = byId.get(id);
        if (!item || chain.has(id)) return false;
        return item.parent_bubble_id !== target.parent || item.category_id !== target.categoryId;
      });
      const movingSet = new Set(moving);
      const occupied = base.bubbles
        .filter(
          (b) =>
            b.category_id === target.categoryId &&
            b.parent_bubble_id === target.parent &&
            !movingSet.has(b.id) &&
            !b.archived,
        )
        .map((b) => ({ x: b.position_x, y: b.position_y }));
      const patched = new Map<string, Bubble>();
      for (const id of moving) {
        const item = byId.get(id);
        if (!item) continue;
        const slot = freeSlot(occupied);
        occupied.push(slot);
        patched.set(id, {
          ...item,
          parent_bubble_id: target.parent,
          category_id: target.categoryId,
          position_x: slot.x,
          position_y: slot.y,
        });
        if (item.category_id !== target.categoryId) {
          for (const kid of descendantIds(id, base.bubbles)) {
            const row = patched.get(kid) ?? byId.get(kid);
            if (row) patched.set(kid, { ...row, category_id: target.categoryId });
          }
        }
      }
      // A container that had no kind yet becomes a list, since list items are landing in it.
      let categories = base.categories;
      if (target.parent) {
        const holder = patched.get(target.parent) ?? byId.get(target.parent);
        if (holder && !holder.container_type && moving.length) {
          patched.set(holder.id, { ...holder, container_type: "list" });
        }
      } else if (moving.length) {
        categories = base.categories.map((c) =>
          c.id === target.categoryId && !c.container_type ? { ...c, container_type: "list" as const } : c,
        );
      }
      const next: AppSnapshot = {
        ...base,
        categories,
        bubbles: base.bubbles.map((b) => patched.get(b.id) ?? b),
      };
      return { next, changed: [...patched.values()], moved: moving.length };
    },
    [descendantIds],
  );

  const commitRelocation = useCallback(
    (prev: AppSnapshot, result: { next: AppSnapshot; changed: Bubble[] }) => {
      ignoreRemoteUntil.current = Date.now() + 2500;
      setSnapshot(result.next);
      saveLocal(result.next);
      for (const category of result.next.categories) {
        const before = prev.categories.find((c) => c.id === category.id);
        if (!before || before.container_type !== category.container_type) void upsertCategory(category);
      }
      for (const bubble of result.changed) void upsertBubble(bubble);
    },
    [],
  );

  const containerFor = useCallback(
    (node: DrillNode, base: AppSnapshot): { categoryId: string; parent: string | null } | null => {
      if (node.kind === "category") {
        return base.categories.some((c) => c.id === node.id) ? { categoryId: node.id, parent: null } : null;
      }
      if (node.kind === "bubble") {
        const holder = base.bubbles.find((b) => b.id === node.id);
        return holder ? { categoryId: holder.category_id, parent: holder.id } : null;
      }
      return null;
    },
    [],
  );

  const moveItems = useCallback(
    (ids: string[], target: DrillNode) => {
      const base = snapshotRef.current;
      const container = containerFor(target, base);
      if (!container) return 0;
      const result = relocate(base, ids, container);
      if (result.moved) commitRelocation(base, result);
      return result.moved;
    },
    [commitRelocation, containerFor, relocate],
  );

  const splitIntoNewList = useCallback(
    (name: string, ids: string[], at: DrillNode): DrillNode | null => {
      const base = snapshotRef.current;
      const title = name.trim() || "רשימה חדשה";
      const now = new Date().toISOString();
      if (at.kind === "root") {
        const slot = freeSlot(base.categories.map((c) => ({ x: c.position_x, y: c.position_y })));
        const category: Category = {
          id: newId("cat"),
          name: title,
          color: PALETTE[base.categories.length % PALETTE.length],
          position_x: slot.x,
          position_y: slot.y,
          order_index: base.categories.length,
          created_at: now,
          container_type: "list",
        };
        const withCat: AppSnapshot = { ...base, categories: [...base.categories, category] };
        const result = relocate(withCat, ids, { categoryId: category.id, parent: null });
        commitRelocation(base, result);
        return { kind: "category", id: category.id };
      }
      const container = containerFor(at, base);
      if (!container) return null;
      const occupied = base.bubbles
        .filter(
          (b) =>
            b.category_id === container.categoryId &&
            b.parent_bubble_id === container.parent &&
            !b.archived,
        )
        .map((b) => ({ x: b.position_x, y: b.position_y }));
      const slot = freeSlot(occupied);
      const bubble: Bubble = {
        id: newId("bub"),
        parent_bubble_id: container.parent,
        category_id: container.categoryId,
        title,
        notes: "",
        color: PALETTE[occupied.length % PALETTE.length],
        status: "default",
        position_x: slot.x,
        position_y: slot.y,
        size_multiplier: 1,
        created_at: now,
        is_tracking: false,
        target_days: 30,
        weekly_frequency: 7,
        tracking_history: [],
        streak_mode: "flexible",
        container_type: "list",
        ...EMPTY_ITEM_TOOLS,
      };
      // The level holding the new bubble shows bubbles, so lock an undecided kind accordingly.
      const holderLocked = (kind: WorldKind | null) => kind ?? ("bubbles" as const);
      const withBubble: AppSnapshot = {
        ...base,
        categories: container.parent
          ? base.categories
          : base.categories.map((c) =>
              c.id === container.categoryId ? { ...c, container_type: holderLocked(c.container_type) } : c,
            ),
        bubbles: [
          ...base.bubbles.map((b) =>
            b.id === container.parent ? { ...b, container_type: holderLocked(b.container_type) } : b,
          ),
          bubble,
        ],
      };
      const result = relocate(withBubble, ids, { categoryId: container.categoryId, parent: bubble.id });
      const changed = [...result.changed];
      if (!changed.some((b) => b.id === bubble.id)) changed.push(bubble);
      const holder = container.parent ? result.next.bubbles.find((b) => b.id === container.parent) : undefined;
      if (holder && holder.container_type !== base.bubbles.find((b) => b.id === holder.id)?.container_type) {
        changed.push(holder);
      }
      commitRelocation(base, { next: result.next, changed });
      return { kind: "bubble", id: bubble.id };
    },
    [commitRelocation, containerFor, relocate],
  );

  const moveNode = useCallback(
    (type: "category" | "bubble", id: string, x: number, y: number) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const pos = { position_x: clampPos(x), position_y: clampPos(y) };
      if (type === "category") updateCategory(id, pos);
      else updateBubble(id, pos);
    },
    [updateCategory, updateBubble],
  );

  const applyStatusColor = useCallback(
    (status: BubbleStatus, color: string) => {
      mutate((prev) => {
        const colorRoles: ColorRoles = { ...prev.colorRoles, [status]: color };
        const bubbles = prev.bubbles.map((b) =>
          b.status === status ? { ...b, color } : b,
        );
        void upsertColorRoles(colorRoles);
        for (const b of bubbles.filter((item) => item.status === status)) {
          void upsertBubble(b);
        }
        return { ...prev, colorRoles, bubbles };
      });
    },
    [mutate],
  );

  const markToday = useCallback(
    (id: string) => {
      const bubble = snapshotRef.current.bubbles.find((b) => b.id === id);
      if (!bubble) return;
      updateBubble(id, {
        tracking_history: markDone(bubble.tracking_history, todayKey()),
        is_tracking: true,
        status: "active_tracking",
        color: snapshotRef.current.colorRoles.active_tracking,
      });
    },
    [updateBubble],
  );

  const unmarkToday = useCallback(
    (id: string) => {
      const bubble = snapshotRef.current.bubbles.find((b) => b.id === id);
      if (!bubble) return;
      updateBubble(id, {
        tracking_history: removeDate(bubble.tracking_history, todayKey()),
      });
    },
    [updateBubble],
  );

  const minusDay = useCallback(
    (id: string) => {
      const bubble = snapshotRef.current.bubbles.find((b) => b.id === id);
      if (!bubble) return;
      updateBubble(id, {
        tracking_history: removeLastDay(bubble.tracking_history),
      });
    },
    [updateBubble],
  );

  const resetTracking = useCallback(
    (id: string) => {
      updateBubble(id, { tracking_history: [], done_offset: 0, streak_offset: 0 });
    },
    [updateBubble],
  );

  const toggleTrackingDate = useCallback(
    (id: string, date: string) => {
      const bubble = snapshotRef.current.bubbles.find((b) => b.id === id);
      if (!bubble || date > todayKey()) return;
      updateBubble(id, { tracking_history: toggleDate(bubble.tracking_history, date) });
    },
    [updateBubble],
  );

  const persistTriangles = useCallback((triangleTypes: TriangleType[]) => {
    void upsertSetting("triangle_types", triangleTypes);
  }, []);

  const setTriangleType = useCallback(
    (id: string, triangleId: string | null) => {
      if (!triangleId) {
        updateBubble(id, clearTrianglePatch(snapshotRef.current.colorRoles.default));
        return;
      }
      const type = snapshotRef.current.triangleTypes.find((item) => item.id === triangleId);
      if (!type) return;
      updateBubble(id, trianglePatch(type));
    },
    [updateBubble],
  );

  const addTriangleType = useCallback(() => {
    const id = newId("tri");
    mutate((prev) => {
      const type: TriangleType = {
        id,
        name: "סוג חדש",
        color: PALETTE[prev.triangleTypes.length % PALETTE.length] ?? "#94a3b8",
        template: "tracking",
        order_index: prev.triangleTypes.length,
        counter_migrated: true,
      };
      const triangleTypes = [...prev.triangleTypes, type];
      persistTriangles(triangleTypes);
      return { ...prev, triangleTypes };
    });
    return id;
  }, [mutate, persistTriangles]);

  const updateTriangleType = useCallback(
    (id: string, patch: Partial<TriangleType>) => {
      mutate((prev) => {
        // A manual template pick is final: the legacy counter auto-upgrade must not undo it.
        const triangleTypes = prev.triangleTypes.map((item) =>
          item.id === id
            ? { ...item, ...patch, ...(patch.template ? { counter_migrated: true } : {}) }
            : item,
        );
        const nextType = triangleTypes.find((item) => item.id === id);
        const bubbles = nextType
          ? prev.bubbles.map((bubble) =>
              bubble.triangle_id === id
                ? { ...bubble, ...trianglePatch(nextType), notes: bubble.notes }
                : bubble,
            )
          : prev.bubbles;
        persistTriangles(triangleTypes);
        if (nextType) {
          for (const bubble of bubbles.filter((item) => item.triangle_id === id)) {
            void upsertBubble(bubble);
          }
        }
        return { ...prev, triangleTypes, bubbles };
      });
    },
    [mutate, persistTriangles],
  );

  const deleteTriangleType = useCallback(
    (id: string) => {
      mutate((prev) => {
        if (prev.triangleTypes.length <= 1) return prev;
        const triangleTypes = prev.triangleTypes
          .filter((item) => item.id !== id)
          .map((item, index) => ({ ...item, order_index: index }));
        const fallback = triangleTypes[0] ?? DEFAULT_TRIANGLE_TYPES[0];
        const bubbles = prev.bubbles.map((bubble) =>
          bubble.triangle_id === id ? { ...bubble, ...trianglePatch(fallback) } : bubble,
        );
        persistTriangles(triangleTypes);
        for (const bubble of bubbles.filter((item) => item.triangle_id === fallback.id)) {
          void upsertBubble(bubble);
        }
        return { ...prev, triangleTypes, bubbles };
      });
    },
    [mutate, persistTriangles],
  );

  const persistDaily = useCallback((dailyTasks: DailyTask[]) => {
    // No blank trimming here: a row just added with "+" must survive until it gets text.
    const next = applyDailyRollover(dailyTasks, todayKey(), { trimBlanks: false });
    void upsertSetting("daily_tasks", next);
    return next;
  }, []);

  const setDailyViewDate = useCallback(
    (date: string) => {
      setDailyViewDateState(date);
      mutate((prev) => {
        const dailyTasks = persistDaily(ensureDateSlots(prev.dailyTasks, date));
        return { ...prev, dailyTasks };
      });
    },
    [mutate, persistDaily],
  );

  const addDailyTask = useCallback(() => {
    const date = dailyViewDate || todayKey();
    const id = emptyDailyTask(date, 0).id;
    mutate((prev) => {
      const order_index = dateTasks(prev.dailyTasks, date).length;
      const dailyTasks = persistDaily([
        ...prev.dailyTasks,
        { ...emptyDailyTask(date, order_index), id },
      ]);
      return { ...prev, dailyTasks };
    });
    return id;
  }, [dailyViewDate, mutate, persistDaily]);

  const updateDailyTask = useCallback(
    (id: string, patch: Partial<DailyTask>) => {
      mutate((prev) => {
        const dailyTasks = persistDaily(
          prev.dailyTasks.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );
        return { ...prev, dailyTasks };
      });
    },
    [mutate, persistDaily],
  );

  const deleteDailyTask = useCallback(
    (id: string) => {
      mutate((prev) => {
        // No refill: deleting rows may leave fewer than 6 for the day.
        const dailyTasks = persistDaily(prev.dailyTasks.filter((item) => item.id !== id));
        return { ...prev, dailyTasks };
      });
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
        const dailyTasks = persistDaily(updated);
        return { ...prev, dailyTasks };
      });
    },
    [mutate, persistDaily],
  );

  const persistSuccesses = useCallback((successes: Success[]) => {
    void upsertSetting("successes", successes);
    return successes;
  }, []);

  const addSuccess = useCallback(
    (input: {
      title: string;
      notes?: string;
      source_type?: Success["source_type"];
      category_name?: string;
    }) => {
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
        const successes = persistSuccesses([success, ...prev.successes]);
        return { ...prev, successes };
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
    [addSuccess],
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
      return addSuccess({
        title: task.text.trim(),
        notes: "",
        source_type: "daily",
        category_name: "משימות יומיות",
      });
    },
    [addSuccess],
  );

  const updateSuccess = useCallback(
    (id: string, patch: Partial<Success>) => {
      mutate((prev) => {
        const successes = persistSuccesses(
          prev.successes.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );
        return { ...prev, successes };
      });
    },
    [mutate, persistSuccesses],
  );

  const deleteSuccess = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      const deletedIds = [...new Set([...(current.deletedIds ?? []), id])];
      const successes = persistSuccesses(current.successes.filter((item) => item.id !== id));
      const next = { ...current, successes, deletedIds };
      ignoreRemoteUntil.current = Date.now() + 2500;
      setSnapshot(next);
      saveLocal(next);
    },
    [persistSuccesses],
  );

  const toggleDailyTask = useCallback(
    (id: string) => {
      mutate((prev) => {
        const dailyTasks = persistDaily(
          prev.dailyTasks.map((item) =>
            item.id === id ? { ...item, completed: !item.completed } : item,
          ),
        );
        return { ...prev, dailyTasks };
      });
    },
    [mutate, persistDaily],
  );

  const moveTriangleType = useCallback(
    (id: string, direction: -1 | 1) => {
      mutate((prev) => {
        const list = [...prev.triangleTypes].sort((a, b) => a.order_index - b.order_index);
        const index = list.findIndex((item) => item.id === id);
        const swap = index + direction;
        if (index < 0 || swap < 0 || swap >= list.length) return prev;
        const current = list[index];
        const other = list[swap];
        if (!current || !other) return prev;
        list[index] = other;
        list[swap] = current;
        const triangleTypes = list.map((item, order_index) => ({ ...item, order_index }));
        persistTriangles(triangleTypes);
        return { ...prev, triangleTypes };
      });
    },
    [mutate, persistTriangles],
  );

  const childrenOf = useCallback(
    (bubbleId: string) =>
      snapshot.bubbles.filter((b) => b.parent_bubble_id === bubbleId),
    [snapshot.bubbles],
  );

  const breadcrumbs = useMemo<Breadcrumb[]>(() => {
    const trail: Breadcrumb[] = [
      { id: "root", label: "מפת עולמות", node: { kind: "root" } },
    ];
    if (drill.kind === "root") return trail;
    if (drill.kind === "category") {
      const cat = snapshot.categories.find((c) => c.id === drill.id);
      if (cat) trail.push({ id: cat.id, label: cat.name, node: { kind: "category", id: cat.id } });
      return trail;
    }
    const bubble = snapshot.bubbles.find((b) => b.id === drill.id);
    if (!bubble) return trail;
    const cat = snapshot.categories.find((c) => c.id === bubble.category_id);
    if (cat) trail.push({ id: cat.id, label: cat.name, node: { kind: "category", id: cat.id } });
    const stack: Bubble[] = [];
    let cursor: Bubble | undefined = bubble;
    while (cursor) {
      stack.unshift(cursor);
      cursor = cursor.parent_bubble_id
        ? snapshot.bubbles.find((b) => b.id === cursor?.parent_bubble_id)
        : undefined;
    }
    for (const node of stack) {
      trail.push({
        id: node.id,
        label: node.title,
        node: { kind: "bubble", id: node.id },
      });
    }
    return trail;
  }, [drill, snapshot.bubbles, snapshot.categories]);

  const currentTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? "עולמות";
  const drillKey =
    drill.kind === "root"
      ? "root"
      : drill.kind === "category"
        ? `category:${drill.id}`
        : `bubble:${drill.id}`;

  const currentWorldKind = useMemo<WorldKind | null>(() => {
    if (drill.kind === "root") return "bubbles";
    if (drill.kind === "category") {
      return snapshot.categories.find((c) => c.id === drill.id)?.container_type ?? null;
    }
    return snapshot.bubbles.find((b) => b.id === drill.id)?.container_type ?? null;
  }, [drill, snapshot.bubbles, snapshot.categories]);

  const lockWorldKind = useCallback(
    (kind: WorldKind) => {
      if (drill.kind === "root") return;
      if (drill.kind === "category") updateCategory(drill.id, { container_type: kind });
      else updateBubble(drill.id, { container_type: kind });
    },
    [drill, updateBubble, updateCategory],
  );

  const requestCreate = useCallback(() => {
    if (drill.kind === "root") {
      setComposer({ mode: "create", type: "category" });
      return;
    }
    if (currentWorldKind === "list") {
      setFocusListAdd((n) => n + 1);
      return;
    }
    if (currentWorldKind === "bubbles") {
      setComposer({ mode: "create", type: "bubble" });
    }
  }, [currentWorldKind, drill.kind]);

  const visibleCategories = drill.kind === "root" ? snapshot.categories : [];
  const visibleBubbles = useMemo(() => {
    if (drill.kind === "root") return [];
    if (drill.kind === "category") {
      return snapshot.bubbles.filter(
        (b) => b.category_id === drill.id && b.parent_bubble_id === null && !b.archived,
      );
    }
    return snapshot.bubbles.filter((b) => b.parent_bubble_id === drill.id && !b.archived);
  }, [drill, snapshot.bubbles]);

  const value = useMemo<AppContextValue>(
    () => ({
      snapshot,
      cloud: isCloudEnabled,
      page,
      setPage,
      drill,
      setDrill,
      breadcrumbs,
      currentTitle,
      visibleCategories,
      visibleBubbles,
      childrenOf,
      composer,
      openCreate: (type) => setComposer({ mode: "create", type }),
      openEditor: (target) => setComposer({ mode: "edit", ...target }),
      closeComposer: () => setComposer(null),
      commitCreate,
      addListItem,
      setPageLabels,
      currentWorldKind,
      lockWorldKind,
      requestCreate,
      focusListAdd,
      drillKey,
      updateCategory,
      updateBubble,
      deleteCategory,
      deleteBubble,
      moveItems,
      splitIntoNewList,
      moveNode,
      applyStatusColor,
      markToday,
      unmarkToday,
      minusDay,
      resetTracking,
      toggleTrackingDate,
      setTriangleType,
      addTriangleType,
      updateTriangleType,
      deleteTriangleType,
      moveTriangleType,
      addDailyTask,
      updateDailyTask,
      deleteDailyTask,
      toggleDailyTask,
      dailyViewDate,
      setDailyViewDate,
      moveDailyTask,
      addSuccess,
      saveBubbleAsSuccess,
      archiveBubbleAsSuccess,
      saveDailyAsSuccess,
      updateSuccess,
      deleteSuccess,
      syncing,
      lastPush,
      pushToCloud,
      exportBackup,
    }),
    [
      exportBackup,
      lastPush,
      pushToCloud,
      syncing,
      addDailyTask,
      addListItem,
      addSuccess,
      addTriangleType,
      applyStatusColor,
      breadcrumbs,
      childrenOf,
      composer,
      commitCreate,
      currentTitle,
      currentWorldKind,
      dailyViewDate,
      deleteBubble,
      moveItems,
      splitIntoNewList,
      deleteCategory,
      deleteDailyTask,
      deleteSuccess,
      deleteTriangleType,
      drill,
      drillKey,
      focusListAdd,
      lockWorldKind,
      markToday,
      minusDay,
      moveDailyTask,
      moveNode,
      moveTriangleType,
      page,
      requestCreate,
      resetTracking,
      toggleTrackingDate,
      saveBubbleAsSuccess,
      archiveBubbleAsSuccess,
      saveDailyAsSuccess,
      setPageLabels,
      setTriangleType,
      toggleDailyTask,
      snapshot,
      updateSuccess,
      updateDailyTask,
      updateTriangleType,
      unmarkToday,
      updateBubble,
      updateCategory,
      visibleBubbles,
      visibleCategories,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
