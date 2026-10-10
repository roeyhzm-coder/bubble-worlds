import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PALETTE } from "../lib/defaults";
import { useApp } from "../state/AppProvider";
import type { ToolTemplate } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { templateLabel } from "./ItemTools";

const TEMPLATES: ToolTemplate[] = ["tracking", "action", "thought"];

export function TriangleStudio() {
  const {
    snapshot,
    addTriangleType,
    updateTriangleType,
    deleteTriangleType,
    moveTriangleType,
  } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const types = snapshot.triangleTypes.slice().sort((a, b) => a.order_index - b.order_index);

  return (
    <section className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <div className="flex items-start justify-between gap-2 px-3 pb-2">
        <div>
          <div className="text-[15px] font-extrabold text-slate-800">
            {snapshot.pageLabels.studio}
          </div>
          <div className="text-[11px] text-slate-400">שם, צבע ותבנית כלים לכל סוג</div>
        </div>
        {openId && (
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="h-8 rounded-lg px-2 text-[11px] font-extrabold text-slate-500"
          >
            כיווץ הכל
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 pb-24 no-scrollbar">
        {types.map((type, index) => {
          const open = openId === type.id;
          const count = snapshot.bubbles.filter((item) => item.triangle_id === type.id).length;
          return (
            <div key={type.id} className="rounded-2xl bg-white shadow-soft">
              <div className="flex min-h-12 items-center gap-1 px-2">
                <span className="grid h-10 w-8 place-items-center text-lg" style={{ color: type.color }}>
                  ▼
                </span>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : type.id)}
                  className="flex min-w-0 flex-1 items-center gap-1 text-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-slate-800">{type.name}</div>
                    <div className="text-[11px] font-bold text-slate-400">
                      {templateLabel(type.template)} · {count} פריטים
                    </div>
                  </div>
                  {open ? (
                    <ChevronUp size={16} className="shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="shrink-0 text-slate-400" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveTriangleType(type.id, -1)}
                  className="grid h-9 w-8 place-items-center text-slate-400 disabled:opacity-30"
                  aria-label="העלאה"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={index === types.length - 1}
                  onClick={() => moveTriangleType(type.id, 1)}
                  className="grid h-9 w-8 place-items-center text-slate-400 disabled:opacity-30"
                  aria-label="הורדה"
                >
                  <ChevronDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(type.id);
                  }}
                  className="grid h-9 w-8 place-items-center text-rose-400"
                  aria-label="מחיקה"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {open && (
                <div className="space-y-2.5 border-t border-slate-100 px-3 py-3">
                  <input
                    value={type.name}
                    onChange={(e) => updateTriangleType(type.id, { name: e.target.value })}
                    className="h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-bold outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateTriangleType(type.id, { color })}
                        className="h-7 w-7 rounded-full border-2"
                        style={{
                          background: color,
                          borderColor: type.color === color ? "#0f172a" : "transparent",
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={type.color}
                      onChange={(e) => updateTriangleType(type.id, { color: e.target.value })}
                      className="h-7 w-10 rounded border-0 bg-transparent"
                      aria-label="בחירת צבע"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TEMPLATES.map((template) => (
                      <button
                        key={template}
                        type="button"
                        onClick={() => updateTriangleType(type.id, { template })}
                        className={`h-11 rounded-xl px-1 text-[11px] font-extrabold ${
                          type.template === template
                            ? "bg-slate-900 text-white"
                            : "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {templateLabel(template)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const id = addTriangleType();
            setOpenId(id);
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-extrabold text-slate-700 shadow-soft"
        >
          <Plus size={16} />
          הוסף סוג משולש חדש
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="למחוק את סוג המשולש?"
        body="הפריטים יעברו לסוג הראשון שנותר."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteTriangleType(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </section>
  );
}
