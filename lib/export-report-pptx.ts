import type JSZipType from "jszip"
import type { MasterValue, ScenarioType, SimulationRequestInput, SimulationResult } from "@/lib/types"
import { INVESTMENT_COST_CODE_TO_FIELD_ID, RUNNING_COST_CODE_TO_FIELD_ID, resolveMasterValueAmount } from "@/lib/master-value-mapping"
import { SECURITY_CAMERA_RUNNING_FIELD_ID, SECURITY_MONITOR_RUNNING_FIELD_ID } from "@/lib/security-cost"

// 試算レポート（doc/20261002 試算レポート例.pptx 形式）を出力する。クライアント専用。
// 雛形 public/templates/report-template.pptx（scripts/build-report-template.py で生成）の
// {{トークン}} を置換し、表の行複製・グラフデータ更新・地図画像の合成を行う。
// スライド2（店舗写真）・9（広告運用）・10〜12（固定ページ）は雛形のまま出力する。

const TEMPLATE_URL = "/templates/report-template.pptx"
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

/** 財務シミュレーションのスライド番号 → シナリオ（雛形の並び: アグレッシブ / スタンダード / 保守） */
const FINANCE_SLIDES: Array<{ slide: number; scenario: ScenarioType }> = [
  { slide: 6, scenario: "aggressive" },
  { slide: 7, scenario: "standard" },
  { slide: 8, scenario: "conservative" },
]

const GYM_RADIUS_KM = 3
const MAX_CALLOUTS = 6

export interface ReportPptxInput {
  /** 画面に表示中の試算結果（表紙・投資/運営コスト・人口に使用） */
  current: SimulationResult
  /** 3シナリオの試算結果（財務シミュレーション3枚に使用） */
  scenarios: Record<ScenarioType, SimulationResult>
  request?: SimulationRequestInput | null
  masterValues?: MasterValue[] | null
  /** 近隣ジムを手動選択している場合の選択ID（未指定なら検索結果すべてが対象） */
  selectedGymIds?: ReadonlySet<string> | null
}

// ── 書式 ──────────────────────────────────────────────

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)
const comma = (n: number) => Math.round(n).toLocaleString("ja-JP")
/** 金額。負数は会計表記の括弧（例: (¥787,563)） */
const yen = (n?: number) => (finite(n) ? (n < 0 ? `(¥${comma(-n)})` : `¥${comma(n)}`) : "—")
const pct = (ratio?: number) => (finite(ratio) ? `${Math.round(ratio * 100)}%` : "-")
/** 万円表記（小数1桁、末尾の .0 は省略） */
const man = (n?: number) => (finite(n) ? String(Math.round(n / 1000) / 10) : "—")
const trimDecimal = (n: number, digits = 2) => String(Math.round(n * 10 ** digits) / 10 ** digits)

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// ── XML操作 ────────────────────────────────────────────

/** {{key}} を値で置換する。値は XML エスケープする。 */
function fillTokens(xml: string, values: Record<string, string>): string {
  return xml.replace(/\{\{([\w.]+)\}\}/g, (whole, key: string) => (key in values ? escapeXml(values[key]) : whole))
}

/** 置換漏れのトークンを「—」にする（雛形と実装の不整合で {{...}} が残らないようにする安全網） */
function clearLeftoverTokens(xml: string): string {
  return xml.replace(/\{\{[\w.]+\}\}/g, "—")
}

/** marker トークンを含む表の行（a:tr）を rows の数だけ複製して埋める。rows が空なら行ごと消す。 */
function repeatTableRow(xml: string, marker: string, rows: Array<Record<string, string>>): string {
  const at = xml.indexOf(marker)
  if (at < 0) return xml
  const start = xml.lastIndexOf("<a:tr ", at)
  const end = xml.indexOf("</a:tr>", at) + "</a:tr>".length
  if (start < 0 || end < at) return xml
  const rowXml = xml.slice(start, end)
  return xml.slice(0, start) + rows.map((r) => fillTokens(rowXml, r)).join("") + xml.slice(end)
}

/**
 * パッケージへファイルを書き込む。JSZip 既定の親フォルダ自動作成は空のディレクトリエントリを生み、
 * PowerPoint が「修復が必要」と判定することがあるため無効にする。
 */
function put(zip: JSZipType, path: string, data: string | Uint8Array): void {
  zip.file(path, data, { createFolders: false })
}

// ── グラフ（キャッシュ値＋埋め込みExcelの更新）─────────────

type ChartSeries = { name: string; categories: string[]; values: number[] }

