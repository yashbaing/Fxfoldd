import { useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { DEMO_SMES } from '@fxfold/solver';
import type { TradeObligation } from '@fxfold/solver';

interface Props {
  obligations: TradeObligation[];
  faded?: boolean;
}

export function TradeGraph({ obligations, faded = false }: Props) {
  const graphData = useMemo(() => {
    const nodes = DEMO_SMES.map((sme) => ({
      id: sme.address,
      name: sme.id,
      label: sme.name,
      val: 8,
    }));

    const links = obligations.map((o) => ({
      source: o.debtor,
      target: o.creditor,
      amount: o.amount,
      currency: o.invoiceCurrency,
      settlement: o.settlementCurrency,
    }));

    return { nodes, links };
  }, [obligations]);

  return (
    <div className="graph-container" style={{ opacity: faded ? 0.45 : 1, transition: 'opacity 0.8s' }}>
      <ForceGraph2D
        graphData={graphData}
        nodeLabel={(n: { label: string; name: string }) => `${n.name}: ${n.label}`}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as { x?: number; y?: number; name: string };
          const label = n.name;
          const fontSize = 14 / globalScale;
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, 10, 0, 2 * Math.PI);
          ctx.fillStyle = '#2563eb';
          ctx.fill();
          ctx.font = `${fontSize}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#e8edf7';
          ctx.fillText(label, n.x ?? 0, (n.y ?? 0) + 18);
        }}
        linkColor={() => (faded ? 'rgba(139,156,199,0.2)' : 'rgba(59,130,246,0.5)')}
        linkWidth={(link: { amount: number }) => Math.max(1, Math.log10(link.amount) - 2)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        backgroundColor="#0a1020"
        cooldownTicks={80}
      />
    </div>
  );
}
