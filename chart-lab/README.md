# 源码信号样例

该工具执行 `sources/strategies` 的 68 份保留源码，生成浏览器可直接加载的信号数据。策略文件不修改，不连接交易所，不建立持仓，也不执行历史收益回测。Strategy001 的专用前端实验仍使用原有 model.js；其 Python 样例也保留用于核对。

## 复现

```sh
uv venv --python 3.12 .venv-chart
uv pip sync --python .venv-chart/bin/python chart-lab/requirements.txt
.venv-chart/bin/python chart-lab/generate.py
node --test model.test.js library.test.js signal-lab.test.js
python3 build-site.py
```

可用 `--ids Strategy002 futures/FSampleStrategy` 单独重建指定数据。全量生成会更新 `audit.json`；局部生成只写本次核对记录，发布前应跑全量。不同 OS / 库二进制可能存在浮点末位差异。完整生成需要几分钟，FOttStrategy 的源码循环较慢。

## 数据与参数

- 各策略按路径固定种子，三种行情独立生成，每种 4,200 根（TrendRider 使用 8,000 根以预热日线均线），从 2024-01-01 UTC 开始。不是市场数据，也不是收益证据。
- OHLCV 含多种波动阶段、趋势反转、长下影和成交量变化。选取较易观察到条件事件的窗口，并保留事件后 35 根的上下文；页面展示 120 根，数据保留 320 根。
- 使用 Freqtrade 的参数加载和 `advise_indicators`，因此保存的 buy_params / sell_params 及 informative 装饰器按框架处理；无外部参数文件。辅助交易对使用另一个固定合成序列，高周期按 OHLCV 聚合，只提供已完成高周期蜡烛。
- PowerTower / GodStraNew 的第二个场景缩放到较小价格，明确标出量纲变化；没有更改交易阈值。
- FixedRiskRewardLoss 未声明 timeframe，样例明确采用 5m。FReinforcedStrategy 参数 space 缺失时，仅演示声明默认值，保留实际加载需修复的提示。旧 `numpy.lib.math` 映射到 Python math。所有适配都写入样例。

## 信号与条件核对

AST 记录器在原表达式返回之后保存布尔比较、交叉结果和被读取的列；它返回原对象，不重写条件。对每份策略的趋势场景，将四个输出列与未插入记录器的源码执行结果逐项比较（包括 NaN）。记录在 `audit.json` 的 `originalSignalsMatch`。

另在一个截断点重算，检查重叠区最后 40 根的信号和输入列，变化项写入 `prefixChanged` 并在图中提示。这是有限样本检查，不能证明源码无未来数据偏差；没有发现变化的源码也可能在别的窗口出问题。正文已知的偏差提示始终保留。

浏览器显示完整精度计算后的布尔值，数字仅为阅读而舍入。不同分支是 AND 还是 OR 应回看源码；不能把所有条件检查行都当成同一组 AND。未赋值的 NaN 保留为空值，不把它解读成一次交易。

## 范围

只画原始条件候选；不会凭空生成 ROI / custom_exit / custom_stoploss 卖点，也不会把连续信号当成多次开仓。没有模拟订单、仓位、开空权限筛选、冲突信号或退出优先级。无法生成时直接报错，构建阻止发布失败或源码过期的样例。