const colToNum = (col: string) => col.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
const numToCol = (n: number) => {
  let s = ""
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** "Sheet1!$B$2:$K$2" → セル番地の配列（行方向・列方向どちらにも対応） */
function expandRange(formula: string): string[] {
  const ref = formula.split("!").pop()?.replace(/\$/g, "") ?? ""
  const [a, b = a] = ref.split(":")
  const pa = a.match(/^([A-Z]+)(\d+)$/)
  const pb = b.match(/^([A-Z]+)(\d+)$/)
  if (!pa || !pb) return []
  const cells: string[] = []
  for (let c = colToNum(pa[1]); c <= colToNum(pb[1]); c++) {
    for (let r = Number(pa[2]); r <= Number(pb[2]); r++) cells.push(`${numToCol(c)}${r}`)
  }
  return cells
}

function strCache(values: string[]): string {
  return `<c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`).join("")}`
}

function numCache(values: number[]): string {
  return `<c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${finite(v) ? v : 0}</c:v></c:pt>`).join("")}`
}

/**
 * グラフXMLの各系列（c:ser、出現順）を series で上書きする。
 * 系列名・分類・値のキャッシュを書き換え、同じセル番地へ値を入れた埋め込みExcel用のセル表も返す。
 */
function updateChartXml(xml: string, series: ChartSeries[]): { xml: string; cells: Map<string, string | number> } {
  const cells = new Map<string, string | number>()
  let i = 0
  const out = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => {
    const data = series[i++]
    if (!data) return ser
    let next = ser
    next = next.replace(/(<c:tx><c:strRef><c:f>([^<]*)<\/c:f><c:strCache>)[\s\S]*?(<\/c:strCache>)/, (_m, head: string, f: string, tail: string) => {
      const [cell] = expandRange(f)
      if (cell) cells.set(cell, data.name)
      return head + strCache([data.name]) + tail
    })
    next = next.replace(/(<c:cat>[\s\S]*?<c:f>([^<]*)<\/c:f><c:strCache>)[\s\S]*?(<\/c:strCache>)/, (_m, head: string, f: string, tail: string) => {
      expandRange(f).forEach((cell, k) => cells.set(cell, data.categories[k] ?? ""))
      return head + strCache(data.categories) + tail
    })
    next = next.replace(/(<c:val>[\s\S]*?<c:f>([^<]*)<\/c:f><c:numCache>(<c:formatCode>[^<]*<\/c:formatCode>)?)[\s\S]*?(<\/c:numCache>)/, (_m, head: string, f: string, _fc: string, tail: string) => {
      expandRange(f).forEach((cell, k) => cells.set(cell, data.values[k] ?? 0))
      return head + numCache(data.values) + tail
    })
    return next
  })
  return { xml: out, cells }
}

/** セル表から最小構成の xlsx（埋め込みグラフデータ）を生成する。PowerPoint の「データの編集」で開ける。 */
async function buildChartWorkbook(JSZip: typeof JSZipType, cells: Map<string, string | number>): Promise<Uint8Array> {
  const byRow = new Map<number, Array<[string, string | number]>>()
  for (const [ref, v] of cells) {
    const row = Number(ref.match(/\d+$/)?.[0])
    if (!byRow.has(row)) byRow.set(row, [])
    byRow.get(row)!.push([ref, v])
  }
  const rowsXml = [...byRow.keys()]
    .sort((a, b) => a - b)
    .map((r) => {
      const cs = byRow
        .get(r)!
        .sort((a, b) => colToNum(a[0].replace(/\d+$/, "")) - colToNum(b[0].replace(/\d+$/, "")))
        .map(([ref, v]) =>
          typeof v === "number"
            ? `<c r="${ref}"><v>${finite(v) ? v : 0}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(v)}</t></is></c>`,
        )
        .join("")
      return `<row r="${r}">${cs}</row>`
    })
    .join("")

  const zip = new JSZip()
  put(
    zip,
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  )
  put(
    zip,
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  )
  put(
    zip,
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  )
  put(
    zip,
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  )
  put(
    zip,
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="游ゴシック"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  )
  put(
    zip,
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`,
  )
  return zip.generateAsync({ type: "uint8array" })
}

/** パッケージ内パス（"ppt/slides/slide4.xml" 等）の rels を読み、相対Targetを絶対パスに直して返す */
async function readRels(zip: JSZipType, partPath: string): Promise<Array<{ id: string; type: string; target: string }>> {
  const dir = partPath.slice(0, partPath.lastIndexOf("/"))
  const relsPath = `${dir}/_rels/${partPath.slice(dir.length + 1)}.rels`
  const xml = (await zip.file(relsPath)?.async("string")) ?? ""
  return [...xml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => {
    const tag = m[0]
    const attr = (name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ""
    const target = attr("Target")
    const resolved = attr("TargetMode") === "External" ? target : new URL(target, `https://x/${dir}/`).pathname.slice(1)
    return { id: attr("Id"), type: attr("Type"), target: resolved }
  })
}

