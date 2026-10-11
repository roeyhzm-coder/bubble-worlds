import type { Success, SuccessSource } from "../types";

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function asSource(value: unknown): SuccessSource {
  return value === "bubble" || value === "daily" || value === "manual" ? value : "manual";
}

export function asSuccesses(value: unknown): Success[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: typeof row.id === "string" && row.id ? row.id : newId("win"),
      title: typeof row.title === "string" ? row.title : "",
      notes: typeof row.notes === "string" ? row.notes : "",
      source_type: asSource(row.source_type),
      created_at:
        typeof row.created_at === "string" && row.created_at
          ? row.created_at
          : new Date().toISOString(),
      category_name: typeof row.category_name === "string" ? row.category_name : "",
    }))
    .filter((item) => item.title.trim());
}

export function mergeSuccesses(local: Success[], remote: Success[]): Success[] {
  const map = new Map<string, Success>();
  for (const item of local) map.set(item.id, item);
  for (const item of remote) {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    map.set(item.id, {
      ...prev,
      ...item,
      title: item.title || prev.title,
      notes: item.notes || prev.notes,
      category_name: item.category_name || prev.category_name,
      created_at: item.created_at < prev.created_at ? item.created_at : prev.created_at,
    });
  }
  return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function formatSuccessDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
