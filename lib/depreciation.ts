import type { CalcDepreciationConfig } from "@/lib/types"

// 投資コスト内訳と耐用年数から月次減価償却額を算出。
// 元スプレッドシート 入力欄 E5:E16 = (取得額 / 耐用年数 / 12) の合計（E17）。
// 耐用年数の掲載が無い投資項目は非償却（WS・FC加盟費・システム・開業準備・パッケージ・ALSOK/USEN 等）。
//
// yearsByField（マスタ登録の償却年）が渡された場合は、デフォルトの耐用年数に
// 項目単位で上書きマージする（既定 ∪ マスタ上書き）。これによりユーザーがマスタ管理で
// 投資コストごとに償却年を更新でき、未設定の項目は従来どおりデフォルト値で償却される。
export function computeMonthlyDepreciation(
  investmentBreakdown: Record<string, number> | undefined,
  params: CalcDepreciationConfig,
  yearsByField?: Record<string, number>,
): number {
  if (!investmentBreakdown) return 0
  const yearsSource = { ...params.usefulLifeYears, ...(yearsByField ?? {}) }
  let monthly = 0
  for (const [fieldId, years] of Object.entries(yearsSource)) {
    const amount = Number(investmentBreakdown[fieldId])
    if (Number.isFinite(amount) && amount > 0 && Number(years) > 0) {
      monthly += amount / Number(years) / 12
    }
  }
  return monthly
}
