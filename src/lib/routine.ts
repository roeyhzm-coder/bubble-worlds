import type { Bubble, RoutineTime } from "../types";

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

export function routineSlot(time: RoutineTime): RoutineSlot {
  return ROUTINE_SLOTS.find((slot) => slot.id === time) ?? ROUTINE_SLOTS[3];
}
