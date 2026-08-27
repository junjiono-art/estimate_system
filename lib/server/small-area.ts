/**
 * 小地域（町丁・字等）データを用いた商圏人口の集計。
 *
 * 元Excel「入力欄」E47:G54 は、jSTAT MAP 等の地図画面で半径1km/3km/5kmの円内人口を
 * 目視して転記した値であり、E55:G55（20〜59歳人口の累計）だけが下流の計算で使われる。
 * ここではその「円で切って合算する」処理をサーバ側で再現する。
 *
 * データは scripts/build-small-area-data.mjs が生成する data/small-area/<pref>.json.gz。
 * 各町丁字は代表点（境界データの X_CODE/Y_CODE）と面積（AREA, m²）を持つ。
 *
 * ── 面積按分近似について ──
 * 「代表点が円内か」だけで判定すると、円が小さいほど誤差が大きくなる
 * （富山の実測で 5km圏 99.3% に対し 1km圏は 81.3% しか拾えない）。
 * そこで各町丁字を「同じ面積を持つ円」とみなし、商圏円との重なり面積の比率で
 * 人口を按分する。これにより 1km圏が 90.1%、3km圏が 99.2% まで改善する。
 * 厳密な多角形クリッピングには及ばないが、境界ポリゴンの解析を必要としない。
 */
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

/** 年齢階級の定義（0〜4歳 … 70〜74歳 / 75歳以上）。to が null なら開いた最上位階級。 */
export interface AgeBucket {
  label: string
  from: number
  to: number | null
}

interface PrefectureData {
  prefCode: string
  prefName: string
  surveyYear: number
  source: string
  buckets: AgeBucket[]
  keys: string[]
  names: string[]
  lat: number[]
  lng: number[]
  area: number[]
  male: number[][]
  female: number[][]
}

interface SmallAreaIndex {
  surveyYear: number
  buckets: AgeBucket[]
  prefectures: Array<{
    prefCode: string
    prefName: string
    areaCount: number
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  }>
}

export interface AgeSexRow {
  label: string
  from: number
  to: number | null
  male: number
  female: number
  total: number
}

export interface SmallAreaPopulationResult {
  /** リング差分。元Excel E56/F56/G56 に対応し、calc-engine の populationByRadius と同じ形。 */
  km1Ring: number
  km3Ring: number
  km5Ring: number
  /** 半径ごとの累計（元Excel E55/F55/G55）。フォームの初期値に使う。 */
  cumulative: { km1: number; km3: number; km5: number }
  /** 5km圏の男女・5歳階級別内訳 */
  byAgeSex: AgeSexRow[]
  /** 各圏に寄与した町丁字の数（重なり比 > 0 のもの） */
  areaCount: { km1: number; km3: number; km5: number }
  prefecturesUsed: Array<{ prefCode: string; prefName: string }>
  surveyYear: number
  source: string
}

const DATA_DIR = path.join(process.cwd(), "data", "small-area")
const EARTH_RADIUS_KM = 6371
/** 元Excelが対象とする年齢帯。20〜59歳（5歳階級の from が 20〜55 のもの）。 */
const TARGET_AGE_MIN = 20
const TARGET_AGE_MAX = 59

const prefectureCache = new Map<string, PrefectureData>()
let indexCache: SmallAreaIndex | null = null

function loadIndex(): SmallAreaIndex {
  if (indexCache) return indexCache
  const file = path.join(DATA_DIR, "index.json")
  if (!fs.existsSync(file)) {
    throw new Error(
      "SMALL_AREA_DATA_MISSING: 小地域データの索引が見つかりません。`node scripts/build-small-area-data.mjs` を実行してください。",
    )
  }
  indexCache = JSON.parse(fs.readFileSync(file, "utf8")) as SmallAreaIndex
  return indexCache
}

function loadPrefecture(prefCode: string): PrefectureData | null {
  const cached = prefectureCache.get(prefCode)
  if (cached) return cached
  const file = path.join(DATA_DIR, `${prefCode}.json.gz`)
  if (!fs.existsSync(file)) return null
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()) as PrefectureData
  prefectureCache.set(prefCode, data)
  return data
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a))
}

/**
 * 中心間距離 d の2円（商圏半径 r、町丁字の等価半径 er）の重なり面積が、
 * 町丁字側の面積に占める割合。人口はこの割合で按分する。
 */
function overlapRatio(d: number, r: number, er: number): number {
  if (er <= 0) return d <= r ? 1 : 0
  if (d >= r + er) return 0
  if (d <= Math.abs(r - er)) {
    // 一方が他方を完全に含む。町丁字が商圏に飲み込まれていれば全量、逆なら面積比。
    return er <= r ? 1 : (r * r) / (er * er)
  }
  const a1 = Math.acos((d * d + er * er - r * r) / (2 * d * er))
  const a2 = Math.acos((d * d + r * r - er * er) / (2 * d * r))
  const overlap = er * er * (a1 - Math.sin(2 * a1) / 2) + r * r * (a2 - Math.sin(2 * a2) / 2)
  return overlap / (Math.PI * er * er)
}

