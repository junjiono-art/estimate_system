import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaHistoryPath = process.env.LAMBDA_HISTORY_PATH?.trim() || "/api/history"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = searchParams.get("limit") || undefined

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ total: number; items: unknown[] }>({
      method: "GET",
      path: lambdaHistoryPath,
      query: {
        limit,
      },
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "試算履歴の取得に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "試算履歴の取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
