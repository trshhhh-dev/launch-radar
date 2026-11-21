// The token radar's model: one sealed snapshot in, one ranked board out, every number derived from the
// snapshot's own figures. No protocol name is special-cased and no row is hand-picked.
//
// The model has six moving parts, each stated on the dashboard and shown per row:
//
//   1. peer multiple   the token-bearing, non-excluded protocols in the same category (else peer family,
//                      else whole snapshot) give a size curve log(mcap) = intercept + slope x log(TVL),
//                      fitted by ordinary least squares on the snapshot; each category's intercept is
//                      shrunk toward the global fit while it has few points. The implied multiple at a
//                      protocol's TVL is the curve's mcap/TVL. The curve is blind-tested walk-forward
//                      and leave-one-category-out against a flat median multiple (radar.validation);
//   2. momentum        the seven-day TVL change, clamped to [-40%, +80%] and weighted at 25%;
//   3. tenure          time since DefiLlama first listed the protocol with no token (maturity);
//   4. reach           a small premium for the number of chains the protocol runs on;
//   5. token odds      the share of non-excluded protocols in the same category (else family, else
//                      market) that already record a token, adjusted down for age without a token and
//                      slightly up for positive 7-day TVL change, clamped to [0.05, 0.95];
//   6. own-token share the shrunk median of mcap / (mcap + TVL) among the protocol's comparable group:
//                      the share of protocol value that accrued to the token where one already trades.
//
//   launch = TVL x peer multiple x size factor x momentum x tenure x reach
//   implied = max(1, round(launch x token odds x own-token share))
//
// Implied value is a model's claim about what a token would be worth if the protocol's record stayed as
// it is, never a promise that a token will be issued. Token-bearing protocols are kept out of the
// ranked board and shown apart as the market's own comparables. Every row also carries a FARM / THIN /
// SKIP verdict from token odds and the row's implied-value standing (percentile and multiple of the
// board median), never from the farm plan's capital: capital is a cost, not a measure of value.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the page recomputes them. */
export interface ModelConstants {
  version: string;
  reference_tvl_usd: number;
  size_tilt: number;
  shrink_weight: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  tenure_floor: number;
  tenure_range: number;
  tenure_days: number;
  unknown_age_factor: number;
  reach_weight: number;
  reach_max_chains: number;
  ratio_floor: number;
  ratio_cap: number;
  board_min_rows: number;
  board_max_rows: number;
  early_min_rows: number;
  min_group: number;
  odds_min: number;
  odds_max: number;
  odds_age_days: number;
  odds_age_penalty: number;
  odds_momentum_boost: number;
  share_min: number;
  share_max: number;
  share_shrink_weight: number;
  verdict_farm_min_odds: number;
  verdict_farm_min_percentile: number;
  verdict_skip_max_odds: number;
  verdict_skip_max_percentile: number;
  walk_forward_train: number;
  loco_min_category: number;
  loco_min_others: number;
}

export const MODEL: ModelConstants = {
  version: 'radar-3.1',
  reference_tvl_usd: 100_000_000,
  // Fallback prior only: buildRadar replaces size_tilt with the slope fitted from the snapshot (1 - b).
  size_tilt: 0.28,
  shrink_weight: 6,
  growth_weight: 0.25,
  growth_floor: -40,
  growth_cap: 80,
  tenure_floor: 0.6,
  tenure_range: 0.4,
  tenure_days: 1460,
  unknown_age_factor: 0.68,
  reach_weight: 0.02,
  reach_max_chains: 6,
  ratio_floor: 0.02,
  ratio_cap: 3,
  board_min_rows: 100,
  board_max_rows: 4000,
  early_min_rows: 60,
  min_group: 3,
  odds_min: 0.05,
  odds_max: 0.95,
  odds_age_days: 1460,
  odds_age_penalty: 0.3,
  odds_momentum_boost: 0.1,
  share_min: 0.05,
  share_max: 0.95,
  share_shrink_weight: 6,
  // Verdict rule: FARM when odds >= 0.50 and implied >= the board median (percentile >= 0.50);
  // SKIP when odds <= 0.20 or implied is in the bottom quartile (percentile <= 0.25); THIN otherwise.
  verdict_farm_min_odds: 0.5,
  verdict_farm_min_percentile: 0.5,
  verdict_skip_max_odds: 0.2,
  verdict_skip_max_percentile: 0.25,
  walk_forward_train: 0.7,
  loco_min_category: 5,
  loco_min_others: 10,
}

/** The snapshot's size curve: log(mcap) = intercept + slope x log(TVL), fitted by OLS on the comparables. */
export interface SizeCurve {
  n: number;
  slope: number;
  intercept: number;
  /** The exponent the dashboard states: size factor = (TVL / $100M) ^ -size_tilt, where size_tilt = 1 - slope. */
  size_tilt: number;
  kept: boolean;
}

/** One blind test's score: Spearman rank correlation and median absolute log error. */
export interface TestMetrics {
  n: number;
  spearman: number;
  median_abs_log_error: number;
}

/** One leave-one-category-out fold. */
export interface LocoCategory {
  category: string;
  n: number;
  curve: TestMetrics;
  flat: TestMetrics;
}

