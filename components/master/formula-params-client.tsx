"use client"

import { useEffect, useState, useCallback } from "react"
import {
  SaveIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
  InfoIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { CalcParameterConfig } from "@/lib/types"

// DB未接続時に使うデモデフォルト値
const DEMO_CONFIG: CalcParameterConfig = {
  paymentFeeRate: 0.035,
  royaltyCapMonthly: 300_000,
  appFeeMonthly: 10_000,
  competitorImpact: {
    upTo2: 0.10,
    for3: 0.15,
    for4: 0.20,
    over4: 0.25,
  },
  adCost: {
    year1Month1: 600_000,
    year1Month2: 400_000,
    year1Month3To4: 300_000,
    year1Month5To12: 180_000,
    year2Monthly: 120_000,
    year3PlusMonthly: 80_000,
  },
}

// ─────────────────────────────────────────────────────────────
// パラメータ定義
// ─────────────────────────────────────────────────────────────

type ParamType = "rate" | "money" | "number"

interface ParamDef {
  id: string
  label: string
  description: string
  unit: string
  type: ParamType
  group: string
  getValue: (cfg: CalcParameterConfig) => number
  setValue: (cfg: CalcParameterConfig, raw: string) => CalcParameterConfig
  /** この値が影響する計算式の説明 */
  formula: string
  /** 計算例（入力値を使ってアウトプット例を計算するfn） */
  calcExample: (cfg: CalcParameterConfig) => { label: string; value: string }[]
}

function parseRate(raw: string, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n / 100 : fallback
}
function parseMoney(raw: string, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}
function fmtRate(v: number): string {
  return String(Math.round(v * 10_000) / 100)
}
function fmtMoney(v: number): string {
  return v.toLocaleString("ja-JP")
}
function fmtYen(v: number): string {
  return `¥${Math.round(v).toLocaleString("ja-JP")}`
}

const PARAM_DEFS: ParamDef[] = [
  // ── 手数料・上限 ───────────────────────────────────────────
  {
    id: "paymentFeeRate",
    label: "決済手数料率",
    description: "月次売上に対して乗じる決済手数料の割合",
    unit: "%",
    type: "rate",
    group: "手数料・上限",
    getValue: (c) => c.paymentFeeRate,
    setValue: (c, raw) => ({ ...c, paymentFeeRate: parseRate(raw, c.paymentFeeRate) }),
    formula: "決済手数料 = 月次売上 × 決済手数料率",
    calcExample: (c) => {
      const revenues = [500_000, 1_000_000, 2_000_000]
      return revenues.map((rev) => ({
        label: `売上 ${fmtMoney(rev)} 円`,
        value: fmtYen(rev * c.paymentFeeRate),
      }))
    },
  },
  {
    id: "royaltyCapMonthly",
    label: "ロイヤリティ月額上限",
    description: "計算されたロイヤリティがこの金額を超えた場合、この金額で上限キャップされる",
    unit: "円/月",
    type: "money",
    group: "手数料・上限",
    getValue: (c) => c.royaltyCapMonthly,
    setValue: (c, raw) => ({ ...c, royaltyCapMonthly: parseMoney(raw, c.royaltyCapMonthly) }),
    formula: "月次ロイヤリティ = min(売上 × ロイヤリティ率, ロイヤリティ月額上限)",
    calcExample: (c) => {
      const rates = [0.10, 0.15]
      const revenue = 2_000_000
      return rates.map((r) => ({
        label: `売上${fmtMoney(revenue)} × ${r * 100}%`,
        value: fmtYen(Math.min(revenue * r, c.royaltyCapMonthly)),
      }))
    },
  },
  {
    id: "appFeeMonthly",
    label: "アプリ利用料",
    description: "ロイヤリティが発生している月に加算されるアプリ利用固定費",
    unit: "円/月",
    type: "money",
    group: "手数料・上限",
    getValue: (c) => c.appFeeMonthly,
    setValue: (c, raw) => ({ ...c, appFeeMonthly: parseMoney(raw, c.appFeeMonthly) }),
    formula: "アプリ利用料 = ロイヤリティ > 0 の月のみ加算",
    calcExample: (c) => [
      { label: "ロイヤリティ発生月", value: fmtYen(c.appFeeMonthly) },
      { label: "ロイヤリティ非発生月", value: "¥0" },
    ],
  },

  // ── 競合影響率 ────────────────────────────────────────────
  {
    id: "competitorImpact.upTo2",
    label: "競合影響率（1〜2店舗）",
    description: "半径内に競合が1〜2店舗ある場合の需要減衰率",
    unit: "%",
    type: "rate",
    group: "競合影響率",
    getValue: (c) => c.competitorImpact.upTo2,
    setValue: (c, raw) => ({
      ...c,
      competitorImpact: { ...c.competitorImpact, upTo2: parseRate(raw, c.competitorImpact.upTo2) },
    }),
    formula: "初月入会人数 = 基本値 × (1 − 競合影響率)",
    calcExample: (c) => {
      const base = 334
      return [
        { label: `基本値 ${base} 人`, value: `${Math.round(base * (1 - c.competitorImpact.upTo2))} 人` },
      ]
    },
  },
  {
    id: "competitorImpact.for3",
    label: "競合影響率（3店舗）",
    description: "半径内に競合が3店舗ある場合の需要減衰率",
    unit: "%",
    type: "rate",
    group: "競合影響率",
    getValue: (c) => c.competitorImpact.for3,
    setValue: (c, raw) => ({
      ...c,
      competitorImpact: { ...c.competitorImpact, for3: parseRate(raw, c.competitorImpact.for3) },
    }),
    formula: "初月入会人数 = 基本値 × (1 − 競合影響率)",
    calcExample: (c) => {
      const base = 334
      return [
        { label: `基本値 ${base} 人`, value: `${Math.round(base * (1 - c.competitorImpact.for3))} 人` },
      ]
    },
  },
  {
    id: "competitorImpact.for4",
    label: "競合影響率（4店舗）",
    description: "半径内に競合が4店舗ある場合の需要減衰率",
    unit: "%",
    type: "rate",
    group: "競合影響率",
    getValue: (c) => c.competitorImpact.for4,
    setValue: (c, raw) => ({
      ...c,
      competitorImpact: { ...c.competitorImpact, for4: parseRate(raw, c.competitorImpact.for4) },
    }),
    formula: "初月入会人数 = 基本値 × (1 − 競合影響率)",
    calcExample: (c) => {
      const base = 334
      return [
        { label: `基本値 ${base} 人`, value: `${Math.round(base * (1 - c.competitorImpact.for4))} 人` },
      ]
    },
  },
  {
    id: "competitorImpact.over4",
    label: "競合影響率（5店舗以上）",
    description: "半径内に競合が5店舗以上ある場合の需要減衰率",
    unit: "%",
    type: "rate",
    group: "競合影響率",
    getValue: (c) => c.competitorImpact.over4,
    setValue: (c, raw) => ({
      ...c,
      competitorImpact: { ...c.competitorImpact, over4: parseRate(raw, c.competitorImpact.over4) },
    }),
    formula: "初月入会人数 = 基本値 × (1 − 競合影響率)",
    calcExample: (c) => {
      const base = 334
      return [
        { label: `基本値 ${base} 人`, value: `${Math.round(base * (1 - c.competitorImpact.over4))} 人` },
      ]
    },
  },

  // ── 広告費テーブル ─────────────────────────────────────────
  {
    id: "adCost.year1Month1",
    label: "広告費（1年目 1月）",
    description: "オープン初月の広告宣伝費",
    unit: "円",
    type: "money",
    group: "広告費テーブル",
    getValue: (c) => c.adCost.year1Month1,
    setValue: (c, raw) => ({
      ...c,
      adCost: { ...c.adCost, year1Month1: parseMoney(raw, c.adCost.year1Month1) },
    }),
    formula: "月次コスト += 広告費（該当月のルール値）",
    calcExample: (c) => [
      { label: "1年目 1月の広告費", value: fmtYen(c.adCost.year1Month1) },
    ],
  },
  {
    id: "adCost.year1Month2",
    label: "広告費（1年目 2月）",
    description: "オープン2ヶ月目の広告宣伝費",
    unit: "円",
    type: "money",
    group: "広告費テーブル",
    getValue: (c) => c.adCost.year1Month2,
    setValue: (c, raw) => ({
      ...c,
      adCost: { ...c.adCost, year1Month2: parseMoney(raw, c.adCost.year1Month2) },
    }),
    formula: "月次コスト += 広告費（該当月のルール値）",
    calcExample: (c) => [
      { label: "1年目 2月の広告費", value: fmtYen(c.adCost.year1Month2) },
    ],
  },
  {
    id: "adCost.year1Month3To4",
    label: "広告費（1年目 3〜4月）",
    description: "オープン3〜4ヶ月目の広告宣伝費",
    unit: "円",
    type: "money",
    group: "広告費テーブル",
    getValue: (c) => c.adCost.year1Month3To4,
    setValue: (c, raw) => ({
      ...c,
      adCost: { ...c.adCost, year1Month3To4: parseMoney(raw, c.adCost.year1Month3To4) },
    }),
    formula: "月次コスト += 広告費（該当月のルール値）",
    calcExample: (c) => [
      { label: "1年目 3〜4月の広告費", value: fmtYen(c.adCost.year1Month3To4) },
    ],
  },
  {
    id: "adCost.year1Month5To12",
    label: "広告費（1年目 5〜12月）",
    description: "オープン5〜12ヶ月目の広告宣伝費",
    unit: "円",
    type: "money",
    group: "広告費テーブル",
    getValue: (c) => c.adCost.year1Month5To12,
    setValue: (c, raw) => ({
      ...c,
      adCost: { ...c.adCost, year1Month5To12: parseMoney(raw, c.adCost.year1Month5To12) },
    }),
    formula: "月次コスト += 広告費（該当月のルール値）",
    calcExample: (c) => [
      { label: "1年目 5〜12月の広告費", value: fmtYen(c.adCost.year1Month5To12) },
    ],
  },
  {
    id: "adCost.year2Monthly",
    label: "広告費（2年目 毎月）",
    description: "2年目の月次広告宣伝費（固定）",
    unit: "円/月",
    type: "money",
    group: "広告費テーブル",
    getValue: (c) => c.adCost.year2Monthly,
    setValue: (c, raw) => ({
      ...c,
      adCost: { ...c.adCost, year2Monthly: parseMoney(raw, c.adCost.year2Monthly) },
    }),
    formula: "月次コスト += 広告費（該当月のルール値）",
    calcExample: (c) => [
      { label: "2年目 毎月", value: fmtYen(c.adCost.year2Monthly) },
      { label: "2年目 年間合計", value: fmtYen(c.adCost.year2Monthly * 12) },
    ],
  },
  {
    id: "adCost.year3PlusMonthly",
    label: "広告費（3年目以降 毎月）",
    description: "3年目以降の月次広告宣伝費（固定）",
    unit: "円/月",
    type: "money",
    group: "広告費テーブル",
    getValue: (c) => c.adCost.year3PlusMonthly,
    setValue: (c, raw) => ({
      ...c,
      adCost: { ...c.adCost, year3PlusMonthly: parseMoney(raw, c.adCost.year3PlusMonthly) },
    }),
    formula: "月次コスト += 広告費（該当月のルール値）",
    calcExample: (c) => [
      { label: "3年目以降 毎月", value: fmtYen(c.adCost.year3PlusMonthly) },
      { label: "3年目以降 年間合計", value: fmtYen(c.adCost.year3PlusMonthly * 12) },
    ],
  },
]

const GROUPS = Array.from(new Set(PARAM_DEFS.map((d) => d.group)))

// ─────────────────────────────────────────────────────────────
// 表示用ヘルパー
// ─────────────────────────────────────────────────────────────

function displayValue(def: ParamDef, cfg: CalcParameterConfig): string {
  const v = def.getValue(cfg)
  if (def.type === "rate") return `${fmtRate(v)} %`
  if (def.type === "money") return `¥${fmtMoney(v)}`
  return String(v)
}

function editableValue(def: ParamDef, cfg: CalcParameterConfig): string {
  const v = def.getValue(cfg)
  if (def.type === "rate") return fmtRate(v)
  return String(v)
}

// ─────────────────────────────────────────────────────────────
// サブコンポーネント: 行
// ─────────────────────────────────────────────────────────────

interface ParamRowProps {
  def: ParamDef
  cfg: CalcParameterConfig
  dirty: boolean
  onSave: (def: ParamDef, raw: string) => void
}

function ParamRow({ def, cfg, dirty, onSave }: ParamRowProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState("")
  const [expanded, setExpanded] = useState(false)

  function startEdit() {
    setInputVal(editableValue(def, cfg))
    setEditing(true)
  }

  function commitEdit() {
    onSave(def, inputVal)
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
  }

  const examples = def.calcExample(cfg)

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
        {/* パラメータ名 */}
        <td className="px-4 py-3 align-top">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">{def.label}</span>
            <span className="text-[10px] text-muted-foreground leading-relaxed">{def.description}</span>
          </div>
        </td>

        {/* 計算式 */}
        <td className="px-4 py-3 align-top hidden md:table-cell">
          <div className="flex flex-col gap-1">
            <code className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-1 rounded font-mono leading-relaxed">
              {def.formula}
            </code>
            <button
              className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-fit"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
              計算例を{expanded ? "閉じる" : "見る"}
            </button>
          </div>
        </td>

        {/* 現在値（インプット） */}
        <td className="px-4 py-3 align-top w-52">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                className="h-7 text-xs w-28 font-mono"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit()
                  if (e.key === "Escape") cancelEdit()
                }}
                autoFocus
              />
              <span className="text-[10px] text-muted-foreground shrink-0">{def.unit}</span>
              <button
                className="flex size-6 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                onClick={commitEdit}
                title="確定"
              >
                <CheckIcon className="size-3.5" />
              </button>
              <button
                className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary transition-colors"
                onClick={cancelEdit}
                title="キャンセル"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs ${dirty ? "text-amber-600 font-semibold" : "text-foreground"}`}>
                {displayValue(def, cfg)}
              </span>
              {dirty && (
                <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-400 text-amber-600 bg-amber-50">
                  未保存
                </Badge>
              )}
              <button
                className="flex size-6 items-center justify-center rounded text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground transition-all"
                onClick={startEdit}
                title="編集"
              >
                <PencilIcon className="size-3" />
              </button>
            </div>
          )}
        </td>

        {/* アウトプット例（折りたたみ前は最初の1件だけ） */}
        <td className="px-4 py-3 align-top hidden lg:table-cell">
          <div className="flex flex-col gap-1">
            {examples.slice(0, 1).map((ex) => (
              <div key={ex.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{ex.label}</span>
                <span className="text-[10px] font-mono font-medium text-foreground tabular-nums">
                  → {ex.value}
                </span>
              </div>
            ))}
          </div>
        </td>
      </tr>

      {/* 展開行: 計算例の詳細 */}
      {expanded && (
        <tr className="border-b border-border/50 bg-muted/10">
          <td colSpan={4} className="px-4 pb-3 pt-0">
            <div className="ml-2 mt-1 rounded-md border border-border/60 bg-card p-3">
              <p className="text-[10px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <InfoIcon className="size-3" />
                計算例（現在の値を使用）
              </p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {examples.map((ex) => (
                  <div
                    key={ex.label}
                    className="flex items-center justify-between gap-3 rounded bg-muted/40 px-3 py-1.5"
                  >
                    <span className="text-[10px] text-muted-foreground">{ex.label}</span>
                    <span className="text-[10px] font-mono font-semibold text-foreground tabular-nums">
                      {ex.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────────────────────────

export function FormulaParamsClient() {
  const [original, setOriginal] = useState<CalcParameterConfig | null>(null)
  const [current, setCurrent] = useState<CalcParameterConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDemo, setIsDemo] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const loadParams = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/master/calc-params", { cache: "no-store" })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.params) {
        // DB未接続時はデモデータで表示
        setOriginal(DEMO_CONFIG)
        setCurrent(DEMO_CONFIG)
        setIsDemo(true)
        return
      }
      setOriginal(payload.params)
      setCurrent(payload.params)
      setIsDemo(false)
    } catch {
      setOriginal(DEMO_CONFIG)
      setCurrent(DEMO_CONFIG)
      setIsDemo(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadParams()
  }, [loadParams])

  function handleParamSave(def: ParamDef, raw: string) {
    if (!current) return
    setCurrent((prev) => prev ? def.setValue(prev, raw) : prev)
  }

  function isDirty(def: ParamDef): boolean {
    if (!original || !current) return false
    return def.getValue(original) !== def.getValue(current)
  }

  const hasDirty = original && current && PARAM_DEFS.some((d) => d.getValue(original) !== d.getValue(current))

  async function saveAll() {
    if (!current) return
    if (isDemo) {
      toast.warning("デモモードでは保存できません。DBを接続してください。")
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.params) {
        toast.error("計算パラメータの保存に失敗しました。")
        return
      }
      toast.success("計算パラメータを保存しました。")
      await loadParams()
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSaving(false)
    }
  }

  function resetAll() {
    if (!original) return
    setCurrent(original)
    toast("変更をリセットしました。")
  }

  function toggleGroup(group: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  // ── ローディング中 ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-7">
        <div className="rounded-lg border border-border bg-card overflow-hidden animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-4">
              <div className="h-4 bg-muted rounded w-36" />
              <div className="h-3 bg-muted/60 rounded w-64 hidden md:block" />
              <div className="h-4 bg-muted rounded w-24 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── エラー時 ────────────────────────────────────────────────
  if (!current) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-7">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          DBから計算パラメータを取得できませんでした。初期データ投入後に再度お試しください。
        </div>
      </div>
    )
  }

  // ── メイン ──────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl px-8 py-7 space-y-4">
      {/* デモモードバナー */}
      {isDemo && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <InfoIcon className="size-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-700">デモモードで表示中</p>
            <p className="text-[11px] text-amber-600 mt-0.5">
              DBへの接続が確認できないため、サンプル値で表示しています。値の編集は可能ですが、保存にはDB接続が必要です。
            </p>
          </div>
        </div>
      )}

      {/* ツールバー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasDirty && (
            <Badge variant="outline" className="border-amber-400 text-amber-600 bg-amber-50 text-[10px]">
              {PARAM_DEFS.filter(isDirty).length} 件の未保存変更
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasDirty && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={resetAll}
              disabled={isSaving}
            >
              <XIcon className="size-3.5" />
              リセット
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={saveAll}
            disabled={isSaving || !hasDirty}
          >
            <SaveIcon className="size-3.5" />
            {isSaving ? "保存中..." : "すべて保存"}
          </Button>
        </div>
      </div>

      {/* グループ別テーブル */}
      {GROUPS.map((group) => {
        const defs = PARAM_DEFS.filter((d) => d.group === group)
        const collapsed = collapsedGroups.has(group)
        const dirtyCount = defs.filter(isDirty).length

        return (
          <div key={group} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* グループヘッダ */}
            <button
              className="w-full flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-muted/10 transition-colors"
              onClick={() => toggleGroup(group)}
            >
              <div className="flex items-center gap-2">
                {collapsed ? (
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-semibold text-foreground">{group}</span>
                <span className="text-[10px] text-muted-foreground">
                  {defs.length} パラメータ
                </span>
                {dirtyCount > 0 && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-400 text-amber-600 bg-amber-50">
                    {dirtyCount} 変更
                  </Badge>
                )}
              </div>
            </button>

            {/* テーブル */}
            {!collapsed && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-64">
                        パラメータ
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                        計算式への影響
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-52">
                        現在値（インプット）
                      </th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                        アウトプット例
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {defs.map((def) => (
                      <ParamRow
                        key={def.id}
                        def={def}
                        cfg={current}
                        dirty={isDirty(def)}
                        onSave={handleParamSave}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {/* 注意書き */}
      <p className="text-[10px] text-muted-foreground/60 text-right">
        ※ 保存後、次回の試算から新しいパラメータが適用されます。
      </p>
    </div>
  )
}