/** スライドに含まれるグラフを出現順に series で更新する */
async function updateSlideCharts(JSZip: typeof JSZipType, zip: JSZipType, slideNo: number, charts: ChartSeries[][]) {
  const slidePath = `ppt/slides/slide${slideNo}.xml`
  const slideXml = (await zip.file(slidePath)?.async("string")) ?? ""
  const rels = await readRels(zip, slidePath)
  const chartIds = [...slideXml.matchAll(/<c:chart\b[^>]*r:id="([^"]+)"/g)].map((m) => m[1])
  for (const [k, rid] of chartIds.entries()) {
    const series = charts[k]
    const chartPath = rels.find((r) => r.id === rid)?.target
    if (!series || !chartPath) continue
    const chartXml = (await zip.file(chartPath)?.async("string")) ?? ""
    const updated = updateChartXml(chartXml, series)
    put(zip, chartPath, updated.xml)
    const embed = (await readRels(zip, chartPath)).find((r) => r.type.endsWith("/package"))
    if (embed) put(zip, embed.target, await buildChartWorkbook(JSZip, updated.cells))
  }
}

// ── 地図（地理院タイルをcanvasで合成）────────────────────

type Gym = { id: string; name: string; latitude: number; longitude: number; distanceM: number }

const TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Webメルカトルの世界ピクセル座標（ズーム z） */
function worldPx(lat: number, lon: number, z: number): { x: number; y: number } {
  const size = 256 * 2 ** z
  const s = Math.sin((lat * Math.PI) / 180)
  return { x: ((lon + 180) / 360) * size, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

type MapRender = { png: Uint8Array; points: Array<{ gym: Gym; fx: number; fy: number }> }

/**
 * 物件を中心に、1km圏と競合ジムが収まる最大ズームで地図画像を作る。
 * points は各ジムの画像内位置（0〜1 の比率）。吹き出しの矢印先に使う。
 */
async function renderMap(center: { lat: number; lon: number }, gyms: Gym[], width: number, height: number): Promise<MapRender | null> {
  const margin = 70
  let z = 16
  for (; z > 11; z--) {
    const c = worldPx(center.lat, center.lon, z)
    const mPerPx = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** z
    const r1 = 1000 / mPerPx
    const fits =
      r1 <= height / 2 - margin &&
      gyms.every((g) => {
        const p = worldPx(g.latitude, g.longitude, z)
        return Math.abs(p.x - c.x) <= width / 2 - margin && Math.abs(p.y - c.y) <= height / 2 - margin
      })
    if (fits) break
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#eeeeee"
  ctx.fillRect(0, 0, width, height)

  const c = worldPx(center.lat, center.lon, z)
  const left = c.x - width / 2
  const top = c.y - height / 2
  const tiles: Array<Promise<void>> = []
  for (let tx = Math.floor(left / 256); tx <= Math.floor((left + width) / 256); tx++) {
    for (let ty = Math.floor(top / 256); ty <= Math.floor((top + height) / 256); ty++) {
      const url = TILE_URL.replace("{z}", String(z)).replace("{x}", String(tx)).replace("{y}", String(ty))
      tiles.push(loadImage(url).then((img) => { if (img) ctx.drawImage(img, tx * 256 - left, ty * 256 - top) }))
    }
  }
  await Promise.all(tiles)

  // 商圏円（1km / 3km）
  const mPerPx = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / 2 ** z
  const circle = (km: number, color: string) => {
    ctx.beginPath()
    ctx.arc(width / 2, height / 2, (km * 1000) / mPerPx, 0, Math.PI * 2)
    ctx.lineWidth = 4
    ctx.strokeStyle = color
    ctx.setLineDash([14, 8])
    ctx.stroke()
    ctx.setLineDash([])
  }
  circle(3, "rgba(230,140,0,0.9)")
  circle(1, "rgba(220,30,30,0.9)")

  // 競合ジム（番号付きの青丸）
  const points = gyms.map((gym, i) => {
    const p = worldPx(gym.latitude, gym.longitude, z)
    const x = p.x - left
    const y = p.y - top
    ctx.beginPath()
    ctx.arc(x, y, 17, 0, Math.PI * 2)
    ctx.fillStyle = "#1d4ed8"
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = "#ffffff"
    ctx.stroke()
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 20px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(i + 1), x, y + 1)
    return { gym, fx: x / width, fy: y / height }
  })

  // 本物件（赤ピン）
  const cx = width / 2
  const cy = height / 2
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy - 30, 16, Math.PI * 0.8, Math.PI * 0.2)
  ctx.closePath()
  ctx.fillStyle = "#dc2626"
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = "#ffffff"
  ctx.stroke()
  ctx.font = "bold 22px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  ctx.lineWidth = 5
  ctx.strokeText("本物件", cx, cy - 50)
  ctx.fillStyle = "#dc2626"
  ctx.fillText("本物件", cx, cy - 50)

  // 出典（地理院タイル・OSMの利用条件）
  const credit = "出典：国土地理院　競合ジム：© OpenStreetMap contributors"
  ctx.font = "16px sans-serif"
  ctx.textAlign = "right"
  ctx.textBaseline = "bottom"
  const w = ctx.measureText(credit).width
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.fillRect(width - w - 16, height - 26, w + 16, 26)
  ctx.fillStyle = "#333333"
  ctx.fillText(credit, width - 8, height - 5)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  if (!blob) return null
  return { png: new Uint8Array(await blob.arrayBuffer()), points }
}

/** 地図が作れないときの代替画像（雛形のサンプル地図を残さないため） */
async function renderPlaceholder(width: number, height: number, message: string): Promise<Uint8Array | null> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#f3f4f6"
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = "#6b7280"
  ctx.font = "28px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(message, width / 2, height / 2)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

async function fetchGeoAndGyms(address: string, selectedGymIds?: ReadonlySet<string> | null) {
  const geoRes = await fetch("/api/geocoding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  })
  const geo = await geoRes.json().catch(() => null)
  if (!geoRes.ok || !finite(Number(geo?.latitude)) || !finite(Number(geo?.longitude))) return null
  const center = { lat: Number(geo.latitude), lon: Number(geo.longitude) }

  let gyms: Gym[] = []
  try {
    const res = await fetch("/api/nearby-gyms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: center.lat, longitude: center.lon, radiusKm: GYM_RADIUS_KM }),
    })
    const payload = await res.json().catch(() => null)
    if (res.ok && Array.isArray(payload?.gyms)) {
      gyms = (payload.gyms as Array<Omit<Gym, "distanceM">>)
        .filter((g) => !selectedGymIds || selectedGymIds.has(g.id))
        .map((g) => ({ ...g, distanceM: distanceMeters(center.lat, center.lon, g.latitude, g.longitude) }))
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, MAX_CALLOUTS)
    }
  } catch {
    // 競合が取れなくても地図だけは出す
  }
  return { center, gyms }
}

