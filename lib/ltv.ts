import {
  MONTHLY_MEMBER_FEE_EX_TAX,
  FIRST_MONTH_RETENTION_RATE,
  SUBSEQUENT_RETENTION_RATE,
  IDEAL_ACQUISITION_COST_LTV_RATIO,
} from "@/lib/calc-constants"
import type { LtvResult } from "@/lib/types"

// 元スプレッドシート「LTV計算」シートの移植。
// 会費と継続率2種（初月継続率・2か月目以降継続率）から、
// 1年間LTV・半年/1年の継続率と離脱率・獲得単価目安を算出する。
// セル対応はコメントに併記（C列=期待会費, D列=継続率, E/F/I列=各指標）。

export interface LtvCalculationInput {
  /** 会費 (入力欄!C72)。既定は MONTHLY_MEMBER_FEE_EX_TAX */
  monthlyFee?: number
  /** 初月継続率 (入力欄!C68): 月1→月2の継続率。既定 1.0 */
  firstMonthRetention?: number
  /** 2か月目以降継続率 (入力欄!C69): 月3以降の継続率。既定 0.94 */
  subsequentRetention?: number
}

// 期待会費はC3:C26（24ヶ月分）まで算出される
const TOTAL_MONTHS = 24

export function calculateLtv(input: LtvCalculationInput = {}): LtvResult {
  const monthlyFee = input.monthlyFee ?? MONTHLY_MEMBER_FEE_EX_TAX
  const firstMonthRetention = input.firstMonthRetention ?? FIRST_MONTH_RETENTION_RATE
  const subsequentRetention = input.subsequentRetention ?? SUBSEQUENT_RETENTION_RATE

  // retention(m): 月(m-1)→月mの継続率。月1は基準月のため1（D3は空セル）。
  // 月2(D4)=初月継続率、月3以降(D5〜)=2か月目以降継続率。
  const retention = (month: number): number => {
    if (month <= 1) return 1
    if (month === 2) return firstMonthRetention
    return subsequentRetention
  }

  // C3:C26 期待会費。C(m) = C(m-1) × retention(m)
  const fees: number[] = []
  for (let m = 1; m <= TOTAL_MONTHS; m += 1) {
    fees[m - 1] = m === 1 ? monthlyFee : fees[m - 2] * retention(m)
  }

  // 月fromMonth〜toMonth（両端含む）の期待会費合計
  const sumFees = (fromMonth: number, toMonth: number): number =>
    fees.slice(fromMonth - 1, toMonth).reduce((acc, v) => acc + v, 0)

  // PRODUCT(D{..}) 相当。月fromMonth〜toMonthの継続率の積（空セルは1扱い）
  const productRetention = (fromMonth: number, toMonth: number): number => {
    let product = 1
    for (let m = fromMonth; m <= toMonth; m += 1) product *= retention(m)
    return product
  }

  const ltv1Year = sumFees(1, 12) // E3 = SUM(C3:C14)
  const halfYearRetentionRate = productRetention(2, 6) // E8 = PRODUCT(D3:D8)（D3空）
  const oneYearRetentionRate = productRetention(2, 12) // E14 = PRODUCT(D4:D14)

  return {
    monthlyExpectedFees: fees,
    ltv1Year,
    halfYearRetentionRate,
    halfYearChurnRate: 1 - halfYearRetentionRate, // F8 = 1 - E8
    oneYearRetentionRate,
    oneYearChurnRate: 1 - oneYearRetentionRate, // F14 = 1 - E14
    acquisitionCostCapHalfYear: sumFees(1, 6), // I8 = SUM(C3:C8)
    idealAcquisitionCost: ltv1Year * IDEAL_ACQUISITION_COST_LTV_RATIO, // I10 = E3 × 30%
  }
}
