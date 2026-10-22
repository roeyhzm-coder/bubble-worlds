import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BW_TABLES,
  type AppSnapshot,
  type Bubble,
  type BubbleExtras,
  type Category,
  type ColorRoles,
  type PageLabels,
  type WorldKind,
} from "../types";
import { applyDailyRollover, asDailyTasks } from "./daily";
import { DEFAULT_COLOR_ROLES, DEFAULT_PAGE_LABELS } from "./defaults";
import { asSuccesses } from "./successes";
import { asSessionLog } from "./tracking";
import { asActionSteps, asTriangleTypes } from "./triangles";

function stripQuotes(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** Accepts a JWT anon key (dropping pasted suffixes like "-Legacy") or an sb_publishable_ key. */
export function sanitizeAnonKey(raw: string | undefined): string {
  const value = stripQuotes(raw);
  const jwt = value.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}/);
  if (jwt) return jwt[0];
  const publishable = value.match(/^sb_publishable_[A-Za-z0-9_-]+/);
  return publishable ? publishable[0] : value.split(/\s/)[0] ?? "";
}

function refFromJwt(key: string): string | null {
  const payload = key.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/")) as string;
    const ref = (JSON.parse(json) as { ref?: unknown }).ref;
    return typeof ref === "string" && /^[a-z0-9]{20}$/.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

/**
 * Normalizes to https://<ref>.supabase.co, stripping trailing slashes and /rest/v1 paths.
 * When the anon key names a different project ref than a *.supabase.co URL (a typo in the
 * env var), the key's ref wins because the key only authenticates against its own project.
 */
export function sanitizeUrl(raw: string | undefined, key: string): string {
  const value = stripQuotes(raw);
  const keyRef = refFromJwt(key);
  if (/^[a-z0-9]{20}$/.test(value)) return `https://${keyRef ?? value}.supabase.co`;
  try {
    const parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (keyRef && parsed.host.endsWith(".supabase.co")) return `https://${keyRef}.supabase.co`;
    return `https://${parsed.host}`;
  } catch {
    return keyRef ? `https://${keyRef}.supabase.co` : "";
  }
}

const key = sanitizeAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY);
const url = sanitizeUrl(import.meta.env.VITE_SUPABASE_URL, key);

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

export const isCloudEnabled = Boolean(supabase);

type RemoteBubble = Omit<Bubble, "tracking_history"> & {
  tracking_history: unknown;
};

function asHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asRoles(value: unknown): ColorRoles {
  if (!value || typeof value !== "object") return { ...DEFAULT_COLOR_ROLES };
  return { ...DEFAULT_COLOR_ROLES, ...(value as Partial<ColorRoles>) };
}

function asPageLabels(value: unknown): PageLabels {
  if (!value || typeof value !== "object") return { ...DEFAULT_PAGE_LABELS };
  const rec = value as Partial<PageLabels>;
  return {
    map: rec.map?.trim() || DEFAULT_PAGE_LABELS.map,
    hub: rec.hub?.trim() || DEFAULT_PAGE_LABELS.hub,
    daily: rec.daily?.trim() || DEFAULT_PAGE_LABELS.daily,
    successes: rec.successes?.trim() || DEFAULT_PAGE_LABELS.successes,
    studio: rec.studio?.trim() || DEFAULT_PAGE_LABELS.studio,
  };
}

function asListViews(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, boolean>;
}

function asWorldKind(value: unknown): WorldKind | null {
  return value === "bubbles" || value === "list" ? value : null;
}

function normalizeCategory(row: Category): Category {
  return { ...row, container_type: asWorldKind(row.container_type) };
}

const EXTRA_KEYS = [
  "challenge_done",
  "done_offset",
  "streak_offset",
  "archived",
  "session_count",
  "session_target",
  "session_taken",
  "session_missed",
  "session_log",
] as const;

