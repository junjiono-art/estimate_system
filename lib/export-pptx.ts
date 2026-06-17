import type { ReportExportConfig, ReportKpiId, ReportSectionId, SimulationResult } from "@/lib/types"
import { DEFAULT_REPORT_EXPORT_CONFIG, REPORT_KPI_LABELS } from "@/lib/default-report-export"

// 試算結果を PowerPoint(pptx) として出力する（クライアント専用・pptxgenjs を動的import）。
// 画面DOMには依存せず、ReportExportConfig に従って内容カテゴリ毎にスライドを生成する。

const SCENARIO_LABELS: Record<string, string> = {
  conservative: "保守シナリオ",
  standard: "標準シナリオ",
  aggressive: "強気シナリオ",
}

const COLOR_DARK = "1F2937"
const COLOR_GREEN = "16A34A"
const COLOR_GRAY = "6B7280"
const COLOR_HEADER_BG = "EEF2FF"
const COLOR_BORDER = "E5E7EB"

const PAGE_DIMS = {
  A4: { landscape: { w: 11.69, h: 8.27 }, portrait: { w: 8.27, h: 11.69 } },
  Letter: { landscape: { w: 11, h: 8.5 }, portrait: { w: 8.5, h: 11 } },
} as const

const yen = (n?: number): string => (Number.isFinite(n) ? `¥${Math.round(n as number).toLocaleString()}` : "—")
const num = (n?: number, unit = ""): string => (Number.isFinite(n) ? `${Math.round(n as number).toLocaleString()}${unit}` : "—")

type Cell = string | { text: string; options?: Record<string, unknown> }

function kpiValue(result: SimulationResult, id: ReportKpiId): string {
  switch (id) {
    case "initialInvestment": return yen(result.totalInitialInvestment)
    case "monthlyRevenue": return yen(result.monthlyRevenue)
    case "monthlyProfit": return yen(result.monthlyProfit)
    case "paybackMonths": return result.paybackMonths > 0 ? `${result.paybackMonths}ヶ月` : "—"
    case "breakevenMembers": return num(result.breakevenMembers, " 名")
    case "averagePrice": return yen(result.averagePrice)
    case "contributionMargin": return yen(result.contributionMarginPerMember)
    case "maxMembers": return num(result.capacity?.maxMembers, " 名")
    default: return "—"
  }
}

