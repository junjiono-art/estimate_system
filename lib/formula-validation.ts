/**
 * 式セットの検証
 *
 * ビルド時・ランタイム時の検証を行います。
 */

import type { FormulaSetRecordLike, FormulaToken } from "@/lib/formula-types"

/**
 * 検証エラーの分類
 */
export type FormulaValidationError = {
  formulaKey: string
  errorType:
    | "missing_var"
    | "invalid_type"
    | "circular"
    | "undefined_dep"
    | "constraint_violation"
    | "invalid_token"
  message: string
}

/**
 * 検証結果
 */
export type FormulaValidationResult = {
  valid: boolean
  errors: FormulaValidationError[]
  warnings: string[]
}

/**
 * FormulaSet 全体を検証
 *
 * @param formulaSet 検証対象の式セット
 * @param availableVars 利用可能な変数マップ { varKey: "label" }
 * @param dependencies 式の依存関係 { formulaKey: [dependOnKeys...] }
 */
export function validateFormulaSet(
  formulaSet: FormulaSetRecordLike | undefined,
  availableVars: Record<string, string>,
  dependencies: Record<string, string[]> = {},
): FormulaValidationResult {
  const errors: FormulaValidationError[] = []
  const warnings: string[] = []

  if (!formulaSet?.formulas) {
    return { valid: true, errors, warnings }
  }

  // Rule 1: 各式が参照する変数が定義されているか
  Object.entries(formulaSet.formulas).forEach(([key, formula]) => {
    const requiredVars = extractVariablesFromTokens(formula.tokens)
    requiredVars.forEach(varKey => {
      if (!availableVars[varKey]) {
        errors.push({
          formulaKey: key,
          errorType: "missing_var",
          message: `変数 "${varKey}" が定義されていません。`,
        })
      }
    })
  })

  // Rule 2: トークンの妥当性チェック
  Object.entries(formulaSet.formulas).forEach(([key, formula]) => {
    const tokenErrors = validateFormulaTokens(formula.tokens)
    tokenErrors.forEach(msg => {
      errors.push({
        formulaKey: key,
        errorType: "invalid_token",
        message: msg,
      })
    })
  })

  // Rule 3: 依存する式が存在するか
  Object.entries(dependencies).forEach(([key, deps]) => {
    if (key in (formulaSet.formulas ?? {})) {
      deps.forEach(dep => {
        if (!(dep in (formulaSet.formulas ?? {}))) {
          // ※ dep が式ではなく変数の場合は許可
          if (!(dep in availableVars)) {
            warnings.push(
              `式 "${key}" が依存する式 "${dep}" が定義されていません。` +
              `（フォールバックロジックで対応します）`,
            )
          }
        }
      })
    }
  })

  // Rule 4: メタデータの制約チェック
  Object.entries(formulaSet.formulas).forEach(([key, formula]) => {
    if (
      formula.minValue !== undefined &&
      formula.maxValue !== undefined &&
      formula.minValue > formula.maxValue
    ) {
      errors.push({
        formulaKey: key,
        errorType: "constraint_violation",
        message: `minValue (${formula.minValue}) > maxValue (${formula.maxValue})`,
      })
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * トークンから参照されている変数を抽出
 */
export function extractVariablesFromTokens(tokens: FormulaToken[]): string[] {
  return tokens
    .filter(t => t.type === "var" || t.type === "namedConst")
    .map(t => t.varKey || t.namedConstKey)
    .filter((v): v is string => v !== undefined)
}

/**
 * トークン列の妥当性を検証
 */
export function validateFormulaTokens(tokens: FormulaToken[]): string[] {
  const errors: string[] = []

  if (!Array.isArray(tokens) || tokens.length === 0) {
    errors.push("トークンが空です。")
    return errors
  }

  // 括弧のバランスチェック
  let parenBalance = 0
  for (const token of tokens) {
    if (token.type === "paren") {
      if (token.paren === "(") {
        parenBalance++
      } else if (token.paren === ")") {
        parenBalance--
        if (parenBalance < 0) {
          errors.push("閉じ括弧が多すぎます。")
          break
        }
      }
    }
  }

  if (parenBalance > 0) {
    errors.push("開き括弧が閉じられていません。")
  }

  // 最初のトークンがオペレータやバイナリ演算子でないか
  const firstToken = tokens[0]
  if (firstToken?.type === "op" || firstToken?.type === "paren") {
    if (firstToken.type === "op" || (firstToken.type === "paren" && firstToken.paren === ")")) {
      errors.push("式が有効なトークンで始まっていません。")
    }
  }

  // 最後のトークンがオペレータやバイナリ演算子でないか
  const lastToken = tokens[tokens.length - 1]
  if (lastToken?.type === "op" || (lastToken?.type === "paren" && lastToken.paren === "(")) {
    errors.push("式が有効なトークンで終わっていません。")
  }

  return errors
}

/**
 * 型ガード: FormulaDefinition が有効か
 */
export function isValidFormulaDefinition(obj: unknown): boolean {
  if (typeof obj !== "object" || !obj) return false
  const def = obj as Record<string, unknown>
  return (
    typeof def.key === "string" &&
    typeof def.label === "string" &&
    Array.isArray(def.tokens)
  )
}

/**
 * 型ガード: FormulaSetRecord が有効か
 */
export function isValidFormulaSetRecord(obj: unknown): boolean {
  if (typeof obj !== "object" || !obj) return false
  const set = obj as Record<string, unknown>
  return (
    typeof set.setVersion === "string" &&
    typeof set.status === "string" &&
    ["draft", "active", "archived"].includes(set.status as string) &&
    typeof set.formulas === "object"
  )
}
