// token-radar-01 entry: reads the sealed snapshot, scores every pre-token protocol with the value model
// in lib/model.ts, writes the ranked board and the dashboard's data, copies the page and screenshots, and
// writes the dossier with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot, SnapshotError } from './lib/model.ts';
import { buildDossier, DossierError } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's caps (reference/gate.json): the text cap shapes the dossier's bytes. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const DOSSIER_MAX_BYTES = 1_572_864;
const PLAIN_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

/** Copy a directory tree of regular files, skipping dot names. Returns the copied relative paths. */
function copyTree(from: string, to: string, skip: (name: string) => boolean = (name) => name.startsWith('.'), root = from): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (skip(name)) continue;
    const source = join(from, name);
    const target = join(to, name);
    const st = statSync(source);
    if (st.isDirectory()) {
      copied.push(...copyTree(source, target, skip, root));
    } else if (st.isFile()) {
      copyFileSync(source, target);
      copied.push(relative(root, source).split('\\').join('/'));
    }
  }
  return copied;
}

/** A whole PNG's width and height from its IHDR, or null. */
function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !magic.every((b, i) => bytes[i] === b)) return null;
  const type = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (type !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** A whole JPEG's width and height from its first start-of-frame marker, or null. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    let marker = bytes[at + 1]!;
    at += 2;
    while (marker === 0xff && at < bytes.length) {
      marker = bytes[at]!;
      at += 1;
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (at + 2 > bytes.length) return null;
    const length = view.getUint16(at);
    if (length < 2 || at + length > bytes.length) return null;
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (at + 7 > bytes.length) return null;
      return { height: view.getUint16(at + 3), width: view.getUint16(at + 5) };
    }
    at += length;
  }
  return null;
}

