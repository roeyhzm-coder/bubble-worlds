// Row builders for bw_bubbles / bw_categories. Kept free of runtime imports other than
// ../types.ts so the build-time verify script can load them directly under Node.
import { BUBBLE_EXTRA_KEYS, type Bubble, type Category } from "../types.ts";

/**
 * The exact bw_bubbles columns (scripts/init-db.sql). Rows are built from this whitelist, so a
 * stray field on a local bubble (e.g. the retired `is_black_star`) can never reach PostgREST.
 * The schema is frozen: new item fields go in BUBBLE_EXTRA_KEYS (the bubble_extras setting).
 */
const BUBBLE_COLUMNS = [
  "id",
  "parent_bubble_id",
  "category_id",
  "title",
  "notes",
  "color",
  "status",
  "position_x",
  "position_y",
  "size_multiplier",
  "created_at",
  "is_tracking",
  "target_days",
  "weekly_frequency",
  "tracking_history",
  "streak_mode",
  "container_type",
  "triangle_id",
  "due_at",
  "due_label",
  "action_done",
  "action_steps",
] as const satisfies readonly (keyof Bubble)[];

/** The exact bw_categories columns (scripts/init-db.sql). */
const CATEGORY_COLUMNS = [
  "id",
  "name",
  "color",
  "position_x",
  "position_y",
  "order_index",
  "created_at",
  "container_type",
] as const satisfies readonly (keyof Category)[];

export type BubbleRow = Pick<Bubble, (typeof BUBBLE_COLUMNS)[number]>;
export type CategoryRow = Pick<Category, (typeof CATEGORY_COLUMNS)[number]>;

/**
 * Compile-time guard: every Bubble field must be a column, an extras key, or the local clock.
 * Adding a field to Bubble without registering it in BUBBLE_EXTRA_KEYS fails the build.
 */
type UnroutedBubbleField = Exclude<
  keyof Bubble,
  (typeof BUBBLE_COLUMNS)[number] | (typeof BUBBLE_EXTRA_KEYS)[number] | "extras_updated_at"
>;
const bubbleFieldsRouted: [UnroutedBubbleField] extends [never] ? true : UnroutedBubbleField = true;
void bubbleFieldsRouted;

/** Same guard for categories, which have no extras channel at all. */
type UnroutedCategoryField = Exclude<keyof Category, (typeof CATEGORY_COLUMNS)[number]>;
const categoryFieldsRouted: [UnroutedCategoryField] extends [never] ? true : UnroutedCategoryField = true;
void categoryFieldsRouted;

function pickColumns<T extends object, K extends keyof T>(source: T, columns: readonly K[]): Pick<T, K> {
  const row = {} as Pick<T, K>;
  for (const column of columns) {
    if (source[column] !== undefined) row[column] = source[column];
  }
  return row;
}

/** Row payload for bw_bubbles: only registered columns; extras live in the bubble_extras setting. */
export function toBubbleRow(bubble: Bubble): BubbleRow {
  return pickColumns(bubble, BUBBLE_COLUMNS);
}

/** Row payload for bw_categories: only registered columns. */
export function toCategoryRow(category: Category): CategoryRow {
  return pickColumns(category, CATEGORY_COLUMNS);
}