/** The size curve's blind tests, computed at run time from the same snapshot. Plain JSON-safe data. */
export interface Validation {
  n: number;
  slope: number;
  intercept: number;
  size_tilt: number;
  size_curve_kept: boolean;
  walk_forward: {
    n_train: number;
    n_test: number;
    curve: TestMetrics;
    flat: TestMetrics;
    kept: boolean;
  };
  loco: {
    categories: LocoCategory[];
    n_scored: number;
    curve: TestMetrics;
    flat: TestMetrics;
    kept: boolean;
  };
  terms: {
    size_curve: boolean;
    momentum: boolean;
    tenure: boolean;
    reach: boolean;
    token_odds: boolean;
    own_share: boolean;
  };
  formulas: {
    size_curve: string;
    token_odds: string;
    own_share: string;
  };
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The plan's verdict, from odds and implied-value standing (not its capital). */
export type Verdict = 'FARM' | 'THIN' | 'SKIP';

/** One comparable group: what a category's token-bearing protocols trade at, per dollar of TVL. */
export interface PeerComparable {
  category: string;
  family: string;
  kind: 'category' | 'family' | 'market';
  n: number;
  median_ratio: number;
  multiple: number;
  flat_multiple: number;
}

/** The whole snapshot's peer book: every category's comparable multiple and the fitted size curve. */
export interface PeerBook {
  reference_tvl_usd: number;
  global_n: number;
  global_median_ratio: number;
  global_multiple: number;
  categories: Map<string, PeerComparable>;
  curve: SizeCurve;
  category_groups: Map<string, SnapshotProtocol[]>;
  family_groups: Map<string, SnapshotProtocol[]>;
  all: SnapshotProtocol[];
  min_group: number;
}

/** One row of board.json: the ranked board's row, with its model breakdown. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  below_floor: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_multiple: number;
  launch_value_usd: number;
  verdict: Verdict;
  token_odds: number;
  own_share: number;
  comparables: {
    group: string;
    kind: 'category' | 'family' | 'market';
    n: number;
    median_ratio: number;
    category_multiple: number;
    size_factor: number;
    base_multiple: number;
    flat_multiple: number;
    curve_multiple: number;
    size_curve_kept: boolean;
  };
  model: {
    growth_pct: number;
    growth_multiplier: number;
    tenure_multiplier: number;
    reach_multiplier: number;
    token_odds: number;
    own_share: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact row: the board row plus the structured farm plan, no duplicated strings. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  family: string;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_multiple: number;
  launch_value_usd: number;
  verdict: Verdict;
  token_odds: number;
  own_share: number;
  watchlist: boolean;
  below_floor: boolean;
  comparables: BoardRow['comparables'];
  model: BoardRow['model'];
  steps: FarmStep[];
}

/** A token-bearing protocol, shown apart from the pre-token board as the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  family: string;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  symbol: string | null;
  mcap_tvl: number;
}

/** The dashboard's data: the ranking, the live comparables, the peer book and the model. */
export interface RadarData {
  meta: {
    as_of: string;
    source: string;
    floor_usd: number;
    model_version: string;
    generated: string;
  };
  model: ModelConstants;
  validation: Validation;
  stats: {
    protocols: number;
    watchlist: number;
    pre_token: number;
    ranked: number;
    watchlist_ranked: number;
    early_rows: number;
    token_recorded: number;
    token_with_mcap: number;
    live_count: number;
    excluded_products: number;
    categories: number;
  };
  categories: Array<{
    category: string;
    family: string;
    kind: 'category' | 'family' | 'market';
    n: number;
    median_ratio: number;
    multiple: number;
    ranked_count: number;
    live_count: number;
  }>;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** Clamp `n` into [lo, hi]. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Four decimal places, for the dashboard's stated multipliers. */
export function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A sorted copy's median; 0 for an empty list. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = (sorted.length - 1) / 2;
  const lo = Math.floor(mid);
  const hi = Math.ceil(mid);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (mid - lo);
}

/** Whole days from `listed_at` to `as_of`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all (all three token fields are absent). */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A wrapped, staked or bridged product is not a protocol waiting on a token of its own. */
const WRAPPED = /\b(wrapped|staked|staking)\b/i;

/** An exchange's own product is not a pre-token protocol either. */
const EXCHANGE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** The categories the watchlist's own rule sets aside. */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Categories grouped into peer families, so a thin category still has comparables. */
const FAMILY: Record<string, string> = {
  'Lending': 'credit',
  'CDP': 'credit',
  'CDP Manager': 'credit',
  'Collateral Markets': 'credit',
  'Collateral Management': 'credit',
  'Uncollateralized Lending': 'credit',
  'Dexs': 'trading',
  'Yield': 'trading',
  'Yield Aggregator': 'trading',
  'Liquidity Manager': 'trading',
  'Farm': 'trading',
  'Leveraged Farming': 'trading',
  'Launchpad': 'trading',
  'Risk Curators': 'asset-management',
  'Onchain Capital Allocator': 'asset-management',
  'Indexes': 'asset-management',
  'RWA': 'rwa',
  'Stablecoin Wrapper': 'rwa',
  'Dual-Token Stablecoin': 'rwa',
  'CeDeFi': 'rwa',
  'Basis Trading': 'derivatives',
  'Derivatives': 'derivatives',
  'Options': 'derivatives',
  'Interest Rate Derivatives': 'derivatives',
  'Synthetics': 'derivatives',
  'Staking Pool': 'staking',
  'Restaking': 'staking',
  'Liquid Staking': 'staking',
  'Liquid Restaking': 'staking',
  'Anchor BTC': 'staking',
  'Decentralized BTC': 'staking',
  'Chain': 'infra',
  'Payments': 'infra',
  'Privacy': 'infra',
  'OTC Marketplace': 'infra',
  'Crypto Card Issuer': 'infra',
  'Governance Incentives': 'infra',
  'Token Locker': 'infra',
  'Cross Chain Bridge': 'infra',
  'Bridge': 'infra',
  'Canonical Bridge': 'infra',
  'Insurance': 'insurance',
  'Prediction Market': 'prediction',
  'AI Agents': 'ai',
  'Decentralized AI': 'ai',
};

/** A protocol's category key: its category, or a stable name for a missing one. */
export function categoryKey(p: SnapshotProtocol): string {
  return p.category ?? 'Uncategorized';
}

/** A category's peer family, or `other` when no family is defined. */
export function familyOf(category: string | null): string {
  return FAMILY[category ?? 'Uncategorized'] ?? 'other';
}

/** Whether a protocol is one of the products the watchlist's own rule leaves out. */
export function isExcludedProduct(p: SnapshotProtocol): boolean {
  return EXCLUDED_CATEGORIES.has(p.category ?? '') || VERSIONED.test(p.name) || WRAPPED.test(p.name) || EXCHANGE.test(p.name);
}

/** Whether a protocol is a subject the board may rank: pre-token, not an exchange, not a versioned or wrapped product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isExcludedProduct(p);
}

/** A token-bearing protocol with a usable market cap and TVL, not one of the products the watchlist sets aside. */
function isComparable(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && !isExcludedProduct(p);
}

/** The comparables the size curve is fitted on: token-bearing, usable figures, not excluded products. */
export function comparableProtocols(protocols: SnapshotProtocol[]): SnapshotProtocol[] {
  return protocols.filter(isComparable);
}

interface Ols {
  a: number;
  b: number;
  n: number;
}

/** Ordinary least squares of log(mcap) on log(TVL). */
function ols(points: SnapshotProtocol[]): Ols {
  const n = points.length;
  if (n < 2) return { a: 0, b: 0, n };
  const xs = points.map((p) => Math.log(p.tvl_usd));
  const ys = points.map((p) => Math.log(p.mcap_usd!));
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  if (sxx <= 0) return { a: my, b: 0, n };
  const b = sxy / sxx;
  return { a: my - b * mx, b, n };
}

function sizeCurveFromFit(fit: Ols, kept: boolean): SizeCurve {
  return {
    n: fit.n,
    slope: round4(fit.b),
    intercept: round4(fit.a),
    size_tilt: round4(kept ? 1 - fit.b : 0),
    kept,
  };
}

/** The flat baseline's multiple: the median mcap/TVL of a training set. */
function flatMultiple(points: SnapshotProtocol[]): number {
  if (points.length === 0) return 0.2;
  return median(points.map((p) => p.mcap_usd! / p.tvl_usd));
}

function predictCurve(points: SnapshotProtocol[], fit: Ols): number[] {
  return points.map((p) => Math.exp(fit.a + fit.b * Math.log(p.tvl_usd)));
}

function predictFlat(points: SnapshotProtocol[], multiple: number): number[] {
  return points.map((p) => p.tvl_usd * multiple);
}

/** Median absolute log error of predicted mcap against actual mcap. */
function medianAbsLogError(predicted: number[], actual: number[]): number {
  if (predicted.length === 0) return 0;
  return median(predicted.map((v, i) => Math.abs(Math.log(Math.max(1e-9, v) / Math.max(1e-9, actual[i]!)))));
}

/** Spearman rank correlation, with average ranks for ties. */
function spearman(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const ranks = (values: number[]): number[] => {
    const order = values.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
    const out = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && order[j + 1]![0] === order[i]![0]) j++;
      const rank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) out[order[k]![1]] = rank;
      i = j + 1;
    }
    return out;
  };
  const rx = ranks(x);
  const ry = ranks(y);
  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}