/** A dashboard file's network smell: https in a link-bearing attribute, a <style> body, CSS, or a JS import specifier. */
function networkIssue(dir: string, files: string[]): string | null {
  for (const rel of files) {
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
    if (!['.html', '.css', '.js', '.mjs'].includes(ext)) continue;
    const text = readFileSync(join(dir, rel), 'utf8');
    if (ext === '.css' && /https?:\/\//i.test(text)) return `${rel}: a CSS file names an http(s) address`;
    if (ext === '.html') {
      for (const match of text.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
        const attrs = match[2] ?? '';
        for (const attr of attrs.matchAll(/[\w:-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g)) {
          if (/https?:\/\//i.test(attr[1] ?? '')) return `${rel}: an HTML attribute names an http(s) address`;
        }
      }
      for (const style of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
        if (/https?:\/\//i.test(style[1] ?? '')) return `${rel}: an HTML <style> body names an http(s) address`;
      }
    }
    if (ext === '.js' || ext === '.mjs') {
      const specifiers: string[] = [];
      for (const m of text.matchAll(/\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)) specifiers.push(m[1] ?? '');
      for (const m of text.matchAll(/\bexport\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g)) specifiers.push(m[1] ?? '');
      for (const m of text.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(m[1] ?? '');
      for (const m of text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(m[1] ?? '');
      if (specifiers.some((s) => /https?:\/\//i.test(s))) return `${rel}: a JavaScript import names an http(s) address`;
    }
  }
  return null;
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

let snapshot;
try {
  snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
} catch (err) {
  if (err instanceof SnapshotError) fail(err.message);
  throw err;
}

const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

// The page: copy dashboard/ whole, then hold it to the gate's shape before the dossier is written.
const dashboardFiles = copyTree(join(here, 'dashboard'), join(out, 'dashboard'));
if (dashboardFiles.length === 0) fail('dashboard/ is empty: the page needs index.html, a .css and a .js');
let dashboardBytes = 0;
for (const rel of dashboardFiles) {
  const path = join(out, 'dashboard', rel);
  const st = statSync(path);
  if (!st.isFile()) fail(`dashboard/${rel} is not a regular file`);
  const name = basename(rel);
  if (!PLAIN_NAME.test(name)) fail(`dashboard/${rel}: a file name is letters, digits and . _ -, 1 to 128 characters`);
  if (rel.split('/').some((part) => part.startsWith('.'))) fail(`dashboard/${rel}: a directory name may not start with a dot`);
  dashboardBytes += st.size;
}
if (dashboardFiles.length > DASHBOARD_CAPS.max_files) fail(`dashboard/ holds ${dashboardFiles.length} files, over ${DASHBOARD_CAPS.max_files}`);
if (dashboardBytes > DASHBOARD_CAPS.max_bytes) fail(`dashboard/ is ${dashboardBytes} bytes, over ${DASHBOARD_CAPS.max_bytes}`);
if (!dashboardFiles.includes('index.html')) fail('dashboard/ has no index.html');
if (!dashboardFiles.some((f) => f.toLowerCase().endsWith('.css'))) fail('dashboard/ has no .css file');
if (!dashboardFiles.some((f) => f.toLowerCase().endsWith('.js'))) fail('dashboard/ has no .js file');
const netIssue = networkIssue(join(out, 'dashboard'), dashboardFiles);
if (netIssue !== null) fail(netIssue);

// The screenshots: exactly 3 or 4, whole PNG/JPEG, within the gate's bytes and pixel bounds.
const shots = copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3 || shots.length > 4) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3 or 4, the board, a detail view and a filtered view`);
}
for (const rel of shots) {
  if (!PLAIN_NAME.test(basename(rel))) fail(`screenshots/${rel}: a name is letters, digits and . _ -, 1 to 128 characters`);
  const path = join(out, 'screenshots', rel);
  const st = statSync(path);
  if (!st.isFile()) fail(`screenshots/${rel} is not a regular file`);
  if (st.size > SCREENSHOT_CAPS.max_bytes) fail(`screenshots/${rel} is ${st.size} bytes, over ${SCREENSHOT_CAPS.max_bytes}`);
  const bytes = readFileSync(path);
  const size = pngSize(bytes) ?? jpegSize(bytes);
  if (size === null) fail(`screenshots/${rel} is not a whole PNG or JPEG`);
  const long = Math.max(size.width, size.height);
  const short = Math.min(size.width, size.height);
  if (long > 1440) fail(`screenshots/${rel} is ${size.width}x${size.height}: its long side is over 1440`);
  if (short < 800) fail(`screenshots/${rel} is ${size.width}x${size.height}: its short side is under 800`);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
let dossier: Uint8Array;
try {
  dossier = buildDossier(out, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: SCREENSHOT_CAPS,
    dashboard: DASHBOARD_CAPS,
  });
} catch (err) {
  if (err instanceof DossierError) fail(err.message);
  throw err;
}
if (dossier.length > DOSSIER_MAX_BYTES) fail(`dossier.json is ${dossier.length} bytes, over the gate's ${DOSSIER_MAX_BYTES}`);
writeFileSync(join(out, 'dossier.json'), dossier);

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const rows = board.slice(0, 15);
const v = radar.validation;
process.stdout.write(
  `token radar ${radar.meta.model_version}: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist ` +
    `(${radar.stats.watchlist_ranked} ranked), ${radar.stats.pre_token} pre-token records, ${board.length} ranked ` +
    `(${radar.stats.early_rows} outside the watchlist), ${radar.stats.token_with_mcap} live comparables\n`,
);
process.stdout.write(
  `token radar: validation ${v.size_curve_kept ? 'size curve KEPT' : 'size curve DROPPED'}: ` +
    `n=${v.n}, slope=${v.slope}, intercept=${v.intercept}, size_tilt=${v.size_tilt}\n`,
);
process.stdout.write(
  `token radar:   walk-forward n_train=${v.walk_forward.n_train} n_test=${v.walk_forward.n_test} ` +
    `curve(spearman=${v.walk_forward.curve.spearman}, logerr=${v.walk_forward.curve.median_abs_log_error}) ` +
    `flat(spearman=${v.walk_forward.flat.spearman}, logerr=${v.walk_forward.flat.median_abs_log_error}) kept=${v.walk_forward.kept}\n`,
);
process.stdout.write(
  `token radar:   leave-one-category-out n_scored=${v.loco.n_scored} across ${v.loco.categories.length} categories ` +
    `curve(spearman=${v.loco.curve.spearman}, logerr=${v.loco.curve.median_abs_log_error}) ` +
    `flat(spearman=${v.loco.flat.spearman}, logerr=${v.loco.flat.median_abs_log_error}) kept=${v.loco.kept}\n`,
);
const dropped = Object.entries(v.terms).filter(([, on]) => !on).map(([name]) => name);
process.stdout.write(`token radar:   terms ${Object.keys(v.terms).join(', ')}; dropped ${dropped.length === 0 ? 'none' : dropped.join(', ')}\n`);
process.stdout.write('token radar: top 15 by implied value\n');
for (const row of rows) {
  const flag = row.watchlist ? 'W' : row.below_floor ? 'early' : 'above';
  process.stdout.write(
    `  ${String(row.rank).padStart(2)}  ${row.name.slice(0, 30).padEnd(30)} ${(row.category ?? 'Uncategorized').slice(0, 24).padEnd(24)} ` +
      `${usd.format(row.tvl_usd).padStart(13)} TVL  ${usd.format(row.implied_value_usd).padStart(13)} implied  ` +
      `${(row.implied_multiple * 100).toFixed(1).padStart(5)}% of TVL  ` +
      `odds ${row.token_odds.toFixed(2)}  share ${row.own_share.toFixed(2)}  ${row.verdict.padEnd(4)}  ${flag}\n`,
  );
}
process.stdout.write(`token radar: boardIssue: ${String(issue)}\n`);
process.stdout.write(
  `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashboardFiles.length} files), ` +
    `${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')} (${dossier.length} bytes)\n`,
);
