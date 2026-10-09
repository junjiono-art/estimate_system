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

  // 非JSON応答（API Gatewayのエラーページ等）も診断できるよう、テキストで受けてからパースする
  const rawText = await response.text().catch(() => "")
  let parsedPayload: unknown = null
  try {
    parsedPayload = rawText ? JSON.parse(rawText) : null
  } catch {
    parsedPayload = null
  }
  const payload = parsedPayload as
    | T
    | { error?: { code?: string; message?: string } | string; message?: string }
    | null

  if (!response.ok) {
    // Lambda標準形式 {error:{code,message}} 以外（API Gatewayの {message} や文字列error）のメッセージを拾う
    const upstreamMessage =
      payload && typeof payload === "object"
        ? "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "message" in payload && typeof payload.message === "string"
            ? payload.message
            : undefined
        : undefined
    console.error("[lambda-gateway] upstream error", {
      method: options.method,
      path: options.path,
      status: response.status,
      body: rawText.slice(0, 1000),
    })

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
        : `Lambda API呼び出しに失敗しました。(HTTP ${response.status}${upstreamMessage ? `: ${upstreamMessage}` : ""})`

    const errorDetails =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error !== null &&
      "details" in payload.error
        ? (payload.error as { details?: unknown }).details
        : { upstreamStatus: response.status, upstreamBody: rawText.slice(0, 500) || undefined }

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
