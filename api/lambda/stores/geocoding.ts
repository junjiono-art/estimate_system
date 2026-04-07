import { ErrorCode } from "../../lambda-common/error-codes"

type Municipality = {
  prefecture: string
  city: string
}

export type GeocodingResult = {
  latitude: number
  longitude: number
  prefecture: string
  city: string
}

function normalizeAddress(input: string): string {
  return input
    .replace(/\s+/g, "")
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 65248))
}

function extractMunicipality(address: string): Municipality | null {
  const normalized = normalizeAddress(address)
  const prefMatch = normalized.match(/(東京都|北海道|(?:京都|大阪)府|..県)/)
  if (!prefMatch) return null

  const prefecture = prefMatch[1]
  const remaining = normalized.slice(normalized.indexOf(prefecture) + prefecture.length)
  const cityMatch = remaining.match(/^(.+?(?:市.+?区|区|市|町|村))/)
  if (!cityMatch) return null

  return {
    prefecture,
    city: cityMatch[1],
  }
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const municipality = extractMunicipality(address)
  if (!municipality) {
    const error = new Error("住所から都道府県・市区町村を判定できませんでした。") as Error & { code?: string }
    error.code = ErrorCode.MUNICIPALITY_PARSE_FAILED
    throw error
  }

  const endpoint = "https://msearch.gsi.go.jp/address-search/AddressSearch?q="
  const response = await fetch(endpoint + encodeURIComponent(address), { cache: "no-store" })
  if (!response.ok) {
    const error = new Error("ジオコーディングAPIへの接続に失敗しました。") as Error & { code?: string }
    error.code = ErrorCode.EXTERNAL_API_ERROR
    throw error
  }

  const features = (await response.json()) as Array<{
    geometry?: { coordinates?: [number, number] }
  }>

  if (!Array.isArray(features) || features.length === 0 || !features[0].geometry?.coordinates) {
    const error = new Error("住所に該当する座標が見つかりませんでした。") as Error & { code?: string }
    error.code = ErrorCode.GEOCODING_FAILED
    throw error
  }

  return {
    longitude: features[0].geometry.coordinates[0],
    latitude: features[0].geometry.coordinates[1],
    prefecture: municipality.prefecture,
    city: municipality.city,
  }
}
