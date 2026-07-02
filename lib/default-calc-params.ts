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
    // ベースライン（=アグレッシブ）: 年2=18万、年3以降=12万
    year1Month1: 520_000,
    year1Month2: 280_000,
    year1Month3To4: 240_000,
    year1Month5To12: 180_000,
    year2Monthly: 180_000,
    year3PlusMonthly: 120_000,
    // Excel事業計画 R42 の手入力スポット増減（計算根拠なし）をシナリオ・年別に忠実再現。
    // 標準: 10期を18万へ。保守: 2期を12万へ／3期・9期を18万へ。アグレッシブはベースラインと一致（上書き不要）。
    scenarioMonthlyOverride: {
      standard: { 10: 180_000 },
      conservative: { 2: 120_000, 3: 180_000, 9: 180_000 },
    },
  },
  adCostWeb: {
    // 事業計画 R43（Web広告費）。SNS広告費（R44）は adCost との差分で算出する
    year1Month1: 80_000,
    year1Month2: 80_000,
    monthly: 120_000,
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
  machineMaintenance: {
    // 入力欄 B34: C34=IF(C73=0,0,K23*N19*P19) / 「2〜3ヶ月に1回実施」を月割り
    applyOnlyWhenFranchise: true, // C73(ロイヤリティ)=0 の直営は計上しない
    intervalMonths: 3, // 「2〜3ヶ月に1回」の中間値。月額=1回費用÷3
    // ── 距離連動の単価モデル（入力欄 K25:Q72。Q=P/2, P=$L$47+O, O=N×20000, N=ROUNDDOWN(L,-2)/100）──
    baseUnitPrice: 110_000, // 入力欄 $L$47（距離0=拠点 愛知 の基本料）
    distanceStepKm: 100, // 入力欄 M=ROUNDDOWN(L,-2) の -2（100km単位に切り捨て）
    distanceStepCost: 20_000, // 入力欄 O=N×20000（100kmごとの距離加算）
    unitPriceDivisor: 2, // 入力欄 Q=P/2
    fallbackUnitPrice: 65_000, // 都道府県不明時（入力欄 Q列の標準値帯）
    // 坪数帯→作業人数・日数（入力欄 N19/P19 の IF カスケード）
    tsuboTiers: [
      { minTsubo: 0, workers: 2, days: 1 },
      { minTsubo: 110, workers: 2, days: 1 },
      { minTsubo: 160, workers: 3, days: 1 },
      { minTsubo: 200, workers: 2, days: 2 },
    ],
    // 拠点(愛知)からの距離km（入力欄 L列）。愛知は基準額アンカーのため距離0扱い。
    distanceByPrefecture: {
      北海道: 955.4, 青森: 711, 岩手: 626.9, 宮城: 492.8, 秋田: 577.5,
      山形: 459, 福島: 427.9, 茨城: 345.1, 栃木: 309.7, 群馬: 236.6,
      埼玉: 259.8, 千葉: 296, 東京: 259.1, 神奈川: 250.5, 新潟: 356.6,
      富山: 170.3, 石川: 159, 福井: 116.1, 山梨: 160.2, 長野: 199.7,
      岐阜: 28.8, 静岡: 136.5, 愛知: 0, 三重: 61.8, 滋賀: 96.7,
      京都: 106.4, 大阪: 138, 兵庫: 166.5, 奈良: 112.4, 和歌山: 191.3,
      鳥取: 245.2, 島根: 352.1, 岡山: 277.6, 広島: 416.2, 山口: 510.1,
      徳島: 248.2, 香川: 278.2, 愛媛: 408.1, 高知: 358.7, 福岡: 621.5,
      佐賀: 645.3, 長崎: 704, 熊本: 628.2, 大分: 533.2, 宮崎: 624.9,
      鹿児島: 714.1, 沖縄: 1328.9,
    },
    // Q列が式ではなく手入力固定値で上書きされている県のみ（距離計算値ではなくこの値を採用）。
    // ここに無い県は distanceByPrefecture から距離連動で算出する。
    unitPriceByPrefecture: {
      北海道: 70_000, 茨城: 75_000, 栃木: 75_000, 群馬: 65_000, 埼玉: 65_000,
      千葉: 65_000, 東京: 65_000, 神奈川: 65_000, 滋賀: 60_000, 京都: 70_000,
      大阪: 70_000, 兵庫: 70_000, 奈良: 70_000, 和歌山: 70_000, 福岡: 65_000,
      佐賀: 70_000, 長崎: 70_000, 熊本: 80_000, 大分: 70_000, 宮崎: 90_000,
      鹿児島: 90_000, 沖縄: 90_000,
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
