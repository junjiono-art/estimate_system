import { NextResponse } from "next/server"
import { createStore, listStores } from "@/lib/server/store-repository"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaStoreBasePath = process.env.LAMBDA_STORES_BASE_PATH?.trim() || "/api/master/stores"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const prefecture = searchParams.get("prefecture") ?? undefined
  const query = searchParams.get("q") ?? undefined

  try {
    if (hasLambdaGatewayConfigured()) {
      const result = await invokeLambdaGateway<{ stores: unknown[] }>({
        method: "GET",
        path: lambdaStoreBasePath,
        query: { prefecture, q: query },
      })

      if (!result.ok || !result.data) {
        return errorResponse(
          ErrorCode.STORES_FETCH_FAILED,
          result.errorMessage || "店舗一覧の取得に失敗しました。",
          result.status || 502,
          { upstreamCode: result.errorCode },
        )
      }

      return NextResponse.json(result.data)
    }

    const stores = await listStores({ prefecture, query })
    return NextResponse.json({ stores })
  } catch (error) {
    const message = error instanceof Error ? error.message : "店舗一覧の取得に失敗しました。"
    return errorResponse(ErrorCode.STORES_FETCH_FAILED, message, 500)
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string
    address?: string
    openedAt?: string
    note?: string
  } | null

  const name = body?.name?.trim()
  const address = body?.address?.trim()
  const openedAt = body?.openedAt?.trim()
  const note = body?.note ?? ""

  if (!name || !address || !openedAt) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "name, address, openedAt は必須です。", 400)
  }

  try {
    if (hasLambdaGatewayConfigured()) {
      const result = await invokeLambdaGateway<{ store: unknown }>({
        method: "POST",
        path: lambdaStoreBasePath,
        body: { name, address, openedAt, note },
      })

      if (!result.ok || !result.data) {
        return errorResponse(
          ErrorCode.STORE_CREATE_FAILED,
          result.errorMessage || "店舗の作成に失敗しました。",
          result.status || 502,
          { upstreamCode: result.errorCode },
        )
      }

      return NextResponse.json(result.data, { status: 201 })
    }

    const store = await createStore({ name, address, openedAt, note })
    return NextResponse.json({ store }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "店舗の作成に失敗しました。"
    return errorResponse(ErrorCode.STORE_CREATE_FAILED, message, 400)
  }
}
