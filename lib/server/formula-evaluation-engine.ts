/**
 * 依存グラフベースの式評価エンジン
 *
 * 複数の式の依存関係を自動解決し、トポロジカルソート順で評価します。
 */

import type { FormulaSetRecordLike } from "@/lib/formula-types"
import { evaluateFormulaByKey } from "@/lib/server/formula-runtime"
import {
  buildFormulaDependencyGraph,
  validateFormulaDependencies,
  DEFAULT_FORMULA_DEPENDENCIES,
  type FormulaDependencyMeta,
  type FormulaDependencyGraph,
} from "@/lib/formula-dependencies"
import { FormulaEvaluationErrorLog, applyConstraints, type FormulaEvaluationError } from "@/lib/formula-fallbacks"

/**
 * 依存グラフベースの式評価エンジン
 */
export class FormulaEvaluationEngine {
  private readonly graph: FormulaDependencyGraph
  private readonly formulaSet?: FormulaSetRecordLike
  private readonly defaultDeps: Record<string, FormulaDependencyMeta>
  private readonly evaluationResults: Record<string, number> = {}
  private readonly errorLog: FormulaEvaluationErrorLog = new FormulaEvaluationErrorLog()

  constructor(
    formulaSet: FormulaSetRecordLike | undefined,
    defaultDeps: Record<string, FormulaDependencyMeta> = DEFAULT_FORMULA_DEPENDENCIES,
  ) {
    this.formulaSet = formulaSet
    this.defaultDeps = defaultDeps
    this.graph = buildFormulaDependencyGraph(formulaSet, defaultDeps)

    // 循環依存チェック
    const validation = validateFormulaDependencies(this.graph)
    if (!validation.valid) {
      throw new Error(`式の依存関係が不正です: ${validation.errors.join(", ")}`)
    }
  }

  /**
   * 指定フェーズの式をすべて評価
   *
   * @param phase "pre" | "monthly" | "post"
   * @param context 式が参照するコンテキスト
   * @param fallbackValues 式が未定義時のデフォルト値
   * @returns 評価結果（key => value）
   */
  evaluatePhase(
    phase: "pre" | "monthly" | "post",
    context: Record<string, number>,
    fallbackValues: Record<string, number> = {},
  ): Record<string, number> {
    const results: Record<string, number> = { ...this.evaluationResults }

    // トポロジカルソート順に評価
    for (const key of this.graph.executionOrder) {
      const node = this.graph.nodes[key]
      if (!node || node.phase !== phase) continue

      // 依存する式の結果をコンテキストに追加
      const contextWithDeps = { ...context }
      node.dependsOn?.forEach(dep => {
        if (results[dep] !== undefined) {
          contextWithDeps[dep] = results[dep]
        }
      })

      // 式を評価
      const value = this.evaluateFormula(key, contextWithDeps, fallbackValues[key] ?? 0)

      results[key] = value
    }

    // 次の段階用に保存
    Object.assign(this.evaluationResults, results)
    return results
  }

  /**
   * 単一の式を評価
   *
   * @param key 式キー
   * @param context コンテキスト
   * @param fallbackValue フォールバック値
   * @returns 評価結果
   */
  private evaluateFormula(key: string, context: Record<string, number>, fallbackValue: number): number {
    try {
      // formulaSet に式が定義されているか確認
      const formula = this.formulaSet?.formulas?.[key]
      if (!formula?.tokens || formula.tokens.length === 0) {
        this.recordError({
          key,
          errorType: "undefined",
          message: `式 "${key}" が定義されていません。`,
          fallbackApplied: true,
          fallbackValue,
        })
        return fallbackValue
      }

      // 式を評価
      const evaluated = evaluateFormulaByKey(this.formulaSet, key, context)
      if (evaluated == null || !Number.isFinite(evaluated)) {
        this.recordError({
          key,
          errorType: "runtime",
          message: `式 "${key}" の評価結果が不正です。`,
          fallbackApplied: true,
          fallbackValue,
        })
        return fallbackValue
      }

      const result = Math.round(evaluated)

      // メタデータ定義の制約を適用
      return applyConstraints(result, formula.minValue, formula.maxValue)
    } catch (error) {
      // エラー時はフォールバック
      this.recordError({
        key,
        errorType: "runtime",
        message: `式 "${key}" の評価に失敗: ${error instanceof Error ? error.message : String(error)}`,
        fallbackApplied: true,
        fallbackValue,
      })
      return fallbackValue
    }
  }

  /**
   * エラーをログに記録
   */
  private recordError(error: Omit<FormulaEvaluationError, "fallbackApplied"> & { fallbackApplied: boolean }): void {
    this.errorLog.addError(error as FormulaEvaluationError)
  }

  /**
   * エラーログを取得
   */
  getErrorLog(): FormulaEvaluationErrorLog {
    return this.errorLog
  }

  /**
   * 評価結果をリセット
   */
  reset(): void {
    Object.keys(this.evaluationResults).forEach(key => {
      delete this.evaluationResults[key]
    })
    this.errorLog.clear()
  }

  /**
   * 依存グラフを取得（デバッグ用）
   */
  getDependencyGraph(): FormulaDependencyGraph {
    return this.graph
  }
}

/**
 * 単一の式を評価する（エンジン不要な場合の便利関数）
 *
 * @param formulaSet 式セット
 * @param formulaKey 式キー
 * @param context コンテキスト
 * @param fallbackValue フォールバック値
 * @param constraints { min?, max? }
 */
export function evaluateFormulaWithValidation(
  formulaSet: FormulaSetRecordLike | undefined,
  formulaKey: string,
  context: Record<string, number>,
  fallbackValue: number,
  constraints?: { min?: number; max?: number },
): number {
  try {
    const formula = formulaSet?.formulas?.[formulaKey]
    if (!formula?.tokens || formula.tokens.length === 0) {
      return applyConstraints(fallbackValue, formula?.minValue, formula?.maxValue)
    }

    // 式を評価
    const evaluated = evaluateFormulaByKey(formulaSet, formulaKey, context)
    if (!Number.isFinite(evaluated)) {
      return applyConstraints(fallbackValue, formula?.minValue, formula?.maxValue)
    }

    const result = Math.round(evaluated)

    // メタデータ定義の制約を適用
    return applyConstraints(result, formula?.minValue, formula?.maxValue)
  } catch (error) {
    console.warn(`式 "${formulaKey}" の評価に失敗:`, error)
    return applyConstraints(fallbackValue, undefined, undefined)
  }
}
