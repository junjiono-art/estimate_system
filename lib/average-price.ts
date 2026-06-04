import type { CalcPricingConfig } from "@/lib/types"
import { APP_FEE_PER_MEMBER_WITH_ROYALTY, SUPPLEMENT_COST_RATE } from "@/lib/calc-constants"

// 平均単価 = Σ(オプション単価 × 加入構成比) + 会費
// 元スプレッドシート 入力欄!C81 = SUMPRODUCT(C85:C90, E85:E90) + C72 / 事業計画!C4
export function computeAveragePrice(pricing: CalcPricingConfig): number {
  const optionRevenue = pricing.options.reduce((acc, opt) => acc + opt.price * opt.ratio, 0)
  return optionRevenue + pricing.memberFeeExTax
}

/**
 * 1人あたり変動費（事業計画!L5 = SUM(L6:L10)）。
 * L6 アプリ利用料（ロイヤリティ有り時 50円/人）
 * L7 平均単価 × ロイヤリティ率
 * L8 平均単価 × 決済手数料率
 * L10 サプリ単価 × 原価率(0.7) × 加入構成比
 * @param averagePrice 平均単価（事業計画!C4）
 * @param royaltyRate  ロイヤリティ率（0〜1。例: 10% = 0.1）
 * @param paymentFeeRate 決済手数料率（入力欄!C75）
 * @param pricing 料金設定（サプリ原価の算出にオプション構成を使用）
 */
export function computeVariableCostPerMember(
  averagePrice: number,
  royaltyRate: number,
  paymentFeeRate: number,
  pricing: CalcPricingConfig,
): number {
  const appFee = royaltyRate > 0 ? APP_FEE_PER_MEMBER_WITH_ROYALTY : 0          // L6
  const royaltyCost = royaltyRate > 0 ? averagePrice * royaltyRate : 0          // L7
  const paymentFee = averagePrice * paymentFeeRate                              // L8
  const supplement = pricing.options                                           // L10
    .filter((opt) => opt.label.includes("サプリ"))
    .reduce((acc, opt) => acc + opt.price * SUPPLEMENT_COST_RATE * opt.ratio, 0)
  return appFee + royaltyCost + paymentFee + supplement
}