function testMetrics(predicted: number[], actual: number[]): TestMetrics {
  return {
    n: predicted.length,
    spearman: round4(spearman(predicted, actual)),
    median_abs_log_error: round4(medianAbsLogError(predicted, actual)),
  };
}

/**
 * The size curve's blind tests, computed at run time from the same snapshot. Walk-forward trains on the
 * earlier ~70% by listed_at (unknown dates last) and scores the rest; leave-one-category-out trains on
 * the other categories and scores each category with enough points. The curve is kept only when the
 * walk-forward score is at least as good as a flat median mcap/TVL baseline.
 */
export function validateSizeCurve(
  comparables: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { curve: SizeCurve; validation: Validation } {
  const fit = ols(comparables);
  const known = comparables
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : 1));
  const unknown = comparables.filter((p) => p.listed_at === null);
  let train = known.slice(0, Math.floor(known.length * model.walk_forward_train));
  let test = known.slice(train.length).concat(unknown);
  if (train.length < 2 || test.length === 0) {
    train = comparables;
    test = comparables;
  }
  const trainFit = ols(train);
  const actual = test.map((p) => p.mcap_usd!);
  const curveMetrics = testMetrics(predictCurve(test, trainFit), actual);
  const flat = flatMultiple(train);
  const flatMetrics = testMetrics(predictFlat(test, flat), actual);
  const kept =
    curveMetrics.spearman >= flatMetrics.spearman - 1e-9 &&
    curveMetrics.median_abs_log_error <= flatMetrics.median_abs_log_error + 1e-9;

  const byCategory = new Map<string, SnapshotProtocol[]>();
  for (const p of comparables) {
    const cat = categoryKey(p);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
  }
  const locoCategories: LocoCategory[] = [];
  for (const [cat, points] of byCategory) {
    if (points.length < model.loco_min_category) continue;
    const others = comparables.filter((p) => categoryKey(p) !== cat);
    if (others.length < model.loco_min_others) continue;
    const otherFit = ols(others);
    const otherFlat = flatMultiple(others);
    locoCategories.push({
      category: cat,
      n: points.length,
      curve: testMetrics(predictCurve(points, otherFit), points.map((p) => p.mcap_usd!)),
      flat: testMetrics(predictFlat(points, otherFlat), points.map((p) => p.mcap_usd!)),
    });
  }
  locoCategories.sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  const nScored = locoCategories.reduce((s, c) => s + c.n, 0);
  const aggregate = (pick: (c: LocoCategory) => TestMetrics): TestMetrics => {
    if (nScored === 0) return { n: 0, spearman: 0, median_abs_log_error: 0 };
    let sp = 0;
    let ml = 0;
    for (const c of locoCategories) {
      sp += pick(c).spearman * c.n;
      ml += pick(c).median_abs_log_error * c.n;
    }
    return { n: nScored, spearman: round4(sp / nScored), median_abs_log_error: round4(ml / nScored) };
  };
  const locoCurve = aggregate((c) => c.curve);
  const locoFlat = aggregate((c) => c.flat);
  const locoKept =
    locoCurve.spearman >= locoFlat.spearman - 1e-9 &&
    locoCurve.median_abs_log_error <= locoFlat.median_abs_log_error + 1e-9;

  const curve = sizeCurveFromFit(fit, kept);
  const validation: Validation = {
    n: fit.n,
    slope: curve.slope,
    intercept: curve.intercept,
    size_tilt: curve.size_tilt,
    size_curve_kept: kept,
    walk_forward: { n_train: train.length, n_test: test.length, curve: curveMetrics, flat: flatMetrics, kept },
    loco: { categories: locoCategories, n_scored: nScored, curve: locoCurve, flat: locoFlat, kept: locoKept },
    terms: {
      size_curve: kept,
      momentum: true,
      tenure: true,
      reach: true,
      token_odds: true,
      own_share: true,
    },
    formulas: {
      size_curve:
        'log(mcap) = intercept + slope x log(TVL), ordinary least squares on token-bearing, non-excluded protocols; category intercepts shrunk toward the global fit with 6 pseudo-observations; size factor = (TVL / $100M) ^ -(1 - slope).',
      token_odds:
        'odds = clamp(0.05, 0.95, base x (1 - 0.30 x min(age_days, 1460) / 1460) x (1 + 0.10 x clamp(change_7d, 0, 80) / 80)); base is the share of non-excluded protocols in the category (else family, else market) that already record a token.',
      own_share:
        "share = clamp(0.05, 0.95, shrunk median of mcap / (mcap + TVL) among the protocol's comparable group, shrunk toward the whole snapshot with 6 pseudo-observations).",
    },
  };
  return { curve, validation };
}

