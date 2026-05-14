import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

export const runtime = "nodejs"

const FORMULA_SETS_PATH = "/api/master/formula-sets"

export async function GET() {
  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ formulaSet: unknown }>({
      method: "GET",
      path: `${FORMULA_SETS_PATH}/current`,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        result.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "現行計算式セットの取得に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "現行計算式セットの取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
