import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Globe2, Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import { useApp } from "../state/AppProvider";
import type { AppSnapshot, Bubble, DrillNode } from "../types";
import { Drawer } from "./ItemTools";
import { Portal } from "./Portal";

interface ListTarget {
  node: DrillNode;
  label: string;
  /** Parent bubbles between the world and the list, e.g. "תכנון · שבוע". */
  path: string;
  color: string;
  children: number;
  isSource: boolean;
}

interface WorldGroup {
  id: string;
  name: string;
  color: string;
  /** The world's top level is itself a list, so it can take list items directly. */
  isList: boolean;
  isSource: boolean;
  children: number;
  lists: ListTarget[];
}

function sameNode(a: DrillNode, b: DrillNode): boolean {
  if (a.kind === "root" || b.kind === "root") return a.kind === b.kind;
  return a.kind === b.kind && a.id === b.id;
}

function sourceCategoryId(source: DrillNode, snapshot: AppSnapshot): string | null {
  if (source.kind === "category") return source.id;
  if (source.kind === "bubble") return snapshot.bubbles.find((b) => b.id === source.id)?.category_id ?? null;
  return null;
}

function pathOf(bubble: Bubble, byId: Map<string, Bubble>): string {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cursor = bubble.parent_bubble_id ? byId.get(bubble.parent_bubble_id) : undefined;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor.title || "ללא שם");
    cursor = cursor.parent_bubble_id ? byId.get(cursor.parent_bubble_id) : undefined;
  }
  return chain.join(" · ");
}

/**
 * Moves list rows between lists. Destinations are only list containers (📋 list bubbles, or a
 * world whose top level is a list), so a habit can never land on a canvas as a floating bubble.
 */