/** Row payload for bw_bubbles: extras live in the bubble_extras setting, not in table columns. */
export function toBubbleRow(bubble: Bubble): Omit<Bubble, keyof BubbleExtras> {
  const row: Record<string, unknown> = { ...bubble };
  for (const key of EXTRA_KEYS) delete row[key];
  return row as Omit<Bubble, keyof BubbleExtras>;
}

/** Collects every non-default extra field, keyed by bubble id. */
export function collectBubbleExtras(bubbles: Bubble[]): Record<string, BubbleExtras> {
  const out: Record<string, BubbleExtras> = {};
  for (const bubble of bubbles) {
    const extras: BubbleExtras = {};
    if (bubble.challenge_done) extras.challenge_done = true;
    if (bubble.done_offset) extras.done_offset = bubble.done_offset;
    if (bubble.streak_offset) extras.streak_offset = bubble.streak_offset;
    if (bubble.archived) extras.archived = true;
    if (bubble.session_count) extras.session_count = bubble.session_count;
    if (bubble.session_target) extras.session_target = bubble.session_target;
    if (bubble.session_taken) extras.session_taken = bubble.session_taken;
    if (bubble.session_missed) extras.session_missed = bubble.session_missed;
    if (bubble.session_log?.length) extras.session_log = bubble.session_log;
    if (Object.keys(extras).length) out[bubble.id] = extras;
  }
  return out;
}

const EXTRA_DEFAULTS: Required<BubbleExtras> = {
  challenge_done: false,
  done_offset: 0,
  streak_offset: 0,
  archived: false,
  session_count: 0,
  session_target: 0,
  session_taken: 0,
  session_missed: 0,
  session_log: [],
};

function asExtras(value: unknown): Record<string, BubbleExtras> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, BubbleExtras> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    out[id] = {
      challenge_done: Boolean(rec.challenge_done),
      done_offset: typeof rec.done_offset === "number" ? rec.done_offset : 0,
      streak_offset: typeof rec.streak_offset === "number" ? rec.streak_offset : 0,
      archived: Boolean(rec.archived),
      session_count: typeof rec.session_count === "number" ? rec.session_count : 0,
      session_target: typeof rec.session_target === "number" ? rec.session_target : 0,
      session_taken: typeof rec.session_taken === "number" ? rec.session_taken : 0,
      session_missed: typeof rec.session_missed === "number" ? rec.session_missed : 0,
      session_log: asSessionLog(rec.session_log),
    };
  }
  return out;
}

function normalizeBubble(row: RemoteBubble, extras?: BubbleExtras): Bubble {
  return {
    ...row,
    title: row.title ?? "",
    notes: row.notes ?? "",
    tracking_history: asHistory(row.tracking_history),
    container_type: asWorldKind(row.container_type),
    triangle_id: typeof row.triangle_id === "string" && row.triangle_id ? row.triangle_id : null,
    due_at: typeof row.due_at === "string" && row.due_at ? row.due_at : null,
    due_label: typeof row.due_label === "string" ? row.due_label : "",
    action_done: Boolean(row.action_done),
    action_steps: asActionSteps(row.action_steps),
    ...extras,
  };
}

export async function fetchRemoteSnapshot(): Promise<AppSnapshot | null> {
  if (!supabase) return null;
  const [cats, bubs, settings] = await Promise.all([
    supabase.from(BW_TABLES.categories).select("*"),
    supabase.from(BW_TABLES.bubbles).select("*"),
    supabase.from(BW_TABLES.settings).select("*"),
  ]);
  if (cats.error || bubs.error) {
    console.warn("Supabase fetch failed, using local fallback", cats.error ?? bubs.error);
    return null;
  }
  const map = Object.fromEntries(
    (settings.data ?? []).map((row: { key: string; value: unknown }) => [row.key, row.value]),
  );
  // Without the setting row, extras stay undefined so merging keeps the local values.
  const extras = map.bubble_extras === undefined ? null : asExtras(map.bubble_extras);
  return {
    categories: ((cats.data ?? []) as Category[]).map(normalizeCategory),
    bubbles: ((bubs.data ?? []) as RemoteBubble[]).map((row) =>
      normalizeBubble(row, extras ? (extras[row.id] ?? EXTRA_DEFAULTS) : undefined),
    ),
    colorRoles: asRoles(map.color_roles),
    pageLabels: asPageLabels(map.page_labels),
    listViews: asListViews(map.list_views),
    triangleTypes: asTriangleTypes(map.triangle_types),
    dailyTasks: applyDailyRollover(asDailyTasks(map.daily_tasks)),
    successes: asSuccesses(map.successes),
    deletedIds: [],
  };
}

