import { ErrorCode } from "./error-codes"
import { fail, failInternal, failNotFound, failValidation, ok, type LambdaResult } from "./response"

type LambdaEvent = {
  pathParameters?: Record<string, string>
  body?: string | null
}

// Example: PUT /api/master/stores/{id}
export async function updateStoreHandler(event: LambdaEvent): Promise<LambdaResult> {
  try {
    const id = event.pathParameters?.id
    if (!id) return failValidation("id is required")

    if (!event.body) return failValidation("request body is required")

    const body = JSON.parse(event.body) as {
      name?: string
      address?: string
      openedAt?: string
      note?: string
    }

    if (!body.name || !body.address || !body.openedAt) {
      return failValidation("name, address, openedAt are required")
    }

    // TODO: load store by id from DynamoDB
    const exists = true
    if (!exists) return failNotFound("store not found", { id })

    // TODO: call geocoding service and update DynamoDB
    // if geocoding fails, return fail(ErrorCode.GEOCODING_FAILED, ...)

    const updatedStore = {
      id,
      name: body.name,
      address: body.address,
      openedAt: body.openedAt,
      note: body.note || "",
    }

    return ok({ store: updatedStore })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return failValidation("invalid JSON body")
    }

    return failInternal("failed to update store", {
      reason: error instanceof Error ? error.message : "unknown",
    })
  }
}

// Example: business-level conflict style error
export function nearbyStoreConflictExample() {
  return fail(ErrorCode.NEARBY_STORE_FOUND, "nearby store found", 409, {
    thresholdKm: 1,
  })
}
