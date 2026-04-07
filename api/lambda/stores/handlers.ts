import type { APIGatewayProxyEvent } from "aws-lambda"
import { ErrorCode } from "../../lambda-common/error-codes"
import { parseJsonBody, getPathId } from "../../lambda-common/event-utils"
import { fail, failInternal, failNotFound, failValidation, ok, type LambdaResult } from "../../lambda-common/response"
import { haversineDistanceKm } from "../../lambda-common/geospatial"
import { geocodeAddress } from "./geocoding"
import { createStore, deleteStore, getStoreById, listStores, updateStore } from "./repository"
import type { NearbyCheckInput, StoreInput } from "./types"

function getErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code
  }
  return ErrorCode.INTERNAL_ERROR
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function listStoresHandler(event: APIGatewayProxyEvent): Promise<LambdaResult> {
  try {
    const prefecture = event.queryStringParameters?.prefecture || undefined
    const q = event.queryStringParameters?.q || undefined
    const stores = await listStores(prefecture, q)
    return ok({ stores })
  } catch (error) {
    return failInternal("failed to fetch stores", { reason: getErrorMessage(error, "unknown") })
  }
}

export async function getStoreHandler(event: APIGatewayProxyEvent): Promise<LambdaResult> {
  try {
    const id = getPathId(event)
    if (!id) return failValidation("id is required")

    const store = await getStoreById(id)
    if (!store) return failNotFound("store not found", { id })

    return ok({ store })
  } catch (error) {
    return failInternal("failed to get store", { reason: getErrorMessage(error, "unknown") })
  }
}

export async function createStoreHandler(event: APIGatewayProxyEvent): Promise<LambdaResult> {
  try {
    const parsed = parseJsonBody<{ name?: string; address?: string; openedAt?: string; note?: string }>(event)
    if (!parsed.ok) return parsed.error

    const name = parsed.data.name?.trim()
    const address = parsed.data.address?.trim()
    const openedAt = parsed.data.openedAt?.trim()
    const note = parsed.data.note || ""

    if (!name || !address || !openedAt) {
      return failValidation("name, address, openedAt are required")
    }

    const geocoded = await geocodeAddress(address)
    const input: StoreInput = {
      name,
      address,
      openedAt,
      note,
      prefecture: geocoded.prefecture,
      city: geocoded.city,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    }

    const store = await createStore(input)
    return ok({ store }, 201)
  } catch (error) {
    const code = getErrorCode(error)
    if (code !== ErrorCode.INTERNAL_ERROR) {
      return fail(code, getErrorMessage(error, "failed to create store"), 400)
    }
    return failInternal("failed to create store", { reason: getErrorMessage(error, "unknown") })
  }
}

export async function updateStoreHandler(event: APIGatewayProxyEvent): Promise<LambdaResult> {
  try {
    const id = getPathId(event)
    if (!id) return failValidation("id is required")

    const parsed = parseJsonBody<{ name?: string; address?: string; openedAt?: string; note?: string }>(event)
    if (!parsed.ok) return parsed.error

    const name = parsed.data.name?.trim()
    const address = parsed.data.address?.trim()
    const openedAt = parsed.data.openedAt?.trim()
    const note = parsed.data.note || ""

    if (!name || !address || !openedAt) {
      return failValidation("name, address, openedAt are required")
    }

    const exists = await getStoreById(id)
    if (!exists) return failNotFound("store not found", { id })

    const geocoded = await geocodeAddress(address)
    const store = await updateStore(id, {
      name,
      address,
      openedAt,
      note,
      prefecture: geocoded.prefecture,
      city: geocoded.city,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    })

    if (!store) return failNotFound("store not found", { id })
    return ok({ store })
  } catch (error) {
    const code = getErrorCode(error)
    if (code !== ErrorCode.INTERNAL_ERROR) {
      return fail(code, getErrorMessage(error, "failed to update store"), 400)
    }
    return failInternal("failed to update store", { reason: getErrorMessage(error, "unknown") })
  }
}

export async function deleteStoreHandler(event: APIGatewayProxyEvent): Promise<LambdaResult> {
  try {
    const id = getPathId(event)
    if (!id) return failValidation("id is required")

    const deleted = await deleteStore(id)
    if (!deleted) return failNotFound("store not found", { id })

    return ok({ success: true })
  } catch (error) {
    return failInternal("failed to delete store", { reason: getErrorMessage(error, "unknown") })
  }
}

export async function checkNearbyStoresHandler(event: APIGatewayProxyEvent): Promise<LambdaResult> {
  try {
    const parsed = parseJsonBody<NearbyCheckInput>(event)
    if (!parsed.ok) return parsed.error

    const latitude = Number(parsed.data.latitude)
    const longitude = Number(parsed.data.longitude)
    const prefecture = parsed.data.prefecture?.trim()
    const radiusKm = Number(parsed.data.radiusKm ?? 1)
    const excludeStoreId = parsed.data.excludeStoreId

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !prefecture) {
      return failValidation("latitude, longitude, prefecture are required")
    }

    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      return failValidation("radiusKm must be greater than 0")
    }

    const candidates = (await listStores(prefecture)).filter((store) => store.id !== excludeStoreId)

    const nearbyStores = candidates
      .map((store) => {
        const distanceKm = haversineDistanceKm(
          { latitude, longitude },
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

    return ok({
      hasNearbyStore: nearbyStores.length > 0,
      resultCode: nearbyStores.length > 0 ? ErrorCode.NEARBY_STORE_FOUND : "OK",
      nearbyCount: nearbyStores.length,
      nearbyStores,
      thresholdKm: radiusKm,
      searchedCount: candidates.length,
      prefecture,
    })
  } catch (error) {
    return failInternal("failed to check nearby stores", { reason: getErrorMessage(error, "unknown") })
  }
}
