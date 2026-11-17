// The token radar's model: one sealed snapshot in, one ranked board out, every number derived from the
// snapshot's own figures. No protocol name is special-cased and no row is hand-picked.
//
// The model has four moving parts, each stated on the dashboard and shown per row:
//
//   1. peer multiple   the median market-cap / TVL multiple of the protocols in the same category whose
//                      token already trades, normalised to a $100M-TVL reference and shrunk toward the
//                      whole snapshot's median while a category has few comparables;
//   2. size tilt       across the snapshot's token-bearing protocols a larger TVL trades at a smaller
//                      multiple per dollar, so the peer multiple is scaled by (tvl / $100M) ^ -0.28;
//   3. momentum        the seven-day TVL change, clamped to [-40%, +80%] and weighted at 25%;
//   4. tenure + reach  time since DefiLlama first listed the protocol with no token (maturity), and a
//                      small premium for the number of chains the protocol runs on.
//
// Implied value is therefore: TVL x peer multiple x size tilt x momentum x tenure x reach. It is a
// model's claim about what a token would be worth if the protocol's record stayed as it is, never a
// promise that a token will be issued. Token-bearing protocols are kept out of the ranked board and
// shown apart as the market's own comparables.

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
}

export const MODEL: ModelConstants = {
  version: 'radar-2.1',
  reference_tvl_usd: 100_000_000,
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
};

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One comparable group: what a category's token-bearing protocols trade at, per dollar of TVL. */
export interface PeerComparable {
  category: string;
  family: string;
  kind: 'category' | 'family' | 'market';
  n: number;
  median_ratio: number;
  multiple: number;
}

