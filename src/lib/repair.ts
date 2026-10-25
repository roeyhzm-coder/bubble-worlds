import type { AppSnapshot, Bubble, DrillNode } from "../types";

/** Per-device flag: the stray-habit rescue ran against cloud-merged data and is finished. */
export const STRAY_REPAIR_KEY = "bubble-worlds-repair-stray-habits-v1";

/**
 * Habits that ended up as floating canvas bubbles, and the list bubbles (by title, in
 * preference order) they belong in. Only these named items are rescued; other canvas bubbles
 * that carry a triangle are legitimate and stay where they are.
 */
const STRAY_RULES: { title: string; homes: string[] }[] = [
  { title: "שינה קבועה", homes: ["שגרה טובה"] },
  { title: "הליכה", homes: ["כושר שגרה", "שגרה טובה"] },
];

function norm(value: string | undefined): string {
  return (value ?? "").trim();
}

export function repairDone(): boolean {
  try {
    return localStorage.getItem(STRAY_REPAIR_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRepairDone(): void {
  try {
    localStorage.setItem(STRAY_REPAIR_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

/**
 * Moves the named stray habits back inside their list bubble (same world first, then any
 * world). A stray is a top-level item of a canvas world with no children of its own. An empty,
 * not-yet-typed home bubble becomes a list. Idempotent: returns the same snapshot when
 * nothing needs fixing, so it never touches data twice.
 */
export function repairStrayListItems(snapshot: AppSnapshot): { snapshot: AppSnapshot; moved: Bubble[] } {
  const bubbles = snapshot.bubbles;
  const hasKids = (id: string) => bubbles.some((b) => b.parent_bubble_id === id);
  const catKind = new Map(snapshot.categories.map((c) => [c.id, c.container_type]));
  const patched = new Map<string, Bubble>();

  for (const rule of STRAY_RULES) {
    const strays = bubbles.filter(
      (b) =>
        norm(b.title) === rule.title &&
        b.parent_bubble_id === null &&
        !b.archived &&
        catKind.get(b.category_id) !== "list" &&
        !hasKids(b.id),
    );
    for (const stray of strays) {
      const candidates = (inCategory: boolean) =>
        rule.homes
          .map((home) =>
            bubbles.find(
              (b) =>
                b.id !== stray.id &&
                !b.archived &&
                norm(b.title) === home &&
                (inCategory ? b.category_id === stray.category_id : true) &&
                (b.container_type === "list" || (b.container_type === null && !hasKids(b.id))),
            ),
          )
          .find(Boolean);
      const home = candidates(true) ?? candidates(false);
      if (!home) continue;
      const holder = patched.get(home.id) ?? home;
      if (holder.container_type !== "list") patched.set(home.id, { ...holder, container_type: "list" });
      patched.set(stray.id, {
        ...stray,
        parent_bubble_id: home.id,
        category_id: home.category_id,
      });
    }
  }

  if (!patched.size) return { snapshot, moved: [] };
  return {
    snapshot: { ...snapshot, bubbles: bubbles.map((b) => patched.get(b.id) ?? b) },
    moved: [...patched.values()],
  };
}

/**
 * Moved items stay list rows, so the destination must render as a list: a list bubble, an
 * empty untyped bubble without a triangle (it becomes a list), or a world whose top level is a list. Canvas
 * containers are refused, since their direct children render as floating bubbles.
 */
export function acceptsListItems(target: DrillNode, base: AppSnapshot): boolean {
  if (target.kind === "category") {
    return base.categories.find((c) => c.id === target.id)?.container_type === "list";
  }
  if (target.kind === "bubble") {
    const holder = base.bubbles.find((b) => b.id === target.id);
    if (!holder) return false;
    // An untyped bubble qualifies only while empty and not a habit itself (no triangle).
    return (
      holder.container_type === "list" ||
      (holder.container_type === null &&
        !holder.triangle_id &&
        !base.bubbles.some((b) => b.parent_bubble_id === holder.id))
    );
  }
  return false;
}
