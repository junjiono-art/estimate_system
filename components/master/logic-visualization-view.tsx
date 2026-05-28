"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  CreditCardIcon,
  GitBranchIcon,
  LayersIcon,
  MegaphoneIcon,
  NetworkIcon,
  SaveIcon,
  SparklesIcon,
  UsersIcon,
  VariableIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CalcParameterConfig } from "@/lib/types"
import { DEFAULT_CALC_PARAMS } from "@/lib/default-calc-params"
import { toast } from "sonner"
import { DependencyGraph } from "@/components/master/dependency-graph"

type SectionKey = "fee" | "competitor" | "adCost"

const SECTION_HIGHLIGHT_KEYS: Record<SectionKey, string[]> = {
  fee: ["paymentFeeRate", "royaltyCapMonthly", "appFeeMonthly", "paymentFee", "monthlyRoyalty", "appFee"],
  competitor: ["initialJoiners", "demandMultiplier"],
  adCost: ["adCostMonthly"],
}

type LogicVisualizationResponse = {
  generatedAt: string
  source: {
    hasLambdaGateway: boolean
    formulaSetSource: string
  }
  activeFormulaSet: {
    setVersion: string
    status: string
    comment: string
    createdBy: string
    createdAt: string
    basedOnVersion?: string
  } | null
  summary: {
    formulaCount: number
    variableCount: number
    dependencyCount: number
  }
  formulas: Array<{
    key: string
    label: string
    tokenCount: number
    expression: string
    inputVars: string[]
    dependsOn: string[]
    phase: "pre" | "monthly" | "post"
  }>
  variables: Array<{
    key: string
    label: string
    source: string
    unit?: string
    description?: string
  }>
  dependencies: Array<{
    key: string
    label: string
    dependsOn: string[]
    phase: "pre" | "monthly" | "post"
  }>
  warnings: string[]
}

type CalcParamsPayload = {
  params?: CalcParameterConfig
  error?: { message?: string }
}

const DEMO_CALC_PARAMS: CalcParameterConfig = DEFAULT_CALC_PARAMS

