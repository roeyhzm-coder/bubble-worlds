// User-editable habit topic catalog ("תחומים"), stored as the `habit_topics` app setting.
// Pure and import-free (types only) so the build-time verify script can load it under Node.
import type { HabitTopicsSetting } from "../types.ts";

/** Shown until the user edits the list for the first time; never stored with a clock. */
export const DEFAULT_HABIT_TOPICS: readonly string[] = [
  "בריאות",
  "כושר",
  "מוח וקוגניציה",
  "למידה ושפות",
  "מיינדסט",
  "פרודוקטיביות",
];

export const MAX_TOPIC_LENGTH = 40;
export const NO_TOPIC_LABEL = "ללא תחום";

export function cleanTopicName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_TOPIC_LENGTH).trim();
}

/** Case- and whitespace-insensitive identity used for duplicate checks and matching. */
export function topicKey(name: string): string {
  return cleanTopicName(name).toLocaleLowerCase();
}

/**
 * The effective list: the stored one once initialized (even when empty), else the starter
 * suggestions. A deleted default therefore never comes back.
 */
export function habitTopicList(setting: HabitTopicsSetting | undefined): string[] {
  return setting ? [...setting.items] : [...DEFAULT_HABIT_TOPICS];
}

function dedupe(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const name = cleanTopicName(raw);
    const k = topicKey(name);
    if (!name || seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out;
}

/** Tolerant parse of the stored / cloud value; anything unreadable counts as "never set". */
export function asHabitTopics(value: unknown): HabitTopicsSetting | undefined {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const rec = parsed as { items?: unknown; updated_at?: unknown };
  if (!Array.isArray(rec.items)) return undefined;
  return {
    items: dedupe(rec.items.filter((item): item is string => typeof item === "string")),
    updated_at: typeof rec.updated_at === "number" && Number.isFinite(rec.updated_at) ? rec.updated_at : 0,
  };
}

/** Newer `updated_at` wins; ties go to `prefer`; an unset side never beats a set one. */
export function mergeHabitTopics(
  local: HabitTopicsSetting | undefined,
  remote: HabitTopicsSetting | undefined,
  prefer: "local" | "remote" = "local",
): HabitTopicsSetting | undefined {
  if (!local) return remote;
  if (!remote) return local;
  if (local.updated_at === remote.updated_at) return prefer === "local" ? local : remote;
  return local.updated_at > remote.updated_at ? local : remote;
}

interface TopicHolder {
  id: string;
  habit_topic?: string;
  extras_updated_at?: number;
}

export type TopicEdit<B> =
  | { ok: true; setting: HabitTopicsSetting; bubbles: B[]; changedIds: string[] }
  | { ok: false; error: string };

function indexOfTopic(items: readonly string[], name: string): number {
  const k = topicKey(name);
  return items.findIndex((item) => topicKey(item) === k);
}

export function addHabitTopic<B extends TopicHolder>(
  setting: HabitTopicsSetting | undefined,
  bubbles: B[],
  raw: string,
  now: number,
): TopicEdit<B> {
  const name = cleanTopicName(raw);
  if (!name) return { ok: false, error: "שם התחום ריק" };
  const items = habitTopicList(setting);
  if (indexOfTopic(items, name) >= 0) return { ok: false, error: "התחום כבר קיים" };
  return { ok: true, setting: { items: [...items, name], updated_at: now }, bubbles, changedIds: [] };
}

/** Renames in the list and on every bubble that used the old name (each re-stamped for sync). */
export function renameHabitTopic<B extends TopicHolder>(
  setting: HabitTopicsSetting | undefined,
  bubbles: B[],
  from: string,
  raw: string,
  now: number,
): TopicEdit<B> {
  const name = cleanTopicName(raw);
  if (!name) return { ok: false, error: "שם התחום ריק" };
  const items = habitTopicList(setting);
  const index = indexOfTopic(items, from);
  if (index < 0) return { ok: false, error: "התחום לא נמצא" };
  const clash = indexOfTopic(items, name);
  if (clash >= 0 && clash !== index) return { ok: false, error: "כבר יש תחום בשם הזה" };
  const nextItems = items.map((item, i) => (i === index ? name : item));
  const fromKey = topicKey(from);
  const changedIds: string[] = [];
  const nextBubbles = bubbles.map((bubble) => {
    if (!bubble.habit_topic || topicKey(bubble.habit_topic) !== fromKey || bubble.habit_topic === name) {
      return bubble;
    }
    changedIds.push(bubble.id);
    return { ...bubble, habit_topic: name, extras_updated_at: now };
  });
  return { ok: true, setting: { items: nextItems, updated_at: now }, bubbles: nextBubbles, changedIds };
}

/** Drops the topic and clears it from its bubbles; the habits themselves are untouched. */
export function deleteHabitTopic<B extends TopicHolder>(
  setting: HabitTopicsSetting | undefined,
  bubbles: B[],
  name: string,
  now: number,
): TopicEdit<B> {
  const items = habitTopicList(setting);
  const index = indexOfTopic(items, name);
  if (index < 0) return { ok: false, error: "התחום לא נמצא" };
  const k = topicKey(name);
  const changedIds: string[] = [];
  const nextBubbles = bubbles.map((bubble) => {
    if (!bubble.habit_topic || topicKey(bubble.habit_topic) !== k) return bubble;
    changedIds.push(bubble.id);
    return { ...bubble, habit_topic: "", extras_updated_at: now };
  });
  return {
    ok: true,
    setting: { items: items.filter((_, i) => i !== index), updated_at: now },
    bubbles: nextBubbles,
    changedIds,
  };
}

export function moveHabitTopic<B extends TopicHolder>(
  setting: HabitTopicsSetting | undefined,
  bubbles: B[],
  name: string,
  direction: -1 | 1,
  now: number,
): TopicEdit<B> {
  const items = habitTopicList(setting);
  const index = indexOfTopic(items, name);
  const swap = index + direction;
  if (index < 0 || swap < 0 || swap >= items.length) return { ok: false, error: "אין לאן להזיז" };
  const next = [...items];
  const a = next[index];
  const b = next[swap];
  if (a === undefined || b === undefined) return { ok: false, error: "אין לאן להזיז" };
  next[index] = b;
  next[swap] = a;
  return { ok: true, setting: { items: next, updated_at: now }, bubbles, changedIds: [] };
}

/** The catalog entry an item's topic resolves to (case-insensitive), else its own trimmed name. */
export function resolveTopic(items: readonly string[], topic: string | undefined): string | null {
  const name = cleanTopicName(topic ?? "");
  if (!name) return null;
  const index = indexOfTopic(items, name);
  return index >= 0 ? (items[index] ?? name) : name;
}

export interface TopicGroup<B> {
  /** Catalog name, or null for "ללא תחום". */
  topic: string | null;
  label: string;
  items: B[];
}

/**
 * Groups items by topic in catalog order; topic names missing from the catalog (e.g. a
 * rename still syncing) get their own group after it, and untopiced items go last.
 * Empty catalog groups are omitted. Item order inside a group is preserved.
 */
export function groupByTopic<B extends { habit_topic?: string }>(
  items: readonly B[],
  topics: readonly string[],
): TopicGroup<B>[] {
  const byKey = new Map<string, TopicGroup<B>>();
  const order: string[] = [];
  for (const topic of topics) {
    const k = topicKey(topic);
    if (byKey.has(k)) continue;
    byKey.set(k, { topic, label: topic, items: [] });
    order.push(k);
  }
  const none: TopicGroup<B> = { topic: null, label: NO_TOPIC_LABEL, items: [] };
  for (const item of items) {
    const name = cleanTopicName(item.habit_topic ?? "");
    if (!name) {
      none.items.push(item);
      continue;
    }
    const k = topicKey(name);
    let group = byKey.get(k);
    if (!group) {
      group = { topic: name, label: name, items: [] };
      byKey.set(k, group);
      order.push(k);
    }
    group.items.push(item);
  }
  const groups = order.map((k) => byKey.get(k)).filter((g): g is TopicGroup<B> => Boolean(g && g.items.length));
  return none.items.length ? [...groups, none] : groups;
}
