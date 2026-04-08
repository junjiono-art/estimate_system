import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaResultsSavePath = process.env.LAMBDA_RESULTS_SAVE_PATH?.trim() || "/api/results/save"
const defaultSaveUserId = process.env.DEFAULT_SAVE_USER_ID?.trim() || "anonymous"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        resultId?: string
        storeName?: string
        username?: string
        scenario?: "conservative" | "standard" | "aggressive"
        input?: unknown
        result?: unknown
      }
    | null

  if (!body?.storeName || !body?.username || !body?.scenario || !body?.input || !body?.result) {
    return errorResponse(
      ErrorCode.VALIDATION_ERROR,
      "storeName, username, scenario, input, result は必須です。",
      400,
    )
  }

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const bodyForUpstream = {
      ...body,
      userId: defaultSaveUserId,
    }

    const result = await invokeLambdaGateway<{
      message: string
      resultId: string
      savedAt: string
    }>({
      method: "POST",
      path: lambdaResultsSavePath,
      body: bodyForUpstream,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "試算結果の保存に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode },
      )
    }

    return NextResponse.json(result.data, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "試算結果の保存に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
