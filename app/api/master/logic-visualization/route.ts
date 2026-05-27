import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"
import { FORMULA_VAR_REGISTRY } from "@/lib/formula-vars"
import { DEFAULT_FORMULA_DEPENDENCIES } from "@/lib/formula-dependencies"
import type { FormulaDefinition, FormulaSetRecordLike, FormulaToken } from "@/lib/formula-types"
import { extractVariablesFromTokens } from "@/lib/formula-validation"

const lambdaFormulaSetsBasePath = process.env.LAMBDA_FORMULA_SETS_BASE_PATH?.trim() || "/master/formula-sets"

type FormulaSetCurrentPayload = {
  formulaSet?: FormulaSetRecordLike & {
    status?: string
    comment?: string
    createdBy?: string
    createdAt?: string
    basedOnVersion?: string
  }
}

const VAR_LABEL_MAP = new Map(FORMULA_VAR_REGISTRY.map((v) => [v.key, v.label]))

function tokenToText(token: FormulaToken): string {
  if (token.type === "var") return VAR_LABEL_MAP.get(token.varKey || "") || token.label || token.varKey || "var"
  if (token.type === "namedConst") return VAR_LABEL_MAP.get(token.namedConstKey || "") || token.label || token.namedConstKey || "namedConst"
  if (token.type === "const") return String(token.value ?? 0)
  if (token.type === "op") {
    const op = token.op || String(token.value ?? "?")
    if (op === "*") return "×"
    if (op === "/") return "÷"
    return op
  }
  if (token.type === "fn") return token.fnName || token.label || "fn"
  if (token.type === "paren") return token.paren || "("
  return "?"
}

function formulaToExpression(formula: FormulaDefinition): string {
  return formula.tokens.map(tokenToText).join(" ")
}

export async function GET() {
  const warnings: string[] = []
  let activeFormulaSet: FormulaSetCurrentPayload["formulaSet"]

  try {
    if (hasLambdaGatewayConfigured()) {
      const result = await invokeLambdaGateway<FormulaSetCurrentPayload>({
        method: "GET",
        path: `${lambdaFormulaSetsBasePath}/current`,
      })

      if (!result.ok) {
        warnings.push(result.errorMessage || "アクティブな式セットの取得に失敗しました。")
      } else {
        activeFormulaSet = result.data?.formulaSet
      }
    } else {
      warnings.push("LAMBDA_API_BASE_URL が未設定のため、アクティブ式セットを取得できません。")
    }

    const formulas = Object.entries(activeFormulaSet?.formulas || {})
      .sort(([left], [right]) => left.localeCompare(right, "ja"))
      .map(([key, formula]) => {
      const dep = DEFAULT_FORMULA_DEPENDENCIES[key]
      const tokenCount = Array.isArray(formula.tokens) ? formula.tokens.length : 0
      return {
        key,
        label: formula.label || key,
        tokenCount,
        expression: tokenCount > 0 ? formulaToExpression(formula) : "",
        inputVars: formula.inputVars != null
          ? formula.inputVars
          : extractVariablesFromTokens(formula.tokens || []),
        dependsOn: dep?.dependsOn || [],
        phase: dep?.phase || "monthly",
      }
      })

    const dependencies = Object.values(DEFAULT_FORMULA_DEPENDENCIES).map((dep) => ({
      key: dep.key,
      label: dep.label,
      dependsOn: dep.dependsOn,
      phase: dep.phase,
    }))

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: {
        hasLambdaGateway: hasLambdaGatewayConfigured(),
        formulaSetSource: activeFormulaSet ? "lambda-current" : "unavailable",
      },
      activeFormulaSet: activeFormulaSet
        ? {
          setVersion: activeFormulaSet.setVersion,
          status: activeFormulaSet.status || "unknown",
          comment: activeFormulaSet.comment || "",
          createdBy: activeFormulaSet.createdBy || "unknown",
          createdAt: activeFormulaSet.createdAt || "",
          basedOnVersion: activeFormulaSet.basedOnVersion,
        }
        : null,
      summary: {
        formulaCount: formulas.length,
        variableCount: FORMULA_VAR_REGISTRY.length,
        dependencyCount: dependencies.length,
      },
      formulas,
      variables: FORMULA_VAR_REGISTRY,
      dependencies,
      warnings,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "ロジック可視化データの取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
