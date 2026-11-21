# Token Radar — radar-2.1 value model

Snapshot **2026-11-14** · DefiLlama protocol index (758 records ≥ $5M TVL) · watchlist floor **$50,000,000**.

## What is ranked

The board ranks records with no market cap, CoinGecko id or symbol. It carries all **40** watchlist slugs and adds **158** early rows outside the watchlist, for **198** ranked rows. **138** of those 158 are below the $50M TVL floor; the other **20** are above it. "Below the floor" is a TVL test; "outside the watchlist" is a membership test — not the same set. Token-bearing protocols are never ranked: **128** with a usable market cap appear apart as live comparables. A further **144** pre-token records are set aside as exchange, bridge, liquid-staking, versioned, wrapped or staked products.

## The function

`deriveValue` in `lib/model.ts` scores every row from the snapshot's own figures only:

```
implied = TVL × peer multiple × size tilt × momentum × tenure × reach
```

- **Peer multiple** — median mcap/TVL of token-bearing protocols in the same category, normalised to $100M TVL, shrunk toward the snapshot median with 6 pseudo-observations. Fewer than 3 comparables borrow the peer family; a thin family borrows the whole market.
- **Size tilt** — `(TVL / $100M) ^ -0.28`; a within-category log-log fit puts the raw market slope near 0.64, damped so size informs the rank without burying a large protocol.
- **Momentum** — `1 + clamp(change_7d, -40, 80) / 100 × 0.25`; one hot week cannot carry a row.
- **Tenure** — `0.60 + min(age_days, 1460) / 1460 × 0.40`; unknown age uses 0.68.
- **Reach** — `1 + (min(chains, 6) - 1) × 0.02`.

The result is rounded to a whole dollar and floored at $1. Every board row carries its multipliers; the detail view recomputes the product from the row's own fields and checks it against `board.json`.

## Farm plans

`farmPlan` writes eight steps per protocol. Category chooses the action (supply/borrow, LP, vault, RWA subscription, hedged margin, stake, bridge/swap, and so on); TVL chooses capital, the first chain a gas band, and age a hold window. Every step states a cost and a time, ending with an exit tripwire.

## What the board is not

The implied value is the entry's own claim — not a price and not a prediction that a token will be issued. "Records no token" means the snapshot carries no token fields; a token may still exist. TVL can leave, contracts can fail and a comparable set can be thin.
