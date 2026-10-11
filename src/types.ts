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

export type ToolTemplate = "tracking" | "action" | "thought";

export interface TriangleType {
  id: string;
  name: string;
  color: string;
  template: ToolTemplate;
  order_index: number;
}

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
}

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
