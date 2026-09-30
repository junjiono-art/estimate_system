/**
 * 商圏人口（年齢別・半径別）入力表への貼り付け解析。
 *
 * 目的: jSTAT MAP などの画面／CSV／Excel からコピーした人口表を、
 * 1セルずつ手入力せずに 8階級（20〜59歳）× 3半径（1km/3km/5km）の入力表へ一括反映する。
 *
 * 入力の揺れが大きい（タブ区切り／カンマ区切り／空白区切り、年齢ラベルの有無、
 * 行と列の向きの違い、3桁区切りカンマ、全角数字）ため、次の順で解釈を試みる。
 *   1) レポート方式   … jSTAT MAP シンプルレポート形式（年齢=列見出し、半径=商圏名「〇〇-5km」）
 *   2) 年齢ラベル方式 … 「20〜24歳」等のラベルを手掛かりに階級を突き合わせる
 *   3) 行列方式       … 数値だけの 8×3 / 3×8 / 24個 をそのまま流し込む
 *   4) 逐次方式       … 上記に当てはまらない場合、貼り付け開始セルから右下方向へ埋める
 */

/** 解釈方式。UI のフィードバック文言に使う。 */
export type PopulationPasteMode = "report" | "age-label" | "matrix" | "transposed-matrix" | "sequential"

export type PopulationPasteResult = {
  /** 入力表と同じ形（行=年齢階級, 列=半径）。null は「貼り付け対象外なので現在値を保持」。 */
  values: (string | null)[][]
  /** 実際に値が入ったセル数。0 なら貼り付けとして扱わない（既定のペースト動作に任せる）。 */
  filledCount: number
  mode: PopulationPasteMode
  /** ユーザーに伝えたい補足（範囲外の階級を無視した等）。 */
  notes: string[]
}

export type PopulationPasteOptions = {
  /** 入力表の年齢階級の下限値（例: [20,25,...,55]）。 */
  ageFroms: readonly number[]
  /** 入力表の半径（km）。列順に並べる（例: [1,3,5]）。 */
  radiusKms: readonly number[]
  /** 貼り付け操作を行ったセル（逐次方式・部分貼り付けの起点）。 */
  anchorRow: number
  anchorCol: number
}

/** 全角数字・全角カンマ・全角空白を半角へ寄せる。 */
function toHalfWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d)))
    .replace(/[，、]/g, ",")
    .replace(/　/g, " ")
}

/** 「1,234」「1234人」→ 1234。数値として読めなければ null。 */
function parseNumber(token: string): number | null {
  const cleaned = toHalfWidth(token).replace(/[,\s人]/g, "").replace(/^\+/, "")
  if (cleaned === "" || cleaned === "-" || cleaned === "−") return null
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  // 小地域按分などで小数が入ることがあるため、人口は整数へ丸める。
  return Math.round(n)
}

/** 「20〜24歳」「20-24」「20歳以上」→ 下限値 20。年齢ラベルでなければ null。 */
function parseAgeFrom(token: string): number | null {
  const t = toHalfWidth(token).replace(/\s/g, "")
  if (t === "") return null
  // 単体の数値（人口値）を年齢ラベルと誤認しないよう、範囲表記か「歳」を含むものだけを拾う。
  const range = t.match(/(\d{1,3})(?:歳)?[〜~～ー–—\-](\d{1,3})/)
  if (range) return Number(range[1])
  const over = t.match(/^(\d{1,3})歳(?:以上|~|〜|～)?$/)
  if (over) return Number(over[1])
  return null
}

/** 「1km圏」「3Km」「5000m」→ km 値。半径ラベルでなければ null。 */
function parseRadiusKm(token: string): number | null {
  const t = toHalfWidth(token).replace(/\s/g, "")
  const km = t.match(/(\d+(?:\.\d+)?)(?:km|ｋｍ|キロ)/i)
  if (km) return Number(km[1])
  const m = t.match(/(\d{3,5})(?:m|ｍ|メートル)(?![a-z])/i)
  if (m) return Number(m[1]) / 1000
  return null
}

