import type { CalcParameterConfig } from "@/lib/types"

// Lambda/DynamoDB から計算パラメータを取得できない場合のフォールバック値
// ロジック可視化画面のデモ値と同じ値を採用。
// 拡張パラメータ（pricing 以降）は元Excel「入力欄」「事業計画」「キャパシティ計算」由来の既定値。
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
    // 事業計画 R42（Web広告費+SNS広告費の月次スケジュール）
    year1Month1: 520_000,
    year1Month2: 280_000,
    year1Month3To4: 240_000,
    year1Month5To12: 180_000,
    year2Monthly: 180_000,
    year3PlusMonthly: 120_000,
  },
  // ── Excel計算モデル移植で追加 ──
  pricing: {
    memberFeeExTax: 2_980, // 入力欄!C72
    // 入力欄!C85:E90（オプション料金表）
    options: [
      { label: "ウォーターサーバー", price: 500, ratio: 0.35 },
      { label: "契約ロッカー", price: 1_000, ratio: 0.05 },
      { label: "体組成計", price: 500, ratio: 0.28 },
      { label: "サプリ", price: 2_500, ratio: 0 },
      { label: "ゴルフ", price: 7_000, ratio: 0 },
      { label: "なし", price: 0, ratio: 0.32 },
    ],
  },
  retention: {
    firstMonth: 1.0, // 入力欄!C68
    subsequent: 0.94, // 入力欄!C69
  },
  acquisition: {
    organicSearchRate: 0.04, // 入力欄!C71
    referralRate: 0.03, // 入力欄!C70
    channelSplit: { signage: 0.7, web: 0.25, sns: 0.05 }, // 入力欄!D41/D42/D43
    semCpaY1Y2: 4_000, // 入力欄!C64
    semCpaY3Plus: 6_000, // 入力欄!C65
    snsAdUnitCost: 10_000, // 入力欄!C66
    webBudgetMonthly: 120_000, // 入力欄!C76
    snsBudgetMonthly: 60_000, // 入力欄!C77
    snsInitialBonus: 40, // 事業計画!D38(+40)
  },
  signage: {
    // 事業計画 R35（D35基準値と逓減）。base=初月見込×channelSplit.signage×baseFactor
    // adEffectiveness は年2以降のWeb/SNS獲得に掛かる係数（事業計画 D89/D299 等）。
    aggressive: { baseFactor: 1.0, roundDownBase: false, month2Factor: 0.5, month3Factor: 0.2, month4Factor: 0.1, monthlyDecay: 0.92, adEffectivenessYear2to5: 1.0, adEffectivenessYear6Plus: 1.0 },
    standard: { baseFactor: 0.7, roundDownBase: false, month2Factor: 0.25, month3Factor: 0.2, month4Factor: 0.1, monthlyDecay: 0.92, adEffectivenessYear2to5: 0.8, adEffectivenessYear6Plus: 0.7 },
    conservative: { baseFactor: 0.3, roundDownBase: true, month2Factor: 0.25, month3Factor: 0.2, month4Factor: 0.1, monthlyDecay: 0.92, adEffectivenessYear2to5: 0.6, adEffectivenessYear6Plus: 0.5 },
  },
  capacity: {
    visitsPerWeek: 2, // D9
    avgStayHours: 1, // D10
    areaPerMemberTsubo: 3.5, // D12
    businessHours: 24, // D14
    avgUtilization: 0.604166666666667, // D17(=H34)
    ruralFactor: 0.6, // D18 田舎型
    parkingUtilization: 0.8, // D22
  },
  depreciation: {
    // 入力欄 D5:D10（耐用年数）。掲載外の投資項目は非償却。
    usefulLifeYears: {
      interiorCost: 10,
      fitnessMachineCost: 6,
      flapperGateCost: 6,
      bodyCompositionCost: 6,
    },
  },
  corporateTaxRate: 0.232, // 入力欄!C92
  cashCollectionLagMonths: 1, // 入力欄!C79
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined || override === null ? base : override) as T
  }
  const result: Record<string, unknown> = { ...base }
  for (const key of Object.keys(base)) {
    if (key in override) {
      result[key] = deepMerge((base as Record<string, unknown>)[key], (override as Record<string, unknown>)[key])
    }
  }
  // base に無い拡張キー（id, updatedAt 等）は override 側を保持
  for (const key of Object.keys(override)) {
    if (!(key in result)) result[key] = (override as Record<string, unknown>)[key]
  }
  return result as T
}

/**
 * DynamoDB等から取得した計算パラメータを既定値で補完する。
 * 旧レコードに新フィールド（pricing/retention/acquisition等）が無くても
 * DEFAULT_CALC_PARAMS の値でフォールバックし、エンジンが常に完全な設定を受け取れるようにする。
 */
export function normalizeCalcParams(stored: Partial<CalcParameterConfig> | null | undefined): CalcParameterConfig {
  if (!stored) return DEFAULT_CALC_PARAMS
  return deepMerge(DEFAULT_CALC_PARAMS, stored)
}
