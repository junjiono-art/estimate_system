import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaFranchiseCostsBasePath = process.env.LAMBDA_FRANCHISE_COSTS_BASE_PATH?.trim() || "/api/master/franchise-costs"

type FranchiseCostPayload = {
  label?: string
  amount?: number
  type?: string
  note?: string
}

export async function GET() {
  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ costs: unknown[] }>({
      method: "GET",
      path: lambdaFranchiseCostsBasePath,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "FC費用マスタの取得に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode },
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "FC費用マスタの取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FranchiseCostPayload | null

  const label = body?.label?.trim()
  const amount = Number(body?.amount)
  const type = body?.type?.trim()
  const note = body?.note ?? ""

  if (!label || !type || !Number.isFinite(amount)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "label, type, amount は必須です。", 400)
  }

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定です。", 500)
    }

    const result = await invokeLambdaGateway<{ cost: unknown }>({
      method: "POST",
      path: lambdaFranchiseCostsBasePath,
      body: { label, amount, type, note },
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "FC費用マスタの作成に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode },
      )
    }

    return NextResponse.json(result.data, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "FC費用マスタの作成に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
