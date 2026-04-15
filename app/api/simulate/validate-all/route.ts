import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { validateAllRegression } from "@/lib/server/regression-validator"

export async function GET() {
  try {
    const result = await validateAllRegression()
    return Response.json(result, { status: result.pass ? 200 : 409 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "回帰検証（一括）に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
