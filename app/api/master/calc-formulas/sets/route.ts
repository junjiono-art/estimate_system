import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

export const runtime = "nodejs"

const lambdaFormulaSetsBasePath = process.env.LAMBDA_FORMULA_SETS_BASE_PATH?.trim() || "/api/master/formula-sets"

type FormulaSetPostPayload = {
  comment?: string
  createdBy?: string
  basedOnVersion?: string
  formulas?: Record<string, unknown>
}

export async function GET() {
  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ formulaSets: unknown[] }>({
      method: "GET",
      path: lambdaFormulaSetsBasePath,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "計算式セット一覧の取得に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "計算式セット一覧の取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FormulaSetPostPayload | null

  const comment = body?.comment?.trim()
  const createdBy = body?.createdBy?.trim()
  const basedOnVersion = body?.basedOnVersion?.trim()
  const formulas = body?.formulas

  if (!comment || !createdBy || !formulas || typeof formulas !== "object") {
    return errorResponse(
      ErrorCode.VALIDATION_ERROR,
      "comment, createdBy, formulas は必須です。",
      400,
    )
  }

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ formulaSet: unknown }>({
      method: "POST",
      path: lambdaFormulaSetsBasePath,
      body: {
        comment,
        createdBy,
        basedOnVersion,
        formulas,
      },
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "計算式セットの作成に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    return NextResponse.json(result.data, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "計算式セットの作成に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
