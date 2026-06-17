import type { ReportExportConfig, ReportKpiId, ReportSectionId } from "@/lib/types"

// セクション/KPI のラベル定義（マスタ画面と出力で共有）。
export const REPORT_SECTION_LABELS: Record<ReportSectionId, string> = {
  summary: "サマリ（主要KPI）",
  investment: "初期投資の内訳",
  monthlyPL: "月間収支",
  breakeven: "損益分岐点・キャパシティ",
  annual: "年次推移",
  demographics: "商圏・人口統計",
}

export const REPORT_KPI_LABELS: Record<ReportKpiId, string> = {
  initialInvestment: "初期投資合計",
  monthlyRevenue: "月間売上（12ヶ月目）",
  monthlyProfit: "月間利益（12ヶ月目）",
  paybackMonths: "回収期間",
  breakevenMembers: "損益分岐会員数",
  averagePrice: "平均単価",
  contributionMargin: "限界利益 / 人",
  maxMembers: "最大会員数（キャパシティ）",
}

const SECTION_ORDER: ReportSectionId[] = ["summary", "investment", "monthlyPL", "breakeven", "annual", "demographics"]
const KPI_ORDER: ReportKpiId[] = [
  "initialInvestment",
  "monthlyRevenue",
  "monthlyProfit",
  "paybackMonths",
  "breakevenMembers",
  "averagePrice",
  "contributionMargin",
  "maxMembers",
]

export const DEFAULT_REPORT_EXPORT_CONFIG: ReportExportConfig = {
  sections: SECTION_ORDER.map((id) => ({ id, enabled: true })),
  kpiItems: KPI_ORDER.map((id) => ({ id, enabled: true })),
  cover: { title: "出店試算レポート", companyName: "", logoDataUrl: undefined },
  theme: { accentColor: "2563EB" },
  page: { size: "A4", orientation: "landscape" },
}

const isSectionId = (v: unknown): v is ReportSectionId => typeof v === "string" && (SECTION_ORDER as string[]).includes(v)
const isKpiId = (v: unknown): v is ReportKpiId => typeof v === "string" && (KPI_ORDER as string[]).includes(v)

// 保存レコードに項目が欠けていても既定で補完し、未知/重複を除去する。
// 並び順は保存レコードの順序を尊重し、欠けているものは末尾に既定順で補う。
function normalizeOrderedToggles<T extends string>(
  saved: unknown,
  allIds: T[],
  isId: (v: unknown) => v is T,
): { id: T; enabled: boolean }[] {
  const result: { id: T; enabled: boolean }[] = []
  const seen = new Set<T>()
  if (Array.isArray(saved)) {
    for (const item of saved) {
      const id = (item as { id?: unknown })?.id
      if (isId(id) && !seen.has(id)) {
        seen.add(id)
        result.push({ id, enabled: (item as { enabled?: unknown }).enabled !== false })
      }
    }
  }
  for (const id of allIds) {
    if (!seen.has(id)) result.push({ id, enabled: true })
  }
  return result
}

export function normalizeReportExportConfig(input?: Partial<ReportExportConfig> | null): ReportExportConfig {
  const cfg = input ?? {}
  const size = cfg.page?.size === "Letter" ? "Letter" : "A4"
  const orientation = cfg.page?.orientation === "portrait" ? "portrait" : "landscape"
  const accent = typeof cfg.theme?.accentColor === "string" && /^[0-9a-fA-F]{6}$/.test(cfg.theme.accentColor)
    ? cfg.theme.accentColor
    : DEFAULT_REPORT_EXPORT_CONFIG.theme.accentColor
  const logo = typeof cfg.cover?.logoDataUrl === "string" && cfg.cover.logoDataUrl.startsWith("data:")
    ? cfg.cover.logoDataUrl
    : undefined

  return {
    sections: normalizeOrderedToggles(cfg.sections, SECTION_ORDER, isSectionId),
    kpiItems: normalizeOrderedToggles(cfg.kpiItems, KPI_ORDER, isKpiId),
    cover: {
      title: typeof cfg.cover?.title === "string" ? cfg.cover.title : DEFAULT_REPORT_EXPORT_CONFIG.cover.title,
      companyName: typeof cfg.cover?.companyName === "string" ? cfg.cover.companyName : "",
      logoDataUrl: logo,
    },
    theme: { accentColor: accent },
    page: { size, orientation },
    updatedAt: typeof cfg.updatedAt === "string" ? cfg.updatedAt : undefined,
  }
}
