"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapPinIcon } from "lucide-react"
import { haversineDistanceKm } from "@/lib/geospatial"
import type { Store } from "@/lib/types"

type GeoResult = {
  latitude: number
  longitude: number
  prefecture: string
  normalizedAddress: string
}

type NearbyStore = Store & { distanceKm: number }

// 商圏円（半径km・色）。人口分析と同じ 1/3/5km に揃える。色は OKLCH。
const RADII = [
  { km: 1, color: "oklch(0.62 0.20 25)" },
  { km: 3, color: "oklch(0.70 0.15 70)" },
  { km: 5, color: "oklch(0.62 0.13 240)" },
] as const

// 近隣店舗を含める最大半径（km）。最大商圏円に合わせる。
const NEARBY_RADIUS_KM = RADII[RADII.length - 1].km

// 出店地点のマーカー（強調した丸ピン）
const storeIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:20px;height:20px;border-radius:50%;background:oklch(0.58 0.22 25);' +
    'border:3px solid white;box-shadow:0 0 0 1px oklch(0 0 0 / 0.35)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// 近隣の既存店舗マーカー（小さめの丸）
const nearbyIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:13px;height:13px;border-radius:50%;background:oklch(0.55 0.10 260);' +
    'border:2px solid white;box-shadow:0 0 0 1px oklch(0 0 0 / 0.3)"></div>',
  iconSize: [13, 13],
  iconAnchor: [6, 6],
})

export default function StoreMap({ address, prefecture }: { address?: string; prefecture?: string }) {
  const [geo, setGeo] = useState<GeoResult | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const trimmedAddress = address?.trim() ?? ""

  useEffect(() => {
    if (!trimmedAddress) {
      setGeo(null)
      setStores([])
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError("")

    async function load() {
      try {
        // 住所 → 緯度経度（国土地理院ジオコーディング）
        const geoRes = await fetch("/api/geocoding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: trimmedAddress }),
          signal: controller.signal,
        })
        const geoPayload = await geoRes.json().catch(() => null)
        if (!geoRes.ok) {
          throw new Error(geoPayload?.error?.message ?? "住所の座標変換に失敗しました。")
        }
        const resolvedGeo: GeoResult = {
          latitude: Number(geoPayload.latitude),
          longitude: Number(geoPayload.longitude),
          prefecture: String(geoPayload.prefecture ?? ""),
          normalizedAddress: String(geoPayload.normalizedAddress ?? trimmedAddress),
        }
        if (controller.signal.aborted) return
        setGeo(resolvedGeo)

        // 同一都道府県の既存店舗を取得（座標付き）。距離フィルタはクライアント側で行う。
        const pref = (prefecture?.trim() || resolvedGeo.prefecture).trim()
        if (pref) {
          const storesRes = await fetch(`/api/stores?prefecture=${encodeURIComponent(pref)}`, {
            cache: "no-store",
            signal: controller.signal,
          })
          const storesPayload = await storesRes.json().catch(() => null)
          if (!controller.signal.aborted && storesRes.ok && Array.isArray(storesPayload?.stores)) {
            setStores(storesPayload.stores as Store[])
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "地図の表示に失敗しました。")
        setGeo(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [trimmedAddress, prefecture])

  const nearby = useMemo<NearbyStore[]>(() => {
    if (!geo) return []
    return stores
      .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map((s) => ({
        ...s,
        distanceKm: haversineDistanceKm(
          { latitude: geo.latitude, longitude: geo.longitude },
          { latitude: s.latitude, longitude: s.longitude },
        ),
      }))
      .filter((s) => s.distanceKm <= NEARBY_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [geo, stores])

  if (!trimmedAddress) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-6 text-xs text-muted-foreground">
        <MapPinIcon className="size-4 shrink-0" />
        住所が未入力のため地図を表示できません。試算フォームの「住所」を入力してください。
      </div>
    )
  }

  if (loading && !geo) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-6 text-xs text-muted-foreground">
        <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
        地図を読み込み中...
      </div>
    )
  }

  if (error || !geo) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-xs text-destructive">
        {error || "住所に該当する座標が見つかりませんでした。"}
      </div>
    )
  }

  const center: [number, number] = [geo.latitude, geo.longitude]

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border border-border">
        <MapContainer
          key={`${center[0]},${center[1]}`}
          center={center}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: 380, width: "100%" }}
        >
          <TileLayer
            url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
          />

          {/* 商圏円（大きい順に描画して重なりを見やすく） */}
          {[...RADII].reverse().map((r) => (
            <Circle
              key={r.km}
              center={center}
              radius={r.km * 1000}
              pathOptions={{ color: r.color, weight: 1.5, fillColor: r.color, fillOpacity: 0.05 }}
            />
          ))}

          {/* 近隣の既存店舗 */}
          {nearby.map((s) => (
            <Marker key={s.id} position={[s.latitude, s.longitude]} icon={nearbyIcon}>
              <Popup>
                <span className="font-medium">{s.name}</span>
                <br />
                {s.distanceKm.toFixed(2)} km / {s.address}
              </Popup>
            </Marker>
          ))}

          {/* 出店地点 */}
          <Marker position={center} icon={storeIcon}>
            <Popup>
              <span className="font-medium">出店地点</span>
              <br />
              {geo.normalizedAddress}
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full" style={{ background: "oklch(0.58 0.22 25)" }} />
          出店地点
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full" style={{ background: "oklch(0.55 0.10 260)" }} />
          既存店舗（{NEARBY_RADIUS_KM}km圏 {nearby.length}件）
        </span>
        {RADII.map((r) => (
          <span key={r.km} className="flex items-center gap-1">
            <span className="size-2.5 rounded-full border" style={{ borderColor: r.color }} />
            半径{r.km}km
          </span>
        ))}
      </div>
    </div>
  )
}
