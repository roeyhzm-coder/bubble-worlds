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
import { DEFAULT_COLOR_ROLES, newId, todayKey } from "../lib/defaults";
import { loadLocal, mergeSnapshots, saveLocal } from "../lib/storage";
import {
  deleteBubbleRemote,
  deleteCategoryRemote,
  fetchRemoteSnapshot,
  isCloudEnabled,
  subscribeRealtime,
  upsertBubble,
  upsertCategory,
  upsertColorRoles,
  upsertSetting,
} from "../lib/supabase";
import { markDone, removeLastDay } from "../lib/tracking";
import type {
  AppSnapshot,
  Breadcrumb,
  Bubble,
  BubbleStatus,
  Category,
  ColorRoles,
  DrillNode,
  PageLabels,
} from "../types";

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
  editing: { type: "category" | "bubble"; id: string } | null;
  openEditor: (target: { type: "category" | "bubble"; id: string }) => void;
  closeEditor: () => void;
  addCategory: () => void;
  addBubble: (opts?: { title?: string; openEditor?: boolean }) => string | null;
  setPageLabels: (labels: Partial<PageLabels>) => void;
  toggleListView: (key: string) => void;
  drillKey: string;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  updateBubble: (id: string, patch: Partial<Bubble>) => void;
  deleteCategory: (id: string) => void;
  deleteBubble: (id: string) => void;
  moveNode: (
    type: "category" | "bubble",
    id: string,
    x: number,
    y: number,
  ) => void;
  applyStatusColor: (status: BubbleStatus, color: string) => void;
  markToday: (id: string) => void;
  minusDay: (id: string) => void;
  resetTracking: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function clampPos(n: number): number {
  return Math.min(92, Math.max(8, n));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => loadLocal());
  const [page, setPage] = useState(0);
  const [drill, setDrill] = useState<DrillNode>({ kind: "root" });
  const [editing, setEditing] = useState<{
    type: "category" | "bubble";
    id: string;
  } | null>(null);
  const applyingRemote = useRef(false);
  const ignoreRemoteUntil = useRef(0);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const persist = useCallback((next: AppSnapshot) => {
    saveLocal(next);
  }, []);

  useEffect(() => {
    persist(snapshot);
  }, [snapshot, persist]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await fetchRemoteSnapshot();
      if (!remote || cancelled) return;
      applyingRemote.current = true;
      setSnapshot((local) => {
        const merged = mergeSnapshots(local, remote);
        for (const cat of merged.categories) void upsertCategory(cat);
        for (const bub of merged.bubbles) void upsertBubble(bub);
        void upsertColorRoles(merged.colorRoles);
        void upsertSetting("page_labels", merged.pageLabels);
        void upsertSetting("list_views", merged.listViews);
        return merged;
      });
      queueMicrotask(() => {
        applyingRemote.current = false;
      });
    })();
    return subscribeRealtime((remote) => {
      if (applyingRemote.current || Date.now() < ignoreRemoteUntil.current) return;
      applyingRemote.current = true;
      setSnapshot((local) => mergeSnapshots(local, remote));
      queueMicrotask(() => {
        applyingRemote.current = false;
      });
    });
  }, []);

  const mutate = useCallback((updater: (prev: AppSnapshot) => AppSnapshot) => {
    ignoreRemoteUntil.current = Date.now() + 900;
    setSnapshot((prev) => updater(prev));
  }, []);

  const addCategory = useCallback(() => {
    const cat: Category = {
      id: newId("cat"),
      name: "עולם חדש",
      color: DEFAULT_COLOR_ROLES.default,
      position_x: 50,
      position_y: 50,
      order_index: snapshotRef.current.categories.length,
      created_at: new Date().toISOString(),
    };
    mutate((prev) => ({ ...prev, categories: [...prev.categories, cat] }));
    void upsertCategory(cat);
    setEditing({ type: "category", id: cat.id });
  }, [mutate]);

  const addBubble = useCallback(
    (opts?: { title?: string; openEditor?: boolean }) => {
      const current = snapshotRef.current;
      let categoryId = current.categories[0]?.id;
      let parent: string | null = null;
      if (drill.kind === "category") categoryId = drill.id;
      if (drill.kind === "bubble") {
        const parentBubble = current.bubbles.find((b) => b.id === drill.id);
        categoryId = parentBubble?.category_id ?? categoryId;
        parent = drill.id;
      }
      if (!categoryId) {
        addCategory();
        return null;
      }
      const roles = current.colorRoles;
      const bubble: Bubble = {
        id: newId("bub"),
        parent_bubble_id: parent,
        category_id: categoryId,
        title: opts?.title?.trim() || "בועה חדשה",
        notes: "",
        color: roles.default,
        status: "default",
        position_x: 42 + Math.random() * 16,
        position_y: 38 + Math.random() * 16,
        size_multiplier: 1,
        created_at: new Date().toISOString(),
        is_tracking: false,
        target_days: 30,
        weekly_frequency: 7,
        tracking_history: [],
        streak_mode: "flexible",
      };
      mutate((prev) => ({ ...prev, bubbles: [...prev.bubbles, bubble] }));
      void upsertBubble(bubble);
      if (opts?.openEditor !== false && !opts?.title) {
        setEditing({ type: "bubble", id: bubble.id });
      }
      return bubble.id;
    },
    [addCategory, drill, mutate],
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

  const toggleListView = useCallback(
    (key: string) => {
      mutate((prev) => {
        const listViews = { ...prev.listViews, [key]: !prev.listViews[key] };
        void upsertSetting("list_views", listViews);
        return { ...prev, listViews };
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
        if (updated) void upsertBubble(updated);
        return next;
      });
    },
    [mutate],
  );

  const deleteCategory = useCallback(
    (id: string) => {
      mutate((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        bubbles: prev.bubbles.filter((b) => b.category_id !== id),
      }));
      void deleteCategoryRemote(id);
      if (drill.kind === "category" && drill.id === id) setDrill({ kind: "root" });
      setEditing(null);
    },
    [drill, mutate],
  );

  const descendantIds = useCallback((id: string, list: Bubble[]): string[] => {
    const kids = list.filter((b) => b.parent_bubble_id === id).map((b) => b.id);
    return kids.flatMap((kid) => [kid, ...descendantIds(kid, list)]);
  }, []);

  const deleteBubble = useCallback(
    (id: string) => {
      mutate((prev) => {
        const remove = new Set([id, ...descendantIds(id, prev.bubbles)]);
        return {
          ...prev,
          bubbles: prev.bubbles.filter((b) => !remove.has(b.id)),
        };
      });
      void deleteBubbleRemote(id);
      if (drill.kind === "bubble" && drill.id === id) setDrill({ kind: "root" });
      setEditing(null);
    },
    [descendantIds, drill, mutate],
  );

  const moveNode = useCallback(
    (type: "category" | "bubble", id: string, x: number, y: number) => {
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
      updateBubble(id, { tracking_history: [] });
    },
    [updateBubble],
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

  const visibleCategories = drill.kind === "root" ? snapshot.categories : [];
  const visibleBubbles = useMemo(() => {
    if (drill.kind === "root") return [];
    if (drill.kind === "category") {
      return snapshot.bubbles.filter(
        (b) => b.category_id === drill.id && b.parent_bubble_id === null,
      );
    }
    return snapshot.bubbles.filter((b) => b.parent_bubble_id === drill.id);
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
      editing,
      openEditor: setEditing,
      closeEditor: () => setEditing(null),
      addCategory,
      addBubble,
      setPageLabels,
      toggleListView,
      drillKey,
      updateCategory,
      updateBubble,
      deleteCategory,
      deleteBubble,
      moveNode,
      applyStatusColor,
      markToday,
      minusDay,
      resetTracking,
    }),
    [
      addBubble,
      addCategory,
      applyStatusColor,
      drillKey,
      breadcrumbs,
      childrenOf,
      currentTitle,
      deleteBubble,
      deleteCategory,
      drill,
      editing,
      markToday,
      minusDay,
      moveNode,
      page,
      resetTracking,
      setPageLabels,
      snapshot,
      toggleListView,
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
