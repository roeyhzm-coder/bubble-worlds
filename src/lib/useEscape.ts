import { useEffect, useRef, type RefObject } from "react";

/** Open layers, innermost last: Escape closes only the top one (a dialog over a drawer, etc.). */
const layers: { current: () => void }[] = [];
let listening = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !layers.length) return;
  event.preventDefault();
  event.stopPropagation();
  layers[layers.length - 1]?.current();
}

/** Calls `onClose` when Escape is pressed while `active`, if this is the topmost open layer. */
export function useEscape(active: boolean, onClose: () => void): void {
  const handler = useRef(onClose);
  handler.current = onClose;

  useEffect(() => {
    if (!active) return;
    const layer = { current: () => handler.current() };
    layers.push(layer);
    if (!listening) {
      window.addEventListener("keydown", onKeyDown);
      listening = true;
    }
    return () => {
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (!layers.length && listening) {
        window.removeEventListener("keydown", onKeyDown);
        listening = false;
      }
    };
  }, [active]);
}

/**
 * Moves focus into a dialog when it opens (first `[data-autofocus]`, else the panel itself)
 * and returns it to whatever was focused before when it closes.
 */
export function useDialogFocus(open: boolean, panel: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const root = panel.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>("[data-autofocus]") ?? root;
      target.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, panel]);
}
