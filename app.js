(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const M = window.StrategyModel;
  const state = {scenario: 'trend', mode: 'buy', index: 288, ha: false, lines: new Set(['ema20', 'ema50', 'ema100']), rows: M.scenario('trend')};
  const fmt = value => Number.isFinite(value) ? value.toFixed(3) : '尚未初始化';
  const time = index => { const minutes = (index - 240) * 5; return `${String(8 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; };
  const descriptions = {
    trend: '先回落、再持续上涨。B 标记处 EMA20 刚上穿 EMA50，且 HA 在 EMA20 上方并为阳线；再向后看一根，均线虽仍在上方，“刚刚上穿”已不成立。',
    exit: '缓慢均线在反弹后迟到上穿，此时 HA 已转阴并低于 EMA20，三个卖出条件恰好重合。S 只是原始信号；实际仓位可能已被 ROI 提前平掉，也可能因亏损而无法按信号退出。',
    chop: '价格在区间内往返，短均线多次上穿并产生 B 标记，随后又回落。HA 阳线不能保证趋势持续；原策略没有额外的成交量或高周期趋势过滤。',
    stop: '红色虚线仅演示“假设已有 100 买入的仓位”的 90 止损参考价。它不是 B 标记的成交价；本图不维护仓位，也不模拟此前 ROI 是否已退出。原始 Low 触线用于说明风险，HA 低点不用于止损成交判断。'
  };
  function svgNode(tag, attributes, text) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function drawChart() {
    const host = $('chart');
    const width = Math.max(host.clientWidth, 280), height = host.clientHeight;
    const left = 6, right = width - 48, top = 28, bottom = height - 30;
    const rows = state.rows.slice(240), count = rows.length;
    const values = rows.flatMap(r => [r.low, r.high, ...[...state.lines].map(k => r[k]), ...(state.ha ? [r.haLow, r.haHigh] : [])]).filter(Number.isFinite);
    if (state.scenario === 'stop') values.push(90, 100);
    const min = Math.min(...values), max = Math.max(...values), pad = (max - min) * .12;
    const lo = min - pad, hi = max + pad;
    const x = index => left + (index - 240 + .5) / count * (right - left);
    const y = price => bottom - (price - lo) / (hi - lo) * (bottom - top);
    const svg = svgNode('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${state.scenario === 'stop' ? '含假设止损参考线的' : ''}${state.ha ? 'Heikin-Ashi' : '原始'}K 线、EMA 曲线及买卖信号，详细数值见信号检查器`});
    svg.append(svgNode('title', {}, '使用下方滑块或左右按钮逐根查看 K 线条件'));
    for (let i = 0; i <= 4; i++) {
      const value = lo + (hi - lo) * i / 4, py = y(value);
      svg.append(svgNode('line', {x1:left,y1:py,x2:right,y2:py,stroke:'#edf0f5','stroke-dasharray':'3 4'}), svgNode('text', {x:right + 7,y:py + 3}, value.toFixed(1)));
    }
    for (let i = 240; i < 380; i += width < 450 ? 35 : 25) {
      svg.append(svgNode('text', {x:x(i),y:height - 8,'text-anchor':i === 240 ? 'start':'middle'},time(i)));
    }
    const candleWidth = Math.max(1, (right - left) / count * .61);
    for (const r of rows) {
      const o = state.ha ? r.haOpen : r.open, c = state.ha ? r.haClose : r.close;
      const h = state.ha ? r.haHigh : r.high, l = state.ha ? r.haLow : r.low;
      const color = c >= o ? '#50a78e' : '#d88587';
      svg.append(svgNode('line', {x1:x(r.index),x2:x(r.index),y1:y(h),y2:y(l),stroke:color,'stroke-width':.8}));
      svg.append(svgNode('rect', {x:x(r.index)-candleWidth/2,y:Math.min(y(o),y(c)),width:candleWidth,height:Math.max(1,Math.abs(y(c)-y(o))),fill:color,rx:.3}));
    }
    const colors = {ema20:'#dca256',ema50:'#7584da',ema100:'#b68acc'};
    for (const key of state.lines) {
      const path = rows.filter(r=>Number.isFinite(r[key])).map((r,i)=>`${i?'L':'M'}${x(r.index).toFixed(2)},${y(r[key]).toFixed(2)}`).join(' ');
      svg.append(svgNode('path',{d:path,fill:'none',stroke:colors[key],'stroke-width':1.6}));
    }
    if (state.scenario === 'stop') {
      svg.append(svgNode('line', {x1:left,x2:right,y1:y(90),y2:y(90),stroke:'#d48085','stroke-width':1,'stroke-dasharray':'5 4'}));
      svg.append(svgNode('text',{x:left+8,y:y(90)-7,style:'fill:#c5737a;font-size:9px'},'假设入场 100 → 止损参考 90'));
    }
    for (const r of rows.filter(r=>r.entry||r.exit)) {
      const isEntry = r.entry;
      const py = isEntry ? y(state.ha ? r.haLow : r.low)+14 : y(state.ha ? r.haHigh : r.high)-14;
      const color = isEntry ? '#398f77':'#c47078';
      svg.append(svgNode('rect',{x:x(r.index)-7,y:py-8,width:14,height:15,rx:4,fill:color}));
      svg.append(svgNode('text',{x:x(r.index),y:py+3,'text-anchor':'middle',style:'fill:white;font-size:8px;font-weight:600'},isEntry?'B':'S'));
    }
    const current = state.rows[state.index];
    svg.append(svgNode('line',{x1:x(state.index),x2:x(state.index),y1:top-9,y2:bottom+6,stroke:'#8e9ab5','stroke-width':1,'stroke-dasharray':'3 3'}));
    svg.append(svgNode('circle',{cx:x(state.index),cy:y(current.close),r:3,fill:'#fff',stroke:'#6474c3','stroke-width':1.5}));
    const tagX = Math.max(0, Math.min(width - 48, x(state.index) - 22));
    svg.append(svgNode('rect',{x:tagX,y:2,width:44,height:17,rx:4,fill:'#eef0f9'}),svgNode('text',{x:tagX+22,y:14,'text-anchor':'middle',style:'fill:#7783ae;font-size:9px'},time(state.index)));
    function selectAt(event) {
      const box = svg.getBoundingClientRect();
      state.index = Math.max(240, Math.min(379, 240 + Math.floor(((event.clientX-box.left)*width/box.width-left)/(right-left)*count)));
      update();
    }
    svg.addEventListener('click', selectAt);
    host.replaceChildren(svg);
  }
  function updateInspector() {
    const r = state.rows[state.index], prev = state.rows[state.index-1];
    const buy = state.mode === 'buy';
    const a = buy ? 'ema20':'ema50', b = buy ? 'ema50':'ema100';
    const rules = [
      [`${a.toUpperCase()} 刚刚上穿 ${b.toUpperCase()}`,`本根 ${fmt(r[a])} ${r[a]>r[b]?'>':'≤'} ${fmt(r[b])}<br>前根 ${fmt(prev[a])} ${prev[a]<=prev[b]?'≤':'>'} ${fmt(prev[b])}`],
      [`HA Close ${buy?'高于':'低于'} EMA20`,`${fmt(r.haClose)} ${r.haClose>r.ema20?'>':r.haClose<r.ema20?'<':'='} ${fmt(r.ema20)}`],
      [`HA 为${buy?'阳':'阴'}线`,`Open ${fmt(r.haOpen)}<br>Close ${fmt(r.haClose)}`]
    ];
    $('conditions').innerHTML = rules.map(([title,detail], i)=>`<div class="condition ${r[state.mode][i]?'passed':''}"><span class="check">${r[state.mode][i]?'✓':'−'}</span><div><strong>${title}</strong><small>${detail}</small></div></div>`).join('');
    const matches = r[state.mode].filter(Boolean).length;
    $('signal-result').innerHTML = `<div class="signal-status ${matches===3 ? buy?'yes':'sell':''}">${matches===3?'●':'○'} ${matches} / 3 成立 · ${matches===3 ? (buy?'产生买入信号':'产生卖出信号，仍需盈利') : (buy?'不产生买入信号':'不产生卖出信号')}</div>`;
    $('bar-time').textContent = time(state.index);
    $('ohlc').textContent = `原始 O ${r.open.toFixed(2)}   H ${r.high.toFixed(2)}   L ${r.low.toFixed(2)}   C ${r.close.toFixed(2)}`;
    $('candle-label').textContent = `#${state.index+1} / 380`;
    $('candle-slider').value = state.index;
    $('previous-candle').disabled = state.index===240;
    $('next-candle').disabled = state.index===379;
    const candidates = state.rows.filter(r=>r.index>=240&&(buy?r.entry:r.exit));
    $('jump-signal').textContent = candidates.length ? `定位${buy?'买入':'卖出'}信号${candidates.length>1?'（循环）':''} ↗` : `本场景无${buy?'买入':'卖出'}信号`;
    $('jump-signal').disabled = !candidates.length;
  }
  function update() { updateInspector(); drawChart(); }
  function setMode(mode) {
    state.mode=mode;
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
  }
  document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>{
    state.scenario=button.dataset.scenario;
    state.rows=M.scenario(state.scenario);
    setMode(state.scenario==='exit'?'sell':'buy');
    const signal=state.rows.find(r=>r.index>=240&&(state.mode==='buy'?r.entry:r.exit));
    state.index=state.scenario==='stop' ? state.rows.find(r=>r.index>298&&r.low<=90).index : (signal?.index ?? 288);
    document.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',b===button));
    $('scenario-description').textContent=descriptions[state.scenario];
    update();
  }));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{setMode(b.dataset.mode);updateInspector();}));
  $('candle-slider').addEventListener('input',e=>{state.index=Number(e.target.value);update();});
  $('previous-candle').addEventListener('click',()=>{state.index=Math.max(240,state.index-1);update();});
  $('next-candle').addEventListener('click',()=>{state.index=Math.min(379,state.index+1);update();});
  $('jump-signal').addEventListener('click',()=>{
    const matches=state.rows.filter(r=>r.index>=240&&(state.mode==='buy'?r.entry:r.exit));
    if(matches.length) {state.index=(matches.find(r=>r.index>state.index)||matches[0]).index;update();}
  });
  $('ha-toggle').addEventListener('change',e=>{state.ha=e.target.checked;drawChart();});
  document.querySelectorAll('[data-line]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)state.lines.add(input.dataset.line);else state.lines.delete(input.dataset.line);drawChart();}));
  function updateRisk() {
    const minutes=Number($('minutes').value), target=M.roi(minutes), profit=Number($('profit').value);
    $('minutes-output').textContent=`${minutes} 分钟`;
    $('roi-result').textContent=`第 ${minutes} 分钟，当前 ROI 退出门槛为 ${(target*100).toFixed(0)}%。`;
    const active=minutes>=60?60:minutes>=30?30:minutes>=20?20:0;
    document.querySelectorAll('[data-roi]').forEach(el=>el.classList.toggle('selected',Number(el.dataset.roi)===active));
    $('profit-output').textContent=`${profit>0?'+':''}${profit.toFixed(1)}%`;
    const routes=[];
    if(profit<=-10)routes.push('固定止损：触及约 −10% 风险线（收益近似演示）');
    if(M.roiReached(minutes,profit/100))routes.push(`ROI：超过 ${target*100}% 门槛`);
    if($('exit-signal').checked&&profit>0)routes.push('信号退出：exit_long 成立，且净收益 > 0');
    $('exit-verdict').textContent=routes.length?`可触发：${routes.join('；')}。最终执行仍受订单与框架规则影响。` : `继续持有：ROI 未达标、止损未触及${$('exit-signal').checked?'；当前不盈利，卖出信号被 exit_profit_only 拦住':'，且没有卖出信号'}。`;
  }
  ['minutes','profit','exit-signal'].forEach(id=>$(id).addEventListener('input',updateRisk));
  window.Strategy001View = { redraw: drawChart };
  const anchors=[...document.querySelectorAll('nav a')];
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting)anchors.forEach(a=>a.classList.toggle('active',a.hash===`#${entry.target.id}`));
  },{rootMargin:'-8% 0px -65% 0px'});
  document.querySelectorAll('article section').forEach(el=>observer.observe(el));
  new ResizeObserver(()=>{if(!$('lesson').hidden)drawChart();}).observe($('chart'));
  $('scenario-description').textContent=descriptions.trend;
  update();updateRisk();
})();