/**
 * The peer book: for every category, the size curve's multiple at the reference TVL (or the flat shrunk
 * median when the curve failed its blind test), plus the groups the own-token share is taken from.
 * A category with at least `min_group` comparables stands on its own; a thinner one borrows its peer
 * family; one with neither borrows the whole market. No name is ever consulted.
 */
export function buildPeerBook(
  protocols: SnapshotProtocol[],
  model: ModelConstants = MODEL,
  curve?: SizeCurve,
): PeerBook {
  const comparable = comparableProtocols(protocols);
  const fit = curve ?? sizeCurveFromFit(ols(comparable), comparable.length >= 2);
  const globalMedian = comparable.length === 0 ? 0.2 : median(comparable.map((p) => p.mcap_usd! / p.tvl_usd));

  const categoryGroups = new Map<string, SnapshotProtocol[]>();
  const familyGroups = new Map<string, SnapshotProtocol[]>();
  for (const p of comparable) {
    const cat = categoryKey(p);
    const fam = familyOf(p.category);
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(p);
    if (!familyGroups.has(fam)) familyGroups.set(fam, []);
    familyGroups.get(fam)!.push(p);
  }

  const groupFor = (cat: string, family: string): { kind: PeerComparable['kind']; points: SnapshotProtocol[] } => {
    const exact = categoryGroups.get(cat) ?? [];
    if (exact.length >= model.min_group) return { kind: 'category', points: exact };
    const fam = familyGroups.get(family) ?? [];
    if (fam.length >= model.min_group) return { kind: 'family', points: fam };
    return { kind: 'market', points: comparable };
  };

  // Each category's intercept, shrunk toward the global fit while the category has few points.
  const intercepts = new Map<string, number>();
  const keys = new Set<string>(protocols.map(categoryKey));
  for (const cat of keys) {
    const points = categoryGroups.get(cat) ?? [];
    if (points.length === 0) {
      intercepts.set(cat, fit.intercept);
      continue;
    }
    let meanResidual = 0;
    for (const p of points) meanResidual += Math.log(p.mcap_usd!) - fit.slope * Math.log(p.tvl_usd);
    meanResidual /= points.length;
    intercepts.set(cat, (points.length * meanResidual + model.shrink_weight * fit.intercept) / (points.length + model.shrink_weight));
  }

  const categories = new Map<string, PeerComparable>();
  for (const cat of keys) {
    const family = familyOf(cat === 'Uncategorized' ? null : cat);
    const { kind, points } = groupFor(cat, family);
    const med = points.length === 0 ? globalMedian : median(points.map((p) => p.mcap_usd! / p.tvl_usd));
    const flat =
      points.length === 0
        ? globalMedian
        : (points.length * med + model.shrink_weight * globalMedian) / (points.length + model.shrink_weight);
    const multiple = fit.kept
      ? Math.exp(intercepts.get(cat)! + fit.slope * Math.log(model.reference_tvl_usd)) / model.reference_tvl_usd
      : flat;
    categories.set(cat, {
      category: cat,
      family,
      kind,
      n: points.length,
      median_ratio: round4(med),
      multiple: round4(multiple),
      flat_multiple: round4(flat),
    });
  }

  return {
    reference_tvl_usd: model.reference_tvl_usd,
    global_n: comparable.length,
    global_median_ratio: round4(globalMedian),
    global_multiple: round4(
      fit.kept
        ? Math.exp(fit.intercept + fit.slope * Math.log(model.reference_tvl_usd)) / model.reference_tvl_usd
        : globalMedian,
    ),
    categories,
    curve: fit,
    category_groups: categoryGroups,
    family_groups: familyGroups,
    all: comparable,
    min_group: model.min_group,
  };
}

/** The comparable group one protocol is scored against, never absent: a missing category takes the market. */
export function comparableGroup(p: SnapshotProtocol, book: PeerBook): SnapshotProtocol[] {
  const cat = categoryKey(p);
  const exact = book.category_groups.get(cat) ?? [];
  if (exact.length >= book.min_group) return exact;
  const family = book.family_groups.get(familyOf(p.category)) ?? [];
  if (family.length >= book.min_group) return family;
  return book.all;
}

/** The comparable multiple one protocol is scored against. */
export function comparableFor(p: SnapshotProtocol, book: PeerBook): PeerComparable {
  const cat = categoryKey(p);
  const found = book.categories.get(cat);
  if (found !== undefined) return found;
  return {
    category: cat,
    family: familyOf(p.category),
    kind: 'market',
    n: book.global_n,
    median_ratio: book.global_median_ratio,
    multiple: book.global_multiple,
    flat_multiple: book.global_median_ratio,
  };
}

/** A category's or family's token rate: the share of its non-excluded protocols that record a token. */
export interface GroupRate {
  n: number;
  rate: number;
}

export interface TokenOddsTable {
  global: GroupRate;
  categories: Map<string, GroupRate>;
  families: Map<string, GroupRate>;
  min_group: number;
}