// 吹き出しの配置枠（EMU）。上段4枠は地図の上、左右2枠は地図の端に重ねる（レポート例と同じ配置）。
const CALLOUT_W = 2600000
const CALLOUT_H = 1150000
const CALLOUT_SLOTS = [
  { x: 380000, y: 560000 },
  { x: 3330000, y: 560000 },
  { x: 6280000, y: 560000 },
  { x: 9230000, y: 560000 },
  { x: 150000, y: 4300000 },
  { x: 9440000, y: 4300000 },
]

function calloutRun(text: string, color = "tx1"): string {
  return `<a:r><a:rPr lang="ja-JP" altLang="en-US" sz="1200" b="1" dirty="0"><a:solidFill><a:schemeClr val="${color}"/></a:solidFill><a:latin typeface="メイリオ"/><a:ea typeface="メイリオ"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>`
}

function calloutShapes(points: MapRender["points"], frame: { x: number; y: number; w: number; h: number }): string {
  const free = [...CALLOUT_SLOTS]
  let id = 2000
  return points
    .map(({ gym, fx, fy }, i) => {
      const px = frame.x + fx * frame.w
      const py = frame.y + fy * frame.h
      // マーカーに最も近い空き枠へ割り当てる（近い競合から順に）
      free.sort(
        (a, b) => Math.hypot(a.x + CALLOUT_W / 2 - px, a.y + CALLOUT_H / 2 - py) - Math.hypot(b.x + CALLOUT_W / 2 - px, b.y + CALLOUT_H / 2 - py),
      )
      const slot = free.shift()!
      const distance = gym.distanceM < 1000 ? `${Math.round(gym.distanceM / 10) * 10}m` : `${trimDecimal(gym.distanceM / 1000, 1)}km`
      const paras = [`${i + 1}. ${gym.name}`, "運営：", "会費：", `距離：${distance}`]
        .map((t, k) => `<a:p>${calloutRun(t, k === 0 ? "accent1" : "tx1")}</a:p>`)
        .join("")
      const box = `<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="競合吹き出し ${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${slot.x}" y="${slot.y}"/><a:ext cx="${CALLOUT_W}" cy="${CALLOUT_H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="t"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`

      // 矢印: 吹き出しの枠上でマーカーに最も近い点 → マーカー。マーカーが枠に隠れる場合は矢印なし。
      const sx = Math.min(Math.max(px, slot.x), slot.x + CALLOUT_W)
      const sy = Math.min(Math.max(py, slot.y), slot.y + CALLOUT_H)
      if (sx === px && sy === py) return box
      const flip = `${px < sx ? ' flipH="1"' : ""}${py < sy ? ' flipV="1"' : ""}`
      const line = `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id++}" name="競合矢印 ${i + 1}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${flip}><a:off x="${Math.round(Math.min(sx, px))}" y="${Math.round(Math.min(sy, py))}"/><a:ext cx="${Math.round(Math.abs(px - sx))}" cy="${Math.round(Math.abs(py - sy))}"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="19050"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:tailEnd type="triangle" w="med" len="med"/></a:ln></p:spPr></p:cxnSp>`
      return box + line
    })
    .join("")
}

