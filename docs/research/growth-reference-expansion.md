# Baby Log 成长参考扩展研究

- 研究日期：2026-08-11
- 研究范围：仅资料研究；不修改应用代码、不引入新的事件类型或产品页面。
- 目标：为当前“出生后 0–13 周”成长参考扩展到更长年龄范围提供 AAP 优先、WHO/CDC 对照的一手资料和安全边界。

## 结论先行

1. 如果 Baby Log 采用“美国儿科基层照护、AAP 对齐”的默认参考路线，应在出生至未满 24 个月使用 WHO Child Growth Standards，达到 2 岁（24 个月）后切换到 CDC 2000 Growth Charts；2–20 岁的核心指数是体重-年龄、身高/身长-年龄和 BMI-年龄。AAP 的公开工具明确写出 WHO 用于出生后前 2 年、CDC 工具用于 2 岁以上；CDC 也明确说明 24 个月是切换点。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/)、[AAP 2 岁以上评估指南](https://eqipp.aap.org/courses/growth2/mn/clinical-guide/popups/children-ages-2-years-and-older)、[CDC：使用 WHO 曲线](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-using.html)

2. WHO 2006 标准本身覆盖出生至 5 岁（60 个完整月），且年龄型指标的扩展表以日为粒度，延伸到 1856 天，即未满 61 个月的一天；但“WHO 0–5”不能在 AAP 对齐的默认路线中静默替代 24 个月后的 CDC 参考。WHO 0–5 应作为明确命名的独立参考集，或用于明确标注的 WHO 视图。[WHO 儿童生长标准问答](https://www.who.int/news-room/questions-and-answers/item/child-growth-standards)、[WHO 制图说明](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf?sfvrsn=5cec8c61_23)、[CDC 推荐理由](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/recommendations-and-rationale.html)

3. CDC 已公开可下载的 CSV/XLS、L/M/S 参数、WHO/CDC SAS 程序和 R 计算包；这些资料足以支持本地计算，但必须按“参考集 + 指数 + 年龄/长度轴 + 版本”绑定，不能把 WHO 与 CDC 的行或百分位列混合。CDC 2000 的参数虽然称为 L/M/S，NCHS 说明其生成过程是 CDC 的 modified LMS 方法，不应假定所有来源的 L/M/S 是同一个拟合过程。[CDC Percentile Data Files with LMS Values](https://www.cdc.gov/growthcharts/cdc-data-files.htm)、[CDC WHO SAS 程序](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas-who.html)、[NCHS：CDC 2000 LMS 参数方法](https://www.cdc.gov/nchs/data/nhsr/nhsr063.pdf)

4. 当前 `p2/p25/p50/p75/p98` 应被视为展示用参考点，而不是通用临床分类边界。AAP/CDC 对 WHO 曲线的“2nd/98th”标签实际对应约 2.3rd/97.7th（±2 SD）；CDC 2000 常用的 2–20 岁临床曲线则包括 5th、10th、25th、50th、75th、90th、95th 等。百分位必须带有参考集和指数上下文。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/)、[CDC 2000 数据文件](https://www.cdc.gov/growthcharts/cdc-data-files.htm)

5. 任何输出都只能是家庭观察、记录和准备就医问题的证据，不能由单次测量或百分位直接解释为诊断、疾病、治疗需要或喂养/饮食处方。CDC 明确说生长曲线不是唯一诊断工具；AAP 强调单个点不如连续趋势有用，BMI 也只是筛查指标。[CDC Growth Charts](https://www.cdc.gov/growthcharts/)、[AAP HealthyChildren 生长曲线说明](https://www.healthychildren.org/English/health-issues/conditions/Glands-Growth-Disorders/Pages/growth-charts-by-the-numbers.aspx)、[CDC Child and Teen BMI Calculator](https://www.cdc.gov/bmi/child-teen-calculator/index.html)

## 1. 当前 Baby Log 实现基线

这是本次研究前对仓库现状的只读核对：

- 当前服务只定义 `weight_kg`、`length_cm`、`head_circumference_cm` 三种 `measure_type`；参考行包含 `age_days`、`p2`、`p25`、`p50`、`p75`、`p98` 和 L/M/S。[`growth-reference-service.ts`](../../src/server/services/growth-reference-service.ts#L6-L19)
- 当前 payload 将标准固定为 `who_child_growth_standards`，数据集名称为 `CDC WHOref_d LMS`，展示带固定为 `p2_p98`，并在缺少性别或出生日期时不计算。[`growth-reference-service.ts`](../../src/server/services/growth-reference-service.ts#L56-L75)、[`growth-reference-service.ts`](../../src/server/services/growth-reference-service.ts#L84-L120)
- 当前参考查表和百分位计算拒绝大于 91 天的年龄；本地生成数据的注释也明确写着只包含 0–91 天的 p2/p25/p50/p75/p98/L/M/S。[`growth-reference-service.ts`](../../src/server/services/growth-reference-service.ts#L231-L292)、[`growth-reference-data.ts`](../../src/server/services/growth-reference-data.ts#L1-L11)
- 当前输入把线性测量统一称为 `length_cm`，没有区分仰卧身长和站立身高；记录表单也只提供 Weight、Length、Head circumference 三个单项测量。[`RecordPage.tsx`](../../src/client/pages/RecordPage.tsx#L565-L585)
- 当前稳定事实包含 `sex`、出生日期和一个自由文本 `gestational_age_label`，但没有结构化孕周或校正年龄字段。[`stable-child-facts-service.ts`](../../src/server/services/stable-child-facts-service.ts#L27-L57)

因此，扩展的主要风险不是“再加几个月的数组”，而是把单项测量误当成指数、把 WHO 和 CDC 的年龄/测量轴混用，以及在没有参考集版本和测量方式的情况下输出看似精确的百分位。

## 2. AAP、WHO、CDC 的年龄和曲线选择

### 2.1 AAP 优先的默认路线

| 年龄/情形 | 推荐参考 | 可直接支持的核心指数 | 关键边界 |
| --- | --- | --- | --- |
| 出生至未满 24 个月 | WHO Child Growth Standards | 体重-年龄、身长-年龄、体重-身长、头围-年龄 | AAP 页面把 WHO 工具限定为足月婴儿；其列出的足月范围为 37–41 周。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/) |
| 出生至未满 24 个月的 BMI | WHO 有 BMI 曲线，但不应当作默认的“体重状态分类” | 仅可作为明确标注的描述性 BMI-年龄结果 | CDC 不推荐 2 岁以下使用 BMI-年龄曲线；AAP 说 2 岁以下没有公认的 underweight/overweight/obesity 定义。[CDC WHO summary](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-summary.html)、[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/) |
| 24 个月至未满 20 岁 | CDC 2000 Growth Charts | 身高/身长-年龄、体重-年龄、BMI-年龄 | CDC 2000 页面列出的 2–20 岁曲线是 BMI-年龄、stature-年龄和 weight-年龄；AAP 的 2 岁以上指南也要求使用 CDC 图表。[CDC 2000 Features and Data](https://www.cdc.gov/growth-chart-training/hcp/overview/features-and-data.html)、[AAP 2 岁以上评估指南](https://eqipp.aap.org/courses/growth2/mn/clinical-guide/popups/children-ages-2-years-and-older) |
| 2–20 岁、BMI 很高 | CDC 2022 Extended BMI-for-age；是否启用要单独版本化 | BMI-年龄的高尾部 | CDC 当前推荐页写的是年龄/性别 BMI 高于 97th 时使用 Extended 图；AAP 自己的工具页对纸质图表写的是高于 95th 使用 Extended 图。两页存在阈值差异，产品不能把其中一个阈值伪装成无争议的通用规则。[CDC Recommended Charts](https://www.cdc.gov/growth-chart-training/hcp/overview/recommended.html)、[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/)、[CDC BMI Training](https://www.cdc.gov/growth-chart-training/hcp/using-bmi/) |

AAP 的家长资料也把“出生至 24 个月”和“2–20 岁”分别列出：前者下载体重-身长、头围-年龄、身长-年龄、体重-年龄图，后者下载身高/身长-年龄、体重-年龄和 BMI-年龄图；AAP 同时强调应看趋势而不是把百分位当作成绩。[AAP HealthyChildren 生长曲线说明](https://www.healthychildren.org/English/health-issues/conditions/Glands-Growth-Disorders/Pages/growth-charts-by-the-numbers.aspx)

### 2.2 足月/早产边界

WHO 0–2 曲线在 AAP 工具页的适用对象是足月婴儿，且 AAP 指出早产儿和儿童在 3 岁前应使用 corrected age。当前仓库只有自由文本 `gestational_age_label`，不能据此静默推导 corrected age；在未实现结构化校正年龄前，更安全的行为是明确标记“足月参考范围”或返回不可用，而不是给早产儿童显示一个未校正的精确百分位。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/)

### 2.3 24 个月切换时的测量变化

CDC 提醒，从 WHO 切到 CDC 时通常同时发生四件事：仰卧身长变为站立身高、体重-身长变为 BMI-年龄、参考人群改变、cutoff 改变；因此同一个孩子在切换点的分类可能变化，使用者应谨慎解释。WHO 的技术说明还指出，身长/身高-年龄在 730 与 731 天之间存在从 recumbent length 到 standing height 的不连续点。[CDC Using WHO Growth Standard Charts](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-using.html)、[WHO 制图说明](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf?sfvrsn=5cec8c61_23)

研究推导：路由标准时应使用“完成的日历月数是否达到 24 个月”作为 WHO/CDC 选择条件；选定参考集后仍把精确 `age_days` 传给 WHO 或转换为 CDC 所需的精确月龄，不能用 `age_days // 30` 作为 CDC 查表年龄。CDC 的程序要求 `agemos` 近似到当天，明确警告把同一个整数月龄套给整个月份会系统性偏差；WHO 计算也要求精确日龄。[CDC SAS Program for CDC Growth Charts](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas.html)、[CDC SAS Program for WHO Growth Charts](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas-who.html)

## 3. WHO 0–5 岁标准覆盖范围与年龄粒度

### 3.1 静态生长指标

WHO 官方标准页列出的指标包括 length/height-for-age、weight-for-age、weight-for-length/height、BMI-for-age、head circumference-for-age、arm circumference-for-age、subscapular skinfold-for-age、triceps skinfold-for-age，以及 weight/length/head-circumference velocity 和六项大运动里程碑窗口。[WHO Child Growth Standards 指标总览](https://www.who.int/tools/child-growth-standards/standards)

对当前 Baby Log 最相关的静态指标如下：

| 指标 | WHO 公开覆盖 | 查表轴和年龄粒度 | 对当前结构的含义 |
| --- | --- | --- | --- |
| 体重-年龄 | 出生至 5 岁；页面同时提供出生至 13 周和出生至 5 年的表格/图表 | 年龄型指标；扩展表按日，0–1856 天 | 当前 `weight_kg` 需要明确成为 `weight_for_age`，不能继续只叫 weight。 [WHO Weight-for-age](https://www.who.int/tools/child-growth-standards/standards/weight-for-age)、[WHO 制图说明](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf?sfvrsn=5cec8c61_23) |
| 身长/身高-年龄 | 出生至 5 岁；0–2 岁为 length，2–5 岁为 height | 年龄型指标；扩展表按日，0–1856 天；730/731 天处有测量类型不连续 | 必须记录 `recumbent_length` 或 `standing_height`，不能把两者共用一个无上下文的 `length_cm`。 [WHO Length/height-for-age](https://www.who.int/toolkits/child-growth-standards/standards/length-height-for-age) |
| 头围-年龄 | 出生至 5 岁；另有出生至 13 周、出生至 2 年表 | 年龄型指标；扩展表按日，0–1856 天 | WHO 可以覆盖 0–5 岁，但 CDC 2000 数据文件只列出出生至 36 个月的头围曲线；不能声称 CDC 2–20 有头围标准。 [WHO Head circumference-for-age](https://www.who.int/tools/child-growth-standards/standards/head-circumference-for-age)、[CDC 数据文件](https://www.cdc.gov/growthcharts/cdc-data-files.htm) |
| BMI-年龄 | WHO 提供出生至 5 岁，并拆成出生至 2 年、2–5 年表 | 年龄型指标；使用体重和线性测量派生 BMI | 0–2 岁只在明确的描述性场景使用；AAP/CDC 不应让它变成 underweight/overweight/obesity 诊断或默认分类。 [WHO BMI-for-age](https://www.who.int/toolkits/child-growth-standards/standards/body-mass-index-for-age-bmi-for-age)、[CDC WHO summary](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-summary.html) |
| 体重-身长/身高 | 0–2 岁为 weight-for-length，2–5 岁为 weight-for-height；WHO 也提供合并的 birth-to-5 图 | 主要查 `length_cm`/`height_cm` 轴，不是单独按 `age_days` 查表 | 必须把“输入测量值”和“参考轴”建模；同一次体重可参与 weight-for-age、weight-for-length/height 或 BMI，但三个结果不是同一个 metric。 [WHO Weight-for-length/height](https://www.who.int/tools/child-growth-standards/standards/weight-for-length-height) |
| 臂围、皮褶厚度 | WHO 页面提供 3 个月至 5 岁的 arm circumference、triceps skinfold 和 subscapular skinfold 曲线 | 年龄型指标；不能假定它们从出生第 0 天就有与体重相同的可用范围 | 不属于当前已有三种测量；除非明确新增测量和临床解释边界，不应为了“完整 WHO”自动加入表单。 [WHO Arm circumference-for-age](https://www.who.int/tools/child-growth-standards/standards/arm-circumference-for-age)、[WHO Triceps skinfold-for-age](https://www.who.int/tools/child-growth-standards/standards/triceps-skinfold-for-age) |

WHO 的技术说明给出了实现所需的精确边界：年龄型指标的建表数据用天；1 个月按 30.4375 天换算；24 个月按 730.5 天换算；表格覆盖到 1856 天。该说明还特别指出，身长/身高-年龄在 730/731 天之间有测量类型不连续。对于需要高精度本地计算的实现，应直接使用官方扩展表或官方计算程序，而不是把月表复制成每日值。[WHO 制图说明](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf?sfvrsn=5cec8c61_23)、[WHO Anthro 手册](https://www.who.int/docs/default-source/child-growth/child-growth-standards/software/anthro-pc-manual-v322.pdf)

### 3.2 速度指标不是普通的单点 LMS

WHO 的 velocity 标准有独立的“间隔”轴：

- weight velocity：出生至 12 个月提供 1 个月增量，出生至 24 个月提供 2–6 个月增量；另有按出生体重分组的出生至 60 天 1 周/2 周增量。[WHO Weight velocity](https://www.who.int/tools/child-growth-standards/standards/weight-velocity)
- length velocity：出生至 24 个月提供 2、3、4、6 个月增量。[WHO Length velocity](https://www.who.int/tools/child-growth-standards/standards/length-velocity)
- head circumference velocity：出生至 12 个月提供 2、3 个月增量，出生至 24 个月提供 4、6 个月增量。[WHO Head circumference velocity](https://www.who.int/tools/child-growth-standards/standards/head-circumference-velocity)

研究推导：速度结果至少需要 `start_age_days`、`end_age_days`、`interval_days` 和增量的独立参考集；不应把它塞进当前单点 `age_days + value + L/M/S` 结构，也不应把当前 `z_score_delta` 自动命名为 WHO velocity z-score。当前服务的 `z_score_delta` 是出生事实与最近测量之间的个人变化，不等于 WHO 的标准化速度指标。[当前服务的趋势结构](../../src/server/services/growth-reference-service.ts#L33-L41)、[WHO 速度指标总览](https://www.who.int/tools/child-growth-standards/standards)

## 4. CDC/官方可下载数据与本地计算可行性

### 4.1 CDC 2000 的可下载 L/M/S 文件

CDC 的官方数据文件页说明，生成美国平滑百分位曲线的数据以 8 个 Excel 文件提供，并同时提供 CSV：

- 2–20 岁：weight-for-age、stature-for-age、BMI-for-age；
- 出生至 36 个月：weight-for-age、length-for-age、weight-for-recumbent-length、head-circumference-for-age；
- 另有 weight-for-stature 文件。

这些文件包含按性别和年龄的 L/M/S，以及 3rd、5th、10th、25th、50th、75th、90th、95th、97th 等选定百分位；年龄以半月点代表一个月区间，例如 1.5 代表 1.0 至未满 2.0 个月，官方建议在更细的年龄或身长/身高轴上插值。[CDC Percentile Data Files with LMS Values](https://www.cdc.gov/growthcharts/cdc-data-files.htm)

与当前目标最直接的 CSV 直链如下，完整清单和 XLS 版本以 CDC 数据页为准：

- [CDC 2–20 weight-for-age CSV](https://www.cdc.gov/growthcharts/data/zscore/wtage.csv)
- [CDC 2–20 stature-for-age CSV](https://www.cdc.gov/growthcharts/data/zscore/statage.csv)
- [CDC 2–20 BMI-for-age CSV](https://www.cdc.gov/growthcharts/data/zscore/bmiagerev.csv)
- [CDC 出生至 36 个月 weight-for-age CSV](https://www.cdc.gov/growthcharts/data/zscore/wtageinf.csv)
- [CDC 出生至 36 个月 length-for-age CSV](https://www.cdc.gov/growthcharts/data/zscore/lenageinf.csv)
- [CDC 出生至 36 个月 weight-for-length CSV](https://www.cdc.gov/growthcharts/data/zscore/wtleninf.csv)
- [CDC 出生至 36 个月 head-circumference-for-age CSV](https://www.cdc.gov/growthcharts/data/zscore/hcageinf.csv)
- [CDC weight-for-stature CSV](https://www.cdc.gov/growthcharts/data/zscore/wtstat.csv)

CDC 页面给出的 LMS 计算公式是：当 `L != 0` 时，`Z = ((X / M)^L - 1) / (L × S)`；当 `L = 0` 时，`Z = ln(X / M) / S`，再将 z-score 转成百分位。公式可以支持本地计算，但必须采用对应指数和对应轴的 L/M/S 行，并保留足够的中间精度。[CDC Percentile Data Files with LMS Values](https://www.cdc.gov/growthcharts/cdc-data-files.htm)

### 4.2 CDC 托管的 WHO 数据和计算程序

CDC 官方 WHO SAS 页面明确提供 `WHOref_d.sas7bdat`、[WHOref_d.csv](https://www.cdc.gov/growth-chart-training/media/files/WHOref_d.csv) 和 [who-source-code.sas](https://www.cdc.gov/growth-chart-training/media/files/who-source-code.sas)。输入至少需要 `agedays` 和 `sex`；程序覆盖体重、身高/身长、BMI、头围、臂围、皮褶厚度和 weight-for-height 等结果，并说明 WHO 参考数据集由多个 WHO 数据集组合而成。[CDC SAS Program for WHO Growth Charts](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas-who.html)

CDC 也提供 [CDCref_d.csv](https://www.cdc.gov/growth-chart-training/media/files/CDCref_d.csv)、[cdc-source-code.sas](https://www.cdc.gov/growth-chart-training/media/files/cdc-source-code.sas) 和 [CDCref_d.sas7bdat](https://www.cdc.gov/growth-chart-training/media/files/CDCref_d.sas7bdat)。CDC 程序对 2–20 岁使用 `agemos`，并明确要求把年龄精确到当天；只知道整月时应采用中点近似而不是把整个月的孩子都设成同一个整数月龄。[CDC SAS Program for CDC Growth Charts](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas.html)

CDC 的官方计算资源页还列出 [CDC R package `cdcanthro`](https://github.com/CDC-DNPAO/cdcanthro)、[WHO R package `whoanthro`](https://github.com/WorldHealthOrganization/anthro)、CRAN 的 [WHO `anthro`](https://cran.r-project.org/package=anthro) 等；这些可作为离线交叉验证基准，但 Baby Log 的生产结果仍应固定官方数据文件、计算方法和版本，而不是运行时依赖外部服务。[CDC R Programs for Various Growth Charts](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/r-programs.html)

### 4.3 2022 Extended BMI 的特殊结构

CDC Extended BMI 数据页提供 [CSV 数据文件](https://www.cdc.gov/growthcharts/data/extended-bmi/bmi-age-2022.csv)，其中有 L/M/S 和 sigma。3rd–95th 百分位使用与 CDC 2000 BMI 文件相同的 L/M/S；95th 以上到 99.99th 的高尾部需要 sigma 和不同的计算方法，且年龄仍按单月表、可通过插值支持更细年龄。[CDC Extended BMI Data Files](https://www.cdc.gov/growthcharts/extended-bmi-data-files.htm)

研究推导：当前固定的 `L/M/S` 三元组不足以完整表达 Extended BMI 的高尾部；如果未来不实现 Extended BMI，就应在范围内明确“未提供高 BMI 尾部计算”，而不是把 `p98` 外推成 99th 或 99.9th。若实现，至少增加 `sigma`、`tail_method` 和 `reference_version`，并记录 CDC 当前推荐阈值的产品决策。[CDC Recommended Charts](https://www.cdc.gov/growth-chart-training/hcp/overview/recommended.html)、[CDC Extended BMI Data Files](https://www.cdc.gov/growthcharts/extended-bmi-data-files.htm)

## 5. 对现有结构的最小安全扩展建议

### 5.1 最小字段集

建议保留现有 `age_days`、`sex`、测量值和 L/M/S，但增加下面这些语义字段；这是基于上述官方索引和测量边界的工程推导，不是新的医学规则。

| 字段/概念 | 最小建议 | 安全理由 |
| --- | --- | --- |
| `reference_set` | `who_2006_0_5`、`who_2006_0_2`、`cdc_2000_2_20`、`cdc_extended_bmi_2022` 之一 | WHO、CDC 不是同一参考人群；AAP 默认路线在 24 个月切换，必须让结果自带参考集。[CDC Using WHO Growth Standard Charts](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-using.html) |
| `index` | `weight_for_age`、`length_or_height_for_age`、`weight_for_length_or_height`、`bmi_for_age`、`head_circumference_for_age` | “体重/身长/头围”是原始测量，不是完整指数；WHO 和 CDC 的官方页面分别按这些指数定义曲线。[WHO 指标总览](https://www.who.int/tools/child-growth-standards/standards)、[CDC Anthropometric Indices](https://www.cdc.gov/growth-chart-training/hcp/overview/anthropometric-indices.html) |
| `measurement_kind` | `weight_kg`、`recumbent_length_cm`、`standing_height_cm`、`head_circumference_cm` | WHO 0–2 使用仰卧身长，2–5 使用身高；CDC 2–20 使用 standing height；切换时两者可能造成分类变化。[CDC Using WHO Growth Standard Charts](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-using.html)、[CDC SAS Program](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas.html) |
| `age_days` | 继续作为精确年龄的规范输入；另派生 `completed_months` 用于路由，派生精确 `age_months` 给 CDC | WHO 年龄型表以天为轴；CDC 要求精确到当天的月龄。不要用整数月或 `birth_day_number` 替代查表年龄。[WHO 制图说明](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf?sfvrsn=5cec8c61_23)、[CDC SAS Program](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas.html) |
| `axis_value` | 对 weight-for-length/height 记录参与计算的身长/身高及其单位；年龄型指数则为 `age_days`/`age_months` | weight-for-length/height 的查表轴是身长/身高，不是年龄；CDC 也单独提供按 recumbent length 或 stature 的文件。[WHO Weight-for-length/height](https://www.who.int/tools/child-growth-standards/standards/weight-for-length-height)、[CDC 数据文件](https://www.cdc.gov/growthcharts/cdc-data-files.htm) |
| `percentiles` | 从固定 `p2/p25/p50/p75/p98` 改为可扩展 map，例如 `p3`、`p5`、`p50`、`p85`、`p95`、`p97`、`p98`、`p99_9`；保留旧字段只作兼容 | WHO 的 2/98 标签是约 ±2 SD，CDC 2000 和 Extended BMI 使用的百分位集合不同；固定五列会丢失来源语义。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/)、[CDC 数据文件](https://www.cdc.gov/growthcharts/cdc-data-files.htm)、[CDC Extended BMI Data Files](https://www.cdc.gov/growthcharts/extended-bmi-data-files.htm) |
| `lms` | 保存完整精度的 `L`、`M`、`S`，并带 `axis`、`source_version`、`dataset_url`；不要只保留结果百分位 | CDC 提供 L/M/S 作为精确百分位和 z-score 的输入，且不同来源的方法和轴不同。[CDC 数据文件](https://www.cdc.gov/growthcharts/cdc-data-files.htm)、[NCHS CDC LMS 方法](https://www.cdc.gov/nchs/data/nhsr/nhsr063.pdf) |
| `sigma` / `tail_method` | 只在 `cdc_extended_bmi_2022` 需要时出现 | Extended BMI 的 95th 以上不能只用普通 L/M/S，必须使用 sigma 和专门公式。[CDC Extended BMI Data Files](https://www.cdc.gov/growthcharts/extended-bmi-data-files.htm) |
| `age_basis` | 至少区分 `chronological`、`corrected`、`unsupported_preterm` | AAP 对早产儿要求使用 corrected age 到 3 岁；当前自由文本孕周不足以支撑校正。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/) |
| `calculation_version` | 数据集版本、计算方法、发布日期或 checksum | 官方文件会更新，且 CDC 2000、CDC Extended BMI、WHO 的参数和计算路径不同；结果必须可重现。[CDC Data Files](https://www.cdc.gov/growthcharts/cdc-data-files.htm)、[CDC Computer Programs](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/index.html) |

### 5.2 推荐的最小结果对象

不要求现在实现以下代码，但结果语义应接近：

```text
reference_set: who_2006_0_2 | cdc_2000_2_20 | ...
index: weight_for_age | length_or_height_for_age | weight_for_length_or_height | bmi_for_age | head_circumference_for_age
sex: male | female | unknown
measurement_kind: weight_kg | recumbent_length_cm | standing_height_cm | head_circumference_cm
age_days: exact integer
completed_months: derived routing value
axis_value: null for age-based index, length/height for weight-for-length/height
lms: { L, M, S, sigma? }
percentile: number | null
z_score: number | null
percentiles: { p3?, p5?, p25?, p50?, p75?, p85?, p95?, p97?, p98?, p99_9? }
calculation_version: { dataset, source_url, method, checksum? }
interpretation: descriptive_observation
```

这里的关键不是字段名称，而是以下不变量：

1. `percentile` 必须绑定 `index` 和 `reference_set`；不能存在一个脱离指数的“孩子百分位”。
2. `weight_for_age`、`weight_for_length_or_height`、`bmi_for_age` 必须是三个不同结果；CDC 明确说 weight-for-age 不用于把 2–20 岁儿童分类为 underweight 或 overweight，BMI-for-age 才是体重状态分类的指数。[CDC Anthropometric Indices](https://www.cdc.gov/growth-chart-training/hcp/overview/anthropometric-indices.html)
3. `p2/p98` 只能表示当前参考集的展示边界或 ±2 SD 近似标签；状态名不应暗示“正常/异常”。WHO/CDC 资料都把这些值放在监测和筛查语境中，而不是单点诊断语境。[CDC Growth Charts](https://www.cdc.gov/growthcharts/)、[CDC Using WHO Growth Standard Charts](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-using.html)
4. 如果 `sex` 为 `unknown`、测量方式和参考集不匹配、年龄超出指数范围或早产校正未支持，结果应为 `unavailable`/“仅记录测量”，而不是回退到另一个性别、另一个参考集或最近一行。CDC 的计算程序对缺失/不匹配的变量会输出缺失值，这比猜测更安全。[CDC SAS Program for WHO Growth Charts](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas-who.html)

### 5.3 适合当前项目的分阶段边界

研究建议把最小扩展限定为：

1. 第一阶段只新增参考集路由、指数字段、线性测量姿势、精确年龄派生和版本元数据；保留现有三种原始测量，不新增 arm circumference、skinfold、velocity 或 motor milestone 事件。WHO 虽然提供这些指标，但它们具有不同的年龄/间隔轴，超出了当前事件模型。[WHO 指标总览](https://www.who.int/tools/child-growth-standards/standards)、[当前项目产品边界](../../AGENTS.md)
2. 先支持 AAP 对齐的 `who_2006_0_2` + `cdc_2000_2_20`，并对 WHO 0–5 保留独立的研究/显式参考选项；不要把 WHO 0–5 在 24 个月后无标签地混入默认曲线。[CDC 推荐理由](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/recommendations-and-rationale.html)
3. 第一阶段的 2–20 岁 BMI 可以只计算 CDC 2000 的普通范围；对 Extended BMI 只显示“未支持”或单独做明确版本化工作，不要用现有 `p98` 外推高尾部。[CDC Extended BMI Data Files](https://www.cdc.gov/growthcharts/extended-bmi-data-files.htm)
4. 头围默认不要自动延伸到 CDC 2–20；若采用 WHO 0–5，结果必须显示 `who_2006_0_5 + head_circumference_for_age`，若采用 AAP 默认路线，则至少实现到明确的 WHO 范围，并遵循 AAP 对 2 岁体检时头围记录的边界。[AAP 2 岁以上评估指南](https://eqipp.aap.org/courses/growth2/mn/clinical-guide/popups/children-ages-2-years-and-older)、[WHO Head circumference-for-age](https://www.who.int/tools/child-growth-standards/standards/head-circumference-for-age)、[CDC 数据文件](https://www.cdc.gov/growthcharts/cdc-data-files.htm)

## 6. 产品绝对不能解释成诊断的内容

以下限制应同时写入 UI 文案、机器端点说明、导出字段说明和 ChatGPT/Tasks 的上下文提示：

- 不能把“低于/高于某百分位”说成疾病、发育迟缓、营养不良、消瘦、矮小、肥胖、微头围或 failure to thrive 的诊断。生长曲线的定位是跟踪和筛查；CDC 明确说不能作为唯一诊断工具。[CDC Growth Charts](https://www.cdc.gov/growthcharts/)、[CDC Clinical Growth Charts](https://www.cdc.gov/growth-chart-training/hcp/overview/what-are-clinical-growth-charts.html)
- 不能把一次测量或一次百分位变化当作结论。AAP 建议关注连续趋势，HealthyChildren 直接说明一个静态点不如多个时间点；CDC 也要求准确测量、准确年龄和一系列测量来解释增长模式。[AAP HealthyChildren 生长曲线说明](https://www.healthychildren.org/English/health-issues/conditions/Glands-Growth-Disorders/Pages/growth-charts-by-the-numbers.aspx)、[CDC Using WHO Growth Standard Charts](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-using.html)
- 不能把百分位当成绩：AAP 明确说第 10 百分位并不比第 90 百分位“差”，更重要的是孩子自己的连续趋势。[AAP HealthyChildren 生长曲线说明](https://www.healthychildren.org/English/health-issues/conditions/Glands-Growth-Disorders/Pages/growth-charts-by-the-numbers.aspx)
- 不能对 2 岁以下的 WHO BMI 直接输出 underweight、overweight 或 obesity 分类。AAP 指出 2 岁以下没有公认定义；CDC 也不推荐 2 岁以下使用 BMI-for-age 曲线作为默认分类。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/)、[CDC WHO summary](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-summary.html)
- 对 2 岁以上的 BMI 分类也只能叫筛查/参考分类，不能叫诊断。CDC 的 BMI 工具明确说 BMI 是 screening measure，不是疾病诊断，也不是临床指导或专业医疗意见的替代品。[CDC Child and Teen BMI Calculator](https://www.cdc.gov/bmi/child-teen-calculator/index.html)、[CDC BMI Training](https://www.cdc.gov/growth-chart-training/hcp/using-bmi/)
- 不能根据结果自动决定限制饮食、增加/减少喂养、给药、停药或其他治疗；产品可以提示“记录连续测量并与儿科医生讨论”，不能替代儿科医生的病史、查体、家族史和必要检查。AAP HealthyChildren 也声明网站信息不能替代儿科医生的医疗建议。[AAP HealthyChildren 生长曲线说明](https://www.healthychildren.org/English/health-issues/conditions/Glands-Growth-Disorders/Pages/growth-charts-by-the-numbers.aspx)

推荐的非诊断文案是：

> “这是在 `reference_set` 和 `index` 下，相对于参考人群的描述性位置。单次结果不能判断健康或疾病；请结合测量方式、连续记录、出生/孕周背景和儿科随访理解。”

对于当前的 `within_reference_band`、`below_reference_band`、`above_reference_band`，更安全的展示文案是“位于当前展示参考边界内/下方/上方”，并始终邻接参考集、指数、年龄和“仅供观察与就医讨论”的说明；不要把它缩短为“正常/异常”。这是一项基于 CDC “不是唯一诊断工具”和 AAP “趋势优先”原则的产品推导。[CDC Growth Charts](https://www.cdc.gov/growthcharts/)、[AAP HealthyChildren 生长曲线说明](https://www.healthychildren.org/English/health-issues/conditions/Glands-Growth-Disorders/Pages/growth-charts-by-the-numbers.aspx)

## 7. 推荐的研究结论和验收边界

### 推荐默认配置

- `app_aap_us`：未满 24 个月使用 `who_2006_0_2`；24 个月至未满 20 岁使用 `cdc_2000_2_20`；BMI 高尾部是否启用另行版本化，不从 `p98` 推断。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/)、[CDC Recommended Charts](https://www.cdc.gov/growth-chart-training/hcp/overview/recommended.html)
- `who_0_5_explicit`：只在用户/产品明确选择 WHO 0–5 时使用 `who_2006_0_5`，并在每个结果中显示该参考集；它不能悄悄取代 AAP 默认路线的 24 个月切换。[WHO 儿童生长标准问答](https://www.who.int/news-room/questions-and-answers/item/child-growth-standards)、[CDC 推荐理由](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/recommendations-and-rationale.html)

### 最小安全交付检查

1. 每个百分位结果都能回答：使用了哪个参考集、哪个指数、哪个年龄/身长轴、哪种线性测量、哪个版本和哪套算法。
2. 24 个月边界测试同时覆盖：WHO 末端、CDC 起点、仰卧身长/站立身高和同一原始测量在两个参考集下可能出现不同百分位的提示。[CDC Using WHO Growth Standard Charts](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-using.html)
3. 0–2 岁 BMI 不显示体重状态分类；2–20 岁高 BMI 不在 Extended BMI 尚未实现时伪造 p98 以上百分位。[AAP Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/)、[CDC Extended BMI Data Files](https://www.cdc.gov/growthcharts/extended-bmi-data-files.htm)
4. 性别未知、早产校正不受支持、测量姿势缺失、年龄/轴超出范围时 fail closed 为 unavailable/记录-only，不回退到猜测值。[CDC SAS Program for WHO Growth Charts](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas-who.html)
5. 任何“below/above”状态都伴随非诊断说明，且不触发药物、喂养限制或治疗动作。[CDC Child and Teen BMI Calculator](https://www.cdc.gov/bmi/child-teen-calculator/index.html)、[AAP HealthyChildren 生长曲线说明](https://www.healthychildren.org/English/health-issues/conditions/Glands-Growth-Disorders/Pages/growth-charts-by-the-numbers.aspx)

## 8. 一手来源索引

- AAP：[Term Infant Growth Tools](https://www.aap.org/en/patient-care/newborn-infant-and-early-childhood-nutrition/newborn-and-infant-nutrition-assessment-tools/term-infant-growth-tools/)、[HealthyChildren 生长曲线说明](https://www.healthychildren.org/English/health-issues/conditions/Glands-Growth-Disorders/Pages/growth-charts-by-the-numbers.aspx)、[2 岁以上评估指南](https://eqipp.aap.org/courses/growth2/mn/clinical-guide/popups/children-ages-2-years-and-older)
- WHO：[Child Growth Standards 总览](https://www.who.int/tools/child-growth-standards)、[指标页](https://www.who.int/tools/child-growth-standards/standards)、[制图说明 PDF](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf?sfvrsn=5cec8c61_23)、[Anthro 手册](https://www.who.int/docs/default-source/child-growth/child-growth-standards/software/anthro-pc-manual-v322.pdf)
- CDC/NCHS：[Growth Charts](https://www.cdc.gov/growthcharts/)、[2000 数据文件](https://www.cdc.gov/growthcharts/cdc-data-files.htm)、[WHO 数据文件](https://www.cdc.gov/growthcharts/who-data-files.htm)、[CDC 推荐曲线](https://www.cdc.gov/growth-chart-training/hcp/overview/recommended.html)、[CDC WHO SAS 程序](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas-who.html)、[CDC SAS 程序](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/sas.html)、[R 程序清单](https://www.cdc.gov/growth-chart-training/hcp/computer-programs/r-programs.html)、[Extended BMI 数据](https://www.cdc.gov/growthcharts/extended-bmi-data-files.htm)、[NCHS CDC 2000 LMS 方法](https://www.cdc.gov/nchs/data/nhsr/nhsr063.pdf)
