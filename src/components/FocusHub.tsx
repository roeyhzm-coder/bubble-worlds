import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ROUTINE_SLOTS, routineOf } from "../lib/routine";
import { dueText } from "../lib/triangles";
import { isItemCompleted, sessionProgress, trackingProgress } from "../lib/tracking";
import { useApp } from "../state/AppProvider";
import type { Bubble, TriangleType } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  CompletionBar,
  DoneEditingButton,
  Drawer,
  NoteIndicator,
  QuickCheck,
  TitleField,
  TypeSwitcher,
  TypeTools,
  accentRing,
} from "./ItemTools";

/** Per-device UI preference only (which hub sections are folded) — never user data. */
const COLLAPSE_KEY = "bubble-worlds-hub-collapsed";

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

function saveCollapsed(keys: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...keys]));
  } catch {
    /* storage unavailable */
  }
}

export function FocusHub() {
  const { snapshot, setPage, setDrill } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);

  useEffect(() => {
    saveCollapsed(collapsed);
  }, [collapsed]);

  const toggleSection = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groups = useMemo(() => {
    return snapshot.triangleTypes
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((type) => ({
        type,
        items: snapshot.bubbles.filter((item) => item.triangle_id === type.id && !item.archived),
      }))
      .filter((group) => group.items.length > 0);
  }, [snapshot.bubbles, snapshot.triangleTypes]);

  const allCollapsed = groups.length > 0 && groups.every(({ type }) => collapsed.has(type.id));

  const renderCards = (type: TriangleType, items: Bubble[]) => (
    <div className="space-y-2">
      {items.map((item) => (
        <HubCard
          key={item.id}
          item={item}
          type={type}
          open={openId === item.id}
          onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
          onDelete={() => setPendingDelete(item.id)}
          onSource={() => {
            setDrill(
              item.parent_bubble_id
                ? { kind: "bubble", id: item.parent_bubble_id }
                : { kind: "category", id: item.category_id },
            );
            setPage(0);
          }}
        />
      ))}
    </div>
  );

  return (
    <section className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <div className="flex items-start justify-between gap-2 px-3 pb-1">
        <div>
          <div className="text-[15px] font-extrabold text-slate-800">
            {snapshot.pageLabels.hub}
          </div>
          <div className="text-[11px] text-slate-400">כל הפריטים לפי סוג משולש</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {openId && (
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
              onClick={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  for (const { type } of groups) {
                    if (allCollapsed) next.delete(type.id);
                    else next.add(type.id);
                  }
                  return next;
                })
              }
              className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 text-[11px] font-extrabold text-slate-600 hover:bg-white"
            >
              {allCollapsed ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />}
              {allCollapsed ? "פתח הכל" : "כווץ הכל"}
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-24 no-scrollbar">
        {groups.map(({ type, items }) => {
          const groupOpen = !collapsed.has(type.id);
          const routineGroups =
            type.template === "tracking"
              ? ROUTINE_SLOTS.map((slot) => ({
                  slot,
                  items: items.filter((item) => routineOf(item) === slot.id),
                })).filter((group) => group.items.length > 0)
              : null;
          return (
            <section key={type.id} className="card p-2.5">
              <button
                type="button"
                onClick={() => toggleSection(type.id)}
                aria-expanded={groupOpen}
                className="flex h-9 w-full items-center gap-2 rounded-xl px-1 text-start hover:bg-slate-50/80"
              >
                <span className="text-base leading-none" style={{ color: type.color }}>
                  ▼
                </span>
                <span className="text-xs font-extrabold text-slate-700">{type.name}</span>
                <span
                  className="rounded-full px-1.5 text-[10px] font-extrabold text-slate-600"
                  style={{ background: `color-mix(in srgb, ${type.color} 16%, white)` }}
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
                  {routineGroups ? (
                    <div className="space-y-2">
                      {routineGroups.map(({ slot, items: slotItems }) => {
                        const key = `${type.id}:${slot.id}`;
                        const subOpen = !collapsed.has(key);
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
                              <span className="text-sm leading-none">{slot.emoji}</span>
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
                      {routineGroups.length === 1 && routineGroups[0].slot.id === "general" && (
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

        {groups.length === 0 && (
          <div className="grid h-40 place-items-center text-sm text-slate-400">
            אין עדיין פריטים עם משולש. פריטים כלליים נשארים ברשימת המקור עד שמשייכים להם סוג.
          </div>
        )}
      </div>
      <HubDeleteDialog id={pendingDelete} onClose={() => setPendingDelete(null)} />
    </section>
  );
}

function HubDeleteDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { deleteBubble } = useApp();
  return (
    <ConfirmDialog
      open={Boolean(id)}
      title="למחוק את הפריט?"
      body="הפריט יימחק מהעולם וממוקדי הפוקוס."
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
  open,
  onToggle,
  onDelete,
  onSource,
}: {
  item: Bubble;
  type: TriangleType;
  open: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSource: () => void;
}) {
  const { setTriangleType } = useApp();
  const progress = trackingProgress(item);
  const completed = isItemCompleted(item, type.template);
  return (
    <div
      className={`rounded-2xl border bg-white transition-shadow ${
        completed ? "border-amber-300 ring-2 ring-amber-200" : "border-slate-100"
      } ${open ? "shadow-md" : ""}`}
      style={open && !completed ? accentRing(type.color) : undefined}
    >
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
          aria-label="מחיקה"
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
          <div className="flex px-3 pb-3">
            <DoneEditingButton onDone={onToggle} />
          </div>
        </div>
      )}
    </div>
  );
}
