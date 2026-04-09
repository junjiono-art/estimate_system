"use client"

import { useState } from "react"
import { DownloadIcon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { KpiCards } from "./kpi-cards"
import { ChartTableView } from "./chart-table-view"
import { DashboardView } from "./dashboard-view"
import { DemographicsView } from "./demographics-view"
import { StarRating } from "@/components/star-rating"
import type { SimulationResult, ScenarioType } from "@/lib/types"
import type { FormSubmitData } from "@/components/simulation-form"
import { getErrorMessage } from "@/lib/error-utils"
import { extractCity } from "@/lib/utils"

interface ResultTabsProps {
  data: SimulationResult
  demographicsData?: FormSubmitData["demographics"]
  demographicsError?: string
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

export function ResultTabs({ data: initialData, demographicsData, demographicsError }: ResultTabsProps) {
  const [scenario, setScenario]         = useState<ScenarioType>(initialData.scenario ?? "standard")
  const [selectedYear, setSelectedYear]  = useState("3")
  const [rating, setRating]              = useState<number | undefined>(initialData.rating)
  const [franchiseRate, setFranchiseRate] = useState<string>(String(initialData.franchiseRate ?? 0))
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [createdBy, setCreatedBy]        = useState("")
  const [isSaving, setIsSaving]          = useState(false)
  const [saveError, setSaveError]        = useState("")

  // シナリオ係数
  const SCENARIO_FACTORS: Record<ScenarioType, { revenueMultiplier: number; growthSpeed: number }> = {
    conservative: { revenueMultiplier: 0.8, growthSpeed: 0.03 },
    standard: { revenueMultiplier: 1.0, growthSpeed: 0.05 },
    aggressive: { revenueMultiplier: 1.25, growthSpeed: 0.07 },
  }

  const scenarioFactor = SCENARIO_FACTORS[scenario]
  const franchiseRateNum = parseInt(franchiseRate) || 0
  
  // シナリオに応じて収益を調整
  const adjustedMonthlyRevenue = Math.round(initialData.monthlyRevenue * scenarioFactor.revenueMultiplier)
  const monthlyFranchiseCost = franchiseRateNum > 0 ? Math.round(adjustedMonthlyRevenue * (franchiseRateNum / 100)) : 0
  const adjustedMonthlyProfit = adjustedMonthlyRevenue - initialData.monthlyRent - initialData.monthlyRunningCost - monthlyFranchiseCost
  const adjustedPaybackMonths = adjustedMonthlyProfit > 0 ? Math.ceil(initialData.totalInitialInvestment / adjustedMonthlyProfit) : 999
  
  // 損益分岐点（会員数）の再計算
  const monthlyMemberFee = 8000
  const totalMonthlyCost = initialData.monthlyRent + initialData.monthlyRunningCost + monthlyFranchiseCost
  const adjustedBreakevenMembers = monthlyMemberFee > 0 ? Math.ceil(totalMonthlyCost / monthlyMemberFee) : 0

  const currentData: SimulationResult = {
    ...initialData,
    scenario,
    franchiseRate: franchiseRateNum,
    monthlyRevenue: adjustedMonthlyRevenue,
    monthlyFranchiseCost,
    monthlyProfit: adjustedMonthlyProfit,
    paybackMonths: adjustedPaybackMonths,
    breakevenMembers: adjustedBreakevenMembers,
  }

  const yearMonths  = parseInt(selectedYear) * 12

  const filteredData: SimulationResult = {
    ...currentData,
    monthlyProjection: Array.from({ length: yearMonths }, (_, index) => {
      const month = index + 1
      const growthFactor = Math.min(1, 0.5 + month * scenarioFactor.growthSpeed)
      const revenue = Math.round(initialData.monthlyRevenue * scenarioFactor.revenueMultiplier * growthFactor)
      const cost = initialData.monthlyRent + initialData.monthlyRunningCost + (franchiseRateNum > 0 ? Math.round(revenue * (franchiseRateNum / 100)) : 0)
      const profit = revenue - cost
      const cumulativeProfit = index === 0 
        ? profit - initialData.totalInitialInvestment 
        : (filteredData.monthlyProjection?.[index - 1]?.cumulativeProfit ?? -initialData.totalInitialInvestment) + profit
      return {
        month,
        revenue,
        cost,
        profit,
        cumulativeProfit,
      }
    }),
  }

  async function handleSave() {
    if (!createdBy.trim()) return
    setIsSaving(true)
    setSaveError("")

    try {
      const location = currentData.location ?? ""
      const prefMatch = location.match(/(東京都|北海道|(?:京都|大阪)府|..県)/)
      const prefecture = prefMatch?.[1] ?? ""
      const city = extractCity(location)

      const payload = {
        resultId: currentData.id,
        storeName: currentData.storeName,
        username: createdBy.trim(),
        scenario,
        input: {
          storeName: currentData.storeName,
          location,
          prefecture,
          city,
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
      setCreatedBy("")
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
              担当者名を入力して保存してください。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="createdBy" className="text-sm font-medium">担当者名</Label>
              <Input
                id="createdBy"
                placeholder="例: 田中太郎"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave() }}
              />
            </div>
            {saveError && (
              <p className="text-xs text-destructive">{saveError}</p>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">試算名:</span> {currentData.storeName}</p>
              <p><span className="font-medium text-foreground">シナリオ:</span> {SCENARIO_LABELS[scenario]}</p>
              {rating && <p><span className="font-medium text-foreground">評価:</span> {"★".repeat(rating)}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>
              キャンセル
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!createdBy.trim() || isSaving}>
              {isSaving ? "保存中..." : "保存する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">シナリオ</span>
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

      {/* KPIカード */}
      <KpiCards data={currentData} />

      {/* タブ切替 */}
      <Tabs defaultValue="chart">
        <TabsList className="rounded-md border border-border bg-muted/40 p-0.5">
          <TabsTrigger value="chart" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            グラフ + 表
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
            ダッシュボード
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
        <TabsContent value="demographics" className="mt-4">
          <DemographicsView
            data={currentData}
            demographicsData={demographicsData}
            demographicsError={demographicsError}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
