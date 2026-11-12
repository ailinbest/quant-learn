/* Offline, source-derived signal fixtures. No order or P&L simulation. */
(function(root){
'use strict';
const cache=new Map(),pending=new Map();let state=null,serial=0,observer;
const names={enter_long:'买入 / 开多',exit_long:'卖出 / 平多',enter_short:'开空条件',exit_short:'平空条件'};
const glyphs={enter_long:'L+',exit_long:'L−',enter_short:'S+',exit_short:'S−'};
const palette=['var(--chart-gold, #dfa150)','var(--chart-blue, #7280dd)','var(--chart-purple, #b68acb)','var(--chart-up, #269c84)','var(--chart-down, #d26467)'];
function plotValues(data,normalized){
 if(!normalized)return data;
 const finite=data.slice(200).filter(Number.isFinite);
 if(!finite.length)return data.map(()=>null);
 const low=Math.min(...finite),high=Math.max(...finite);
 return data.map(v=>Number.isFinite(v)?(high===low?50:(v-low)/(high-low)*100):null);
}
function availableSeries(c){return [...c.oscillators,{label:'成交量',data:c.rows.map(r=>r.volume),volume:true}];}
function seriesColor(label){return state.colors.get(label);}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const format=v=>typeof v==='number'?Number(v.toFixed(5)).toLocaleString('en-US',{maximumFractionDigits:5}):v??'—';
function markup(entry){return `<section id="g-lab" class="section"><div class="section-heading"><div><span class="eyebrow">02 / STRATEGY SIGNAL LAB</span><h2>把规则放回 K 线中理解。</h2></div><span class="data-badge">合成行情 · 原始 Python 信号</span></div><p class="section-intro">${esc(entry.lesson.chart.focus)}</p><div class="panel signal-lab"><div id="sl-status" role="status">正在加载 ${esc(entry.name)} 的专属信号样例…</div><div id="sl-content" hidden><div class="lab-toolbar"><label>行情样例 <select id="sl-case"></select></label><details class="sl-series-picker" id="sl-series-picker"><summary>指标副图 · <span id="sl-series-count">多选</span></summary><div class="sl-series-menu"><div class="sl-series-actions"><button type="button" id="sl-series-default">默认选择</button><button type="button" id="sl-series-clear">清空</button></div><div id="sl-series" role="group" aria-label="选择副图指标，可多选"></div></div></details><label>副图刻度 <select id="sl-scale"><option value="raw">原始数值 · 共用坐标</option><option value="normalized">各自归一化 · 0–100</option></select></label><label class="sl-merge"><input id="sl-merge" type="checkbox" checked> 合并连续信号</label></div><div id="sl-series-legend" class="sl-series-legend" aria-live="polite"></div><p id="sl-scale-note" class="sl-scale-note"></p><div id="sl-boundary" class="sl-boundary"></div><div id="sl-summary" class="sl-summary"></div><div class="sl-legend">${Object.keys(names).map(k=>`<span class="sl-${k}"><b>${glyphs[k]}</b> ${names[k]}</span>`).join('')}</div><div id="sl-chart" class="generic-chart"></div><div class="chart-controls"><button id="sl-prev" aria-label="上一根K线">←</button><input id="sl-candle" type="range" min="200" max="319" value="260" aria-label="选择策略K线"><button id="sl-next" aria-label="下一根K线">→</button><span id="sl-date"></span></div><div class="sl-events"><button id="sl-prev-event">← 上一个信号</button><button id="sl-next-event">下一个信号 →</button><span>标记表示收盘后的源码条件成立；连续成立合并时，仅标区段起点（含窗口起点）。</span></div><div id="sl-values" class="chart-readout" aria-live="polite"></div><div id="sl-signals" class="sl-signals" aria-live="polite"></div><details class="sl-checks" open><summary>当前 K 线：条件为什么成立 / 没有成立？</summary><p class="footnote">下表直接记录源码比较结果。不同分支可能使用 AND / OR，不能把所有行当成一组 AND；最终结果以上方信号列为准。点击行号可查看原始组合。</p><div id="sl-check-list"></div></details><details class="sl-inputs"><summary>查看当前 K 线的策略输入值</summary><div id="sl-input-list"></div></details><details class="sl-provenance"><summary>样例参数、计算环境与图表边界</summary><div id="sl-provenance"></div></details></div></div><div class="walkthrough">${entry.lesson.walkthrough.map((s,i)=>`<div><span>0${i+1}</span><h4>${esc(s.title)}</h4><p>${esc(s.detail)}</p></div>`).join('')}</div></section>`;}
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
  state={entry,bundle,caseIndex:Math.max(0,bundle.cases.findIndex(c=>c.counts.enter_long+c.counts.enter_short>0)),index:260,selected:null,normalized:false,colors:new Map(),merge:true};$('sl-status').hidden=true;$('sl-content').hidden=false;
  [...new Set(bundle.cases.flatMap(c=>availableSeries(c).map(s=>s.label)))].forEach((label,i)=>state.colors.set(label,`hsl(${(215+i*137.508)%360} 65% var(--sl-series-lightness, 40%))`));
  $('sl-case').innerHTML=bundle.cases.map((c,i)=>`<option value="${i}">${esc(c.title)}</option>`).join('');
  $('sl-case').value=state.caseIndex;
  $('sl-case').onchange=e=>{state.caseIndex=+e.target.value;setCase();};
  $('sl-series').onchange=e=>{const input=e.target;if(!input.matches('input[type="checkbox"]'))return;if(input.checked)state.selected.add(input.value);else state.selected.delete(input.value);draw();};
  $('sl-series-clear').onclick=()=>{state.selected.clear();renderSeriesOptions();draw();};
  $('sl-series-default').onclick=()=>{state.selected=null;renderSeriesOptions();draw();};
  $('sl-scale').onchange=e=>{state.normalized=e.target.value==='normalized';draw();};
  $('sl-series-legend').onclick=e=>{const button=e.target.closest('[data-remove-series]');if(button){state.selected.delete(button.dataset.removeSeries);renderSeriesOptions();draw();}};
  $('sl-merge').onchange=e=>{state.merge=e.target.checked;draw();};
  $('sl-candle').oninput=e=>{state.index=+e.target.value;draw();};
  $('sl-prev').onclick=()=>move(state.index-1);$('sl-next').onclick=()=>move(state.index+1);
  $('sl-prev-event').onclick=()=>eventMove(-1);$('sl-next-event').onclick=()=>eventMove(1);
  $('sl-provenance').innerHTML=`<p>${esc(bundle.method)}</p><p>${esc(bundle.parameterPolicy)}</p>${bundle.parameters.length?`<dl class="sl-parameters">${bundle.parameters.map(p=>`<div><dt>${esc(p.name)}</dt><dd>${esc(format(p.value))} <small>${esc(p.origin)}</small></dd></div>`).join('')}</dl>`:''}<p>${esc(bundle.environment)}</p>${bundle.compatibility?.length?`<p>${esc(bundle.compatibility.join('；'))}</p>`:''}<p>离线生成，不连接交易所。图上显示 populate_entry_trend / populate_exit_trend 写入的条件列，不把它们当作成交、持仓收益或可用回测。</p>`;
  setCase();observer=new ResizeObserver(()=>state&&draw());observer.observe($('sl-chart'));
 }catch(error){if(ticket===serial&&$('sl-status'))$('sl-status').textContent=error.message;}
}
function renderSeriesOptions(){
 const options=availableSeries(state.bundle.cases[state.caseIndex]);
 if(state.selected===null)state.selected=new Set([options[0].label]);
 $('sl-series').innerHTML=options.map(s=>`<label class="sl-series-option"><input type="checkbox" value="${esc(s.label)}" ${state.selected.has(s.label)?'checked':''}><i style="--series:${seriesColor(s.label)}"></i><span>${esc(s.label)}</span></label>`).join('');
}
function setCase(){
 const c=state.bundle.cases[state.caseIndex];renderSeriesOptions();
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
 function line(series,mapY,color,extra={}){let path='',open=false;series.data.forEach((v,i)=>{if(i<200)return;if(!Number.isFinite(v)){open=false;return;}path+=`${open?'L':'M'}${x(i)},${mapY(v)} `;open=true;});chart.append(svg('path',{d:path,fill:'none',stroke:color,'stroke-width':1.5,...extra}));}
 c.overlays.forEach((s,i)=>line(s,y,palette[i%palette.length]));
 const selected=availableSeries(c).filter(s=>state.selected.has(s.label));
 const plotted=selected.map(s=>({...s,data:plotValues(s.data,state.normalized)}));
 $('sl-series-count').textContent=`已选 ${selected.length} 项`;
 $('sl-series-legend').innerHTML=selected.length?selected.map(s=>`<button type="button" data-remove-series="${esc(s.label)}" style="--series:${seriesColor(s.label)}" aria-label="移除 ${esc(s.label)}"><i></i>${esc(s.label)} <span aria-hidden="true">×</span></button>`).join(''):'<span>未选择指标，可展开「指标副图」勾选。</span>';
 $('sl-scale-note').textContent=state.normalized?'各指标按当前可见 120 根的最小 / 最大值映射到 0–100，常数线置于 50；仅比较走势，纵轴不再表示原值，不能用来判断原始阈值或两条线的交叉。下方读数仍为原值。':'所选指标共用原始数值坐标。量纲相差较大时可切换「各自归一化」比较走势；下方读数始终保留原值。';
 const vs=plotted.flatMap(s=>s.data.slice(200).filter(Number.isFinite));
 if(vs.length){
  let a=state.normalized?0:Math.min(...vs),b=state.normalized?100:Math.max(...vs);
  const onlyVolume=selected.length===1&&selected[0].volume;
  if(onlyVolume&&!state.normalized)a=0;
  if(!state.normalized){const p=(b-a)*.1||1;if(!onlyVolume)a-=p;b+=p;}
  const oy=v=>425-(v-a)/(b-a)*95;axis(a,b,330,425);
  if(onlyVolume)plotted[0].data.slice(200).forEach((v,j)=>{if(Number.isFinite(v))chart.append(svg('rect',{x:x(j+200)-cw/2,y:oy(v),width:cw,height:Math.max(0,425-oy(v)),fill:seriesColor(selected[0].label),'data-oscillator':selected[0].label}));});
  else plotted.forEach(s=>line(s,oy,seriesColor(s.label),{'data-oscillator':s.label}));
  chart.append(svg('text',{x:left,y:318},state.normalized?'副图 · 归一化 0–100':'副图 · 原始数值'));
 }else chart.append(svg('text',{x:left,y:370},selected.length?'本段没有可绘制的有效指标值':'请选择副图指标'));
 const marks=markers(c,state.merge);
 marks.forEach(m=>{const r=c.rows[m.index],buy=m.key==='enter_long'||m.key==='exit_short',lane=m.key.includes('short')?30:16,py=y(buy?r.low:r.high)+(buy?lane:-lane),color=m.key.includes('short')?'var(--chart-purple, #b68acb)':buy?'var(--chart-up, #269c84)':'var(--chart-down, #d26467)';const g=svg('g',{'class':'sl-marker',fill:color,'data-signal':m.key,'data-index':m.index});g.append(svg('title',{},`${r.date} · ${names[m.key]}成立`));g.append(svg('path',{d:buy?`M${x(m.index)},${py-6}l-4,7h8z`:`M${x(m.index)},${py+6}l-4,-7h8z`,fill:color}));if(w>700||m.index===state.index)g.append(svg('text',{x:x(m.index),y:py+(buy?13:-8),'text-anchor':'middle',fill:color,'class':'sl-marker-label'},glyphs[m.key]));chart.append(g);});
 for(let i=200;i<320;i+=w<500?40:24)chart.append(svg('text',{x:x(i),y:455,'text-anchor':i===200?'start':'middle'},c.rows[i].date.slice(5,16).replace('T',' ')));
 chart.append(svg('line',{x1:x(state.index),x2:x(state.index),y1:top,y2:430,stroke:'var(--chart-cursor, #8a99b5)','stroke-dasharray':'4 4'}));
 chart.onclick=e=>{const box=chart.getBoundingClientRect();move(200+Math.floor(((e.clientX-box.left)*w/box.width-left)/(right-left)*120));};host.replaceChildren(chart);
 const i=state.index,r=c.rows[i];$('sl-candle').value=i;$('sl-date').textContent=r.date.replace('T',' ').replace('Z',' UTC');$('sl-prev').disabled=i===200;$('sl-next').disabled=i===319;
 $('sl-prev-event').disabled=!marks.some(m=>m.index<i);$('sl-next-event').disabled=!marks.some(m=>m.index>i);
 $('sl-values').innerHTML=`<span><b>O / H / L / C</b> ${[r.open,r.high,r.low,r.close].map(format).join(' / ')}</span>`+c.overlays.map((s,k)=>`<span style="--series:${palette[k%palette.length]}"><i></i><b>${esc(s.label)}</b> ${esc(format(s.data[i]))}</span>`).join('')+selected.map(s=>`<span data-series-value="${esc(s.label)}" style="--series:${seriesColor(s.label)}"><i></i><b>${esc(s.label)}</b> ${esc(format(s.data[i]))}</span>`).join('');
 $('sl-signals').innerHTML=Object.entries(names).map(([k,n])=>`<span class="${c.signals[k][i]===1?'active sl-'+k:''}"><b>${n}</b> ${c.signals[k][i]===1?'成立':c.signals[k][i]===null?'未写入 / 无效值':'未成立'}</span>`).join('');
 $('sl-check-list').innerHTML=c.checks.length?c.checks.map(check=>`<div class="sl-check-row"><span class="${check.values[i]===true?'pass':'fail'}">${check.values[i]===true?'✓ 成立':check.values[i]===false?'— 未成立':'— 无值'}</span><div><small>${check.phase==='entry'?'开仓方法':'平仓方法'}</small><code>${esc(check.source)}</code>${Object.keys(check.bindings).length?`<small>${esc(Object.entries(check.bindings).map(([k,v])=>`${k}=${v}`).join('，'))}</small>`:''}</div><button class="source-link" data-source-line="${check.line}">L${check.line} ↗</button></div>`).join(''):'<p>该方法没有可逐根展示的布尔比较。请查看源码中的直接赋值，或下方依赖持仓的退出规则。</p>';
 $('sl-input-list').innerHTML=`<dl class="sl-parameters">${c.features.map(s=>`<div><dt>${esc(s.label)}</dt><dd>${esc(format(s.data[i]))}</dd></div>`).join('')}</dl>`;
}
document.addEventListener('click',e=>{const picker=$('sl-series-picker');if(picker?.open&&!picker.contains(e.target))picker.open=false;});
document.addEventListener('keydown',e=>{const picker=$('sl-series-picker');if(e.key==='Escape'&&picker?.open){picker.open=false;picker.querySelector('summary').focus();}});
function unmount(){serial++;state=null;observer?.disconnect();}
root.SignalLab={markup,mount,unmount,register,load,plotValues};
})(window);
