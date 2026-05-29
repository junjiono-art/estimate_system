import type { CalcPricingConfig } from "@/lib/types"

// 平均単価 = Σ(オプション単価 × 加入構成比) + 会費
// 元スプレッドシート 入力欄!C81 = SUMPRODUCT(C85:C90, E85:E90) + C72 / 事業計画!C4
export function computeAveragePrice(pricing: CalcPricingConfig): number {
  const optionRevenue = pricing.options.reduce((acc, opt) => acc + opt.price * opt.ratio, 0)
  return optionRevenue + pricing.memberFeeExTax
}
