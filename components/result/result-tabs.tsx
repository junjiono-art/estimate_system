"use client"

import dynamic from "next/dynamic"
import { useEffect, useState, useRef } from "react"
import { ChevronRightIcon, DownloadIcon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { KpiCards } from "./kpi-cards"
import { ChartTableView } from "./chart-table-view"
import { DashboardView } from "./dashboard-view"
import { DemographicsView } from "./demographics-view"
import { BusinessPlanView } from "./business-plan-view"
import { StarRating } from "@/components/star-rating"
import type { MasterValue, SimulationRequestInput, SimulationResult, ScenarioType } from "@/lib/types"
import type { FormSubmitData } from "@/components/simulation-form"
import { getErrorMessage } from "@/lib/error-utils"
import { resolveMasterFieldValues } from "@/lib/master-value-mapping"
import { extractCity } from "@/lib/utils"

// 地図(leaflet)はブラウザ専用のため SSR を無効化して読み込む。
const StoreMap = dynamic(() => import("./store-map"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-xs text-muted-foreground">
      地図を読み込み中...
    </div>
  ),
})

interface ResultTabsProps {
  data: SimulationResult
  demographicsData?: FormSubmitData["demographics"]
  demographicsError?: string
  simulationRequest?: SimulationRequestInput | null
}

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}年目まで`,
  months: (i + 1) * 12,
}))

const SCENARIO_COLORS: Record<ScenarioType, string> = {
  conservative: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  standard:     "bg-chart-1/15 text-chart-1 border-chart-1/30",
  aggressive:   "bg-chart-2/15 text-chart-2 border-chart-2/30",
}

const SCENARIO_LABELS: Record<ScenarioType, string> = {
  conservative: "保守シナリオ",
  standard: "標準シナリオ",
  aggressive: "強気シナリオ",
}

function applyResolvedBreakdown(
  result: SimulationResult,
  masterValues: MasterValue[] | null,
  royaltyRate: 0 | 10 | 15,
  totalInitialInvestmentOverride?: number,
  floorAreaTsubo = 0,
): SimulationResult {
  if (!masterValues || masterValues.length === 0) return result

  const resolved = resolveMasterFieldValues(masterValues, royaltyRate, floorAreaTsubo)
  const hasInvestmentValues = resolved.visibleInvestmentFieldIds.length > 0
  const hasRunningValues = resolved.visibleRunningFieldIds.length > 0
  if (!hasInvestmentValues && !hasRunningValues) return result

  const machinesCost = hasInvestmentValues
    ? resolved.investmentByField.fitnessMachineCost ?? result.machinesCost
    : result.machinesCost
  const interiorCost = hasInvestmentValues
    ? resolved.investmentByField.interiorCost ?? result.interiorCost
    : result.interiorCost
  const franchiseInitialCost = hasInvestmentValues
    ? resolved.investmentByField.franchiseFeeCost ?? result.franchiseInitialCost
    : result.franchiseInitialCost
  const totalInitialInvestment = hasInvestmentValues
    ? (Number.isFinite(totalInitialInvestmentOverride)
      ? Math.max(0, Math.round(totalInitialInvestmentOverride as number))
      : resolved.totalInvestmentCost)
    : result.totalInitialInvestment
  const otherInitialCost = hasInvestmentValues
    ? Math.max(0, totalInitialInvestment - machinesCost - interiorCost - franchiseInitialCost)
    : result.otherInitialCost

  return {
    ...result,
    totalInitialInvestment,
    machinesCost,
    interiorCost,
    franchiseInitialCost,
    otherInitialCost,
    monthlyRunningCost: hasRunningValues ? resolved.totalRunningCost : result.monthlyRunningCost,
  }
}

export function ResultTabs({ data: initialData, demographicsData, demographicsError, simulationRequest }: ResultTabsProps) {
  const [scenario, setScenario] = useState<ScenarioType>(initialData.scenario ?? "standard")
  const [selectedYear, setSelectedYear] = useState("3")
  const [rating, setRating] = useState<number | undefined>(initialData.rating)
  const [franchiseRate, setFranchiseRate] = useState<string>(String(initialData.franchiseRate ?? 0))
  const [locationType, setLocationType] = useState<"urban" | "suburban" | "rural">(simulationRequest?.locationType ?? "suburban")
  const [includeDepreciation, setIncludeDepreciation] = useState(true)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [scenarioError, setScenarioError] = useState("")
  const [scenarioData, setScenarioData] = useState<SimulationResult>(initialData)
  const [masterValues, setMasterValues] = useState<MasterValue[] | null>(null)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const prevIncludeDepreciation = useRef(true)
  const scenarioCacheRef = useRef<Map<string, SimulationResult>>(new Map())
  // 坪連動(perTsubo)の費目を実効額（単価×坪数×数量）へ換算するための床面積。フォームと同じ基準に揃える。
  const floorAreaTsubo = Number(simulationRequest?.floorAreaTsubo) || 0

  function buildScenarioCacheKey(nextScenario: ScenarioType, nextRoyaltyRate: 0 | 10 | 15, nextIncludeDepreciation: boolean, nextLocationType: string): string {
    return `${nextScenario}|${nextRoyaltyRate}|${nextIncludeDepreciation ? 1 : 0}|${nextLocationType}`
  }

  function resolveRequestValues(nextRoyaltyRate: 0 | 10 | 15): {
    runningCostTotal: number | undefined
    requestInitialInvestmentTotal: number | undefined
  } {
    const resolved = masterValues ? resolveMasterFieldValues(masterValues, nextRoyaltyRate, floorAreaTsubo) : null
    const mappedInitialInvestment = simulationRequest?.initialInvestmentByRoyaltyRate?.[String(nextRoyaltyRate) as "0" | "10" | "15"]
    const baseRoyaltyRate = ((simulationRequest?.royaltyRate ?? simulationRequest?.franchiseRate ?? initialData.franchiseRate ?? 0) as 0 | 10 | 15)
    const baseResolved = masterValues ? resolveMasterFieldValues(masterValues, baseRoyaltyRate, floorAreaTsubo) : null
    const requestInitialInvestmentTotal =
      Number.isFinite(simulationRequest?.initialInvestmentTotal)
        ? Math.max(0, Math.round(simulationRequest?.initialInvestmentTotal as number))
        : Number.isFinite(mappedInitialInvestment)
        ? Math.max(0, Math.round(mappedInitialInvestment as number))
        : resolved?.visibleInvestmentFieldIds.length &&
          baseResolved?.visibleInvestmentFieldIds.length &&
          Number.isFinite(simulationRequest?.initialInvestmentTotal)
        ? Math.max(
            0,
            Math.round((simulationRequest?.initialInvestmentTotal as number) + (resolved.totalInvestmentCost - baseResolved.totalInvestmentCost)),
          )
        : simulationRequest?.initialInvestmentTotal

    return {
      runningCostTotal: resolved?.visibleRunningFieldIds.length ? resolved.totalRunningCost : simulationRequest?.runningCostTotal,
      requestInitialInvestmentTotal,
    }
  }

  // 単価マスタは静的データのため、simulationRequest の参照が変わるたびに再フェッチしない。
  // 取得要否は「リクエストの有無」だけで決まるので、真偽値を依存にして有無の切替時のみ再取得する。
  const hasSimulationRequest = Boolean(simulationRequest)
  useEffect(() => {
    if (!hasSimulationRequest) {
      setMasterValues(null)
      return
    }

    const controller = new AbortController()

    async function loadMasterValues() {
      try {
        const response = await fetch("/api/master/values", { cache: "no-store", signal: controller.signal })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "単価マスタの取得に失敗しました。"))
        }

        if (!controller.signal.aborted) {
          setMasterValues(Array.isArray(payload?.values) ? payload.values as MasterValue[] : [])
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setMasterValues(null)
        setScenarioError(error instanceof Error ? error.message : "単価マスタの取得に失敗しました。")
      }
    }

    void loadMasterValues()

    return () => {
      controller.abort()
    }
  }, [hasSimulationRequest])

  useEffect(() => {
    setScenario(initialData.scenario ?? "standard")
    const initialRoyaltyRate = (initialData.franchiseRate ?? 0) as 0 | 10 | 15
    const initialRequestValues = resolveRequestValues(initialRoyaltyRate)
    const seededData = applyResolvedBreakdown(initialData, masterValues, initialRoyaltyRate, initialRequestValues.requestInitialInvestmentTotal, floorAreaTsubo)
    setScenarioData({ ...seededData, locationType: simulationRequest?.locationType ?? "suburban" })
    setRating(initialData.rating)
    setFranchiseRate(String(initialData.franchiseRate ?? 0))
    setLocationType(simulationRequest?.locationType ?? "suburban")
    setIncludeDepreciation(true)
    prevIncludeDepreciation.current = true
    setScenarioError("")
    scenarioCacheRef.current.clear()
    scenarioCacheRef.current.set(
      buildScenarioCacheKey(initialData.scenario ?? "standard", initialRoyaltyRate, true, simulationRequest?.locationType ?? "suburban"),
      { ...seededData, locationType: simulationRequest?.locationType ?? "suburban" },
    )
  }, [initialData, masterValues, simulationRequest])



  useEffect(() => {
    const nextFranchiseRate = parseInt(franchiseRate) || 0
    const controlsAreSame =
      scenario === scenarioData.scenario &&
      nextFranchiseRate === (scenarioData.franchiseRate ?? 0) &&
      includeDepreciation === prevIncludeDepreciation.current &&
      locationType === (scenarioData.locationType ?? simulationRequest?.locationType ?? "suburban")

    if (controlsAreSame) return

    setScenarioError("")

    const nextRoyaltyRate = nextFranchiseRate as 0 | 10 | 15
    const requestValues = resolveRequestValues(nextRoyaltyRate)
    const cacheKey = buildScenarioCacheKey(scenario, nextRoyaltyRate, includeDepreciation, locationType)
    const cached = scenarioCacheRef.current.get(cacheKey)

    if (cached) {
      setScenarioData(cached)
      prevIncludeDepreciation.current = includeDepreciation
      // 前回 fetch が abort されたまま true 残留しうるため明示的にリセット
      setIsRecalculating(false)
      return
    }

    const controller = new AbortController()

    async function recalculateScenario() {
      setIsRecalculating(true)
      try {
        const requestBody = {
          ...(simulationRequest ?? {}),
          storeName: simulationRequest?.storeName ?? initialData.storeName,
          location: simulationRequest?.location ?? initialData.location,
          scenario,
          royaltyRate: nextRoyaltyRate,
          franchiseRate: nextFranchiseRate as 0 | 10 | 15,
          locationType,
          runningCostTotal: requestValues.runningCostTotal,
          initialInvestmentTotal: requestValues.requestInitialInvestmentTotal,
          includeDepreciation,
        }

        const response = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.data) {
          throw new Error(getErrorMessage(payload, "シナリオ再計算に失敗しました。"))
        }

        if (controller.signal.aborted) return

        const computed = applyResolvedBreakdown(
          payload.data as SimulationResult,
          masterValues,
          nextRoyaltyRate,
          requestValues.requestInitialInvestmentTotal,
          floorAreaTsubo,
        )
        scenarioCacheRef.current.set(cacheKey, { ...computed, locationType })
        setScenarioData({ ...computed, locationType })
        prevIncludeDepreciation.current = includeDepreciation
      } catch (error) {
        if (controller.signal.aborted) return
        setScenarioError(error instanceof Error ? error.message : "シナリオ再計算に失敗しました。")
      } finally {
        if (!controller.signal.aborted) {
          setIsRecalculating(false)
        }
      }
    }

    void recalculateScenario()
    return () => {
      controller.abort()
    }
  }, [
    franchiseRate,
    includeDepreciation,
    initialData.location,
    initialData.storeName,
    locationType,
    masterValues,
    scenario,
    scenarioData.franchiseRate,
    scenarioData.locationType,
    scenarioData.scenario,
    simulationRequest,
  ])

  const activeBaseData = scenarioData
  const yearMonths = parseInt(selectedYear) * 12
  const currentData: SimulationResult = {
    ...activeBaseData,
    scenario,
    franchiseRate: parseInt(franchiseRate) || 0,
  }

  const filteredData: SimulationResult = {
    ...currentData,
    monthlyProjection: currentData.monthlyProjection.slice(0, yearMonths),
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveError("")

    try {
      const location = currentData.location ?? ""
      const prefMatch = location.match(/(東京都|北海道|(?:京都|大阪)府|..県)/)
      const prefecture = prefMatch?.[1] ?? ""
      const city = extractCity(location)

      const nextFranchiseRate = (parseInt(franchiseRate) || 0) as 0 | 10 | 15

      const payload = {
        formulaSetVersion: currentData.formulaSetVersion,
        storeName: currentData.storeName,
        username: currentData.createdBy?.trim() || "未設定",
        scenario,
        input: {
          storeName: currentData.storeName,
          location,
          prefecture,
          city,
          // 再計算時の完全復元用：simulationRequest を保存（履歴経由でロード時に復元する）
          floorAreaTsubo: simulationRequest?.floorAreaTsubo,
          rentPerTsubo: simulationRequest?.rentPerTsubo,
          competitorCount: simulationRequest?.competitorCount,
          locationType,
          royaltyRate: nextFranchiseRate,
          franchiseRate: nextFranchiseRate,
          runningCostTotal: simulationRequest?.runningCostTotal,
          initialInvestmentTotal: simulationRequest?.initialInvestmentTotal,
          initialInvestmentByRoyaltyRate: simulationRequest?.initialInvestmentByRoyaltyRate,
          investmentBreakdown: simulationRequest?.investmentBreakdown ?? currentData.investmentBreakdown,
          populationByRadius: simulationRequest?.populationByRadius,
          includeDepreciation,
        },
        result: {
          ...currentData,
          rating,
          demographics: demographicsData ?? currentData.demographics,
        },
      }

      const response = await fetch("/api/results/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const responsePayload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(getErrorMessage(responsePayload, "試算結果の保存に失敗しました。"))
      }

      setSaveDialogOpen(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "試算結果の保存に失敗しました。")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ストア情報行 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {currentData.storeName}
          </h2>
          <Badge className={`border text-[10px] font-medium ${SCENARIO_COLORS[scenario]}`}>
            {SCENARIO_LABELS[scenario]}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">評価</span>
            <StarRating value={rating} onChange={setRating} />
            {rating && (
              <button
                type="button"
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setRating(undefined)}
              >
                クリア
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => alert("CSV出力は実装後に利用可能になります。")}>
            <DownloadIcon className="size-3.5" />
            CSV出力
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setSaveDialogOpen(true)}>
            <SaveIcon className="size-3.5" />
            保存
          </Button>
        </div>
      </div>

      {/* 保存ダイアログ */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>試算結果を保存</DialogTitle>
            <DialogDescription>
              以下の内容で試算結果を保存します。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">試算名:</span> {currentData.storeName}</p>
              <p><span className="font-medium text-foreground">計算シナリオ:</span> {SCENARIO_LABELS[scenario]}</p>
              {rating && <p><span className="font-medium text-foreground">評価:</span> {"★".repeat(rating)}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>
              キャンセル
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">計算シナリオ</span>
          <Select value={scenario} onValueChange={(v) => setScenario(v as ScenarioType)}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative" className="text-xs">保守</SelectItem>
              <SelectItem value="standard" className="text-xs">スタンダード</SelectItem>
              <SelectItem value="aggressive" className="text-xs">アグレッシブ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">立地タイプ</span>
          <Select value={locationType} onValueChange={(v) => setLocationType(v as "urban" | "suburban" | "rural")}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urban" className="text-xs">都市型</SelectItem>
              <SelectItem value="suburban" className="text-xs">郊外型</SelectItem>
              <SelectItem value="rural" className="text-xs">田舎型</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">FC契約</span>
          <Select value={franchiseRate} onValueChange={setFranchiseRate}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0" className="text-xs">直営</SelectItem>
              <SelectItem value="10" className="text-xs">10%</SelectItem>
              <SelectItem value="15" className="text-xs">15%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <Checkbox
            id="includeDepreciation"
            checked={includeDepreciation}
            onCheckedChange={(checked) => setIncludeDepreciation(checked === true)}
            className="size-3.5"
          />
          <label
            htmlFor="includeDepreciation"
            className="cursor-pointer select-none text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            減価償却を利益計算に含める
          </label>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">表示期間</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="ml-auto text-[10px] text-muted-foreground">
          試算日: {new Date(currentData.createdAt).toLocaleDateString("ja-JP")}
        </p>
      </div>
      {isRecalculating && (
        <p className="text-xs text-muted-foreground">再計算中...</p>
      )}
      {scenarioError && (
        <p className="text-xs text-destructive">{scenarioError}</p>
      )}

      {/* KPIカード */}
      <KpiCards data={currentData} />

      {/* 損益分岐点の詳細パターン（折り畳み。既定はメイン=固定費のみのみ表示） */}
      {currentData.breakevenVariants && (
        <details className="group rounded-lg border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
              <span className="font-medium text-foreground">損益分岐点の詳細パターン</span>
            </div>
            <span className="text-xs text-muted-foreground">
              メイン（固定費のみ）:{" "}
              <span className="font-semibold text-foreground">{currentData.breakevenVariants.fixedOnly.toLocaleString()} 人</span>
            </span>
          </summary>
          <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-4 md:grid-cols-4">
            {[
              { label: "固定費のみ", sub: "メイン表示", value: currentData.breakevenVariants.fixedOnly, accent: "text-chart-3" },
              { label: "＋広告費", sub: "広告あり・償却なし", value: currentData.breakevenVariants.withAdCost, accent: "text-chart-1" },
              { label: "＋減価償却", sub: "広告なし・償却あり", value: currentData.breakevenVariants.withDepreciation, accent: "text-chart-4" },
              { label: "＋広告費＋減価償却", sub: "広告あり・償却あり", value: currentData.breakevenVariants.withAdCostAndDepreciation, accent: "text-chart-2" },
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="text-[9px] text-muted-foreground/70">{item.sub}</p>
                <p className={`mt-1 text-lg font-bold tracking-tight ${item.accent}`}>{item.value.toLocaleString()} 人</p>
              </div>
            ))}
          </div>
          <p className="border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground">
            固定費（家賃＋ランニング）に広告費・減価償却を加えた場合の損益分岐会員数。限界利益単価（平均単価−変動費）で除算。
          </p>
        </details>
      )}

      {/* タブ切替 */}
      <Tabs defaultValue="chart">
        <TabsList className="rounded-md border border-border bg-muted/40 p-0.5">
          <TabsTrigger value="chart" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            グラフ + 表
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            ダッシュボード
          </TabsTrigger>
          <TabsTrigger value="business-plan" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            事業計画
          </TabsTrigger>
          <TabsTrigger value="demographics" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            エリア人口統計
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chart" className="mt-4">
          <ChartTableView data={filteredData} />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardView data={filteredData} />
        </TabsContent>
        <TabsContent value="business-plan" className="mt-4">
          <BusinessPlanView data={currentData} />
        </TabsContent>
        <TabsContent value="demographics" className="mt-4">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">出店地点と商圏</h3>
                {simulationRequest?.location && (
                  <span className="truncate text-[11px] text-muted-foreground">{simulationRequest.location}</span>
                )}
              </div>
              <StoreMap address={simulationRequest?.location} prefecture={simulationRequest?.prefecture} />
            </div>
            <DemographicsView
              data={currentData}
              demographicsData={demographicsData}
              demographicsError={demographicsError}
              simulationRequest={simulationRequest}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
