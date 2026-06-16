import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"

// OpenStreetMap Overpass API で近隣のフィットネスジム（競合）を検索する。
// 無料・APIキー不要。データはOSMコミュニティ由来のため登録漏れがありうる（網羅性は中程度）。
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"
const MAX_RADIUS_KM = 10
const RESULT_LIMIT = 80
const FETCH_TIMEOUT_MS = 15000

type OverpassElement = {
  type: "node" | "way" | "relation"
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

type GymPoi = {
  id: string
  name: string
  latitude: number
  longitude: number
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    latitude?: number
    longitude?: number
    radiusKm?: number
  } | null

  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)
  const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(0.1, Number(body?.radiusKm) || 3))

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "latitude, longitude は必須です。", 400)
  }

  const radiusMeters = Math.round(radiusKm * 1000)
  // フィットネスジム系のタグを around 検索（node/way/relation）。
  const query = `[out:json][timeout:25];
(
  nwr["leisure"="fitness_centre"](around:${radiusMeters},${latitude},${longitude});
  nwr["leisure"="sports_centre"]["sport"~"fitness|gym|bodybuilding",i](around:${radiusMeters},${latitude},${longitude});
);
out center tags ${RESULT_LIMIT};`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }).toString(),
      cache: "no-store",
      signal: controller.signal,
    })

    if (!response.ok) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "近隣ジム検索（Overpass）への接続に失敗しました。", 502)
    }

    const payload = (await response.json().catch(() => null)) as { elements?: OverpassElement[] } | null
    const elements = Array.isArray(payload?.elements) ? payload.elements : []

    const seen = new Set<string>()
    const gyms: GymPoi[] = []
    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat
      const lon = el.lon ?? el.center?.lon
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const id = `${el.type}/${el.id}`
      if (seen.has(id)) continue
      seen.add(id)
      gyms.push({
        id,
        name: el.tags?.name?.trim() || el.tags?.["brand"]?.trim() || "（名称不明のジム）",
        latitude: lat as number,
        longitude: lon as number,
      })
    }

    return NextResponse.json({ gyms, count: gyms.length, radiusKm })
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError"
    const message = aborted
      ? "近隣ジム検索がタイムアウトしました。時間をおいて再度お試しください。"
      : "近隣ジム検索に失敗しました。"
    return errorResponse(ErrorCode.EXTERNAL_API_ERROR, message, aborted ? 504 : 500)
  } finally {
    clearTimeout(timeout)
  }
}