/**
 * 貼り付けテキストをセルの二次元配列に切る。
 * タブがあればタブ区切り（Excel・ブラウザの表コピーはこれ）。
 * 無ければ3桁区切りカンマを取り除いたうえでカンマ区切り、それも無ければ空白区切り。
 */
function splitGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim() !== "")
  return lines.map((line) => {
    if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim())
    // 「1,234」の3桁区切りカンマだけを先に落とす（後ろに4桁以上続く場合は区切り文字とみなす）。
    const withoutThousands = line.replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    if (withoutThousands.includes(",")) return withoutThousands.split(",").map((cell) => cell.trim())
    return line.trim().split(/\s+/)
  })
}

function transpose(grid: string[][]): string[][] {
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0)
  return Array.from({ length: width }, (_, col) => grid.map((row) => row[col] ?? ""))
}

function transposeNumbers(grid: number[][]): number[][] {
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0)
  return Array.from({ length: width }, (_, col) => grid.map((row) => row[col]))
}

/** 空の結果（行=年齢階級, 列=半径 の null 埋め）。 */
function emptyValues(rows: number, cols: number): (string | null)[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))
}

type LabeledRow = { from: number; numbers: Array<{ col: number; value: number }> }

/** 各行の年齢ラベルと、その行の数値（列位置つき）を拾う。 */
function collectLabeledRows(grid: string[][]): LabeledRow[] {
  const result: LabeledRow[] = []
  for (const row of grid) {
    let from: number | null = null
    const numbers: Array<{ col: number; value: number }> = []
    row.forEach((cell, col) => {
      if (from === null) {
        const age = parseAgeFrom(cell)
        if (age !== null) {
          from = age
          return
        }
      }
      const num = parseNumber(cell)
      if (num !== null) numbers.push({ col, value: num })
    })
    if (from !== null && numbers.length > 0) result.push({ from, numbers })
  }
  return result
}

/** ヘッダ行から半径ラベルの列位置を割り出す（対象半径が全て揃う行のみ採用）。 */
function findRadiusColumns(grid: string[][], radiusKms: readonly number[]): Array<number | undefined> {
  for (const row of grid) {
    const found = new Map<number, number>()
    row.forEach((cell, col) => {
      const km = parseRadiusKm(cell)
      if (km !== null && !found.has(km)) found.set(km, col)
    })
    // 部分一致は誤検出のリスクが高いため、全半径が揃っているヘッダ行だけを信用する。
    if (radiusKms.every((km) => found.has(km))) return radiusKms.map((km) => found.get(km))
  }
  return radiusKms.map(() => undefined)
}

/**
 * jSTAT MAP「シンプルレポート」方式の解析（`doc/シンプルレポート.html` が実物）。
 *
 *   名称           総数２０～２４歳  …  総数５５～５９歳
 *   tetete-5km     86954            …  100058
 *   tetete-3km     51194            …  55357
 *   tetete-1km     19243            …  20404
 *
 * 年齢が「列見出し」、半径が「行の商圏名（-5km 等）」に入る形。しかも行の並びが
 * **5km → 1km の降順**なので、行順で機械的に割り当てると 1km と 5km が入れ替わる。
 * そのため商圏名から半径を読み取って列を決める。行順には一切依存しない。
 *
 * 集計明細テーブル（住所名・集計率つき）が続いていても、行に半径が無いので自然に無視される。
 * 明細テーブルは列が1つずれる（集計率の分）が、見出し行を見つけ次第 ageCols を作り直すので問題ない。
 *
 * @returns 解釈できなければ null（呼び出し側は次の方式へ進む）
 */
