import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaResultsBasePath = process.env.LAMBDA_RESULTS_BASE_PATH?.trim() || "/api/results"

type Context = {
  params: Promise<{ resultId: string }>
}

export async function GET(_request: Request, context: Context) {
  const { resultId } = await context.params

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ item: unknown }>({
      method: "GET",
      path: `${lambdaResultsBasePath}/${resultId}`,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        result.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "試算結果の取得に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "試算結果の取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { resultId } = await context.params

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ success: boolean }>({
      method: "DELETE",
      path: `${lambdaResultsBasePath}/${resultId}`,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        result.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "試算結果の削除に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "試算結果の削除に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
