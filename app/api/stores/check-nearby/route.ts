import { NextResponse } from "next/server"
import { haversineDistanceKm } from "@/lib/geospatial"
import { listStores } from "@/lib/server/store-repository"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"

const lambdaStoreBasePath = process.env.LAMBDA_STORES_BASE_PATH?.trim() || "/api/master/stores"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    latitude?: number
    longitude?: number
    prefecture?: string
    radiusKm?: number
    excludeStoreId?: string
  } | null

  const latitude = body?.latitude
  const longitude = body?.longitude
  const prefecture = body?.prefecture?.trim()
  const radiusKm = body?.radiusKm ?? 1
  const excludeStoreId = body?.excludeStoreId

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !prefecture) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "latitude, longitude, prefecture は必須です。", 400)
  }

  const targetLatitude = Number(latitude)
  const targetLongitude = Number(longitude)

  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "radiusKm は 0 より大きい数値を指定してください。", 400)
  }

  try {
    if (hasLambdaGatewayConfigured()) {
      const result = await invokeLambdaGateway<{
        hasNearbyStore: boolean
        nearbyCount: number
        nearbyStores: Array<{ storeId: string; name: string; address: string; distanceKm: number }>
        thresholdKm: number
        searchedCount: number
        prefecture: string
      }>({
        method: "POST",
        path: `${lambdaStoreBasePath}/check-nearby`,
        body: {
          latitude: targetLatitude,
          longitude: targetLongitude,
          prefecture,
          radiusKm,
          excludeStoreId,
        },
      })

      if (!result.ok || !result.data) {
        return errorResponse(
          ErrorCode.EXTERNAL_API_ERROR,
          result.errorMessage || "近隣店舗チェックに失敗しました。",
          result.status || 502,
          { upstreamCode: result.errorCode },
        )
      }

      return NextResponse.json({
        ...result.data,
        resultCode: result.data.hasNearbyStore ? ErrorCode.NEARBY_STORE_FOUND : "OK",
      })
    }

    const candidates = (await listStores({ prefecture })).filter((store) => store.id !== excludeStoreId)

    const nearbyStores = candidates
      .map((store) => {
        const distanceKm = haversineDistanceKm(
          { latitude: targetLatitude, longitude: targetLongitude },
          { latitude: store.latitude, longitude: store.longitude },
        )

        return {
          storeId: store.id,
          name: store.name,
          address: store.address,
          distanceKm: Number(distanceKm.toFixed(3)),
        }
      })
      .filter((store) => store.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)

    return NextResponse.json({
      hasNearbyStore: nearbyStores.length > 0,
      resultCode: nearbyStores.length > 0 ? ErrorCode.NEARBY_STORE_FOUND : "OK",
      nearbyCount: nearbyStores.length,
      nearbyStores,
      thresholdKm: radiusKm,
      searchedCount: candidates.length,
      prefecture,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "近隣店舗チェックに失敗しました。"
    return errorResponse(ErrorCode.EXTERNAL_API_ERROR, message, 500)
  }
}
