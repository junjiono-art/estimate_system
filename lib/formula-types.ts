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
}

export type FormulaSetRecordLike = {
  setVersion: string
  formulas: Record<string, FormulaDefinition>
}