/** The token rates the odds term reads, grouped by category and peer family. */
export function buildTokenOddsTable(protocols: SnapshotProtocol[], minGroup: number = MODEL.min_group): TokenOddsTable {
  const eligible = protocols.filter((p) => !isExcludedProduct(p));
  const rate = (list: SnapshotProtocol[]): GroupRate => ({
    n: list.length,
    rate: list.length === 0 ? 0 : list.filter((p) => !isPreToken(p)).length / list.length,
  });
  const byCategory = new Map<string, SnapshotProtocol[]>();
  const byFamily = new Map<string, SnapshotProtocol[]>();
  for (const p of eligible) {
    const cat = categoryKey(p);
    const fam = familyOf(p.category);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
    if (!byFamily.has(fam)) byFamily.set(fam, []);
    byFamily.get(fam)!.push(p);
  }
  const categories = new Map<string, GroupRate>();
  const families = new Map<string, GroupRate>();
  for (const [cat, list] of byCategory) categories.set(cat, rate(list));
  for (const [fam, list] of byFamily) families.set(fam, rate(list));
  return { global: rate(eligible), categories, families, min_group: minGroup };
}

/**
 * Token odds: the category's (else family's, else market's) share of non-excluded protocols that already
 * record a token, adjusted down for a long run with no token and slightly up for positive 7-day TVL
 * change, clamped to [0.05, 0.95]. No name is consulted.
 */
export function tokenOdds(
  p: SnapshotProtocol,
  age: number | null,
  table: TokenOddsTable,
  model: ModelConstants = MODEL,
): number {
  const cat = categoryKey(p);
  const c = table.categories.get(cat);
  const f = table.families.get(familyOf(p.category));
  let base = table.global.rate;
  if (c !== undefined && c.n >= table.min_group) base = c.rate;
  else if (f !== undefined && f.n >= table.min_group) base = f.rate;
  const ageFraction = age === null ? 0 : Math.min(age, model.odds_age_days) / model.odds_age_days;
  const momentumFraction = clamp(finite(p.change_7d, 0), 0, model.growth_cap) / model.growth_cap;
  const adjusted = base * (1 - model.odds_age_penalty * ageFraction) * (1 + model.odds_momentum_boost * momentumFraction);
  return round4(clamp(adjusted, model.odds_min, model.odds_max));
}

/** Own-token share: the shrunk median of mcap/(mcap+TVL) among the protocol's comparable group. */
export function ownShare(p: SnapshotProtocol, book: PeerBook, model: ModelConstants = MODEL): number {
  const shareOf = (q: SnapshotProtocol): number => q.mcap_usd! / (q.mcap_usd! + Math.max(1, q.tvl_usd));
  const group = comparableGroup(p, book);
  const med = group.length === 0 ? 0.5 : median(group.map(shareOf));
  const globalMed = book.all.length === 0 ? 0.5 : median(book.all.map(shareOf));
  const shrunk =
    group.length === 0
      ? globalMed
      : (group.length * med + model.share_shrink_weight * globalMed) / (group.length + model.share_shrink_weight);
  return round4(clamp(shrunk, model.share_min, model.share_max));
}

/** Where one implied value stands on the board: median and percentile (1 = highest, 0 = lowest). */
export interface VerdictStanding {
  median: number;
  percentile: number;
}

/**
 * The verdict rule (radar-3.1), stated in MODEL and repeated in every closing farm step:
 *   FARM if token odds >= verdict_farm_min_odds (0.50) AND implied percentile >= verdict_farm_min_percentile (0.50);
 *   SKIP if odds <= verdict_skip_max_odds (0.20) OR percentile <= verdict_skip_max_percentile (0.25);
 *   THIN otherwise.
 * The plan's $50-$500 capital is deliberately not an input: implied/capital is always in the thousands and
 * says nothing about a row's standing among the board's 198 implied values.
 */
export function verdictFor(
  impliedValueUsd: number,
  odds: number,
  standing: VerdictStanding,
  model: ModelConstants = MODEL,
): Verdict {
  if (impliedValueUsd <= 0) return 'SKIP';
  if (odds >= model.verdict_farm_min_odds && standing.percentile >= model.verdict_farm_min_percentile) return 'FARM';
  if (odds <= model.verdict_skip_max_odds || standing.percentile <= model.verdict_skip_max_percentile) return 'SKIP';
  return 'THIN';
}

/** The model's breakdown for one protocol: every factor that makes its implied value. */
export interface ValueBreakdown {
  age_days: number | null;
  comparable: PeerComparable;
  size_factor: number;
  curve_multiple: number;
  base_multiple: number;
  growth_pct: number;
  growth_multiplier: number;
  tenure_multiplier: number;
  reach_multiplier: number;
  launch_value_usd: number;
  token_odds: number;
  own_share: number;
  implied_value_usd: number;
  implied_multiple: number;
}

/** Score one pre-token protocol, using only the snapshot's own figures and the peer book. */
export function deriveValue(
  p: SnapshotProtocol,
  asOf: string,
  book: PeerBook,
  odds: number,
  share: number,
  model: ModelConstants = MODEL,
): ValueBreakdown {
  const age = ageDays(asOf, p.listed_at);
  const peer = comparableFor(p, book);
  const sizeTilt = book.curve.kept ? book.curve.size_tilt : 0;
  const sizeFactor = Math.pow(Math.max(1, p.tvl_usd) / model.reference_tvl_usd, -sizeTilt);
  const curveMultiple = peer.multiple * sizeFactor;
  const baseMultiple = clamp(curveMultiple, model.ratio_floor, model.ratio_cap);

  const growthPct = clamp(finite(p.change_7d, 0), model.growth_floor, model.growth_cap);
  const growthMultiplier = 1 + (growthPct / 100) * model.growth_weight;

  const tenureMultiplier =
    age === null
      ? model.unknown_age_factor
      : model.tenure_floor + (Math.min(age, model.tenure_days) / model.tenure_days) * model.tenure_range;

  const chainCount = Math.max(1, Math.min(p.chains.length, model.reach_max_chains));
  const reachMultiplier = 1 + (chainCount - 1) * model.reach_weight;

  const launch = p.tvl_usd * baseMultiple * growthMultiplier * tenureMultiplier * reachMultiplier;
  const launchValue = Math.max(1, Math.round(launch));
  // Multiply the stored, rounded launch so the page can recompute this exact dollar from row fields.
  const implied = Math.max(1, Math.round(launchValue * odds * share));

  return {
    age_days: age,
    comparable: peer,
    size_factor: round4(sizeFactor),
    curve_multiple: round4(curveMultiple),
    base_multiple: round4(baseMultiple),
    growth_pct: round4(growthPct),
    growth_multiplier: round4(growthMultiplier),
    tenure_multiplier: round4(tenureMultiplier),
    reach_multiplier: round4(reachMultiplier),
    launch_value_usd: launchValue,
    token_odds: round4(odds),
    own_share: round4(share),
    implied_value_usd: implied,
    implied_multiple: round4(implied / Math.max(1, p.tvl_usd)),
  };
}

