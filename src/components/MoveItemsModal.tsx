import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, CornerLeftUp, List, Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogFocus, useEscape } from "../lib/useEscape";
import { useApp } from "../state/AppProvider";
import type { AppSnapshot, DrillNode } from "../types";
import { Portal } from "./Portal";

interface Target {
  node: DrillNode;
  label: string;
  color: string;
  kind: "list" | "bubbles" | null;
  children: number;
}

function sameNode(a: DrillNode, b: DrillNode): boolean {
  if (a.kind === "root" || b.kind === "root") return a.kind === b.kind;
  return a.kind === b.kind && a.id === b.id;
}

/** The level one step above `node` (bubble → its parent bubble or category; category → root). */
export function parentLevel(node: DrillNode, snapshot: AppSnapshot): DrillNode {
  if (node.kind === "bubble") {
    const bubble = snapshot.bubbles.find((b) => b.id === node.id);
    if (!bubble) return { kind: "root" };
    return bubble.parent_bubble_id
      ? { kind: "bubble", id: bubble.parent_bubble_id }
      : { kind: "category", id: bubble.category_id };
  }
  return { kind: "root" };
}

function levelTrail(node: DrillNode, snapshot: AppSnapshot): { node: DrillNode; label: string }[] {
  const trail: { node: DrillNode; label: string }[] = [{ node: { kind: "root" }, label: "מפת עולמות" }];
  if (node.kind === "root") return trail;
  if (node.kind === "category") {
    const cat = snapshot.categories.find((c) => c.id === node.id);
    return cat ? [...trail, { node, label: cat.name }] : trail;
  }
  const chain: { node: DrillNode; label: string }[] = [];
  let cursor = snapshot.bubbles.find((b) => b.id === node.id);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift({ node: { kind: "bubble", id: cursor.id }, label: cursor.title || "ללא שם" });
    const parentId: string | null = cursor.parent_bubble_id;
    cursor = parentId ? snapshot.bubbles.find((b) => b.id === parentId) : undefined;
  }
  const first = snapshot.bubbles.find((b) => b.id === node.id);
  const cat = first ? snapshot.categories.find((c) => c.id === first.category_id) : undefined;
  if (cat) trail.push({ node: { kind: "category", id: cat.id }, label: cat.name });
  return [...trail, ...chain];
}

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
  const [level, setLevel] = useState<DrillNode>(() => parentLevel(source, snapshot));
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEscape(open, onClose);
  useDialogFocus(open, panel);

  useEffect(() => {
    if (!open) return;
    setLevel(parentLevel(source, snapshot));
    setName("");
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

  const targets = useMemo<Target[]>(() => {
    const countKids = (id: string) => snapshot.bubbles.filter((b) => b.parent_bubble_id === id && !b.archived).length;
    if (level.kind === "root") {
      return snapshot.categories
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((c) => ({
          node: { kind: "category" as const, id: c.id },
          label: c.name,
          color: c.color,
          kind: c.container_type,
          children: snapshot.bubbles.filter((b) => b.category_id === c.id && !b.parent_bubble_id && !b.archived)
            .length,
        }));
    }
    const rows =
      level.kind === "category"
        ? snapshot.bubbles.filter((b) => b.category_id === level.id && !b.parent_bubble_id)
        : snapshot.bubbles.filter((b) => b.parent_bubble_id === level.id);
    return rows
      .filter((b) => !b.archived && !blocked.has(b.id))
      // Plain leaf items aren't destinations; containers (and the source itself) are.
      .filter((b) => b.container_type || countKids(b.id) > 0 || sameNode({ kind: "bubble", id: b.id }, source))
      .sort((a, b) => Number(b.container_type === "list") - Number(a.container_type === "list"))
      .map((b) => ({
        node: { kind: "bubble" as const, id: b.id },
        label: b.title || "ללא שם",
        color: b.color,
        kind: b.container_type,
        children: countKids(b.id),
      }));
  }, [blocked, level, snapshot.bubbles, snapshot.categories, source]);

  const trail = useMemo(() => levelTrail(level, snapshot), [level, snapshot]);
  const levelLabel = trail[trail.length - 1]?.label ?? "";
  const count = itemIds.length;

  const moveTo = (target: Target) => {
    if (busy) return;
    setBusy(true);
    const moved = moveItems(itemIds, target.node);
    onMoved({ count: moved, label: target.label, node: target.node });
  };

  const split = () => {
    const title = name.trim();
    if (!title || busy) return;
    setBusy(true);
    const node = splitIntoNewList(title, itemIds, level);
    if (node) onMoved({ count, label: title, node });
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
                  <p className="text-[11px] font-bold text-slate-400">בחרו יעד או צרו רשימה חדשה ב{levelLabel}</p>
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

              <div className="flex items-center gap-1 overflow-x-auto px-4 pb-2 no-scrollbar">
                {trail.map((crumb, index) => {
                  const last = index === trail.length - 1;
                  return (
                    <span key={`${crumb.node.kind}-${index}`} className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={last}
                        onClick={() => setLevel(crumb.node)}
                        className={`h-7 max-w-[9rem] truncate rounded-full px-2.5 text-[11px] font-extrabold ${
                          last ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {crumb.label}
                      </button>
                      {!last && <ChevronLeft size={12} className="text-slate-300" />}
                    </span>
                  );
                })}
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                <form
                  className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    split();
                  }}
                >
                  <div className="mb-1.5 text-[11px] font-extrabold text-indigo-700">
                    + צור {level.kind === "root" ? "עולם רשימה חדש" : "בועת רשימה חדשה"} כאן והעבר
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="למשל: שגרת בוקר"
                      aria-label="שם הרשימה החדשה"
                      data-autofocus
                      className="h-10 min-w-0 flex-1 rounded-xl bg-white px-3 text-sm font-semibold text-slate-800 outline-none ring-1 ring-indigo-100 focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      type="submit"
                      disabled={!name.trim() || busy}
                      aria-busy={busy}
                      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 px-3 text-[12px] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_16px_-8px_rgba(79,70,229,0.8)] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      צור והעבר
                    </button>
                  </div>
                </form>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-slate-400">
                      {level.kind === "root" ? "עולמות" : `יעדים ב${levelLabel}`}
                    </span>
                    {level.kind !== "root" && (
                      <button
                        type="button"
                        onClick={() => setLevel(parentLevel(level, snapshot))}
                        className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-extrabold text-slate-500 hover:bg-slate-100"
                      >
                        <CornerLeftUp size={13} />
                        רמה אחת אחורה
                      </button>
                    )}
                  </div>

                  {level.kind !== "root" && (
                    <button
                      type="button"
                      disabled={busy || sameNode(level, source)}
                      onClick={() => moveTo({ node: level, label: levelLabel, color: "#64748b", kind: null, children: 0 })}
                      className="mb-1.5 flex h-11 w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-start text-[12px] font-extrabold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowUpRight size={15} className="shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">העבר ישירות ל{levelLabel}</span>
                    </button>
                  )}

                  <div className="space-y-1.5">
                    {targets.length === 0 && (
                      <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[12px] font-bold text-slate-400">
                        אין כאן בועות רשימה. צרו אחת למעלה ✨
                      </div>
                    )}
                    {targets.map((target) => {
                      const isSource = sameNode(target.node, source);
                      return (
                        <div
                          key={target.node.kind === "root" ? "root" : target.node.id}
                          className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white shadow-sm"
                        >
                          <button
                            type="button"
                            disabled={busy || isSource}
                            onClick={() => moveTo(target)}
                            className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 text-start disabled:opacity-50"
                          >
                            <span
                              className="h-6 w-6 shrink-0 rounded-full"
                              style={{
                                background: `radial-gradient(circle at 30% 25%, #fff 0%, ${target.color} 120%)`,
                                boxShadow: `0 4px 10px -4px ${target.color}`,
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-bold text-slate-800">{target.label}</span>
                              <span className="block text-[10px] font-bold text-slate-400">
                                {isSource
                                  ? "כאן הפריטים עכשיו"
                                  : `${target.kind === "list" ? "רשימה" : target.kind === "bubbles" ? "בועות" : "ריק"} · ${target.children} פריטים`}
                              </span>
                            </span>
                            {target.kind === "list" && !isSource && <List size={14} className="shrink-0 text-indigo-400" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setLevel(target.node)}
                            className="grid h-12 w-10 shrink-0 place-items-center border-s border-slate-100 text-slate-400 hover:bg-slate-50"
                            aria-label={`כניסה אל ${target.label}`}
                            title="כניסה פנימה"
                          >
                            <ChevronLeft size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
