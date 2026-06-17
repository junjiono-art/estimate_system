import type { SimulationResult } from "@/lib/types"

// 試算結果を PowerPoint(pptx) として出力する（クライアント専用・pptxgenjs を動的import）。
// 画面DOMには依存せず、SimulationResult のデータから「内容カテゴリ毎」にスライドを生成する。

const SCENARIO_LABELS: Record<string, string> = {
  conservative: "保守シナリオ",
  standard: "標準シナリオ",
  aggressive: "強気シナリオ",
}

// pptxgenjs の色は # 無しの16進。生成物専用のためここではHEXを使う。
const COLOR_DARK = "1F2937"
const COLOR_ACCENT = "2563EB"
const COLOR_GREEN = "16A34A"
const COLOR_GRAY = "6B7280"
const COLOR_HEADER_BG = "EEF2FF"
const COLOR_BORDER = "E5E7EB"

const yen = (n?: number): string => (Number.isFinite(n) ? `¥${Math.round(n as number).toLocaleString()}` : "—")
const num = (n?: number, unit = ""): string => (Number.isFinite(n) ? `${Math.round(n as number).toLocaleString()}${unit}` : "—")

type Cell = string | { text: string; options?: Record<string, unknown> }

function headerRow(cells: string[]): Cell[] {
  return cells.map((text) => ({ text, options: { bold: true, fill: { color: COLOR_HEADER_BG }, color: COLOR_DARK } }))
}

