"use client";
/**
 * A radial gauge of today's spend against the daily limit.
 *
 * Amounts arrive already formatted as strings, so nothing here can round money.
 * `pctUsed` is the only number, and it only sets an arc length.
 */
interface Props {
  spentXlm: string;
  limitXlm: string;
  pctUsed: number;
  guarded: boolean;
}

const R = 54;
const CIRC = 2 * Math.PI * R;

export default function VelocityGauge({ spentXlm, limitXlm, pctUsed, guarded }: Props) {
  const dashOffset = CIRC * (1 - pctUsed / 100);
  const color = !guarded ? "#64748b" : pctUsed >= 90 ? "#ef4444" : pctUsed >= 70 ? "#f59e0b" : "#22c55e";

  const label = guarded
    ? `${pctUsed.toFixed(1)}% of today's limit used`
    : "No daily limit set — spending is not guarded";

  return (
    <figure aria-label={label} style={{ textAlign: "center", margin: 0 }}>
      <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-hidden="true">
        <circle cx={70} cy={70} r={R} fill="none" stroke="#334155" strokeWidth={12} />
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
          {spentXlm}
        </text>
        <text x={70} y={82} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          / {limitXlm} XLM
        </text>
      </svg>
      <figcaption style={{ color: "#94a3b8", fontSize: 12 }}>
        {guarded ? "Daily velocity" : "Unguarded"}
      </figcaption>
    </figure>
  );
}
