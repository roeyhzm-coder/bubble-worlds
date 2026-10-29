import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, ChevronDown, ChevronsDownUp, ChevronsUpDown, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { accentFill } from "../lib/accent";
import { sortByOrder, stepOrder } from "../lib/order";
import { ROUTINE_SLOTS, currentRoutine, routineOf, routineSlot, supportsRoutine } from "../lib/routine";
import { useEscape } from "../lib/useEscape";
import { dueText } from "../lib/triangles";
import { isItemCompleted, sessionProgress, trackingProgress } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble, RoutineTime, TriangleType } from "../types";
import { BlackStarSelector } from "./BlackStarSelector";
import { ConfirmDialog } from "./ConfirmDialog";
import { ReorderButtons } from "./ReorderButtons";
import {
  CompletionBar,
  DoneEditingButton,
  Drawer,
  MultiDailyBadge,
  NoteIndicator,
  QuickCheck,
  TitleField,
  TypeSwitcher,
  TypeTools,
  accentRing,
} from "./ItemTools";

/** Retired per-device fold preference; groups now always start collapsed. UI pref only, not user data. */
const LEGACY_COLLAPSE_KEY = "bubble-worlds-hub-collapsed";

type RoutineFilter = "all" | "now" | Exclude<RoutineTime, "general">;

