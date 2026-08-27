/**
 * e-Stat 統計GIS から小地域（町丁・字等）データを取得し、商圏人口集計用の
 * コンパクトなJSONへ前処理する。
 *
 * 実行:
 *   node scripts/build-small-area-data.mjs            … 全都道府県
 *   node scripts/build-small-area-data.mjs 16 17      … 指定県のみ
 *
 * 出力: data/small-area/<prefCode>.json.gz（gzip圧縮。47県で約7MB）
 *
 * ── なぜダウンロードなのか ──
 * e-Stat の統計表API(getStatsData)は市区町村が最小粒度で、小地域・メッシュの
 * 統計表は1件も登録されていない。統計GIS用のAPIエンドポイントも存在しない
 * （getSimpleFeature 系は全て404）。細かいデータは統計GISのファイル
 * ダウンロードでのみ提供されるため、ここで取得して前処理する。
 * 更新は国勢調査に合わせて5年に1回（令和7年分は2027〜2028年公開見込み）。
 *
 * ── Shapefileを解析していない理由 ──
 * 小地域境界の .dbf に X_CODE(経度) / Y_CODE(緯度) = 代表点座標 と
 * AREA(m²) が含まれているため、.shp のポリゴン解析は不要。
 */
import fs from "node:fs"
import zlib from "node:zlib"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"
import os from "node:os"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const OUT_DIR = path.join(ROOT, "data", "small-area")

/** 令和2年国勢調査 小地域 境界データ（Shapefile一式のZIP） */
const BOUNDARY_URL = (pref) =>
  `https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=${pref}&coordSys=1&format=shape&downloadType=5&datum=2000`
/** 令和2年国勢調査 小地域 年齢(5歳階級)別・男女別人口 */
const STATS_URL = (pref) =>
  `https://www.e-stat.go.jp/gis/statmap-search/data?statsId=T001082&code=${pref}&downloadType=2`

/** HCODE=8101 が通常の町丁・字等。水面調査区(8154)等は人口を持たないため除外する。 */
const HCODE_NORMAL = "8101"

