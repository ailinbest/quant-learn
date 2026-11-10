# Quant Learn · 策略研习室

在线访问：<https://108.171.45.187/quant-learn/>。源码仓库：<https://github.com/ailinbest/quant-learn>。

仓库全部 **68 份 Python 策略**的中文源码学习页面，包含参数、指标公式、进出场条件、风控、代码问题、适应场景及图表。保持纯 HTML / CSS / JavaScript，不需要 npm、打包或外部 CDN。

在仓库根目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8765>，也可直接双击 `index.html`。可用 `?strategy=futures/FAdxSmaStrategy` 等地址直接定位某篇；章节锚点和浏览器前进后退可用。

## 覆盖范围

| 目录 | 篇数 | 内容 |
| --- | ---: | --- |
| 策略目录顶层 | 27 | 基础、参数搜索、多周期、止损和执行示例 |
| berlinguyinca | 30 | 趋势、动量、回归与历史示例 |
| futures | 7 | 多空信号、杠杆边界与实现问题 |
| lookahead_bias | 4 | 明确标注为未来数据偏差练习 |

侧栏支持策略名、指标、概要与问题关键词搜索，以及目录筛选。目录弹窗列出全部策略；每篇都有源码行号链接和完整源文件。没有改动任何 Python 策略，也没有运行它们的历史回测。

## 两类图表

- **Strategy001**：保留第一版完整交叉条件检查器。380 根确定性合成 OHLC，从第 241 根展示，逐根计算原策略的入场与离场条件。B / S 为原始信号，不等于成交。
- **其余策略**：每篇选择相关指标机制图，配有该策略专属观察步骤、公式和条件说明。支持 EMA、布林带、RSI、MACD、ADX/DI、SAR、Supertrend、执行均价、原始价格，以及三种合成行情、K 线游标和数值读数。图中明确标注教学周期；这些图**不是每份 Python 策略全部条件的执行复现**，不标造假的买卖箭头。特殊自定义指标按其源码公式解释，不冒充已在通用图中重现。
- **偏差练习**：另有可操作的未来峰值实验，展示全局归一化如何改变过去的值。

图表不连接交易所，不模拟持仓、订单、手续费、滑点、同根退出优先级或实际成交。SAR 使用教学初始化，MACD 各 EMA 独立初始化，Supertrend 使用 Wilder ATR；它们不宣称与任意版本的 TA-Lib / technical 逐位一致。布林教学图用总体标准差；QTPyLib 等源码里的具体口径在每篇中说明。RSI 无涨跌时取中性 50，不同 TA-Lib 版本可能不同。

## 内容与代码

- `sources/strategies/`：68 份上游策略源码快照；来源、修订和 GPL v3 许可说明见 `sources/README.md`，项目无需依赖旁边的 freqtrade-strategies 仓库。

- `lessons/top.json` / `berlin.json` / `special.json`：逐篇人工研读内容、指标公式、优缺点、注意事项、源码行号。
- `refresh-catalog.py`：递归读取 `sources/strategies/` 中的策略快照，利用 Python AST 提取类属性、参数声明、保存参数和方法源码；**不导入或执行策略**。
- `catalog.js`：生成后的静态内容包，含完整源码与 SHA-256；浏览器无需 fetch，支持直接打开文件。
- `index.html` / `app.js` / `model.js`：保留 Strategy001 专用内容与实验。
- `library.js` / `learning-model.js`：全库切换、搜索、章节生成、参数/源码展示与通用教学图表。
- `styles.css`：桌面与手机样式。

修改某份解读时，编辑其 JSON 条目，再运行：

```sh
python3 refresh-catalog.py
node --test model.test.js library.test.js
```

新增或修改策略源码后，必须重新核对解读、默认参数、公式和行号，再刷新内容包。参数表将声明的 `default` 与 `buy_params / sell_params` 分列；它们不是实际加载 Freqtrade 后的最终值。外部参数文件、配置与库版本仍可能改变运行行为。源码中未声明的属性会明确显示未设置，不自动补造默认值。

解读以代码事实为基础，适应场景和优缺点是规则推断。发现逻辑疑点不等于已经运行确认异常；需要环境或版本才能判断的地方在正文中保留限定。已知未来数据偏差的条目不能作为历史收益证据。

## 项目定位

a website for quant learn about indictors, strategies, trading, backtesting and so on.

## 构建与部署

运行 `python3 build-site.py` 可把公开资源导出到 `dist/`。生产环境通过 Nginx 提供静态文件，部署、更新和回滚方式见 [deploy/README.md](deploy/README.md)。

本项目采用 [GNU GPL v3](LICENSE)，策略原作者信息保留在源码快照内。
