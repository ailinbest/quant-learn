const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const model=require('./learning-model.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);
function readCatalog(){const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'catalog.js'),'utf8'),context);return JSON.parse(JSON.stringify(context.window.StrategyCatalog));}
function walk(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(folder,e.name)):e.name.endsWith('.py')?[path.join(folder,e.name)]:[]);}
test('all strategy files, including nested directories, have substantive audited lessons',()=>{
 const c=readCatalog(),root=path.join(__dirname,'sources/strategies');
 const files=walk(root).map(p=>path.relative(root,p).replace(/\.py$/,''));
 assert.equal(files.length,68);assert.deepEqual([...c.strategies].sort(),files.sort());assert.equal(new Set(c.entries.map(e=>e.id)).size,68);
 for(const e of c.entries){assert.equal(e.lesson.id,e.id);for(const field of ['summary','title','category'])assert.ok(e.lesson[field].length>1,`${e.id}: ${field}`);for(const field of ['entry','exit','risk','strengths','weaknesses','suitable','unsuitable','walkthrough','sourceNotes'])assert.ok(e.lesson[field].length>0,`${e.id}: ${field}`);assert.ok(e.lesson.walkthrough.length>=3,e.id);for(const i of e.lesson.indicators){assert.ok(i.formula.length>8,`${e.id}: ${i.key}`);assert.ok(i.usage.length>8,`${e.id}: ${i.key}`);}assert.ok(['ema','bbands','rsi','macd','adx','sar','supertrend','execution','price'].includes(e.lesson.chart.kind),e.id);if(e.group==='lookahead_bias')assert.equal(e.lesson.status,'biased');}
});
test('source snapshots, hashes, parameter and note locations match real files',()=>{
 const c=readCatalog();for(const e of c.entries){const source=fs.readFileSync(path.join(__dirname,e.path),'utf8');assert.equal(e.source,source,e.id);assert.equal(e.sha256,crypto.createHash('sha256').update(source).digest('hex'));const lines=source.split('\n');for(const n of e.lesson.sourceNotes){assert.ok(Number.isInteger(n.line)&&n.line>=1&&n.line<=lines.length,`${e.id}: invalid source note ${n.line}`);}for(const p of e.parameters)assert.ok(lines[p.line-1].includes(p.name),`${e.id}: ${p.name}`);}
});
test('saved parameter values are separate from declaration defaults',()=>{
 const entry=readCatalog().entries.find(e=>e.id==='Strategy005');const p=entry.parameters.find(p=>p.name==='buy_rsi');assert.equal(p.options.default,30);assert.equal(p.saved,26);assert.equal(p.savedFrom,'buy_params');
});
test('EMA and SMA hand-calculated fixture',()=>{assert.deepEqual(model.sma([1,2,3,6,9],3),[null,null,2,11/3,6]);assert.deepEqual(model.ema([1,2,3,6,9],3),[null,null,2,4,6.5]);});
test('Wilder RSI: monotonic direction and seed boundary',()=>{const up=Array.from({length:30},(_,i)=>100+i),down=up.map(x=>200-x);assert.equal(model.rsi(up)[13],null);assert.equal(model.rsi(up)[14],100);assert.equal(model.rsi(down)[14],0);const fixture=model.rsi([10,12,11,13],3);close(fixture[3],80);});
test('true range includes gaps, not just candle body',()=>{assert.deepEqual(model.trueRange([{high:10,low:8,close:9},{high:14,low:12,close:13},{high:8,low:7,close:7.5}]),[null,5,6]);});
test('all teaching chart kinds have finite visible data across all scenarios',()=>{for(const kind of ['ema','bbands','rsi','macd','adx','sar','supertrend','execution','price'])for(const scenario of ['reversal','range','fall']){const d=model.calculate(kind,scenario);assert.equal(d.rows.length,320);for(const series of [...d.overlays,...d.oscillators])assert.ok(series.data.slice(200).every(Number.isFinite),`${kind}/${scenario}/${series.label}`);for(const r of d.rows){assert.ok(r.high>=Math.max(r.open,r.close));assert.ok(r.low<=Math.min(r.open,r.close));}}});
test('causal indicator prefix stays fixed when future prices change',()=>{const rows=model.series(),a=rows.map(r=>r.close),b=[...a.slice(0,280),...a.slice(280).map(v=>v*5)];assert.deepEqual(model.ema(a,20).slice(0,280),model.ema(b,20).slice(0,280));assert.deepEqual(model.rsi(a).slice(0,280),model.rsi(b).slice(0,280));});
test('global normalization counterexample demonstrably changes the past',()=>{const a=[10,16,11,15,13,12,30];close(model.normalize(a,6)[5],1/3);close(model.normalize(a,7)[5],.1);assert.notEqual(model.normalize(a,6)[5],model.normalize(a,7)[5]);});
