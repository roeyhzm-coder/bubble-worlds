import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BW_TABLES,
  BUBBLE_EXTRA_KEYS,
  type AppSnapshot,
  type Bubble,
  type BubbleExtrasEntry,
  type Category,
  type ColorRoles,
  type PageLabels,
  type RoutineTime,
  type WorldKind,
} from "../types";
import { applyDailyRollover, asDailyTasks } from "./daily";
import { DEFAULT_COLOR_ROLES, DEFAULT_PAGE_LABELS, migrateHubLabel, todayKey } from "./defaults";
import { asSuccesses } from "./successes";
import { asDayMap, asSessionLog } from "./tracking";
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

const configured = Boolean(url && key);
let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * The Supabase SDK (~55 KB gzip) is loaded on first use instead of at startup, so the
 * first paint never waits for it. Resolves to null when the cloud isn't configured.
 */
export function getClient(): Promise<SupabaseClient | null> {
  if (!configured) return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(url, key));
  return clientPromise;
}

export const isCloudEnabled = configured;

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
    hub: migrateHubLabel(rec.hub?.trim() || DEFAULT_PAGE_LABELS.hub),
    daily: rec.daily?.trim() || DEFAULT_PAGE_LABELS.daily,
    successes: rec.successes?.trim() || DEFAULT_PAGE_LABELS.successes,
    studio: rec.studio?.trim() || DEFAULT_PAGE_LABELS.studio,
  };
}

/** Tombstoned ids (deleted tasks, bubbles, wins) shared by every device. */
export function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))];
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

/** Local-only bubble fields that never exist as bw_bubbles columns. */
const NON_COLUMN_KEYS = [...BUBBLE_EXTRA_KEYS, "extras_updated_at"] as const;

/** Row payload for bw_bubbles: extras live in the bubble_extras setting, not in table columns. */
export function toBubbleRow(bubble: Bubble): Omit<Bubble, (typeof NON_COLUMN_KEYS)[number]> {
  const row: Record<string, unknown> = { ...bubble };
  for (const key of NON_COLUMN_KEYS) delete row[key];
  return row as Omit<Bubble, (typeof NON_COLUMN_KEYS)[number]>;
}

/**
 * Collects every non-default extra field, keyed by bubble id. Items that were ever edited
 * keep an entry (even when back at defaults) so a reset carries its timestamp and wins merges.
 */
export function collectBubbleExtras(bubbles: Bubble[]): Record<string, BubbleExtrasEntry> {
  const out: Record<string, BubbleExtrasEntry> = {};
  for (const bubble of bubbles) {
    const extras: BubbleExtrasEntry = {};
    if (bubble.challenge_done) extras.challenge_done = true;
    if (bubble.done_offset) extras.done_offset = bubble.done_offset;
    if (bubble.streak_offset) extras.streak_offset = bubble.streak_offset;
    if (bubble.archived) extras.archived = true;
    if (bubble.session_count) extras.session_count = bubble.session_count;
    if (bubble.session_target) extras.session_target = bubble.session_target;
    if (bubble.session_taken) extras.session_taken = bubble.session_taken;
    if (bubble.session_missed) extras.session_missed = bubble.session_missed;
    if (bubble.session_log?.length) extras.session_log = bubble.session_log;
    if (bubble.routine_time && bubble.routine_time !== "general") extras.routine_time = bubble.routine_time;
    if (bubble.daily_target) extras.daily_target = bubble.daily_target;
    if (bubble.daily_counts && Object.keys(bubble.daily_counts).length) extras.daily_counts = bubble.daily_counts;
    if (bubble.daily_targets_by_date && Object.keys(bubble.daily_targets_by_date).length) {
      extras.daily_targets_by_date = bubble.daily_targets_by_date;
    }
    if (typeof bubble.order_index === "number") extras.order_index = bubble.order_index;
    if (bubble.extras_updated_at) extras.updated_at = bubble.extras_updated_at;
    if (Object.keys(extras).length) out[bubble.id] = extras;
  }
  return out;
}

