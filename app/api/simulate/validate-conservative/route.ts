import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { validateScenarioRegression } from "@/lib/server/regression-validator"

export async function GET() {
  try {
    const result = await validateScenarioRegression("conservative")
    return Response.json(result, { status: result.pass ? 200 : 409 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "保守シナリオ回帰検証に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
