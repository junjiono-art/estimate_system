import { NextResponse } from "next/server"
import { City } from "jp-city-lookup"
import { Pref } from "jp-pref-lookup"

type EStatClass = {
  "@code"?: string
  "@name"?: string
}

type EStatValue = {
  "@cat01"?: string
  "@cat02"?: string
  "$"?: string | number
  [key: string]: string | number | undefined
}

type EStatClassObject = {
  "@id"?: string
  "@name"?: string
  CLASS?: EStatClass | EStatClass[]
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizeAddress(input: string): string {
  return input.replace(/\s+/g, "").replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 65248))
}

function normalizeName(input: string): string {
  return normalizeAddress(input)
    .replace(/[ヶケ]/g, "ケ")
    .replace(/[ヵカ]/g, "カ")
}

function cityNameCandidates(city: string): string[] {
  const normalized = normalizeName(city)
  const candidates = new Set<string>([normalized])

  const wardOnly = normalized.match(/^.+?市(.+区)$/)
  if (wardOnly?.[1]) candidates.add(wardOnly[1])

  const countyOnly = normalized.match(/^.+郡(.+(?:町|村))$/)
  if (countyOnly?.[1]) candidates.add(countyOnly[1])

  return Array.from(candidates)
}

function cityNameMatches(inputCity: string, codeCityName: string): boolean {
  const codeName = normalizeName(codeCityName)
  const candidates = cityNameCandidates(inputCity)
  return candidates.some((candidate) => candidate === codeName)
}

function resolveAreaCode(prefecture: string, city: string): string | null {
  const prefCode = Pref.code(prefecture) || Pref.code(prefecture.replace(/[都道府県]$/, ""))
  if (!prefCode) return null

  const cityCodes = City.lookup({ pref: prefCode }) || []
  for (const code of cityCodes) {
    const cityName = City.name(code)
    if (!cityName) continue
    if (cityNameMatches(city, cityName)) return code
  }

  return null
}