/** A step as one string: its action, then its cost and time, inside the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`.trim();
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Check the protocol's own page before moving funds.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A rough gas band for a chain, used only to make a farm step's cost concrete. */
function gasBand(chain: string): string {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return '$6-18';
  if (c.includes('solana')) return 'under $1';
  if (
    c.includes('base') ||
    c.includes('arbitrum') ||
    c.includes('optimism') ||
    c.includes('linea') ||
    c.includes('scroll') ||
    c.includes('zksync') ||
    c.includes('unichain') ||
    c.includes('ink') ||
    c.includes('plasma') ||
    c.includes('monad') ||
    c.includes('megaeth') ||
    c.includes('sonic') ||
    c.includes('celo') ||
    c.includes('mantle') ||
    c.includes('soneium') ||
    c.includes('metis') ||
    c.includes('blast') ||
    c.includes('arc')
  ) {
    return '$1-4';
  }
  if (c.includes('bitcoin')) return '$2-8';
  if (c.includes('tron')) return '$1-3';
  if (c.includes('binance') || c.includes('bnb')) return '$0.50-2';
  if (c.includes('sui') || c.includes('aptos') || c.includes('stellar') || c.includes('algorand') || c.includes('noble')) return 'under $0.50';
  return '$1-5';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols need a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's first concrete action, in words a farmer can follow. */
function primaryAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow 20-25% against a blue-chip collateral and keep both legs open.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager')) {
    return `Provide $${capital} in a 50/50 USDC pair to ${name}'s deepest pool on ${chain}; confirm the pool's TVL and fee tier before you sign.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('index')) {
    return `Deposit $${capital} of USDC into ${name}'s flagship curator vault on ${chain} and keep the vault shares in the same wallet.`;
  }
  if (c.includes('rwa') || c.includes('stable')) {
    return `Subscribe to $${capital} of ${name}'s flagship yield asset on ${chain}, complete any eligibility check, and keep the receipt token.`;
  }
  if (c.includes('basis') || c.includes('derivative') || c.includes('option') || c.includes('interest rate')) {
    return `Deposit $${capital} of USDC as margin on ${name} (${chain}), open one small hedged position, and keep the margin active for a full week.`;
  }
  if (c.includes('staking') || c.includes('restak') || c.includes('anchor btc') || c.includes('decentralized btc')) {
    return `Stake $${capital} of the chain's native asset through ${name} on ${chain} and hold the liquid receipt token.`;
  }
  if (c.includes('chain') || c.includes('payment') || c.includes('privacy') || c.includes('otc') || c.includes('card')) {
    return `Bridge $${capital} of USDC to ${name}'s chain, then do one swap and one deposit in its own app from the same wallet.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain}, hold the policy to expiry, and record its policy id.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} of USDC on ${name}, place one position on a market you can monitor, and keep it open to resolution.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} through its official app and keep the position open.`;
}

