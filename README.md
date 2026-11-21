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
implied = launch × token_odds × own_share
launch  = TVL × peer multiple × size factor × momentum × tenure × reach
```

The size curve was fitted on the snapshot's token-bearing protocols (n=92, slope 0.394) and kept after two blind tests: walk-forward log-error 1.3914 vs 1.7182 for a flat multiple (Spearman 0.312 both), and leave-one-category-out log-error 1.2847 vs 1.4153 (Spearman 0.5357 both).

Token odds come from the category's token rate, adjusted for time with no token and 7-day TVL change. Own-token share is the shrunk median of mcap/(mcap+TVL) among comparables. No protocol name is special-cased.

Token-bearing protocols stay off the ranked board and appear as live comparables / fit anchors. Coverage: all 40 watchlist protocols plus 158 early rows (198 ranked).

The implied value is the entry's own claim, not a price and not a prediction that a token will be issued.

## Farm plans

`farmPlan` writes concrete costed, timed steps (3–12) for every protocol, tailored by category and chain. Each step states its cost and time, and the plan ends with an exit tripwire.

Each plan also carries a FARM / THIN / SKIP verdict from token odds and implied-value standing: FARM if odds >= 0.50 and implied is at or above the board median; SKIP if odds <= 0.20 or implied is in the bottom quartile; THIN otherwise. Current split: 50 FARM, 89 THIN, 59 SKIP. The verdict is advice, not a filter on coverage.

---

<sub>Entered on [make.fun](https://make.fun/?ref=gwmq7j6d&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
