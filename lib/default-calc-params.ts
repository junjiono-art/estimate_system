import type { CalcParameterConfig } from "@/lib/types"

// Lambda/DynamoDB から計算パラメータを取得できない場合のフォールバック値
// ロジック可視化画面のデモ値と同じ値を採用
export const DEFAULT_CALC_PARAMS: CalcParameterConfig = {
  paymentFeeRate: 0.035,
  royaltyCapMonthly: 300_000,
  appFeeMonthly: 10_000,
  competitorImpact: {
    upTo2: 0.1,
    for3: 0.15,
    for4: 0.2,
    over4: 0.25,
  },
  adCost: {
    year1Month1: 600_000,
    year1Month2: 400_000,
    year1Month3To4: 300_000,
    year1Month5To12: 180_000,
    year2Monthly: 120_000,
    year3PlusMonthly: 80_000,
  },
}