export async function exportResultToPptx(result: SimulationResult, configInput?: ReportExportConfig): Promise<void> {
  const config = configInput ?? DEFAULT_REPORT_EXPORT_CONFIG
  const accent = /^[0-9a-fA-F]{6}$/.test(config.theme.accentColor) ? config.theme.accentColor : DEFAULT_REPORT_EXPORT_CONFIG.theme.accentColor

  const PptxGenJS = (await import("pptxgenjs")).default
  const pptx = new PptxGenJS()
  const dim = PAGE_DIMS[config.page.size]?.[config.page.orientation] ?? PAGE_DIMS.A4.landscape
  pptx.defineLayout({ name: "REPORT", width: dim.w, height: dim.h })
  pptx.layout = "REPORT"

  const M = 0.5
  const W = dim.w - M * 2
  const leftW = W * 0.5
  const rightX = M + W * 0.52
  const rightW = W * 0.48

  const headerRow = (cells: string[]): Cell[] =>
    cells.map((text) => ({ text, options: { bold: true, fill: { color: COLOR_HEADER_BG }, color: COLOR_DARK } }))

  const tableBase = {
    border: { type: "solid" as const, color: COLOR_BORDER, pt: 1 },
    color: COLOR_DARK,
    fontSize: 12,
    valign: "middle" as const,
    rowH: 0.4,
  }

  type Slide = ReturnType<typeof pptx.addSlide>
  const newSlide = () => pptx.addSlide()
  const addTitle = (slide: Slide, text: string) =>
    slide.addText(text, { x: M, y: 0.35, w: W, h: 0.5, fontSize: 22, bold: true, color: accent })
  const addTable = (slide: Slide, rows: Cell[][], opts: Record<string, unknown>) =>
    slide.addTable(rows as unknown as Parameters<typeof slide.addTable>[0], { ...tableBase, ...opts })

  // ── 表紙 ──
  const cover = newSlide()
  cover.background = { color: "FFFFFF" }
  if (config.cover.logoDataUrl) {
    cover.addImage({ data: config.cover.logoDataUrl, x: M, y: 0.5, w: 2.2, h: 1.0, sizing: { type: "contain", w: 2.2, h: 1.0 } })
  }
  cover.addText(config.cover.title || "出店試算レポート", { x: M, y: dim.h * 0.32, w: W, h: 0.9, fontSize: 30, bold: true, color: COLOR_DARK })
  cover.addText(result.storeName || "試算結果", { x: M, y: dim.h * 0.32 + 1.0, w: W, h: 0.7, fontSize: 22, color: accent })
  const metaParts = [
    config.cover.companyName ? config.cover.companyName : "",
    result.location ? `住所: ${result.location}` : "",
    `シナリオ: ${SCENARIO_LABELS[result.scenario] ?? result.scenario}`,
    result.franchiseRate != null ? `ロイヤリティ: ${result.franchiseRate}%` : "",
    `作成日: ${new Date(result.createdAt || Date.now()).toLocaleDateString("ja-JP")}`,
  ].filter(Boolean)
  cover.addText(metaParts.join("　/　"), { x: M, y: dim.h * 0.32 + 1.8, w: W, h: 0.5, fontSize: 13, color: COLOR_GRAY })

  // ── セクション別ビルダー（データが無ければ false を返してスライドを作らない）──
  const builders: Record<ReportSectionId, () => boolean> = {
    summary: () => {
      const items = config.kpiItems.filter((k) => k.enabled)
      if (items.length === 0) return false
      const s = newSlide()
      addTitle(s, "サマリ（主要指標）")
      addTable(
        s,
        [headerRow(["項目", "金額 / 値"]), ...items.map((k): Cell[] => [REPORT_KPI_LABELS[k.id], kpiValue(result, k.id)])],
        { x: M, y: 1.0, w: W, colW: [W * 0.55, W * 0.45] },
      )
      return true
    },
    investment: () => {
      const s = newSlide()
      addTitle(s, "初期投資の内訳")
      addTable(
        s,
        [
          headerRow(["項目", "金額"]),
          ["フィットネスマシン費", yen(result.machinesCost)],
          ["内装・看板費", yen(result.interiorCost)],
          ["FC初期費用", yen(result.franchiseInitialCost)],
          ["その他", yen(result.otherInitialCost)],
          [{ text: "合計", options: { bold: true } }, { text: yen(result.totalInitialInvestment), options: { bold: true } }],
        ],
        { x: M, y: 1.0, w: leftW, colW: [leftW * 0.6, leftW * 0.4] },
      )
      s.addChart(
        pptx.ChartType.bar,
        [
          {
            name: "初期投資",
            labels: ["マシン", "内装", "FC初期", "その他"],
            values: [result.machinesCost, result.interiorCost, result.franchiseInitialCost, result.otherInitialCost].map(
              (v) => Math.round(Number(v) || 0),
            ),
          },
        ],
        { x: rightX, y: 1.0, w: rightW, h: dim.h - 1.6, showLegend: false, chartColors: [accent] },
      )
      return true
    },
    monthlyPL: () => {
      const s = newSlide()
      addTitle(s, "月間収支（12ヶ月目基準）")
      addTable(
        s,
        [
          headerRow(["項目", "月額"]),
          ["売上", yen(result.monthlyRevenue)],
          ["家賃", `▲ ${yen(result.monthlyRent)}`],
          ["ランニングコスト", `▲ ${yen(result.monthlyRunningCost)}`],
          ["　うちマシンメンテナンス費", yen(result.monthlyMachineMaintenance)],
          ["FC費（ロイヤリティ＋アプリ）", `▲ ${yen(result.monthlyFranchiseCost)}`],
          [{ text: "月間利益", options: { bold: true } }, { text: yen(result.monthlyProfit), options: { bold: true, color: COLOR_GREEN } }],
        ],
        { x: M, y: 1.0, w: W, colW: [W * 0.6, W * 0.4] },
      )
      return true
    },
    breakeven: () => {
      const s = newSlide()
      addTitle(s, "損益分岐点・キャパシティ")
      if (result.breakevenVariants) {
        const bv = result.breakevenVariants
        addTable(
          s,
          [
            headerRow(["損益分岐（条件別）", "必要会員数"]),
            ["固定費のみ", num(bv.fixedOnly, " 名")],
            ["＋広告費", num(bv.withAdCost, " 名")],
            ["＋減価償却", num(bv.withDepreciation, " 名")],
            ["＋広告費＋減価償却", num(bv.withAdCostAndDepreciation, " 名")],
          ],
          { x: M, y: 1.0, w: leftW, colW: [leftW * 0.62, leftW * 0.38] },
        )
      }
      if (result.capacity) {
        addTable(
          s,
          [
            headerRow(["キャパシティ", "値"]),
            ["最大会員数", num(result.capacity.maxMembers, " 名")],
            ["同時利用人数", num(result.capacity.concurrentUsers, " 名")],
            ["必要駐車台数", num(result.capacity.parkingSpaces, " 台")],
          ],
          { x: rightX, y: 1.0, w: rightW, colW: [rightW * 0.6, rightW * 0.4] },
        )
      }
      return true
    },
    annual: () => {
      if (!result.annualProjection || result.annualProjection.length === 0) return false
      const ap = result.annualProjection.slice(0, 10)
      const s = newSlide()
      addTitle(s, "年次推移")
      addTable(
        s,
        [
          headerRow(["年", "会員数", "売上", "税引後利益"]),
          ...ap.map((r): Cell[] => [`${r.year}年目`, num(r.yearEndMembers), yen(r.revenue), yen(r.afterTaxProfit)]),
        ],
        { x: M, y: 1.0, w: leftW, fontSize: 10, rowH: 0.32 },
      )
      const labels = ap.map((r) => `${r.year}年目`)
      s.addChart(
        pptx.ChartType.line,
        [
          { name: "売上", labels, values: ap.map((r) => Math.round(r.revenue)) },
          { name: "税引後利益", labels, values: ap.map((r) => Math.round(r.afterTaxProfit)) },
        ],
        { x: rightX, y: 1.0, w: rightW, h: dim.h - 1.6, showLegend: true, legendPos: "b", chartColors: [accent, COLOR_GREEN] },
      )
      return true
    },
    demographics: () => {
      const demo = result.demographics
      if (!demo || !demo.byAgeGender || demo.byAgeGender.length === 0) return false
      const s = newSlide()
      addTitle(s, "商圏・人口統計")
      addTable(
        s,
        [
          headerRow(["項目", "値"]),
          ["対象エリア", `${demo.municipality.prefecture}${demo.municipality.city}`],
          ["総人口", num(demo.bySex.total, " 人")],
          ["男性", num(demo.bySex.male, " 人")],
          ["女性", num(demo.bySex.female, " 人")],
        ],
        { x: M, y: 1.0, w: leftW, colW: [leftW * 0.5, leftW * 0.5] },
      )
      s.addChart(
        pptx.ChartType.bar,
        [{ name: "人口", labels: demo.byAgeGender.map((a) => a.ageGroup), values: demo.byAgeGender.map((a) => Math.round(Number(a.total) || 0)) }],
        { x: rightX, y: 1.0, w: rightW, h: dim.h - 1.6, showLegend: false, chartColors: [accent] },
      )
      return true
    },
  }

  // 設定の順序・ON/OFF に従ってセクションを出力する。
  for (const section of config.sections) {
    if (section.enabled) builders[section.id]()
  }

  const safeName = (result.storeName || "result").replace(/[\\/:*?"<>|\s]+/g, "_")
  await pptx.writeFile({ fileName: `試算レポート_${safeName}.pptx` })
}
