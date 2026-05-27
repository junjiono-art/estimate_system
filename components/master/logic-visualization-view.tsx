"use client"

import { useEffect, useState } from "react"
import { AlertTriangleIcon, SaveIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CalcParameterConfig } from "@/lib/types"
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

const DEMO_CALC_PARAMS: CalcParameterConfig = {
  paymentFeeRate: 0.035,
  royaltyCapMonthly: 300_000,
  appFeeMonthly: 10_000,
  competitorImpact: {
    upTo2: 0.1,
    for3: 0.15,
    for4: 0.2,
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

function MetaCard({ title, value, note }: { title: string; value: string | number; note?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
      {note ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

function parseRequiredNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
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
    setPaymentFeeRatePercent(String(params.paymentFeeRate * 100))
    setRoyaltyCapMonthly(String(params.royaltyCapMonthly))
    setAppFeeMonthly(String(params.appFeeMonthly))
  }

  function syncCompetitorParams(params: CalcParameterConfig) {
    setCompetitorUpTo2Percent(String(params.competitorImpact.upTo2 * 100))
    setCompetitorFor3Percent(String(params.competitorImpact.for3 * 100))
    setCompetitorFor4Percent(String(params.competitorImpact.for4 * 100))
    setCompetitorOver4Percent(String(params.competitorImpact.over4 * 100))
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
    <div className="space-y-4 p-6">
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
        />
        <MetaCard title="式数" value={data.summary.formulaCount} />
        <MetaCard title="変数数" value={data.summary.variableCount} />
        <MetaCard
          title="取得時刻"
          value={new Date(data.generatedAt).toLocaleString("ja-JP")}
          note={data.source.formulaSetSource}
        />
      </div>

      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">依存関係グラフ</h2>
          <p className="text-xs text-muted-foreground">
            式同士の依存関係を計算フェーズ別に表示します。下のセクションにマウスを乗せると、そのパラメータが影響する式がハイライトされます。
          </p>
        </div>
        <DependencyGraph
          formulas={data.formulas}
          highlightedParamKeys={activeSection ? SECTION_HIGHLIGHT_KEYS[activeSection] : []}
        />
      </section>

      <section
        className="rounded-lg border border-border bg-card p-5 space-y-4"
        onMouseEnter={() => setActiveSection("fee")}
        onMouseLeave={() => setActiveSection((current) => (current === "fee" ? null : current))}
        onFocus={() => setActiveSection("fee")}
        onBlur={() => setActiveSection((current) => (current === "fee" ? null : current))}
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">手数料・上限</h2>
          <p className="text-xs text-muted-foreground">決済手数料率、ロイヤリティ上限、アプリ利用料を管理します。</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">式</p>
            {feeFormulaLines.map((line, index) => (
              <p key={line} className={`${index === 0 ? "mt-1 " : ""}text-xs leading-relaxed`}>
                {line}
              </p>
            ))}
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">影響範囲</p>
            <p className="mt-1 text-xs leading-relaxed">月次損益、ロイヤリティ計算、キャッシュフローに影響</p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">インプット</p>
            <p className="mt-1 text-xs leading-relaxed">決済手数料率 / ロイヤリティ月額上限 / アプリ利用料</p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">アウトプット</p>
            <p className="mt-1 text-xs leading-relaxed">決済手数料 / 月次ロイヤリティ / 月次損益 など</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="paymentFeeRateStep1">決済手数料率（%）</Label>
            <Input
              id="paymentFeeRateStep1"
              inputMode="decimal"
              value={paymentFeeRatePercent}
              onChange={(event) => setPaymentFeeRatePercent(event.target.value)}
              disabled={isSavingStep1}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="royaltyCapMonthlyStep1">ロイヤリティ月額上限（円）</Label>
            <Input
              id="royaltyCapMonthlyStep1"
              inputMode="numeric"
              value={royaltyCapMonthly}
              onChange={(event) => setRoyaltyCapMonthly(event.target.value)}
              disabled={isSavingStep1}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appFeeMonthlyStep1">アプリ利用料（円/月）</Label>
            <Input
              id="appFeeMonthlyStep1"
              inputMode="numeric"
              value={appFeeMonthly}
              onChange={(event) => setAppFeeMonthly(event.target.value)}
              disabled={isSavingStep1}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveStep1Params} disabled={isSavingStep1} className="h-8 text-xs">
            <SaveIcon className="size-4" />
            保存
          </Button>
        </div>
      </section>

      <section
        className="rounded-lg border border-border bg-card p-5 space-y-4"
        onMouseEnter={() => setActiveSection("competitor")}
        onMouseLeave={() => setActiveSection((current) => (current === "competitor" ? null : current))}
        onFocus={() => setActiveSection("competitor")}
        onBlur={() => setActiveSection((current) => (current === "competitor" ? null : current))}
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">競合影響率</h2>
          <p className="text-xs text-muted-foreground">競合店舗数に応じた需要減衰率を設定します。</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">式</p>
            {competitorFormulaLines.map((line, index) => (
              <p key={line} className={`${index === 0 ? "mt-1 " : ""}text-xs leading-relaxed`}>
                {line}
              </p>
            ))}
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">影響範囲</p>
            <p className="mt-1 text-xs leading-relaxed">需要予測、売上予測、損益シミュレーション全体に影響</p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">インプット</p>
            <p className="mt-1 text-xs leading-relaxed">競合影響率（1〜2店舗 / 3店舗 / 4店舗 / 5店舗以上）</p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">アウトプット</p>
            <p className="mt-1 text-xs leading-relaxed">需要乗数 / 売上予測 / 月次損益 など</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="competitorUpTo2Step2">競合1〜2店舗（%）</Label>
            <Input
              id="competitorUpTo2Step2"
              inputMode="decimal"
              value={competitorUpTo2Percent}
              onChange={(event) => setCompetitorUpTo2Percent(event.target.value)}
              disabled={isSavingStep2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorFor3Step2">競合3店舗（%）</Label>
            <Input
              id="competitorFor3Step2"
              inputMode="decimal"
              value={competitorFor3Percent}
              onChange={(event) => setCompetitorFor3Percent(event.target.value)}
              disabled={isSavingStep2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorFor4Step2">競合4店舗（%）</Label>
            <Input
              id="competitorFor4Step2"
              inputMode="decimal"
              value={competitorFor4Percent}
              onChange={(event) => setCompetitorFor4Percent(event.target.value)}
              disabled={isSavingStep2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorOver4Step2">競合5店舗以上（%）</Label>
            <Input
              id="competitorOver4Step2"
              inputMode="decimal"
              value={competitorOver4Percent}
              onChange={(event) => setCompetitorOver4Percent(event.target.value)}
              disabled={isSavingStep2}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveStep2Params} disabled={isSavingStep2} className="h-8 text-xs">
            <SaveIcon className="size-4" />
            保存
          </Button>
        </div>
      </section>

      <section
        className="rounded-lg border border-border bg-card p-5 space-y-4"
        onMouseEnter={() => setActiveSection("adCost")}
        onMouseLeave={() => setActiveSection((current) => (current === "adCost" ? null : current))}
        onFocus={() => setActiveSection("adCost")}
        onBlur={() => setActiveSection((current) => (current === "adCost" ? null : current))}
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">広告費テーブル</h2>
          <p className="text-xs text-muted-foreground">月次広告費のルールを年次・月次区分で設定します。</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">式</p>
            {adCostFormulaLines.map((line, index) => (
              <p key={line} className={`${index === 0 ? "mt-1 " : ""}text-xs leading-relaxed`}>
                {line}
              </p>
            ))}
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">影響範囲</p>
            <p className="mt-1 text-xs leading-relaxed">月次販促費、損益推移、投資回収期間に影響</p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">インプット</p>
            <p className="mt-1 text-xs leading-relaxed">広告費テーブル（1年目1月〜3年目以降）</p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">アウトプット</p>
            <p className="mt-1 text-xs leading-relaxed">月次広告費 / 月次損益 / 累積キャッシュフロー など</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month1Step3">1年目 1月（円）</Label>
            <Input
              id="adCostYear1Month1Step3"
              inputMode="numeric"
              value={adCostYear1Month1}
              onChange={(event) => setAdCostYear1Month1(event.target.value)}
              disabled={isSavingStep3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month2Step3">1年目 2月（円）</Label>
            <Input
              id="adCostYear1Month2Step3"
              inputMode="numeric"
              value={adCostYear1Month2}
              onChange={(event) => setAdCostYear1Month2(event.target.value)}
              disabled={isSavingStep3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month34Step3">1年目 3〜4月（円）</Label>
            <Input
              id="adCostYear1Month34Step3"
              inputMode="numeric"
              value={adCostYear1Month3To4}
              onChange={(event) => setAdCostYear1Month3To4(event.target.value)}
              disabled={isSavingStep3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month512Step3">1年目 5〜12月（円）</Label>
            <Input
              id="adCostYear1Month512Step3"
              inputMode="numeric"
              value={adCostYear1Month5To12}
              onChange={(event) => setAdCostYear1Month5To12(event.target.value)}
              disabled={isSavingStep3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear2MonthlyStep3">2年目 毎月（円）</Label>
            <Input
              id="adCostYear2MonthlyStep3"
              inputMode="numeric"
              value={adCostYear2Monthly}
              onChange={(event) => setAdCostYear2Monthly(event.target.value)}
              disabled={isSavingStep3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear3PlusMonthlyStep3">3年目以降 毎月（円）</Label>
            <Input
              id="adCostYear3PlusMonthlyStep3"
              inputMode="numeric"
              value={adCostYear3PlusMonthly}
              onChange={(event) => setAdCostYear3PlusMonthly(event.target.value)}
              disabled={isSavingStep3}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={saveStep3Params} disabled={isSavingStep3} className="h-8 text-xs">
            <SaveIcon className="size-4" />
            保存
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>式一覧</CardTitle>
          <CardDescription>現在アクティブな式セットに含まれる定義（閲覧専用）</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ラベル</TableHead>
                <TableHead>計算区分</TableHead>
                <TableHead>依存</TableHead>
                <TableHead>定義</TableHead>
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
                  <TableRow key={formula.key}>
                    <TableCell>{formula.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{toCalcUnitLabel(formula.phase)}</Badge>
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>変数定義</CardTitle>
            <CardDescription>入力・定数・派生値・地理情報の一覧（折りたたみ表示）</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="group rounded-md border border-border/60">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm text-foreground [&::-webkit-details-marker]:hidden">
                変数定義を表示する
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

        <Card>
          <CardHeader>
            <CardTitle>依存関係</CardTitle>
            <CardDescription>式同士の依存定義（折りたたみ表示）</CardDescription>
          </CardHeader>
          <CardContent>
            <details className="group rounded-md border border-border/60">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm text-foreground [&::-webkit-details-marker]:hidden">
                依存関係を表示する
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
