export type FormulaVarSource = "input" | "param" | "constant" | "derived"

export type FormulaVarDef = {
  key: string
  label: string
  source: FormulaVarSource
}

export const FORMULA_VAR_REGISTRY: FormulaVarDef[] = [
  { key: "floorAreaTsubo", label: "坪数", source: "input" },
  { key: "rentPerTsubo", label: "月額家賃", source: "input" },
  { key: "competitorCount", label: "競合数", source: "input" },
  { key: "royaltyRate", label: "ロイヤリティ率", source: "input" },
  { key: "franchiseRate", label: "フランチャイズ率", source: "input" },
  { key: "runningCostTotal", label: "ランニング費合計", source: "input" },
  { key: "initialInvestmentTotal", label: "初期投資合計", source: "input" },

  { key: "paymentFeeRate", label: "決済手数料率", source: "param" },
  { key: "royaltyCapMonthly", label: "ロイヤリティ上限(月)", source: "param" },
  { key: "appFeeMonthly", label: "アプリ利用料(月)", source: "param" },

  { key: "monthlyMemberFeeExTax", label: "月会費(税抜)定数", source: "constant" },

  { key: "month", label: "対象月", source: "derived" },
  { key: "members", label: "会員数", source: "derived" },
  { key: "monthlyRevenue", label: "月次売上", source: "derived" },
  { key: "monthlyRent", label: "月額家賃", source: "derived" },
  { key: "monthlyRunningCost", label: "月次ランニング費", source: "derived" },
  { key: "adCostMonthly", label: "月次広告費", source: "derived" },
  { key: "paymentFee", label: "決済手数料", source: "derived" },
  { key: "monthlyRoyalty", label: "月次ロイヤリティ", source: "derived" },
] as const

export const FORMULA_FUNCTIONS = [
  { name: "round", label: "round()" },
  { name: "ceil", label: "ceil()" },
  { name: "floor", label: "floor()" },
] as const