const sjis = (buf) => new TextDecoder("shift_jis").decode(buf)
/** 全角数字→半角 */
const toHalf = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
  if (!res.ok) throw new Error(`ダウンロード失敗 HTTP ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  // e-Stat は該当データが無い場合もHTMLを200で返すことがあるためZIPシグネチャを確認する
  if (buf.subarray(0, 2).toString() !== "PK") {
    throw new Error(`ZIPではない応答（${buf.length} bytes）: ${url}`)
  }
  fs.writeFileSync(dest, buf)
  return buf.length
}

function unzip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true })
  execFileSync("unzip", ["-o", "-q", zipPath, "-d", destDir])
  return fs.readdirSync(destDir)
}

/**
 * dBase III (.dbf) を読む。境界Shapefileの属性テーブル用の最小実装。
 * ヘッダ: 4-7=レコード数, 8-9=ヘッダ長, 10-11=レコード長。
 * フィールド定義は32バイト目から32バイト単位、0x0D で終端。
 * 各レコードの先頭1バイトは削除フラグ。
 */
function readDbf(buf) {
  const numRecords = buf.readUInt32LE(4)
  const headerLength = buf.readUInt16LE(8)
  const recordLength = buf.readUInt16LE(10)

  const fields = []
  let offset = 0
  for (let o = 32; buf[o] !== 0x0d; o += 32) {
    const name = sjis(buf.subarray(o, o + 11)).replace(/\0.*/, "")
    const length = buf[o + 16]
    fields.push({ name, start: offset, length })
    offset += length
  }

  const rows = []
  for (let i = 0; i < numRecords; i += 1) {
    const base = headerLength + i * recordLength + 1
    const row = {}
    for (const f of fields) row[f.name] = sjis(buf.subarray(base + f.start, base + f.start + f.length)).trim()
    rows.push(row)
  }
  return rows
}

/**
 * 小地域統計CSV(Shift_JIS)を読む。
 * 0行目=列コード(KEY_CODE,…,T001082001,…), 1行目=項目名, 2行目以降=データ。
 */
function readStatsCsv(buf) {
  const lines = sjis(buf).split(/\r?\n/)
  const names = lines[1].split(",")

  // 「男２０～２４歳」「女２０～２４歳」の列位置を拾う。総数は男+女で復元できるため保持しない。
  //
  // 注意: この統計表には5歳階級に加えて「１５歳未満」「１５～６４歳」「６５歳以上」「７５歳以上」
  // という集計列が混在している。これらを階級として拾うと二重計上になるため除外する。
  // 5歳階級は 0～4 … 70～74 までで、それ以降は「75歳以上」のみが提供される
  // （70～74 と 75歳以上 は重複しないので、この2つを併せると全年齢を過不足なく覆える）。
  const TOP_OPEN_BUCKET = 75
  const ageCols = []
  for (let i = 0; i < names.length; i += 1) {
    const label = toHalf(names[i].trim())
    const range = label.match(/^(男|女)(\d+)～(\d+)歳$/)
    if (range) {
      const from = +range[2]
      const to = +range[3]
      if (to - from !== 4) continue // 「１５～６４歳」等の集計列を除外
      ageCols.push({ index: i, sex: range[1], from, to, label: `${from}～${to}歳` })
      continue
    }
    const open = label.match(/^(男|女)(\d+)歳以上$/)
    if (open && +open[2] === TOP_OPEN_BUCKET) {
      ageCols.push({ index: i, sex: open[1], from: TOP_OPEN_BUCKET, to: null, label: `${TOP_OPEN_BUCKET}歳以上` })
    }
  }

  // 階級の並び（男の出現順）を正とする
  const buckets = ageCols.filter((c) => c.sex === "男").map((c) => ({ label: c.label, from: c.from, to: c.to }))
  const maleIdx = buckets.map((b) => ageCols.find((c) => c.sex === "男" && c.label === b.label).index)
  const femaleIdx = buckets.map((b) => ageCols.find((c) => c.sex === "女" && c.label === b.label)?.index ?? -1)

  const byKey = new Map()
  for (let r = 2; r < lines.length; r += 1) {
    const cols = lines[r].split(",")
    const key = (cols[0] || "").trim()
    // 5桁は市区町村計。9桁以上の町丁字のみを対象にする（二重計上を避ける）
    if (key.length < 9) continue
    const num = (i) => {
      const v = parseInt(cols[i], 10)
      return Number.isFinite(v) ? v : 0 // 秘匿値「*」は0扱い
    }
    byKey.set(key, {
      male: maleIdx.map(num),
      female: femaleIdx.map((i) => (i >= 0 ? num(i) : 0)),
    })
  }
  return { buckets, byKey }
}

async function buildPrefecture(pref, tmpRoot) {
  const tmp = path.join(tmpRoot, pref)
  fs.mkdirSync(tmp, { recursive: true })

  const bndZip = path.join(tmp, "boundary.zip")
  const stZip = path.join(tmp, "stats.zip")
  await download(BOUNDARY_URL(pref), bndZip)
  await download(STATS_URL(pref), stZip)

  const bndDir = path.join(tmp, "bnd")
  const stDir = path.join(tmp, "st")
  unzip(bndZip, bndDir)
  unzip(stZip, stDir)

  const dbfName = fs.readdirSync(bndDir).find((f) => /\.dbf$/i.test(f))
  if (!dbfName) throw new Error(`${pref}: .dbf が見つかりません`)
  const rows = readDbf(fs.readFileSync(path.join(bndDir, dbfName)))

  const csvName = fs.readdirSync(stDir).find((f) => /\.(txt|csv)$/i.test(f))
  if (!csvName) throw new Error(`${pref}: 統計CSVが見つかりません`)
  const { buckets, byKey } = readStatsCsv(fs.readFileSync(path.join(stDir, csvName)))

  // 列指向で持つ。都道府県あたり数千件になるためオブジェクト配列よりJSONが小さい。
  const keys = []
  const names = []
  const lat = []
  const lng = []
  const area = []
  const male = []
  const female = []
  let prefName = ""
  let skippedNoStats = 0

  // 飛び地のある町丁字は同一 KEY_CODE で複数レコードに分割されている。
  // そのまま並べると人口を多重計上するため KEY_CODE で集約する。
  // 面積は合算し、代表点は AREA_MAX_F='1'（最大面積のポリゴン）のものを採用する。
  const merged = new Map()
  for (const row of rows) {
    if (row.HCODE !== HCODE_NORMAL) continue
    const key = row.KEY_CODE
    const x = parseFloat(row.X_CODE)
    const y = parseFloat(row.Y_CODE)
    if (!key || !Number.isFinite(x) || !Number.isFinite(y)) continue
    const a = parseFloat(row.AREA) || 0

    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, { row, lat: y, lng: x, area: a, best: row.AREA_MAX_F === "1" ? a : -1 })
      continue
    }
    prev.area += a
    // AREA_MAX_F が立っているレコード、無ければ最大面積のレコードを代表点にする
    const score = row.AREA_MAX_F === "1" ? a : -1
    if (score > prev.best || (prev.best < 0 && a > prev.area - a)) {
      prev.lat = y
      prev.lng = x
      prev.best = score
    }
  }

  for (const [key, m] of merged) {
    const stat = byKey.get(key)
    if (!stat) {
      skippedNoStats += 1
      continue
    }
    prefName ||= m.row.PREF_NAME
    keys.push(key)
    names.push(`${m.row.CITY_NAME}${m.row.S_NAME}`)
    lat.push(Math.round(m.lat * 1e6) / 1e6)
    lng.push(Math.round(m.lng * 1e6) / 1e6)
    area.push(Math.round(m.area))
    male.push(stat.male)
    female.push(stat.female)
  }

  const payload = {
    prefCode: pref,
    prefName,
    surveyYear: 2020,
    source: "令和2年国勢調査 小地域（町丁・字等別）年齢別・男女別人口 / 境界データ（e-Stat 統計GIS）",
    buckets,
    keys,
    names,
    lat,
    lng,
    area,
    male,
    female,
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, `${pref}.json.gz`)
  fs.writeFileSync(outPath, zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 }))
  fs.rmSync(tmp, { recursive: true, force: true })

  return { count: keys.length, bytes: fs.statSync(outPath).size, prefName, skippedNoStats }
}

/**
 * 生成済みの県別ファイルから、県ごとの緯度経度バウンディングボックスの索引を作る。
 * 商圏円が県境をまたぐ場合に、どの県のファイルを読めばよいかを判定するために使う。
 */
function buildIndex() {
  const files = fs.readdirSync(OUT_DIR).filter((f) => /^\d{2}\.json\.gz$/.test(f)).sort()
  const prefectures = []
  for (const file of files) {
    const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(OUT_DIR, file))).toString())
    prefectures.push({
      prefCode: data.prefCode,
      prefName: data.prefName,
      areaCount: data.keys.length,
      minLat: Math.min(...data.lat),
      maxLat: Math.max(...data.lat),
      minLng: Math.min(...data.lng),
      maxLng: Math.max(...data.lng),
    })
  }
  const index = { surveyYear: 2020, buckets: null, prefectures }
  // 階級定義は全県共通なので索引側にも持たせておく（集計時に県ファイルを開く前に参照できる）
  if (files.length) {
    const first = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(OUT_DIR, files[0]))).toString())
    index.buckets = first.buckets
  }
  fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2))
  console.log(`\n索引を出力: data/small-area/index.json（${prefectures.length} 県）`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === "--index-only") {
    buildIndex()
    return
  }
  const prefs = args.length ? args.map((a) => String(a).padStart(2, "0")) : Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, "0"))

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "small-area-"))
  let totalBytes = 0
  let failed = 0

  for (const pref of prefs) {
    try {
      const r = await buildPrefecture(pref, tmpRoot)
      totalBytes += r.bytes
      const skip = r.skippedNoStats ? ` (統計なし ${r.skippedNoStats} 件をスキップ)` : ""
      console.log(`✓ ${pref} ${r.prefName.padEnd(5)} 町丁字 ${String(r.count).padStart(5)} 件  ${(r.bytes / 1024).toFixed(0)} KB${skip}`)
    } catch (error) {
      failed += 1
      console.error(`✗ ${pref} 失敗: ${error instanceof Error ? error.message : error}`)
    }
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true })
  console.log(`\n合計 ${(totalBytes / 1024 / 1024).toFixed(1)} MB / 失敗 ${failed} 件`)
  buildIndex()
  if (failed) process.exitCode = 1
}

main()
