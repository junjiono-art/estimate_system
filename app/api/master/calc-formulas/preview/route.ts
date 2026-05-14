import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import {
  PREVIEW_CONTEXT_OVERRIDES_DEFAULTS,
  PREVIEW_SIMULATION_INPUT_DEFAULTS,
} from "@/lib/formula-preview-defaults"
import { buildFormulaContext, buildInitialPhaseContext, evaluateFormulaTokens } from "@/lib/server/formula-runtime"
import { getCalcParamsFromDb } from "@/lib/server/calc-params-client"
import type { FormulaToken } from "@/lib/formula-types"
import type { SimulationRequestInput } from "@/lib/types"

export const runtime = "nodejs"

type PreviewBody = {
  tokens?: FormulaToken[]
  simulationInput?: Partial<SimulationRequestInput>
  contextOverrides?: Record<string, number>
  // ────────────────────────────────────────────────────
  // 【新規】初期値層（Pre phase）の結果
  // ────────────────────────────────────────────────────
  initialPhase?: {
    initialJoiners?: number
    demandMultiplier?: number
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PreviewBody | null

  if (!Array.isArray(body?.tokens) || body.tokens.length === 0) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "tokens は必須です。", 400)
  }

  try {
    const calcParams = await getCalcParamsFromDb()

    // ────────────────────────────────────────────────────
    // 【拡張】initialPhase をサポート
    // ────────────────────────────────────────────────────
    const mergedInput = {
      ...PREVIEW_SIMULATION_INPUT_DEFAULTS,
      ...body?.simulationInput,
    }

    // Merge caller-provided values over shared defaults to keep preview stable and reproducible.
    const context = buildFormulaContext({
      input: mergedInput,
      calcParams,
      derived: {
        ...PREVIEW_CONTEXT_OVERRIDES_DEFAULTS,
        ...(body?.contextOverrides || {}),
      },
      initialPhase: body?.initialPhase,
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
