(function () {
'use strict';
var DATA=window.RADAR;
if (!DATA) return;
var app=document.getElementById('app');
if (!app) return;
var state={
tab:'radar',
q:'',
cat:'all',
chain:'all',
scope:'all',
verdict:'all',
sort:'implied',
dir:-1,
selected:null
};
var NF=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
function fmtUsd(n) {
if (n===null||n===undefined||!isFinite(n)) return 'n/a';
var abs=Math.abs(n);
if (abs>=1e12) return '$'+(n/1e12).toFixed(2)+'T';
if (abs>=1e9) return '$'+(n/1e9).toFixed(2)+'B';
if (abs>=1e6) return '$'+(n/1e6).toFixed(1)+'M';
if (abs>=1e3) return '$'+(n/1e3).toFixed(1)+'K';
return '$'+NF.format(n);
}
function fmtSigned(n) {
return (n>=0?'+':'−')+fmtUsd(Math.abs(n));
}
function fmtPct(n) {
if (n===null||n===undefined||!isFinite(n)) return 'n/a';
return (n>0?'+':'')+n.toFixed(2)+'%';
}
function fmtAge(days) {
if (days===null||days===undefined||!isFinite(days)) return 'n/a';
if (days>=365) return (days/365).toFixed(1)+'y';
return Math.max(0,Math.round(days))+'d';
}
function fmtMult(n) {
if (n===null||n===undefined||!isFinite(n)) return 'n/a';
return (n*100).toFixed(1)+'%';
}
function fmtFactor(n) {
return (n===null||n===undefined||!isFinite(n))?'n/a':n.toFixed(3)+'×';
}
function categoryOf(row) {return row.category||'Uncategorized';}
function chainText(row) {
var chains=row.chains||[];
if (chains.length===0) return 'unnamed chain';
return chains.slice(0,2).join(' · ')+(chains.length>2?' +'+(chains.length-2):'');
}
function el(tag,attrs) {
var node=document.createElement(tag);
if (attrs) {
Object.keys(attrs).forEach(function (key) {
var value=attrs[key];
if (value===null||value===undefined) return;
if (key==='class') node.className=value;
else if (key==='text') node.textContent=value;
else if (key==='style') node.setAttribute('style',value);
else if (key.slice(0,2)==='on') node.addEventListener(key.slice(2),value);
else if (value===true) node.setAttribute(key,'');
else node.setAttribute(key,value);
});
}
for (var i=2;i<arguments.length;i++) {
var child=arguments[i];
if (child===null||child===undefined||child===false) continue;
if (Array.isArray(child)) {
child.forEach(function (c) {if (c!==null&&c!==undefined&&c!==false) node.appendChild(c);});
} else if (typeof child==='string'||typeof child==='number') {
node.appendChild(document.createTextNode(String(child)));
} else {
node.appendChild(child);
}
}
return node;
}
function readHash() {
var raw=window.location.hash.slice(1);
if (!raw) return;
var params;
try {params=new URLSearchParams(raw);} catch (err) {return;}
if (params.get('tab')) state.tab=params.get('tab');
if (params.get('q')) state.q=params.get('q');
if (params.get('cat')) state.cat=params.get('cat');
if (params.get('chain')) state.chain=params.get('chain');
if (params.get('scope')) state.scope=params.get('scope');
if (params.get('verdict')) state.verdict=params.get('verdict');
if (params.get('sort')) state.sort=params.get('sort');
if (params.get('dir')) state.dir=Number(params.get('dir'))<0?-1:1;
if (params.get('p')) state.selected=params.get('p');
if (state.tab!=='radar'&&state.tab!=='live'&&state.tab!=='method') state.tab='radar';
if (['FARM','MARGINAL','SKIP'].indexOf(state.verdict)<0) state.verdict='all';
var radarSorts=['implied','rank','name','category','tvl','growth','age','multiple','net'];
var liveSorts=['mcap','name','category','tvl','growth','age','mcap_tvl'];
var allowed=state.tab==='live'?liveSorts:radarSorts;
if (allowed.indexOf(state.sort)<0) state.sort=state.tab==='live'?'mcap':'implied';
}
function writeHash() {
var params=new URLSearchParams();
if (state.tab!=='radar') params.set('tab',state.tab);
if (state.q) params.set('q',state.q);
if (state.cat!=='all') params.set('cat',state.cat);
if (state.chain!=='all') params.set('chain',state.chain);
if (state.scope!=='all') params.set('scope',state.scope);
if (state.verdict!=='all') params.set('verdict',state.verdict);
if (state.sort!=='implied') params.set('sort',state.sort);
if (state.dir!==-1) params.set('dir',String(state.dir));
if (state.selected) params.set('p',state.selected);
var next=params.toString();
try {
window.history.replaceState(null,'',next?'#'+next:window.location.pathname+window.location.search);
} catch (err) {
}
}
function filteredRows() {
var q=state.q.trim().toLowerCase();
return DATA.rows.filter(function (row) {
if (state.cat!=='all'&&categoryOf(row)!==state.cat) return false;
if (state.chain!=='all'&&(row.chains||[]).indexOf(state.chain)<0) return false;
if (state.scope==='watch'&&!row.watchlist) return false;
if (state.scope==='below'&&!row.below_floor) return false;
if (state.scope==='above'&&row.below_floor) return false;
if (state.verdict!=='all'&&row.farm.verdict!==state.verdict) return false;
if (!q) return true;
var hay=[row.name,row.slug,categoryOf(row),row.family,(row.chains||[]).join(' '),row.comparables.group].join(' ').toLowerCase();
return hay.indexOf(q)>=0;
});
}
function filteredLive() {
var q=state.q.trim().toLowerCase();
return DATA.live.filter(function (row) {
if (state.cat!=='all'&&categoryOf(row)!==state.cat) return false;
if (state.chain!=='all'&&(row.chains||[]).indexOf(state.chain)<0) return false;
if (state.scope==='above'&&row.tvl_usd<DATA.meta.floor_usd) return false;
if (state.scope==='below'&&row.tvl_usd>=DATA.meta.floor_usd) return false;
if (!q) return true;
var hay=[row.name,row.slug,categoryOf(row),row.family,(row.chains||[]).join(' '),row.symbol].join(' ').toLowerCase();
return hay.indexOf(q)>=0;
});
}
function valueOf(row,key) {
if (key==='name') return row.name.toLowerCase();
if (key==='category') return categoryOf(row).toLowerCase();
if (key==='tvl') return row.tvl_usd;
if (key==='growth') return row.change_7d===null||row.change_7d===undefined?-Infinity:row.change_7d;
if (key==='age') return row.age_days===null||row.age_days===undefined?Infinity:row.age_days;
if (key==='multiple') return row.implied_multiple;
if (key==='net') return row.farm.net_per_hour;
if (key==='mcap') return row.mcap_usd;
if (key==='mcap_tvl') return row.mcap_tvl;
if (key==='rank') return row.rank||0;
return row.implied_value_usd;
}
function sortedRows(list) {
return list.slice().sort(function (a,b) {
var av=valueOf(a,state.sort);
var bv=valueOf(b,state.sort);
if (av<bv) return-state.dir;
if (av>bv) return state.dir;
return (a.rank||0)-(b.rank||0);
});
}
function dial() {
return el('span',{class:'dial','aria-hidden':'true'},
el('span',{class:'sweep'}),
el('span',{class:'blip b1'}),
el('span',{class:'blip b2'}),
el('span',{class:'blip b3'})
);
}
function masthead() {
return el('header',{class:'masthead'},
el('div',{class:'brand'},
dial(),
el('div',null,
el('div',{class:'eyebrow',text:'Pre-token launch desk / snapshot sweep'}),
el('h1',null,'Token ',el('em',null,'Radar')),
el('p',{class:'sub',text:'No-token records from the sealed snapshot, ranked by implied token value. Watchlist plus early rows; live tokens stay apart as comparables.'})
)
),
el('div',{class:'mast-meta'},
el('span',null,el('span',{class:'live-dot'}),'model ',el('b',{text:DATA.meta.model_version+' + held-out evidence'})),
el('span',null,'snapshot ',el('b',{text:DATA.meta.as_of})),
el('span',null,'source ',el('b',{text:DATA.meta.source})),
el('span',null,el('b',{text:DATA.stats.ranked+' ranked · '+DATA.stats.live_count+' live'}))
)
);
}
function missText(n) {return n.toFixed(2)+'×';}
function verifyBoard() {
var rows=DATA.rows;
var good=0;
var ranks=true;
var falling=true;
for (var i=0;i<rows.length;i++) {
if (recompute(rows[i])===rows[i].implied_value_usd) good++;
if (rows[i].rank!==i+1) ranks=false;
if (i>0&&rows[i].implied_value_usd>rows[i-1].implied_value_usd) falling=false;
}
var L=DATA.ledger;
var reasonSum=L.reasons.reduce(function (s,r) {return s+r.count;},0);
return {
good:good,total:rows.length,ranks:ranks,falling:falling,
watch:rows.filter(function (r) {return r.watchlist;}).length,
ledger:L.ranked===rows.length&&L.ranked+L.token_records+L.excluded===L.total&&reasonSum===L.excluded
};
}
function evidenceStrip() {
var splits=DATA.evidence.splits;
var loo=splits[0];
var time=splits[1];
var v=DATA.stats.farm_verdicts;
var better=Math.round((1-loo.miss_model/loo.miss_flat)*100);
var worse=loo.miss_model>loo.miss_core;
var delta=Math.abs(Math.round((loo.miss_model/loo.miss_core-1)*1000)/10);
var cards=[
{k:'Flat category mcap/TVL · held-out miss',v:missText(loo.miss_flat),small:'LOO n='+loo.n,n:'Raw category median, no size term'},
{k:'2.1 peer + size + factors · held-out miss',v:missText(loo.miss_model),small:better+'% below flat',n:'Target left out of its own peer set'},
{k:'Time split · earlier peers price later',v:missText(time.miss_flat)+' → '+missText(time.miss_model),small:'n='+time.n,n:'Flat versus the same locked 2.1'},
{k:'Net farm @ $10k · 12 weeks',v:'F '+v.FARM+' / M '+v.MARGINAL+' / S '+v.SKIP,small:'selective',n:'Gas and test tx netted out'}
];
return el('div',null,
el('section',{class:'stats','aria-label':'Held-out evidence'},cards.map(function (c) {
return el('div',{class:'stat'},
el('div',{class:'k',text:c.k}),
el('div',{class:'v'},c.v,el('small',{text:c.small})),
el('div',{class:'n',text:c.n})
);
})),
el('p',{class:'kept-line',text:'“Kept” = unchanged radar-2.1. Held out, momentum + tenure + reach miss '+delta+'% '+(worse?'worse':'better')+' than peer + size alone and stay locked. Miss = exp(mean |log(pred/mcap)|), lower better.'})
);
}
function ledgerStrip() {
var L=DATA.ledger;
var c=verifyBoard();
var segments=[
{n:L.ranked,cls:'r',label:'ranked'},
{n:L.token_with_mcap,cls:'t',label:'token trades with mcap'},
{n:L.token_other,cls:'u',label:'token recorded, no mcap'}
].concat(L.reasons.map(function (r,i) {return {n:r.count,cls:'x'+i,label:r.reason};}));
return el('section',{class:'ledger','aria-label':'Protocol accounting and checks'},
el('div',{class:'ledger-top'},
el('span',{class:'ledger-title',text:'PROTOCOL LEDGER'}),
el('div',{class:'ledger-bar','aria-hidden':'true'},segments.map(function (s) {
return el('i',{class:s.cls,style:'width:'+(100*s.n/L.total).toFixed(3)+'%'});
})),
el('span',{class:'ledger-total',text:L.total+' / '+L.total})
),
el('div',{class:'ledger-legend'},
el('span',null,el('i',{class:'r'}),'ranked '+L.ranked),
el('span',null,el('i',{class:'t'}),'token '+L.token_records+' ('+L.token_with_mcap+' with mcap)'),
L.reasons.map(function (r,i) {return el('span',null,el('i',{class:'x'+i}),r.reason+' '+r.count);})
),
el('div',{class:'checks'},
el('span',{class:c.good===c.total?'ok':'bad',text:(c.good===c.total?'✓ ':'✗ ')+c.good+'/'+c.total+' recomputed = board.json'}),
el('span',{class:c.ranks&&c.falling?'ok':'bad',text:(c.ranks&&c.falling?'✓ ':'✗ ')+'ranks 1–'+c.total+', values never rise'}),
el('span',{class:c.watch===DATA.stats.watchlist?'ok':'bad',text:(c.watch===DATA.stats.watchlist?'✓ ':'✗ ')+c.watch+'/'+DATA.stats.watchlist+' watchlist'}),
el('span',{class:c.ledger?'ok':'bad',text:(c.ledger?'✓ ':'✗ ')+L.total+'/'+L.total+' ledger'})
)
);
}
function setTab(tab) {
state.tab=tab;
state.selected=null;
if (tab==='live'&&state.scope==='watch') state.scope='all';
if (tab==='live') state.verdict='all';
if (tab==='live'&&(state.sort==='implied'||state.sort==='multiple'||state.sort==='rank')) {
state.sort='mcap';
state.dir=-1;
}
if (tab!=='live'&&(state.sort==='mcap'||state.sort==='mcap_tvl')) {
state.sort='implied';
state.dir=-1;
}
if (tab==='method') state.selected=null;
writeHash();
render();
}
function tabs() {
var items=[
{id:'radar',label:'Pre-token radar'},
{id:'live',label:'Live comparables'},
{id:'method',label:'Method'}
];
return el('div',{class:'tabs',role:'tablist','aria-label':'Views'},items.map(function (item) {
return el('button',{
type:'button',
role:'tab',
'aria-selected':state.tab===item.id?'true':'false',
onclick:function () {setTab(item.id);}
},item.label);
}));
}
function optionsFor(values) {
return values.map(function (value) {
return el('option',{value:value,text:value==='all'?'All categories':value});
});
}
function controls() {
var rows=state.tab==='live'?DATA.live:DATA.rows;
var cats=Array.from(new Set(rows.map(categoryOf))).sort();
var chains=Array.from(new Set(rows.reduce(function (all,row) {return all.concat(row.chains||[]);},[]))).sort();
var search=el('input',{type:'search',id:'q',placeholder:'Search protocol, category or chain','aria-label':'Search the board',value:state.q});
search.addEventListener('input',function () {state.q=search.value;writeHash();render();});
var cat=el('select',{id:'cat','aria-label':'Filter by category'},
el('option',{value:'all',text:'All categories'}),
optionsFor(cats)
);
cat.value=state.cat;
cat.addEventListener('change',function () {state.cat=cat.value;writeHash();render();});
var chain=el('select',{id:'chain','aria-label':'Filter by chain'},
el('option',{value:'all',text:'All chains'}),
chains.map(function (c) {return el('option',{value:c,text:c});})
);
chain.value=state.chain;
chain.addEventListener('change',function () {state.chain=chain.value;writeHash();render();});
var scope=el('select',{id:'scope','aria-label':'Filter by scope'},
el('option',{value:'all',text:state.tab==='live'?'All live rows':'All pre-token rows'}),
state.tab==='live'?el('option',{value:'above',text:'At or above floor'}):el('option',{value:'watch',text:'Watchlist only'}),
el('option',{value:'below',text:'Below the floor'}),
state.tab==='live'?null:el('option',{value:'above',text:'At or above floor'})
);
scope.value=state.scope;
scope.addEventListener('change',function () {state.scope=scope.value;writeHash();render();});
var verdict=el('select',{id:'verdict','aria-label':'Filter by farm verdict'},
el('option',{value:'all',text:'All verdicts'}),
['FARM','MARGINAL','SKIP'].map(function (v) {return el('option',{value:v,text:v});})
);
verdict.value=state.verdict;
verdict.addEventListener('change',function () {state.verdict=verdict.value;writeHash();render();});
var list=state.tab==='live'?filteredLive():filteredRows();
return el('div',{class:'controls'},
el('div',{class:'field'},el('label',{for:'q',text:'Search'}),search),
el('div',{class:'field'},el('label',{for:'cat',text:'Category'}),cat),
el('div',{class:'field'},el('label',{for:'chain',text:'Chain'}),chain),
el('div',{class:'field'},el('label',{for:'scope',text:'Scope'}),scope),
state.tab==='live'?null:el('div',{class:'field'},el('label',{for:'verdict',text:'Farm'}),verdict),
el('span',{class:'count',text:String(list.length)+' / '+String(rows.length)+' rows'})
);
}
function filtersBar() {
var chips=[];
if (state.q) chips.push(['q','Search: '+state.q]);
if (state.cat!=='all') chips.push(['cat','Category: '+state.cat]);
if (state.chain!=='all') chips.push(['chain','Chain: '+state.chain]);
if (state.scope!=='all') {
var labels={watch:'Watchlist only',below:'Below the floor',above:'At or above the floor'};
chips.push(['scope',labels[state.scope]||state.scope]);
}
if (state.verdict!=='all') chips.push(['verdict','Farm: '+state.verdict]);
if (chips.length===0) return el('div',{class:'filters'});
return el('div',{class:'filters','aria-label':'Active filters'},
el('span',{class:'lead',text:'Filtered by'}),
chips.map(function (chip) {
return el('span',{class:'filter-chip'},chip[1],
el('button',{
type:'button',
'aria-label':'Remove '+chip[1],
text:'×',
onclick:function () {
state[chip[0]]=chip[0]==='q'?'':'all';
writeHash();
render();
}
})
);
}),
el('button',{
class:'clear',
type:'button',
text:'clear all',
onclick:function () {state.q='';state.cat='all';state.chain='all';state.scope='all';state.verdict='all';writeHash();render();}
})
);
}
function sortHeader(key,label,extraClass) {
var active=state.sort===key;
return el('th',{scope:'col',class:extraClass||null,'aria-sort':active?(state.dir<0?'descending':'ascending'):'none'},
el('button',{
type:'button',
onclick:function () {
if (state.sort===key) state.dir=-state.dir;
else {state.sort=key;state.dir=(key==='name'||key==='category')?1:-1;}
writeHash();
render();
}
},label)
);
}
function growthCell(value) {
if (value===null||value===undefined||!isFinite(value)) return el('td',{class:'num flat',text:'n/a'});
return el('td',{class:'num '+(value>=0?'pos':'neg'),text:fmtPct(value)});
}
function verdictTag(row) {
return el('span',{class:'tag verdict '+row.farm.verdict.toLowerCase(),text:row.farm.verdict});
}
function tagFor(row) {
if (row.watchlist) return el('span',{class:'tag watch',text:'watchlist'});
if (row.below_floor) return el('span',{class:'tag early',text:'below floor'});
return el('span',{class:'tag above',text:'above floor'});
}
function boardTable() {
var list=sortedRows(filteredRows());
if (list.length===0) return emptyPanel('No protocol matches that filter','Clear the search or pick another category to see the board again.');
var max=list.reduce(function (m,r) {return Math.max(m,r.implied_value_usd);},1);
var body=el('tbody');
list.forEach(function (row) {
var width=Math.max(3,Math.round((row.implied_value_usd/max)*100));
var tr=el('tr',{
'data-selected':state.selected===row.slug?'true':'false',
class:state.selected===row.slug?'is-selected':null,
tabindex:'0',
onclick:function () {openDetail(row.slug);},
onkeydown:function (e) {if (e.key==='Enter'||e.key===' ') {e.preventDefault();openDetail(row.slug);}}
},
el('td',{class:'rank'+(row.rank<=3?' top':''),text:String(row.rank)}),
el('td',{class:'protocol'},
el('b',{text:row.name}),
el('div',{class:'meta'},tagFor(row),el('span',{class:'dot',text:'·'}),fmtAge(row.age_days)+' no token')
),
el('td',{class:'hide-sm'},el('div',{text:categoryOf(row)}),el('div',{class:'muted',style:'font-size:10px',text:row.family})),
el('td',{class:'chain hide-sm',text:chainText(row)}),
el('td',{class:'num right',text:fmtUsd(row.tvl_usd)}),
growthCell(row.change_7d),
el('td',{class:'num hide-sm',text:fmtAge(row.age_days)}),
el('td',{class:'num right multiple',text:fmtMult(row.implied_multiple)}),
el('td',{class:'farmcell'},
el('div',{class:'farmtop'},verdictTag(row),el('b',{text:fmtSigned(row.farm.net_usd)})),
el('div',{class:'muted',text:(row.farm.net_per_hour>=0?'+':'−')+'$'+Math.abs(row.farm.net_per_hour).toFixed(1)+'/h'})
),
el('td',null,
el('div',{class:'implied'},
el('div',{class:'bar','aria-hidden':'true'},el('i',{style:'width:'+width+'%'})),
el('b',{text:fmtUsd(row.implied_value_usd)})
)
)
);
body.appendChild(tr);
});
return el('div',{class:'panel'},
el('div',{class:'panel-head'},
el('div',null,
el('h2',{text:'The pre-token board'}),
el('p',{text:list.length+' of '+DATA.rows.length+' ranked pre-token protocols · strongest implied value first · net farm on a $10k ticket'})
),
el('p',{class:'muted',style:'text-align:right;max-width:34ch',text:'Watchlist rows are the floor; the early rows below it are the point of the radar.'})
),
el('div',{class:'model-strip','aria-label':'Value model'},
el('span',{class:'eq-label',text:'Locked radar-2.1'}),
el('span',{class:'eq'},
'implied = TVL × ',el('b',{text:'peer multiple'}),' × ',el('b',{text:'size tilt'}),' × ',
el('b',{text:'momentum'}),' × ',el('b',{text:'tenure'}),' × ',el('b',{text:'reach'})
),
el('span',{class:'eq-note',text:'peer = category mcap/TVL at $100M · size = (TVL/$100M)^−'+DATA.model.size_tilt+' · one function, no name list'})
),
el('div',{class:'table-wrap'},
el('table',null,
el('caption',{class:'muted',style:'position:absolute;left:-9999px',text:'Pre-token protocols ranked by implied value'}),
el('thead',null,el('tr',null,
sortHeader('rank','Rank','right'),
sortHeader('name','Protocol'),
sortHeader('category','Category','hide-sm'),
sortHeader('tvl','TVL','hide-sm'),
sortHeader('growth','7d'),
sortHeader('age','Age','hide-sm'),
sortHeader('multiple','Value / TVL','right'),
sortHeader('net','Net farm','right'),
sortHeader('implied','Implied value','right')
)),
body
)
)
);
}
function liveTable() {
var list=sortedRows(filteredLive());
if (list.length===0) return emptyPanel('No live comparable matches that filter','Clear the filters to see the protocols whose token already trades.');
var body=el('tbody');
list.forEach(function (row) {
body.appendChild(el('tr',{class:'live-row'},
el('td',{class:'rank',text:'—'}),
el('td',{class:'protocol'},
el('b',{text:row.name}),
el('div',{class:'meta'},el('span',{class:'tag above',text:row.symbol||'token'}),el('span',{class:'dot',text:'·'}),'already trades')
),
el('td',{class:'hide-sm'},el('div',{text:categoryOf(row)}),el('div',{class:'muted',style:'font-size:10px',text:row.family})),
el('td',{class:'chain hide-sm',text:chainText(row)}),
el('td',{class:'num right',text:fmtUsd(row.tvl_usd)}),
growthCell(row.change_7d),
el('td',{class:'num right',text:fmtUsd(row.mcap_usd)}),
el('td',{class:'num right multiple',text:fmtMult(row.mcap_tvl)}),
el('td',{class:'num hide-sm muted',text:fmtAge(row.age_days)})
));
});
return el('div',{class:'panel'},
el('div',{class:'panel-head'},
el('div',null,
el('h2',{text:'Token already trades'}),
el('p',{text:list.length+' live comparables by market cap · these are facts, not forecasts, and never enter the pre-token rank'})
),
el('p',{class:'muted',style:'text-align:right;max-width:38ch',text:'Their market-cap / TVL multiple is the raw input to the peer book on the Method tab.'})
),
el('div',{class:'table-wrap'},
el('table',null,
el('caption',{class:'muted',style:'position:absolute;left:-9999px',text:'Token-bearing protocols and their market caps'}),
el('thead',null,el('tr',null,
el('th',{scope:'col',class:'right',text:'Status'}),
sortHeader('name','Protocol'),
sortHeader('category','Category','hide-sm'),
el('th',{scope:'col',class:'hide-sm',text:'Chains'}),
sortHeader('tvl','TVL','right'),
sortHeader('growth','7d'),
sortHeader('mcap','Market cap','right'),
sortHeader('mcap_tvl','Mcap / TVL','right'),
sortHeader('age','Listed','hide-sm')
)),
body
)
)
);
}
function emptyPanel(title,text) {
return el('div',{class:'panel'},el('div',{class:'empty'},
el('h2',{text:title}),
el('p',{text:text}),
el('button',{
class:'button primary',
type:'button',
text:'Clear filters',
onclick:function () {state.q='';state.cat='all';state.chain='all';state.scope='all';state.verdict='all';writeHash();render();}
})
));
}
function heldOutCard() {
var splits=DATA.evidence.splits;
var rows=splits.map(function (s) {
return el('tr',null,
el('td',null,el('b',{text:s.name==='leave-one-out'?'Leave-one-out':'Time split'}),el('div',{class:'family',text:s.name==='leave-one-out'?'target removed from every peer set':'only strictly earlier listed peers, at least six'})),
el('td',{class:'num right',text:String(s.n)}),
el('td',{class:'num right',text:s.miss_flat.toFixed(3)+'×'}),
el('td',{class:'num right',text:s.miss_core.toFixed(3)+'×'}),
el('td',{class:'num right multiple',text:s.miss_model.toFixed(3)+'×'}),
el('td',{class:'num right',text:Math.round((1-s.miss_model/s.miss_flat)*100)+'% below flat'})
);
});
var loo=splits[0];
var delta=Math.abs(Math.round((loo.miss_model/loo.miss_core-1)*1000)/10);
return el('section',{class:'card heldout'},
el('h2',{text:'Held-out evidence · recomputed from the sealed snapshot'}),
el('p',{text:'Each token-bearing protocol is scored against peers that exclude it. Flat = raw category mcap/TVL median (family/market fallback), no size term; 2.1 = unchanged peer book and deriveValue on that reduced set. '+DATA.evidence.metric+'.'}),
el('div',{class:'table-wrap'},
el('table',null,
el('thead',null,el('tr',null,
el('th',{scope:'col',text:'Split'}),
el('th',{scope:'col',class:'right',text:'n'}),
el('th',{scope:'col',class:'right',text:'Flat miss'}),
el('th',{scope:'col',class:'right',text:'Peer + size'}),
el('th',{scope:'col',class:'right',text:'Full 2.1'}),
el('th',{scope:'col',class:'right',text:'2.1 vs flat'})
)),
el('tbody',null,rows)
)
),
el('p',{class:'note',text:'2.1 beats flat out of sample; momentum + tenure + reach miss '+delta+'% '+(loo.miss_model>loo.miss_core?'more':'less')+' than peer + size alone but stay locked. No split statistic feeds back into a rank.'})
);
}
function methodView() {
var m=DATA.model;
var equation=el('div',{class:'equation'},
'implied = TVL × ',el('b',{text:'peer multiple'}),' × ',el('b',{text:'size tilt'}),' × ',el('b',{text:'momentum'}),' × ',el('b',{text:'tenure'}),' × ',el('b',{text:'reach'}),'\n',
'peer multiple = shrunk median mcap/TVL of the category, at $100M TVL\n',
'size tilt = (TVL / $100M) ^ -'+m.size_tilt+'\n',
'momentum = 1 + clamp(change_7d, '+m.growth_floor+', '+m.growth_cap+') / 100 × '+m.growth_weight+'\n',
'tenure = '+m.tenure_floor+' + min(age_days, '+m.tenure_days+') / '+m.tenure_days+' × '+m.tenure_range+'\n',
'reach = 1 + (min(chains, '+m.reach_max_chains+') - 1) × '+m.reach_weight
);
var factors=el('dl',{class:'factors'},
el('div',{class:'factor'},el('dt',{text:'Peer multiple'}),el('dd',{text:'Median mcap/TVL of token-bearing same-category peers at $100M TVL; thin categories borrow family, then market.'})),
el('div',{class:'factor'},el('dt',{text:'Size tilt'}),el('dd',{text:'Larger TVL trades at a smaller multiple per dollar; locked exponent −'+m.size_tilt+', damped from the market\'s ~0.64 slope.'})),
el('div',{class:'factor'},el('dt',{text:'Momentum'}),el('dd',{text:'Seven-day TVL change clamped to ['+m.growth_floor+', +'+m.growth_cap+']% and weighted '+Math.round(m.growth_weight*100)+'%.'})),
el('div',{class:'factor'},el('dt',{text:'Tenure'}),el('dd',{text:'Days since DefiLlama listing, capped at '+m.tenure_days+'; unlisted uses '+m.unknown_age_factor+'.'})),
el('div',{class:'factor'},el('dt',{text:'Reach'}),el('dd',{text:'Chain-count premium up to '+m.reach_max_chains+' chains at '+m.reach_weight+' each.'}))
);
var composition=el('div',{class:'composition'},
comp('Protocols in the snapshot',DATA.ledger.total),
comp('Ranked + token + excluded',DATA.ledger.ranked+' + '+DATA.ledger.token_records+' + '+DATA.ledger.excluded,'= '+DATA.ledger.total),
comp('Record no token',DATA.stats.pre_token),
comp('Ranked pre-token rows',DATA.stats.ranked),
comp('Watchlist rows covered',DATA.stats.watchlist_ranked,'/ '+DATA.stats.watchlist),
comp('Early rows outside the watchlist',DATA.stats.early_rows),
comp('Excluded wrapped / staked / bridged / CEX',DATA.stats.excluded_products),
comp('Token-bearing comparables',DATA.stats.token_with_mcap,'/ '+DATA.stats.token_recorded+' token records')
);
var peerRows=DATA.categories.slice(0,18).map(function (c) {
return el('tr',null,
el('td',null,el('b',{text:c.category}),el('div',{class:'family',text:c.family})),
el('td',null,el('span',{class:'kind '+c.kind,text:c.kind})),
el('td',{class:'num right',text:String(c.n)}),
el('td',{class:'num right',text:fmtMult(c.median_ratio)}),
el('td',{class:'num right multiple',text:fmtMult(c.multiple)}),
el('td',{class:'num right',text:String(c.ranked_count)})
);
});
return el('div',null,
heldOutCard(),
el('div',{class:'method'},
el('section',{class:'card'},
el('h2',{text:'The value model'}),
el('p',{text:'One function scores every row from TVL, 7d growth, listing age, category peers and chain count. No name is special-cased.'}),
equation,
factors
),
el('section',{class:'card'},
el('h2',{text:'What the snapshot holds'}),
el('p',{text:'The watchlist is a floor, not a ceiling: all '+DATA.stats.watchlist+' names plus '+DATA.stats.early_rows+' early rows, most below $'+Math.round(DATA.meta.floor_usd/1e6)+'M.'}),
composition,
el('div',{class:'note',text:'Implied value is a model claim, not a price or a promise of a token. "Records no token" is all the snapshot says.'})
)
),
el('section',{class:'peers card'},
el('div',{class:'panel-head'},
el('div',null,
el('h2',{text:'The peer book'}),
el('p',{text:'Category comparables from protocols whose token already trades · median mcap/TVL normalised to $100M TVL · n is the sample size'})
)
),
el('div',{class:'table-wrap'},
el('table',null,
el('thead',null,el('tr',null,
el('th',{scope:'col',text:'Category'}),
el('th',{scope:'col',text:'Group'}),
el('th',{scope:'col',class:'right',text:'n'}),
el('th',{scope:'col',class:'right',text:'Median'}),
el('th',{scope:'col',class:'right',text:'Multiple @ $100M'}),
el('th',{scope:'col',class:'right',text:'Ranked'})
)),
el('tbody',null,peerRows)
)
)
),
el('div',{class:'card',style:'margin-top:16px'},
el('h2',{text:'How to read a row'}),
el('p',{text:'Open any row for its factor arithmetic, recompute check and eight-step costed plan; the plan follows the row\'s category, chains, TVL and age.'})
)
);
}
function comp(label,value,suffix) {
return el('div',{class:'comp'},
el('span',{text:label}),
el('b',null,String(value),suffix?el('small',{text:suffix}):null)
);
}
var dialog=el('dialog',{class:'detail',id:'detail','aria-label':'Protocol detail'});
dialog.addEventListener('close',function () {
if (state.selected) {
state.selected=null;
writeHash();
render();
}
});
function rowBySlug(slug) {
for (var i=0;i<DATA.rows.length;i++) if (DATA.rows[i].slug===slug) return DATA.rows[i];
return null;
}
function recompute(row) {
var m=DATA.model;
var size=Math.pow(Math.max(1,row.tvl_usd)/m.reference_tvl_usd,-m.size_tilt);
var base=Math.min(m.ratio_cap,Math.max(m.ratio_floor,row.comparables.category_multiple*size));
var growthPct=Math.min(m.growth_cap,Math.max(m.growth_floor,row.change_7d===null||row.change_7d===undefined?0:row.change_7d));
var growth=1+(growthPct/100)*m.growth_weight;
var age=row.age_days===null||row.age_days===undefined
?m.unknown_age_factor
:m.tenure_floor+(Math.min(row.age_days,m.tenure_days)/m.tenure_days)*m.tenure_range;
var reach=1+(Math.max(1,Math.min((row.chains||[]).length,m.reach_max_chains))-1)*m.reach_weight;
return Math.max(1,Math.round(row.tvl_usd*base*growth*age*reach));
}
function netFarmBox(row) {
var f=row.farm;
var t=DATA.farm_terms;
var facts=[
el('div',{class:'net-fact'},el('span',{text:'Verdict'}),verdictTag(row),el('em',{text:'4wk T-bill + $'+t.hourly_rate_usd+'/h hurdle '+fmtUsd(f.hurdle_usd)})),
el('div',{class:'net-fact'},el('span',{text:'Dep modelled'}),el('b',{text:fmtUsd(f.drop_usd)}),el('em',{text:'implied × '+(t.drop_share*100).toFixed(0)+'% × '+fmtUsd(f.deposit_usd)+' / max(TVL, ticket)'})),
el('div',{class:'net-fact'},el('span',{text:'Fees'}),el('b',{text:fmtUsd(f.fees_usd)}),el('em',{text:f.gas_events+' gas events at '+f.gas_band+' + $'+f.test_tx_usd+' test tx'})),
el('div',{class:'net-fact'},el('span',{text:'Net / hour'}),el('b',{text:fmtSigned(f.net_usd)}),el('em',{text:(f.net_per_hour>=0?'+':'−')+'$'+Math.abs(f.net_per_hour).toFixed(2)+'/h · '+f.hours.toFixed(2)+' hands-on h'}))
];
return el('section',{class:'section netbox'},
el('h3',{text:'Net farm economics · '+fmtUsd(f.deposit_usd)+' ticket'}),
el('p',{text:t.horizon_weeks+'wk horizon; step deposits stay unchanged. SKIP if fees > drop, FARM only if net > hurdle, else MARGINAL.'}),
el('div',{class:'net-grid'},facts)
);
}
function openDetail(slug) {
var row=rowBySlug(slug);
if (!row) return;
state.selected=row.slug;
writeHash();
dialog.textContent='';
var model=DATA.model;
var c=row.comparables;
var check=recompute(row);
var formula=fmtUsd(row.tvl_usd)+' × '+fmtMult(c.base_multiple)+' × '+fmtFactor(row.model.growth_multiplier)+' × '+fmtFactor(row.model.tenure_multiplier)+' × '+fmtFactor(row.model.reach_multiplier)+' = '+fmtUsd(row.implied_value_usd);
var peers=DATA.live.filter(function (p) {return categoryOf(p)===categoryOf(row);});
if (peers.length<3) {
var familyPeers=DATA.live.filter(function (p) {return p.family===row.family&&peers.indexOf(p)<0;});
peers=peers.concat(familyPeers);
}
peers=peers.slice(0,6);
dialog.appendChild(el('div',{class:'detail-inner'},
el('div',{class:'detail-top'},
el('div',null,
el('div',{class:'eyebrow',text:'Rank '+row.rank+' of '+DATA.stats.ranked+(row.watchlist?' · watchlist':row.below_floor?' · below-floor early row':' · above-floor early row')}),
el('h2',{text:row.name}),
el('p',{class:'sub',text:categoryOf(row)+' · '+(row.chains||[]).join(', ')+' · listed '+(row.listed_at||'unknown')})
),
el('button',{class:'close',type:'button','aria-label':'Close detail',text:'CLOSE ×',onclick:function () {dialog.close();}})
),
el('div',{class:'detail-tags'},
tagFor(row),
el('span',{class:'tag',text:fmtAge(row.age_days)+' no token'}),
el('span',{class:'tag',text:(row.chains||[]).length+' chain(s)'})
),
el('div',{class:'big-value'},
el('b',{text:fmtUsd(row.implied_value_usd)}),
el('span',{text:'implied value · '+fmtMult(row.implied_multiple)+' of TVL · model '+DATA.meta.model_version})
),
el('div',{class:'formula-line'},el('b',{text:formula})),
el('div',{class:'detail-grid'},
el('div',{class:'detail-left'},
el('div',{class:'decomp'},
decomp('TVL',fmtUsd(row.tvl_usd),'snapshot figure'),
decomp('Peer group',c.group,(c.kind==='category'?'category':c.kind==='family'?'peer family':'whole market')+' · n='+c.n),
decomp('Peer multiple',fmtMult(c.category_multiple),'at $100M TVL'),
decomp('Size factor',fmtFactor(c.size_factor),'(TVL / $100M) ^ -'+model.size_tilt),
decomp('Base multiple',fmtMult(c.base_multiple),'peer × size'),
decomp('7d momentum',fmtPct(row.change_7d),fmtFactor(row.model.growth_multiplier)),
decomp('Tenure',fmtAge(row.age_days),fmtFactor(row.model.tenure_multiplier)),
decomp('Reach',(row.chains||[]).length+' chain(s)',fmtFactor(row.model.reach_multiplier)),
decomp('Implied value',fmtUsd(row.implied_value_usd),'model claim, not a price'),
decomp('Page recompute',fmtUsd(check),check===row.implied_value_usd?'matches board.json':'differs from board.json')
),
el('p',{class:'muted',style:'margin-top:9px;font-size:10.5px;line-height:1.5',text:peers.length===0
?'No live comparable in this category or its peer family; the model falls back to the whole snapshot.'
:'Live peer evidence: '+peers.slice(0,3).map(function (p) {return p.name+' at '+fmtMult(p.mcap_tvl);}).join(' · ')}),
netFarmBox(row)
),
el('div',{class:'detail-right'},
el('section',{class:'section'},
el('h3',{text:'Costed farm plan'}),
el('p',{text:'Eight costed, timed steps; action from category, deposit/gas/hold from TVL, chains and age. Use official apps only.'}),
el('div',{class:'plan-summary'},
el('b',{text:(row.steps||[]).length+' steps'}),
' · every step priced and timed · hold ',
el('b',{text:row.steps&&row.steps[5]?row.steps[5].time:'as long as the position earns'}),
' · exit tripwire at −25% TVL or −20% over 7d'
),
el('ol',{class:'steps'},(row.steps||[]).map(function (step,i) {
return el('li',null,
el('div',{class:'step-top'},el('span',{text:String(i+1).padStart(2,'0')}),' · ',step.time),
el('div',{class:'action',text:step.text}),
el('div',{class:'cost-row'},
el('span',{class:'chip cost',text:'Cost: '+step.cost}),
el('span',{class:'chip time',text:'Time: '+step.time})
)
);
}))
),
el('section',{class:'section'},
el('h3',{text:'Peers whose token already trades'}),
el('p',{text:'The raw market evidence behind this category\'s multiple; never ranked with the pre-token board.'}),
peers.length===0
?el('p',{class:'muted',style:'margin-top:10px',text:'No token-bearing comparable in this category on the snapshot; the model falls back to its peer family or the whole market.'})
:el('table',{class:'peer-mini'},
el('thead',null,el('tr',null,
el('th',{scope:'col',text:'Protocol'}),
el('th',{scope:'col',class:'right',text:'TVL'}),
el('th',{scope:'col',class:'right',text:'Mcap'}),
el('th',{scope:'col',class:'right',text:'Mcap / TVL'})
)),
el('tbody',null,peers.map(function (p) {
return el('tr',null,
el('td',{text:p.name}),
el('td',{class:'num right',text:fmtUsd(p.tvl_usd)}),
el('td',{class:'num right',text:fmtUsd(p.mcap_usd)}),
el('td',{class:'num right multiple',text:fmtMult(p.mcap_tvl)})
);
}))
)
)
)
),
el('div',{class:'disclaimer',text:'A model, not a price or a promise. TVL can leave and contracts can fail; verify official docs and size for total loss.'})
));
if (typeof dialog.showModal==='function') {
if (!dialog.open) dialog.showModal();
} else {
dialog.setAttribute('open','');
}
}
function decomp(label,value,note) {
return el('div',{class:'decomp-row'},
el('span',{text:label}),
el('b',{text:value}),
el('em',{text:note})
);
}
function render() {
app.textContent='';
var shell=el('div',{class:'shell'});
shell.appendChild(masthead());
shell.appendChild(evidenceStrip());
shell.appendChild(ledgerStrip());
shell.appendChild(el('div',{class:'toolbar'},tabs(),state.tab==='method'?null:controls()));
if (state.tab!=='method') shell.appendChild(filtersBar());
if (state.tab==='radar') shell.appendChild(boardTable());
else if (state.tab==='live') shell.appendChild(liveTable());
else shell.appendChild(methodView());
shell.appendChild(el('footer',null,
el('span',null,el('b',{text:'Token Radar '+DATA.meta.model_version}),' · snapshot '+DATA.meta.as_of+' · '+DATA.stats.ranked+' pre-token rows · '+DATA.stats.live_count+' live comparables'),
el('span',{text:'No network · every figure in this page comes from the sealed snapshot · an estimate, not a price'})
));
app.appendChild(shell);
app.setAttribute('aria-busy','false');
if (!dialog.isConnected) app.appendChild(dialog);
if (state.selected) openDetail(state.selected);
}
readHash();
render();
window.addEventListener('hashchange',function () {
var before=state.selected;
readHash();
if (state.selected!==before) render();
});
window.addEventListener('keydown',function (e) {
if (e.key==='Escape'&&dialog.open) dialog.close();
});
})();
