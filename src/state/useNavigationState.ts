import { useCallback, useMemo, useState } from "react";
import { sortByOrder } from "../lib/order";
import type { Breadcrumb, Bubble, Category, DrillNode, WorldKind } from "../types";
import type { Store } from "./store";

export type Composer =
  | { mode: "create"; type: "category" | "bubble" }
  | { mode: "edit"; type: "category" | "bubble"; id: string }
  | null;

export interface NavigationState {
  page: number;
  setPage: (page: number) => void;
  drill: DrillNode;
  setDrill: (node: DrillNode) => void;
  breadcrumbs: Breadcrumb[];
  currentTitle: string;
  drillKey: string;
  currentWorldKind: WorldKind | null;
  visibleCategories: Category[];
  visibleBubbles: Bubble[];
  childrenOf: (bubbleId: string) => Bubble[];
  composer: Composer;
  setComposer: (composer: Composer) => void;
  openCreate: (type: "category" | "bubble") => void;
  openEditor: (target: { type: "category" | "bubble"; id: string }) => void;
  closeComposer: () => void;
  focusListAdd: number;
  requestCreate: () => void;
  /** Where new items go for the current drill level. */
  resolveParent: () => { categoryId: string | undefined; parent: string | null };
  /** While true, horizontal swipes between pages are ignored (e.g. during multi-select). */
  navLock: boolean;
  setNavLock: (locked: boolean) => void;
}

export function useNavigationState(store: Store): NavigationState {
  const { snapshot, snapshotRef } = store;
  const [page, setPage] = useState(0);
  const [drill, setDrill] = useState<DrillNode>({ kind: "root" });
  const [composer, setComposer] = useState<Composer>(null);
  const [focusListAdd, setFocusListAdd] = useState(0);
  const [navLock, setNavLock] = useState(false);

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
  }, [drill, snapshotRef]);

  const childrenOf = useCallback(
    (bubbleId: string) => snapshot.bubbles.filter((b) => b.parent_bubble_id === bubbleId),
    [snapshot.bubbles],
  );

  const breadcrumbs = useMemo<Breadcrumb[]>(() => {
    const trail: Breadcrumb[] = [{ id: "root", label: "מפת עולמות", node: { kind: "root" } }];
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
    const seen = new Set<string>();
    let cursor: Bubble | undefined = bubble;
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      stack.unshift(cursor);
      const parentId: string | null = cursor.parent_bubble_id;
      cursor = parentId ? snapshot.bubbles.find((b) => b.id === parentId) : undefined;
    }
    for (const node of stack) {
      trail.push({ id: node.id, label: node.title, node: { kind: "bubble", id: node.id } });
    }
    return trail;
  }, [drill, snapshot.bubbles, snapshot.categories]);

  const currentTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? "עולמות";
  const drillKey =
    drill.kind === "root" ? "root" : drill.kind === "category" ? `category:${drill.id}` : `bubble:${drill.id}`;

  const currentWorldKind = useMemo<WorldKind | null>(() => {
    if (drill.kind === "root") return "bubbles";
    if (drill.kind === "category") {
      return snapshot.categories.find((c) => c.id === drill.id)?.container_type ?? null;
    }
    return snapshot.bubbles.find((b) => b.id === drill.id)?.container_type ?? null;
  }, [drill, snapshot.bubbles, snapshot.categories]);

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

  const visibleCategories = useMemo(
    () => (drill.kind === "root" ? snapshot.categories : []),
    [drill.kind, snapshot.categories],
  );
  const visibleBubbles = useMemo(() => {
    if (drill.kind === "root") return [];
    const rows =
      drill.kind === "category"
        ? snapshot.bubbles.filter(
            (b) => b.category_id === drill.id && b.parent_bubble_id === null && !b.archived,
          )
        : snapshot.bubbles.filter((b) => b.parent_bubble_id === drill.id && !b.archived);
    return sortByOrder(rows);
  }, [drill, snapshot.bubbles]);

  const openCreate = useCallback((type: "category" | "bubble") => setComposer({ mode: "create", type }), []);
  const openEditor = useCallback(
    (target: { type: "category" | "bubble"; id: string }) => setComposer({ mode: "edit", ...target }),
    [],
  );
  const closeComposer = useCallback(() => setComposer(null), []);

  return useMemo(
    () => ({
      page,
      setPage,
      drill,
      setDrill,
      breadcrumbs,
      currentTitle,
      drillKey,
      currentWorldKind,
      visibleCategories,
      visibleBubbles,
      childrenOf,
      composer,
      setComposer,
      openCreate,
      openEditor,
      closeComposer,
      focusListAdd,
      requestCreate,
      resolveParent,
      navLock,
      setNavLock,
    }),
    [
      breadcrumbs,
      childrenOf,
      closeComposer,
      composer,
      currentTitle,
      currentWorldKind,
      drill,
      drillKey,
      focusListAdd,
      navLock,
      openCreate,
      openEditor,
      page,
      requestCreate,
      resolveParent,
      visibleBubbles,
      visibleCategories,
    ],
  );
}
