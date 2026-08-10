# 成长参考扩展实施计划

## 当前结论

本次扩展建议先把现有出生后 0–13 周参考范围扩展到出生至 24 个月，继续使用 WHO Child Growth Standards 的体重、身长和头围按年龄参考。这个范围与 AAP/CDC 对美国婴幼儿出生至 2 岁使用 WHO 标准的建议一致，也能覆盖 Baby Log 当前的家庭婴儿照护场景。

2 岁后的参考不在本次实施范围内。AAP/CDC 的美国使用路径在 2 岁切换到 CDC 2000 Growth Charts；这会引入新的标准、指标和身长/身高语义，不应把两套曲线静默拼接成一个“WHO 曲线”。

## 权威依据

- AAP 公开说明支持对美国 0–23 个月儿童使用 WHO 国际生长图表：[AAP News：CDC recommends WHO growth charts for children under 2](https://publications.aap.org/aapnews/article/31/11/1/23445/CDC-Use-WHO-growth-charts-for-children-under-2)。
- CDC 当前说明：出生至 2 岁使用 WHO 标准，2 岁及以上使用 CDC 曲线；WHO 婴幼儿图表包含按年龄的身长、体重、体重相对身长和头围指标：[Using WHO Child Growth Standards](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-summary.html)。
- CDC 官方数据页提供出生至 24 个月的体重、身长和头围 CSV/XLS，并提供 L、M、S 参数；页面说明这些参数可用于精确计算 z-score/百分位，并允许对更细年龄做插值：[WHO Growth Charts Data files](https://www.cdc.gov/growthcharts/who-data-files.htm)。
- WHO 的完整 Child Growth Standards 覆盖出生至 5 岁，但“可覆盖”不等于本产品现在就应扩展到 5 岁；本阶段以 AAP/CDC 的出生至 2 岁使用边界为准：[WHO Child Growth Standards](https://www.who.int/tools/child-growth-standards)。
- 无论参考区间落点如何，生长图表都只是整体健康评估的一项资料，不能作为单独诊断工具；CDC 对此有明确说明：[CDC Growth Charts](https://www.cdc.gov/growthcharts/)。

## 实施范围

### 保留的产品行为

- 保留现有 `growth_measurement` 事件、体重/身长/头围三个指标、性别和出生日期前置条件。
- 保留现有管理端、只读页和 machine JSON 的 `growth_curve` 载荷形状，避免新增数据库表、事件类型或页面。
- 保留出生至第 91 天现有按日数据和已有测试结果，避免首版参考值发生无意漂移。
- 保留“家庭观察和回顾，不替代儿保随访或儿科判断”的提示和 `within/below/above` 状态语义；状态只描述与所选参考带的关系，不诊断疾病、不判断是否需要治疗。

### 参考数据与年龄计算

1. 采用 CDC 官方 `WHOref_d.csv` 日表（不是月度 CSV）作为生成输入；该文件对男孩/女孩按 `agedays` 提供体重、身长和头围的 L/M/S，当前本地 0–91 天数据正是它的子集。第一阶段只生成/打包出生至第 730 天的 WHO 数据，避免把 2 岁后的 WHO 数据静默当成 AAP 默认参考。
2. 体重数据入库前统一从 kg 转为现有接口使用的 g；身长和头围继续使用 cm。
3. 服务端继续以出生日期和 `local_date` 得到精确 `age_days`，直接查对应日表，不把整月压成一个整数年龄，也不在 Worker 运行时访问外网。
4. 参考区间的 p25、p50、p75、p2、p98 由 L/M/S 参数计算；要保留现有 p2–p98 语义，不直接把 CDC 月度文件中标为 `2nd (2.3rd)` 和 `98th (97.7th)` 的近似列冒充精确 2/98 百分位。生成器应固定 z-score/百分位映射并保留足够精度。
5. 第 731 天起返回 `unavailable`，但仍显示已记录的测量值；提示改为“当前 WHO 参考范围覆盖出生至未满 24 个月”。不把超出覆盖范围的记录判定为异常。第 730/731 天的身长/身高测量边界必须在研究说明和测试中明确，不能用普通线性插值掩盖。
6. payload 的来源说明改为同时标明 WHO 标准和 CDC 官方日表，并明确年龄范围、计算方法以及“仅供家庭观察”的限制。

### 不纳入本次实施

- 不新增 2 岁后的 CDC 2000 曲线、BMI、体重相对身长或体重相对身高。
- 不实现 WHO 与 CDC 在 2 岁处的平滑过渡；AAP 2025 论文提出的渐进式过渡是研究结果，不应在本产品中自行升级成临床规则。
- 不增加诊断、营养处方、治疗建议、异常告警或“生长迟缓/超重”等临床结论。
- 不修改事件模型、数据库 schema、登录、导出或其他页面。

## 代码变更边界

- `src/server/services/growth-reference-data.ts`：增加可复现生成的 0–24 个月 WHO 月度参数/参考表，并保留现有日表。
- `src/server/services/growth-reference-service.ts`：增加月度参数插值、LMS 百分位边界计算和 24 个月覆盖判定；更新数据集说明和超范围提示。
- `src/client/types.ts`：仅在服务端 payload 的来源元数据确有必要时同步类型，不改变测量项目的公共形状。
- `src/client/components/GrowthCurvePanel.tsx`：更新超出范围的中英文提示，继续显示“暂无参考”而不是推测结果。
- `tests/server/growth-reference-service.test.ts`：增加 92 天、12 个月、24 个月和超过 24 个月的边界/插值测试，并覆盖男女至少一个指标的 LMS 百分位计算。
- 增加一个 `scripts/` 下的离线生成器，只读取已下载的官方 CSV 并生成静态 TypeScript 数据；不在 Worker 运行时访问外网。生成器应验证男女各自的年龄边界、指标字段和 L/M/S 完整性。

## 验收标准

- 出生至第 91 天的既有测试全部保持通过。
- 92 天、12 个月和第 730 天的三项参考均可用，`reference.age_days` 与测量年龄一致，百分位和 z-score 可由 L/M/S 重现。
- 第 731 天以后，测量仍可记录和显示，但不产生参考区间、百分位或 above/below 判断。
- 男孩与女孩的参考值均来自对应性别数据，不允许缺省到另一性别。
- 管理端、只读端和 machine JSON 的数据源说明一致；中英文超范围提示一致。
- `npm test` 和 `npm run build` 通过；不产生网络运行时依赖。

## 需要用户批准的决策

请批准本计划后再进入代码实现。后续若要覆盖 2 岁以上，需要另行确认：采用 CDC 2000 还是其他本地参考、是否引入 BMI/身高语义、如何处理 2 岁标准切换，以及是否仍属于 Baby Log 当前产品范围。
