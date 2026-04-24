import { NextResponse } from "next/server"
import { getMeshCodesInRadius, haversineKm, meshCodeToCenter } from "@/lib/server/mesh-utils"

type EStatValue = {
  "@area"?: string
  "$"?: string | number
  [key: string]: string | number | undefined
}

type EStatClassObject = {
  "@id"?: string
  "@name"?: string
  CLASS?: { "@code"?: string; "@name"?: string } | { "@code"?: string; "@name"?: string }[]
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function toNumber(value: string | number | undefined): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

/** 年齢グループ名が20〜59歳に該当するか判定 */
function isAge2059(ageName: string): boolean {
  const match = ageName.match(/(\d+)/)
  if (!match) return false
  const age = parseInt(match[1], 10)
  return age >= 20 && age <= 59
}

/**
 * メッシュ統計の e-Stat API を呼び出し、指定メッシュの20〜59歳人口を取得する
 * statsDataId は ESTAT_MESH_STATS_DATA_ID 環境変数で指定
 * 例: 令和2年国勢調査 1kmメッシュ (statsDataId は e-Stat カタログで確認してください)
 */
async function fetchMeshAgePopulation(
  meshCodes: string[],
  appId: string,
  statsDataId: string,
): Promise<Map<string, number>> {
  if (meshCodes.length === 0) return new Map()

  // e-Stat は cdArea に最大100件程度のコンマ区切りを受け付ける
  // 70件程度の5km圏内メッシュは1リクエストで取得可能
  const params = new URLSearchParams({
    appId,
    statsDataId,
    cdArea: meshCodes.join(","),
    metaGetFlg: "Y",
    cntGetFlg: "N",
    sectionHeaderFlg: "1",
    lang: "J",
  })

  const endpoint = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?${params.toString()}`
  const response = await fetch(endpoint, { cache: "no-store" })
  if (!response.ok) throw new Error(`e-Stat メッシュAPI呼び出し失敗: HTTP ${response.status}`)

  const payload = await response.json()
  const statisticalData = payload?.GET_STATS_DATA?.STATISTICAL_DATA
  const values = asArray<EStatValue>(statisticalData?.DATA_INF?.VALUE)
  if (!values.length) return new Map()

  const classObjects = asArray<EStatClassObject>(statisticalData?.CLASS_INF?.CLASS_OBJ)

  // 年齢分類軸を特定
  const ageClassObj = classObjects.find((obj) => /年齢/.test(obj?.["@name"] || ""))
  const ageClassId = ageClassObj?.["@id"]
  const areaClassId = classObjects.find((obj) => /地域|メッシュ/.test(obj?.["@name"] || ""))?.["@id"] ?? "area"

  // 性別「総数」の分類コードを特定
  const sexClassObj = classObjects.find((obj) => /(男女|性別)/.test(obj?.["@name"] || ""))
  const sexClassId = sexClassObj?.["@id"]
  const sexClasses = asArray<{ "@code"?: string; "@name"?: string }>(sexClassObj?.CLASS)
  const totalSexCode = sexClasses.find((c) => /(総数|計)/.test(c?.["@name"] || ""))?.[
    "@code"
  ]

  // 年齢コード → 年齢名マップ
  const ageClasses = asArray<{ "@code"?: string; "@name"?: string }>(ageClassObj?.CLASS)
  const ageCodeToName = new Map(ageClasses.map((c) => [c["@code"], c["@name"] ?? ""]))

  const meshPopMap = new Map<string, number>()

  for (const row of values) {
    // 性別フィルタ（総数のみ）
    if (sexClassId && totalSexCode) {
      const sexCode = String(row[`@${sexClassId}`] ?? "")
      if (sexCode !== totalSexCode) continue
    }

    // 年齢フィルタ（20〜59歳のみ）
    if (ageClassId) {
      const ageCode = String(row[`@${ageClassId}`] ?? "")
      const ageName = ageCodeToName.get(ageCode) ?? ""
      if (!isAge2059(ageName)) continue
    }

    // メッシュコードと人口
    const meshCode = String(row[`@${areaClassId}`] ?? row["@area"] ?? "")
    const pop = toNumber(row["$"])
    if (meshCode && pop > 0) {
      meshPopMap.set(meshCode, (meshPopMap.get(meshCode) ?? 0) + pop)
    }
  }

  return meshPopMap
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    latitude?: number
    longitude?: number
  } | null

  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "latitude と longitude は必須です。" }, { status: 400 })
  }

  const appId = process.env.ESTAT_APP_ID
  if (!appId) {
    return NextResponse.json({ error: "ESTAT_APP_ID が未設定です。" }, { status: 500 })
  }

  const statsDataId = process.env.ESTAT_MESH_STATS_DATA_ID
  if (!statsDataId) {
    return NextResponse.json(
      { error: "ESTAT_MESH_STATS_DATA_ID が未設定です。.env.local にメッシュ統計の statsDataId を設定してください。" },
      { status: 500 },
    )
  }

  // 5km圏内の全メッシュコードを取得（1km/3km/5kmリングに分類）
  const codes5km = getMeshCodesInRadius(latitude, longitude, 5)
  const codes3km = new Set(getMeshCodesInRadius(latitude, longitude, 3))
  const codes1km = new Set(getMeshCodesInRadius(latitude, longitude, 1))

  // 距離でリング分類
  const ring1kmCodes: string[] = []
  const ring3kmCodes: string[] = [] // 1km超〜3km以内
  const ring5kmCodes: string[] = [] // 3km超〜5km以内

  for (const code of codes5km) {
    if (codes1km.has(code)) {
      ring1kmCodes.push(code)
    } else if (codes3km.has(code)) {
      ring3kmCodes.push(code)
    } else {
      ring5kmCodes.push(code)
    }
  }

  try {
    const meshPopMap = await fetchMeshAgePopulation(codes5km, appId, statsDataId)

    let km1Ring = 0
    let km3Ring = 0
    let km5Ring = 0

    for (const [code, pop] of meshPopMap.entries()) {
      const center = meshCodeToCenter(code)
      const dist = haversineKm(latitude, longitude, center.lat, center.lng)
      if (dist <= 1) {
        km1Ring += pop
      } else if (dist <= 3) {
        km3Ring += pop
      } else if (dist <= 5) {
        km5Ring += pop
      }
    }

    return NextResponse.json({
      km1Ring,
      km3Ring,
      km5Ring,
      meshCount: {
        km1: ring1kmCodes.length,
        km3: ring3kmCodes.length,
        km5: ring5kmCodes.length,
        total: codes5km.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "メッシュ人口データの取得に失敗しました。",
        km1Ring: 0,
        km3Ring: 0,
        km5Ring: 0,
      },
      { status: 502 },
    )
  }
}
