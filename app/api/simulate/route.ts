import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { calculateSimulation } from "@/lib/server/calc-engine"
import type { SimulationRequestInput } from "@/lib/types"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<SimulationRequestInput> | null

  if (!body?.storeName?.trim()) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "storeName は必須です。", 400)
  }

  if (body.scenario && !["conservative", "standard", "aggressive"].includes(body.scenario)) {
    return errorResponse(
      ErrorCode.VALIDATION_ERROR,
      "scenario は conservative / standard / aggressive のいずれかを指定してください。",
      400,
    )
  }

  try {
    const result = calculateSimulation({
      storeName: body.storeName,
      location: body.location,
      scenario: body.scenario,
      createdBy: body.createdBy,
    })

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "試算に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
