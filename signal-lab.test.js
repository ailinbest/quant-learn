const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=__dirname, context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),context);
const entries=JSON.parse(JSON.stringify(context.window.StrategyCatalog.entries));
const keys=['enter_long','exit_long','enter_short','exit_short'];
function fixture(id){let result;vm.runInNewContext(fs.readFileSync(path.join(root,'chart-data',id.replaceAll('/','--')+'.js'),'utf8'),{window:{SignalLab:{register:(registered,data)=>{assert.equal(registered,id);result=data;}}}});return result;}
test('all 68 fixtures bind to current sources, preserve signal states, and contain valid OHLC',()=>{
 assert.equal(entries.length,68);
 for(const entry of entries){const d=fixture(entry.id);assert.equal(d.error,undefined,entry.id);assert.equal(d.sourceHash,entry.sha256);assert.equal(d.cases.length,3);assert.equal(d.audit.originalSignalsMatch,true);
  for(const c of d.cases){assert.equal(c.rows.length,320,entry.id);for(const r of c.rows){assert.ok(r.high>=Math.max(r.open,r.close)&&r.low<=Math.min(r.open,r.close)&&r.low>0&&r.volume>0,entry.id);assert.ok(Number.isFinite(Date.parse(r.date)));}
   for(const k of keys){assert.equal(c.signals[k].length,320);assert.ok(c.signals[k].every(v=>v===null||v===0||v===1));assert.equal(c.counts[k],c.signals[k].slice(200).filter(v=>v===1).length);}
   for(const col of [...c.features,...c.checks])assert.equal((col.data||col.values).length,320);
   for(const check of c.checks){assert.ok(check.line>0&&check.line<=entry.source.split('\n').length);assert.ok(check.values.every(v=>v===true||v===false||v===null));}
   if(d.audit.prefixChanged?.length)assert.match(c.warning,/截断样本/);
  }
 }
});
test('Strategy002 markers require all four entry conditions and both exit conditions',()=>{
 const d=fixture('Strategy002');let entries=0,exits=0;
 for(const c of d.cases){const f=Object.fromEntries(c.features.map(s=>[s.label,s.data]));for(let i=200;i<320;i++){
  const buy=f.rsi[i]<30&&f.slowk[i]<20&&f.bb_lowerband[i]>c.rows[i].close&&f.CDLHAMMER[i]===100;
  const sell=f.sar[i]>c.rows[i].close&&f.fisher_rsi[i]>.3;
  assert.equal(c.signals.enter_long[i]===1,buy,`entry ${c.title}/${i}`);assert.equal(c.signals.exit_long[i]===1,sell,`exit ${c.title}/${i}`);entries+=buy;exits+=sell;
 }}assert.ok(entries>0&&exits>0);
});
test('saved Strategy005 parameters, callback-only exits, and impossible exits remain explicit',()=>{
 const param=fixture('Strategy005').parameters.find(p=>p.name==='buy_rsi');assert.equal(param.value,26);assert.equal(param.origin,'buy_params');
 for(const id of ['TWAPStrategy','AlmgrenChrissStrategy','Strategy001_custom_exit']){const d=fixture(id);assert.ok(d.notModeled.some(n=>n.includes('custom_exit')||n.includes('adjust_trade_position')),id);for(const c of d.cases)assert.equal(c.counts.exit_long+c.counts.exit_short,0);}
 const impossible=fixture('futures/TrendFollowingStrategy');assert.ok(impossible.notModeled.some(n=>n.includes('互相矛盾')));for(const c of impossible.cases)assert.equal(c.counts.exit_long+c.counts.exit_short,0);
 const nothing=fixture('berlinguyinca/DoesNothingStrategy');for(const c of nothing.cases)assert.ok(Object.values(c.counts).every(v=>v===0));
});
test('independent strategies do not silently reuse the same candles or signals',()=>{
 const hashes=entries.map(e=>crypto.createHash('sha256').update(JSON.stringify(fixture(e.id).cases[0].rows)).digest('hex'));assert.equal(new Set(hashes).size,68);
});
test('comparison scale preserves gaps and raw values, handles constants, and uses only the visible window',()=>{
 const sandbox={window:{},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync(path.join(root,'signal-lab.js'),'utf8'),sandbox);
 const project=sandbox.window.SignalLab.plotValues;
 const data=[...Array(200).fill(999999),10,null,20,30,NaN];
 assert.equal(project(data,false),data);
 const result=project(data,true);assert.deepEqual(Array.from(result.slice(200)),[0,null,50,100,null]);
 assert.deepEqual(data.slice(200),[10,null,20,30,NaN]);
 assert.deepEqual(Array.from(project([...Array(200).fill(null),7,7,null],true).slice(200)),[50,50,null]);
 assert.ok(project(Array(320).fill(null),true).every(v=>v===null));
});
