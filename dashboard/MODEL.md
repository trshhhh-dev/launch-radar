# Token Radar — radar-2.1

The model is locked. `deriveValue` in `lib/model.ts` is the only scorer:

`implied = TVL × peer multiple × size tilt × momentum × tenure × reach`

Peer multiple = shrunk median mcap/TVL of token-bearing same-category peers at $100M TVL (family, then market fallback). Size tilt = `(TVL/$100M)^-0.28`. Momentum = `1 + clamp(change_7d,-40,80)/100×0.25`. Tenure = `0.60 + min(age,1460)/1460×0.40`, unknown 0.68. Reach = `1 + (min(chains,6)-1)×0.02`. Nothing here was changed to make the held-out tests or farm verdicts look better.

## Held-out evidence

`heldOutEvidence` calls the unchanged peer book and `deriveValue` on peer sets that exclude the target: leave-one-out removes it entirely; the time split uses only strictly earlier listed comparables (at least six). Flat uses the raw category mcap/TVL median with the same fallbacks, no size term. Miss = `exp(mean |log(pred/mcap)|)`. `n` and both splits' `miss_flat`, `miss_core` (peer+size only) and `miss_model` are computed into `data.js`, shown on screen. If momentum/tenure/reach worsen held-out miss, the page says so; they stay in the rank.

## Accounting and economics

The ledger partitions all snapshot protocols into ranked rows, token records (with/without usable mcap) and excluded products by reason; the page checks recomputation, ranks, monotonic values, watchlist and ledger sum. `netFarmEconomics` is display only: on a $10,000 ticket over 12 weeks, drop = `implied×0.07×10000/max(TVL,10000)`; fees = nine gas events at the top of the chain's printed band plus a $20 test tx; net = drop − fees. Hands-on hours come from step minutes, not hold days. SKIP if fees exceed drop; FARM if net beats a 4-week T-bill plus $25/hour; otherwise MARGINAL. The eight costed step strings are unchanged.

Implied value is a model claim, not a price or a promise of a token.
