type Municipality = {
  prefecture: string
  city: string
}

export type GeocodingResult = {
  latitude: number
  longitude: number
  normalizedAddress: string
  prefecture: string
  city: string
}

function normalizeAddress(input: string): string {
  return input
    .replace(/\s+/g, "")
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 65248))
}

export function extractMunicipality(address: string): Municipality | null {
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
  const normalizedAddress = normalizeAddress(address)
  const municipality = extractMunicipality(normalizedAddress)

  if (!municipality) {
    throw new Error("住所から都道府県・市区町村を判定できませんでした。")
  }

  const endpoint = "https://msearch.gsi.go.jp/address-search/AddressSearch?q="
  const response = await fetch(endpoint + encodeURIComponent(normalizedAddress), {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("ジオコーディングAPIへの接続に失敗しました。")
  }

  const features = (await response.json()) as Array<{
    geometry?: { coordinates?: [number, number] }
  }>

  if (!Array.isArray(features) || features.length === 0) {
    throw new Error("住所に該当する座標が見つかりませんでした。")
  }

  const first = features[0]
  const coordinates = first.geometry?.coordinates
  if (!coordinates || coordinates.length < 2) {
    throw new Error("ジオコーディング結果が不正です。")
  }

  return {
    longitude: coordinates[0],
    latitude: coordinates[1],
    normalizedAddress,
    prefecture: municipality.prefecture,
    city: municipality.city,
  }
}
