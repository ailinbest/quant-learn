/* Offline, source-derived signal fixtures. No order or P&L simulation. */
(function(root){
'use strict';
const cache=new Map(),pending=new Map();let state=null,serial=0,observer;
const names={enter_long:'买入 / 开多',exit_long:'卖出 / 平多',enter_short:'开空条件',exit_short:'平空条件'};
const glyphs={enter_long:'L+',exit_long:'L−',enter_short:'S+',exit_short:'S−'};
const palette=['var(--chart-gold, #dfa150)','var(--chart-blue, #7280dd)','var(--chart-purple, #b68acb)','var(--chart-up, #269c84)','var(--chart-down, #d26467)'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const format=v=>typeof v==='number'?Number(v.toFixed(5)).toLocaleString('en-US',{maximumFractionDigits:5}):v??'—';
function markup(entry){return `<section id="g-lab" class="section"><div class="section-heading"><div><span class="eyebrow">02 / STRATEGY SIGNAL LAB</span><h2>把规则放回 K 线中理解。</h2></div><span class="data-badge">合成行情 · 原始 Python 信号</span></div><p class="section-intro">${esc(entry.lesson.chart.focus)}</p><div class="panel signal-lab"><div id="sl-status" role="status">正在加载 ${esc(entry.name)} 的专属信号样例…</div><div id="sl-content" hidden><div class="lab-toolbar"><label>行情样例 <select id="sl-case"></select></label><label>指标副图 <select id="sl-series"></select></label><label class="sl-merge"><input id="sl-merge" type="checkbox" checked> 合并连续信号</label></div><div id="sl-boundary" class="sl-boundary"></div><div id="sl-summary" class="sl-summary"></div><div class="sl-legend">${Object.keys(names).map(k=>`<span class="sl-${k}"><b>${glyphs[k]}</b> ${names[k]}</span>`).join('')}</div><div id="sl-chart" class="generic-chart"></div><div class="chart-controls"><button id="sl-prev" aria-label="上一根K线">←</button><input id="sl-candle" type="range" min="200" max="319" value="260" aria-label="选择策略K线"><button id="sl-next" aria-label="下一根K线">→</button><span id="sl-date"></span></div><div class="sl-events"><button id="sl-prev-event">← 上一个信号</button><button id="sl-next-event">下一个信号 →</button><span>标记表示收盘后的源码条件成立；连续成立合并时，仅标区段起点（含窗口起点）。</span></div><div id="sl-values" class="chart-readout" aria-live="polite"></div><div id="sl-signals" class="sl-signals" aria-live="polite"></div><details class="sl-checks" open><summary>当前 K 线：条件为什么成立 / 没有成立？</summary><p class="footnote">下表直接记录源码比较结果。不同分支可能使用 AND / OR，不能把所有行当成一组 AND；最终结果以上方信号列为准。点击行号可查看原始组合。</p><div id="sl-check-list"></div></details><details class="sl-inputs"><summary>查看当前 K 线的策略输入值</summary><div id="sl-input-list"></div></details><details class="sl-provenance"><summary>样例参数、计算环境与图表边界</summary><div id="sl-provenance"></div></details></div></div><div class="walkthrough">${entry.lesson.walkthrough.map((s,i)=>`<div><span>0${i+1}</span><h4>${esc(s.title)}</h4><p>${esc(s.detail)}</p></div>`).join('')}</div></section>`;}
function register(id,data){cache.set(id,data);}
function load(id){
 if(cache.has(id))return Promise.resolve(cache.get(id));if(pending.has(id))return pending.get(id);
 const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(`chart-data/${id.replaceAll('/','--')}.js?v=3.0`,document.baseURI).href;script.onload=()=>cache.has(id)?resolve(cache.get(id)):reject(Error('样例文件未注册'));script.onerror=()=>{pending.delete(id);script.remove();reject(Error('样例文件加载失败，请刷新重试'));};document.head.append(script);});pending.set(id,promise);return promise;
}
async function mount(entry){
 const ticket=++serial;state=null;observer?.disconnect();
 try{const bundle=await load(entry.id);if(ticket!==serial||document.getElementById('strategy-lesson')?.hidden)return;
  if(bundle.sourceHash!==entry.sha256)throw Error('源码版本与信号样例不一致，请重新生成样例。');
  if(bundle.error){$('sl-status').innerHTML=`<strong>此源码暂不能生成可信的信号图</strong><p>${esc(bundle.explanation||'该策略在固定样例环境中计算失败，因此没有绘制推测买卖点。')}</p><details><summary>查看计算原因</summary><pre>${esc(bundle.error)}</pre></details><p>请结合本页「买入与卖出」和「源码与参考」阅读具体条件。</p>`;return;}
  state={entry,bundle,caseIndex:Math.max(0,bundle.cases.findIndex(c=>c.counts.enter_long+c.counts.enter_short>0)),index:260,series:0,merge:true};$('sl-status').hidden=true;$('sl-content').hidden=false;
  $('sl-case').innerHTML=bundle.cases.map((c,i)=>`<option value="${i}">${esc(c.title)}</option>`).join('');
  $('sl-case').value=state.caseIndex;
  $('sl-case').onchange=e=>{state.caseIndex=+e.target.value;setCase();};
  $('sl-series').onchange=e=>{state.series=+e.target.value;draw();};
  $('sl-merge').onchange=e=>{state.merge=e.target.checked;draw();};
  $('sl-candle').oninput=e=>{state.index=+e.target.value;draw();};
  $('sl-prev').onclick=()=>move(state.index-1);$('sl-next').onclick=()=>move(state.index+1);
  $('sl-prev-event').onclick=()=>eventMove(-1);$('sl-next-event').onclick=()=>eventMove(1);
  $('sl-provenance').innerHTML=`<p>${esc(bundle.method)}</p><p>${esc(bundle.parameterPolicy)}</p>${bundle.parameters.length?`<dl class="sl-parameters">${bundle.parameters.map(p=>`<div><dt>${esc(p.name)}</dt><dd>${esc(format(p.value))} <small>${esc(p.origin)}</small></dd></div>`).join('')}</dl>`:''}<p>${esc(bundle.environment)}</p>${bundle.compatibility?.length?`<p>${esc(bundle.compatibility.join('；'))}</p>`:''}<p>离线生成，不连接交易所。图上显示 populate_entry_trend / populate_exit_trend 写入的条件列，不把它们当作成交、持仓收益或可用回测。</p>`;
  setCase();observer=new ResizeObserver(()=>state&&draw());observer.observe($('sl-chart'));
 }catch(error){if(ticket===serial&&$('sl-status'))$('sl-status').textContent=error.message;}
}
function setCase(){
 const c=state.bundle.cases[state.caseIndex];state.series=0;
 $('sl-series').innerHTML='<option value="-1">成交量</option>'+c.oscillators.map((s,i)=>`<option value="${i}">${esc(s.label)}</option>`).join('');
 if(!c.oscillators.length)state.series=-1;$('sl-series').value=state.series;
 state.index=markers(c,true).find(m=>m.key==='enter_long'||m.key==='enter_short')?.index??markers(c,true)[0]?.index??260;
 $('sl-boundary').innerHTML=`<p>${esc(state.bundle.boundary)}</p>${state.bundle.notModeled.length?`<p><strong>还要结合：</strong>${esc(state.bundle.notModeled.join('；'))}</p>`:''}${c.warning?`<p class="sl-warning">${esc(c.warning)}</p>`:''}`;
 const counts=Object.entries(c.counts).map(([k,v])=>`${names[k]} ${v} 根`).join(' · ');
 $('sl-summary').textContent=`${c.title} · ${state.bundle.timeframe} · ${counts}。${c.selectionNote}`;
 draw();
}
function markers(c,merge){const result=[];for(const key of Object.keys(names)){const data=c.signals[key];for(let i=200;i<320;i++){if(data[i]===1&&(!merge||i===200||data[i-1]!==1))result.push({key,index:i});}}return result.sort((a,b)=>a.index-b.index);}
function move(i){state.index=Math.max(200,Math.min(319,i));draw();}
function eventMove(direction){const indices=[...new Set(markers(state.bundle.cases[state.caseIndex],state.merge).map(m=>m.index))];const next=direction>0?indices.find(i=>i>state.index):indices.findLast(i=>i<state.index);if(next!==undefined)move(next);}
function svg(tag,attrs,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;return e;}
function draw(){
 if(!state||!$('sl-chart'))return;
 const c=state.bundle.cases[state.caseIndex],host=$('sl-chart'),w=Math.max(260,host.clientWidth),h=470,left=12,right=w-58,rows=c.rows.slice(200),top=28,bottom=292;
 const values=rows.flatMap(r=>[r.low,r.high]).concat(c.overlays.flatMap(s=>s.data.slice(200).filter(Number.isFinite)));let lo=Math.min(...values),hi=Math.max(...values);const pad=(hi-lo)*.16||1;lo-=pad;hi+=pad;
 const x=i=>left+(i-200+.5)/120*(right-left),y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top),cw=Math.max(1,(right-left)/120*.64);
 const chart=svg('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`${state.entry.name} 原始Python信号图；${Object.entries(c.counts).map(([k,v])=>names[k]+v+'根').join('，')}`});
 chart.append(svg('title',{},'点击K线或使用下方滑块，查看源码信号和条件；标记不代表成交。'));
 function axis(min,max,start,end){for(let j=0;j<=4;j++){const v=min+(max-min)*j/4,py=end-(end-start)*j/4;chart.append(svg('line',{x1:left,x2:right,y1:py,y2:py,stroke:'var(--chart-grid, #e8ecf3)','stroke-dasharray':'3 4'}),svg('text',{x:right+5,y:py+3},Math.abs(v)>9999?v.toExponential(1):Number(v.toFixed(2)).toString()));}}
 axis(lo,hi,top,bottom);
 rows.forEach((r,j)=>{const i=j+200,color=r.close>=r.open?'var(--chart-up, #269c84)':'var(--chart-down, #d26467)';chart.append(svg('line',{x1:x(i),x2:x(i),y1:y(r.high),y2:y(r.low),stroke:color}),svg('rect',{x:x(i)-cw/2,y:Math.min(y(r.open),y(r.close)),width:cw,height:Math.max(1,Math.abs(y(r.open)-y(r.close))),fill:color}));});
 function line(series,mapY,color){let path='',open=false;series.data.forEach((v,i)=>{if(i<200)return;if(!Number.isFinite(v)){open=false;return;}path+=`${open?'L':'M'}${x(i)},${mapY(v)} `;open=true;});chart.append(svg('path',{d:path,fill:'none',stroke:color,'stroke-width':1.5}));}
 c.overlays.forEach((s,i)=>line(s,y,palette[i%palette.length]));
 const osc=state.series>=0?c.oscillators[state.series]:null;
 if(osc){const vs=osc.data.slice(200).filter(Number.isFinite);if(vs.length){let a=Math.min(...vs),b=Math.max(...vs),p=(b-a)*.1||1;a-=p;b+=p;const oy=v=>425-(v-a)/(b-a)*95;axis(a,b,330,425);line(osc,oy,palette[1]);chart.append(svg('text',{x:left,y:318},osc.label));}}
 else{const max=Math.max(...rows.map(r=>r.volume));rows.forEach((r,j)=>chart.append(svg('rect',{x:x(j+200)-cw/2,y:425-r.volume/max*90,width:cw,height:r.volume/max*90,fill:'var(--chart-volume-up, #a5d2c3)'})));chart.append(svg('text',{x:left,y:318},'合成成交量'));}
 const marks=markers(c,state.merge);
 marks.forEach(m=>{const r=c.rows[m.index],buy=m.key==='enter_long'||m.key==='exit_short',lane=m.key.includes('short')?30:16,py=y(buy?r.low:r.high)+(buy?lane:-lane),color=m.key.includes('short')?'var(--chart-purple, #b68acb)':buy?'var(--chart-up, #269c84)':'var(--chart-down, #d26467)';const g=svg('g',{'class':'sl-marker',fill:color,'data-signal':m.key,'data-index':m.index});g.append(svg('title',{},`${r.date} · ${names[m.key]}成立`));g.append(svg('path',{d:buy?`M${x(m.index)},${py-6}l-4,7h8z`:`M${x(m.index)},${py+6}l-4,-7h8z`,fill:color}));if(w>700||m.index===state.index)g.append(svg('text',{x:x(m.index),y:py+(buy?13:-8),'text-anchor':'middle',fill:color,'class':'sl-marker-label'},glyphs[m.key]));chart.append(g);});
 for(let i=200;i<320;i+=w<500?40:24)chart.append(svg('text',{x:x(i),y:455,'text-anchor':i===200?'start':'middle'},c.rows[i].date.slice(5,16).replace('T',' ')));
 chart.append(svg('line',{x1:x(state.index),x2:x(state.index),y1:top,y2:430,stroke:'var(--chart-cursor, #8a99b5)','stroke-dasharray':'4 4'}));
 chart.onclick=e=>{const box=chart.getBoundingClientRect();move(200+Math.floor(((e.clientX-box.left)*w/box.width-left)/(right-left)*120));};host.replaceChildren(chart);
 const i=state.index,r=c.rows[i];$('sl-candle').value=i;$('sl-date').textContent=r.date.replace('T',' ').replace('Z',' UTC');$('sl-prev').disabled=i===200;$('sl-next').disabled=i===319;
 $('sl-prev-event').disabled=!marks.some(m=>m.index<i);$('sl-next-event').disabled=!marks.some(m=>m.index>i);
 $('sl-values').innerHTML=`<span><b>O / H / L / C</b> ${[r.open,r.high,r.low,r.close].map(format).join(' / ')}</span>`+c.overlays.map((s,k)=>`<span style="--series:${palette[k%palette.length]}"><i></i><b>${esc(s.label)}</b> ${esc(format(s.data[i]))}</span>`).join('')+(osc?`<span><b>${esc(osc.label)}</b> ${esc(format(osc.data[i]))}</span>`:'');
 $('sl-signals').innerHTML=Object.entries(names).map(([k,n])=>`<span class="${c.signals[k][i]===1?'active sl-'+k:''}"><b>${n}</b> ${c.signals[k][i]===1?'成立':c.signals[k][i]===null?'未写入 / 无效值':'未成立'}</span>`).join('');
 $('sl-check-list').innerHTML=c.checks.length?c.checks.map(check=>`<div class="sl-check-row"><span class="${check.values[i]===true?'pass':'fail'}">${check.values[i]===true?'✓ 成立':check.values[i]===false?'— 未成立':'— 无值'}</span><div><small>${check.phase==='entry'?'开仓方法':'平仓方法'}</small><code>${esc(check.source)}</code>${Object.keys(check.bindings).length?`<small>${esc(Object.entries(check.bindings).map(([k,v])=>`${k}=${v}`).join('，'))}</small>`:''}</div><button class="source-link" data-source-line="${check.line}">L${check.line} ↗</button></div>`).join(''):'<p>该方法没有可逐根展示的布尔比较。请查看源码中的直接赋值，或下方依赖持仓的退出规则。</p>';
 $('sl-input-list').innerHTML=`<dl class="sl-parameters">${c.features.map(s=>`<div><dt>${esc(s.label)}</dt><dd>${esc(format(s.data[i]))}</dd></div>`).join('')}</dl>`;
}
function unmount(){serial++;state=null;observer?.disconnect();}
root.SignalLab={markup,mount,unmount,register,load};
})(window);
