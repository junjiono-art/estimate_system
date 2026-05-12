import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { buildFormulaContext, evaluateFormulaTokens } from "@/lib/server/formula-runtime"
import { getCalcParamsFromDb } from "@/lib/server/calc-params-client"
import type { FormulaToken } from "@/lib/formula-types"
import type { SimulationRequestInput } from "@/lib/types"

export const runtime = "nodejs"

type PreviewBody = {
  tokens?: FormulaToken[]
  simulationInput?: Partial<SimulationRequestInput>
  contextOverrides?: Record<string, number>
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PreviewBody | null

  if (!Array.isArray(body?.tokens) || body.tokens.length === 0) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "tokens は必須です。", 400)
  }

  try {
    const calcParams = await getCalcParamsFromDb()
    const context = buildFormulaContext({
      input: body.simulationInput,
      calcParams,
      derived: body.contextOverrides,
    })

    const value = evaluateFormulaTokens(body.tokens, context)

    return NextResponse.json({
      value,
      context,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "プレビュー計算に失敗しました。"
    return errorResponse(ErrorCode.VALIDATION_ERROR, message, 422)
  }
}
