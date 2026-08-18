# Name: YASH
# College: IITM
# Roll Number: 23f3000278

"""
my_bot.py — OracleEdge v2: Championship Divided Oracle strategy
===============================================================

Design goals vs the original OracleEdge (~+3/deal vs AdaptiveBidder):

1. TE ECONOMY — contest shift powers (TRICK_ROOM / STEALTH_ROCK ≈9 TE) so
   opponents cannot farm Turn-6 forced fills, while still bidding below
   AdaptiveBidder's shade×fair so salvage remains positive. Snipe when
   te_theirs is drained; let RAW_SNIPER opponents burn R1–R2 alone.

2. PRICING — min-variance fusion of FORESIGHT samples and honest opening
   quotes, with FORESIGHT-contamination inversion (quote_mid − k_mine when
   the Maker held FORESIGHT). Spoof defense: discard quote anchors that are
   implausibly compressed relative to our private signal.

3. QUOTING — always open at final_cap (zero width premium) with even-parity
   lattice alignment so more reachable even S values sit inside the window.

4. NEGOTIATION — accept on a thin absolute edge (SUBSTITUTE lowers it),
   directional boundary squeeze when countering, turn-5 anti-shift defense,
   and exact turn-6 3-way argmax (buy / sell / force).

5. TRANSFORM — fire from a flat hand; otherwise decline (denial by consuming).
"""

from __future__ import annotations


# Calibrated tick surface (from adaptive_bidder.py — reusable per rulebook).
_POWER_VALUES = {
    "FORESIGHT":    {1: 0.76, 2: 1.16, 3: 1.48, 4: 1.97, 5: 2.02},
    "TRICK_ROOM":   {1: 1.14, 2: 0.40, 3: 0.40, 4: 0.60, 5: 0.52},
    "SUBSTITUTE":   {1: 1.46, 2: 1.15, 3: 0.95, 4: 0.57, 5: 0.29},
    "STEALTH_ROCK": {1: 1.51, 2: 0.75, 3: 0.75, 4: 0.75, 5: 0.00},
    "TRANSFORM":    {1: 1.58, 2: 1.24, 3: 1.31, 4: 0.00, 5: 0.00},
}

# Lean-but-contested TE bids. Too lean (1–5) loses TRICK_ROOM / STEALTH_ROCK
# to moderate bidders, who then farm Turn-6 forced fills (+shift − fee).
# These sit just under AdaptiveBidder's shade*fair while beating paced soft-caps.
_LEAN_TE = {
    "FORESIGHT": 2,
    "TRICK_ROOM": 9,
    "SUBSTITUTE": 7,
    "STEALTH_ROCK": 9,
    "TRANSFORM": 3,
}

_FLAT_SELF = 2
_FLAT_OPP = 1
_ACCEPT_EDGE = 0.25
_ACCEPT_EDGE_SUB = -0.10
_SNIPE_TE = 3
_SPOOF_RATIO = 0.35  # |quote_mid| < ratio * |k_mine| → treat as toxic


