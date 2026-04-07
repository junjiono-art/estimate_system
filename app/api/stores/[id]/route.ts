import { NextResponse } from "next/server"
import { deleteStore, getStoreById, updateStore } from "@/lib/server/store-repository"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaStoreBasePath = process.env.LAMBDA_STORES_BASE_PATH?.trim() || "/api/master/stores"

type Context = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params

  try {
    if (hasLambdaGatewayConfigured()) {
      const result = await invokeLambdaGateway<{ store: unknown }>({
        method: "GET",
        path: `${lambdaStoreBasePath}/${id}`,
      })

      if (!result.ok || !result.data) {
        return errorResponse(
          result.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.STORES_FETCH_FAILED,
          result.errorMessage || "店舗情報の取得に失敗しました。",
          result.status || 502,
          { upstreamCode: result.errorCode },
        )
      }

      return NextResponse.json(result.data)
    }

    const store = await getStoreById(id)
    if (!store) {
      return errorResponse(ErrorCode.NOT_FOUND, "店舗が見つかりません。", 404)
    }
    return NextResponse.json({ store })
  } catch (error) {
    const message = error instanceof Error ? error.message : "店舗情報の取得に失敗しました。"
    return errorResponse(ErrorCode.STORES_FETCH_FAILED, message, 500)
  }
}

export async function PUT(request: Request, context: Context) {
  const { id } = await context.params
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
        method: "PUT",
        path: `${lambdaStoreBasePath}/${id}`,
        body: { name, address, openedAt, note },
      })

      if (!result.ok || !result.data) {
        return errorResponse(
          result.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.STORE_UPDATE_FAILED,
          result.errorMessage || "店舗情報の更新に失敗しました。",
          result.status || 502,
          { upstreamCode: result.errorCode },
        )
      }

      return NextResponse.json(result.data)
    }

    const store = await updateStore(id, { name, address, openedAt, note })
    if (!store) {
      return errorResponse(ErrorCode.NOT_FOUND, "店舗が見つかりません。", 404)
    }
    return NextResponse.json({ store })
  } catch (error) {
    const message = error instanceof Error ? error.message : "店舗情報の更新に失敗しました。"
    return errorResponse(ErrorCode.STORE_UPDATE_FAILED, message, 400)
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params

  try {
    if (hasLambdaGatewayConfigured()) {
      const result = await invokeLambdaGateway<{ success: boolean }>({
        method: "DELETE",
        path: `${lambdaStoreBasePath}/${id}`,
      })

      if (!result.ok || !result.data) {
        return errorResponse(
          result.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.STORE_DELETE_FAILED,
          result.errorMessage || "店舗情報の削除に失敗しました。",
          result.status || 502,
          { upstreamCode: result.errorCode },
        )
      }

      return NextResponse.json(result.data)
    }

    const deleted = await deleteStore(id)
    if (!deleted) {
      return errorResponse(ErrorCode.NOT_FOUND, "店舗が見つかりません。", 404)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "店舗情報の削除に失敗しました。"
    return errorResponse(ErrorCode.STORE_DELETE_FAILED, message, 500)
  }
}
