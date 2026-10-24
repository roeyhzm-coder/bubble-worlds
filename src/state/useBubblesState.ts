import { useCallback, useMemo } from "react";
import { EMPTY_ITEM_TOOLS, PALETTE, freeSlot, layoutRing, newId, todayKey } from "../lib/defaults";
import { markDone, removeDate, removeLastDay, toggleDate } from "../lib/tracking";
import {
  deleteBubbleRemote,
  deleteCategoryRemote,
  upsertBubble,
  upsertCategory,
} from "../lib/supabase";
import { BUBBLE_EXTRA_KEYS, type AppSnapshot, type Bubble, type Category, type DrillNode, type WorldKind } from "../types";
import type { NavigationState } from "./useNavigationState";
import type { Store } from "./store";
import type { UndoStack } from "./useUndoStack";

function clampPos(n: number): number {
  return Math.min(92, Math.max(8, n));
}

function touchesExtras(patch: Partial<Bubble>): boolean {
  return BUBBLE_EXTRA_KEYS.some((key) => key in patch);
}

function touchesRow(patch: Partial<Bubble>): boolean {
  return Object.keys(patch).some(
    (key) => !(BUBBLE_EXTRA_KEYS as readonly string[]).includes(key) && key !== "extras_updated_at",
  );
}

function newBubbleBase(now: string): Omit<Bubble, "id" | "parent_bubble_id" | "category_id" | "title" | "color" | "position_x" | "position_y"> {
  return {
    notes: "",
    status: "default",
    size_multiplier: 1,
    created_at: now,
    is_tracking: false,
    target_days: 30,
    weekly_frequency: 7,
    tracking_history: [],
    streak_mode: "flexible",
    container_type: null,
    ...EMPTY_ITEM_TOOLS,
  };
}

export interface BubblesState {
  commitCreate: (input: { name: string; color: string; size_multiplier: number }) => void;
  addListItem: (title: string) => string | null;
  lockWorldKind: (kind: WorldKind) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  updateBubble: (id: string, patch: Partial<Bubble>) => void;
  deleteCategory: (id: string) => void;
  deleteBubble: (id: string) => void;
  moveItems: (ids: string[], target: DrillNode) => number;
  splitIntoNewList: (name: string, ids: string[], at: DrillNode) => DrillNode | null;
  /** Saves `orderedIds` as the manual order (index = position) for those items. */
  reorderItems: (orderedIds: string[]) => void;
  moveNode: (type: "category" | "bubble", id: string, x: number, y: number) => void;
  markToday: (id: string) => void;
  unmarkToday: (id: string) => void;
  minusDay: (id: string) => void;
  resetTracking: (id: string) => void;
  toggleTrackingDate: (id: string, date: string) => void;
}