/** The whole snapshot's peer book: every category's comparable multiple, normalised to the reference TVL. */
export interface PeerBook {
  reference_tvl_usd: number;
  global_n: number;
  global_median_ratio: number;
  global_multiple: number;
  categories: Map<string, PeerComparable>;
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
  comparables: {
    group: string;
    kind: 'category' | 'family' | 'market';
    n: number;
    median_ratio: number;
    category_multiple: number;
    size_factor: number;
    base_multiple: number;
  };
  model: {
    growth_pct: number;
    growth_multiplier: number;
    tenure_multiplier: number;
    reach_multiplier: number;
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

/** A token-bearing protocol with a usable market cap and TVL. */
function isComparable(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

/**
 * The peer book: for every category in the snapshot, the median market-cap/TVL multiple of its
 * token-bearing protocols, normalised to the reference TVL (so the size tilt can be applied once,
 * later), then shrunk toward the whole snapshot's median by `shrink_weight` pseudo-observations.
 *
 * A category with at least three comparables stands on its own; a thinner one borrows its peer
 * family; one with neither borrows the whole market. No name is ever consulted.
 */
export function buildPeerBook(protocols: SnapshotProtocol[], model: ModelConstants = MODEL): PeerBook {
  const comparable = protocols.filter(isComparable);
  const normalised = (p: SnapshotProtocol): number => {
    const raw = p.mcap_usd! / p.tvl_usd;
    return clamp(raw * Math.pow(p.tvl_usd / model.reference_tvl_usd, model.size_tilt), 0.01, 4);
  };
  const all = comparable.map(normalised);
  const globalMedian = all.length === 0 ? 0.2 : median(all);

  const byCategory = new Map<string, number[]>();
  const byFamily = new Map<string, number[]>();
  for (const p of comparable) {
    const cat = categoryKey(p);
    const fam = familyOf(p.category);
    const value = normalised(p);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(value);
    if (!byFamily.has(fam)) byFamily.set(fam, []);
    byFamily.get(fam)!.push(value);
  }

  const categories = new Map<string, PeerComparable>();
  const keys = new Set<string>(protocols.map(categoryKey));
  for (const cat of keys) {
    const exact = byCategory.get(cat) ?? [];
    let kind: PeerComparable['kind'] = 'market';
    let sample = all;
    if (exact.length >= 3) {
      kind = 'category';
      sample = exact;
    } else {
      const familySample = byFamily.get(familyOf(cat === 'Uncategorized' ? null : cat)) ?? [];
      if (familySample.length >= 3) {
        kind = 'family';
        sample = familySample;
      }
    }
    const med = sample.length === 0 ? globalMedian : median(sample);
    const multiple =
      kind === 'market' || sample.length === 0
        ? globalMedian
        : (sample.length * med + model.shrink_weight * globalMedian) / (sample.length + model.shrink_weight);
    categories.set(cat, {
      category: cat,
      family: familyOf(cat === 'Uncategorized' ? null : cat),
      kind,
      n: sample.length,
      median_ratio: round4(med),
      multiple: round4(multiple),
    });
  }

  return {
    reference_tvl_usd: model.reference_tvl_usd,
    global_n: all.length,
    global_median_ratio: round4(globalMedian),
    global_multiple: round4(globalMedian),
    categories,
  };
}

/** The comparable group one protocol is scored against, never absent: a missing category takes the market. */
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
  };
}

/** The model's breakdown for one protocol: every multiplier that makes its implied value. */
export interface ValueBreakdown {
  age_days: number | null;
  comparable: PeerComparable;
  size_factor: number;
  base_multiple: number;
  growth_pct: number;
  growth_multiplier: number;
  tenure_multiplier: number;
  reach_multiplier: number;
  implied_value_usd: number;
  implied_multiple: number;
}

/** Score one pre-token protocol, using only the snapshot's own figures and the peer book. */
export function deriveValue(p: SnapshotProtocol, asOf: string, book: PeerBook, model: ModelConstants = MODEL): ValueBreakdown {
  const age = ageDays(asOf, p.listed_at);
  const peer = comparableFor(p, book);
  const sizeFactor = Math.pow(Math.max(1, p.tvl_usd) / model.reference_tvl_usd, -model.size_tilt);
  const baseMultiple = clamp(peer.multiple * sizeFactor, model.ratio_floor, model.ratio_cap);

  const growthPct = clamp(finite(p.change_7d, 0), model.growth_floor, model.growth_cap);
  const growthMultiplier = 1 + (growthPct / 100) * model.growth_weight;

  const tenureMultiplier =
    age === null
      ? model.unknown_age_factor
      : model.tenure_floor + (Math.min(age, model.tenure_days) / model.tenure_days) * model.tenure_range;

  const chainCount = Math.max(1, Math.min(p.chains.length, model.reach_max_chains));
  const reachMultiplier = 1 + (chainCount - 1) * model.reach_weight;

  const implied = Math.max(
    1,
    Math.round(p.tvl_usd * baseMultiple * growthMultiplier * tenureMultiplier * reachMultiplier),
  );

  return {
    age_days: age,
    comparable: peer,
    size_factor: round4(sizeFactor),
    base_multiple: round4(baseMultiple),
    growth_pct: round4(growthPct),
    growth_multiplier: round4(growthMultiplier),
    tenure_multiplier: round4(tenureMultiplier),
    reach_multiplier: round4(reachMultiplier),
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

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. Every branch is decided
 * by the protocol's own record (category, chains, TVL, age), never by a hand-written list of names.
 */
export function farmPlan(p: SnapshotProtocol, age: number | null): FarmStep[] {
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
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; book: PeerBook } {
  const book = buildPeerBook(snapshot.protocols, model);
  const watchlist = new Set(snapshot.watchlist);
  const scored = rankableUniverse(snapshot, model).map((p) => ({ p, value: deriveValue(p, snapshot.as_of, book, model) }));
  scored.sort((a, b) => b.value.implied_value_usd - a.value.implied_value_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  const board = scored.map((s, i) => {
    const plan = farmPlan(s.p, s.value.age_days);
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
      comparables: {
        group: s.value.comparable.kind === 'market' ? 'Whole snapshot' : s.value.comparable.category,
        kind: s.value.comparable.kind,
        n: s.value.comparable.n,
        median_ratio: s.value.comparable.median_ratio,
        category_multiple: s.value.comparable.multiple,
        size_factor: s.value.size_factor,
        base_multiple: s.value.base_multiple,
      },
      model: {
        growth_pct: s.value.growth_pct,
        growth_multiplier: s.value.growth_multiplier,
        tenure_multiplier: s.value.tenure_multiplier,
        reach_multiplier: s.value.reach_multiplier,
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
function radarRow(row: BoardRow, p: SnapshotProtocol): RadarRow {
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
    watchlist: row.watchlist,
    below_floor: row.below_floor,
    comparables: row.comparables,
    model: row.model,
    steps: farmPlan(p, row.age_days),
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
  const { board, book } = buildBoard(snapshot, model);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const watchlist = new Set(snapshot.watchlist);
  const live = liveRows(snapshot);
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
    rows: board.map((row) => radarRow(row, index.get(row.slug)!)),
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