function noteShape(text: string, frame: { x: number; y: number; w: number }): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="2999" name="競合注記"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${frame.x}" y="${frame.y - 400000}"/><a:ext cx="${frame.w}" cy="360000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p>${calloutRun(text)}</a:p></p:txBody></p:sp>`
}

/** スライド3: 地図画像を差し替え、競合の吹き出しを追加する */
async function buildCompetitorSlide(zip: JSZipType, address: string, selectedGymIds?: ReadonlySet<string> | null) {
  const slidePath = "ppt/slides/slide3.xml"
  let xml = (await zip.file(slidePath)?.async("string")) ?? ""
  const pic = xml.match(/<p:pic>[\s\S]*?<\/p:pic>/)?.[0]
  if (!pic) return
  const rid = pic.match(/r:embed="([^"]+)"/)?.[1]
  const off = pic.match(/<a:off x="(\d+)" y="(\d+)"\/>/)
  const ext = pic.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/)
  if (!rid || !off || !ext) return
  const frame = { x: Number(off[1]), y: Number(off[2]), w: Number(ext[1]), h: Number(ext[2]) }
  const width = 1600
  const height = Math.round((width * frame.h) / frame.w)

  let png: Uint8Array | null = null
  let extra = ""
  const located = address ? await fetchGeoAndGyms(address, selectedGymIds).catch(() => null) : null
  if (located) {
    const rendered = await renderMap(located.center, located.gyms, width, height).catch(() => null)
    if (rendered) {
      png = rendered.png
      extra = rendered.points.length
        ? calloutShapes(rendered.points, frame)
        : noteShape(`半径${GYM_RADIUS_KM}km以内に登録された競合ジムはありません（OpenStreetMap）`, frame)
    }
  }
  if (!png) png = await renderPlaceholder(width, height, "地図を取得できませんでした（住所を確認してください）")
  if (!png) return

  // 雛形の地図（サンプル）は別名で置き換え、関係（rels）の参照先を差し替える
  const relsPath = "ppt/slides/_rels/slide3.xml.rels"
  const rels = (await zip.file(relsPath)?.async("string")) ?? ""
  put(zip, "ppt/media/report-map.png", png)
  put(zip, relsPath, rels.replace(new RegExp(`(<Relationship\\b[^>]*Id="${rid}"[^>]*Target=")[^"]*(")`), "$1../media/report-map.png$2"))
  xml = xml.replace("</p:spTree>", `${extra}</p:spTree>`)
  put(zip, slidePath, xml)
}

// ── データ整形 ────────────────────────────────────────

const INVESTMENT_FALLBACK_LABELS: Record<string, string> = {
  fitnessMachineCost: "フィットネスマシン費",
  interiorCost: "内装・看板費",
  flapperGateCost: "フラッパーゲート",
  bodyCompositionCost: "体組成計(InBody)",
  waterServerCost: "ウォーターサーバー",
  franchiseFeeCost: "フランチャイズ加盟費用",
  systemCost: "システム導入費",
  openingPrepCost: "開業準備費",
  openingPackageCost: "開業前パッケージ費",
  securityCost: "ALSOK・USEN導入費",
  golfRightBayCost: "ゴルフ（右打席）",
  golfDualBayCost: "ゴルフ（両打席）",
  otherInitialCost: "その他",
}
const INVESTMENT_ORDER: string[] = Object.values(INVESTMENT_COST_CODE_TO_FIELD_ID)