function extractMunicipality(address: string): { prefecture: string; city: string } | null {
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

function isMale(label: string): boolean {
  return /男/.test(label)
}

function isFemale(label: string): boolean {
  return /女/.test(label)
}

function toNumber(value: string | number | undefined): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function pickDimensionClassId(classObjects: EStatClassObject[], pattern: RegExp): string | null {
  const matched = classObjects.find((obj) => obj?.["@id"]?.startsWith("cat") && pattern.test(obj?.["@name"] || ""))
  return matched?.["@id"] || null
}

function readDimensionCode(row: EStatValue, classId: string): string {
  const key = `@${classId}`
  const value = row[key]
  return typeof value === "string" ? value : ""
}

export async function POST(request: Request) {
  const { address } = (await request.json()) as { address?: string }
  if (!address?.trim()) {
    return NextResponse.json({ error: "住所を入力してください。" }, { status: 400 })
  }

  const municipality = extractMunicipality(address)
  if (!municipality) {
    return NextResponse.json(
      { error: "住所から都道府県・市区町村を判定できませんでした。『東京都渋谷区...』の形式で入力してください。" },
      { status: 400 },
    )
  }

  const areaCode = resolveAreaCode(municipality.prefecture, municipality.city)
  if (!areaCode) {
    return NextResponse.json(
      {
        error: `市区町村コードを解決できませんでした: ${municipality.prefecture}${municipality.city}。住所表記を見直してください。`,
      },
      { status: 400 },
    )
  }

  const appId = process.env.ESTAT_APP_ID
  if (!appId) {
    return NextResponse.json(
      { error: "ESTAT_APP_ID が未設定です。.env.local に e-Stat アプリIDを設定してください。" },
      { status: 500 },
    )
  }

  // 市区町村粒度の男女・年齢（5歳階級）人口に対応する statsDataId を環境変数で切替可能にする
  const statsDataId = process.env.ESTAT_STATS_DATA_ID ?? "0003445162"

  const params = new URLSearchParams({
    appId,
    statsDataId,
    cdArea: areaCode,
    metaGetFlg: "Y",
    cntGetFlg: "N",
    sectionHeaderFlg: "1",
    lang: "J",
  })

  const endpoint = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?${params.toString()}`
  console.info("[e-stat] requestUrl:", endpoint)
  const response = await fetch(endpoint, { cache: "no-store" })

  if (!response.ok) {
    return NextResponse.json({ error: "e-Stat APIへの接続に失敗しました。", requestUrl: endpoint }, { status: 502 })
  }

  const payload = await response.json()
  const result = payload?.GET_STATS_DATA?.RESULT
  const upstreamStatus = Number(result?.STATUS)
  const upstreamMessage = typeof result?.ERROR_MSG === "string" ? result.ERROR_MSG : undefined
  const statisticalData = payload?.GET_STATS_DATA?.STATISTICAL_DATA
  const values = asArray<EStatValue>(statisticalData?.DATA_INF?.VALUE)

  if (!values.length) {
    return NextResponse.json(
      {
        error: "e-Stat APIのレスポンスに統計データがありません。",
        requestUrl: endpoint,
        upstreamStatus,
        upstreamMessage,
      },
      { status: 502 },
    )
  }

  const classObjects = asArray<EStatClassObject>(statisticalData?.CLASS_INF?.CLASS_OBJ)

  const sexClassId = pickDimensionClassId(classObjects, /(男女|性別)/)
  const ageClassId = pickDimensionClassId(classObjects, /年齢/)

  if (!sexClassId || !ageClassId) {
    return NextResponse.json(
      {
        error: "男女・年齢の分類軸を判定できませんでした。ESTAT_STATS_DATA_ID の統計表定義を確認してください。",
        requestUrl: endpoint,
        upstreamStatus,
        upstreamMessage,
      },
      { status: 502 },
    )
  }

  const sexClasses = asArray<EStatClass>(classObjects.find((obj) => obj?.["@id"] === sexClassId)?.CLASS)
  const ageClasses = asArray<EStatClass>(classObjects.find((obj) => obj?.["@id"] === ageClassId)?.CLASS)

  const sexMap = new Map(sexClasses.map((item) => [item["@code"], item["@name"]]))
  const ageMap = new Map(ageClasses.map((item) => [item["@code"], item["@name"]]))

  const fixedDimensionCodes = new Map<string, string>()
  for (const obj of classObjects) {
    const classId = obj?.["@id"]
    if (!classId || !classId.startsWith("cat") || classId === sexClassId || classId === ageClassId) continue

    const classes = asArray<EStatClass>(obj.CLASS)
    const totalClass = classes.find((entry) => /(総数|計)/.test(entry?.["@name"] || ""))
    if (totalClass?.["@code"]) {
      fixedDimensionCodes.set(classId, totalClass["@code"])
    }
  }

  const byAge = new Map<string, { male: number; female: number }>()

  for (const row of values) {
    let shouldSkip = false
    for (const [classId, expectedCode] of fixedDimensionCodes.entries()) {
      if (readDimensionCode(row, classId) !== expectedCode) {
        shouldSkip = true
        break
      }
    }
    if (shouldSkip) continue

    const sexName = sexMap.get(readDimensionCode(row, sexClassId)) || ""
    const ageName = ageMap.get(readDimensionCode(row, ageClassId)) || ""
    const population = toNumber(row["$"])

    if (!ageName || /総数|不詳/.test(ageName)) continue

    const current = byAge.get(ageName) || { male: 0, female: 0 }
    if (isMale(sexName)) current.male += population
    if (isFemale(sexName)) current.female += population
    byAge.set(ageName, current)
  }

  const byAgeGender = Array.from(byAge.entries())
    .map(([ageGroup, value]) => ({
      ageGroup,
      male: value.male,
      female: value.female,
      total: value.male + value.female,
    }))
    .filter((row) => row.total > 0)

  if (!byAgeGender.length) {
    return NextResponse.json(
      {
        error:
          "男女・年齢別データの抽出に失敗しました。ESTAT_STATS_DATA_ID が対象統計（男女・年齢階級）になっているか確認してください。",
        requestUrl: endpoint,
      },
      { status: 502 },
    )
  }

  const bySex = byAgeGender.reduce(
    (acc, row) => {
      acc.male += row.male
      acc.female += row.female
      acc.total += row.total
      return acc
    },
    { male: 0, female: 0, total: 0 },
  )

  return NextResponse.json({
    municipality: {
      ...municipality,
      areaCode,
    },
    bySex,
    byAgeGender,
    source: {
      title: statisticalData?.TABLE_INF?.TITLE || "e-Stat 統計データ",
      statsDataId,
      sexClassId,
      ageClassId,
      requestUrl: endpoint,
      upstreamStatus,
      upstreamMessage,
    },
    lastUpdated: new Date().toISOString(),
  })
}
