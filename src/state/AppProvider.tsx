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
import { EMPTY_ITEM_TOOLS, PALETTE, layoutRing, newId, todayKey } from "../lib/defaults";
import { DEFAULT_TRIANGLE_TYPES, clearTrianglePatch, trianglePatch } from "../lib/triangles";
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
import { markDone, removeDate, removeLastDay } from "../lib/tracking";
import type {
  AppSnapshot,
  Breadcrumb,
  Bubble,
  BubbleStatus,
  Category,
  ColorRoles,
  DrillNode,
  PageLabels,
  TriangleType,
  WorldKind,
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
  setTriangleType: (id: string, triangleId: string | null) => void;
  addTriangleType: () => string;
  updateTriangleType: (id: string, patch: Partial<TriangleType>) => void;
  deleteTriangleType: (id: string) => void;
  moveTriangleType: (id: string, direction: -1 | 1) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

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
        void upsertSetting("triangle_types", merged.triangleTypes);
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
      setComposer(null);
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
      setComposer(null);
    },
    [descendantIds, drill, mutate],
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
      updateBubble(id, { tracking_history: [] });
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
        const triangleTypes = prev.triangleTypes.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
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
      moveNode,
      applyStatusColor,
      markToday,
      unmarkToday,
      minusDay,
      resetTracking,
      setTriangleType,
      addTriangleType,
      updateTriangleType,
      deleteTriangleType,
      moveTriangleType,
    }),
    [
      addListItem,
      addTriangleType,
      applyStatusColor,
      breadcrumbs,
      childrenOf,
      composer,
      commitCreate,
      currentTitle,
      currentWorldKind,
      deleteBubble,
      deleteCategory,
      deleteTriangleType,
      drill,
      drillKey,
      focusListAdd,
      lockWorldKind,
      markToday,
      minusDay,
      moveNode,
      moveTriangleType,
      page,
      requestCreate,
      resetTracking,
      setPageLabels,
      setTriangleType,
      snapshot,
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
