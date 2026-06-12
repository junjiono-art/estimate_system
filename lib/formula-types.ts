export type FormulaFunctionName = "round" | "ceil" | "floor" | "min" | "max" | "if"

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
  /**
   * 評価結果を四捨五入するか（既定 true）。
   * false の場合は小数のまま返す（例: 初月入会人数は未丸めで会員成長へ渡すため）。
   */
  roundResult?: boolean
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
