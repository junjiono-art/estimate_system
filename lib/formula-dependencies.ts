/**
 * 式の依存関係定義とトポロジカルソート
 *
 * 複数の式の評価順序を依存グラフベースで自動決定します。
 * 循環依存の検出も行います。
 */

import type { FormulaSetRecordLike } from "@/lib/formula-types"

/**
 * 式の依存関係メタデータ
 */
export type FormulaDependencyMeta = {
  key: string
  label: string
  dependsOn: string[]  // この式が依存する他の式キーの配列
  /**
   * 計算タイミング:
   * - "pre": 月別計算前（初月入会人数等）
   * - "monthly": 月別計算時（通常）
   * - "post": 月別計算後（集計等）
   */
  phase: "pre" | "monthly" | "post"
}

/**
 * 式セット全体の依存グラフ
 */
export type FormulaDependencyGraph = {
  nodes: Record<string, FormulaDependencyMeta>
  executionOrder: string[]  // トポロジカルソート済みの実行順序
  hasCircularDependency: boolean
  circularPath?: string[]  // 循環している経路（デバッグ用）
}

/**
 * デフォルトの式依存関係定義
 * ユーザーがカスタム式を追加する場合は、これを拡張する
 */
export const DEFAULT_FORMULA_DEPENDENCIES: Record<string, FormulaDependencyMeta> = {
  // Phase: pre （初月計算層）
  initialJoiners: {
    key: "initialJoiners",
    label: "初月入会人数",
    dependsOn: [],  // 入力層のみに依存
    phase: "pre",
  },
  demandMultiplier: {
    key: "demandMultiplier",
    label: "需要乗数",
    dependsOn: ["initialJoiners"],  // ← initialJoiners に依存
    phase: "pre",
  },

  // Phase: monthly （月別計算層）
  paymentFee: {
    key: "paymentFee",
    label: "決済手数料",
    dependsOn: [],  // 入力層のみに依存
    phase: "monthly",
  },
  monthlyRoyalty: {
    key: "monthlyRoyalty",
    label: "月次ロイヤリティ",
    dependsOn: ["paymentFee"],  // ← paymentFee に依存
    phase: "monthly",
  },
  appFee: {
    key: "appFee",
    label: "アプリ利用料",
    dependsOn: ["paymentFee", "monthlyRoyalty"],  // ← 両者に依存
    phase: "monthly",
  },
  monthlyCost: {
    key: "monthlyCost",
    // 総コスト = 家賃+ランニング+広告+決済手数料+ロイヤリティ+アプリ利用料。
    // 評価値を context に注入させるため、加算対象の式すべてを依存に含める。
    label: "月次総コスト",
    dependsOn: ["paymentFee", "monthlyRoyalty", "appFee", "adCostMonthly"],
    phase: "monthly",
  },
  adCostMonthly: {
    key: "adCostMonthly",
    label: "月次広告費",
    dependsOn: [],  // テーブル参照（現在）
    phase: "monthly",
  },
}

/**
 * FormulaSetRecord から依存グラフを構築し、トポロジカルソート実行
 *
 * @param formulaSet 式セット（undefined可能）
 * @param defaultDeps デフォルト依存関係定義
 * @returns 依存グラフと実行順序
 */
export function buildFormulaDependencyGraph(
  formulaSet: FormulaSetRecordLike | undefined,
  defaultDeps: Record<string, FormulaDependencyMeta> = DEFAULT_FORMULA_DEPENDENCIES,
): FormulaDependencyGraph {
  const nodes: Record<string, FormulaDependencyMeta> = {}
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const circularPath: string[] = []

  // Step 1: ノード定義を統合
  // （デフォルト定義 + formulaSet に定義されている式）
  const allKeys = new Set<string>(Object.keys(defaultDeps))
  if (formulaSet?.formulas) {
    Object.keys(formulaSet.formulas).forEach(key => allKeys.add(key))
  }

  // Step 2: 各ノードの依存関係を設定
  allKeys.forEach(key => {
    const userDef = formulaSet?.formulas?.[key]
    const defaultDef = defaultDeps[key]

    nodes[key] = {
      key,
      label: userDef?.label || defaultDef?.label || key,
      dependsOn: defaultDef?.dependsOn || [],  // 依存関係はデフォルト定義から
      phase: defaultDef?.phase || "monthly",
    }
  })

  // Step 3: トポロジカルソート（DFS）
  const sorted: string[] = []

  function visit(key: string, path: string[]): boolean {
    if (visited.has(key)) return true
    if (visiting.has(key)) {
      // 循環検出
      circularPath.push(...path, key)
      return false
    }

    visiting.add(key)
    const node = nodes[key]

    if (node?.dependsOn) {
      for (const dep of node.dependsOn) {
        if (!visit(dep, [...path, key])) {
          return false
        }
      }
    }

    visiting.delete(key)
    visited.add(key)
    sorted.push(key)
    return true
  }

  // すべてのノードを訪問
  for (const key of allKeys) {
    if (!visited.has(key)) {
      if (!visit(key, [])) {
        // 循環依存がある
        return {
          nodes,
          executionOrder: sorted,
          hasCircularDependency: true,
          circularPath,
        }
      }
    }
  }

  return {
    nodes,
    executionOrder: sorted,
    hasCircularDependency: false,
  }
}

/**
 * 依存グラフの検証
 * - 循環依存のチェック
 * - 存在しない依存先のチェック
 */
export function validateFormulaDependencies(
  graph: FormulaDependencyGraph,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (graph.hasCircularDependency) {
    errors.push(`循環依存を検出: ${graph.circularPath?.join(" → ") || ""}`)
  }

  // 存在しない依存先を検出
  Object.entries(graph.nodes).forEach(([key, node]) => {
    node.dependsOn?.forEach(dep => {
      if (!graph.nodes[dep]) {
        errors.push(`式 "${key}" が存在しない依存先 "${dep}" を参照しています。`)
      }
    })
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}
