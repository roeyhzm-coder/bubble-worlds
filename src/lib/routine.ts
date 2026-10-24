import type { Bubble, RoutineTime, TriangleType } from "../types";
import { TRI_TRACK } from "./triangles";

/**
 * Time-of-day routines belong only to the blue habit tracker. Other tracking-template types
 * (e.g. a red "להפסיק") list their items flat, without morning/noon/evening grouping.
 */
export function supportsRoutine(type: Pick<TriangleType, "id" | "name">): boolean {
  return type.id === TRI_TRACK || type.name.trim() === "מעקב הרגלים";
}

export interface RoutineSlot {
  id: RoutineTime;
  emoji: string;
  /** Short chip label, e.g. "בוקר". */
  label: string;
  /** Group heading in the hub, e.g. "שגרת בוקר". */
  heading: string;
}

/** Display order for routine sub-groups: morning → noon → evening → general. */
export const ROUTINE_SLOTS: RoutineSlot[] = [
  { id: "morning", emoji: "☀️", label: "בוקר", heading: "שגרת בוקר" },
  { id: "noon", emoji: "🌤️", label: "צהריים", heading: "שגרת צהריים" },
  { id: "evening", emoji: "🌙", label: "ערב", heading: "שגרת ערב" },
  { id: "general", emoji: "🔄", label: "כללי", heading: "כללי" },
];

export function routineOf(bubble: Pick<Bubble, "routine_time">): RoutineTime {
  return bubble.routine_time ?? "general";
}

/** Morning 05:00–11:59, noon 12:00–16:59, evening 17:00–04:59. */
export function currentRoutine(now: Date = new Date()): Exclude<RoutineTime, "general"> {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "noon";
  return "evening";
}

export function routineSlot(time: RoutineTime): RoutineSlot {
  return ROUTINE_SLOTS.find((slot) => slot.id === time) ?? ROUTINE_SLOTS[3];
}
