import { m, useReducedMotion } from "framer-motion";
import { DEMO_COMPANIES, DEMO_OBLIGATIONS, YOU_SME_ID } from "@fxfold/solver";

const positions: Record<string, { x: number; y: number }> = {
  A: { x: 180, y: 120 },
  B: { x: 420, y: 80 },
  C: { x: 650, y: 140 },
  D: { x: 780, y: 300 },
  E: { x: 600, y: 420 },
  F: { x: 360, y: 450 },
  G: { x: 160, y: 340 },
  H: { x: 480, y: 250 },
};

const currencyColor = (ccy: string) => {
  if (ccy === "EUR" || ccy === "EURC") return "#8a5a2b";
  if (ccy === "AED") return "#0b4f56";
  return "#2a6f7f";
};

export function TradeGraph({
  folding,
  folded,
  youId = YOU_SME_ID,
  highlightYou = true,
}: {
  folding: boolean;
  folded: boolean;
  youId?: string;
  highlightYou?: boolean;
}) {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <div className="graph-wrap" aria-label="UAE SME obligation graph">
      <svg viewBox="0 0 960 520" role="img">
        {DEMO_OBLIGATIONS.map((o, idx) => {
          const a = positions[o.debtorId];
          const b = positions[o.creditorId];
          if (!a || !b) return null;
          const involvesYou = o.debtorId === youId || o.creditorId === youId;
          const midX = (a.x + b.x) / 2 + ((idx % 5) - 2) * 6;
          const midY = (a.y + b.y) / 2 + ((idx % 3) - 1) * 8;
          return (
            <m.path
              key={o.invoiceId}
              d={`M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`}
              fill="none"
              stroke={involvesYou ? "#c45c26" : currencyColor(o.invoiceCurrency)}
              strokeWidth={involvesYou && !folded ? 2.4 : folded ? 0.6 : 1.4}
              strokeOpacity={folded ? 0.12 : involvesYou ? 0.85 : 0.4}
              initial={false}
              animate={
                folding
                  ? { pathLength: [1, 0.05], opacity: [0.55, 0.1] }
                  : folded
                    ? { pathLength: 0.08, opacity: 0.12 }
                    : { pathLength: 1, opacity: involvesYou ? 0.85 : 0.4 }
              }
              transition={{
                duration: reducedMotion ? 0.01 : 0.45,
                delay: reducedMotion ? 0 : (idx % 10) * 0.02,
              }}
            />
          );
        })}

        {DEMO_COMPANIES.map((c, i) => {
          const p = positions[c.id];
          const isYou = highlightYou && c.id === youId;
          return (
            <g key={c.id}>
              {isYou && (
                <m.circle
                  cx={p.x}
                  cy={p.y}
                  r={34}
                  fill="none"
                  stroke="#c45c26"
                  strokeWidth={2}
                  strokeOpacity={0.45}
                  initial={reducedMotion ? false : { opacity: 0, transform: "scale(0.7)" }}
                  animate={
                    reducedMotion
                      ? { opacity: 1, transform: "scale(1)" }
                      : { opacity: 1, transform: ["scale(1)", "scale(1.08)", "scale(1)"] }
                  }
                  transition={
                    reducedMotion
                      ? { duration: 0.01 }
                      : { duration: 2.2, repeat: Infinity }
                  }
                />
              )}
              <m.circle
                cx={p.x}
                cy={p.y}
                r={isYou ? 26 : folded ? 18 : 22}
                fill={isYou ? "#c45c26" : "#f7f4ef"}
                stroke={isYou ? "#9a4215" : "#0b4f56"}
                strokeWidth={2}
                initial={reducedMotion ? false : { opacity: 0, transform: "scale(0.8)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                transition={{
                  delay: reducedMotion ? 0 : i * 0.05,
                  type: reducedMotion ? "tween" : "spring",
                  stiffness: 120,
                  duration: reducedMotion ? 0.01 : undefined,
                }}
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontFamily="Syne, sans-serif"
                fontWeight={700}
                fontSize="12"
                fill={isYou ? "#fff8f2" : "#07363c"}
              >
                {isYou ? "YOU" : c.id}
              </text>
              <text
                x={p.x}
                y={p.y + (isYou ? 42 : 36)}
                textAnchor="middle"
                fontFamily="IBM Plex Sans, sans-serif"
                fontSize="11"
                fill={isYou ? "#9a4215" : "#3a5458"}
              >
                {isYou ? c.name : c.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
