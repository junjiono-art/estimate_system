import { ErrorCode } from "@/lib/server/api-error"

type LambdaRequestOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE"
  path: string
  query?: Record<string, string | undefined>
  body?: unknown
}

function getBaseUrl(): string | null {
  const value = process.env.LAMBDA_API_BASE_URL?.trim()
  return value ? value.replace(/\/$/, "") : null
}

export function hasLambdaGatewayConfigured(): boolean {
  return Boolean(getBaseUrl())
}

export async function invokeLambdaGateway<T>(options: LambdaRequestOptions): Promise<{
  ok: boolean
  status: number
  data: T | null
  errorCode?: string
  errorMessage?: string
  errorDetails?: unknown
}> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) {
    return {
      ok: false,
      status: 500,
      data: null,
      errorCode: ErrorCode.EXTERNAL_API_ERROR,
      errorMessage: "LAMBDA_API_BASE_URL が未設定です。",
    }
  }

  const url = new URL(`${baseUrl}${options.path.startsWith("/") ? "" : "/"}${options.path}`)
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value) url.searchParams.set(key, value)
    }
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  const apiKey = process.env.LAMBDA_API_KEY?.trim()
  if (apiKey) headers["x-api-key"] = apiKey

  const response = await fetch(url.toString(), {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  })

  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: { code?: string; message?: string } | string }
    | null

  if (!response.ok) {
    const errorCode =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error?.code
        ? payload.error.code
        : ErrorCode.EXTERNAL_API_ERROR

    const errorMessage =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error?.message
        ? payload.error.message
        : "Lambda API呼び出しに失敗しました。"

    const errorDetails =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error !== null &&
      "details" in payload.error
        ? (payload.error as { details?: unknown }).details
        : undefined

    return {
      ok: false,
      status: response.status,
      data: null,
      errorCode,
      errorMessage,
      errorDetails,
    }
  }

  return {
    ok: true,
    status: response.status,
    data: payload as T,
  }
}
