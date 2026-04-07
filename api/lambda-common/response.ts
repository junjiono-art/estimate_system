import { ErrorCode } from "./error-codes"

export type LambdaResult = {
  statusCode: number
  headers?: Record<string, string>
  body: string
}

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

type Headers = Record<string, string>

const defaultHeaders: Headers = {
  "Content-Type": "application/json",
}

function mergeHeaders(headers?: Headers): Headers {
  return {
    ...defaultHeaders,
    ...(headers || {}),
  }
}

export function ok<T>(data: T, statusCode = 200, headers?: Headers): LambdaResult {
  return {
    statusCode,
    headers: mergeHeaders(headers),
    body: JSON.stringify(data),
  }
}

export function fail(
  code: string,
  message: string,
  statusCode: number,
  details?: unknown,
  headers?: Headers,
): LambdaResult {
  return {
    statusCode,
    headers: mergeHeaders(headers),
    body: JSON.stringify({
      error: {
        code,
        message,
        details,
      },
    } satisfies ApiErrorBody),
  }
}

export function failValidation(message: string, details?: unknown): LambdaResult {
  return fail(ErrorCode.VALIDATION_ERROR, message, 400, details)
}

export function failNotFound(message: string, details?: unknown): LambdaResult {
  return fail(ErrorCode.NOT_FOUND, message, 404, details)
}

export function failExternal(message: string, details?: unknown): LambdaResult {
  return fail(ErrorCode.EXTERNAL_API_ERROR, message, 502, details)
}

export function failInternal(message = "Internal server error", details?: unknown): LambdaResult {
  return fail(ErrorCode.INTERNAL_ERROR, message, 500, details)
}
