"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Store } from "@/lib/types"

const GSI_ATTRIBUTION = '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
// 日本の中心付近（店舗が無いときの初期表示）
const JAPAN_CENTER: [number, number] = [36.2048, 138.2529]

const storeIcon = L.divIcon({
  className: "",
  html:
    '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);' +
    'background:oklch(0.55 0.20 25);border:2px solid white;box-shadow:0 0 0 1px oklch(0 0 0 / 0.3)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
})

// 店舗群に合わせて地図の表示範囲を調整する。
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
  }, [points, map])
  return null
}

export default function StoresMap({ stores }: { stores: Store[] }) {
  const valid = useMemo(
    () => stores.filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)),
    [stores],
  )
  const points = useMemo<[number, number][]>(() => valid.map((s) => [s.latitude, s.longitude]), [valid])
  const center = points[0] ?? JAPAN_CENTER

  return (
    <div className="isolate overflow-hidden rounded-lg border border-border">
      <MapContainer center={center} zoom={points.length ? 12 : 5} scrollWheelZoom={false} style={{ height: 480, width: "100%" }}>
        <TileLayer url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png" attribution={GSI_ATTRIBUTION} />
        <FitBounds points={points} />
        {valid.map((s) => (
          <Marker key={s.id} position={[s.latitude, s.longitude]} icon={storeIcon}>
            <Popup>
              <span className="font-medium">{s.name}</span>
              <br />
              {s.address}
              {s.openedAt ? (
                <>
                  <br />
                  出店日: {s.openedAt}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
