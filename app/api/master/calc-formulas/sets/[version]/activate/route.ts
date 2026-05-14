import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

export const runtime = "nodejs"

const FORMULA_SETS_PATH = "/api/master/formula-sets"

type Context = {
  params: Promise<{ version: string }>
}

type ActivatePayload = {
  updatedBy?: string
}

export async function PUT(request: Request, context: Context) {
  const { version } = await context.params
  const body = (await request.json().catch(() => null)) as ActivatePayload | null
  const updatedBy = body?.updatedBy?.trim() || "system"

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ pointer: unknown }>({
      method: "PUT",
      path: `${FORMULA_SETS_PATH}/${version}/activate`,
      body: { updatedBy },
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        result.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "計算式セットの本番反映に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "計算式セットの本番反映に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
