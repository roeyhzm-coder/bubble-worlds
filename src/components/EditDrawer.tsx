import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PALETTE } from "../lib/defaults";
import { useVisualViewport } from "../lib/useVisualViewport";
import { useApp } from "../state/AppProvider";
import { ConfirmDialog } from "./ConfirmDialog";

export function EditDrawer() {
  const {
    composer,
    closeComposer,
    snapshot,
    updateCategory,
    updateBubble,
    deleteCategory,
    deleteBubble,
    commitCreate,
  } = useApp();
  const { inset, height } = useVisualViewport();
  const dragControls = useDragControls();

  const category =
    composer?.mode === "edit" && composer.type === "category"
      ? snapshot.categories.find((c) => c.id === composer.id)
      : undefined;
  const bubble =
    composer?.mode === "edit" && composer.type === "bubble"
      ? snapshot.bubbles.find((b) => b.id === composer.id)
      : undefined;
  const creating = composer?.mode === "create";
  const open = Boolean(composer);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end bg-slate-900/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeComposer}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 700) closeComposer();
            }}
            className="flex w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-soft"
            style={{
              maxHeight: Math.min(height * 0.92, height - 8),
              paddingBottom: Math.max(inset, 16) + 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex h-12 shrink-0 items-center justify-end px-3"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <div className="absolute left-1/2 top-2.5 h-1.5 w-12 -translate-x-1/2 rounded-full bg-slate-200" />
              <button
                type="button"
                onClick={closeComposer}
                className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-600"
                aria-label="סגירה"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 no-scrollbar">
              {creating && composer && (
                <CreateForm
                  type={composer.type}
                  onCancel={closeComposer}
                  onCreate={commitCreate}
                />
              )}
              {category && (
                <ContainerForm
                  name={category.name}
                  color={category.color}
                  showSize={false}
                  size={1}
                  onChangeName={(name) => updateCategory(category.id, { name })}
                  onChangeColor={(color) => updateCategory(category.id, { color })}
                  onDelete={() => deleteCategory(category.id)}
                />
              )}
              {bubble && (
                <ContainerForm
                  name={bubble.title}
                  color={bubble.color}
                  showSize
                  size={bubble.size_multiplier}
                  onChangeName={(name) => updateBubble(bubble.id, { title: name })}
                  onChangeColor={(color) => updateBubble(bubble.id, { color })}
                  onChangeSize={(size_multiplier) =>
                    updateBubble(bubble.id, { size_multiplier })
                  }
                  onDelete={() => deleteBubble(bubble.id)}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CreateForm({
  type,
  onCancel,
  onCreate,
}: {
  type: "category" | "bubble";
  onCancel: () => void;
  onCreate: (input: {
    name: string;
    color: string;
    size_multiplier: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [size, setSize] = useState(1);
  useEffect(() => {
    setName("");
    setColor(PALETTE[0]);
    setSize(1);
  }, [type]);

  return (
    <div className="space-y-3">
      <RowLabel label={type === "category" ? "שם העולם" : "שם הבועה"} />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="שם…"
        className="h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-semibold outline-none ring-1 ring-slate-200"
      />
      <RowLabel label="צבע" />
      <ColorRow value={color} onChange={setColor} />
      {type === "bubble" && <SizeSlider value={size} onChange={setSize} />}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 flex-1 rounded-xl bg-slate-100 text-sm font-bold text-slate-600"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={() =>
            onCreate({ name, color, size_multiplier: size })
          }
          className="h-12 flex-1 rounded-xl bg-slate-900 text-sm font-extrabold text-white"
        >
          צור בועה
        </button>
      </div>
    </div>
  );
}

function ContainerForm({
  name,
  color,
  showSize,
  size,
  onChangeName,
  onChangeColor,
  onChangeSize,
  onDelete,
}: {
  name: string;
  color: string;
  showSize: boolean;
  size: number;
  onChangeName: (name: string) => void;
  onChangeColor: (color: string) => void;
  onChangeSize?: (size: number) => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-3">
      <RowLabel label="שם" />
      <input
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
        className="h-11 w-full rounded-xl bg-slate-50 px-3 text-sm font-semibold outline-none ring-1 ring-slate-200"
      />
      <RowLabel label="צבע" />
      <ColorRow value={color} onChange={onChangeColor} />
      {showSize && onChangeSize && (
        <SizeSlider value={size} onChange={onChangeSize} />
      )}
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-50 text-sm font-bold text-rose-500"
      >
        <Trash2 size={16} />
        מחיקה
      </button>
      <ConfirmDialog
        open={confirm}
        title="למחוק?"
        body="הפעולה תמחק את הבועה ואת מה שבתוכה."
        onCancel={() => setConfirm(false)}
        onConfirm={onDelete}
      />
    </div>
  );
}

function SizeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex h-12 items-center justify-between rounded-xl bg-slate-50 px-3">
      <span className="text-xs font-bold text-slate-600">גודל בועה</span>
      <input
        type="range"
        min={0.7}
        max={1.8}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mx-3 flex-1 accent-slate-700"
      />
      <span className="w-8 text-end text-[11px] text-slate-400">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function RowLabel({ label }: { label: string }) {
  return <div className="text-[11px] font-bold text-slate-400">{label}</div>;
}

function ColorRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="h-8 w-8 rounded-full border-2"
          style={{
            background: color,
            borderColor: value === color ? "#0f172a" : "transparent",
          }}
        />
      ))}
    </div>
  );
}