function tryReportLayout(
  grid: string[][],
  ageFroms: readonly number[],
  radiusKms: readonly number[],
): { values: (string | null)[][]; filledCount: number; notes: string[] } | null {
  const values = emptyValues(ageFroms.length, radiusKms.length)
  const notes: string[] = []
  // 直近の見出し行から作る「年齢の下限値 → 列位置」。テーブルが変わるたびに作り直す。
  let ageCols: Array<{ from: number; col: number }> | null = null
  let filledCount = 0
  let matchedRows = 0
  let ignoredRadii = 0
  const ignoredBrackets = new Set<number>()

  for (const row of grid) {
    // 見出し行の判定: 年齢ラベルを3つ以上含む行。
    const labels: Array<{ from: number; col: number; total: boolean }> = []
    row.forEach((cell, col) => {
      const from = parseAgeFrom(cell)
      if (from !== null) labels.push({ from, col, total: /総数|合計/.test(cell) })
    })
    if (labels.length >= 3) {
      const picked = new Map<number, { col: number; total: boolean }>()
      for (const label of labels) {
        const current = picked.get(label.from)
        // 男／女／総数が並ぶレポートもあるため、同じ階級が重複したら「総数」列を優先する。
        if (!current || (label.total && !current.total)) picked.set(label.from, { col: label.col, total: label.total })
      }
      ageCols = [...picked.entries()].map(([from, v]) => ({ from, col: v.col }))
      continue
    }
    if (!ageCols) continue

    // データ行の判定: 商圏名などに半径（1km/3km/5km）が入っている行。
    let km: number | null = null
    for (const cell of row) {
      const found = parseRadiusKm(cell)
      if (found !== null) {
        km = found
        break
      }
    }
    if (km === null) continue
    const colIdx = radiusKms.indexOf(km)
    if (colIdx < 0) {
      ignoredRadii += 1
      continue
    }
    matchedRows += 1
    for (const { from, col } of ageCols) {
      const rowIdx = ageFroms.indexOf(from)
      if (rowIdx < 0) {
        ignoredBrackets.add(from)
        continue
      }
      const value = parseNumber(row[col] ?? "")
      if (value === null) continue
      values[rowIdx][colIdx] = String(value)
      filledCount += 1
    }
  }

  if (matchedRows === 0 || filledCount === 0) return null
  notes.push(`商圏名の「1km/3km/5km」から列を判定しました（${matchedRows}商圏）。`)
  if (ignoredRadii > 0) notes.push(`入力表に無い半径の行${ignoredRadii}件は無視しました。`)
  if (ignoredBrackets.size > 0) notes.push(`20〜59歳以外の${ignoredBrackets.size}階級は入力対象外のため無視しました。`)
  return { values, filledCount, notes }
}

/**
 * 商圏人口表への貼り付けテキストを解析する。
 * filledCount が 0 の場合は解釈できなかったということなので、呼び出し側は既定のペースト動作に任せる。
 */
