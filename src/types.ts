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

export interface Category {
  id: string;
  name: string;
  color: string;
  position_x: number;
  position_y: number;
  order_index: number;
  created_at: string;
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
}

export type ColorRoles = Record<BubbleStatus, string>;

export interface AppSnapshot {
  categories: Category[];
  bubbles: Bubble[];
  colorRoles: ColorRoles;
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