export async function upsertCategory(category: Category): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(BW_TABLES.categories).upsert(category);
  if (error) console.warn("upsert category", error.message);
}

export async function upsertBubble(bubble: Bubble): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(BW_TABLES.bubbles).upsert(toBubbleRow(bubble));
  if (error) console.warn("upsert bubble", error.message);
}

export async function deleteCategoryRemote(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from(BW_TABLES.categories).delete().eq("id", id);
}

export async function deleteBubbleRemote(ids: string | string[]): Promise<void> {
  if (!supabase) return;
  const list = Array.isArray(ids) ? ids : [ids];
  if (list.length === 0) return;
  const { error } = await supabase.from(BW_TABLES.bubbles).delete().in("id", list);
  if (error) console.warn("delete bubble", error.message);
}

export async function upsertSetting(key: string, value: unknown): Promise<void> {
  if (!supabase) return;
  await supabase.from(BW_TABLES.settings).upsert({ key, value });
}

export async function upsertColorRoles(colorRoles: ColorRoles): Promise<void> {
  return upsertSetting("color_roles", colorRoles);
}

export interface PushResult {
  ok: boolean;
  categories: number;
  bubbles: number;
  errors: string[];
}

/** Upserts the whole local snapshot to the cloud and reports every failure. */
export async function pushSnapshotToCloud(snapshot: AppSnapshot): Promise<PushResult> {
  const result: PushResult = {
    ok: false,
    categories: snapshot.categories.length,
    bubbles: snapshot.bubbles.length,
    errors: [],
  };
  if (!supabase) {
    result.errors.push("הענן לא מוגדר (חסרים URL או anon key)");
    return result;
  }
  const client = supabase;
  const settings = [
    { key: "color_roles", value: snapshot.colorRoles },
    { key: "page_labels", value: snapshot.pageLabels },
    { key: "list_views", value: snapshot.listViews },
    { key: "triangle_types", value: snapshot.triangleTypes },
    { key: "daily_tasks", value: snapshot.dailyTasks },
    { key: "successes", value: snapshot.successes },
    { key: "bubble_extras", value: collectBubbleExtras(snapshot.bubbles) },
  ];
  // Categories first so bubbles never reference a missing parent row.
  if (snapshot.categories.length) {
    const { error } = await client.from(BW_TABLES.categories).upsert(snapshot.categories);
    if (error) result.errors.push(`עולמות: ${error.message}`);
  }
  if (snapshot.bubbles.length) {
    const { error } = await client.from(BW_TABLES.bubbles).upsert(snapshot.bubbles.map(toBubbleRow));
    if (error) result.errors.push(`בועות: ${error.message}`);
  }
  const { error: settingsError } = await client.from(BW_TABLES.settings).upsert(settings);
  if (settingsError) result.errors.push(`הגדרות: ${settingsError.message}`);
  result.ok = result.errors.length === 0;
  return result;
}

export type RemoteChangeHandler = (snapshot: AppSnapshot) => void;

export function subscribeRealtime(onChange: RemoteChangeHandler): () => void {
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel("bubble-worlds-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: BW_TABLES.categories }, () => {
      void fetchRemoteSnapshot().then((snap) => {
        if (snap) onChange(snap);
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: BW_TABLES.bubbles }, () => {
      void fetchRemoteSnapshot().then((snap) => {
        if (snap) onChange(snap);
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: BW_TABLES.settings }, () => {
      void fetchRemoteSnapshot().then((snap) => {
        if (snap) onChange(snap);
      });
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
