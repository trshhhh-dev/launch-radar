# launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/trshhhh-dev/launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/trshhhh-dev/launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the protocols on a sealed DefiLlama snapshot that record no token by the implied value of the token they may issue, and gives each one a farm plan with concrete costs and hold windows. It covers the full 40-protocol watchlist plus the early protocols below it, and keeps token-bearing protocols apart as live comparables.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Node 22.18 or later. For the sealed snapshot mounted at `/input`, pass `--input /input/snapshot.json`. The run writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`.

## The value model

Every pre-token protocol is scored by one function, `deriveValue` in `lib/model.ts`, from the snapshot's own figures:

```text
implied = TVL × peer multiple × size tilt × momentum × tenure × reach
```

The peer multiple is the median market-cap/TVL of token-bearing protocols in the same category, normalised to $100M TVL and shrunk toward the whole snapshot's median. Size tilt is `(TVL / $100M) ^ -0.28`; momentum is the seven-day TVL change clamped to `[-40%, +80%]` and weighted at 25%; tenure is the time since DefiLlama first listed the protocol, and reach is a small premium for its chain count. No protocol name is special-cased. The same formula is printed on the board, and the detail view recomputes the number from the row's own fields so it matches `board.json`.

The board covers all 40 watchlist protocols and adds 158 more, most below the $50M floor; the watchlist is a floor, never a ceiling. Protocols whose token already trades are never ranked and appear separately as live comparables.

## Farm plans

`farmPlan` writes eight steps for every protocol. The action comes from its category — a lending supply/borrow leg, an LP position, a curator vault, an RWA subscription, a hedged margin position or a stake — while capital comes from TVL, the gas band from the first chain and the hold window from age. Each step states its cost and time, and the plan ends with an exit tripwire at a 25% TVL drawdown or a −20% seven-day change.

---

<sub>Entered on [make.fun](https://make.fun/?ref=gwmq7j6d&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
