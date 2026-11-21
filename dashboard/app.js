// Token Radar's page: reads window.RADAR (written beside dashboard/ by main.ts) and renders the ranked
// pre-token board, live comparables, the model's method and a per-protocol detail drawer. No network:
// every figure is in data.js and every value is recomputed from the row's own fields.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  if (!app) return;
  var state = { tab: 'radar', q: '', cat: 'all', chain: 'all', scope: 'all', verdict: 'all', sort: 'implied', dir: -1, selected: null };
  var NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var sortedImplied = DATA.rows.map(function (r) { return r.implied_value_usd; }).sort(function (a, b) { return a - b; });
  var MEDIAN = sortedImplied.length ? (sortedImplied[Math.floor((sortedImplied.length - 1) / 2)] + sortedImplied[Math.ceil((sortedImplied.length - 1) / 2)]) / 2 : 1;

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var a = Math.abs(n);
    if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + NF.format(n);
  }
  function fmtPct(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (n > 0 ? '+' : '') + n.toFixed(2) + '%'; }
  function fmtAge(d) { return (d === null || d === undefined || !isFinite(d)) ? 'n/a' : d >= 365 ? (d / 365).toFixed(1) + 'y' : Math.max(0, Math.round(d)) + 'd'; }
  function fmtMult(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : (n * 100).toFixed(1) + '%'; }
  function fmtFactor(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : n.toFixed(3) + '×'; }
  function categoryOf(r) { return r.category || 'Uncategorized'; }
  function chainText(r) { return (r.chains || []).length === 0 ? 'unnamed chain' : r.chains.slice(0, 2).join(' · ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : ''); }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style') node.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x !== null && x !== undefined && x !== false) node.appendChild(x); });
      else node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return node;
  }

  // ---------------------------------------------------------------- hash state
  function readHash() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    var p;
    try { p = new URLSearchParams(raw); } catch (e) { return; }
    if (p.get('tab')) state.tab = p.get('tab');
    if (p.get('q')) state.q = p.get('q');
    if (p.get('cat')) state.cat = p.get('cat');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('scope')) state.scope = p.get('scope');
    if (p.get('verdict')) state.verdict = p.get('verdict');
    if (p.get('sort')) state.sort = p.get('sort');
    if (p.get('dir')) state.dir = Number(p.get('dir')) < 0 ? -1 : 1;
    if (p.get('p')) state.selected = p.get('p');
    if (['radar', 'live', 'method'].indexOf(state.tab) < 0) state.tab = 'radar';
    if (['FARM', 'THIN', 'SKIP'].indexOf(state.verdict) < 0) state.verdict = 'all';
    var allowed = state.tab === 'live'
      ? ['mcap', 'name', 'category', 'tvl', 'growth', 'age', 'mcap_tvl']
      : ['implied', 'rank', 'name', 'category', 'tvl', 'growth', 'age', 'odds', 'share', 'verdict'];
    if (allowed.indexOf(state.sort) < 0) state.sort = state.tab === 'live' ? 'mcap' : 'implied';
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.tab !== 'radar') p.set('tab', state.tab);
    if (state.q) p.set('q', state.q);
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.scope !== 'all') p.set('scope', state.scope);
    if (state.verdict !== 'all' && state.tab === 'radar') p.set('verdict', state.verdict);
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.dir !== -1) p.set('dir', String(state.dir));
    if (state.selected) p.set('p', state.selected);
    var next = p.toString();
    try { window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search); } catch (e) { /* file:// may refuse */ }
  }

  // ---------------------------------------------------------------- data views
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.cat !== 'all' && categoryOf(r) !== state.cat) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.scope === 'watch' && !r.watchlist) return false;
      if (state.scope === 'below' && !r.below_floor) return false;
      if (state.scope === 'above' && r.below_floor) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, categoryOf(r), r.family, (r.chains || []).join(' '), r.comparables.group, r.verdict].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function filteredLive() {
    var q = state.q.trim().toLowerCase();
    return DATA.live.filter(function (r) {
      if (state.cat !== 'all' && categoryOf(r) !== state.cat) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.scope === 'above' && r.tvl_usd < DATA.meta.floor_usd) return false;
      if (state.scope === 'below' && r.tvl_usd >= DATA.meta.floor_usd) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, categoryOf(r), r.family, (r.chains || []).join(' '), r.symbol].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function valueOf(r, k) {
    if (k === 'name') return r.name.toLowerCase();
    if (k === 'category') return categoryOf(r).toLowerCase();
    if (k === 'tvl') return r.tvl_usd;
    if (k === 'growth') return r.change_7d === null || r.change_7d === undefined ? -Infinity : r.change_7d;
    if (k === 'age') return r.age_days === null || r.age_days === undefined ? Infinity : r.age_days;
    if (k === 'odds') return r.token_odds;
    if (k === 'share') return r.own_share;
    if (k === 'verdict') return r.verdict;
    if (k === 'mcap') return r.mcap_usd;
    if (k === 'mcap_tvl') return r.mcap_tvl;
    if (k === 'rank') return r.rank || 0;
    return r.implied_value_usd;
  }
  function sortedRows(list) {
    return list.slice().sort(function (a, b) {
      var x = valueOf(a, state.sort), y = valueOf(b, state.sort);
      return x < y ? -state.dir : x > y ? state.dir : (a.rank || 0) - (b.rank || 0);
    });
  }

  // ---------------------------------------------------------------- fragments
  function dial() {
    return el('span', { class: 'dial', 'aria-hidden': 'true' }, el('span', { class: 'sweep' }),
      el('span', { class: 'blip b1' }), el('span', { class: 'blip b2' }), el('span', { class: 'blip b3' }));
  }
  function masthead() {
    return el('header', { class: 'masthead' },
      el('div', { class: 'brand' }, dial(), el('div', null,
        el('div', { class: 'eyebrow', text: 'Pre-token launch desk / snapshot sweep' }),
        el('h1', null, 'Token ', el('em', null, 'Radar')),
        el('p', { class: 'sub', text: 'Every protocol on the sealed DefiLlama snapshot that records no token, ranked by implied value. Below-floor early rows are included; token-bearing protocols sit apart as comparables.' })
      )),
      el('div', { class: 'mast-meta' },
        el('span', null, el('span', { class: 'live-dot' }), 'model ', el('b', { text: DATA.meta.model_version })),
        el('span', null, 'snapshot ', el('b', { text: DATA.meta.as_of })),
        el('span', null, 'source ', el('b', { text: DATA.meta.source })),
        el('span', null, el('b', { text: DATA.stats.ranked + ' ranked · ' + DATA.stats.live_count + ' live' }))
      ));
  }

  // Integrity strip: the formula, both blind tests and coverage, all from radar.validation / stats / model.
  function integrity() {
    var v = DATA.validation, s = DATA.stats;
    var kpis = [
      ['Size curve', v.size_curve_kept ? 'KEPT' : 'DROPPED', 'slope ' + v.slope + ' · tilt ' + v.size_tilt + ' · n=' + v.n],
      ['Walk-forward log error', v.walk_forward.curve.median_abs_log_error.toFixed(4), 'vs flat ' + v.walk_forward.flat.median_abs_log_error.toFixed(4) + ' · rho ' + v.walk_forward.curve.spearman + ' = ' + v.walk_forward.flat.spearman],
      ['Leave-one-category-out', v.loco.curve.median_abs_log_error.toFixed(4), 'vs flat ' + v.loco.flat.median_abs_log_error.toFixed(4) + ' · rho ' + v.loco.curve.spearman + ' = ' + v.loco.flat.spearman],
      ['Coverage', s.watchlist_ranked + '/' + s.watchlist, 'watchlist · ' + s.early_rows + ' early · ' + s.ranked + ' ranked · ' + s.live_count + ' live anchors']
    ];
    return el('section', { class: 'integrity', 'aria-label': 'Model integrity and coverage' },
      el('div', { class: 'integrity-eq' }, el('span', { class: 'eyebrow', text: DATA.model.version + ' / integrity' }),
        el('b', { text: 'implied = TVL × peer × size × momentum × tenure × reach × odds × share' })),
      el('div', { class: 'kpis' }, kpis.map(function (k) {
        return el('div', { class: 'kpi' }, el('span', { text: k[0] }), el('b', { text: k[1] }), el('em', { text: k[2] }));
      })));
  }

  function setTab(tab) {
    state.tab = tab;
    state.selected = null;
    if (tab === 'live' && state.scope === 'watch') state.scope = 'all';
    if (tab === 'live' && ['implied', 'multiple', 'rank', 'odds', 'share', 'verdict'].indexOf(state.sort) >= 0) state.sort = 'mcap';
    if (tab !== 'live' && ['mcap', 'mcap_tvl'].indexOf(state.sort) >= 0) state.sort = 'implied';
    writeHash();
    render();
  }
  function tabs() {
    return el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Views' },
      [['radar', 'Pre-token radar'], ['live', 'Live comparables'], ['method', 'Method']].map(function (t) {
        return el('button', { type: 'button', role: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false', onclick: function () { setTab(t[0]); } }, t[1]);
      }));
  }
  function optionsFor(values, allLabel) {
    return [el('option', { value: 'all', text: allLabel })].concat(values.map(function (v) { return el('option', { value: v, text: v }); }));
  }
  function controls() {
    var rows = state.tab === 'live' ? DATA.live : DATA.rows;
    var cats = Array.from(new Set(rows.map(categoryOf))).sort();
    var chains = Array.from(new Set(rows.reduce(function (all, r) { return all.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search protocol, category or chain', 'aria-label': 'Search the board', value: state.q });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    function select(id, label, values, allLabel, key) {
      var s = el('select', { id: id, 'aria-label': label }, optionsFor(values, allLabel));
      s.value = state[key];
      s.addEventListener('change', function () { state[key] = s.value; writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label.replace('Filter by ', '') }), s);
    }
    var scopeOptions = state.tab === 'live' ? ['above', 'below'] : ['watch', 'below', 'above'];
    var scope = el('select', { id: 'scope', 'aria-label': 'Filter by scope' },
      el('option', { value: 'all', text: state.tab === 'live' ? 'All live rows' : 'All pre-token rows' }),
      scopeOptions.map(function (v) { return el('option', { value: v, text: { watch: 'Watchlist only', below: 'Below the floor', above: 'At or above floor' }[v] }); }));
    scope.value = state.scope;
    scope.addEventListener('change', function () { state.scope = scope.value; writeHash(); render(); });
    var list = state.tab === 'live' ? filteredLive() : filteredRows();
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      select('cat', 'Filter by category', cats, 'All categories', 'cat'),
      select('chain', 'Filter by chain', chains, 'All chains', 'chain'),
      el('div', { class: 'field' }, el('label', { for: 'scope', text: 'Scope' }), scope),
      state.tab === 'radar' ? select('verdict', 'Filter by verdict', ['FARM', 'THIN', 'SKIP'], 'All verdicts', 'verdict') : null,
      el('span', { class: 'count', text: list.length + ' / ' + rows.length + ' rows' }));
  }
  function filtersBar() {
    var chips = [];
    if (state.q) chips.push(['q', 'Search: ' + state.q]);
    if (state.cat !== 'all') chips.push(['cat', 'Category: ' + state.cat]);
    if (state.chain !== 'all') chips.push(['chain', 'Chain: ' + state.chain]);
    if (state.scope !== 'all') chips.push(['scope', { watch: 'Watchlist only', below: 'Below the floor', above: 'At or above the floor' }[state.scope]]);
    if (state.verdict !== 'all' && state.tab === 'radar') chips.push(['verdict', 'Verdict: ' + state.verdict]);
    if (chips.length === 0) return el('div', { class: 'filters' });
    return el('div', { class: 'filters', 'aria-label': 'Active filters' }, el('span', { class: 'lead', text: 'Filtered by' }),
      chips.map(function (c) {
        return el('span', { class: 'filter-chip' }, c[1], el('button', { type: 'button', 'aria-label': 'Remove ' + c[1], text: '×', onclick: function () {
          state[c[0]] = c[0] === 'q' ? '' : 'all'; writeHash(); render();
        } }));
      }),
      el('button', { class: 'clear', type: 'button', text: 'clear all', onclick: function () {
        state.q = ''; state.cat = 'all'; state.chain = 'all'; state.scope = 'all'; state.verdict = 'all'; writeHash(); render();
      } }));
  }
  function sortHeader(key, label, cls) {
    var on = state.sort === key;
    return el('th', { scope: 'col', class: cls || null, 'aria-sort': on ? (state.dir < 0 ? 'descending' : 'ascending') : 'none' },
      el('button', { type: 'button', onclick: function () {
        if (state.sort === key) state.dir = -state.dir;
        else { state.sort = key; state.dir = (key === 'name' || key === 'category' || key === 'verdict') ? 1 : -1; }
        writeHash(); render();
      } }, label));
  }
  function growthCell(v) {
    return v === null || v === undefined || !isFinite(v)
      ? el('td', { class: 'num flat', text: 'n/a' })
      : el('td', { class: 'num ' + (v >= 0 ? 'pos' : 'neg'), text: fmtPct(v) });
  }
  function tagFor(r) {
    return el('span', { class: 'tag ' + (r.watchlist ? 'watch' : r.below_floor ? 'early' : 'above'), text: r.watchlist ? 'watchlist' : r.below_floor ? 'below floor' : 'above floor' });
  }
  function verdictBadge(v) { return el('span', { class: 'verdict v-' + v.toLowerCase(), text: v }); }
  function verdictCounts() {
    var c = { FARM: 0, THIN: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { c[r.verdict]++; });
    return c.FARM + ' FARM · ' + c.THIN + ' THIN · ' + c.SKIP + ' SKIP';
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) return emptyPanel('No protocol matches that filter', 'Clear the search or pick another verdict/category to see the board again.');
    var max = list.reduce(function (m, r) { return Math.max(m, r.implied_value_usd); }, 1);
    var body = el('tbody');
    list.forEach(function (r) {
      var width = Math.max(3, Math.round(r.implied_value_usd / max * 100));
      body.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        class: state.selected === r.slug ? 'is-selected' : null, tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'rank' + (r.rank <= 3 ? ' top' : ''), text: String(r.rank) }),
        el('td', { class: 'protocol' }, el('b', { text: r.name }),
          el('div', { class: 'meta' }, tagFor(r), el('span', { class: 'dot', text: '·' }), fmtAge(r.age_days) + ' no token')),
        el('td', { class: 'hide-sm' }, el('div', { text: categoryOf(r) }), el('div', { class: 'muted family', text: r.family })),
        el('td', { class: 'num right', text: fmtUsd(r.tvl_usd) }),
        growthCell(r.change_7d),
        el('td', { class: 'num hide-sm', text: fmtAge(r.age_days) }),
        el('td', { class: 'num center odds', text: r.token_odds.toFixed(2) }),
        el('td', { class: 'num center', text: r.own_share.toFixed(2) }),
        el('td', { class: 'center' }, verdictBadge(r.verdict)),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + width + '%' })),
          el('b', { text: fmtUsd(r.implied_value_usd) })))));
    });
    var m = DATA.model, v = DATA.validation;
    return el('div', { class: 'panel' },
      el('div', { class: 'panel-head' },
        el('div', null, el('h2', { text: 'The pre-token board' }),
          el('p', { text: list.length + ' / ' + DATA.rows.length + ' rows · ranked by implied value · click a row for its arithmetic and farm plan' })),
        el('p', { class: 'muted head-right', text: verdictCounts() + ' · watchlist is the floor' })),
      el('div', { class: 'model-strip', 'aria-label': 'Value model' },
        el('span', { class: 'eq-label', text: 'Value model' }),
        el('span', { class: 'eq', text: 'implied = TVL × peer × size × momentum × tenure × reach × odds × share' }),
        el('span', { class: 'eq-note', text: 'size=(TVL/$100M)^−' + v.size_tilt + ' · odds/share∈[' + m.odds_min + ',' + m.odds_max + '] · peer=category mcap/TVL@$100M · ' + DATA.meta.model_version })),
      el('div', { class: 'table-wrap' }, el('table', null,
        el('caption', { class: 'sr', text: 'Pre-token protocols ranked by implied value' }),
        el('thead', null, el('tr', null,
          sortHeader('rank', 'Rank', 'right'), sortHeader('name', 'Protocol'), sortHeader('category', 'Category', 'hide-sm'),
          sortHeader('tvl', 'TVL', 'right'), sortHeader('growth', '7d'), sortHeader('age', 'Age', 'hide-sm'),
          sortHeader('odds', 'Odds', 'center'), sortHeader('share', 'Share', 'center'),
          sortHeader('verdict', 'Verdict', 'center'), sortHeader('implied', 'Implied value', 'right'))),
        body)));
  }

  function liveTable() {
    var list = sortedRows(filteredLive());
    if (list.length === 0) return emptyPanel('No live comparable matches that filter', 'Clear the filters to see the protocols whose token already trades.');
    var body = el('tbody');
    list.forEach(function (r) {
      body.appendChild(el('tr', { class: 'live-row' },
        el('td', { class: 'rank', text: '—' }),
        el('td', { class: 'protocol' }, el('b', { text: r.name }),
          el('div', { class: 'meta' }, el('span', { class: 'tag above', text: r.symbol || 'token' }), el('span', { class: 'dot', text: '·' }), 'already trades')),
        el('td', { class: 'hide-sm' }, el('div', { text: categoryOf(r) }), el('div', { class: 'muted family', text: r.family })),
        el('td', { class: 'num right', text: fmtUsd(r.tvl_usd) }), growthCell(r.change_7d),
        el('td', { class: 'num right', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num right multiple', text: fmtMult(r.mcap_tvl) }),
        el('td', { class: 'num hide-sm muted', text: fmtAge(r.age_days) })));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'panel-head' },
        el('div', null, el('h2', { text: 'Token already trades' }),
          el('p', { text: list.length + ' live comparables by market cap · facts, not forecasts, never ranked as pre-token' })),
        el('p', { class: 'muted head-right', text: 'mcap/TVL feeds the peer book' })),
      el('div', { class: 'table-wrap' }, el('table', null, el('thead', null, el('tr', null,
        el('th', { scope: 'col', text: 'Status' }), sortHeader('name', 'Protocol'), sortHeader('category', 'Category', 'hide-sm'),
        sortHeader('tvl', 'TVL', 'right'), sortHeader('growth', '7d'), sortHeader('mcap', 'Market cap', 'right'),
        sortHeader('mcap_tvl', 'Mcap / TVL', 'right'), sortHeader('age', 'Listed', 'hide-sm'))), body)));
  }

  function emptyPanel(title, text) {
    return el('div', { class: 'panel' }, el('div', { class: 'empty' }, el('h2', { text: title }), el('p', { text: text }),
      el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () {
        state.q = ''; state.cat = 'all'; state.chain = 'all'; state.scope = 'all'; state.verdict = 'all'; writeHash(); render();
      } })));
  }

  function comp(label, value, suffix) {
    return el('div', { class: 'comp' }, el('span', { text: label }), el('b', null, String(value), suffix ? el('small', { text: suffix }) : null));
  }
  function methodView() {
    var m = DATA.model, v = DATA.validation, s = DATA.stats;
    var equation = el('div', { class: 'equation' },
      'launch = TVL × peer × size × momentum × tenure × reach\n',
      'implied = launch × odds × share = TVL × peer × size × momentum × tenure × reach × odds × share\n',
      'peer = category median mcap/TVL at $100M (family/market fallback)\n',
      'size = (TVL / $100M) ^ -' + v.size_tilt + ' (fitted slope ' + v.slope + ')\n',
      'momentum = 1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 × ' + m.growth_weight + '\n',
      'tenure = ' + m.tenure_floor + ' + min(age_days, ' + m.tenure_days + ') / ' + m.tenure_days + ' × ' + m.tenure_range + '\n',
      'reach = 1 + (min(chains, ' + m.reach_max_chains + ') - 1) × ' + m.reach_weight + '\n',
      'odds = group token rate × age/momentum adjustment, clamped [' + m.odds_min + ', ' + m.odds_max + ']\n',
      'share = shrunk median mcap/(mcap+TVL) of the comparable group');
    function test(label, t, base) {
      return el('div', { class: 'test' }, el('b', { text: label }),
        el('span', { text: 'log error ' + t.median_abs_log_error.toFixed(4) + ' vs flat ' + base.median_abs_log_error.toFixed(4) }),
        el('em', { text: 'Spearman ' + t.spearman + ' vs ' + base.spearman + ' · n=' + t.n + (t.n === base.n ? '' : ' (flat ' + base.n + ')') }));
    }
    var c = { FARM: 0, THIN: 0, SKIP: 0 };
    DATA.rows.forEach(function (r) { c[r.verdict]++; });
    return el('div', null,
      el('div', { class: 'method' },
        el('section', { class: 'card' }, el('h2', { text: 'The value model' }),
          el('p', { text: 'One function scores every row from the snapshot alone: no name is special-cased and no row is hand-picked.' }),
          equation,
          el('div', { class: 'composition' },
            comp('Snapshot protocols', s.protocols), comp('Records no token', s.pre_token), comp('Ranked rows', s.ranked),
            comp('Watchlist covered', s.watchlist_ranked, '/ ' + s.watchlist), comp('Early rows', s.early_rows),
            comp('Live comparables', s.live_count, '/ ' + s.token_with_mcap + ' with mcap'))),
        el('section', { class: 'card' }, el('h2', { text: 'Blind tests: ' + (v.size_curve_kept ? 'size curve kept' : 'size curve dropped') }),
          el('p', { text: 'The fitted log-log size curve is scored against a flat median mcap/TVL baseline on data it never trained on; both tests must match or beat the baseline.' }),
          el('div', { class: 'tests' },
            test('Walk-forward', v.walk_forward.curve, v.walk_forward.flat),
            test('Leave-one-category-out', v.loco.curve, v.loco.flat)),
          el('p', { class: 'note', text: 'Fitted slope ' + v.slope + ' on n=' + v.n + ' comparables; size tilt = 1 − slope = ' + v.size_tilt + '. LOO folds: ' + v.loco.categories.length + ' categories, ' + v.loco.n_scored + ' scored rows.' }),
          el('h2', { class: 'subhead', text: 'The verdict rule' }),
          el('p', { text: 'FARM if token odds ≥ ' + m.verdict_farm_min_odds + ' and implied is at or above the board median (percentile ≥ ' + m.verdict_farm_min_percentile + '). SKIP if odds ≤ ' + m.verdict_skip_max_odds + ' or implied is in the bottom quartile (percentile ≤ ' + m.verdict_skip_max_percentile + '). THIN otherwise. This board: ' + c.FARM + ' FARM / ' + c.THIN + ' THIN / ' + c.SKIP + ' SKIP. The plan\'s $50–$500 capital is never an input.' }),
          el('p', { class: 'note', text: 'Not claimed: a price, a token-launch promise, or a backtest of farm returns. A DefiLlama record can be incomplete, TVL can leave and comparables can be thin. "Records no token" never means "has none".' }))));
  }

  // ---------------------------------------------------------------- detail
  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-label': 'Protocol detail' });
  dialog.addEventListener('close', function () {
    if (state.selected) { state.selected = null; writeHash(); render(); }
  });
  function rowBySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }
  // The page recomputes launch and implied from the row's own fields, using the fitted tilt from
  // radar.validation (DATA.model.size_tilt is only the pre-fit fallback). Both must match board.json.
  function recompute(r) {
    var m = DATA.model, tilt = DATA.validation.size_tilt;
    var size = Math.pow(Math.max(1, r.tvl_usd) / m.reference_tvl_usd, -tilt);
    var base = Math.min(m.ratio_cap, Math.max(m.ratio_floor, r.comparables.category_multiple * size));
    var g = Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d === null || r.change_7d === undefined ? 0 : r.change_7d));
    var growth = 1 + (g / 100) * m.growth_weight;
    var tenure = r.age_days === null || r.age_days === undefined
      ? m.unknown_age_factor : m.tenure_floor + (Math.min(r.age_days, m.tenure_days) / m.tenure_days) * m.tenure_range;
    var reach = 1 + (Math.max(1, Math.min((r.chains || []).length, m.reach_max_chains)) - 1) * m.reach_weight;
    var launch = Math.max(1, Math.round(r.tvl_usd * base * growth * tenure * reach));
    return { launch: launch, implied: Math.max(1, Math.round(launch * r.token_odds * r.own_share)) };
  }
  function decomp(label, value, note) {
    return el('div', { class: 'decomp-row' }, el('span', { text: label }), el('b', { text: value }), el('em', { text: note }));
  }
  function openDetail(slug) {
    var r = rowBySlug(slug);
    if (!r) return;
    state.selected = r.slug;
    writeHash();
    dialog.textContent = '';
    var m = DATA.model, c = r.comparables, check = recompute(r);
    var pct = DATA.rows.length <= 1 ? 1 : (DATA.rows.length - r.rank) / (DATA.rows.length - 1);
    var launchLine = 'launch = ' + fmtUsd(r.tvl_usd) + ' × ' + fmtMult(c.base_multiple) + ' × ' + fmtFactor(r.model.growth_multiplier) +
      ' × ' + fmtFactor(r.model.tenure_multiplier) + ' × ' + fmtFactor(r.model.reach_multiplier) + ' = ' + fmtUsd(check.launch);
    var impliedLine = 'implied = launch ' + fmtUsd(check.launch) + ' × odds ' + r.token_odds.toFixed(2) + ' × share ' + r.own_share.toFixed(2) + ' = ' + fmtUsd(check.implied);
    var match = check.launch === r.launch_value_usd && check.implied === r.implied_value_usd;
    var peers = DATA.live.filter(function (p) { return categoryOf(p) === categoryOf(r); });
    if (peers.length < 3) {
      var fam = DATA.live.filter(function (p) { return p.family === r.family && peers.indexOf(p) < 0; });
      peers = peers.concat(fam);
    }
    peers = peers.slice(0, 6);
    dialog.appendChild(el('div', { class: 'detail-inner' },
      el('div', { class: 'detail-top' },
        el('div', null, el('div', { class: 'eyebrow', text: 'Rank ' + r.rank + ' of ' + DATA.stats.ranked + (r.watchlist ? ' · watchlist' : r.below_floor ? ' · below-floor early row' : ' · above-floor early row') }),
          el('h2', { text: r.name }),
          el('p', { class: 'sub', text: categoryOf(r) + ' · ' + (r.chains || []).join(', ') + ' · listed ' + (r.listed_at || 'unknown') })),
        el('button', { class: 'close', type: 'button', 'aria-label': 'Close detail', text: 'CLOSE ×', onclick: function () { dialog.close(); } })),
      el('div', { class: 'detail-tags' }, tagFor(r), el('span', { class: 'tag', text: fmtAge(r.age_days) + ' no token' }),
        el('span', { class: 'tag', text: (r.chains || []).length + ' chain(s)' }), verdictBadge(r.verdict)),
      el('div', { class: 'big-value' }, el('b', { text: fmtUsd(r.implied_value_usd) }),
        el('span', { text: 'implied · ' + fmtMult(r.implied_multiple) + ' of TVL · ' + (r.implied_value_usd / MEDIAN).toFixed(2) + '× board median · ' + Math.round(pct * 100) + 'th percentile · ' + DATA.meta.model_version })),
      el('div', { class: 'formula-line' }, el('b', { text: launchLine }), el('br'), el('b', { text: impliedLine })),
      el('div', { class: 'decomp' },
        decomp('TVL', fmtUsd(r.tvl_usd), 'snapshot figure'),
        decomp('Peer group', c.group, c.kind + ' · n=' + c.n),
        decomp('Peer multiple', fmtMult(c.category_multiple), 'at $100M TVL'),
        decomp('Size factor', fmtFactor(c.size_factor), '(TVL/$100M)^−' + DATA.validation.size_tilt),
        decomp('Base multiple', fmtMult(c.base_multiple), 'peer × size'),
        decomp('7d momentum', fmtPct(r.change_7d), fmtFactor(r.model.growth_multiplier)),
        decomp('Tenure', fmtAge(r.age_days), fmtFactor(r.model.tenure_multiplier)),
        decomp('Reach', (r.chains || []).length + ' chain(s)', fmtFactor(r.model.reach_multiplier)),
        decomp('Launch value', fmtUsd(r.launch_value_usd), 'TVL × 5 factors'),
        decomp('Token odds', r.token_odds.toFixed(2), 'launch likelihood'),
        decomp('Own share', r.own_share.toFixed(2), 'value to the token'),
        decomp('Implied value', fmtUsd(r.implied_value_usd), 'model claim, not a price'),
        decomp('Page recompute', fmtUsd(check.implied), match ? 'launch ' + fmtUsd(check.launch) + ' matches board.json' : 'differs from board.json')),
      el('p', { class: 'peers-line', text: peers.length === 0
        ? 'No live comparable in this category or family; the model falls back to the whole snapshot.'
        : 'Live comparables (token already trades): ' + peers.slice(0, 4).map(function (p) { return p.name + ' ' + fmtMult(p.mcap_tvl) + ' mcap/TVL'; }).join(' · ') }),
      el('section', { class: 'section' },
        el('h3', { text: 'Costed, timed farm plan' }),
        el('div', { class: 'plan-verdict ' + r.verdict.toLowerCase() }, verdictBadge(r.verdict),
          el('b', { text: 'odds ' + r.token_odds.toFixed(2) + ' · implied ' + (r.implied_value_usd / MEDIAN).toFixed(2) + '× median (' + Math.round(pct * 100) + 'th percentile)' }),
          el('span', { text: 'Rule: FARM ≥' + m.verdict_farm_min_odds + ' odds & ≥median · SKIP ≤' + m.verdict_skip_max_odds + ' odds or bottom quartile · else THIN' })),
        el('p', { text: (r.steps || []).length + ' steps from the protocol\'s category, TVL, chains and age; each priced and timed. Use only its official app; never share a seed phrase or pay an upfront claim fee.' }),
        el('ol', { class: 'steps' }, (r.steps || []).map(function (s, i) {
          return el('li', null, el('div', { class: 'step-top' }, el('span', { text: String(i + 1).padStart(2, '0') }), ' · ', s.time),
            el('div', { class: 'action', text: s.text }),
            el('div', { class: 'cost-row' }, el('span', { class: 'chip cost', text: 'Cost: ' + s.cost }), el('span', { class: 'chip time', text: 'Time: ' + s.time })));
        })),
        el('div', { class: 'disclaimer', text: 'A model, not a price and not a promise of a token. TVL can leave, contracts can fail, records can be incomplete. Size any position so a total loss is survivable.' })),
      el('section', { class: 'section' },
        el('h3', { text: 'Peers whose token already trades' }),
        peers.length === 0 ? el('p', { class: 'muted', text: 'No token-bearing comparable in this category on the snapshot.' })
          : el('table', { class: 'peer-mini' }, el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', class: 'right', text: 'TVL' }),
            el('th', { scope: 'col', class: 'right', text: 'Mcap' }), el('th', { scope: 'col', class: 'right', text: 'Mcap/TVL' }))),
            el('tbody', null, peers.map(function (p) { return el('tr', null, el('td', { text: p.name }),
              el('td', { class: 'num right', text: fmtUsd(p.tvl_usd) }), el('td', { class: 'num right', text: fmtUsd(p.mcap_usd) }),
              el('td', { class: 'num right multiple', text: fmtMult(p.mcap_tvl) })); }))))));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }

  // ---------------------------------------------------------------- render
  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(masthead());
    shell.appendChild(integrity());
    shell.appendChild(el('div', { class: 'toolbar' }, tabs(), state.tab === 'method' ? null : controls()));
    if (state.tab !== 'method') shell.appendChild(filtersBar());
    if (state.tab === 'radar') shell.appendChild(boardTable());
    else if (state.tab === 'live') shell.appendChild(liveTable());
    else shell.appendChild(methodView());
    shell.appendChild(el('footer', null,
      el('span', null, el('b', { text: 'Token Radar ' + DATA.meta.model_version }), ' · snapshot ' + DATA.meta.as_of + ' · ' + DATA.stats.ranked + ' rows · ' + DATA.stats.live_count + ' live comparables'),
      el('span', { text: 'No network · every figure from the sealed snapshot · an estimate, not a price' })));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }
  readHash();
  render();
  window.addEventListener('hashchange', function () {
    var before = state.selected;
    readHash();
    if (state.selected !== before) render();
  });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