/** Re-evaluates the current part of the day once a minute so "עכשיו" stays accurate. */
function useCurrentRoutine() {
  const [slot, setSlot] = useState(() => currentRoutine());
  useEffect(() => {
    const timer = window.setInterval(() => setSlot(currentRoutine()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return slot;
}

export function FocusHub() {
  const { snapshot, setPage, setDrill, reorderItems } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // Every group and time-of-day sub-group starts collapsed; only explicitly opened keys live here.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [reordering, setReordering] = useState(false);
  // Session-only: the hub always opens on "הכל" so nothing is hidden unexpectedly.
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>("all");
  const [includeGeneral, setIncludeGeneral] = useState(true);
  const [starPicker, setStarPicker] = useState(false);
  const nowSlot = useCurrentRoutine();

  useEscape(reordering, () => setReordering(false));

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_COLLAPSE_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleSection = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Every active item by triangle type; the selector lists these, the accordions skip starred ones.
  const activeGroups = useMemo(() => {
    return snapshot.triangleTypes
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((type) => ({
        type,
        items: sortByOrder(snapshot.bubbles.filter((item) => item.triangle_id === type.id && !item.archived)),
      }))
      .filter((group) => group.items.length > 0);
  }, [snapshot.bubbles, snapshot.triangleTypes]);

  const starred = useMemo(
    () =>
      activeGroups.flatMap(({ type, items }) =>
        items.filter((item) => item.is_black_star).map((item) => ({ type, item })),
      ),
    [activeGroups],
  );

  const groups = useMemo(
    () =>
      activeGroups
        .map(({ type, items }) => ({ type, items: items.filter((item) => !item.is_black_star) }))
        .filter((group) => group.items.length > 0),
    [activeGroups],
  );

  const openSource = (item: Bubble) => {
    setDrill(item.parent_bubble_id ? { kind: "bubble", id: item.parent_bubble_id } : { kind: "category", id: item.category_id });
    setPage(0);
  };

  const allCollapsed = groups.every(({ type }) => !expanded.has(type.id));
  const activeSlot = routineFilter === "all" ? null : routineFilter === "now" ? nowSlot : routineFilter;

  const renderCards = (type: TriangleType, items: Bubble[]) => {
    if (reordering) {
      const ids = items.map((item) => item.id);
      return (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
              className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-100 bg-white py-1 pe-1.5 ps-3"
            >
              <span className="w-5 shrink-0 text-center text-[11px] font-extrabold text-slate-400">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-800">
                {item.title || "ללא שם"}
              </span>
              <ReorderButtons
                title={item.title}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                onMove={(direction) => {
                  const next = stepOrder(ids, item.id, direction);
                  if (next) reorderItems(next);
                }}
              />
            </motion.div>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <HubCard
            key={item.id}
            item={item}
            type={type}
            open={openId === item.id}
            onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
            onDelete={() => setPendingDelete(item.id)}
            onSource={() => openSource(item)}
          />
        ))}
      </div>
    );
  };

  const filterChips: { id: RoutineFilter; label: string }[] = [
    { id: "all", label: "הכל" },
    { id: "now", label: `🕒 עכשיו (${routineSlot(nowSlot).label})` },
    ...ROUTINE_SLOTS.filter((slot) => slot.id !== "general").map((slot) => ({
      id: slot.id as RoutineFilter,
      label: `${slot.emoji} ${slot.label}`,
    })),
  ];

  return (
    <section className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <div className="flex items-start justify-between gap-2 px-3 pb-1">
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold text-slate-800">
            {snapshot.pageLabels.hub}
          </div>
          <div className="text-[11px] text-slate-400">כל הפריטים לפי סוג משולש</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {activeGroups.length > 0 && (
            <button
              type="button"
              onClick={() => setStarPicker(true)}
              aria-haspopup="dialog"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-700/60 bg-gradient-to-b from-slate-800 to-slate-950 px-2.5 text-[11px] font-extrabold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_14px_-8px_rgba(15,23,42,0.7)]"
            >
              <span className="text-amber-300" aria-hidden="true">★</span>
              ניהול מיקוד שחור
              {starred.length > 0 && (
                <span className="rounded-full bg-amber-300 px-1.5 text-[10px] leading-4 text-slate-950">
                  {starred.length}
                </span>
              )}
            </button>
          )}
          {openId && !reordering && (
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="h-8 rounded-full px-2 text-[11px] font-extrabold text-slate-500 hover:bg-white/70"
            >
              סגור פריט
            </button>
          )}
          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setReordering((v) => !v);
                setOpenId(null);
              }}
              aria-pressed={reordering}
              className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-extrabold ${
                reordering
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white/80 text-slate-600 hover:bg-white"
              }`}
            >
              <ArrowDownUp size={13} />
              {reordering ? "סיום" : "סידור"}
            </button>
          )}
          {groups.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!allCollapsed) {
                  setExpanded(new Set());
                  return;
                }
                // "Open all" also opens the time-of-day sub-groups, so items are visible at once.
                const next = new Set<string>();
                for (const { type } of groups) {
                  next.add(type.id);
                  if (supportsRoutine(type)) {
                    for (const slot of ROUTINE_SLOTS) next.add(`${type.id}:${slot.id}`);
                  }
                }
                setExpanded(next);
              }}
              aria-label={allCollapsed ? "פתיחת כל הקבוצות" : "כיווץ כל הקבוצות"}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 text-[11px] font-extrabold text-slate-600 hover:bg-white"
            >
              {allCollapsed ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />}
              {allCollapsed ? "פתח הכל" : "כווץ הכל"}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-24 no-scrollbar">
        <AnimatePresence initial={false}>
          {starred.length > 0 && (
            <motion.section
              key="obsidian-zone"
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              aria-label="מיקוד שחור"
              className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-2.5 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.85)]"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-amber-300/10 blur-3xl"
              />
              <div className="relative mb-2 flex h-7 items-center gap-1.5 px-1">
                <span className="text-sm text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]" aria-hidden="true">★</span>
                <span className="text-[12px] font-extrabold tracking-wide text-slate-100">מיקוד שחור</span>
                <span className="text-[11px] font-bold text-slate-500">· {starred.length}</span>
              </div>
              <div className="relative space-y-2">
                <AnimatePresence initial={false}>
                  {starred.map(({ type, item }) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    >
                      <HubCard
                        item={item}
                        type={type}
                        obsidian
                        open={openId === item.id}
                        onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
                        onDelete={() => setPendingDelete(item.id)}
                        onSource={() => openSource(item)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {groups.map(({ type, items }) => {
          const groupOpen = expanded.has(type.id);
          const tracking = supportsRoutine(type);
          const routineGroups = tracking
            ? ROUTINE_SLOTS.map((slot) => ({
                slot,
                items: items.filter((item) => routineOf(item) === slot.id),
              }))
                .filter((group) => group.items.length > 0)
                .filter(
                  (group) =>
                    !activeSlot || group.slot.id === activeSlot || (includeGeneral && group.slot.id === "general"),
                )
            : null;
          return (
            <section key={type.id} className="card p-2.5">
              <button
                type="button"
                onClick={() => toggleSection(type.id)}
                aria-expanded={groupOpen}
                className="flex h-9 w-full items-center gap-2 rounded-xl px-1 text-start hover:bg-slate-50/80"
              >
                <span className="text-base leading-none" style={{ color: type.color }} aria-hidden="true">
                  ▼
                </span>
                <span className="text-xs font-extrabold text-slate-700">{type.name}</span>
                <span
                  className="rounded-full px-1.5 text-[10px] font-extrabold text-slate-600"
                  style={{ background: `color-mix(in srgb, ${type.color} 16%, white)` }}
                  aria-label={`${items.length} פריטים`}
                >
                  {items.length}
                </span>
                <span className="flex-1" />
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform ${groupOpen ? "rotate-180" : ""}`}
                />
              </button>
              <Drawer open={groupOpen}>
                <div className="pt-1">
                  {tracking && (
                    <div
                      role="radiogroup"
                      aria-label="סינון לפי זמן ביום"
                      className="-mx-1 mb-2 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 no-scrollbar"
                    >
                      {filterChips.map((chip) => {
                        const active = routineFilter === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setRoutineFilter(chip.id)}
                            className={`h-8 shrink-0 rounded-full px-2.5 text-[11px] font-extrabold ${
                              active ? "text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                            style={active ? accentFill(type.color) : undefined}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                      {activeSlot && (
                        <button
                          type="button"
                          onClick={() => setIncludeGeneral((v) => !v)}
                          aria-pressed={includeGeneral}
                          className={`h-8 shrink-0 rounded-full px-2.5 text-[11px] font-extrabold ${
                            includeGeneral
                              ? "border border-slate-300 bg-slate-100 text-slate-700"
                              : "border border-dashed border-slate-300 bg-white text-slate-400"
                          }`}
                        >
                          {includeGeneral ? "✓ כולל כללי" : "+ כללי"}
                        </button>
                      )}
                    </div>
                  )}
                  {routineGroups ? (
                    <div className="space-y-2">
                      {routineGroups.length === 0 && (
                        <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[12px] font-bold text-slate-400">
                          אין פריטים ל{activeSlot ? routineSlot(activeSlot).heading : "זמן הזה"} עדיין
                        </div>
                      )}
                      {routineGroups.map(({ slot, items: slotItems }) => {
                        const key = `${type.id}:${slot.id}`;
                        const subOpen = expanded.has(key);
                        return (
                          <div
                            key={slot.id}
                            className="rounded-xl border border-slate-100 bg-slate-50/50 p-1.5"
                          >
                            <button
                              type="button"
                              onClick={() => toggleSection(key)}
                              aria-expanded={subOpen}
                              className="flex h-8 w-full items-center gap-1.5 rounded-lg px-1.5 text-start hover:bg-white/80"
                            >
                              <span className="text-sm leading-none" aria-hidden="true">{slot.emoji}</span>
                              <span className="text-[12px] font-extrabold text-slate-700">
                                {slot.id === "general" ? "כללי" : slot.heading}
                              </span>
                              <span className="text-[11px] font-bold text-slate-400">· {slotItems.length}</span>
                              <span className="flex-1" />
                              <ChevronDown
                                size={14}
                                className={`shrink-0 text-slate-400 transition-transform ${subOpen ? "rotate-180" : ""}`}
                              />
                            </button>
                            <Drawer open={subOpen}>{renderCards(type, slotItems)}</Drawer>
                          </div>
                        );
                      })}
                      {!activeSlot && routineGroups.length === 1 && routineGroups[0].slot.id === "general" && (
                        <div className="px-1 text-[10px] font-bold text-slate-400">
                          טיפ: תייגו פריט כ☀️ בוקר / 🌤️ צהריים / 🌙 ערב דרך הצ'יפ שלו כדי לפצל לשגרות
                        </div>
                      )}
                    </div>
                  ) : (
                    renderCards(type, items)
                  )}
                </div>
              </Drawer>
            </section>
          );
        })}

        {activeGroups.length === 0 && (
          <div className="grid h-40 place-items-center text-sm text-slate-400">
            אין עדיין פריטים עם משולש. פריטים כלליים נשארים ברשימת המקור עד שמשייכים להם סוג.
          </div>
        )}
      </div>
      <HubDeleteDialog id={pendingDelete} onClose={() => setPendingDelete(null)} />
      <BlackStarSelector open={starPicker} groups={activeGroups} onClose={() => setStarPicker(false)} />
    </section>
  );
}


function HubDeleteDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { deleteBubble } = useApp();
  return (
    <ConfirmDialog
      open={Boolean(id)}
      title="למחוק את הפריט?"
      body="הפריט יימחק מהעולם ומהמעקב."
      onCancel={onClose}
      onConfirm={() => {
        if (id) deleteBubble(id);
        onClose();
      }}
    />
  );
}

function HubCard({
  item,
  type,
  obsidian = false,
  open,
  onToggle,
  onDelete,
  onSource,
}: {
  item: Bubble;
  type: TriangleType;
  /** Dark black-star card: same tools, re-toned by the `.obsidian` CSS scope. */
  obsidian?: boolean;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSource: () => void;
}) {
  const { setTriangleType, updateBubble } = useApp();
  const progress = trackingProgress(item);
  const completed = isItemCompleted(item, type.template);
  const surface = obsidian
    ? `obsidian rounded-2xl border bg-slate-900 text-slate-100 shadow-xl transition-shadow ${
        completed ? "border-amber-300/70 ring-2 ring-amber-300/40" : "border-slate-700/50"
      } ${open ? "ring-1 ring-amber-300/30" : ""}`
    : `rounded-2xl border bg-white transition-shadow ${
        completed ? "border-amber-300 ring-2 ring-amber-200" : "border-slate-100"
      } ${open ? "shadow-md" : ""}`;
  return (
    <div className={surface} style={open && !completed && !obsidian ? accentRing(type.color) : undefined}>
      <div className="flex min-h-12 w-full items-center gap-1 px-2">
      <QuickCheck item={item} type={type} size={36} />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-start"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {obsidian && (
              <span
                className="shrink-0 text-[15px] leading-none text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                aria-label="מיקוד שחור"
              >
                ★
              </span>
            )}
            <span className="truncate text-[14px] font-bold text-slate-800">{item.title || "ללא שם"}</span>
            <NoteIndicator notes={item.notes} />
          </div>
          {type.template === "counter" && (
            <div className="truncate text-[11px] font-bold text-violet-700">
              {sessionProgress(item).done} / {sessionProgress(item).target} פעמים
            </div>
          )}
          {type.template === "tracking" && (
            <div className="truncate text-[11px] font-bold text-slate-400">
              {progress.done}/{progress.target} ימים
            </div>
          )}
          {type.template === "multi_daily" && (
            <div className="mt-0.5 flex min-w-0">
              <MultiDailyBadge item={item} color={type.color} />
            </div>
          )}
          {type.template === "action" && dueText(item) && (
            <div className="truncate text-[11px] font-bold text-emerald-600">{dueText(item)}</div>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="grid h-10 w-8 shrink-0 place-items-center text-rose-400"
          aria-label={`מחיקת ${item.title || "הפריט"}`}
          title="מחיקה"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <CompletionBar item={item} onDelete={onDelete} />
      {open && (
        <div className="border-t border-slate-100">
          <div className="space-y-2 px-3 pb-1 pt-2">
            <TitleField item={item} />
            <div className="flex items-start justify-between gap-2">
              <TypeSwitcher value={item.triangle_id} onChange={(id) => setTriangleType(item.id, id)} />
              <button
                type="button"
                onClick={onSource}
                className="h-8 shrink-0 rounded-full px-2 text-[11px] font-bold text-slate-400 hover:bg-slate-50"
              >
                לעולם המקור ‹
              </button>
            </div>
          </div>
          <TypeTools item={item} spacious={type.template === "thought"} />
          {obsidian && (
            <div className="px-3 pb-2">
              <button
                type="button"
                onClick={() => updateBubble(item.id, { is_black_star: false })}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300/25 text-[12px] font-extrabold text-amber-200 hover:bg-amber-300/10"
              >
                <span aria-hidden="true">☆</span>
                הסר מהמיקוד השחור
              </button>
            </div>
          )}
          <div className="flex px-3 pb-3">
            <DoneEditingButton onDone={onToggle} />
          </div>
        </div>
      )}
    </div>
  );
}