export async function exportResultToPptx(result: SimulationResult): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default
  const pptx = new PptxGenJS()
  pptx.layout = "LAYOUT_WIDE" // 13.33 x 7.5 inch

  const tableBase = {
    border: { type: "solid" as const, color: COLOR_BORDER, pt: 1 },
    color: COLOR_DARK,
    fontSize: 13,
    valign: "middle" as const,
    rowH: 0.42,
  }

  type Slide = ReturnType<typeof pptx.addSlide>
  const addTitle = (slide: Slide, text: string) =>
    slide.addText(text, { x: 0.6, y: 0.4, w: 12, h: 0.5, fontSize: 24, bold: true, color: COLOR_DARK })
  const addTable = (slide: Slide, rows: Cell[][], opts: Record<string, unknown>) =>
    slide.addTable(rows as unknown as Parameters<typeof slide.addTable>[0], { ...tableBase, ...opts })

  // ── Slide 1: タイトル ──
  const s1 = pptx.addSlide()
  s1.background = { color: "FFFFFF" }
  s1.addText("出店試算レポート", { x: 0.6, y: 1.7, w: 12.1, h: 0.9, fontSize: 34, bold: true, color: COLOR_DARK })
  s1.addText(result.storeName || "試算結果", { x: 0.6, y: 2.7, w: 12.1, h: 0.7, fontSize: 24, color: COLOR_ACCENT })
  const meta = [
    result.location ? `住所: ${result.location}` : "",
    `シナリオ: ${SCENARIO_LABELS[result.scenario] ?? result.scenario}`,
    result.franchiseRate != null ? `ロイヤリティ: ${result.franchiseRate}%` : "",
    `作成日: ${new Date(result.createdAt || Date.now()).toLocaleDateString("ja-JP")}`,
  ]
    .filter(Boolean)
    .join("　/　")
  s1.addText(meta, { x: 0.6, y: 3.6, w: 12.1, h: 0.5, fontSize: 14, color: COLOR_GRAY })

  // ── Slide 2: サマリ（主要KPI） ──
  const s2 = pptx.addSlide()
  addTitle(s2, "サマリ（主要指標）")
  addTable(
    s2,
    [
      headerRow(["項目", "金額 / 値"]),
      ["初期投資合計", yen(result.totalInitialInvestment)],
      ["月間売上（12ヶ月目）", yen(result.monthlyRevenue)],
      ["月間利益（12ヶ月目）", yen(result.monthlyProfit)],
      ["回収期間", result.paybackMonths > 0 ? `${result.paybackMonths}ヶ月` : "—"],
      ["損益分岐会員数", num(result.breakevenMembers, " 名")],
      ["平均単価", yen(result.averagePrice)],
      ["限界利益 / 人", yen(result.contributionMarginPerMember)],
      ["最大会員数（キャパシティ）", num(result.capacity?.maxMembers, " 名")],
    ],
    { x: 0.6, y: 1.1, w: 9.0, colW: [4.5, 4.5] },
  )

  // ── Slide 3: 初期投資の内訳（表＋棒グラフ） ──
  const s3 = pptx.addSlide()
  addTitle(s3, "初期投資の内訳")
  addTable(
    s3,
    [
      headerRow(["項目", "金額"]),
      ["フィットネスマシン費", yen(result.machinesCost)],
      ["内装・看板費", yen(result.interiorCost)],
      ["FC初期費用", yen(result.franchiseInitialCost)],
      ["その他", yen(result.otherInitialCost)],
      [{ text: "合計", options: { bold: true } }, { text: yen(result.totalInitialInvestment), options: { bold: true } }],
    ],
    { x: 0.6, y: 1.1, w: 6.0, colW: [3.5, 2.5] },
  )
  s3.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "初期投資",
        labels: ["マシン", "内装", "FC初期", "その他"],
        values: [result.machinesCost, result.interiorCost, result.franchiseInitialCost, result.otherInitialCost].map((v) =>
          Math.round(Number(v) || 0),
        ),
      },
    ],
    { x: 7.0, y: 1.1, w: 5.8, h: 5.2, showLegend: false, chartColors: [COLOR_ACCENT] },
  )

  // ── Slide 4: 月間収支 ──
  const s4 = pptx.addSlide()
  addTitle(s4, "月間収支（12ヶ月目基準）")
  addTable(
    s4,
    [
      headerRow(["項目", "月額"]),
      ["売上", yen(result.monthlyRevenue)],
      ["家賃", `▲ ${yen(result.monthlyRent)}`],
      ["ランニングコスト", `▲ ${yen(result.monthlyRunningCost)}`],
      ["　うちマシンメンテナンス費", yen(result.monthlyMachineMaintenance)],
      ["FC費（ロイヤリティ＋アプリ）", `▲ ${yen(result.monthlyFranchiseCost)}`],
      [{ text: "月間利益", options: { bold: true } }, { text: yen(result.monthlyProfit), options: { bold: true, color: COLOR_GREEN } }],
    ],
    { x: 0.6, y: 1.1, w: 9.0, colW: [5.5, 3.5] },
  )

  // ── Slide 5: 損益分岐点＋キャパシティ ──
  const s5 = pptx.addSlide()
  addTitle(s5, "損益分岐点・キャパシティ")
  if (result.breakevenVariants) {
    const bv = result.breakevenVariants
    addTable(
      s5,
      [
        headerRow(["損益分岐（条件別）", "必要会員数"]),
        ["固定費のみ", num(bv.fixedOnly, " 名")],
        ["＋広告費", num(bv.withAdCost, " 名")],
        ["＋減価償却", num(bv.withDepreciation, " 名")],
        ["＋広告費＋減価償却", num(bv.withAdCostAndDepreciation, " 名")],
      ],
      { x: 0.6, y: 1.1, w: 6.0, colW: [3.8, 2.2] },
    )
  }
  if (result.capacity) {
    addTable(
      s5,
      [
        headerRow(["キャパシティ", "値"]),
        ["最大会員数", num(result.capacity.maxMembers, " 名")],
        ["同時利用人数", num(result.capacity.concurrentUsers, " 名")],
        ["必要駐車台数", num(result.capacity.parkingSpaces, " 台")],
      ],
      { x: 7.0, y: 1.1, w: 5.6, colW: [3.4, 2.2] },
    )
  }

  // ── Slide 6: 年次推移（表＋折れ線） ──
  if (result.annualProjection && result.annualProjection.length > 0) {
    const ap = result.annualProjection.slice(0, 10)
    const s6 = pptx.addSlide()
    addTitle(s6, "年次推移")
    addTable(
      s6,
      [
        headerRow(["年", "会員数", "売上", "税引後利益"]),
        ...ap.map((r): Cell[] => [`${r.year}年目`, num(r.yearEndMembers), yen(r.revenue), yen(r.afterTaxProfit)]),
      ],
      { x: 0.6, y: 1.1, w: 6.0, fontSize: 11, rowH: 0.34, colW: [1.2, 1.4, 1.7, 1.7] },
    )
    const labels = ap.map((r) => `${r.year}年目`)
    s6.addChart(
      pptx.ChartType.line,
      [
        { name: "売上", labels, values: ap.map((r) => Math.round(r.revenue)) },
        { name: "税引後利益", labels, values: ap.map((r) => Math.round(r.afterTaxProfit)) },
      ],
      { x: 7.0, y: 1.1, w: 5.8, h: 5.2, showLegend: true, legendPos: "b", chartColors: [COLOR_ACCENT, COLOR_GREEN] },
    )
  }

  // ── Slide 7: 商圏・人口統計（取得できている場合のみ） ──
  const demo = result.demographics
  if (demo && demo.byAgeGender && demo.byAgeGender.length > 0) {
    const s7 = pptx.addSlide()
    addTitle(s7, "商圏・人口統計")
    addTable(
      s7,
      [
        headerRow(["項目", "値"]),
        ["対象エリア", `${demo.municipality.prefecture}${demo.municipality.city}`],
        ["総人口", num(demo.bySex.total, " 人")],
        ["男性", num(demo.bySex.male, " 人")],
        ["女性", num(demo.bySex.female, " 人")],
      ],
      { x: 0.6, y: 1.1, w: 5.6, colW: [2.8, 2.8] },
    )
    s7.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "人口",
          labels: demo.byAgeGender.map((a) => a.ageGroup),
          values: demo.byAgeGender.map((a) => Math.round(Number(a.total) || 0)),
        },
      ],
      { x: 6.5, y: 1.1, w: 6.3, h: 5.2, showLegend: false, chartColors: [COLOR_ACCENT] },
    )
  }

  const safeName = (result.storeName || "result").replace(/[\\/:*?"<>|\s]+/g, "_")
  await pptx.writeFile({ fileName: `試算レポート_${safeName}.pptx` })
}
