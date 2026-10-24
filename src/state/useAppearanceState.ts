import { useCallback, useMemo } from "react";
import { PALETTE, newId } from "../lib/defaults";
import { upsertBubble, upsertColorRoles, upsertSetting } from "../lib/supabase";
import { DEFAULT_TRIANGLE_TYPES, clearTrianglePatch, trianglePatch } from "../lib/triangles";
import type { Bubble, BubbleStatus, ColorRoles, PageLabels, TriangleType } from "../types";
import type { Store } from "./store";

export interface AppearanceState {
  setPageLabels: (labels: Partial<PageLabels>) => void;
  applyStatusColor: (status: BubbleStatus, color: string) => void;
  setTriangleType: (id: string, triangleId: string | null) => void;
  addTriangleType: () => string;
  updateTriangleType: (id: string, patch: Partial<TriangleType>) => void;
  deleteTriangleType: (id: string) => void;
  moveTriangleType: (id: string, direction: -1 | 1) => void;
}

/** Tab labels, status colors and triangle types (plus assigning a type to an item). */
export function useAppearanceState(
  store: Store,
  updateBubble: (id: string, patch: Partial<Bubble>) => void,
): AppearanceState {
  const { snapshotRef, mutate } = store;

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

  const applyStatusColor = useCallback(
    (status: BubbleStatus, color: string) => {
      mutate((prev) => {
        const colorRoles: ColorRoles = { ...prev.colorRoles, [status]: color };
        const bubbles = prev.bubbles.map((b) => (b.status === status ? { ...b, color } : b));
        void upsertColorRoles(colorRoles);
        for (const b of bubbles.filter((item) => item.status === status)) void upsertBubble(b);
        return { ...prev, colorRoles, bubbles };
      });
    },
    [mutate],
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
    [snapshotRef, updateBubble],
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
          item.id === id ? { ...item, ...patch, ...(patch.template ? { counter_migrated: true } : {}) } : item,
        );
        const nextType = triangleTypes.find((item) => item.id === id);
        const bubbles = nextType
          ? prev.bubbles.map((bubble) =>
              bubble.triangle_id === id ? { ...bubble, ...trianglePatch(nextType), notes: bubble.notes } : bubble,
            )
          : prev.bubbles;
        persistTriangles(triangleTypes);
        if (nextType) {
          for (const bubble of bubbles.filter((item) => item.triangle_id === id)) void upsertBubble(bubble);
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
        for (const bubble of bubbles.filter((item) => item.triangle_id === fallback.id)) void upsertBubble(bubble);
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

  return useMemo(
    () => ({
      setPageLabels,
      applyStatusColor,
      setTriangleType,
      addTriangleType,
      updateTriangleType,
      deleteTriangleType,
      moveTriangleType,
    }),
    [
      addTriangleType,
      applyStatusColor,
      deleteTriangleType,
      moveTriangleType,
      setPageLabels,
      setTriangleType,
      updateTriangleType,
    ],
  );
}