const EXTRA_DEFAULTS: BubbleExtrasEntry = {
  challenge_done: false,
  done_offset: 0,
  streak_offset: 0,
  archived: false,
  session_count: 0,
  session_target: 0,
  session_taken: 0,
  session_missed: 0,
  session_log: [],
  routine_time: "general",
  daily_target: 0,
  daily_counts: {},
  daily_targets_by_date: {},
  order_index: undefined,
};

function asRoutineTime(value: unknown): RoutineTime {
  return value === "morning" || value === "noon" || value === "evening" ? value : "general";
}

function asExtras(value: unknown): Record<string, BubbleExtrasEntry> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, BubbleExtrasEntry> = {};
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
      routine_time: asRoutineTime(rec.routine_time),
      daily_target:
        typeof rec.daily_target === "number" && Number.isFinite(rec.daily_target) && rec.daily_target > 0
          ? Math.min(50, Math.round(rec.daily_target))
          : 0,
      daily_counts: asDayMap(rec.daily_counts),
      daily_targets_by_date: asDayMap(rec.daily_targets_by_date),
      order_index: typeof rec.order_index === "number" ? rec.order_index : undefined,
      updated_at: typeof rec.updated_at === "number" ? rec.updated_at : undefined,
    };
  }
  return out;
}

/**
 * Per-item merge of two bubble_extras maps: the newer `updated_at` wins each id (ties go to
 * `local`), ids only one side knows are kept, and tombstoned ids are dropped.
 */
export function mergeExtrasMaps(
  remote: Record<string, BubbleExtrasEntry>,
  local: Record<string, BubbleExtrasEntry>,
  deleted: Set<string>,
): Record<string, BubbleExtrasEntry> {
  const out: Record<string, BubbleExtrasEntry> = {};
  for (const [id, entry] of Object.entries(remote)) {
    if (!deleted.has(id)) out[id] = entry;
  }
  for (const [id, entry] of Object.entries(local)) {
    const other = out[id];
    if (!other || (entry.updated_at ?? 0) >= (other.updated_at ?? 0)) out[id] = entry;
  }
  return out;
}

function normalizeBubble(row: RemoteBubble, entry?: BubbleExtrasEntry): Bubble {
  const { updated_at, ...extras } = entry ?? {};
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
    ...(entry ? extras : {}),
    ...(updated_at ? { extras_updated_at: updated_at } : {}),
  };
}

export async function fetchRemoteSnapshot(): Promise<AppSnapshot | null> {
  const supabase = await getClient();
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
  const deletedIds = asIdList(map.deleted_ids);
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
    dailyTasks: applyDailyRollover(asDailyTasks(map.daily_tasks), todayKey(), {
      deleted: new Set(deletedIds),
    }),
    successes: asSuccesses(map.successes),
    deletedIds,
  };
}

export async function upsertCategory(category: Category): Promise<void> {
  const supabase = await getClient();
  if (!supabase) return;
  const { error } = await supabase.from(BW_TABLES.categories).upsert(category);
  if (error) console.warn("upsert category", error.message);
}

export async function upsertBubble(bubble: Bubble): Promise<void> {
  const supabase = await getClient();
  if (!supabase) return;
  const { error } = await supabase.from(BW_TABLES.bubbles).upsert(toBubbleRow(bubble));
  if (error) console.warn("upsert bubble", error.message);
}

export async function deleteCategoryRemote(id: string): Promise<void> {
  const supabase = await getClient();
  if (!supabase) return;
  await supabase.from(BW_TABLES.categories).delete().eq("id", id);
}

export async function deleteBubbleRemote(ids: string | string[]): Promise<void> {
  const supabase = await getClient();
  if (!supabase) return;
  const list = Array.isArray(ids) ? ids : [ids];
  if (list.length === 0) return;
  const { error } = await supabase.from(BW_TABLES.bubbles).delete().in("id", list);
  if (error) console.warn("delete bubble", error.message);
}

