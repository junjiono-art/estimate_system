"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapPinIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { haversineDistanceKm } from "@/lib/geospatial"
import type { Store } from "@/lib/types"

type GeoResult = {
  latitude: number
  longitude: number
  prefecture: string
  normalizedAddress: string
}

type NearbyStore = Store & { distanceKm: number }

// 地図の種類（国土地理院タイル）
const TILE_TYPES = {
  std: { label: "標準", url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png" },
  pale: { label: "淡色", url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png" },
  photo: { label: "写真", url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg" },
} as const
type TileType = keyof typeof TILE_TYPES
const GSI_ATTRIBUTION = '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'

// 高さ・初期ズームのプリセット
const HEIGHTS = { 小: 280, 中: 380, 大: 560 } as const
type HeightKey = keyof typeof HEIGHTS
const ZOOMS = { 広域: 11, 標準: 13, 詳細: 15 } as const
type ZoomKey = keyof typeof ZOOMS

// 商圏円（半径km・色）。人口分析と同じ 1/3/5km に揃える。色は OKLCH。
const RADII = [
  { km: 1, color: "oklch(0.62 0.20 25)" },
  { km: 3, color: "oklch(0.70 0.15 70)" },
  { km: 5, color: "oklch(0.62 0.13 240)" },
] as const
const NEARBY_RADIUS_KM = RADII[RADII.length - 1].km
// 競合ジム（OSM）の検索半径(km)
const GYM_RADIUS_KM = 3

const storeIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:20px;height:20px;border-radius:50%;background:oklch(0.58 0.22 25);' +
    'border:3px solid white;box-shadow:0 0 0 1px oklch(0 0 0 / 0.35)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const nearbyIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:13px;height:13px;border-radius:50%;background:oklch(0.55 0.10 260);' +
    'border:2px solid white;box-shadow:0 0 0 1px oklch(0 0 0 / 0.3)"></div>',
  iconSize: [13, 13],
  iconAnchor: [6, 6],
})

// 競合ジム（OSM）。自社店舗と区別するため菱形（45度回転）にする。
const gymIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:12px;height:12px;background:oklch(0.58 0.20 300);' +
    'border:2px solid white;box-shadow:0 0 0 1px oklch(0 0 0 / 0.3);transform:rotate(45deg)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

type GymPoi = {
  id: string
  name: string
  latitude: number
  longitude: number
}

// セグメント切替ボタン
function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded border px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

export default function StoreMap({ address, prefecture }: { address?: string; prefecture?: string }) {
  const [geo, setGeo] = useState<GeoResult | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // 表示コントロール
  const [tileType, setTileType] = useState<TileType>("std")
  const [heightKey, setHeightKey] = useState<HeightKey>("中")
  const [zoomKey, setZoomKey] = useState<ZoomKey>("標準")
  const [showRadii, setShowRadii] = useState(true)
  const [showNearby, setShowNearby] = useState(true)
  const [showGyms, setShowGyms] = useState(true)

  // 競合ジム（OSM Overpass）
  const [gyms, setGyms] = useState<GymPoi[]>([])
  const [gymsLoading, setGymsLoading] = useState(false)

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

  // 競合ジムの取得（地図表示をブロックしないよう座標確定後に別途取得）
  useEffect(() => {
    if (!geo) {
      setGyms([])
      return
    }
    const controller = new AbortController()
    setGymsLoading(true)
    void (async () => {
      try {
        const res = await fetch("/api/nearby-gyms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: geo.latitude, longitude: geo.longitude, radiusKm: GYM_RADIUS_KM }),
          signal: controller.signal,
        })
        const payload = await res.json().catch(() => null)
        if (!controller.signal.aborted && res.ok && Array.isArray(payload?.gyms)) {
          setGyms(payload.gyms as GymPoi[])
        }
      } catch {
        // 競合ジムは取得失敗しても地図表示は継続する
      } finally {
        if (!controller.signal.aborted) setGymsLoading(false)
      }
    })()
    return () => controller.abort()
  }, [geo])

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
  const heightPx = HEIGHTS[heightKey]
  const zoom = ZOOMS[zoomKey]

  return (
    <div className="flex flex-col gap-2">
      {/* 表示コントロール */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">地図</span>
          {(Object.keys(TILE_TYPES) as TileType[]).map((t) => (
            <SegButton key={t} active={tileType === t} onClick={() => setTileType(t)}>
              {TILE_TYPES[t].label}
            </SegButton>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">高さ</span>
          {(Object.keys(HEIGHTS) as HeightKey[]).map((h) => (
            <SegButton key={h} active={heightKey === h} onClick={() => setHeightKey(h)}>
              {h}
            </SegButton>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">ズーム</span>
          {(Object.keys(ZOOMS) as ZoomKey[]).map((z) => (
            <SegButton key={z} active={zoomKey === z} onClick={() => setZoomKey(z)}>
              {z}
            </SegButton>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1">
            <input type="checkbox" className="size-3.5 accent-primary" checked={showRadii} onChange={(e) => setShowRadii(e.target.checked)} />
            商圏円
          </label>
          <label className="flex cursor-pointer items-center gap-1">
            <input type="checkbox" className="size-3.5 accent-primary" checked={showNearby} onChange={(e) => setShowNearby(e.target.checked)} />
            近隣店舗
          </label>
          <label className="flex cursor-pointer items-center gap-1">
            <input type="checkbox" className="size-3.5 accent-primary" checked={showGyms} onChange={(e) => setShowGyms(e.target.checked)} />
            近隣ジム{gymsLoading ? "（検索中…）" : ""}
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <MapContainer
          key={`${center[0]},${center[1]}-${heightPx}-${zoom}`}
          center={center}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ height: heightPx, width: "100%" }}
        >
          <TileLayer key={tileType} url={TILE_TYPES[tileType].url} attribution={GSI_ATTRIBUTION} />

          {showRadii &&
            [...RADII].reverse().map((r) => (
              <Circle
                key={r.km}
                center={center}
                radius={r.km * 1000}
                pathOptions={{ color: r.color, weight: 1.5, fillColor: r.color, fillOpacity: 0.05 }}
              />
            ))}

          {showNearby &&
            nearby.map((s) => (
              <Marker key={s.id} position={[s.latitude, s.longitude]} icon={nearbyIcon}>
                <Popup>
                  <span className="font-medium">{s.name}</span>
                  <br />
                  {s.distanceKm.toFixed(2)} km / {s.address}
                </Popup>
              </Marker>
            ))}

          {showGyms &&
            gyms.map((g) => (
              <Marker key={g.id} position={[g.latitude, g.longitude]} icon={gymIcon}>
                <Popup>
                  <span className="font-medium">{g.name}</span>
                  <br />
                  競合ジム（OSM）
                </Popup>
              </Marker>
            ))}

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
        {showNearby && (
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: "oklch(0.55 0.10 260)" }} />
            既存店舗（{NEARBY_RADIUS_KM}km圏 {nearby.length}件）
          </span>
        )}
        {showGyms && (
          <span className="flex items-center gap-1">
            <span className="size-2.5 rotate-45" style={{ background: "oklch(0.58 0.20 300)" }} />
            競合ジム（{GYM_RADIUS_KM}km圏 {gyms.length}件・OSM）
          </span>
        )}
        {showRadii &&
          RADII.map((r) => (
            <span key={r.km} className="flex items-center gap-1">
              <span className="size-2.5 rounded-full border" style={{ borderColor: r.color }} />
              半径{r.km}km
            </span>
          ))}
      </div>
    </div>
  )
}