export function parsePopulationPaste(text: string, options: PopulationPasteOptions): PopulationPasteResult {
  const { ageFroms, radiusKms, anchorRow, anchorCol } = options
  const rows = ageFroms.length
  const cols = radiusKms.length
  const notes: string[] = []
  const grid = splitGrid(text)
  if (grid.length === 0) return { values: emptyValues(rows, cols), filledCount: 0, mode: "sequential", notes }

  // ── 0) レポート方式（jSTAT MAP シンプルレポート: 年齢=列見出し、半径=商圏名）──
  const report = tryReportLayout(grid, ageFroms, radiusKms)
  if (report) {
    return { values: report.values, filledCount: report.filledCount, mode: "report", notes: report.notes }
  }

  // ── 1) 年齢ラベル方式 ────────────────────────────────────────────────
  // 行方向にラベルが無ければ、年齢が列見出しになっている（縦横が逆の）可能性を見る。
  let labelGrid = grid
  let labeled = collectLabeledRows(labelGrid)
  if (labeled.length < 2) {
    const flipped = transpose(grid)
    const flippedLabeled = collectLabeledRows(flipped)
    if (flippedLabeled.length > labeled.length) {
      labelGrid = flipped
      labeled = flippedLabeled
    }
  }

  if (labeled.length >= 2) {
    const radiusCols = findRadiusColumns(labelGrid, radiusKms)
    // 半径の見出しが読めたかどうかは、列順を推測で決めたことをユーザーへ伝えるために使う。
    let radiusHeaderFound = false
    for (const col of radiusCols) if (col !== undefined) radiusHeaderFound = true
    const values = emptyValues(rows, cols)
    let filledCount = 0
    let ignoredBrackets = 0
    for (const row of labeled) {
      const rowIdx = ageFroms.indexOf(row.from)
      if (rowIdx < 0) {
        ignoredBrackets += 1
        continue
      }
      // ヘッダから半径列が特定できた場合はその列を、できなければ行内の数値を左から順に使う。
      const picked: Array<number | null> = radiusKms.map((_, i) => {
        const col = radiusCols[i]
        if (col === undefined) return null
        const hit = row.numbers.find((n) => n.col === col)
        return hit ? hit.value : null
      })
      // TS 5.5 以降は every/filter の述語から型が絞られてしまうため、素のループで判定する。
      let hasHeaderValue = false
      for (const v of picked) if (v !== null) hasHeaderValue = true
      if (!hasHeaderValue) {
        // 数値が列数分あれば左から順に、足りなければ貼り付け開始列から埋める。
        const offset = row.numbers.length >= cols ? 0 : anchorCol
        row.numbers.slice(0, cols - offset).forEach((n, i) => {
          picked[offset + i] = n.value
        })
      }
      picked.forEach((v, colIdx) => {
        if (v === null) return
        values[rowIdx][colIdx] = String(v)
        filledCount += 1
      })
    }
    if (filledCount > 0) {
      if (!radiusHeaderFound) {
        notes.push("半径の見出し（1km/3km/5km）が見つからないため、左から 1km→3km→5km の順とみなしました。列の並びをご確認ください。")
      }
      if (ignoredBrackets > 0) notes.push(`20〜59歳以外の${ignoredBrackets}階級は入力対象外のため無視しました。`)
      const missing = values.filter((row) => row.every((v) => v === null)).length
      if (missing > 0) notes.push(`${missing}階級分は値が見つからず、既存の入力値を残しています。`)
      return { values, filledCount, mode: "age-label", notes }
    }
  }

  // ── 2) 行列方式（数値のみ）────────────────────────────────────────────
  const numericGrid = grid
    .map((row) => row.map(parseNumber).filter((n): n is number => n !== null))
    .filter((row) => row.length > 0)
  const total = numericGrid.reduce((sum, row) => sum + row.length, 0)
  if (total === 0) return { values: emptyValues(rows, cols), filledCount: 0, mode: "sequential", notes }

  const isRectangular = numericGrid.every((row) => row.length === numericGrid[0].length)
  if (isRectangular && numericGrid.length === rows && numericGrid[0].length === cols) {
    return {
      values: numericGrid.map((row) => row.map((v) => String(v))),
      filledCount: rows * cols,
      mode: "matrix",
      notes,
    }
  }
  if (isRectangular && numericGrid.length === cols && numericGrid[0].length === rows) {
    notes.push("縦横が逆だったため、行=年齢階級・列=半径に並べ替えて反映しました。")
    return {
      values: transposeNumbers(numericGrid).map((row) => row.map((v) => String(v))),
      filledCount: rows * cols,
      mode: "transposed-matrix",
      notes,
    }
  }
  if (total === rows * cols) {
    // 24個そろっているが形が崩れている場合は、左上から行優先で詰め直す。
    const flat = numericGrid.flat()
    const values = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => String(flat[r * cols + c])),
    )
    return { values, filledCount: rows * cols, mode: "matrix", notes }
  }

  // ── 3) 逐次方式（表計算ソフトと同じ、貼り付け開始セルからの相対配置）──
  const values = emptyValues(rows, cols)
  let filledCount = 0
  let clipped = false
  numericGrid.forEach((row, r) => {
    row.forEach((value, c) => {
      const targetRow = anchorRow + r
      const targetCol = anchorCol + c
      if (targetRow >= rows || targetCol >= cols) {
        clipped = true
        return
      }
      values[targetRow][targetCol] = String(value)
      filledCount += 1
    })
  })
  if (clipped) notes.push("入力表に収まらない値は切り捨てました。貼り付け先のセルを確認してください。")
  return { values, filledCount, mode: "sequential", notes }
}