export async function upsertSetting(key: string, value: unknown): Promise<void> {
  const supabase = await getClient();
  if (!supabase) return;
  await supabase.from(BW_TABLES.settings).upsert({ key, value });
}

let extrasChain: Promise<unknown> = Promise.resolve();

/**
 * Fetch-before-write for bubble_extras: reads the cloud map, merges it per item with this
 * device's entries (newer `updated_at` wins), then writes the result. Calls are serialized so
 * two writes from this device never race each other. Returns an error message, or null.
 * If the read fails nothing is written, so a blind overwrite can never happen.
 */
export function syncBubbleExtras(bubbles: Bubble[], deletedIds: string[] = []): Promise<string | null> {
  const run = extrasChain.then(async (): Promise<string | null> => {
    const supabase = await getClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(BW_TABLES.settings)
      .select("value")
      .eq("key", "bubble_extras")
      .maybeSingle();
    if (error) {
      console.warn("bubble_extras read failed; skipping write", error.message);
      return error.message;
    }
    const remote = asExtras((data as { value?: unknown } | null)?.value);
    const merged = mergeExtrasMaps(remote, collectBubbleExtras(bubbles), new Set(deletedIds));
    const { error: writeError } = await supabase
      .from(BW_TABLES.settings)
      .upsert({ key: "bubble_extras", value: merged });
    if (writeError) console.warn("bubble_extras write failed", writeError.message);
    return writeError?.message ?? null;
  });
  extrasChain = run.catch(() => null);
  return run;
}

let tombstoneChain: Promise<unknown> = Promise.resolve();

/**
 * Read-merge-write of the shared tombstone list: this device's ids are added to the cloud's,
 * so one device can never wipe another's deletes; `restored` (undo) is the only way out.
 * Nothing is written when the read fails.
 */
export function syncDeletedIds(ids: string[], restored: string[] = []): Promise<string | null> {
  const run = tombstoneChain.then(async (): Promise<string | null> => {
    const supabase = await getClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(BW_TABLES.settings)
      .select("value")
      .eq("key", "deleted_ids")
      .maybeSingle();
    if (error) {
      console.warn("deleted_ids read failed; skipping write", error.message);
      return error.message;
    }
    const back = new Set(restored);
    const remote = asIdList((data as { value?: unknown } | null)?.value);
    const merged = [...new Set([...remote, ...ids])].filter((id) => !back.has(id));
    if (merged.length === remote.length && merged.every((id, index) => id === remote[index])) return null;
    const { error: writeError } = await supabase
      .from(BW_TABLES.settings)
      .upsert({ key: "deleted_ids", value: merged });
    if (writeError) console.warn("deleted_ids write failed", writeError.message);
    return writeError?.message ?? null;
  });
  tombstoneChain = run.catch(() => null);
  return run;
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
  const supabase = await getClient();
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
  const extrasError = await syncBubbleExtras(snapshot.bubbles, snapshot.deletedIds);
  if (extrasError) result.errors.push(`נתוני פריטים: ${extrasError}`);
  const tombstoneError = await syncDeletedIds(snapshot.deletedIds);
  if (tombstoneError) result.errors.push(`מחיקות: ${tombstoneError}`);
  result.ok = result.errors.length === 0;
  return result;
}

export type RemoteChangeHandler = (snapshot: AppSnapshot) => void;

export function subscribeRealtime(onChange: RemoteChangeHandler): () => void {
  if (!configured) return () => undefined;
  let cancelled = false;
  let cleanup: (() => void) | null = null;
  const refresh = () => {
    void fetchRemoteSnapshot().then((snap) => {
      if (snap) onChange(snap);
    });
  };
  void getClient().then((client) => {
    if (!client || cancelled) return;
    const channel = client
      .channel("bubble-worlds-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: BW_TABLES.categories }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: BW_TABLES.bubbles }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: BW_TABLES.settings }, refresh)
      .subscribe();
    cleanup = () => {
      void client.removeChannel(channel);
    };
  });
  return () => {
    cancelled = true;
    cleanup?.();
  };
}
