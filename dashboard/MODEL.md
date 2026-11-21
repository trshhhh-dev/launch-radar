# Token Radar — model radar-3.1

Snapshot 2026-11-14 · sealed DefiLlama protocol index · watchlist floor $50M. All numbers below are recomputed at run time from `radar.validation`, `radar.stats` and `radar.model` in `data.js`.

## Formula

```
launch  = TVL × peer × size × momentum × tenure × reach
implied = launch × odds × share
        = TVL × peer × size × momentum × tenure × reach × odds × share
```

- **peer** — category median mcap/TVL at $100M TVL, shrunk toward the market; thin categories borrow their peer family, then the whole snapshot.
- **size** — `(TVL / $100M) ^ −(1 − slope)`; the slope is fitted by OLS on log(mcap) vs log(TVL) over token-bearing, non-excluded protocols.
- **momentum** — `1 + clamp(change_7d, −40, +80) / 100 × 0.25`.
- **tenure** — `0.60 + min(age_days, 1460) / 1460 × 0.40`; unknown age uses 0.68.
- **reach** — `1 + (min(chains, 6) − 1) × 0.02`.
- **odds** — the group's share of protocols already recording a token, reduced for age without one and lifted slightly by positive 7d change, clamped to [0.05, 0.95].
- **share** — shrunk median of `mcap / (mcap + TVL)` in the comparable group, clamped to [0.05, 0.95].

The board carries every factor per row; the detail view recomputes both launch and implied from those fields and checks them against `board.json`. Ranking is by `implied_value_usd` only, never by verdict.

## Blind tests of the fitted size curve

| test | curve log error | flat log error | Spearman curve / flat |
| --- | ---: | ---: | ---: |
| walk-forward (n=92, train 49, test 43) | 1.3914 | 1.7182 | 0.312 / 0.312 |
| leave-one-category-out (5 categories, 50 rows) | 1.2847 | 1.4153 | 0.5357 / 0.5357 |

The curve is kept only when it matches or beats a flat median mcap/TVL baseline on both held-out tests. Fitted slope 0.394, size tilt 0.606. No test uses a future-fitted parameter.

## Verdict rule

FARM if `odds ≥ 0.50` **and** implied is at or above the board median (`percentile ≥ 0.50`). SKIP if `odds ≤ 0.20` **or** implied is in the bottom quartile (`percentile ≤ 0.25`). THIN otherwise. Current board: **50 FARM / 89 THIN / 59 SKIP**; all 40 watchlist rows are ranked alongside 158 early rows, with 128 live comparables kept out of the rank. The plan's $50–$500 capital is never an input to a verdict: implied/capital is in the thousands for every row.

## What is not claimed

Not a price, not a promise that a token will be issued, and not a backtest of farm returns. "Records no token" never means "has none"; TVL can leave, contracts can fail, comparable sets can be thin. Farm steps are a costed, timed checklist from the protocol's own category, chains, TVL and age — not a guarantee of an airdrop.
