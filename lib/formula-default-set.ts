import type { FormulaDefinition, FormulaToken } from "@/lib/formula-types"

/**
 * 既定の式セット定義（Excel「事業計画」「入力欄」シートの忠実移植）。
 *
 * ロジック可視化で編集・可視化する式のソース・オブ・トゥルース。
 * calc-engine のコード側フォールバックと**完全一致**する（scripts/verify-formula-set.mts で検証）。
 *
 * 注意:
 * - 式DSLは `+ - * /`・比較演算子・`round/ceil/floor/min/max/if` のみ。単項マイナスは無いため `0 - x` で表現する。
 * - `demandMultiplier` は計算で未使用かつ基準定数依存のため、本セットには含めない（合意済み）。
 * - 広告費・競合影響率はパラメータ連動を維持するため変数参照（定数埋め込みしない）。
 */

// ── トークン合成ヘルパー ──
const v = (varKey: string): FormulaToken => ({ type: "var", varKey })
const c = (value: number): FormulaToken => ({ type: "const", value })
const o = (op: string): FormulaToken => ({ type: "op", op })
const LP: FormulaToken = { type: "paren", paren: "(" }
const RP: FormulaToken = { type: "paren", paren: ")" }
const COMMA: FormulaToken = { type: "op", op: "," }

/** 括弧でくくる */
const group = (...t: FormulaToken[]): FormulaToken[] => [LP, ...t, RP]

/** 関数呼び出し fn(arg1, arg2, ...) */
const call = (fnName: string, ...args: FormulaToken[][]): FormulaToken[] => {
  const inner: FormulaToken[] = []
  args.forEach((a, i) => {
    if (i > 0) inner.push(COMMA)
    inner.push(...a)
  })
  return [{ type: "fn", fnName }, LP, ...inner, RP]
}

// ── 決済手数料 = round(売上 × 手数料率) ──
const paymentFeeTokens: FormulaToken[] = call("round", [v("monthlyRevenue"), o("*"), v("paymentFeeRate")])

// ── 月次ロイヤリティ = min(round(売上 × FC率 ÷ 100), 上限) ──
const monthlyRoyaltyTokens: FormulaToken[] = call(
  "min",
  call("round", [v("monthlyRevenue"), o("*"), v("franchiseRate"), o("/"), c(100)]),
  [v("royaltyCapMonthly")],
)

// ── アプリ利用料 = if(ロイヤリティ > 0, アプリ料, 0) ──
const appFeeTokens: FormulaToken[] = call(
  "if",
  [v("monthlyRoyalty"), o(">"), c(0)],
  [v("appFeeMonthly")],
  [c(0)],
)

// ── 月次広告費 = 月インデックスのスケジュール（事業計画 R42）──
const adCostMonthlyTokens: FormulaToken[] = call(
  "if", [v("month"), o("<="), c(1)], [v("adCostYear1Month1")],
  call("if", [v("month"), o("<="), c(2)], [v("adCostYear1Month2")],
    call("if", [v("month"), o("<="), c(4)], [v("adCostYear1Month3To4")],
      call("if", [v("month"), o("<="), c(12)], [v("adCostYear1Month5To12")],
        call("if", [v("month"), o("<="), c(24)], [v("adCostYear2Monthly")],
          [v("adCostYear3PlusMonthly")])))),
)

// ── 月次総コスト = 家賃 + ランニング + 広告 + 決済手数料 + ロイヤリティ + アプリ料 ──
const monthlyCostTokens: FormulaToken[] = [
  v("monthlyRent"), o("+"),
  v("monthlyRunningCost"), o("+"),
  v("adCostMonthly"), o("+"),
  v("paymentFee"), o("+"),
  v("monthlyRoyalty"), o("+"),
  v("appFee"),
]

// ── 初月入会人数（入力欄 G38）──
// e38 = -(16 + min(72, floor(lookupPop / 5000))) / 100   ※単項マイナス無 → (0 - x)/100
const onePlusE38 = (lookupPop: FormulaToken[]): FormulaToken[] =>
  group(
    c(1), o("+"),
    ...group(
      ...group(
        c(0), o("-"),
        ...group(
          c(16), o("+"),
          // lookupPop を括弧で包んでから 5000 で割る（(km1+km3)/5000）
          ...call("min", [c(72)], call("floor", group(...group(...lookupPop), o("/"), c(5000)))),
        ),
      ),
      o("/"), c(100),
    ),
  )