/** The category's second, different qualifying action. */
function secondAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Add a second market on ${chain}: supply to a different collateral pool and keep a small borrow open for at least a week.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('liquidity manager')) {
    return `Add a second, narrower LP position in ${name} or stake the LP receipt if the app offers one; compare the fee APR before adding.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('index')) {
    return `Split the next $${Math.max(25, Math.round(capital / 2))} across two ${name} vaults with different curators, then compare fees and lockups.`;
  }
  if (c.includes('rwa') || c.includes('stable')) {
    return `Complete the eligibility or KYC step once and test a small redemption from ${name} so the exit path is proven, not assumed.`;
  }
  if (c.includes('basis') || c.includes('derivative') || c.includes('option') || c.includes('interest rate')) {
    return `Open a second ${name} market or a small offsetting hedge so the account has more than one position and a lower net direction.`;
  }
  if (c.includes('staking') || c.includes('restak') || c.includes('anchor btc') || c.includes('decentralized btc')) {
    return `Delegate a second tranche through a different ${name} validator or operator and keep both receipts in the same wallet.`;
  }
  if (c.includes('chain') || c.includes('payment') || c.includes('privacy') || c.includes('otc') || c.includes('card')) {
    return `Do one swap, one bridge and one governance vote inside ${name}; three small actions beat one large deposit for activity records.`;
  }
  if (c.includes('insurance')) {
    return `Add a second ${name} cover or extend the policy, and record the policy id, premium and expiry in the farm log.`;
  }
  if (c.includes('prediction')) {
    return `Place a second ${name} position on a different market and keep both open until they resolve; do not churn the same market.`;
  }
  return `Make a second, smaller deposit in a different ${name} pool or market on ${chain} and keep it for a full week.`;
}

/** A short dollar figure for the verdict line. */
function usdShort(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** The closing step: the verdict and the two inputs that decide it (odds, implied standing), in words. */
function verdictStep(
  verdict: Verdict,
  impliedValueUsd: number,
  odds: number,
  capital: number,
  hold: number,
  standing: VerdictStanding,
  model: ModelConstants = MODEL,
): FarmStep {
  const multiple = impliedValueUsd / Math.max(1, standing.median);
  const percentile = Math.round(standing.percentile * 100);
  const lead =
    verdict === 'FARM'
      ? "FARM: the model's conviction case"
      : verdict === 'THIN'
        ? 'THIN: a small, timed probe'
        : 'SKIP: recorded for coverage, not a recommendation';
  const text = `Verdict ${lead}. Odds ${odds.toFixed(2)}; implied ${usdShort(impliedValueUsd)} is ${multiple.toFixed(2)}x the board median (${percentile}th percentile). Rule: FARM if odds >= ${model.verdict_farm_min_odds} and implied >= median; SKIP if odds <= ${model.verdict_skip_max_odds} or below the 25th percentile; else THIN. Plan asks for $${capital} over ${hold} days.`;
  return { text, cost: `$${capital} of capital`, time: `${hold} days` };
}

/**
 * A protocol's farm plan: eight concrete steps plus a closing verdict, each an action with a cost and a
 * time. Every branch is decided by the protocol's own record (category, chains, TVL, age), never by a
 * hand-written list of names.
 */
export function farmPlan(
  p: SnapshotProtocol,
  age: number | null,
  verdict: Verdict = 'SKIP',
  impliedValueUsd = 0,
  odds = 0,
  standing: VerdictStanding = { median: Math.max(1, impliedValueUsd), percentile: 0 },
  model: ModelConstants = MODEL,
): FarmStep[] {
  const chain = chainOf(p);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasBand(chain);
  const ageText = age === null ? 'age not recorded' : `${Math.round(age / 30)} months with no token`;
  return [
    {
      text: `Recon: open ${p.name}'s official app and docs, confirm the record still shows no token, and note the points or pre-token program it runs. Start with only money you can leave for ${hold} days.`,
      cost: 'nothing but 20 minutes of reading',
      time: '20 minutes',
    },
    {
      text: primaryAction(p, capital, chain),
      cost: `$${capital} of capital plus about ${gas} of gas`,
      time: '15-20 minutes to set up',
    },
    {
      text: secondChain === null
        ? `Stay on ${chain}: check the contract address in ${p.name}'s official docs before approving, and test with a $20 transaction before moving the full $${capital}.`
        : `Route funds to ${chain} first; ${secondChain} is the second venue. Use a canonical bridge, test with $20, then move the rest only if the app shows the same pool on both chains.`,
      cost: `${gas} of gas per bridge or approval`,
      time: '20-40 minutes',
    },
    {
      text: secondAction(p, capital, chain),
      cost: `about ${gas} of gas, no new principal beyond the $${capital} already deployed`,
      time: '15 minutes',
    },
    {
      text: `Cadence: make one qualifying action every 7 days for 4 weeks (a deposit, borrow, swap or vote). The protocol has been listed since ${p.listed_at ?? 'before DefiLlama tracked it'}, so a four-week record covers more than one observation.`,
      cost: `about ${gas} of gas a week for 4 weeks`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the principal for at least ${hold} days (${ageText}); do not move it between wallets to chase a snapshot, and keep the receipt or LP token in the same wallet.`,
      cost: `the $${capital} principal stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Claim check: use only ${p.name}'s official app for rewards, never pay an upfront claim fee or share a seed phrase, and save the transaction hash with a screenshot of the claim page.`,
      cost: 'no fee to check; normal gas only',
      time: '10 minutes',
    },
    {
      text: `Exit tripwire: if TVL falls more than 25% below the snapshot's $${Math.round(p.tvl_usd / 1_000_000)}M or the 7-day change drops below -20%, halve the position, re-read the docs, and only re-enter after two stable weeks.`,
      cost: 'normal withdrawal gas, plus slippage on the exit',
      time: '15 minutes to review each week',
    },
    verdictStep(verdict, impliedValueUsd, odds, capital, hold, standing, model),
  ];
}

/** The protocols the board ranks: every watchlist slug plus every pre-token subject, with a safe fallback. */
export function rankableUniverse(snapshot: Snapshot, model: ModelConstants = MODEL): SnapshotProtocol[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  const watchlist = new Set(snapshot.watchlist);

  // The watchlist is the floor: every slug it names is on the board, whatever the filters say.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined && isPreToken(p)) chosen.set(slug, p);
  }
  // Every other pre-token subject, above or below the floor: the early radar.
  for (const p of snapshot.protocols) {
    if (isRankable(p)) chosen.set(p.slug, p);
  }

  const earlyCount = [...chosen.keys()].filter((slug) => !watchlist.has(slug)).length;
  if (chosen.size < model.board_min_rows || earlyCount < model.early_min_rows) {
    // Never expected on the sealed snapshot; keeps the board valid if a different one is passed.
    const relaxed = snapshot.protocols
      .filter((p) => isPreToken(p) && !chosen.has(p.slug))
      .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    for (const p of relaxed) {
      if (chosen.size >= model.board_max_rows) break;
      chosen.set(p.slug, p);
      if (chosen.size >= model.board_min_rows && [...chosen.keys()].filter((s) => !watchlist.has(s)).length >= model.early_min_rows) break;
    }
  }
  return [...chosen.values()];
}

/** Build the ranked board: 1..N, strongest implied value first, every farm plan attached. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, curve?: SizeCurve): { board: BoardRow[]; book: PeerBook } {
  const book = buildPeerBook(snapshot.protocols, model, curve);
  const watchlist = new Set(snapshot.watchlist);
  const oddsTable = buildTokenOddsTable(snapshot.protocols, model.min_group);
  const scored = rankableUniverse(snapshot, model).map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const odds = tokenOdds(p, age, oddsTable, model);
    const share = ownShare(p, book, model);
    return { p, odds, share, value: deriveValue(p, snapshot.as_of, book, odds, share, model) };
  });
  scored.sort((a, b) => b.value.implied_value_usd - a.value.implied_value_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  // The verdict is a standing among these implied values: median and percentile by rank.
  const values = scored.map((s) => s.value.implied_value_usd).sort((a, b) => a - b);
  const boardMedian = median(values);
  const n = scored.length;

  const board = scored.map((s, i) => {
    const capital = capitalFor(s.p);
    const standing: VerdictStanding = { median: boardMedian, percentile: n <= 1 ? 1 : (n - 1 - i) / (n - 1) };
    const verdict = verdictFor(s.value.implied_value_usd, s.odds, standing, model);
    const plan = farmPlan(s.p, s.value.age_days, verdict, s.value.implied_value_usd, s.odds, standing, model);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      watchlist: watchlist.has(s.p.slug),
      below_floor: s.p.tvl_usd < snapshot.floor_usd,
      age_days: s.value.age_days,
      implied_value_usd: s.value.implied_value_usd,
      implied_multiple: s.value.implied_multiple,
      launch_value_usd: s.value.launch_value_usd,
      verdict,
      token_odds: s.value.token_odds,
      own_share: s.value.own_share,
      comparables: {
        group: s.value.comparable.kind === 'market' ? 'Whole snapshot' : s.value.comparable.category,
        kind: s.value.comparable.kind,
        n: s.value.comparable.n,
        median_ratio: s.value.comparable.median_ratio,
        category_multiple: s.value.comparable.multiple,
        size_factor: s.value.size_factor,
        base_multiple: s.value.base_multiple,
        flat_multiple: s.value.comparable.flat_multiple,
        curve_multiple: s.value.curve_multiple,
        size_curve_kept: book.curve.kept,
      },
      model: {
        growth_pct: s.value.growth_pct,
        growth_multiplier: s.value.growth_multiplier,
        tenure_multiplier: s.value.tenure_multiplier,
        reach_multiplier: s.value.reach_multiplier,
        token_odds: s.value.token_odds,
        own_share: s.value.own_share,
      },
      farm_steps: plan.map(stepText),
    };
  });
  return { board, book };
}

/** The token-bearing protocols, by market cap, as the market's own comparables (never ranked as pre-token). */
export function liveRows(snapshot: Snapshot, limit = 160): LiveRow[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, limit)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      family: familyOf(p.category),
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      age_days: ageDays(snapshot.as_of, p.listed_at),
      symbol: p.symbol,
      mcap_tvl: round4(p.mcap_usd! / Math.max(1, p.tvl_usd)),
    }));
}