function masterByField(masterValues: MasterValue[] | null | undefined, category: MasterValue["category"]) {
  const map = new Map<string, MasterValue>()
  const codeMap: Record<string, string> = category === "投資コスト" ? INVESTMENT_COST_CODE_TO_FIELD_ID : RUNNING_COST_CODE_TO_FIELD_ID
  for (const v of masterValues ?? []) {
    if (v.category === category && v.code) map.set(codeMap[v.code] ?? v.code, v)
  }
  return map
}

function investmentRows(input: ReportPptxInput) {
  const breakdown = input.request?.investmentBreakdown ?? input.current.investmentBreakdown ?? {}
  const masters = masterByField(input.masterValues, "投資コスト")
  const yearsByField = input.request?.depreciationYearsByField ?? {}
  const entries = Object.entries(breakdown)
    .filter(([, v]) => Number(v) > 0)
    .sort(([a], [b]) => {
      const ia = INVESTMENT_ORDER.indexOf(a)
      const ib = INVESTMENT_ORDER.indexOf(b)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  let total = 0
  let depTotal = 0
  const rows = entries.map(([fieldId, amount]) => {
    const years = Number(yearsByField[fieldId] ?? masters.get(fieldId)?.depreciationYears) || 0
    const dep = years > 0 ? Math.round(amount / years / 12) : 0
    total += amount
    depTotal += dep
    return {
      "inv.label": masters.get(fieldId)?.label ?? INVESTMENT_FALLBACK_LABELS[fieldId] ?? fieldId,
      "inv.amount": yen(amount),
      "inv.years": years > 0 ? String(years) : "",
      "inv.dep": dep > 0 ? yen(dep) : "",
    }
  })
  // 内訳が無い（履歴の旧データ等）ときは集計値で代替する
  if (rows.length === 0) {
    const r = input.current
    const fallback: Array<[string, number]> = [
      ["フィットネスマシン費", r.machinesCost],
      ["内装・看板費", r.interiorCost],
      ["FC初期費用", r.franchiseInitialCost],
      ["その他", r.otherInitialCost],
    ]
    for (const [label, amount] of fallback) {
      if (!(Number(amount) > 0)) continue
      total += amount
      rows.push({ "inv.label": label, "inv.amount": yen(amount), "inv.years": "", "inv.dep": "" })
    }
  }
  return { rows, total, depTotal }
}

/** "円/回" → "回"、"円/月" → "月額" のように単位ラベルを作る */
function unitLabelOf(master?: MasterValue): string {
  const unit = master?.unit?.split("/").pop()?.trim() ?? ""
  if (!unit || unit === "月") return "月額"
  return unit
}

function runningRows(input: ReportPptxInput) {
  const { current, request } = input
  const floor = Number(request?.floorAreaTsubo) || 0
  const masters = masterByField(input.masterValues, "ランニングコスト")
  const royalty = ((current.franchiseRate ?? 0) as 0 | 10 | 15)
  const security = request?.securityIntroBreakdown ?? current.securityIntroBreakdown
  const items =
    current.businessPlan?.fixedCostItems ??
    [
      { id: "rent", label: "家賃", monthlyAmount: current.monthlyRent },
      // 内訳が無い（旧履歴など）場合もランニングコストが表から消えないよう合計1行で出す
      ...(request?.runningCostBreakdown?.length
        ? request.runningCostBreakdown
        : [{ id: "runningCostTotal", label: "ランニングコスト", monthlyAmount: current.monthlyRunningCost }]),
      { id: "machineMaintenance", label: "マシンメンテナンス費", monthlyAmount: current.monthlyMachineMaintenance ?? 0 },
    ]

  let total = 0
  const rows = items
    .filter((it) => Number(it.monthlyAmount) !== 0)
    .map((it) => {
      const amount = Math.round(it.monthlyAmount)
      total += amount
      const master = masters.get(it.id)
      let qty = 1
      let unitLabel = "月額"
      if (it.id === SECURITY_CAMERA_RUNNING_FIELD_ID && security?.camera.count) {
        qty = security.camera.count
        unitLabel = "台"
      } else if (it.id === SECURITY_MONITOR_RUNNING_FIELD_ID && security?.monitor.count) {
        qty = security.monitor.count
        unitLabel = "台"
      } else if (master?.quantityBasis === "perTsubo" && floor > 0) {
        qty = floor * (Number(master.quantity) > 0 ? Number(master.quantity) : 1)
        unitLabel = "坪"
      } else if (master?.quantityBasis === "fixed") {
        qty = Number(master.quantity) > 0 ? Number(master.quantity) : 1
        unitLabel = unitLabelOf(master)
      }
      // 単価: 手入力で金額が変わっていても表が成り立つよう「金額 ÷ 数量」で出す（マスタ単価と一致する場合はそれを優先）
      const masterUnit = master ? resolveMasterValueAmount(master, royalty) : NaN
      const unitPrice = finite(masterUnit) && Math.round(masterUnit * qty) === amount ? masterUnit : amount / qty
      const label = master?.label ?? it.label.replace(/（[^（）]*円[^（）]*）$/, "")
      return {
        "rc.label": label,
        "rc.unit": yen(unitPrice),
        "rc.qty": trimDecimal(qty),
        "rc.unitLabel": unitLabel,
        "rc.amount": yen(amount),
      }
    })
  return { rows, total }
}

function populationOf(request?: SimulationRequestInput | null) {
  const ages = request?.populationByAgeRadius ?? []
  let cumulative: [number, number, number] | null = null
  if (ages.length) {
    cumulative = [0, 1, 2].map((k) => ages.reduce((s, a) => s + (Number(a.cumulative[k]) || 0), 0)) as [number, number, number]
  } else if (request?.populationByRadius) {
    const { km1Ring, km3Ring, km5Ring } = request.populationByRadius
    cumulative = [km1Ring, km1Ring + km3Ring, km1Ring + km3Ring + km5Ring]
  }
  return { cumulative, ages }
}

function financeTokens(result: SimulationResult): { tokens: Record<string, string>; chart: ChartSeries[] } {
  const ap = (result.annualProjection ?? []).slice(0, 10)
  const tokens: Record<string, string> = {}
  const labels = Array.from({ length: 10 }, (_, i) => `${i + 1}期`)
  let revSum = 0
  let costSum = 0
  let ptSum = 0
  for (let i = 0; i < 10; i++) {
    const r = ap[i]
    const k = `y${i + 1}`
    if (!r) {
      for (const f of ["m", "rev", "gr", "cost", "pt", "pr"]) tokens[`${k}.${f}`] = "—"
      continue
    }
    revSum += r.revenue
    costSum += r.cost
    ptSum += r.pretaxProfit
    const prev = ap[i - 1]
    tokens[`${k}.m`] = comma(r.yearEndMembers)
    tokens[`${k}.rev`] = yen(r.revenue)
    tokens[`${k}.gr`] = prev && prev.revenue > 0 ? pct(r.revenue / prev.revenue) : "-"
    tokens[`${k}.cost`] = yen(r.cost)
    tokens[`${k}.pt`] = yen(r.pretaxProfit)
    tokens[`${k}.pr`] = pct(r.paybackRatio)
  }
  tokens["tot.rev"] = yen(revSum)
  tokens["tot.cost"] = yen(costSum)
  tokens["tot.pt"] = yen(ptSum)
  tokens["kpi.price"] = yen(result.averagePrice)
  tokens["kpi.be"] = finite(result.breakevenMembers) ? `${comma(result.breakevenMembers)}名` : "—"
  tokens["kpi.max"] = finite(result.capacity?.maxMembers) ? `${comma(result.capacity.maxMembers)}名` : "—"
  tokens["kpi.cc"] = finite(result.capacity?.concurrentUsers) ? `${comma(result.capacity.concurrentUsers)}名` : "—"
  tokens["kpi.park"] = result.capacity?.parkingSpaces ? `${comma(result.capacity.parkingSpaces)}台` : "-"

  const values = (pick: (r: (typeof ap)[number]) => number) => labels.map((_, i) => (ap[i] ? Math.round(pick(ap[i])) : 0))
  return {
    tokens,
    chart: [
      { name: "売上", categories: labels, values: values((r) => r.revenue) },
      { name: "利益", categories: labels, values: values((r) => r.pretaxProfit) },
      { name: "会員数", categories: labels, values: values((r) => r.yearEndMembers) },
    ],
  }
}

/** 事業計画の月次広告費から、2年目・3年目の月額を取る（1年目は月ごとに変動するため注記は2年目の値で代表する） */
function adCostOf(result: SimulationResult): { year2?: number; year3?: number } {
  const months = result.businessPlan?.months ?? []
  return { year2: months.find((m) => m.month === 13)?.adCost, year3: months.find((m) => m.month === 25)?.adCost }
}

// ── エントリポイント ───────────────────────────────────

export async function exportReportPptx(input: ReportPptxInput): Promise<void> {
  const JSZip = (await import("jszip")).default
  const res = await fetch(TEMPLATE_URL, { cache: "no-store" })
  if (!res.ok) throw new Error("レポート雛形の取得に失敗しました。")
  const zip = await JSZip.loadAsync(await res.arrayBuffer())

  const { current, request } = input
  const address = request?.location ?? current.location ?? ""
  const floor = Number(request?.floorAreaTsubo) || 0
  // rentPerTsubo は名前に反して「月額家賃の総額（円）」（試算フォームの「家賃（円）」欄）。坪単価は総額 ÷ 坪数で出す。
  const rent = Number(request?.rentPerTsubo) || current.monthlyRent
  const rentPerTsubo = floor > 0 && finite(rent) && rent > 0 ? rent / floor : 0
  const breakdown = request?.investmentBreakdown ?? current.investmentBreakdown ?? {}
  const perTsuboMan = (amount?: number) => (floor > 0 && finite(amount) && amount > 0 ? man(amount / floor) : "—")
  const ad = adCostOf(current)
  const pop = populationOf(request)

  const common: Record<string, string> = {
    // 1. 表紙
    date: formatDate(new Date()),
    address: address || "—",
    tsubo: floor > 0 ? trimDecimal(floor) : "—",
    rentMan: finite(rent) && rent > 0 ? (rent / 10000).toFixed(2) : "—",
    rentPerTsubo: rentPerTsubo > 0 ? comma(rentPerTsubo) : "—",
    royalty: String(current.franchiseRate ?? 0),
    // 4. 人口情報
    pop1: pop.cumulative ? comma(pop.cumulative[0]) : "—",
    pop3: pop.cumulative ? comma(pop.cumulative[1]) : "—",
    pop5: pop.cumulative ? comma(pop.cumulative[2]) : "—",
    // 5. 注記
    adYear2: man(ad.year2),
    adYear3: man(ad.year3),
    variableCost: finite(current.variableCostPerMember) ? comma(current.variableCostPerMember) : "—",
    interiorPerTsubo: perTsuboMan(Number(breakdown.interiorCost) || current.interiorCost),
    machinePerTsubo: perTsuboMan(Number(breakdown.fitnessMachineCost) || current.machinesCost),
  }

  const inv = investmentRows(input)
  const rc = runningRows(input)
  common.invTotal = yen(inv.total)
  common.depTotal = inv.depTotal > 0 ? yen(inv.depTotal) : ""
  common.rcTotal = yen(rc.total)

  // 表紙のグーグルマップリンク（rels の Target 内のトークン）
  const coverRelsPath = "ppt/slides/_rels/slide1.xml.rels"
  const coverRels = (await zip.file(coverRelsPath)?.async("string")) ?? ""
  put(zip, coverRelsPath, coverRels.replace("{{mapQuery}}", encodeURIComponent(address)))

  // 表のある/トークンのあるスライドを順に処理
  const slideTokens: Record<number, Record<string, string>> = {}
  const financeCharts: Record<number, ChartSeries[]> = {}
  for (const { slide, scenario } of FINANCE_SLIDES) {
    const f = financeTokens(input.scenarios[scenario])
    slideTokens[slide] = f.tokens
    financeCharts[slide] = f.chart
  }

  for (const slideNo of [1, 4, 5, 6, 7, 8]) {
    const path = `ppt/slides/slide${slideNo}.xml`
    let xml = (await zip.file(path)?.async("string")) ?? ""
    if (slideNo === 5) {
      xml = repeatTableRow(xml, "{{inv.label}}", inv.rows)
      xml = repeatTableRow(xml, "{{rc.label}}", rc.rows)
    }
    xml = fillTokens(xml, { ...common, ...(slideTokens[slideNo] ?? {}) })
    put(zip, path, clearLeftoverTokens(xml))
  }

  // グラフ
  const ageLabels = pop.ages.map((a) => a.label)
  await updateSlideCharts(JSZip, zip, 4, [
    [{ name: "本物件", categories: ["1km", "3km", "5km"], values: pop.cumulative ? [...pop.cumulative] : [0, 0, 0] }],
    [{
      name: "1km圏人口",
      categories: ageLabels.length ? ageLabels : ["20～24歳", "25～29歳", "30～34歳", "35～39歳", "40～44歳", "45～49歳", "50～54歳", "55～59歳"],
      values: pop.ages.length ? pop.ages.map((a) => Number(a.cumulative[0]) || 0) : Array(8).fill(0),
    }],
  ])
  for (const { slide } of FINANCE_SLIDES) {
    await updateSlideCharts(JSZip, zip, slide, [financeCharts[slide]])
  }

  // 3. 競合情報（地図・吹き出し）
  await buildCompetitorSlide(zip, address, input.selectedGymIds)

  const blob = await zip.generateAsync({ type: "blob", mimeType: PPTX_MIME, compression: "DEFLATE" })
  const safeName = (current.storeName || "result").replace(/[\\/:*?"<>|\s]+/g, "_")
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `試算レポート_${safeName}.pptx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