const km1 = v("populationKm1Ring")
const km3 = v("populationKm3Ring")
const km5 = v("populationKm5Ring")

// 都市型: e60 × (1+e38[km1]) 、e60 = km1 × 0.012
const urbanBranch: FormulaToken[] = [
  km1, o("*"), c(0.012), o("*"), ...onePlusE38([km1]),
]
// 郊外型: e60 + f60 × (1+e38[km1+km3]) 、f60 = km3 × 0.008
const suburbanBranch: FormulaToken[] = [
  km1, o("*"), c(0.012), o("+"),
  km3, o("*"), c(0.008), o("*"), ...onePlusE38([km1, o("+"), km3]),
]
// 田舎型: e60 + f60 + g60 × (1+e38[km1+km3+km5]) 、g60 = km5 × 0.001
const ruralBranch: FormulaToken[] = [
  km1, o("*"), c(0.012), o("+"),
  km3, o("*"), c(0.008), o("+"),
  km5, o("*"), c(0.001), o("*"), ...onePlusE38([km1, o("+"), km3, o("+"), km5]),
]

// 競合影響率: competitorCount のティア（入力欄 E78 相当、パラメータ連動）
const competitorImpact: FormulaToken[] = call(
  "if", [v("competitorCount"), o("<="), c(0)], [c(0)],
  call("if", [v("competitorCount"), o("<="), c(2)], [v("competitorImpactUpTo2")],
    call("if", [v("competitorCount"), o("=="), c(3)], [v("competitorImpactFor3")],
      call("if", [v("competitorCount"), o("=="), c(4)], [v("competitorImpactFor4")],
        [v("competitorImpactOver4")]))),
)

// 立地分岐: locationType 1=都市 2=田舎 0=郊外
const locationBranch: FormulaToken[] = call(
  "if", [v("locationType"), o("=="), c(1)], urbanBranch,
  call("if", [v("locationType"), o("=="), c(2)], ruralBranch, suburbanBranch),
)

// initialJoiners = max(0, 分岐 × (1 − 競合影響))
const initialJoinersTokens: FormulaToken[] = call(
  "max",
  [c(0)],
  [...group(...locationBranch), o("*"), ...group(c(1), o("-"), ...competitorImpact)],
)

/**
 * 既定式セットの式定義（key → FormulaDefinition）。
 * 登録スクリプト・等価検証・シードで共有する。
 */
export const DEFAULT_FORMULA_DEFINITIONS: Record<string, FormulaDefinition> = {
  initialJoiners: {
    key: "initialJoiners",
    label: "初月入会人数",
    tokens: initialJoinersTokens,
    outputType: "number",
    // 未丸めで会員成長モデルへ渡すため丸めない
    roundResult: false,
    description: "入力欄 G38 の移植（立地分岐 × 競合影響、人口係数は線形近似）",
  },
  paymentFee: {
    key: "paymentFee",
    label: "決済手数料",
    tokens: paymentFeeTokens,
    outputType: "currency",
    description: "売上 × 決済手数料率",
  },
  monthlyRoyalty: {
    key: "monthlyRoyalty",
    label: "月次ロイヤリティ",
    tokens: monthlyRoyaltyTokens,
    outputType: "currency",
    description: "min(売上 × FC率, 上限)",
  },
  appFee: {
    key: "appFee",
    label: "アプリ利用料",
    tokens: appFeeTokens,
    outputType: "currency",
    description: "ロイヤリティ発生時のみ定額",
  },
  adCostMonthly: {
    key: "adCostMonthly",
    label: "月次広告費",
    tokens: adCostMonthlyTokens,
    outputType: "currency",
    description: "事業計画 R42 の月次スケジュール",
  },
  monthlyCost: {
    key: "monthlyCost",
    label: "月次総コスト",
    tokens: monthlyCostTokens,
    outputType: "currency",
    description: "家賃+ランニング+広告+決済+ロイヤリティ+アプリ料",
  },
}

/** 登録・検証で使う式セットレコード形（setVersion はダミー） */
export const DEFAULT_FORMULA_SET = {
  setVersion: "default",
  formulas: DEFAULT_FORMULA_DEFINITIONS,
}
