# Token Radar — radar-2.1

The scorer is locked: `deriveValue` alone computes
`implied = TVL × peer multiple × size tilt × momentum × tenure × reach`.
Peer multiple = shrunk median mcap/TVL of token-bearing same-category peers at $100M TVL (family, then market). Size tilt `(TVL/$100M)^-0.28`, momentum `1+clamp(change_7d,-40,80)/100×0.25`, tenure `0.60+min(age,1460)/1460×0.40` (unknown 0.68), reach `1+(min(chains,6)-1)×0.02`. No weight moved.

Held-out: each token-bearing protocol is scored against peers excluding it (leave-one-out) or listed strictly earlier (time). Flat is the raw category median. Miss = `exp(mean |log(pred/mcap)|)`.

Range: P25–P75 of `log(actual/locked-2.1 implied)` from those residuals, centred on the pool median and wrapped around each implied value. Category or family pools need n≥12, else the global scatter. Display only.

Listing rate: share of token-bearing protocols in the row's category (family, then market), shrunk by four pseudo-observations toward the market rate. Three multipliers were tested on both splits; one is kept only if it lowers miss on both. No own-share, fitted curve or FARM-by-odds rule. Every figure comes from DATA.

Ledger partitions all protocols into ranked rows, token records and exclusions by reason; the page checks recomputation, ranks, monotonic values, watchlist and sum. Farm economics stay display only: $10k ticket, drop = `implied×0.07×10000/max(TVL,10000)`, fees = nine gas events plus a $20 test tx, net = drop − fees. SKIP if fees exceed drop, FARM if net beats a 4-week T-bill plus $25/hour, else MARGINAL. Eight costed steps unchanged.
