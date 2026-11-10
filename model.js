/* Educational calculations; no exchange, orders or backtest engine. */
(function (root) {
  'use strict';
  function ema(values, period) {
    const out = Array(values.length).fill(null);
    if (values.length < period) return out;
    out[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) out[i] = out[i - 1] + 2 / (period + 1) * (values[i] - out[i - 1]);
    return out;
  }
  function crossed(a, b, previousA, previousB) {
    return [a, b, previousA, previousB].every(Number.isFinite) && a > b && previousA <= previousB;
  }
  function analyze(candles) {
    const averages = [20, 50, 100].map(n => ema(candles.map(c => c.close), n));
    const rows = [];
    candles.forEach((c, i) => {
      const previous = rows[i - 1];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i ? (previous.haOpen + previous.haClose) / 2 : (c.open + c.close) / 2;
      const [ema20, ema50, ema100] = averages.map(a => a[i]);
      const buy = [crossed(ema20, ema50, previous?.ema20, previous?.ema50), Number.isFinite(ema20) && haClose > ema20, haClose > haOpen];
      const sell = [crossed(ema50, ema100, previous?.ema50, previous?.ema100), Number.isFinite(ema20) && haClose < ema20, haClose < haOpen];
      rows.push({...c, index: i, ema20, ema50, ema100, haOpen, haClose, haHigh: Math.max(c.high, haOpen, haClose), haLow: Math.min(c.low, haOpen, haClose), buy, sell, entry: buy.every(Boolean), exit: sell.every(Boolean)});
    });
    return rows;
  }
  function candlesFrom(closes) {
    return closes.map((close, i) => {
      const open = i ? closes[i - 1] : close + 0.12;
      return {open, close, high: Math.max(open, close) + 0.14 + 0.08 * (1 + Math.sin(i * 2.7)), low: Math.min(open, close) - 0.14 - 0.06 * (1 + Math.cos(i * 1.8))};
    });
  }
  function scenario(kind) {
    const closes = Array.from({length: 380}, (_, i) => {
      const t = i - 270;
      const base = i < 270 ? 108 - i * 0.045 : 95.85;
      if (i < 270) return base + 0.22 * Math.sin(i * 0.7);
      if (kind === 'chop') return base + 1.65 * Math.sin(t / 5) + 0.14 * Math.sin(i * 1.9);
      if (kind === 'stop') return base + (t < 28 ? t * 0.15 : 4.2 - (t - 28) * 0.31) + 0.25 * Math.sin(i * 0.9);
      if (kind === 'exit') return base + (t < 20 ? t * 0.22 : 4.4 - Math.min(t - 20, 15) * 0.1) + 0.18 * Math.sin(i * 0.9);
      return base + t * 0.13 + 0.55 * Math.sin(t / 3.2) + 0.12 * Math.sin(i * 1.9);
    });
    return analyze(candlesFrom(closes));
  }
  function roi(minutes) { return minutes >= 60 ? 0.01 : minutes >= 30 ? 0.03 : minutes >= 20 ? 0.04 : 0.05; }
  function roiReached(minutes, profitRatio) { return profitRatio > roi(minutes); }
  const api = {ema, crossed, analyze, candlesFrom, scenario, roi, roiReached};
  if (typeof module !== 'undefined') module.exports = api;
  else root.StrategyModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
