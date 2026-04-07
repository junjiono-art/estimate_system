export function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback

  const body = payload as {
    error?: string | { message?: string }
  }

  if (typeof body.error === "string") return body.error
  if (typeof body.error === "object" && typeof body.error?.message === "string") {
    return body.error.message
  }

  return fallback
}
