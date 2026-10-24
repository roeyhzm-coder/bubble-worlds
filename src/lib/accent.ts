import type { CSSProperties } from "react";

/** Rich gradient fill + inner highlight + colored drop shadow for a primary action. */
export function accentFill(color: string): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 72%, #0f172a) 100%)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 18px -8px color-mix(in srgb, ${color} 80%, transparent)`,
  };
}

/** Anchoring ring for an expanded card, tinted with its triangle color. */
export function accentRing(color: string): CSSProperties {
  return {
    borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
    borderInlineStartWidth: 4,
    borderInlineStartColor: color,
    boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 30%, transparent), 0 12px 28px -14px color-mix(in srgb, ${color} 70%, transparent)`,
  };
}

export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}
