import type { SimulationResult } from "@/lib/types"

// 試算結果を PowerPoint(pptx) として出力する（クライアント専用・pptxgenjs を動的import）。
// 画面DOMには依存せず、SimulationResult のデータからスライドを生成する。

const SCENARIO_LABELS: Record<string, string> = {
  conservative: "保守シナリオ",
  standard: "標準シナリオ",
  aggressive: "強気シナリオ",
}

// pptxgenjs の色は # 無しの16進。生成物専用のためここではHEXを使う。
const COLOR_DARK = "1F2937"
const COLOR_ACCENT = "2563EB"
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

  // ── Slide 2: サマリ（KPI） ──
  const s2 = pptx.addSlide()
  s2.addText("サマリ", { x: 0.6, y: 0.4, w: 12, h: 0.5, fontSize: 24, bold: true, color: COLOR_DARK })
  const kpiRows: Cell[][] = [
    headerRow(["項目", "金額 / 値"]),
    ["初期投資合計", yen(result.totalInitialInvestment)],
    ["月間売上（12ヶ月目）", yen(result.monthlyRevenue)],
    ["月間利益（12ヶ月目）", yen(result.monthlyProfit)],
    ["月間ランニングコスト", yen(result.monthlyRunningCost)],
    ["回収期間", result.paybackMonths > 0 ? `${result.paybackMonths}ヶ月` : "—"],
    ["損益分岐会員数", num(result.breakevenMembers, " 名")],
    ["平均単価", yen(result.averagePrice)],
    ["限界利益 / 人", yen(result.contributionMarginPerMember)],
    ["最大会員数（キャパシティ）", num(result.capacity?.maxMembers, " 名")],
  ]
  s2.addTable(kpiRows as unknown as Parameters<typeof s2.addTable>[0], { ...tableBase, x: 0.6, y: 1.1, w: 9.0, colW: [4.5, 4.5] })

  // ── Slide 3: 損益分岐点（4パターン） ──
  if (result.breakevenVariants) {
    const bv = result.breakevenVariants
    const s3 = pptx.addSlide()
    s3.addText("損益分岐点（4パターン）", { x: 0.6, y: 0.4, w: 12, h: 0.5, fontSize: 24, bold: true, color: COLOR_DARK })
    const rows: Cell[][] = [
      headerRow(["条件", "必要会員数"]),
      ["固定費のみ", num(bv.fixedOnly, " 名")],
      ["＋広告費", num(bv.withAdCost, " 名")],
      ["＋減価償却", num(bv.withDepreciation, " 名")],
      ["＋広告費＋減価償却", num(bv.withAdCostAndDepreciation, " 名")],
    ]
    s3.addTable(rows as unknown as Parameters<typeof s3.addTable>[0], { ...tableBase, x: 0.6, y: 1.1, w: 9.0, colW: [5.5, 3.5] })
  }

  // ── Slide 4: 年次推移（表＋折れ線） ──
  if (result.annualProjection && result.annualProjection.length > 0) {
    const ap = result.annualProjection.slice(0, 10)
    const s4 = pptx.addSlide()
    s4.addText("年次推移", { x: 0.6, y: 0.4, w: 12, h: 0.5, fontSize: 24, bold: true, color: COLOR_DARK })
    const tableRows: Cell[][] = [
      headerRow(["年", "会員数", "売上", "税引後利益"]),
      ...ap.map((r): Cell[] => [`${r.year}年目`, num(r.yearEndMembers), yen(r.revenue), yen(r.afterTaxProfit)]),
    ]
    s4.addTable(tableRows as unknown as Parameters<typeof s4.addTable>[0], { ...tableBase, x: 0.6, y: 1.1, w: 6.0, fontSize: 11, rowH: 0.34, colW: [1.2, 1.4, 1.7, 1.7] })

    const labels = ap.map((r) => `${r.year}年目`)
    const chartData = [
      { name: "売上", labels, values: ap.map((r) => Math.round(r.revenue)) },
      { name: "税引後利益", labels, values: ap.map((r) => Math.round(r.afterTaxProfit)) },
    ]
    s4.addChart(pptx.ChartType.line, chartData, {
      x: 7.0,
      y: 1.1,
      w: 5.8,
      h: 5.2,
      showLegend: true,
      legendPos: "b",
      chartColors: [COLOR_ACCENT, "16A34A"],
    })
  }

  const safeName = (result.storeName || "result").replace(/[\\/:*?"<>|\s]+/g, "_")
  await pptx.writeFile({ fileName: `試算レポート_${safeName}.pptx` })
}
