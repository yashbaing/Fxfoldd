# Name: YASH
# College: IITM
# Roll Number: 23f3000278

"""
my_bot.py — OracleEdge Grandmaster (QuantStorm 2026)
======================================================

Hybrid of three proven axes:

1. PRICING — variance-aware Bayesian fusion with FORESIGHT inversion
   (OracleEdge) plus min-variance quote blending (ApexQuant).

2. AUCTION — ultra-lean TE economy with starvation snipes and sniper
   regime detection (my_bot_v2 / ApexQuant).

3. NEGOTIATION — floor-width Maker quotes, directional compression
   spoof in R4-R5 (ToxicSpoofer), Turn-6 minimax with shift powers,
   and quote-immune Taker mode when the opening spread is at floor.
"""

_POWER_VALUES = {
    "FORESIGHT":    {1: 0.76, 2: 1.16, 3: 1.48, 4: 1.97, 5: 2.02},
    "TRICK_ROOM":   {1: 1.14, 2: 0.40, 3: 0.40, 4: 0.60, 5: 0.52},
    "SUBSTITUTE":   {1: 1.46, 2: 1.15, 3: 0.95, 4: 0.57, 5: 0.29},
    "STEALTH_ROCK": {1: 1.51, 2: 0.75, 3: 0.75, 4: 0.75, 5: 0.00},
    "TRANSFORM":    {1: 1.58, 2: 1.24, 3: 1.31, 4: 0.00, 5: 0.00},
}

_SHADE = 0.65
_FLAT_SELF = 2
_FLAT_OPP = 3
_DENIAL_WEIGHT = 0.55

# Directional quote compression when Maker with a strong private hand.
_SPOOF = {
    4: (12, 0.40),
    5: (16, 0.30),
}


