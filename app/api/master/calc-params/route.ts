import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"
import { invalidateCalcParamsCache } from "@/lib/server/calc-params-client"
import { invalidateActiveFormulaSetCache, invalidateSimulationCache } from "@/lib/server/simulation-cache"
import { normalizeCalcParams } from "@/lib/default-calc-params"
import type { CalcParameterConfig } from "@/lib/types"

export const runtime = "nodejs"

const lambdaCalcParamsBasePath = process.env.LAMBDA_CALC_PARAMS_BASE_PATH?.trim() || "/master/calc-params"

type CalcParamsPayload = Partial<CalcParameterConfig>

export async function GET() {
  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ params: CalcParameterConfig }>({
      method: "GET",
      path: lambdaCalcParamsBasePath,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "計算パラメータの取得に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    // 保存レコードに新パラメータが無くても既定値で補完し、UIが拡張パラメータを編集できるようにする
    return NextResponse.json({ params: normalizeCalcParams(result.data.params) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "計算パラメータの取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as CalcParamsPayload | null

  if (!body || typeof body !== "object") {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "更新内容が不正です。", 400)
  }

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ params: CalcParameterConfig }>({
      method: "PUT",
      path: lambdaCalcParamsBasePath,
      body,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "計算パラメータの更新に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    // マスタ更新成功時は試算側の各種キャッシュを無効化して、次回試算で最新値を取得させる
    invalidateCalcParamsCache()
    invalidateActiveFormulaSetCache()
    invalidateSimulationCache()

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "計算パラメータの更新に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
