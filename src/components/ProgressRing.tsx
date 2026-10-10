interface ProgressRingProps {
  ratio: number;
  size: number;
  color: string;
  className?: string;
}

export function ProgressRing({
  ratio,
  size,
  color,
  className = "pointer-events-none absolute inset-0",
}: ProgressRingProps) {
  const stroke = Math.max(3, size * 0.045);
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(1, Math.max(0, ratio)));

  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(148,163,184,0.2)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
