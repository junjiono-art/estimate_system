/**
 * 日本標準地域メッシュ (JIS X 0410) ユーティリティ
 * 1次メッシュ (4桁) → 2次メッシュ (6桁) → 3次メッシュ/1kmメッシュ (8桁)
 */

/** ハバーサイン距離 (km) */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

/**
 * 緯度経度 → 8桁の1kmメッシュコード (JIS X 0410 3次メッシュ)
 * 緯度方向: 1次(40'/1.5°) → 2次(5'/12) → 3次(30"/120)
 * 経度方向: 1次(1°) → 2次(7.5'/8) → 3次(45"/80)
 */
export function latLngToMeshCode(lat: number, lng: number): string {
  // 1次メッシュ
  const p = Math.floor(lat * 1.5)
  const u = Math.floor(lng) - 100
  // 2次メッシュ (0-7)
  const q = Math.floor((lat - p / 1.5) * 12)
  const v = Math.floor((lng - (u + 100)) * 8)
  // 3次メッシュ (0-9)
  const r = Math.floor((lat - p / 1.5 - q / 12) * 120)
  const w = Math.floor((lng - (u + 100) - v / 8) * 80)
  return `${p}${String(u).padStart(2, "0")}${q}${v}${r}${w}`
}

/** 8桁メッシュコード → 南西端の緯度経度 */
export function meshCodeToSW(code: string): { lat: number; lng: number } {
  const p = parseInt(code.slice(0, 2), 10)
  const u = parseInt(code.slice(2, 4), 10)
  const q = parseInt(code.slice(4, 5), 10)
  const v = parseInt(code.slice(5, 6), 10)
  const r = parseInt(code.slice(6, 7), 10)
  const w = parseInt(code.slice(7, 8), 10)
  return {
    lat: p / 1.5 + q / 12 + r / 120,
    lng: u + 100 + v / 8 + w / 80,
  }
}

/** 8桁メッシュコード → 中心緯度経度 */
export function meshCodeToCenter(code: string): { lat: number; lng: number } {
  const sw = meshCodeToSW(code)
  return {
    lat: sw.lat + 1 / 240, // 緯度方向の半セル (1/120/2)
    lng: sw.lng + 1 / 160, // 経度方向の半セル (1/80/2)
  }
}

/**
 * 中心点から半径 radiusKm 以内の全1kmメッシュコードを返す
 * メッシュの中心点が圏内にあるものを選択
 */
export function getMeshCodesInRadius(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
): string[] {
  const deltaLat = radiusKm / 111.0
  const deltaLng = radiusKm / (111.0 * Math.cos((centerLat * Math.PI) / 180))

  // 1kmメッシュの格子サイズ
  const LAT_STEP = 1 / 120
  const LNG_STEP = 1 / 80

  // バウンディングボックスのインデックス範囲
  const latIdxStart = Math.floor((centerLat - deltaLat) / LAT_STEP) - 1
  const latIdxEnd = Math.ceil((centerLat + deltaLat) / LAT_STEP) + 1
  const lngIdxStart = Math.floor((centerLng - deltaLng) / LNG_STEP) - 1
  const lngIdxEnd = Math.ceil((centerLng + deltaLng) / LNG_STEP) + 1

  const results = new Set<string>()

  for (let latIdx = latIdxStart; latIdx <= latIdxEnd; latIdx++) {
    const cellLat = (latIdx + 0.5) * LAT_STEP
    for (let lngIdx = lngIdxStart; lngIdx <= lngIdxEnd; lngIdx++) {
      const cellLng = (lngIdx + 0.5) * LNG_STEP
      const dist = haversineKm(centerLat, centerLng, cellLat, cellLng)
      if (dist <= radiusKm) {
        results.add(latLngToMeshCode(cellLat, cellLng))
      }
    }
  }

  return Array.from(results)
}
