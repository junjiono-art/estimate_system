import { NextResponse } from "next/server"
import { geocodeAddress } from "@/lib/server/geocoding"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { address?: string } | null
  const address = body?.address?.trim()

  if (!address) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "address は必須です。", 400)
  }

  try {
    const result = await geocodeAddress(address)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "ジオコーディングに失敗しました。"
    return errorResponse(ErrorCode.GEOCODING_FAILED, message, 400)
  }
}
