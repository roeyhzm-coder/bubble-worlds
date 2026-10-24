import type { Bubble } from "../types";

const UNORDERED = Number.MAX_SAFE_INTEGER;

/**
 * Manual order first; items never reordered keep their stored (creation) order after them.
 * Array#sort is stable, so equal keys preserve the incoming sequence.
 */
export function sortByOrder<T extends Pick<Bubble, "order_index">>(items: T[]): T[] {
  return items
    .slice()
    .sort((a, b) => (a.order_index ?? UNORDERED) - (b.order_index ?? UNORDERED));
}

/** Swaps `id` one step in `orderedIds` and returns the new full sequence (or null at an edge). */
export function stepOrder(orderedIds: string[], id: string, direction: -1 | 1): string[] | null {
  const index = orderedIds.indexOf(id);
  const swap = index + direction;
  if (index < 0 || swap < 0 || swap >= orderedIds.length) return null;
  const next = orderedIds.slice();
  [next[index], next[swap]] = [next[swap], next[index]];
  return next;
}
