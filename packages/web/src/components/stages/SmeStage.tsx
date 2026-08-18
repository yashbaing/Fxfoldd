import { m } from "framer-motion";
import { formatUsd } from "@fxfold/solver";
import type { SmeView } from "@fxfold/solver";

type SmeStageProps = {
  reducedMotion: boolean;
  sme: SmeView;
  short: string;
  address?: string;
  isWriting: boolean;
  statusNote: string;
  error: string;
  onJoin: () => void;
};

export function SmeStage({
  reducedMotion,
  sme,
  short,
  address,
  isWriting,
  statusNote,
  error,
  onJoin,
}: SmeStageProps) {
  return (
    <m.section
      key="sme"
      className="panel"
      initial={reducedMotion ? false : { opacity: 0, transform: "translateY(12px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
    >
      <div className="kicker">Connected as SME · not admin</div>
      <h2 className="h-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
        {sme.company.name}
      </h2>
      <p className="hero-sub">
        {sme.company.city} · {sme.company.sector}
        {address ? ` · ${short}` : " · connect wallet to continue"}
      </p>

      <div className="result-grid">
        <div className="stat-block">
          <div className="label">You need to pay</div>
          <div className="value">{formatUsd(sme.grossPayUsd)}</div>
          <div className="tagline">{sme.payableCount} invoices</div>
        </div>
        <div className="stat-block">
          <div className="label">You are owed</div>
          <div className="value">{formatUsd(sme.grossReceiveUsd)}</div>
          <div className="tagline">{sme.receivableCount} invoices</div>
        </div>
      </div>

      <ul className="list-quiet">
        {sme.byCurrency.map((b) => (
          <li key={b.currency}>
            <span>{b.currency} exposure</span>
            <strong>
              pay {b.pay.toLocaleString()} / receive {b.receive.toLocaleString()}
            </strong>
          </li>
        ))}
      </ul>

      <ul className="list-quiet">
        {sme.invoices.map((inv) => (
          <li key={inv.invoiceId}>
            <span>
              <strong>{inv.direction === "pay" ? "Pay" : "Receive"}</strong> {inv.invoiceId} ·{" "}
              {inv.counterpartyName}
            </span>
            <strong>
              {inv.amount.toLocaleString()} {inv.invoiceCurrency}
            </strong>
          </li>
        ))}
      </ul>

      <div className="cta-row" style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-primary" onClick={onJoin} disabled={isWriting}>
          {isWriting ? "Confirm in wallet…" : "Join Clearing Round"}
        </button>
        <span className="tagline">7 other SMEs are already pre-authorized</span>
      </div>
      {statusNote && <p className="tagline">{statusNote}</p>}
      {error && <p className="badge-demo">{error}</p>}
    </m.section>
  );
}
