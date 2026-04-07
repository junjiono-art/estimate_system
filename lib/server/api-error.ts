import { NextResponse } from "next/server"

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  EXTERNAL_API_ERROR: "EXTERNAL_API_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  GEOCODING_FAILED: "GEOCODING_FAILED",
  MUNICIPALITY_PARSE_FAILED: "MUNICIPALITY_PARSE_FAILED",
  NEARBY_STORE_FOUND: "NEARBY_STORE_FOUND",
  STORES_FETCH_FAILED: "STORES_FETCH_FAILED",
  STORE_CREATE_FAILED: "STORE_CREATE_FAILED",
  STORE_UPDATE_FAILED: "STORE_UPDATE_FAILED",
  STORE_DELETE_FAILED: "STORE_DELETE_FAILED",
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export type ApiErrorBody = {
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}

export function errorResponse(code: ErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    } satisfies ApiErrorBody,
    { status },
  )
}
