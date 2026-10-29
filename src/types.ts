export const BW_TABLES = {
  categories: "bw_categories",
  bubbles: "bw_bubbles",
  settings: "bw_app_settings",
} as const;

export type BwTableName = (typeof BW_TABLES)[keyof typeof BW_TABLES];

export type BubbleStatus =
  | "active_tracking"
  | "focus"
  | "deep_thought"
  | "default";

export type StreakMode = "strict" | "flexible" | "cumulative";

export type WorldKind = "bubbles" | "list";

export type ToolTemplate = "tracking" | "action" | "thought" | "counter" | "multi_daily";

export interface TriangleType {
  id: string;
  name: string;
  color: string;
  template: ToolTemplate;
  order_index: number;
  /** Set once the legacy "tracking" → "counter" auto-upgrade ran, so a later manual choice sticks. */
  counter_migrated?: boolean;
  /** Set once the legacy sky-blue habit tracker was recolored royal blue (or a color was picked by hand). */
  recolor_migrated?: boolean;
}

export type SessionOutcome = "done" | "missed";

export type RoutineTime = "morning" | "noon" | "evening" | "general";

export interface ActionStep {
  id: string;
  title: string;
  done: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  position_x: number;
  position_y: number;
  order_index: number;
  created_at: string;
  container_type: WorldKind | null;
}

export interface Bubble {
  id: string;
  parent_bubble_id: string | null;
  category_id: string;
  title: string;
  notes: string;
  color: string;
  status: BubbleStatus;
  position_x: number;
  position_y: number;
  size_multiplier: number;
  created_at: string;
  is_tracking: boolean;
  target_days: number;
  weekly_frequency: number;
  tracking_history: string[];
  streak_mode: StreakMode;
  container_type: WorldKind | null;
  triangle_id: string | null;
  due_at: string | null;
  due_label: string;
  action_done: boolean;
  action_steps: ActionStep[];
  /** Manual "challenge finished" toggle (tracking + thought templates). */
  challenge_done?: boolean;
  /** Manual correction added to the counted check-in days. */
  done_offset?: number;
  /** Manual correction added to the computed streak. */
  streak_offset?: number;
  /** Saved to the successes vault and hidden from active lists (data kept). */
  archived?: boolean;
  /** Counter template: times the opportunity was taken. */
  session_count?: number;
  /** Counter template: goal for session_count. */
  session_target?: number;
  /** Counter template: total outings logged as taken (+1). */
  session_taken?: number;
  /** Counter template: total outings logged as missed (-1). */
  session_missed?: number;
  /** Counter template: most recent outings, oldest first (capped). */
  session_log?: SessionOutcome[];
  /** Tracking template: time-of-day routine slot (absent = "general"). */
  routine_time?: RoutineTime;
  /** Multi-daily template: default times per day for days without an override (absent/0 = 2). */
  daily_target?: number;
  /** Multi-daily template: YYYY-MM-DD → times done that day. */
  daily_counts?: Record<string, number>;
  /** Multi-daily template: YYYY-MM-DD → that day's own target, overriding daily_target. */
  daily_targets_by_date?: Record<string, number>;
  /** Manual position among siblings (absent = after ordered items, in creation order). */
  order_index?: number;
  /** Pinned to the hub's "Obsidian" black-star zone (any number of items may be starred). */
  is_black_star?: boolean;
  /**
   * Local-only clock (ms) of the last change to any extras field. Synced inside the
   * bubble_extras entry so two devices merge per item instead of overwriting the blob.
   */
  extras_updated_at?: number;
}

/** Fields synced through the `bubble_extras` setting rather than bw_bubbles columns. */
export const BUBBLE_EXTRA_KEYS = [
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
  "daily_target",
  "daily_counts",
  "daily_targets_by_date",
  "order_index",
  "is_black_star",
] as const;

/** Item fields synced via the `bubble_extras` setting instead of bw_bubbles columns. */
export type BubbleExtras = Pick<Bubble, (typeof BUBBLE_EXTRA_KEYS)[number]>;

/** One bubble_extras entry on the wire: the fields plus when they last changed. */
export type BubbleExtrasEntry = BubbleExtras & { updated_at?: number };

export type ColorRoles = Record<BubbleStatus, string>;

export interface PageLabels {
  map: string;
  hub: string;
  daily: string;
  successes: string;
  studio: string;
}

export type SuccessSource = "bubble" | "daily" | "manual";

export interface Success {
  id: string;
  title: string;
  notes: string;
  source_type: SuccessSource;
  created_at: string;
  category_name: string;
}

export interface DailyTask {
  id: string;
  text: string;
  completed: boolean;
  date: string;
  rollover_count: number;
  order_index: number;
  /** ms of the last create / edit / toggle / move; the newer copy wins a cloud merge. */
  updated_at?: number;
}

export interface AppSnapshot {
  categories: Category[];
  bubbles: Bubble[];
  colorRoles: ColorRoles;
  pageLabels: PageLabels;
  listViews: Record<string, boolean>;
  triangleTypes: TriangleType[];
  dailyTasks: DailyTask[];
  successes: Success[];
  deletedIds: string[];
}

export type DrillNode =
  | { kind: "root" }
  | { kind: "category"; id: string }
  | { kind: "bubble"; id: string };

export interface Breadcrumb {
  id: string;
  label: string;
  node: DrillNode;
}