export function MoveItemsModal({
  open,
  itemIds,
  source,
  onClose,
  onMoved,
}: {
  open: boolean;
  itemIds: string[];
  /** The container the items currently live in. */
  source: DrillNode;
  onClose: () => void;
  onMoved: (summary: { count: number; label: string; node: DrillNode }) => void;
}) {
  const { snapshot, moveItems, splitIntoNewList } = useApp();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [worldName, setWorldName] = useState("");
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useDialogFocus(open, panel);

  useEffect(() => {
    if (!open) return;
    const home = sourceCategoryId(source, snapshot);
    setExpanded(new Set(home ? [home] : []));
    setNames({});
    setWorldName("");
    setBusy(false);
    // Reset only when the modal opens; later snapshot changes shouldn't jump the view.
  }, [open]);

  // Items can't be moved into themselves or anything nested under them.
  const blocked = useMemo(() => {
    const out = new Set(itemIds);
    let frontier = itemIds;
    while (frontier.length) {
      const kids = snapshot.bubbles.filter((b) => b.parent_bubble_id && frontier.includes(b.parent_bubble_id));
      frontier = kids.map((b) => b.id).filter((id) => !out.has(id));
      frontier.forEach((id) => out.add(id));
    }
    return out;
  }, [itemIds, snapshot.bubbles]);

  const worlds = useMemo<WorldGroup[]>(() => {
    const byId = new Map(snapshot.bubbles.map((b) => [b.id, b]));
    const countKids = (id: string) => snapshot.bubbles.filter((b) => b.parent_bubble_id === id && !b.archived).length;
    return snapshot.categories
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((category) => {
        const lists = snapshot.bubbles
          .filter(
            (b) =>
              b.category_id === category.id &&
              b.container_type === "list" &&
              !b.archived &&
              !blocked.has(b.id),
          )
          .map((b) => ({
            node: { kind: "bubble" as const, id: b.id },
            label: b.title || "ללא שם",
            path: pathOf(b, byId),
            color: b.color,
            children: countKids(b.id),
            isSource: sameNode({ kind: "bubble", id: b.id }, source),
          }))
          .sort((a, b) => a.path.localeCompare(b.path, "he") || a.label.localeCompare(b.label, "he"));
        return {
          id: category.id,
          name: category.name,
          color: category.color,
          isList: category.container_type === "list",
          isSource: sameNode({ kind: "category", id: category.id }, source),
          children: snapshot.bubbles.filter((b) => b.category_id === category.id && !b.parent_bubble_id && !b.archived)
            .length,
          lists,
        };
      });
  }, [blocked, snapshot, source]);

  const count = itemIds.length;

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const moveTo = (node: DrillNode, label: string) => {
    if (busy) return;
    setBusy(true);
    const moved = moveItems(itemIds, node);
    onMoved({ count: moved, label, node });
  };

  const createIn = (at: DrillNode, title: string) => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const node = splitIntoNewList(title.trim(), itemIds, at);
    if (node) onMoved({ count, label: title.trim(), node });
    else setBusy(false);
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/35 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              ref={panel}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="העברת פריטים"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4">
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-800">⇄ העברת {count} פריטים</h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    בחרו רשימה 📋 — הפריטים יישארו שורות ברשימה, לא בועות צפות
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"
                  aria-label="סגירה"
                  title="סגירה"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
                {worlds.map((world) => {
                  const isOpen = expanded.has(world.id);
                  const draft = names[world.id] ?? "";
                  return (
                    <section key={world.id} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggle(world.id)}
                        aria-expanded={isOpen}
                        className="flex min-h-12 w-full items-center gap-2 px-3 text-start"
                      >
                        <span
                          className="h-6 w-6 shrink-0 rounded-full"
                          style={{
                            background: `radial-gradient(circle at 30% 25%, #fff 0%, ${world.color} 120%)`,
                            boxShadow: `0 4px 10px -4px ${world.color}`,
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-extrabold text-slate-800">{world.name}</span>
                          <span className="block text-[10px] font-bold text-slate-400">
                            {world.isList ? `עולם רשימה · ${world.children} פריטים` : `${world.lists.length} רשימות`}
                          </span>
                        </span>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      <Drawer open={isOpen}>
                        <div className="space-y-1.5 px-2 pb-2">
                          {world.isList && (
                            <DestinationRow
                              label={`${world.name} (הרשימה הראשית)`}
                              path=""
                              itemCount={world.children}
                              isSource={world.isSource}
                              busy={busy}
                              onPick={() => moveTo({ kind: "category", id: world.id }, world.name)}
                            />
                          )}
                          {world.lists.map((target) => (
                            <DestinationRow
                              key={target.node.kind === "bubble" ? target.node.id : target.label}
                              label={target.label}
                              path={target.path}
                              itemCount={target.children}
                              isSource={target.isSource}
                              busy={busy}
                              onPick={() => moveTo(target.node, target.label)}
                            />
                          ))}
                          {!world.isList && world.lists.length === 0 && (
                            <div className="rounded-xl bg-slate-50 px-3 py-3 text-center text-[12px] font-bold text-slate-400">
                              אין עדיין רשימות בעולם הזה. צרו אחת למטה ✨
                            </div>
                          )}
                          <form
                            className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              createIn({ kind: "category", id: world.id }, draft);
                            }}
                          >
                            <div className="mb-1 text-[11px] font-extrabold text-indigo-700">
                              + צור בועת רשימה חדשה כאן והעבר
                            </div>
                            <div className="flex gap-1.5">
                              <input
                                value={draft}
                                onChange={(e) => setNames((current) => ({ ...current, [world.id]: e.target.value }))}
                                placeholder="למשל: שגרת בוקר"
                                aria-label={`שם הרשימה החדשה ב${world.name}`}
                                className="h-10 min-w-0 flex-1 rounded-xl bg-white px-3 text-sm font-semibold text-slate-800 outline-none ring-1 ring-indigo-100 focus:ring-2 focus:ring-indigo-300"
                              />
                              <CreateButton disabled={!draft.trim() || busy} busy={busy} />
                            </div>
                          </form>
                        </div>
                      </Drawer>
                    </section>
                  );
                })}

                <form
                  className="rounded-2xl border border-dashed border-slate-300 p-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createIn({ kind: "root" }, worldName);
                  }}
                >
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-extrabold text-slate-500">
                    <Globe2 size={13} />
                    או צרו עולם רשימה חדש והעבירו אליו
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={worldName}
                      onChange={(e) => setWorldName(e.target.value)}
                      placeholder="שם העולם החדש"
                      aria-label="שם עולם הרשימה החדש"
                      className="h-10 min-w-0 flex-1 rounded-xl bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-300"
                    />
                    <CreateButton disabled={!worldName.trim() || busy} busy={busy} />
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

function DestinationRow({
  label,
  path,
  itemCount,
  isSource,
  busy,
  onPick,
}: {
  label: string;
  path: string;
  itemCount: number;
  isSource: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy || isSource}
      onClick={onPick}
      className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-slate-50 px-3 text-start hover:bg-indigo-50 disabled:opacity-50"
    >
      <span className="shrink-0 text-base leading-none" aria-hidden="true">
        📋
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-slate-800">{label}</span>
        <span className="block truncate text-[10px] font-bold text-slate-400">
          {isSource ? "כאן הפריטים עכשיו" : `${path ? `${path} · ` : ""}${itemCount} פריטים`}
        </span>
      </span>
      {!isSource && <span className="shrink-0 text-[11px] font-extrabold text-indigo-600">העבר לכאן ‹</span>}
    </button>
  );
}

function CreateButton({ disabled, busy }: { disabled: boolean; busy: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={busy}
      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 px-3 text-[12px] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-8px_rgba(79,70,229,0.8)] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
      צור והעבר
    </button>
  );
}