/** 町丁字の面積(m²)から、同じ面積を持つ円の半径(km)を求める。 */
function equivalentRadiusKm(areaSqMeters: number): number {
  if (!Number.isFinite(areaSqMeters) || areaSqMeters <= 0) return 0
  return Math.sqrt(areaSqMeters / Math.PI) / 1000
}

/** 商圏円が触れる可能性のある都道府県を索引から選ぶ（県境をまたぐ商圏に対応）。 */
function prefecturesNear(latitude: number, longitude: number, radiusKm: number): string[] {
  const index = loadIndex()
  const latMargin = radiusKm / 111
  const lngMargin = radiusKm / (111 * Math.max(0.1, Math.cos((latitude * Math.PI) / 180)))
  return index.prefectures
    .filter(
      (p) =>
        latitude >= p.minLat - latMargin &&
        latitude <= p.maxLat + latMargin &&
        longitude >= p.minLng - lngMargin &&
        longitude <= p.maxLng + lngMargin,
    )
    .map((p) => p.prefCode)
}

/**
 * 指定地点から半径1km/3km/5km圏の男女・年齢別人口を集計する。
 * 返す km1Ring/km3Ring/km5Ring はリング差分（元Excel E56/F56/G56 と同じ定義）。
 */
export function aggregateSmallAreaPopulation(
  latitude: number,
  longitude: number,
  radiiKm: [number, number, number] = [1, 3, 5],
): SmallAreaPopulationResult {
  const index = loadIndex()
  const maxRadius = Math.max(...radiiKm)
  const prefCodes = prefecturesNear(latitude, longitude, maxRadius)

  const buckets = index.buckets
  const targetBucketIdx = buckets
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.from >= TARGET_AGE_MIN && b.from <= TARGET_AGE_MAX - 4)
    .map(({ i }) => i)

  const cumulative = [0, 0, 0]
  const areaCount = [0, 0, 0]
  const maleByBucket = new Array(buckets.length).fill(0)
  const femaleByBucket = new Array(buckets.length).fill(0)
  const prefecturesUsed: Array<{ prefCode: string; prefName: string }> = []

  for (const prefCode of prefCodes) {
    const pref = loadPrefecture(prefCode)
    if (!pref) continue
    let contributed = false

    for (let a = 0; a < pref.keys.length; a += 1) {
      const distance = haversineKm(latitude, longitude, pref.lat[a], pref.lng[a])
      const er = equivalentRadiusKm(pref.area[a])
      // どの半径にも掛からないものは早期に除外する
      if (distance - er > maxRadius) continue

      const male = pref.male[a]
      const female = pref.female[a]

      let target = 0
      for (const b of targetBucketIdx) target += male[b] + female[b]

      for (let r = 0; r < radiiKm.length; r += 1) {
        const ratio = overlapRatio(distance, radiiKm[r], er)
        if (ratio <= 0) continue
        cumulative[r] += target * ratio
        areaCount[r] += 1
        // 男女・階級別の内訳は最大半径（5km圏）についてのみ保持する
        if (r === radiiKm.length - 1) {
          for (let b = 0; b < buckets.length; b += 1) {
            maleByBucket[b] += male[b] * ratio
            femaleByBucket[b] += female[b] * ratio
          }
          contributed = true
        }
      }
    }

    if (contributed) prefecturesUsed.push({ prefCode: pref.prefCode, prefName: pref.prefName })
  }

  const km1 = Math.round(cumulative[0])
  const km3 = Math.round(cumulative[1])
  const km5 = Math.round(cumulative[2])

  return {
    // 累計→リング差分。丸め後に引くことで「リングの合計＝累計」を保つ。
    km1Ring: km1,
    km3Ring: Math.max(0, km3 - km1),
    km5Ring: Math.max(0, km5 - km3),
    cumulative: { km1, km3, km5 },
    byAgeSex: buckets.map((b, i) => {
      const m = Math.round(maleByBucket[i])
      const f = Math.round(femaleByBucket[i])
      return { label: b.label, from: b.from, to: b.to, male: m, female: f, total: m + f }
    }),
    areaCount: { km1: areaCount[0], km3: areaCount[1], km5: areaCount[2] },
    prefecturesUsed,
    surveyYear: index.surveyYear,
    source: "令和2年国勢調査 小地域（町丁・字等別）年齢別・男女別人口（e-Stat 統計GIS）",
  }
}

/** 累計人口（1km/3km/5km）をリング差分へ変換する。フォームの手入力値にも使う。 */
export function cumulativeToRings(km1: number, km3: number, km5: number) {
  return {
    km1Ring: Math.max(0, Math.round(km1)),
    km3Ring: Math.max(0, Math.round(km3) - Math.round(km1)),
    km5Ring: Math.max(0, Math.round(km5) - Math.round(km3)),
  }
}
