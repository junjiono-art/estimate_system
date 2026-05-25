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

function formatRate(value: number): string {
  return `${Math.round(value * 10_000) / 100}%`
}

function formatMoney(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`
}

function parseRequiredNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

type EditableParamRow = {
  key: string
  label: string
  currentValue: string
  useCase: string
  group: string
}

function buildEditableParams(params: CalcParameterConfig): EditableParamRow[] {
  return [
    {
      key: "paymentFeeRate",
      label: "決済手数料率",
      currentValue: formatRate(params.paymentFeeRate),
      useCase: "月次売上に対する決済手数料の係数",
      group: "手数料・上限",
    },
    {
      key: "royaltyCapMonthly",
      label: "ロイヤリティ月額上限",
      currentValue: formatMoney(params.royaltyCapMonthly),
      useCase: "月次ロイヤリティのキャップ値",
      group: "手数料・上限",
    },
    {
      key: "appFeeMonthly",
      label: "アプリ利用料",
      currentValue: formatMoney(params.appFeeMonthly),
      useCase: "ロイヤリティ発生月に加算される固定費",
      group: "手数料・上限",
    },
    {
      key: "competitorImpact.upTo2",
      label: "競合影響率（1〜2店舗）",
      currentValue: formatRate(params.competitorImpact.upTo2),
      useCase: "競合数が1〜2店舗のときの需要減衰率",
      group: "競合影響率",
    },
    {
      key: "competitorImpact.for3",
      label: "競合影響率（3店舗）",
      currentValue: formatRate(params.competitorImpact.for3),
      useCase: "競合数が3店舗のときの需要減衰率",
      group: "競合影響率",
    },
    {
      key: "competitorImpact.for4",
      label: "競合影響率（4店舗）",
      currentValue: formatRate(params.competitorImpact.for4),
      useCase: "競合数が4店舗のときの需要減衰率",
      group: "競合影響率",
    },
    {
      key: "competitorImpact.over4",
      label: "競合影響率（5店舗以上）",
      currentValue: formatRate(params.competitorImpact.over4),
      useCase: "競合数が5店舗以上のときの需要減衰率",
      group: "競合影響率",
    },
    {
      key: "adCost.year1Month1",
      label: "広告費（1年目 1月）",
      currentValue: formatMoney(params.adCost.year1Month1),
      useCase: "オープン初月の広告宣伝費",
      group: "広告費テーブル",
    },
    {
      key: "adCost.year1Month2",
      label: "広告費（1年目 2月）",
      currentValue: formatMoney(params.adCost.year1Month2),
      useCase: "オープン2ヶ月目の広告宣伝費",
      group: "広告費テーブル",
    },
    {
      key: "adCost.year1Month3To4",
      label: "広告費（1年目 3〜4月）",
      currentValue: formatMoney(params.adCost.year1Month3To4),
      useCase: "オープン3〜4ヶ月目の広告宣伝費",
      group: "広告費テーブル",
    },
    {
      key: "adCost.year1Month5To12",
      label: "広告費（1年目 5〜12月）",
      currentValue: formatMoney(params.adCost.year1Month5To12),
      useCase: "オープン5〜12ヶ月目の広告宣伝費",
      group: "広告費テーブル",
    },
    {
      key: "adCost.year2Monthly",
      label: "広告費（2年目 毎月）",
      currentValue: formatMoney(params.adCost.year2Monthly),
      useCase: "2年目の月次広告宣伝費",
      group: "広告費テーブル",
    },
    {
      key: "adCost.year3PlusMonthly",
      label: "広告費（3年目以降 毎月）",
      currentValue: formatMoney(params.adCost.year3PlusMonthly),
      useCase: "3年目以降の月次広告宣伝費",
      group: "広告費テーブル",
    },
  ]
}

export function LogicVisualizationView() {
  const [data, setData] = useState<LogicVisualizationResponse | null>(null)
  const [calcParams, setCalcParams] = useState<CalcParameterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calcWarning, setCalcWarning] = useState<string | null>(null)
  const [isSavingStep1, setIsSavingStep1] = useState(false)
  const [isSavingStep2, setIsSavingStep2] = useState(false)
  const [paymentFeeRatePercent, setPaymentFeeRatePercent] = useState("")
  const [royaltyCapMonthly, setRoyaltyCapMonthly] = useState("")
  const [appFeeMonthly, setAppFeeMonthly] = useState("")
  const [competitorUpTo2Percent, setCompetitorUpTo2Percent] = useState("")
  const [competitorFor3Percent, setCompetitorFor3Percent] = useState("")
  const [competitorFor4Percent, setCompetitorFor4Percent] = useState("")
  const [competitorOver4Percent, setCompetitorOver4Percent] = useState("")

  function syncStep1Form(params: CalcParameterConfig) {
    setPaymentFeeRatePercent(String(Math.round(params.paymentFeeRate * 10_000) / 100))
    setRoyaltyCapMonthly(String(params.royaltyCapMonthly))
    setAppFeeMonthly(String(params.appFeeMonthly))
    setCompetitorUpTo2Percent(String(Math.round(params.competitorImpact.upTo2 * 10_000) / 100))
    setCompetitorFor3Percent(String(Math.round(params.competitorImpact.for3 * 10_000) / 100))
    setCompetitorFor4Percent(String(Math.round(params.competitorImpact.for4 * 10_000) / 100))
    setCompetitorOver4Percent(String(Math.round(params.competitorImpact.over4 * 10_000) / 100))
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
      syncStep1Form(payload.params)
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
      syncStep1Form(payload.params)
      toast.success("競合影響率パラメータを保存しました。")
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSavingStep2(false)
    }
  }

  useEffect(() => {
    let disposed = false

    async function load() {
      setLoading(true)
      setError(null)
      setCalcWarning(null)

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
            setCalcParams(null)
            setCalcWarning(message)
          }
          return
        }

        if (!disposed) {
          setData(logicPayload as LogicVisualizationResponse)
          const params = (calcPayload as CalcParamsPayload)?.params ?? null
          setCalcParams(params)
          if (params) {
            syncStep1Form(params)
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

  const editableParams = calcParams ? buildEditableParams(calcParams) : []

  return (
    <div className="space-y-4 p-6">
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

      <Card>
        <CardHeader>
          <CardTitle>編集候補の計算パラメータ</CardTitle>
          <CardDescription>phase 2 で編集対象に寄せていく係数・定数の棚卸し</CardDescription>
        </CardHeader>
        <CardContent>
          {calcParams ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>グループ</TableHead>
                  <TableHead>キー</TableHead>
                  <TableHead>項目</TableHead>
                  <TableHead>現在値</TableHead>
                  <TableHead className="min-w-[280px]">用途</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editableParams.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell>{item.group}</TableCell>
                    <TableCell className="font-mono text-xs">{item.key}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.currentValue}</TableCell>
                    <TableCell className="text-xs whitespace-normal text-muted-foreground">{item.useCase}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              計算パラメータを取得できないため、編集候補の一覧は表示していません。
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>phase 2-① 手数料・上限 編集</CardTitle>
          <CardDescription>
            対象: 決済手数料率 / ロイヤリティ月額上限 / アプリ利用料
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calcParams ? (
            <>
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
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              計算パラメータを取得できないため、phase 2-① の編集は利用できません。
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>phase 2-② 競合影響率 編集</CardTitle>
          <CardDescription>
            対象: competitorImpact.upTo2 / for3 / for4 / over4
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calcParams ? (
            <>
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
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              計算パラメータを取得できないため、phase 2-② の編集は利用できません。
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>式一覧</CardTitle>
          <CardDescription>現在アクティブな式セットに含まれる定義（閲覧専用）</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>キー</TableHead>
                <TableHead>ラベル</TableHead>
                <TableHead>フェーズ</TableHead>
                <TableHead>依存</TableHead>
                <TableHead className="min-w-[360px]">式</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.formulas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    取得可能な式セットがありません。
                  </TableCell>
                </TableRow>
              ) : (
                data.formulas.map((formula) => (
                  <TableRow key={formula.key}>
                    <TableCell className="font-mono text-xs">{formula.key}</TableCell>
                    <TableCell>{formula.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{formula.phase}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formula.dependsOn.length > 0 ? formula.dependsOn.join(", ") : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-normal">{formula.expression || "-"}</TableCell>
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
            <CardDescription>入力・定数・派生値・地理情報の一覧</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>キー</TableHead>
                  <TableHead>ラベル</TableHead>
                  <TableHead>ソース</TableHead>
                  <TableHead>単位</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.variables.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-mono text-xs">{item.key}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.source}</TableCell>
                    <TableCell>{item.unit || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>依存関係</CardTitle>
            <CardDescription>式同士の依存定義（デフォルト定義ベース）</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>キー</TableHead>
                  <TableHead>フェーズ</TableHead>
                  <TableHead>依存先</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dependencies.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-mono text-xs">{item.key}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.phase}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.dependsOn.length > 0 ? item.dependsOn.join(", ") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
