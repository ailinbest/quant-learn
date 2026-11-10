const assert = require('node:assert/strict');
const test = require('node:test');
const m = require('./model.js');
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-10, `${a} != ${b}`);

test('EMA uses an SMA seed, with unavailable values before warm-up',()=>{
  assert.deepEqual(m.ema([1,2],3),[null,null]);
  assert.deepEqual(m.ema([1,2,3,6,9],3),[null,null,2,4,6.5]);
  assert.deepEqual(m.ema(Array(120).fill(42),100).slice(99),Array(21).fill(42));
});
test('a crossover is a one-bar event, includes prior equality and excludes null seeds',()=>{
  assert.equal(m.crossed(101,100,100,100),true);
  assert.equal(m.crossed(102,100,101,100),false);
  assert.equal(m.crossed(100,100,99,100),false);
  assert.equal(m.crossed(101,100,null,100),false);
});
test('HA initialization, recursion and wick bounds use original OHLC',()=>{
  const r=m.analyze([{open:100,high:104,low:98,close:102},{open:102,high:106,low:100,close:104}]);
  near(r[0].haClose,101);near(r[0].haOpen,101);
  near(r[1].haOpen,101);near(r[1].haClose,103);
  near(r[1].haHigh,106);near(r[1].haLow,100);
  assert.equal(r[0].entry,false);assert.equal(r[0].exit,false);
});
test('ROI changes at exactly 20, 30 and 60 minutes',()=>{
  assert.deepEqual([0,19,20,29,30,59,60,120].map(m.roi),[.05,.05,.04,.04,.03,.03,.01,.01]);
  assert.equal(m.roiReached(60,.01),false);
  assert.equal(m.roiReached(60,.010001),true);
});
test('teaching fixtures actually contain the advertised signals',()=>{
  const trend=m.scenario('trend'), exit=m.scenario('exit'), chop=m.scenario('chop'), stop=m.scenario('stop');
  assert.equal(trend[288].entry,true);assert.equal(trend[289].entry,false);
  assert.equal(exit[303].exit,true);assert.equal(exit[304].exit,false);
  assert.ok(exit[302].ema50<=exit[302].ema100);assert.ok(exit[303].ema50>exit[303].ema100);
  assert.equal(chop.slice(240).filter(c=>c.entry).length,3);
  assert.ok(stop[330].low>90);assert.ok(stop[331].low<=90);
  for(const r of [...trend,...exit,...chop,...stop]) {
    assert.ok(r.high>=Math.max(r.open,r.close));assert.ok(r.low<=Math.min(r.open,r.close));
  }
});
test('prefix calculations do not depend on future candles',()=>{
  const full=m.scenario('exit');
  const partial=m.analyze(full.slice(0,304));
  for(const key of ['ema20','ema50','ema100','haOpen','haClose'])near(partial[303][key],full[303][key]);
  assert.deepEqual(partial[303].sell,full[303].sell);
});
test('the bundled source snapshot matches the local strategy file',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'catalog.js'),'utf8'),context);
  assert.equal(context.window.StrategyCatalog.source,fs.readFileSync(path.join(__dirname,'sources/strategies/Strategy001.py'),'utf8'));
});
