# Token Radar — the value model behind the board

Snapshot **2026-11-14** · DefiLlama protocol index (758 protocols at or above $5M TVL) · watchlist floor
**$50,000,000** · model **radar-2.1**.

## What is ranked

The board ranks **pre-token protocols**: snapshot records with no market cap, no CoinGecko id and no
symbol. It covers all **40** watchlist protocols and adds **158** more, for **198** rows; **138** are below
the floor, because the watchlist is the floor, never the ceiling. Token-bearing protocols are kept out of
the rank and shown apart as live comparables (**128** with a usable market cap).

Of the snapshot's **342** pre-token records, **144** are set aside as CEX, bridge, liquid-staking,
liquid-restaking, restaked-BTC, versioned, wrapped/staked or exchange products.

## The function

`deriveValue` in `lib/model.ts` scores every row from the snapshot's own figures only:

```
implied = TVL × peer multiple × size tilt × momentum × tenure × reach
```

- **peer multiple** — the median market-cap/TVL of token-bearing protocols in the same category,
  normalised to $100M TVL, shrunk toward the whole snapshot's median with 6 pseudo-observations. A
  category with fewer than three comparables borrows its peer family; a family with fewer than three
  borrows the whole snapshot.
- **size tilt** — `(TVL / $100M) ^ -0.28`; a within-category log-log fit puts the raw market slope near
  0.64, damped so size informs the rank without burying a large protocol.
- **momentum** — `1 + clamp(change_7d, -40, 80) / 100 × 0.25`; one hot week cannot carry a row.
- **tenure** — `0.60 + min(age_days, 1460) / 1460 × 0.40`; an unlisted age uses 0.68.
- **reach** — `1 + (min(chains, 6) - 1) × 0.02`; distribution is part of a token's addressable market.

The result is rounded to a whole dollar and floored at $1. The board carries every multiplier for every
row, and the detail drawer recomputes the value from the row's own fields, so the page and `board.json`
show the same arithmetic.

## Farm plans

`farmPlan` writes **eight** steps per protocol. The action comes from the category: lending gets a
supply/borrow leg, DEXs and yield a LP position, curators a vault deposit, RWA a subscription and
redemption test, derivatives a hedged margin position, staking a stake and a second operator, chains a
bridge/swap/vote, and so on. Capital comes from TVL, the gas band from the first chain, the hold window
from age. Every step states a **cost** and a **time** and ends with an exit tripwire.

## What the board is not

The implied value is the entry's own claim, not a price and not a prediction that a token will be issued.
A protocol that records no token may still have one its DefiLlama record does not carry; the page says
"records no token", never "has none". TVL can leave, contracts can fail and a comparable set can be thin.

## Top of this snapshot

| # | Protocol | Category | TVL | Implied |
| ---: | --- | --- | ---: | ---: |
| 1 | Steakhouse Financial | Risk Curators | $2.75B | $112.3M |
| 2 | Sentora Curator | Risk Curators | $2.76B | $104.1M |
| 3 | Gauntlet | Risk Curators | $1.58B | $76.7M |
| 4 | Veda | Onchain Capital Allocator | $1.56B | $76.0M |
| 5 | USDD | CDP | $1.06B | $74.4M |