export function useBubblesState(store: Store, nav: NavigationState, undo: UndoStack): BubblesState {
  const { snapshotRef, mutate, commit, scheduleExtrasSync } = store;
  const { drill, setDrill, composer, setComposer, resolveParent } = nav;
  const { recordUndo } = undo;

  const commitCreate = useCallback(
    (input: { name: string; color: string; size_multiplier: number }) => {
      const name = input.name.trim() || "בועה חדשה";
      if (composer?.mode === "create" && composer.type === "category") {
        const slot = layoutRing(snapshotRef.current.categories.length, snapshotRef.current.categories.length + 1);
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
        (item) => item.category_id === categoryId && item.parent_bubble_id === parent,
      );
      const slot = layoutRing(siblings.length, siblings.length + 1);
      const bubble: Bubble = {
        ...newBubbleBase(new Date().toISOString()),
        id: newId("bub"),
        parent_bubble_id: parent,
        category_id: categoryId,
        title: name,
        color: input.color,
        position_x: slot.x,
        position_y: slot.y,
        size_multiplier: input.size_multiplier,
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
              item.id === parent && !item.container_type ? { ...item, container_type: "bubbles" as const } : item,
            )
          : prev.bubbles;
        const lockedCat = !parent ? categories.find((c) => c.id === categoryId) : undefined;
        const lockedParent = parent ? bubbles.find((b) => b.id === parent) : undefined;
        if (lockedCat && lockedCat.container_type === "bubbles") void upsertCategory(lockedCat);
        if (lockedParent && lockedParent.container_type === "bubbles") void upsertBubble(lockedParent);
        return { ...prev, categories, bubbles: [...bubbles, bubble] };
      });
      void upsertBubble(bubble);
      setComposer(null);
    },
    [composer, mutate, resolveParent, setComposer, snapshotRef],
  );

  const addListItem = useCallback(
    (title: string) => {
      const { categoryId, parent } = resolveParent();
      if (!categoryId) return null;
      const siblings = snapshotRef.current.bubbles.filter(
        (item) => item.category_id === categoryId && item.parent_bubble_id === parent,
      );
      const slot = layoutRing(siblings.length, siblings.length + 1);
      const bubble: Bubble = {
        ...newBubbleBase(new Date().toISOString()),
        id: newId("bub"),
        parent_bubble_id: parent,
        category_id: categoryId,
        title: title.trim() || "פריט חדש",
        position_x: slot.x,
        position_y: slot.y,
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
              item.id === parent && !item.container_type ? { ...item, container_type: "list" as const } : item,
            )
          : prev.bubbles;
        const lockedCat = !parent ? categories.find((c) => c.id === categoryId) : undefined;
        const lockedParent = parent ? bubbles.find((b) => b.id === parent) : undefined;
        if (lockedCat && lockedCat.container_type === "list") void upsertCategory(lockedCat);
        if (lockedParent && lockedParent.container_type === "list") void upsertBubble(lockedParent);
        return { ...prev, categories, bubbles: [...bubbles, bubble] };
      });
      void upsertBubble(bubble);
      return bubble.id;
    },
    [mutate, resolveParent, snapshotRef],
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Category>) => {
      mutate((prev) => {
        const categories = prev.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
        const updated = categories.find((c) => c.id === id);
        if (updated) void upsertCategory(updated);
        return { ...prev, categories };
      });
    },
    [mutate],
  );

  const updateBubble = useCallback(
    (id: string, patch: Partial<Bubble>) => {
      const extras = touchesExtras(patch);
      const stamped = extras ? { ...patch, extras_updated_at: Date.now() } : patch;
      mutate((prev) => {
        const bubbles = prev.bubbles.map((b) => (b.id === id ? { ...b, ...stamped } : b));
        const updated = bubbles.find((b) => b.id === id);
        // Extras-only edits (counters, order, routine) don't touch the table row.
        if (updated && touchesRow(patch)) void upsertBubble(updated);
        return { ...prev, bubbles };
      });
      if (extras) scheduleExtrasSync();
    },
    [mutate, scheduleExtrasSync],
  );

  const lockWorldKind = useCallback(
    (kind: WorldKind) => {
      if (drill.kind === "root") return;
      if (drill.kind === "category") updateCategory(drill.id, { container_type: kind });
      else updateBubble(drill.id, { container_type: kind });
    },
    [drill, updateBubble, updateCategory],
  );

  const descendantIds = useCallback((id: string, list: Bubble[]): string[] => {
    const out: string[] = [];
    const queue = [id];
    const seen = new Set([id]);
    while (queue.length) {
      const current = queue.shift() as string;
      for (const kid of list) {
        if (kid.parent_bubble_id === current && !seen.has(kid.id)) {
          seen.add(kid.id);
          out.push(kid.id);
          queue.push(kid.id);
        }
      }
    }
    return out;
  }, []);

  const deleteCategory = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      const category = current.categories.find((c) => c.id === id);
      const related = current.bubbles.filter((b) => b.category_id === id).map((b) => b.id);
      const deletedIds = [...new Set([...(current.deletedIds ?? []), id, ...related])];
      const next: AppSnapshot = {
        ...current,
        categories: current.categories.filter((c) => c.id !== id),
        bubbles: current.bubbles.filter((b) => b.category_id !== id),
        deletedIds,
      };
      commit(next);
      recordUndo(`העולם "${category?.name ?? ""}" נמחק`, current, next);
      void deleteCategoryRemote(id);
      if (related.length) void deleteBubbleRemote(related);
      if (drill.kind === "category" && drill.id === id) setDrill({ kind: "root" });
      setComposer(null);
    },
    [commit, drill, recordUndo, setComposer, setDrill, snapshotRef],
  );

  const deleteBubble = useCallback(
    (id: string) => {
      const current = snapshotRef.current;
      const bubble = current.bubbles.find((b) => b.id === id);
      const remove = new Set([id, ...descendantIds(id, current.bubbles)]);
      const deletedIds = [...new Set([...(current.deletedIds ?? []), ...remove])];
      const next: AppSnapshot = {
        ...current,
        bubbles: current.bubbles.filter((b) => !remove.has(b.id)),
        deletedIds,
      };
      commit(next);
      recordUndo(`"${bubble?.title || "פריט"}" נמחק`, current, next);
      void deleteBubbleRemote([...remove]);
      if (drill.kind === "bubble" && remove.has(drill.id)) setDrill({ kind: "root" });
      setComposer(null);
    },
    [commit, descendantIds, drill, recordUndo, setComposer, setDrill, snapshotRef],
  );

  /**
   * Re-parents items into a container (category top level or a bubble), giving each a free
   * canvas slot and carrying descendants along when the category changes. Items that would
   * end up inside themselves are skipped.
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
    (prev: AppSnapshot, result: { next: AppSnapshot; changed: Bubble[] }, label: string) => {
      commit(result.next);
      recordUndo(label, prev, result.next);
      for (const category of result.next.categories) {
        const before = prev.categories.find((c) => c.id === category.id);
        if (!before || before.container_type !== category.container_type) void upsertCategory(category);
      }
      for (const bubble of result.changed) void upsertBubble(bubble);
    },
    [commit, recordUndo],
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
      if (result.moved) commitRelocation(base, result, `הועברו ${result.moved} פריטים`);
      return result.moved;
    },
    [commitRelocation, containerFor, relocate, snapshotRef],
  );

  const splitIntoNewList = useCallback(
    (name: string, ids: string[], at: DrillNode): DrillNode | null => {
      const base = snapshotRef.current;
      const title = name.trim() || "רשימה חדשה";
      const now = new Date().toISOString();
      const label = `נוצרה "${title}" והועברו ${ids.length} פריטים`;
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
        commitRelocation(base, result, label);
        return { kind: "category", id: category.id };
      }
      const container = containerFor(at, base);
      if (!container) return null;
      const occupied = base.bubbles
        .filter(
          (b) => b.category_id === container.categoryId && b.parent_bubble_id === container.parent && !b.archived,
        )
        .map((b) => ({ x: b.position_x, y: b.position_y }));
      const slot = freeSlot(occupied);
      const bubble: Bubble = {
        ...newBubbleBase(now),
        id: newId("bub"),
        parent_bubble_id: container.parent,
        category_id: container.categoryId,
        title,
        color: PALETTE[occupied.length % PALETTE.length],
        position_x: slot.x,
        position_y: slot.y,
        container_type: "list",
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
      commitRelocation(base, { next: result.next, changed }, label);
      return { kind: "bubble", id: bubble.id };
    },
    [commitRelocation, containerFor, relocate, snapshotRef],
  );

  const reorderItems = useCallback(
    (orderedIds: string[]) => {
      const position = new Map(orderedIds.map((id, index) => [id, index]));
      const now = Date.now();
      mutate((prev) => ({
        ...prev,
        bubbles: prev.bubbles.map((b) => {
          const order_index = position.get(b.id);
          return order_index === undefined || b.order_index === order_index
            ? b
            : { ...b, order_index, extras_updated_at: now };
        }),
      }));
      scheduleExtrasSync();
    },
    [mutate, scheduleExtrasSync],
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
    [snapshotRef, updateBubble],
  );

  const unmarkToday = useCallback(
    (id: string) => {
      const bubble = snapshotRef.current.bubbles.find((b) => b.id === id);
      if (!bubble) return;
      updateBubble(id, { tracking_history: removeDate(bubble.tracking_history, todayKey()) });
    },
    [snapshotRef, updateBubble],
  );

  const minusDay = useCallback(
    (id: string) => {
      const bubble = snapshotRef.current.bubbles.find((b) => b.id === id);
      if (!bubble) return;
      updateBubble(id, { tracking_history: removeLastDay(bubble.tracking_history) });
    },
    [snapshotRef, updateBubble],
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
    [snapshotRef, updateBubble],
  );

  return useMemo(
    () => ({
      commitCreate,
      addListItem,
      lockWorldKind,
      updateCategory,
      updateBubble,
      deleteCategory,
      deleteBubble,
      moveItems,
      splitIntoNewList,
      reorderItems,
      moveNode,
      markToday,
      unmarkToday,
      minusDay,
      resetTracking,
      toggleTrackingDate,
    }),
    [
      addListItem,
      commitCreate,
      deleteBubble,
      deleteCategory,
      lockWorldKind,
      markToday,
      minusDay,
      moveItems,
      moveNode,
      reorderItems,
      resetTracking,
      splitIntoNewList,
      toggleTrackingDate,
      unmarkToday,
      updateBubble,
      updateCategory,
    ],
  );
}
