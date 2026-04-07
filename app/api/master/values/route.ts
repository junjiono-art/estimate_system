import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaMasterValuesBasePath = process.env.LAMBDA_MASTER_VALUES_BASE_PATH?.trim() || "/api/master/values"

type MasterValuePayload = {
  category?: string
  label?: string
  unit?: string
  defaultAmount?: number
  currentAmount?: number
  note?: string
}

export async function GET() {
  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ values: unknown[] }>({
      method: "GET",
      path: lambdaMasterValuesBasePath,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "単価マスタの取得に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "単価マスタの取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as MasterValuePayload | null

  const category = body?.category?.trim()
  const label = body?.label?.trim()
  const unit = body?.unit?.trim()
  const defaultAmount = Number(body?.defaultAmount)
  const currentAmount = Number(body?.currentAmount)
  const note = body?.note ?? ""

  if (!category || !label || !unit || !Number.isFinite(defaultAmount) || !Number.isFinite(currentAmount)) {
    return errorResponse(
      ErrorCode.VALIDATION_ERROR,
      "category, label, unit, defaultAmount, currentAmount は必須です。",
      400,
    )
  }

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ value: unknown }>({
      method: "POST",
      path: lambdaMasterValuesBasePath,
      body: { category, label, unit, defaultAmount, currentAmount, note },
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "単価マスタの作成に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode },
      )
    }

    return NextResponse.json(result.data, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "単価マスタの作成に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