class Bot:
    name = "OracleEdge"

    def reset(self, seat: int, config, seed: int) -> None:
        self.seat = seat
        self.config = config
        self._quote_mids: dict[int, tuple[int, float]] = {}
        self._k_theirs: float = 0.0
        self._is_sniper: bool = False
        self._opp_regime: str = "UNKNOWN"

    # ── opponent reads ────────────────────────────────────────────────────

    def _fingerprint(self, obs) -> None:
        opp = 1 - self.seat
        if obs.auction_log and not self._is_sniper:
            costs = [e["cost"] for e in obs.auction_log if e.get("seat") == opp]
            if costs and max(costs) >= 12:
                self._is_sniper = True
                self._opp_regime = "RAW_SNIPER"

        r = obs.round
        if r >= 2:
            if obs.te_theirs == self.config.TE_BUDGET:
                self._opp_regime = "TE_HOARDER"
            elif obs.te_theirs <= 6 and not self._is_sniper:
                self._opp_regime = "RAW_SNIPER"

        if "TRICK_ROOM" in obs.powers_theirs or "STEALTH_ROCK" in obs.powers_theirs:
            if self._opp_regime not in ("RAW_SNIPER", "TE_HOARDER"):
                self._opp_regime = "SHIFT_CAMPER"

    def _latch_quotes(self, obs, current_quote=None) -> None:
        opp = 1 - self.seat
        for c in obs.contracts:
            if c.round not in self._quote_mids:
                mid = (c.open_bid + c.open_ask) / 2.0
                self._quote_mids[c.round] = (c.maker_seat, mid)

        if (
            not obs.is_maker
            and current_quote is not None
            and obs.round not in self._quote_mids
        ):
            mid = (current_quote[0] + current_quote[1]) / 2.0
            self._quote_mids[obs.round] = (opp, mid)

    def _opp_had_foresight(self, obs, r: int) -> bool:
        opp = 1 - self.seat
        return any(
            e.get("round") == r
            and e.get("seat") == opp
            and e.get("power") == "FORESIGHT"
            for e in obs.auction_log
        )

    def _quote_derived_k(self, obs) -> float | None:
        """Best estimate of k_theirs from an opponent opening quote."""
        opp = 1 - self.seat
        r = obs.round

        # Prefer this round's opponent opening quote; else earlier rounds.
        mid = None
        used_r = None
        if r in self._quote_mids and self._quote_mids[r][0] == opp:
            mid = self._quote_mids[r][1]
            used_r = r
        else:
            for rr in range(r - 1, 0, -1):
                if rr in self._quote_mids and self._quote_mids[rr][0] == opp:
                    mid = self._quote_mids[rr][1]
                    used_r = rr
                    break
        if mid is None or used_r is None:
            return None

        # Spoof defense: compressed mid vs strong private hand → ignore.
        if abs(obs.k_mine) >= 8 and abs(mid) < _SPOOF_RATIO * abs(obs.k_mine):
            return None

        if self._opp_had_foresight(obs, used_r):
            # Their mid ≈ k_theirs + sample(our revealed). Undo our known sum.
            # Scale our k to the round the quote came from.
            my_at_rr = obs.k_mine  # revealed sum only grows; approx OK
            # Prefer contracts' contemporaneous knowledge: for current round exact.
            if used_r == r:
                return mid - float(obs.k_mine)
            return mid - float(my_at_rr) * (used_r / max(r, 1))

        # Honest Maker without FORESIGHT centres on their own revealed sum.
        return float(mid)

    def _estimate_opp_k(self, obs, current_quote=None) -> float:
        self._fingerprint(obs)
        self._latch_quotes(obs, current_quote)

        r = obs.round
        n_rev = 4 * r
        n_leak = len(obs.foresight) if obs.foresight else 0
        fs = sum(obs.foresight) if obs.foresight else 0

        quote_k = self._quote_derived_k(obs)

        if n_leak >= n_rev and n_leak > 0:
            k = float(fs)  # exact in R1–R4
        elif n_leak > 0:
            scaled = float(fs) * (n_rev / n_leak)
            # Min-variance blend: foresight weight ≈ n_leak / n_rev
            w_f = n_leak / n_rev
            if quote_k is not None:
                k = w_f * scaled + (1.0 - w_f) * quote_k
            else:
                k = scaled
        elif quote_k is not None:
            k = quote_k
        else:
            k = 0.0

        cap = float(n_rev)
        self._k_theirs = max(-cap, min(cap, k))
        return self._k_theirs

    def _estimate_S(self, obs, quote=None) -> float:
        return float(obs.k_mine) + self._estimate_opp_k(obs, quote)

    # ── auction ───────────────────────────────────────────────────────────

    def _power_ticks(self, obs, name: str) -> float:
        r = obs.round
        if name == "TRANSFORM":
            if abs(obs.k_mine) <= _FLAT_SELF:
                return _POWER_VALUES["TRANSFORM"].get(r, 0.0)
            # Cheap denial only when opponent looks flat.
            opp = self._k_theirs
            if abs(opp) <= _FLAT_OPP:
                return _POWER_VALUES["TRANSFORM"].get(r, 0.0) * 0.35
            return 0.0
        return _POWER_VALUES.get(name, {}).get(r, 0.5)

    def bid(self, obs, offered: list[str]) -> dict[str, int]:
        if not offered or obs.te_mine <= 0:
            return {}

        self._fingerprint(obs)
        # Let RAW_SNIPER burn the early budget; we harvest salvage.
        if self._is_sniper and obs.round <= 2 and obs.te_theirs >= 12:
            return {}

        out: dict[str, int] = {}
        left = obs.te_mine
        te_opp = obs.te_theirs
        salvage = self.config.TE_SALVAGE

        for name in offered:
            v = self._power_ticks(obs, name)
            if v <= 0.0:
                continue
            fair_te = v / salvage

            if te_opp <= _SNIPE_TE:
                amt = min(te_opp + 1, left, max(1, int(fair_te)))
            elif te_opp <= 4 and fair_te >= 10:
                amt = min(te_opp + 1, left, int(fair_te))
            else:
                lean = _LEAN_TE.get(name, 1)
                # Contested late FORESIGHT: info edge is largest in R4–R5.
                if name == "FORESIGHT" and obs.round >= 4 and te_opp >= 8:
                    lean = max(lean, 4)
                # Early STEALTH_ROCK is the highest-EV persistent shift — pay up.
                if name == "STEALTH_ROCK" and obs.round == 1 and te_opp >= 6:
                    lean = max(lean, 11)
                if name == "TRANSFORM" and abs(obs.k_mine) > _FLAT_SELF:
                    lean = 1  # pure denial stub
                # Never outbid fair shaded value (keep surplus vs Adaptive).
                shaded = max(1, int(fair_te * 0.62))
                lean = min(lean, shaded)
                amt = min(lean, left)

            amt = max(0, min(int(amt), left))
            if amt > 0:
                out[name] = amt
                left -= amt

        return out

    # ── negotiation ───────────────────────────────────────────────────────

    def _shift(self, obs) -> tuple[int, int]:
        mine = sum(
            int(self.config.POWERS[p]["magnitude"])
            for p in ("TRICK_ROOM", "STEALTH_ROCK")
            if p in obs.powers_mine
        )
        theirs = sum(
            int(self.config.POWERS[p]["magnitude"])
            for p in ("TRICK_ROOM", "STEALTH_ROCK")
            if p in obs.powers_theirs
        )
        return mine, theirs

    def quote(self, obs) -> tuple[int, int]:
        ev = self._estimate_S(obs)
        w = obs.final_cap
        centre = round(ev)
        lo = centre - (w // 2)

        # Align the window onto the even lattice of reachable S values.
        # Residual after known coins is always even when m_unseen is even
        # (every shipped round), so a ±1 nudge changes coverage at no cost.
        if (lo % 2) != 0:
            # Nudge toward the side that keeps the centre closer to EV.
            if ev >= (lo + w / 2.0):
                lo += 1
            else:
                lo -= 1

        return (lo, lo + w)

    def respond(self, obs, quote: tuple[int, int], turn: int):
        bid, ask = quote
        ev = self._estimate_S(obs, quote)
        edge_buy = ev - ask
        edge_sell = bid - ev

        thresh = _ACCEPT_EDGE_SUB if "SUBSTITUTE" in obs.powers_mine else _ACCEPT_EDGE
        spread = ask - bid
        my_shift, opp_shift = self._shift(obs)
        is_final = turn == self.config.N_TURNS

        if not is_final:
            if edge_buy >= thresh and edge_buy >= edge_sell:
                return "ACCEPT_BUY"
            if edge_sell >= thresh:
                return "ACCEPT_SELL"

            w_new = max(obs.final_cap, spread - self.config.MIN_REDUCTION)
            w_new = min(w_new, spread)
            mid = (bid + ask) / 2.0

            if ev > mid:
                new_bid, new_ask = bid, min(ask, bid + w_new)
            elif ev < mid:
                new_ask, new_bid = ask, max(bid, ask - w_new)
            else:
                target = round(ev - w_new / 2.0)
                new_bid = max(bid, min(target, ask - w_new))
                new_ask = new_bid + w_new

            # Turn-5 Maker: give yourself room against an opponent shift camp.
            if turn == 5 and obs.is_maker and opp_shift > my_shift:
                diff = opp_shift - my_shift
                new_bid = max(bid, new_bid - diff)
                new_ask = new_bid + w_new

            return ("COUNTER", new_bid, new_ask)

        # Turn 6: exact 3-way comparison (forcer is SHORT at mid+shift).
        net = my_shift - opp_shift
        fill = (bid + ask) // 2 + net
        force_pnl = (fill - ev) - self.config.FORCED_FILL_FEE

        if force_pnl > edge_buy and force_pnl > edge_sell:
            w_new = max(obs.final_cap, spread - self.config.MIN_REDUCTION)
            w_new = min(w_new, spread)
            target = round(ev - w_new / 2.0)
            new_bid = max(bid, min(target, ask - w_new))
            return ("COUNTER", new_bid, new_bid + w_new)
        if edge_buy >= edge_sell:
            return "ACCEPT_BUY"
        return "ACCEPT_SELL"

    def use_transform(self, obs) -> bool:
        if abs(obs.k_mine) > _FLAT_SELF:
            return False
        opp = self._estimate_opp_k(obs)
        return abs(opp) >= _FLAT_OPP or abs(obs.k_mine) <= 1
