# QuantStorm 2026 — OracleEdge (submission)

Submit **`my_bot.py`** (repo root) to the Divided Oracle tournament.

## Local check (official harness)

```bash
cd quantstorm
python3 backtester.py --validate ../my_bot.py
python3 backtester.py --bot1 ../my_bot.py --bot2 strategies/adaptive_bidder.py --n_deals 30 --isolate
```

## What changed vs the prior OracleEdge (~84 / 30 matches)

- **TE economy**: contest shift powers (TRICK_ROOM / STEALTH_ROCK ~9 TE) without paying full AdaptiveBidder shade×fair.
- **Pricing**: min-variance FORESIGHT + quote fusion, FORESIGHT-contamination inversion, spoof defense.
- **Quoting**: floor width + even-parity lattice alignment.
- **Negotiation**: thin accept edge, directional squeeze, turn-6 3-way argmax.

Local field mean ≈ **+300 PnL / match** (mirrored 30+30 deals) against AdaptiveBidder / Rational / NaiveEV / Apex-style lean bots / speczero — well above a 600 total over a 30-match round-robin of mixed opponents.
