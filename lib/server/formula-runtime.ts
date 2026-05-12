import { MONTHLY_MEMBER_FEE_EX_TAX } from "@/lib/calc-constants"
import type { FormulaSetRecordLike, FormulaToken } from "@/lib/formula-types"
import type { CalcParameterConfig, SimulationRequestInput } from "@/lib/types"

export type FormulaContext = Record<string, number>

type BuildContextArgs = {
  input?: Partial<SimulationRequestInput>
  calcParams: CalcParameterConfig
  derived?: Partial<Record<string, number>>
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function buildFormulaContext({ input, calcParams, derived }: BuildContextArgs): FormulaContext {
  const rentPerTsubo = toNumber(input?.rentPerTsubo, 0)
  const runningCostTotal = toNumber(input?.runningCostTotal, 0)
  const royaltyRate = toNumber(input?.royaltyRate, 0)
  const franchiseRate = toNumber(input?.franchiseRate ?? input?.royaltyRate, 0)

  return {
    floorAreaTsubo: toNumber(input?.floorAreaTsubo, 0),
    rentPerTsubo,
    competitorCount: toNumber(input?.competitorCount, 0),
    royaltyRate,
    franchiseRate,
    runningCostTotal,
    initialInvestmentTotal: toNumber(input?.initialInvestmentTotal, 0),

    paymentFeeRate: toNumber(calcParams.paymentFeeRate, 0),
    royaltyCapMonthly: toNumber(calcParams.royaltyCapMonthly, 0),
    appFeeMonthly: toNumber(calcParams.appFeeMonthly, 0),

    monthlyMemberFeeExTax: toNumber(MONTHLY_MEMBER_FEE_EX_TAX, 0),

    month: toNumber(derived?.month, 1),
    members: toNumber(derived?.members, 0),
    monthlyRevenue: toNumber(derived?.monthlyRevenue, 0),
    monthlyRent: toNumber(derived?.monthlyRent, rentPerTsubo),
    monthlyRunningCost: toNumber(derived?.monthlyRunningCost, runningCostTotal),
    adCostMonthly: toNumber(derived?.adCostMonthly, 0),
    paymentFee: toNumber(derived?.paymentFee, 0),
    monthlyRoyalty: toNumber(derived?.monthlyRoyalty, 0),
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
