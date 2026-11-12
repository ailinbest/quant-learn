# Quant Learn · 策略研习室

在线访问：<https://108.171.45.187/quant-learn/>。源码仓库：<https://github.com/ailinbest/quant-learn>。

仓库全部 **68 份 Python 策略**的中文源码学习页面，包含参数、指标公式、进出场条件、风控、代码问题、适应场景及图表。保持纯 HTML / CSS / JavaScript，不需要 npm、打包或外部 CDN。

在仓库根目录运行：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8765>，也可直接双击 `index.html`。可用 `?strategy=futures/FAdxSmaStrategy` 等地址直接定位某篇；章节锚点和浏览器前进后退可用。

顶部「夜间模式」可切换明暗配色，包含图表、参数表和源码弹窗。首次访问跟随系统主题，手动选择后自动记住；刷新页面、切换策略和再次打开都会保留选择。浏览器禁用本地存储时仍可切换，但不会跨访问保存。

## 覆盖范围

| 目录 | 篇数 | 内容 |
| --- | ---: | --- |
| 策略目录顶层 | 27 | 基础、参数搜索、多周期、止损和执行示例 |
| berlinguyinca | 30 | 趋势、动量、回归与历史示例 |
| futures | 7 | 多空信号、杠杆边界与实现问题 |
| lookahead_bias | 4 | 明确标注为未来数据偏差练习 |

侧栏支持策略名、指标、概要与问题关键词搜索，以及目录筛选。目录弹窗列出全部策略；每篇都有源码行号链接和完整源文件。没有改动任何 Python 策略，也没有运行它们的历史回测。

## K 线与策略信号

- **Strategy001**：保留专用的 JavaScript 交叉条件检查器和参数实验；B / S 是条件信号，不等于成交。
- **其余 67 份策略**：加载各自的离线 Python 计算结果。实际运行源码快照的指标、入场和退出方法，使用对应的 TA-Lib / QTPyLib / technical 实现及有效源码参数，不再用通用 EMA 图替代策略条件。
- 图上分别标记买入 / 开多、卖出 / 平多、开空、平空。默认合并连续成立的信号，可关闭合并、跳到前后信号、点击 K 线或移动游标，并查看该根的原始条件、输入数值及源码行号。
- 每份提供三段固定合成行情；价格量纲敏感策略另标小价格对照。选取便于观察信号的窗口，不代表真实行情分布、触发频率或收益。没有触发的样例不会补造箭头。
- 标记只表示 `populate_entry_trend` / `populate_exit_trend` 的原始输出。持仓筛选、同根冲突、ROI、固定 / 移动止损、回调、订单、手续费及成交没有模拟。回调和兼容条件在图旁单独说明。
- 已知未来数据依赖，以及抽样截断后发现历史值改变的策略，均在图旁提示；前缀检查通过不等于完整的 lookahead-analysis。
- 偏差练习继续保留未来峰值交互实验。

生成器与复现方式见 [chart-lab/README.md](chart-lab/README.md)。每份信号数据绑定源码 SHA-256，版本不一致时构建和页面会拒绝把旧样例当成新策略结果。生产网站仅需要静态文件，不需要安装 Python 交易环境。

## 内容与代码

- `sources/strategies/`：68 份上游策略源码快照；来源、修订和 GPL v3 许可说明见 `sources/README.md`，项目无需依赖旁边的 freqtrade-strategies 仓库。

- `lessons/top.json` / `berlin.json` / `special.json`：逐篇人工研读内容、指标公式、优缺点、注意事项、源码行号。
- `indicator-help.json`：全库指标对应的 TradingView 中文帮助链接。`indicators` 按指标键复用，`overrides` 保留策略特有的参考关系；单篇解读内的 `tradingView` 注释优先。`indicator` 表示对应指标文章，`related` 表示相关概念，`directory` 表示未找到专门条目、提供目录入口。蜡烛形态可用 `additionalLinks` 同时列出看涨与看跌文章。
- `refresh-catalog.py`：递归读取 `sources/strategies/` 中的策略快照，利用 Python AST 提取类属性、参数声明、保存参数和方法源码；**不导入或执行策略**。
- `catalog.js`：生成后的静态内容包，含完整源码与 SHA-256；浏览器无需 fetch，支持直接打开文件。
- `index.html` / `app.js` / `model.js`：保留 Strategy001 专用内容与实验。
- `library.js`：全库切换、搜索、章节生成和参数/源码展示。
- `signal-lab.js` / `chart-data/`：按策略延迟加载的信号图、条件检查和离线样例。
- `chart-lab/`：源码信号生成器、依赖锁定和核对报告。
- `learning-model.js`：保留的通用指标数学实验与测试，不再承担策略信号图。
- `styles.css`：桌面与手机样式。
- `theme.js`：首屏主题初始化、夜间模式切换与本地偏好保存。

修改某份解读时，编辑其 JSON 条目，再运行：

```sh
python3 refresh-catalog.py
node --test model.test.js library.test.js signal-lab.test.js
```

新增或修改策略源码后，必须重新核对解读、默认参数、公式和行号，再刷新内容包。参数表将声明的 `default` 与 `buy_params / sell_params` 分列；它们不是实际加载 Freqtrade 后的最终值。外部参数文件、配置与库版本仍可能改变运行行为。源码中未声明的属性会明确显示未设置，不自动补造默认值。

指标卡片中的中文帮助链接在新标签页打开。链接用于对照学习，参数与实现差异会在卡片上说明；自定义算法、数学运算或未找到专门中文文章的项目会明确标记参考范围，不把社区脚本当作官方帮助。新增指标键时也需更新链接映射，否则内容包生成会报错。Strategy001 使用静态专页，修改其链接时需同步 `index.html`。

解读以代码事实为基础，适应场景和优缺点是规则推断。发现逻辑疑点不等于已经运行确认异常；需要环境或版本才能判断的地方在正文中保留限定。已知未来数据偏差的条目不能作为历史收益证据。

## 项目定位

a website for quant learn about indictors, strategies, trading, backtesting and so on.

## 构建与部署

运行 `python3 build-site.py` 可把公开资源导出到 `dist/`。生产环境通过 Nginx 提供静态文件，部署、更新和回滚方式见 [deploy/README.md](deploy/README.md)。

本项目采用 [GNU GPL v3](LICENSE)，策略原作者信息保留在源码快照内。
