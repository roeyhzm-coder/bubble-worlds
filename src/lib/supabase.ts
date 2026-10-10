import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BW_TABLES, type AppSnapshot, type Bubble, type Category, type ColorRoles } from "../types";
import { DEFAULT_COLOR_ROLES } from "./defaults";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

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
  const rec = value as Partial<ColorRoles>;
  return { ...DEFAULT_COLOR_ROLES, ...rec };
}

export async function fetchRemoteSnapshot(): Promise<AppSnapshot | null> {
  if (!supabase) return null;
  const [cats, bubs, settings] = await Promise.all([
    supabase.from(BW_TABLES.categories).select("*"),
    supabase.from(BW_TABLES.bubbles).select("*"),
    supabase.from(BW_TABLES.settings).select("*").eq("key", "color_roles").maybeSingle(),
  ]);
  if (cats.error || bubs.error) {
    console.warn("Supabase fetch failed, using local fallback", cats.error ?? bubs.error);
    return null;
  }
  return {
    categories: (cats.data ?? []) as Category[],
    bubbles: ((bubs.data ?? []) as RemoteBubble[]).map((row) => ({
      ...row,
      tracking_history: asHistory(row.tracking_history),
    })),
    colorRoles: asRoles(settings.data?.value),
  };
}

export async function upsertCategory(category: Category): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(BW_TABLES.categories).upsert(category);
  if (error) console.warn("upsert category", error.message);
}

export async function upsertBubble(bubble: Bubble): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(BW_TABLES.bubbles).upsert(bubble);
  if (error) console.warn("upsert bubble", error.message);
}

export async function deleteCategoryRemote(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from(BW_TABLES.categories).delete().eq("id", id);
}

export async function deleteBubbleRemote(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from(BW_TABLES.bubbles).delete().eq("id", id);
}

export async function upsertColorRoles(colorRoles: ColorRoles): Promise<void> {
  if (!supabase) return;
  await supabase.from(BW_TABLES.settings).upsert({
    key: "color_roles",
    value: colorRoles,
  });
}

export type RemoteChangeHandler = (snapshot: AppSnapshot) => void;

export function subscribeRealtime(onChange: RemoteChangeHandler): () => void {
  if (!supabase) return () => undefined;
  const channel = supabase
    .channel("bubble-worlds-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: BW_TABLES.categories },
      () => {
        void fetchRemoteSnapshot().then((snap) => {
          if (snap) onChange(snap);
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: BW_TABLES.bubbles },
      () => {
        void fetchRemoteSnapshot().then((snap) => {
          if (snap) onChange(snap);
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: BW_TABLES.settings },
      () => {
        void fetchRemoteSnapshot().then((snap) => {
          if (snap) onChange(snap);
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