class Bot:
    name = "OracleEdge"

    def reset(self, seat: int, config, seed: int) -> None:
        self.seat = seat
        self.config = config
        self._quote_mid: dict[int, tuple[int, float]] = {}
        self._k_theirs_est = 0.0
        self._opp_regime = "UNKNOWN"
        self._is_sniper = False

    # ------------------------------------------------------------------
    # Opponent fingerprinting
    # ------------------------------------------------------------------

    def _fingerprint(self, obs) -> None:
        opp = 1 - self.seat
        if not self._is_sniper and obs.auction_log:
            costs = [e["cost"] for e in obs.auction_log if e.get("seat") == opp]
            if costs and max(costs) >= 12:
                self._is_sniper = True
                self._opp_regime = "RAW_SNIPER"
                return

        r = obs.round
        if r >= 2:
            if obs.te_theirs == self.config.TE_BUDGET:
                self._opp_regime = "TE_HOARDER"
            elif obs.te_theirs <= 6:
                self._opp_regime = "RAW_SNIPER"

        if "TRICK_ROOM" in obs.powers_theirs or "STEALTH_ROCK" in obs.powers_theirs:
            if self._opp_regime not in ("RAW_SNIPER", "TE_HOARDER"):
                self._opp_regime = "SHIFT_CAMPER"

    def _opp_had_foresight(self, obs, r: int | None = None) -> bool:
        r = obs.round if r is None else r
        opp = 1 - self.seat
        return any(
            e.get("round") == r and e.get("seat") == opp and e.get("power") == "FORESIGHT"
            for e in obs.auction_log
        )

    def _latch_quote(self, obs, quote: tuple[int, int] | None = None) -> None:
        r = obs.round
        opp = 1 - self.seat
        for c in obs.contracts:
            if c.round not in self._quote_mid:
                self._quote_mid[c.round] = (c.maker_seat, (c.open_bid + c.open_ask) * 0.5)
        if not obs.is_maker and quote is not None and r not in self._quote_mid:
            self._quote_mid[r] = (opp, (quote[0] + quote[1]) * 0.5)

    def _quote_read(self, obs, r: int | None = None) -> float | None:
        r = obs.round if r is None else r
        opp = 1 - self.seat
        if r in self._quote_mid and self._quote_mid[r][0] == opp:
            return self._quote_mid[r][1]
        for rr in range(r - 1, 0, -1):
            if rr in self._quote_mid and self._quote_mid[rr][0] == opp:
                return self._quote_mid[rr][1]
        return None

    # ------------------------------------------------------------------
    # Estimation
    # ------------------------------------------------------------------

    def _estimate_opp_k(self, obs, quote: tuple[int, int] | None = None, *, trust_quote: bool = True) -> float:
        self._fingerprint(obs)
        self._latch_quote(obs, quote)
        r = obs.round
        n_rev = 4 * r
        n_leak = len(obs.foresight) if obs.foresight else 0
        leak_sum = float(sum(obs.foresight)) if n_leak else None

        quote_mid = self._quote_read(obs) if trust_quote else None
        if quote_mid is not None and self._opp_had_foresight(obs, r):
            # Maker with FORESIGHT centres on k_theirs + sample(mine); invert.
            quote_mid = quote_mid - float(obs.k_mine)

        if n_leak >= n_rev and n_leak > 0:
            k = leak_sum
        elif n_leak > 0:
            scaled = leak_sum * (n_rev / n_leak)
            if quote_mid is not None:
                w_f = n_leak / n_rev
                k = w_f * scaled + (1.0 - w_f) * quote_mid
            else:
                k = scaled
        elif quote_mid is not None:
            k = quote_mid
        else:
            k = 0.0

        bound = float(n_rev)
        self._k_theirs_est = max(-bound, min(bound, k))
        return self._k_theirs_est

    def _estimate_S(self, obs, quote: tuple[int, int] | None = None, *, trust_quote: bool = True) -> float:
        return float(obs.k_mine) + self._estimate_opp_k(obs, quote, trust_quote=trust_quote)

    def _power_value(self, name: str, r: int) -> float:
        return _POWER_VALUES.get(name, {}).get(r, 0.5)

    def _transform_value(self, obs) -> float:
        swap = self._power_value("TRANSFORM", obs.round)
        if abs(obs.k_mine) <= _FLAT_SELF:
            return swap
        self._estimate_opp_k(obs, trust_quote=True)
        if abs(self._k_theirs_est) <= _FLAT_OPP:
            return swap * _DENIAL_WEIGHT
        return 0.0

    # ------------------------------------------------------------------
    # Auction
    # ------------------------------------------------------------------

    def bid(self, obs, offered: list[str]) -> dict[str, int]:
        if not offered or obs.te_mine <= 0:
            return {}

        self._estimate_opp_k(obs)
        r = obs.round
        te_opp = obs.te_theirs
        remaining = obs.te_mine
        out: dict[str, int] = {}

        if self._is_sniper and r <= 2 and te_opp >= 12:
            return {}

        for name in offered:
            v = self._transform_value(obs) if name == "TRANSFORM" else self._power_value(name, r)
            if v <= 0:
                continue

            fair_te = int(v / self.config.TE_SALVAGE)

            if te_opp <= 2:
                amt = min(te_opp + 1, remaining, fair_te)
            elif self._opp_regime == "RAW_SNIPER" and r <= 2:
                amt = 0
            elif name == "FORESIGHT":
                amt = min(3 if te_opp > 2 else te_opp + 1, remaining, fair_te)
            elif name in ("TRICK_ROOM", "STEALTH_ROCK", "SUBSTITUTE"):
                amt = min(2 if te_opp > 2 else te_opp + 1, remaining, fair_te)
            elif name == "TRANSFORM":
                amt = min(3 if te_opp > 2 else te_opp + 1, remaining, fair_te)
            else:
                amt = min(int(fair_te * _SHADE), remaining)

            amt = max(0, min(amt, remaining))
            if amt > 0:
                out[name] = amt

        return out

    # ------------------------------------------------------------------
    # Negotiation — Maker
    # ------------------------------------------------------------------

    def quote(self, obs) -> tuple[int, int]:
        r = obs.round
        w = obs.final_cap
        k = obs.k_mine
        spoof = _SPOOF.get(r)

        if spoof is not None and abs(k) >= spoof[0]:
            frac = spoof[1]
            center = round(k * frac)
            if k > 0:
                center = max(center, w + 1)
            else:
                center = min(center, -(w + 1))
            lo = center - (w // 2)
        else:
            ev = self._estimate_S(obs, trust_quote=True)
            center = round(ev)
            lo = center - (w // 2)
            if lo % 2:
                lo += 1 if ev >= center else -1

        return (lo, lo + w)

    # ------------------------------------------------------------------
    # Negotiation — Taker
    # ------------------------------------------------------------------

    def _shift_net(self, obs) -> int:
        mags = {"TRICK_ROOM": 3, "STEALTH_ROCK": 2}
        mine = sum(mags[p] for p in obs.powers_mine if p in mags)
        theirs = sum(mags[p] for p in obs.powers_theirs if p in mags)
        return mine - theirs

    def respond(self, obs, quote: tuple[int, int], turn: int):
        bid, ask = quote
        spread = ask - bid
        at_floor = spread <= obs.final_cap

        trust_quote = not at_floor
        ev = self._estimate_S(obs, quote, trust_quote=trust_quote)

        edge_buy = ev - ask
        edge_sell = bid - ev
        thresh = 0.1
        if "SUBSTITUTE" in obs.powers_mine:
            thresh = -1.0

        my_shift = sum(
            int(self.config.POWERS[p]["magnitude"])
            for p in ("TRICK_ROOM", "STEALTH_ROCK")
            if p in obs.powers_mine
        )
        opp_shift = sum(
            int(self.config.POWERS[p]["magnitude"])
            for p in ("TRICK_ROOM", "STEALTH_ROCK")
            if p in obs.powers_theirs
        )

        if turn != self.config.N_TURNS:
            if edge_buy > thresh and edge_buy >= edge_sell:
                return "ACCEPT_BUY"
            if edge_sell > thresh:
                return "ACCEPT_SELL"

            w_new = max(obs.final_cap, spread - self.config.MIN_REDUCTION)
            w_new = min(w_new, spread)
            mid = (bid + ask) * 0.5
            if ev > mid:
                new_bid, new_ask = bid, min(ask, bid + w_new)
            elif ev < mid:
                new_bid, new_ask = max(bid, ask - w_new), ask
            else:
                center = max(bid, min(round(ev), ask - w_new))
                new_bid, new_ask = center, center + w_new

            if turn == 5 and obs.is_maker and opp_shift > my_shift:
                shift_diff = opp_shift - my_shift
                new_bid = max(bid, new_bid - shift_diff)
                new_ask = new_bid + w_new

            return ("COUNTER", new_bid, new_ask)

        # Turn 6: exact three-way comparison
        net_shift = self._shift_net(obs)
        fill_if_counter = (bid + ask) // 2 + net_shift
        forced_pnl = (fill_if_counter - ev) - self.config.FORCED_FILL_FEE
        best_accept = max(edge_buy, edge_sell)

        w_new = max(obs.final_cap, spread - self.config.MIN_REDUCTION)
        if w_new < spread:
            if w_new & 1:
                w_new = max(obs.final_cap, w_new - 1)
            center = max(bid, min(round(ev), ask - w_new))
            if forced_pnl > best_accept:
                return ("COUNTER", center, center + w_new)

        return "ACCEPT_BUY" if edge_buy >= edge_sell else "ACCEPT_SELL"

    def use_transform(self, obs) -> bool:
        self._estimate_opp_k(obs)
        if abs(obs.k_mine) <= _FLAT_SELF:
            return abs(self._k_theirs_est) >= _FLAT_OPP
        return False