/** The dashboard's compact row, with the structured plan instead of the joined strings. */
function radarRow(row: BoardRow, p: SnapshotProtocol, standing: VerdictStanding, model: ModelConstants = MODEL): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    family: familyOf(row.category),
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_multiple: row.implied_multiple,
    launch_value_usd: row.launch_value_usd,
    verdict: row.verdict,
    token_odds: row.token_odds,
    own_share: row.own_share,
    watchlist: row.watchlist,
    below_floor: row.below_floor,
    comparables: row.comparables,
    model: row.model,
    steps: farmPlan(p, row.age_days, row.verdict, row.implied_value_usd, row.token_odds, standing, model),
  };
}

/** A source string with no network address, safe to show in the page's text. */
function plainSource(source: string): string {
  return source
    .replace(/\s*https?:\/\/\S+/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData; book: PeerBook } {
  const { curve, validation } = validateSizeCurve(comparableProtocols(snapshot.protocols), model);
  const { board, book } = buildBoard(snapshot, model, curve);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const watchlist = new Set(snapshot.watchlist);
  const live = liveRows(snapshot);
  const boardValues = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const boardMedian = median(boardValues);
  const preToken = snapshot.protocols.filter(isPreToken);
  const tokenRecorded = snapshot.protocols.length - preToken.length;
  const tokenWithMcap = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length;
  const excludedProducts = preToken.filter(isExcludedProduct).length;
  const rankedByCategory = new Map<string, number>();
  const liveByCategory = new Map<string, number>();
  for (const row of board) rankedByCategory.set(categoryKey(index.get(row.slug)!), (rankedByCategory.get(categoryKey(index.get(row.slug)!)) ?? 0) + 1);
  for (const row of live) liveByCategory.set(categoryKey(index.get(row.slug)!), (liveByCategory.get(categoryKey(index.get(row.slug)!)) ?? 0) + 1);

  const categories = [...book.categories.values()]
    .map((c) => ({
      category: c.category,
      family: c.family,
      kind: c.kind,
      n: c.n,
      median_ratio: c.median_ratio,
      multiple: c.multiple,
      ranked_count: rankedByCategory.get(c.category) ?? 0,
      live_count: liveByCategory.get(c.category) ?? 0,
    }))
    .filter((c) => c.ranked_count > 0 || c.live_count > 0)
    .sort((a, b) => b.ranked_count - a.ranked_count || b.live_count - a.live_count || (a.category < b.category ? -1 : 1));

  const radar: RadarData = {
    meta: {
      as_of: snapshot.as_of,
      source: plainSource(snapshot.source),
      floor_usd: snapshot.floor_usd,
      model_version: model.version,
      generated: 'token-radar sweep',
    },
    model,
    validation,
    stats: {
      protocols: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      pre_token: preToken.length,
      ranked: board.length,
      watchlist_ranked: board.filter((r) => watchlist.has(r.slug)).length,
      early_rows: board.filter((r) => !watchlist.has(r.slug)).length,
      token_recorded: tokenRecorded,
      token_with_mcap: tokenWithMcap,
      live_count: live.length,
      excluded_products: excludedProducts,
      categories: categories.length,
    },
    categories,
    rows: board.map((row) => radarRow(row, index.get(row.slug)!, {
      median: boardMedian,
      percentile: board.length <= 1 ? 1 : (board.length - row.rank) / (board.length - 1),
    })),
    live,
  };
  return { board, radar, book };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null. Implements each gate row the model can check. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot, model: ModelConstants = MODEL): string | null {
  if (board.length < model.board_min_rows || board.length > model.board_max_rows) {
    return `the board has ${board.length} rows, outside the gate's ${model.board_min_rows}..${model.board_max_rows}`;
  }
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const row of board) {
    if (!known.has(row.slug)) return `the board names ${row.slug}, which the snapshot does not list`;
    if (seen.has(row.slug)) return `the board names ${row.slug} twice`;
    seen.add(row.slug);
    if (!/^[^\s]{1,128}$/.test(row.slug)) return `${row.slug} is not a slug the gate accepts`;
    if (row.name.trim() === '') return `${row.slug} has no name`;
    if (!Number.isSafeInteger(row.rank) || row.rank <= 0) return `${row.slug} has rank ${row.rank}`;
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0 || row.implied_value_usd > 100_000_000_000_000) {
      return `${row.slug} has implied value ${row.implied_value_usd}`;
    }
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `${row.slug} has ${row.farm_steps.length} farm steps`;
    for (const step of row.farm_steps) {
      const trimmed = step.trim();
      if (trimmed.length < 20 || trimmed.length > 600) return `${row.slug} has a farm step of ${trimmed.length} characters`;
    }
  }
  const missing = snapshot.watchlist.filter((slug) => !seen.has(slug));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && board.every((r) => r.implied_value_usd === board[0]!.implied_value_usd)) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  const json = JSON.stringify(radar).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `window.RADAR=${json};\n`;
}
