export type FormulaVarSource = "input" | "param" | "constant" | "derived" | "geospatial"

export type FormulaVarDef = {
  key: string
  label: string
  source: FormulaVarSource
  description?: string  // 説明文
  unit?: string         // 単位
}

export const FORMULA_VAR_REGISTRY: FormulaVarDef[] = [
  // ──────────────────────────────
  // Input層
  // ──────────────────────────────
  { key: "floorAreaTsubo", label: "坪数", source: "input", unit: "坪" },
  { key: "rentPerTsubo", label: "月額家賃/坪", source: "input", unit: "円/坪" },
  { key: "competitorCount", label: "競合店舗数", source: "input", unit: "店" },
  { key: "royaltyRate", label: "ロイヤリティ率", source: "input", unit: "%" },
  { key: "franchiseRate", label: "フランチャイズ率", source: "input", unit: "%" },
  { key: "runningCostTotal", label: "ランニング費用合計", source: "input", unit: "円" },
  { key: "initialInvestmentTotal", label: "初期投資合計", source: "input", unit: "円" },

  // ──────────────────────────────
  // Geospatial層（新規）
  // ──────────────────────────────
  { key: "populationKm1Ring", label: "1km圏人口", source: "geospatial", unit: "人" },
  { key: "populationKm3Ring", label: "3km圏人口", source: "geospatial", unit: "人" },
  { key: "populationKm5Ring", label: "5km圏人口", source: "geospatial", unit: "人" },
  { key: "locationType", label: "立地タイプ", source: "input", description: "urban|suburban|rural" },

  // ──────────────────────────────
  // Param層
  // ──────────────────────────────
  { key: "paymentFeeRate", label: "決済手数料率", source: "param", unit: "%" },
  { key: "royaltyCapMonthly", label: "ロイヤリティ上限(月)", source: "param", unit: "円" },
  { key: "appFeeMonthly", label: "アプリ利用料(月)", source: "param", unit: "円" },

  // 広告費スケジュール（事業計画 R42）。adCostMonthly 式から参照（パラメータ連動維持）
  { key: "adCostYear1Month1", label: "広告費 1年目1月", source: "param", unit: "円" },
  { key: "adCostYear1Month2", label: "広告費 1年目2月", source: "param", unit: "円" },
  { key: "adCostYear1Month3To4", label: "広告費 1年目3-4月", source: "param", unit: "円" },
  { key: "adCostYear1Month5To12", label: "広告費 1年目5-12月", source: "param", unit: "円" },
  { key: "adCostYear2Monthly", label: "広告費 2年目(月)", source: "param", unit: "円" },
  { key: "adCostYear3PlusMonthly", label: "広告費 3年目以降(月)", source: "param", unit: "円" },

  // 競合影響率（入力欄 E78 / calcParams.competitorImpact）。initialJoiners 式から参照
  { key: "competitorImpactUpTo2", label: "競合影響率(2件以下)", source: "param", unit: "%" },
  { key: "competitorImpactFor3", label: "競合影響率(3件)", source: "param", unit: "%" },
  { key: "competitorImpactFor4", label: "競合影響率(4件)", source: "param", unit: "%" },
  { key: "competitorImpactOver4", label: "競合影響率(5件以上)", source: "param", unit: "%" },

  // ──────────────────────────────
  // Constant層
  // ──────────────────────────────
  { key: "monthlyMemberFeeExTax", label: "月会費(税抜)", source: "constant", unit: "円" },

  // ──────────────────────────────
  // Derived層（月別計算時）
  // ──────────────────────────────
  { key: "month", label: "対象月", source: "derived", unit: "月" },
  { key: "members", label: "月別会員数", source: "derived", unit: "人" },
  { key: "monthlyRevenue", label: "月次売上", source: "derived", unit: "円" },
  { key: "monthlyRent", label: "月額家賃", source: "derived", unit: "円" },
  { key: "monthlyRunningCost", label: "月次ランニング費", source: "derived", unit: "円" },
  { key: "adCostMonthly", label: "月次広告費", source: "derived", unit: "円" },
  { key: "paymentFee", label: "決済手数料", source: "derived", unit: "円" },
  { key: "monthlyRoyalty", label: "月次ロイヤリティ", source: "derived", unit: "円" },
  { key: "appFee", label: "アプリ利用料", source: "derived", unit: "円" },

  // ──────────────────────────────
  // Derived層（初期値層・新規）
  // ──────────────────────────────
  {
    key: "initialJoiners",
    label: "初月入会人数",
    source: "derived",
    unit: "人",
    description: "初月入会人数（式化対象）",
  },
  {
    key: "demandMultiplier",
    label: "需要乗数",
    source: "derived",
    unit: "倍",
    description: "基本値からの需要スケール係数",
  },
] as const

export const FORMULA_FUNCTIONS = [
  { name: "round", label: "round()" },
  { name: "ceil", label: "ceil()" },
  { name: "floor", label: "floor()" },
] as const