function MetaCard({
  title,
  value,
  note,
  icon: Icon,
  accent = "primary",
}: {
  title: string
  value: string | number
  note?: string
  icon?: React.ComponentType<{ className?: string }>
  accent?: "primary" | "chart-1" | "chart-2" | "chart-3" | "chart-4"
}) {
  const accentStyles: Record<string, string> = {
    primary: "border-l-primary/60 bg-gradient-to-br from-primary/5 to-transparent",
    "chart-1": "border-l-chart-1/60 bg-gradient-to-br from-chart-1/5 to-transparent",
    "chart-2": "border-l-chart-2/60 bg-gradient-to-br from-chart-2/5 to-transparent",
    "chart-3": "border-l-chart-3/60 bg-gradient-to-br from-chart-3/5 to-transparent",
    "chart-4": "border-l-chart-4/60 bg-gradient-to-br from-chart-4/5 to-transparent",
  }
  const iconStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    "chart-1": "bg-chart-1/10 text-chart-1",
    "chart-2": "bg-chart-2/10 text-chart-2",
    "chart-3": "bg-chart-3/10 text-chart-3",
    "chart-4": "bg-chart-4/10 text-chart-4",
  }
  return (
    <Card className={`border-l-4 transition-shadow hover:shadow-md ${accentStyles[accent]}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardDescription className="text-[11px] uppercase tracking-wider">{title}</CardDescription>
            <CardTitle className="mt-1 truncate text-lg font-bold">{value}</CardTitle>
          </div>
          {Icon && (
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${iconStyles[accent]}`}>
              <Icon className="size-4" />
            </div>
          )}
        </div>
      </CardHeader>
      {note ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  accent = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  accent?: "primary" | "chart-1" | "chart-2" | "chart-3" | "chart-4"
}) {
  const iconStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    "chart-1": "bg-chart-1/10 text-chart-1",
    "chart-2": "bg-chart-2/10 text-chart-2",
    "chart-3": "bg-chart-3/10 text-chart-3",
    "chart-4": "bg-chart-4/10 text-chart-4",
  }
  return (
    <div className="flex items-start gap-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconStyles[accent]}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function InfoTile({
  label,
  children,
  accent = "muted",
}: {
  label: string
  children: React.ReactNode
  accent?: "muted" | "chart-1" | "chart-2" | "chart-3" | "chart-4"
}) {
  const accentStyles: Record<string, string> = {
    muted: "border-border/60 bg-muted/30",
    "chart-1": "border-chart-1/30 bg-chart-1/5",
    "chart-2": "border-chart-2/30 bg-chart-2/5",
    "chart-3": "border-chart-3/30 bg-chart-3/5",
    "chart-4": "border-chart-4/30 bg-chart-4/5",
  }
  return (
    <div className={`rounded-lg border p-3 ${accentStyles[accent]}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-xs leading-relaxed text-foreground">{children}</div>
    </div>
  )
}

function SuffixedInput({
  id,
  value,
  onChange,
  disabled,
  suffix,
  inputMode = "decimal",
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  suffix: string
  inputMode?: "decimal" | "numeric"
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="pr-10"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  )
}

function parseRequiredNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

// 比率（0.034567 など）を % 文字列に変換する際の浮動小数誤差を除去する
// 例: 0.001 * 100 → 0.10000000000000002 を "0.1" に丸める
function formatRatePercent(rate: number): string {
  if (!Number.isFinite(rate)) return ""
  // 小数点以下 6 桁で丸めてから Number 経由で末尾の余計な 0 と小数点を除去
  return Number((rate * 100).toFixed(6)).toString()
}

function toCalcUnitLabel(unit: LogicVisualizationResponse["formulas"][number]["phase"]): string {
  if (unit === "pre") return "初期計算"
  if (unit === "monthly") return "月次計算"
  return "集計"
}

function buildFormulaLines(
  formulas: LogicVisualizationResponse["formulas"],
  pairs: Array<{ key: string; label: string; fallback: string }>,
): string[] {
  const formulaMap = new Map(formulas.map((formula) => [formula.key, formula]))
  return pairs.map(({ key, label, fallback }) => {
    const formula = formulaMap.get(key)
    if (!formula?.expression) return `${label}: ${fallback}`
    const formulaLabel = formula.label || label
    return `${formulaLabel}: ${formula.expression}`
  })
}

export function LogicVisualizationView() {
  const [data, setData] = useState<LogicVisualizationResponse | null>(null)
  const [calcParams, setCalcParams] = useState<CalcParameterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calcWarning, setCalcWarning] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isSavingStep1, setIsSavingStep1] = useState(false)
  const [isSavingStep2, setIsSavingStep2] = useState(false)
  const [isSavingStep3, setIsSavingStep3] = useState(false)
  const [paymentFeeRatePercent, setPaymentFeeRatePercent] = useState("")
  const [royaltyCapMonthly, setRoyaltyCapMonthly] = useState("")
  const [appFeeMonthly, setAppFeeMonthly] = useState("")
  const [competitorUpTo2Percent, setCompetitorUpTo2Percent] = useState("")
  const [competitorFor3Percent, setCompetitorFor3Percent] = useState("")
  const [competitorFor4Percent, setCompetitorFor4Percent] = useState("")
  const [competitorOver4Percent, setCompetitorOver4Percent] = useState("")
  const [adCostYear1Month1, setAdCostYear1Month1] = useState("")
  const [adCostYear1Month2, setAdCostYear1Month2] = useState("")
  const [adCostYear1Month3To4, setAdCostYear1Month3To4] = useState("")
  const [adCostYear1Month5To12, setAdCostYear1Month5To12] = useState("")
  const [adCostYear2Monthly, setAdCostYear2Monthly] = useState("")
  const [adCostYear3PlusMonthly, setAdCostYear3PlusMonthly] = useState("")
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null)

  function syncFeeParams(params: CalcParameterConfig) {
    setPaymentFeeRatePercent(formatRatePercent(params.paymentFeeRate))
    setRoyaltyCapMonthly(String(params.royaltyCapMonthly))
    setAppFeeMonthly(String(params.appFeeMonthly))
  }

  function syncCompetitorParams(params: CalcParameterConfig) {
    setCompetitorUpTo2Percent(formatRatePercent(params.competitorImpact.upTo2))
    setCompetitorFor3Percent(formatRatePercent(params.competitorImpact.for3))
    setCompetitorFor4Percent(formatRatePercent(params.competitorImpact.for4))
    setCompetitorOver4Percent(formatRatePercent(params.competitorImpact.over4))
  }

  function syncAdCostParams(params: CalcParameterConfig) {
    setAdCostYear1Month1(String(params.adCost.year1Month1))
    setAdCostYear1Month2(String(params.adCost.year1Month2))
    setAdCostYear1Month3To4(String(params.adCost.year1Month3To4))
    setAdCostYear1Month5To12(String(params.adCost.year1Month5To12))
    setAdCostYear2Monthly(String(params.adCost.year2Monthly))
    setAdCostYear3PlusMonthly(String(params.adCost.year3PlusMonthly))
  }

  function syncAllParams(params: CalcParameterConfig) {
    syncFeeParams(params)
    syncCompetitorParams(params)
    syncAdCostParams(params)
  }

  async function fetchLatestCalcParams(): Promise<CalcParameterConfig | null> {
    const latestResponse = await fetch("/api/master/calc-params", { cache: "no-store" })
    const latestPayload = (await latestResponse.json().catch(() => null)) as CalcParamsPayload | null
    if (!latestResponse.ok || !latestPayload?.params) {
      const message = latestPayload?.error?.message || "最新の計算パラメータ取得に失敗しました。"
      toast.error(message)
      return null
    }
    return latestPayload.params
  }

  async function saveStep1Params() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }

    const paymentFeeRateRaw = parseRequiredNumber(paymentFeeRatePercent)
    const royaltyCapRaw = parseRequiredNumber(royaltyCapMonthly)
    const appFeeRaw = parseRequiredNumber(appFeeMonthly)

    if (paymentFeeRateRaw === null || paymentFeeRateRaw < 0 || paymentFeeRateRaw > 100) {
      toast.error("決済手数料率は 0〜100 の範囲で入力してください。")
      return
    }

    if (royaltyCapRaw === null || royaltyCapRaw < 0) {
      toast.error("ロイヤリティ月額上限は 0 以上で入力してください。")
      return
    }

    if (appFeeRaw === null || appFeeRaw < 0) {
      toast.error("アプリ利用料は 0 以上で入力してください。")
      return
    }

    setIsSavingStep1(true)
    try {
      const latestParams = await fetchLatestCalcParams()
      if (!latestParams) return

      const nextPayload: CalcParameterConfig = {
        ...latestParams,
        paymentFeeRate: paymentFeeRateRaw / 100,
        royaltyCapMonthly: Math.round(royaltyCapRaw),
        appFeeMonthly: Math.round(appFeeRaw),
      }

      const response = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      })
      const payload = (await response.json().catch(() => null)) as { params?: CalcParameterConfig; error?: { message?: string } } | null

      if (!response.ok || !payload?.params) {
        const message = payload?.error?.message || "計算パラメータの保存に失敗しました。"
        toast.error(message)
        return
      }

      setCalcParams(payload.params)
      syncFeeParams(payload.params)
      toast.success("手数料・上限パラメータを保存しました。")
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSavingStep1(false)
    }
  }

  async function saveStep2Params() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }

    const upTo2Raw = parseRequiredNumber(competitorUpTo2Percent)
    const for3Raw = parseRequiredNumber(competitorFor3Percent)
    const for4Raw = parseRequiredNumber(competitorFor4Percent)
    const over4Raw = parseRequiredNumber(competitorOver4Percent)

    const rates = [upTo2Raw, for3Raw, for4Raw, over4Raw]
    if (rates.some((value) => value === null || value < 0 || value > 100)) {
      toast.error("競合影響率はすべて 0〜100 の範囲で入力してください。")
      return
    }

    setIsSavingStep2(true)
    try {
      const latestParams = await fetchLatestCalcParams()
      if (!latestParams) return

      const nextPayload: CalcParameterConfig = {
        ...latestParams,
        competitorImpact: {
          ...latestParams.competitorImpact,
          upTo2: (upTo2Raw as number) / 100,
          for3: (for3Raw as number) / 100,
          for4: (for4Raw as number) / 100,
          over4: (over4Raw as number) / 100,
        },
      }

      const response = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      })
      const payload = (await response.json().catch(() => null)) as { params?: CalcParameterConfig; error?: { message?: string } } | null

      if (!response.ok || !payload?.params) {
        const message = payload?.error?.message || "計算パラメータの保存に失敗しました。"
        toast.error(message)
        return
      }

      setCalcParams(payload.params)
      syncCompetitorParams(payload.params)
      toast.success("競合影響率パラメータを保存しました。")
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSavingStep2(false)
    }
  }

  async function saveStep3Params() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }

    const year1Month1Raw = parseRequiredNumber(adCostYear1Month1)
    const year1Month2Raw = parseRequiredNumber(adCostYear1Month2)
    const year1Month3To4Raw = parseRequiredNumber(adCostYear1Month3To4)
    const year1Month5To12Raw = parseRequiredNumber(adCostYear1Month5To12)
    const year2MonthlyRaw = parseRequiredNumber(adCostYear2Monthly)
    const year3PlusMonthlyRaw = parseRequiredNumber(adCostYear3PlusMonthly)

    const values = [
      year1Month1Raw,
      year1Month2Raw,
      year1Month3To4Raw,
      year1Month5To12Raw,
      year2MonthlyRaw,
      year3PlusMonthlyRaw,
    ]

    if (values.some((value) => value === null || value < 0)) {
      toast.error("広告費はすべて 0 以上で入力してください。")
      return
    }

    setIsSavingStep3(true)
    try {
      const latestParams = await fetchLatestCalcParams()
      if (!latestParams) return

      const nextPayload: CalcParameterConfig = {
        ...latestParams,
        adCost: {
          ...latestParams.adCost,
          year1Month1: Math.round(year1Month1Raw as number),
          year1Month2: Math.round(year1Month2Raw as number),
          year1Month3To4: Math.round(year1Month3To4Raw as number),
          year1Month5To12: Math.round(year1Month5To12Raw as number),
          year2Monthly: Math.round(year2MonthlyRaw as number),
          year3PlusMonthly: Math.round(year3PlusMonthlyRaw as number),
        },
      }

      const response = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      })
      const payload = (await response.json().catch(() => null)) as { params?: CalcParameterConfig; error?: { message?: string } } | null

      if (!response.ok || !payload?.params) {
        const message = payload?.error?.message || "計算パラメータの保存に失敗しました。"
        toast.error(message)
        return
      }

      setCalcParams(payload.params)
      syncAdCostParams(payload.params)
      toast.success("広告費パラメータを保存しました。")
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSavingStep3(false)
    }
  }

  useEffect(() => {
    let disposed = false

    async function load() {
      setLoading(true)
      setError(null)
      setCalcWarning(null)
      setIsDemoMode(false)

      try {
        const [logicResponse, calcResponse] = await Promise.all([
          fetch("/api/master/logic-visualization", { cache: "no-store" }),
          fetch("/api/master/calc-params", { cache: "no-store" }),
        ])

        const logicPayload = (await logicResponse.json().catch(() => null)) as LogicVisualizationResponse | { error?: { message?: string } } | null
        const calcPayload = (await calcResponse.json().catch(() => null)) as CalcParamsPayload | { error?: { message?: string } } | null

        if (!logicResponse.ok) {
          const message =
            logicPayload && typeof logicPayload === "object" && "error" in logicPayload && logicPayload.error?.message
              ? logicPayload.error.message
              : "ロジック可視化データの取得に失敗しました。"
          if (!disposed) setError(message)
          return
        }

        if (!calcResponse.ok) {
          const message =
            calcPayload && typeof calcPayload === "object" && "error" in calcPayload && calcPayload.error?.message
              ? calcPayload.error.message
              : "計算パラメータの取得に失敗しました。"
          if (!disposed) {
            setData(logicPayload as LogicVisualizationResponse)
            setCalcParams(DEMO_CALC_PARAMS)
            setIsDemoMode(true)
            setCalcWarning(message)
            syncAllParams(DEMO_CALC_PARAMS)
          }
          return
        }

        if (!disposed) {
          setData(logicPayload as LogicVisualizationResponse)
          const params = (calcPayload as CalcParamsPayload)?.params ?? null
          setCalcParams(params)
          setIsDemoMode(false)
          if (params) {
            syncAllParams(params)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "ロジック可視化データの取得に失敗しました。"
        if (!disposed) setError(message)
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void load()

    return () => {
      disposed = true
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const formulaLabelMap = new Map(data.formulas.map((formula) => [formula.key, formula.label]))
  const toFormulaLabel = (key: string): string => formulaLabelMap.get(key) || "未定義の式"

  const feeFormulaLines = buildFormulaLines(data.formulas, [
    { key: "paymentFee", label: "決済手数料", fallback: "有効な式セット定義を参照" },
    { key: "monthlyRoyalty", label: "月次ロイヤリティ", fallback: "有効な式セット定義を参照" },
    { key: "appFee", label: "アプリ利用料", fallback: "有効な式セット定義を参照" },
  ])
  const competitorFormulaLines = buildFormulaLines(data.formulas, [
    { key: "initialJoiners", label: "初月入会人数", fallback: "有効な式セット定義を参照" },
    { key: "demandMultiplier", label: "需要乗数", fallback: "有効な式セット定義を参照" },
  ])
  const adCostFormulaLines = buildFormulaLines(data.formulas, [
    { key: "adCostMonthly", label: "月次広告費", fallback: "有効な式セット定義を参照" },
    {
      key: "monthlyCost",
      label: "月次総コスト",
      fallback: "有効な式セット定義を参照",
    },
  ])

  return (
    <div className="space-y-5 p-6">
      {isDemoMode ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>デモ表示</AlertTitle>
          <AlertDescription>
            計算パラメータの取得に失敗したため、デモ値で表示しています。保存先が利用可能な環境ではそのまま反映できます。
          </AlertDescription>
        </Alert>
      ) : null}

      {calcWarning ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>計算パラメータ警告</AlertTitle>
          <AlertDescription>{calcWarning}</AlertDescription>
        </Alert>
      ) : null}

      {data.warnings.length > 0 ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>注意事項</AlertTitle>
          <AlertDescription>
            {data.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetaCard
          title="アクティブ式セット"
          value={data.activeFormulaSet?.setVersion || "未取得"}
          note={data.activeFormulaSet?.status || "status: unknown"}
          icon={SparklesIcon}
          accent="primary"
        />
        <MetaCard title="式数" value={data.summary.formulaCount} icon={LayersIcon} accent="chart-1" />
        <MetaCard title="変数数" value={data.summary.variableCount} icon={VariableIcon} accent="chart-2" />
        <MetaCard
          title="取得時刻"
          value={new Date(data.generatedAt).toLocaleString("ja-JP")}
          note={data.source.formulaSetSource}
          icon={GitBranchIcon}
          accent="chart-4"
        />
      </div>

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
        <SectionHeader
          icon={NetworkIcon}
          title="依存関係グラフ"
          description="式同士の依存関係を計算フェーズ別に表示します。下のセクションにマウスを乗せると、そのパラメータが影響する式がハイライトされます。"
          accent="primary"
        />
        <DependencyGraph
          formulas={data.formulas}
          highlightedParamKeys={activeSection ? SECTION_HIGHLIGHT_KEYS[activeSection] : []}
        />
      </section>

      <section
        className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
        onMouseEnter={() => setActiveSection("fee")}
        onMouseLeave={() => setActiveSection((current) => (current === "fee" ? null : current))}
        onFocus={() => setActiveSection("fee")}
        onBlur={() => setActiveSection((current) => (current === "fee" ? null : current))}
      >
        <SectionHeader
          icon={CreditCardIcon}
          title="手数料・上限"
          description="決済手数料率、ロイヤリティ上限、アプリ利用料を管理します。"
          accent="chart-1"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="式" accent="chart-1">
            {feeFormulaLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </InfoTile>
          <InfoTile label="影響範囲">月次損益、ロイヤリティ計算、キャッシュフローに影響</InfoTile>
          <InfoTile label="インプット">決済手数料率 / ロイヤリティ月額上限 / アプリ利用料</InfoTile>
          <InfoTile label="アウトプット">決済手数料 / 月次ロイヤリティ / 月次損益 など</InfoTile>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="paymentFeeRateStep1" className="text-xs font-medium">決済手数料率</Label>
            <SuffixedInput
              id="paymentFeeRateStep1"
              value={paymentFeeRatePercent}
              onChange={setPaymentFeeRatePercent}
              disabled={isSavingStep1}
              suffix="%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="royaltyCapMonthlyStep1" className="text-xs font-medium">ロイヤリティ月額上限</Label>
            <SuffixedInput
              id="royaltyCapMonthlyStep1"
              value={royaltyCapMonthly}
              onChange={setRoyaltyCapMonthly}
              disabled={isSavingStep1}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appFeeMonthlyStep1" className="text-xs font-medium">アプリ利用料</Label>
            <SuffixedInput
              id="appFeeMonthlyStep1"
              value={appFeeMonthly}
              onChange={setAppFeeMonthly}
              disabled={isSavingStep1}
              suffix="円/月"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep1Params} disabled={isSavingStep1} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep1 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      <section
        className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
        onMouseEnter={() => setActiveSection("competitor")}
        onMouseLeave={() => setActiveSection((current) => (current === "competitor" ? null : current))}
        onFocus={() => setActiveSection("competitor")}
        onBlur={() => setActiveSection((current) => (current === "competitor" ? null : current))}
      >
        <SectionHeader
          icon={UsersIcon}
          title="競合影響率"
          description="競合店舗数に応じた需要減衰率を設定します。"
          accent="chart-2"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="式" accent="chart-2">
            {competitorFormulaLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </InfoTile>
          <InfoTile label="影響範囲">需要予測、売上予測、損益シミュレーション全体に影響</InfoTile>
          <InfoTile label="インプット">競合影響率（1〜2店舗 / 3店舗 / 4店舗 / 5店舗以上）</InfoTile>
          <InfoTile label="アウトプット">需要乗数 / 売上予測 / 月次損益 など</InfoTile>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="competitorUpTo2Step2" className="text-xs font-medium">競合1〜2店舗</Label>
            <SuffixedInput
              id="competitorUpTo2Step2"
              value={competitorUpTo2Percent}
              onChange={setCompetitorUpTo2Percent}
              disabled={isSavingStep2}
              suffix="%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorFor3Step2" className="text-xs font-medium">競合3店舗</Label>
            <SuffixedInput
              id="competitorFor3Step2"
              value={competitorFor3Percent}
              onChange={setCompetitorFor3Percent}
              disabled={isSavingStep2}
              suffix="%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorFor4Step2" className="text-xs font-medium">競合4店舗</Label>
            <SuffixedInput
              id="competitorFor4Step2"
              value={competitorFor4Percent}
              onChange={setCompetitorFor4Percent}
              disabled={isSavingStep2}
              suffix="%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorOver4Step2" className="text-xs font-medium">競合5店舗以上</Label>
            <SuffixedInput
              id="competitorOver4Step2"
              value={competitorOver4Percent}
              onChange={setCompetitorOver4Percent}
              disabled={isSavingStep2}
              suffix="%"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep2Params} disabled={isSavingStep2} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep2 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      <section
        className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
        onMouseEnter={() => setActiveSection("adCost")}
        onMouseLeave={() => setActiveSection((current) => (current === "adCost" ? null : current))}
        onFocus={() => setActiveSection("adCost")}
        onBlur={() => setActiveSection((current) => (current === "adCost" ? null : current))}
      >
        <SectionHeader
          icon={MegaphoneIcon}
          title="広告費テーブル"
          description="月次広告費のルールを年次・月次区分で設定します。"
          accent="chart-4"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="式" accent="chart-4">
            {adCostFormulaLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </InfoTile>
          <InfoTile label="影響範囲">月次販促費、損益推移、投資回収期間に影響</InfoTile>
          <InfoTile label="インプット">広告費テーブル（1年目1月〜3年目以降）</InfoTile>
          <InfoTile label="アウトプット">月次広告費 / 月次損益 / 累積キャッシュフロー など</InfoTile>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month1Step3" className="text-xs font-medium">1年目 1月</Label>
            <SuffixedInput
              id="adCostYear1Month1Step3"
              value={adCostYear1Month1}
              onChange={setAdCostYear1Month1}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month2Step3" className="text-xs font-medium">1年目 2月</Label>
            <SuffixedInput
              id="adCostYear1Month2Step3"
              value={adCostYear1Month2}
              onChange={setAdCostYear1Month2}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month34Step3" className="text-xs font-medium">1年目 3〜4月</Label>
            <SuffixedInput
              id="adCostYear1Month34Step3"
              value={adCostYear1Month3To4}
              onChange={setAdCostYear1Month3To4}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month512Step3" className="text-xs font-medium">1年目 5〜12月</Label>
            <SuffixedInput
              id="adCostYear1Month512Step3"
              value={adCostYear1Month5To12}
              onChange={setAdCostYear1Month5To12}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear2MonthlyStep3" className="text-xs font-medium">2年目 毎月</Label>
            <SuffixedInput
              id="adCostYear2MonthlyStep3"
              value={adCostYear2Monthly}
              onChange={setAdCostYear2Monthly}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear3PlusMonthlyStep3" className="text-xs font-medium">3年目以降 毎月</Label>
            <SuffixedInput
              id="adCostYear3PlusMonthlyStep3"
              value={adCostYear3PlusMonthly}
              onChange={setAdCostYear3PlusMonthly}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep3Params} disabled={isSavingStep3} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep3 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3">
              <LayersIcon className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">式一覧</CardTitle>
              <CardDescription className="text-xs">現在アクティブな式セットに含まれる定義（閲覧専用）</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-medium">ラベル</TableHead>
                  <TableHead className="text-xs font-medium">計算区分</TableHead>
                  <TableHead className="text-xs font-medium">依存</TableHead>
                  <TableHead className="text-xs font-medium">定義</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.formulas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      取得可能な式セットがありません。
                    </TableCell>
                  </TableRow>
                ) : (
                  data.formulas.map((formula) => (
                    <TableRow key={formula.key} className="border-border/40">
                      <TableCell className="text-xs font-medium">{formula.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{toCalcUnitLabel(formula.phase)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formula.dependsOn.length > 0 ? formula.dependsOn.map(toFormulaLabel).join("、") : "-"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-normal text-muted-foreground">
                        {formula.expression || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                <VariableIcon className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">変数定義</CardTitle>
                <CardDescription className="text-xs">入力・定数・派生値・地理情報の一覧（折りたたみ表示）</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <details className="group rounded-md border border-border/60">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
                <span>変数定義を表示する</span>
              </summary>
              <div className="border-t border-border/60 p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ラベル</TableHead>
                      <TableHead>ソース</TableHead>
                      <TableHead>単位</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.variables.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell>{item.source}</TableCell>
                        <TableCell>{item.unit || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4">
                <GitBranchIcon className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">依存関係</CardTitle>
                <CardDescription className="text-xs">式同士の依存定義（折りたたみ表示）</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <details className="group rounded-md border border-border/60">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
                <span>依存関係を表示する</span>
              </summary>
              <div className="border-t border-border/60 p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>対象式</TableHead>
                      <TableHead>計算区分</TableHead>
                      <TableHead>依存先</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dependencies.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>{toFormulaLabel(item.key)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{toCalcUnitLabel(item.phase)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.dependsOn.length > 0 ? item.dependsOn.map(toFormulaLabel).join("、") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
