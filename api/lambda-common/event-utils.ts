import type { APIGatewayProxyEvent } from "aws-lambda"
import { failValidation } from "./response"

export function parseJsonBody<T>(event: APIGatewayProxyEvent): { ok: true; data: T } | { ok: false; error: ReturnType<typeof failValidation> } {
  if (!event.body) {
    return {
      ok: false,
      error: failValidation("request body is required"),
    }
  }

  try {
    return {
      ok: true,
      data: JSON.parse(event.body) as T,
    }
  } catch {
    return {
      ok: false,
      error: failValidation("invalid JSON body"),
    }
  }
}

export function getPathId(event: APIGatewayProxyEvent): string | null {
  const id = event.pathParameters?.id
  return id && id.trim() ? id.trim() : null
}
