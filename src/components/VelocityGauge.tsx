"use client";
/**
 * VelocityGauge — SVG radial chart showing XLM spent vs daily limit.
 * Props come directly from useVelocity().
 */
interface Props {
  spentXlm: number;
  limitXlm: number;
  pctUsed: number;
}

const R = 54; // circle radius
const CIRC = 2 * Math.PI * R;

export default function VelocityGauge({ spentXlm, limitXlm, pctUsed }: Props) {
  const dashOffset = CIRC * (1 - pctUsed / 100);
  const color = pctUsed >= 90 ? "#ef4444" : pctUsed >= 70 ? "#f59e0b" : "#22c55e";

  return (
    <figure aria-label={`${pctUsed.toFixed(1)}% of daily limit used`} style={{ textAlign: "center" }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {/* track */}
        <circle cx={70} cy={70} r={R} fill="none" stroke="#334155" strokeWidth={12} />
        {/* progress */}
        <circle
          cx={70}
          cy={70}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeDasharray={CIRC}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text x={70} y={66} textAnchor="middle" fill="#f1f5f9" fontSize={14} fontWeight="bold">
          {spentXlm.toFixed(2)}
        </text>
        <text x={70} y={82} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          / {limitXlm.toFixed(2)} XLM
        </text>
      </svg>
      <figcaption style={{ color: "#94a3b8", fontSize: 12 }}>Daily velocity</figcaption>
    </figure>
  );
}
