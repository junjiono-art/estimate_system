import { MONTHLY_MEMBER_FEE_EX_TAX } from "@/lib/calc-constants"
import type { FormulaSetRecordLike, FormulaToken } from "@/lib/formula-types"
import type { CalcParameterConfig, SimulationRequestInput } from "@/lib/types"

export type FormulaContext = Record<string, number>

type BuildContextArgs = {
  input?: Partial<SimulationRequestInput>
  calcParams: CalcParameterConfig
  derived?: Partial<Record<string, number>>
  /** 初期値層の計算済み値（新規） */
  initialPhase?: {
    initialJoiners?: number
    demandMultiplier?: number
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

/**
 * 初期値計算層のコンテキストを構築
 * （initialJoiners, demandMultiplier等の入力値を整理）
 *
 * @param input シミュレーション入力値
 * @param calcParams 計算パラメータ
 */
export function buildInitialPhaseContext(
  input?: Partial<SimulationRequestInput>,
  calcParams?: CalcParameterConfig,
): FormulaContext {
  if (!input) return {}

  const { km1Ring = 0, km3Ring = 0, km5Ring = 0 } = input.populationByRadius ?? {}

  return {
    floorAreaTsubo: toNumber(input.floorAreaTsubo, 0),
    competitorCount: toNumber(input.competitorCount, 0),
    // locationType: 0=suburban, 1=urban, 2=rural
    locationType: input.locationType === "urban" ? 1 : input.locationType === "rural" ? 2 : 0,
    populationKm1Ring: km1Ring,
    populationKm3Ring: km3Ring,
    populationKm5Ring: km5Ring,
    rentPerTsubo: toNumber(input.rentPerTsubo, 0),
    runningCostTotal: toNumber(input.runningCostTotal, 0),
  }
}

export function buildFormulaContext({
  input,
  calcParams,
  derived,
  initialPhase,
}: BuildContextArgs): FormulaContext {
  // Context keys are intentionally stable across UI, preview, and simulation runtime.
  const rentPerTsubo = toNumber(input?.rentPerTsubo, 0)
  const runningCostTotal = toNumber(input?.runningCostTotal, 0)
  const royaltyRate = toNumber(input?.royaltyRate, 0)
  const franchiseRate = toNumber(input?.franchiseRate ?? input?.royaltyRate, 0)

  // 人口リング取得（geospatial層）
  const { km1Ring = 0, km3Ring = 0, km5Ring = 0 } = input?.populationByRadius ?? {}

  return {
    // ───── Input層 ─────
    floorAreaTsubo: toNumber(input?.floorAreaTsubo, 0),
    rentPerTsubo,
    competitorCount: toNumber(input?.competitorCount, 0),
    royaltyRate,
    franchiseRate,
    runningCostTotal,
    initialInvestmentTotal: toNumber(input?.initialInvestmentTotal, 0),

    // ───── Geospatial層（新規） ─────
    populationKm1Ring: km1Ring,
    populationKm3Ring: km3Ring,
    populationKm5Ring: km5Ring,
    locationType: input?.locationType === "urban" ? 1 : input?.locationType === "rural" ? 2 : 0,

    // ───── Param層 ─────
    paymentFeeRate: toNumber(calcParams.paymentFeeRate, 0),
    royaltyCapMonthly: toNumber(calcParams.royaltyCapMonthly, 0),
    appFeeMonthly: toNumber(calcParams.appFeeMonthly, 0),

    // ───── Constant層 ─────
    monthlyMemberFeeExTax: toNumber(MONTHLY_MEMBER_FEE_EX_TAX, 0),

    // ───── Derived層（月別） ─────
    month: toNumber(derived?.month, 1),
    members: toNumber(derived?.members, 0),
    monthlyRevenue: toNumber(derived?.monthlyRevenue, 0),
    monthlyRent: toNumber(derived?.monthlyRent, rentPerTsubo),
    monthlyRunningCost: toNumber(derived?.monthlyRunningCost, runningCostTotal),
    adCostMonthly: toNumber(derived?.adCostMonthly, 0),
    paymentFee: toNumber(derived?.paymentFee, 0),
    monthlyRoyalty: toNumber(derived?.monthlyRoyalty, 0),

    // ───── Derived層（初期値層・新規） ─────
    initialJoiners: toNumber(initialPhase?.initialJoiners, 0),
    demandMultiplier: toNumber(initialPhase?.demandMultiplier, 1),
  }
}

function readVar(token: FormulaToken, context: FormulaContext): number {
  const key = token.varKey || token.namedConstKey
  if (!key) throw new Error("変数キーが未指定です。")
  const value = context[key]
  if (value === undefined) {
    throw new Error(`変数 \"${key}\" が context に存在しません。`)
  }
  return value
}

function readConst(token: FormulaToken): number {
  const value = toNumber(token.value, NaN)
  if (!Number.isFinite(value)) throw new Error("数値定数が不正です。")
  return value
}

function tokenIsOpenParen(token: FormulaToken | undefined): boolean {
  return token?.type === "paren" && token.paren === "("
}

function tokenIsCloseParen(token: FormulaToken | undefined): boolean {
  return token?.type === "paren" && token.paren === ")"
}

function tokenOperator(token: FormulaToken): string | null {
  if (token.type === "op") {
    if (token.op) return token.op
    if (typeof token.value === "string") return token.value
  }
  return null
}

function precedence(operator: string): number {
  if (operator === "*" || operator === "/") return 2
  if (operator === "+" || operator === "-") return 1
  return -1
}

class Parser {
  private index = 0

  constructor(private readonly tokens: FormulaToken[], private readonly context: FormulaContext) {}

  parse(): number {
    // Pratt-style parse entry: precedence-aware expression parse with strict token exhaustion.
    const value = this.parseExpression(0)
    if (this.index !== this.tokens.length) {
      throw new Error("式の末尾に未処理トークンがあります。")
    }
    if (!Number.isFinite(value)) {
      throw new Error("計算結果が不正です。")
    }
    return value
  }

  private parseExpression(minPrec: number): number {
    let left = this.parsePrimary()

    while (true) {
      const token = this.peek()
      if (!token) break
      const op = tokenOperator(token)
      if (!op) break

      const prec = precedence(op)
      if (prec < minPrec) break

      this.consume()
      const right = this.parseExpression(prec + 1)
      left = this.applyOperator(op, left, right)
    }

    return left
  }

  private parsePrimary(): number {
    const token = this.consume()
    if (!token) throw new Error("式が空です。")

    if (token.type === "const") {
      return readConst(token)
    }

    if (token.type === "var" || token.type === "namedConst") {
      return readVar(token, this.context)
    }

    if (tokenIsOpenParen(token)) {
      const value = this.parseExpression(0)
      const close = this.consume()
      if (!tokenIsCloseParen(close)) {
        throw new Error("閉じ括弧 ')' が不足しています。")
      }
      return value
    }

    if (token.type === "fn") {
      const fn = String(token.fnName || "")
      const open = this.consume()
      if (!tokenIsOpenParen(open)) {
        throw new Error(`関数 ${fn} の後に '(' が必要です。`)
      }
      const argument = this.parseExpression(0)
      const close = this.consume()
      if (!tokenIsCloseParen(close)) {
        throw new Error(`関数 ${fn} の閉じ括弧 ')' が不足しています。`)
      }

      if (fn === "round") return Math.round(argument)
      if (fn === "ceil") return Math.ceil(argument)
      if (fn === "floor") return Math.floor(argument)
      throw new Error(`未対応の関数です: ${fn}`)
    }

    throw new Error(`未対応トークンです: ${token.type}`)
  }

  private applyOperator(op: string, left: number, right: number): number {
    if (op === "+") return left + right
    if (op === "-") return left - right
    if (op === "*") return left * right
    if (op === "/") {
      if (right === 0) throw new Error("0除算はできません。")
      return left / right
    }
    throw new Error(`未対応演算子です: ${op}`)
  }

  private peek(): FormulaToken | undefined {
    return this.tokens[this.index]
  }

  private consume(): FormulaToken | undefined {
    const token = this.tokens[this.index]
    this.index += 1
    return token
  }
}

export function evaluateFormulaTokens(tokens: FormulaToken[], context: FormulaContext): number {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("トークンが空です。")
  }
  // Runtime evaluator is shared by preview and simulation to guarantee consistent results.
  return new Parser(tokens, context).parse()
}

export function evaluateFormulaByKey(
  setRecord: FormulaSetRecordLike | null | undefined,
  formulaKey: string,
  context: FormulaContext,
): number | null {
  if (!setRecord?.formulas) return null
  const formula = setRecord.formulas[formulaKey]
  if (!formula?.tokens?.length) return null
  return evaluateFormulaTokens(formula.tokens, context)
}
