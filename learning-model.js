/* Standalone indicator-mechanism demonstrations, not strategy execution. */
(function(root){
'use strict';
const valid=Number.isFinite;
function sma(a,n){return a.map((_,i)=>i<n-1||!a.slice(i-n+1,i+1).every(valid)?null:a.slice(i-n+1,i+1).reduce((s,v)=>s+v,0)/n);}
function ema(a,n){const out=Array(a.length).fill(null);let seed=[];for(let i=0;i<a.length;i++){if(!valid(a[i])){seed=[];continue;}if(i&&valid(out[i-1]))out[i]=out[i-1]+2/(n+1)*(a[i]-out[i-1]);else{seed.push(a[i]);if(seed.length===n)out[i]=seed.reduce((s,v)=>s+v,0)/n;}}return out;}
function wilder(a,n){const out=Array(a.length).fill(null);let seed=[];for(let i=0;i<a.length;i++){if(!valid(a[i]))continue;if(i&&valid(out[i-1]))out[i]=(out[i-1]*(n-1)+a[i])/n;else{seed.push(a[i]);if(seed.length===n)out[i]=seed.reduce((s,v)=>s+v,0)/n;}}return out;}
function rsi(a,n=14){const gain=a.map((v,i)=>i?Math.max(0,v-a[i-1]):null),loss=a.map((v,i)=>i?Math.max(0,a[i-1]-v):null);const g=wilder(gain,n),l=wilder(loss,n);return a.map((_,i)=>!valid(g[i])?null:g[i]+l[i]===0?50:100*g[i]/(g[i]+l[i]));}
function trueRange(rows){return rows.map((r,i)=>i?Math.max(r.high-r.low,Math.abs(r.high-rows[i-1].close),Math.abs(r.low-rows[i-1].close)):null);}
function adx(rows,n=14){const atr=wilder(trueRange(rows),n);const plus=wilder(rows.map((r,i)=>{if(!i)return null;const up=r.high-rows[i-1].high,down=rows[i-1].low-r.low;return up>0&&up>down?up:0;}),n);const minus=wilder(rows.map((r,i)=>{if(!i)return null;const up=r.high-rows[i-1].high,down=rows[i-1].low-r.low;return down>0&&down>up?down:0;}),n);const p=plus.map((v,i)=>valid(v)&&atr[i]?100*v/atr[i]:null),m=minus.map((v,i)=>valid(v)&&atr[i]?100*v/atr[i]:null);return {plus:p,minus:m,adx:wilder(p.map((v,i)=>valid(v)&&valid(m[i])?(v+m[i]?100*Math.abs(v-m[i])/(v+m[i]):0):null),n)};}
function sar(rows){let up=true,ep=rows[0].high,af=.02,value=rows[0].low;return rows.map((r,i)=>{if(!i)return null;value+=af*(ep-value);if(up){value=Math.min(value,rows[i-1].low,i>1?rows[i-2].low:rows[i-1].low);if(r.low<value){up=false;value=ep;ep=r.low;af=.02;}else if(r.high>ep){ep=r.high;af=Math.min(.2,af+.02);}}else{value=Math.max(value,rows[i-1].high,i>1?rows[i-2].high:rows[i-1].high);if(r.high>value){up=true;value=ep;ep=r.high;af=.02;}else if(r.low<ep){ep=r.low;af=Math.min(.2,af+.02);}}return value;});}
function supertrend(rows,n=10,m=3){const atr=wilder(trueRange(rows),n);let up=null,down=null,trend=1;return rows.map((r,i)=>{if(!valid(atr[i]))return null;const mid=(r.high+r.low)/2,bu=mid+m*atr[i],bl=mid-m*atr[i];const pu=up,pd=down;up=up===null||bu<up||rows[i-1].close>up?bu:up;down=down===null||bl>down||rows[i-1].close<down?bl:down;if(pu!==null&&r.close>pu)trend=1;else if(pd!==null&&r.close<pd)trend=-1;return trend===1?down:up;});}
function series(mode='reversal'){
 const close=Array.from({length:320},(_,i)=>{let t=i-200;return i<200?108-i*.03+.25*Math.sin(i/4):mode==='range'?102+2.5*Math.sin(t/6)+.3*Math.sin(t*2):mode==='fall'?102-t*.1+1.3*Math.sin(t/6):102+(t<45?-t*.09:-4.05+(t-45)*.2)+.8*Math.sin(t/4);});
 return close.map((c,i)=>{const o=i?close[i-1]:c+.1;return {index:i,open:o,high:Math.max(c,o)+.23+.18*(1+Math.sin(i*1.3)),low:Math.min(c,o)-.23-.12*(1+Math.cos(i*.7)),close:c,volume:100+40*(1+Math.sin(i*.4))+(i%23===0?180:0)};});
}
const colors=['var(--chart-gold, #dfa150)','var(--chart-blue, #7280dd)','var(--chart-purple, #b68acb)','var(--chart-up, #269c84)'];
function calculate(kind,mode='reversal'){
 const rows=series(mode),c=rows.map(r=>r.close), overlays=[],oscillators=[];let label='', thresholds=[];
 const line=(label,data,color,points=false)=>({label,data,color,points});
 if(kind==='bbands') {const mid=sma(c,20);const dev=c.map((_,i)=>i<19?null:Math.sqrt(c.slice(i-19,i+1).reduce((sum,v)=>sum+(v-mid[i])**2,0)/20));overlays.push(line('SMA20',mid,colors[0]),line('上轨 +2σ',mid.map((v,i)=>valid(v)?v+2*dev[i]:null),colors[1]),line('下轨 −2σ',mid.map((v,i)=>valid(v)?v-2*dev[i]:null),colors[2]));label='教学参数：Close / N=20 / ±2σ（总体标准差）';}
 else if(kind==='sar'){overlays.push(line('SAR 示例',sar(rows),colors[2],true));label='教学参数：AF=0.02，最大 0.2；简化初始方向，非 TA-Lib 逐位复现';}
 else if(kind==='supertrend'){overlays.push(line('Supertrend',supertrend(rows),colors[3]));label='教学参数：Wilder ATR10 × 3；原策略可能使用不同 ATR 平滑';}
 else if(kind==='execution'){let pv=0,vol=0;overlays.push(line('累计 VWAP',rows.map(r=>{pv+=r.close*r.volume;vol+=r.volume;return pv/vol;}),colors[1]),line('20 根等权均价',sma(c,20),colors[0]));label='教学基准：累计成交量加权 Close 与 SMA20；不模拟拆单或真实成交';}
 else if(kind==='price'){label='原始 OHLC 教学图；本策略的特殊指标/时间条件见下方公式与源码';}
 else {if(kind==='ema')overlays.push(line('EMA20',ema(c,20),colors[0]),line('EMA50',ema(c,50),colors[1]),line('EMA100',ema(c,100),colors[2]));
 if(kind==='rsi'){oscillators.push(line('RSI14',rsi(c),colors[1]));thresholds=[30,70];label='教学参数：Wilder RSI14；30 / 70 仅是参考线，请对照本策略阈值';}
 else if(kind==='macd'){const fast=ema(c,12),slow=ema(c,26),macd=c.map((_,i)=>valid(slow[i])?fast[i]-slow[i]:null),sig=ema(macd,9);oscillators.push(line('MACD(12,26)',macd,colors[0]),line('Signal9',sig,colors[1]),line('Histogram',macd.map((v,i)=>valid(sig[i])?v-sig[i]:null),colors[3]));thresholds=[0];label='教学参数：12 / 26 / 9；各 EMA 独立 SMA 初始化，非 TA-Lib MACD 种子逐位复现';}
 else if(kind==='adx'){const a=adx(rows);oscillators.push(line('+DI14',a.plus,colors[3]),line('−DI14',a.minus,'var(--chart-down, #d26467)'),line('ADX14',a.adx,colors[1]));thresholds=[25];label='教学参数：Wilder ADX14；25 仅为强度参考，ADX 本身没有多空方向';}
 else label='教学参数：原始 Close 的 EMA20 / 50 / 100；策略实际周期见公式卡与参数表';}
 return {rows,overlays,oscillators,label,thresholds};
}
function normalize(values,end){const segment=values.slice(0,end),lo=Math.min(...segment),hi=Math.max(...segment);return values.map(v=>hi===lo?0:(v-lo)/(hi-lo));}
const api={sma,ema,wilder,rsi,trueRange,adx,sar,supertrend,series,calculate,normalize};if(typeof module!=='undefined')module.exports=api;else root.LearningModel=api;
})(typeof window!=='undefined'?window:globalThis);
