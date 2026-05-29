import type { CalcDepreciationConfig } from "@/lib/types"

// 投資コスト内訳と耐用年数から月次減価償却額を算出。
// 元スプレッドシート 入力欄 E5:E16 = (取得額 / 耐用年数 / 12) の合計（E17）。
// usefulLifeYears に掲載の無い投資項目は非償却（WS・FC加盟費・システム・開業準備・パッケージ・ALSOK/USEN 等）。
export function computeMonthlyDepreciation(
  investmentBreakdown: Record<string, number> | undefined,
  params: CalcDepreciationConfig,
): number {
  if (!investmentBreakdown) return 0
  let monthly = 0
  for (const [fieldId, years] of Object.entries(params.usefulLifeYears)) {
    const amount = Number(investmentBreakdown[fieldId])
    if (Number.isFinite(amount) && amount > 0 && years > 0) {
      monthly += amount / years / 12
    }
  }
  return monthly
}
