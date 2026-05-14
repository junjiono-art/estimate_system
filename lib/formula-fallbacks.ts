/**
 * 式のフォールバック戦略定義
 *
 * 式が未定義またはエラー時のデフォルト値を体系的に管理します。
 */

/**
 * フォールバック値の定義
 */
export type FormulaFallbackDef = {
  key: string
  label: string
  /** フォールバック値の取得方法 */
  fallbackType: "static" | "derived" | "function"
  /** 静的な値（fallbackType === "static" の場合） */
  fallbackValue?: number
  /** 計算式で取得（fallbackType === "derived" or "function" の場合） */
  fallbackFn?: (args: Record<string, number>) => number
  /** 最小値制約 */
  min?: number
  /** 最大値制約 */
  max?: number
}

/**
 * 式評価時のエラー情報
 */
export type FormulaEvaluationError = {
  key: string
  errorType: "parsing" | "runtime" | "circular" | "missing_var" | "undefined"
  message: string
  fallbackApplied: boolean
  fallbackValue?: number
}

/**
 * 式評価エラーのログ管理
 */
export class FormulaEvaluationErrorLog {
  private errors: FormulaEvaluationError[] = []

  addError(error: FormulaEvaluationError): void {
    this.errors.push(error)
  }

  hasErrors(): boolean {
    return this.errors.length > 0
  }

  getErrors(): FormulaEvaluationError[] {
    return [...this.errors]
  }

  /**
   * 警告をコンソールに出力
   */
  logWarnings(): void {
    this.errors.forEach(error => {
      const fallbackInfo = error.fallbackApplied ? `(fallback: ${error.fallbackValue})` : ""
      console.warn(
        `[FormulaEvaluation] ${error.key}: ${error.errorType}`,
        error.message,
        fallbackInfo,
      )
    })
  }

  /**
   * ログをリセット
   */
  clear(): void {
    this.errors = []
  }
}

/**
 * デフォルトのフォールバック値定義
 *
 * 注記: 実装時に resolveInitialJoiners, getPaymentFee 等を import して使用
 */
export const FORMULA_FALLBACKS: Record<string, FormulaFallbackDef> = {
  // ──────────────────────────────
  // Pre phase
  // ──────────────────────────────
  initialJoiners: {
    key: "initialJoiners",
    label: "初月入会人数",
    fallbackType: "function",
    // fallbackFn は calc-engine.ts で resolveInitialJoiners を渡す
    min: 1,
  },
  demandMultiplier: {
    key: "demandMultiplier",
    label: "需要乗数",
    fallbackType: "derived",
    // demandMultiplier = initialJoiners / 334
    min: 0.2,
  },

  // ──────────────────────────────
  // Monthly phase
  // ──────────────────────────────
  paymentFee: {
    key: "paymentFee",
    label: "決済手数料",
    fallbackType: "function",
    // fallbackFn は calc-engine.ts で getPaymentFee を渡す
    min: 0,
  },
  monthlyRoyalty: {
    key: "monthlyRoyalty",
    label: "月次ロイヤリティ",
    fallbackType: "derived",
    // monthlyRoyalty = min(revenue * royaltyRate, royaltyCapMonthly)
    min: 0,
  },
  appFee: {
    key: "appFee",
    label: "アプリ利用料",
    fallbackType: "derived",
    // appFee = monthlyRoyalty > 0 ? appFeeMonthly : 0
    min: 0,
  },
  monthlyCost: {
    key: "monthlyCost",
    label: "月次総コスト",
    fallbackType: "derived",
    // monthlyCost = rent + running + adCost + paymentFee + royalty + appFee
    min: 0,
  },
  adCostMonthly: {
    key: "adCostMonthly",
    label: "月次広告費",
    fallbackType: "function",
    // fallbackFn は calc-engine.ts で getMonthlyAdCost を渡す
    min: 0,
  },
}

/**
 * フォールバック値にmin/max制約を適用
 */
export function applyConstraints(value: number, min?: number, max?: number): number {
  let result = value
  if (typeof min === "number") result = Math.max(min, result)
  if (typeof max === "number") result = Math.min(max, result)
  return result
}
