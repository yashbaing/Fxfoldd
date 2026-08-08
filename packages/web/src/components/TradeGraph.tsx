import { motion } from "framer-motion";
import { DEMO_COMPANIES, DEMO_OBLIGATIONS } from "@fxfold/solver";

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
}: {
  folding: boolean;
  folded: boolean;
}) {
  return (
    <div className="graph-wrap" aria-label="UAE SME obligation graph">
      <svg viewBox="0 0 960 520" role="img">
        <defs>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {DEMO_OBLIGATIONS.map((o, idx) => {
          const a = positions[o.debtorId];
          const b = positions[o.creditorId];
          if (!a || !b) return null;
          const midX = (a.x + b.x) / 2 + ((idx % 5) - 2) * 6;
          const midY = (a.y + b.y) / 2 + ((idx % 3) - 1) * 8;
          return (
            <motion.path
              key={o.invoiceId}
              d={`M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`}
              fill="none"
              stroke={currencyColor(o.invoiceCurrency)}
              strokeWidth={folded ? 0.6 : 1.6}
              strokeOpacity={folded ? 0.15 : 0.55}
              initial={false}
              animate={
                folding
                  ? { pathLength: [1, 0.05], opacity: [0.55, 0.1] }
                  : folded
                    ? { pathLength: 0.08, opacity: 0.12 }
                    : { pathLength: 1, opacity: 0.55 }
              }
              transition={{ duration: 1.1, delay: (idx % 10) * 0.03 }}
            />
          );
        })}

        {DEMO_COMPANIES.map((c, i) => {
          const p = positions[c.id];
          return (
            <g key={c.id}>
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={folded ? 18 : 22}
                fill="#f7f4ef"
                stroke="#0b4f56"
                strokeWidth={2}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 120 }}
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontFamily="Syne, sans-serif"
                fontWeight={700}
                fontSize="12"
                fill="#07363c"
              >
                {c.id}
              </text>
              <text
                x={p.x}
                y={p.y + 36}
                textAnchor="middle"
                fontFamily="IBM Plex Sans, sans-serif"
                fontSize="11"
                fill="#3a5458"
              >
                {c.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
