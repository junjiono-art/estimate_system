import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaResultsBasePath = process.env.LAMBDA_RESULTS_BASE_PATH?.trim() || "/api/results"

type Context = {
  params: Promise<{ resultId: string }>
}

export async function PUT(request: Request, context: Context) {
  const { resultId } = await context.params
  const body = (await request.json().catch(() => null)) as { rating?: number } | null
  const rating = Number(body?.rating)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "rating は 1〜5 の整数で指定してください。", 400)
  }

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ message: string; resultId: string; rating: number }>({
      method: "PUT",
      path: `${lambdaResultsBasePath}/${resultId}/rating`,
      body: { rating },
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        result.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "評価の更新に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "評価の更新に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
