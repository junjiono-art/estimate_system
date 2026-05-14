export type FormulaFunctionName = "round" | "ceil" | "floor"

export type FormulaTokenType = "var" | "const" | "namedConst" | "op" | "fn" | "paren"

export type FormulaToken = {
  type: FormulaTokenType
  varKey?: string
  value?: number | string
  namedConstKey?: string
  op?: string
  fnName?: FormulaFunctionName | string
  paren?: "(" | ")"
  label?: string
}

export type FormulaDefinition = {
  key: string
  label: string
  tokens: FormulaToken[]

  // メタデータ（新規）
  /** この式が参照する変数キー */
  inputVars?: string[]
  /** 出力型 */
  outputType?: "number" | "percentage" | "currency"
  /** 最小値制約 */
  minValue?: number
  /** 最大値制約 */
  maxValue?: number
  /** 説明文 */
  description?: string
  /** 廃止フラグ */
  deprecated?: boolean
  /** 式のバージョン */
  version?: string
}

export type FormulaSetRecordLike = {
  setVersion: string
  formulas: Record<string, FormulaDefinition>
}
