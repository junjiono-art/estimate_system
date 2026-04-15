"use client"

import { useState } from "react"
import { ArrowLeftIcon, SparklesIcon, FlaskConicalIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { SimulationForm } from "@/components/simulation-form"
import type { FormSubmitData } from "@/components/simulation-form"
import { ResultTabs } from "@/components/result/result-tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { SimulationRequestInput, SimulationResult } from "@/lib/types"
import { getErrorMessage } from "@/lib/error-utils"

function buildPreviewResult(submittedData: FormSubmitData | null): SimulationResult {
  const now = new Date().toISOString()
  const storeName = submittedData?.storeInfo.storeName?.trim() || "試算結果"
  const location = submittedData?.storeInfo.address?.trim() || ""
  const floorArea = submittedData?.storeInfo.floorArea ?? 0
  const rentPerTsubo = submittedData?.storeInfo.rentPerTsubo ?? 0

  // 簡易的な収益計算（床面積ベース）
  const monthlyRevenue = Math.max(0, floorArea * 50000)
  const monthlyRent = Math.max(0, rentPerTsubo)
  const submittedRunningCost = submittedData?.runningCosts.total ?? 0
  const monthlyRunningCost = Math.max(0, submittedRunningCost || Math.round(monthlyRent * 0.6))
  // デフォルトは直営（0%）、試算結果画面で変更可能
  const franchiseRate = 0
  const monthlyFranchiseCost = 0
  const monthlyProfit = monthlyRevenue - monthlyRent - monthlyRunningCost - monthlyFranchiseCost
  const submittedInitialCost = submittedData?.investmentCosts.total ?? 0
  const totalInitialInvestment = Math.max(0, submittedInitialCost || (floorArea * 300000 + 10000000))

  const machinesCost = submittedData?.investmentCosts.byField.fitnessMachineCost ?? Math.round(totalInitialInvestment * 0.55)
  const interiorCost = submittedData?.investmentCosts.byField.interiorCost ?? Math.round(totalInitialInvestment * 0.35)
  const franchiseInitialCost = submittedData?.investmentCosts.byField.franchiseFeeCost ?? 0
  const otherInitialCost = submittedData?.investmentCosts.byField.otherInitialCost ?? Math.round(totalInitialInvestment * 0.1)
  const paybackMonths = monthlyProfit > 0 ? Math.ceil(totalInitialInvestment / monthlyProfit) : 999
  
  // 損益分岐点（会員数）の計算
  // 月額会員費は税抜2,980円で計算
  const monthlyMemberFee = 2980
  const estimatedMembers = monthlyMemberFee > 0 ? Math.round(monthlyRevenue / monthlyMemberFee) : 0
  const totalMonthlyCost = monthlyRent + monthlyRunningCost + monthlyFranchiseCost
  const breakevenMembers = monthlyMemberFee > 0 ? Math.ceil(totalMonthlyCost / monthlyMemberFee) : 0

  const monthlyProjection = Array.from({ length: 120 }, (_, index) => {
    const month = index + 1
    const cumulativeProfit = monthlyProfit * month - totalInitialInvestment
    return {
      month,
      members: estimatedMembers,
      revenue: monthlyRevenue,
      cost: monthlyRent + monthlyRunningCost + monthlyFranchiseCost,
      profit: monthlyProfit,
      cumulativeProfit,
    }
  })

  return {
    id: `preview-${Date.now()}`,
    storeName,
    location,
    createdAt: now,
    createdBy: "未保存",
    scenario: "standard",
    franchiseRate,
    totalInitialInvestment,
    machinesCost,
    interiorCost,
    franchiseInitialCost,
    otherInitialCost,
    monthlyRevenue,
    monthlyRent,
    monthlyRunningCost,
    monthlyFranchiseCost,
    monthlyProfit,
    paybackMonths,
    breakevenMembers,
    monthlyProjection,
  }
}

type RegressionStatus = "idle" | "running" | "pass" | "fail"

type ScenarioCheckSummary = {
  scenario: "conservative" | "standard" | "aggressive"
  pass: boolean
  diffCount: number
}

export default function NewSimulationPage() {
  const [showResult, setShowResult] = useState(false)
  const [submittedData, setSubmittedData] = useState<FormSubmitData | null>(null)
  const [resultData, setResultData] = useState<SimulationResult | null>(null)
  const [simulationRequest, setSimulationRequest] = useState<SimulationRequestInput | null>(null)

  // 回帰検証ステータス（開発用）
  const [regressionStatus, setRegressionStatus] = useState<RegressionStatus>("idle")
  const [regressionDiffCount, setRegressionDiffCount] = useState<number | null>(null)
  const [regressionScenarioSummary, setRegressionScenarioSummary] = useState<ScenarioCheckSummary[]>([])

  async function handleRunRegression() {
    setRegressionStatus("running")
    setRegressionDiffCount(null)
    setRegressionScenarioSummary([])
    try {
      const response = await fetch("/api/simulate/validate-all", { method: "GET" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setRegressionStatus("fail")
        setRegressionDiffCount(typeof payload?.totalDiffs === "number" ? payload.totalDiffs : null)
        setRegressionScenarioSummary(
          Array.isArray(payload?.scenarios)
            ? payload.scenarios.map((row: { scenario: ScenarioCheckSummary["scenario"]; pass: boolean; diffCount: number }) => ({
                scenario: row.scenario,
                pass: row.pass,
                diffCount: row.diffCount,
              }))
            : [],
        )
        return
      }
      setRegressionStatus(payload?.pass === false ? "fail" : "pass")
      setRegressionDiffCount(typeof payload?.totalDiffs === "number" ? payload.totalDiffs : 0)
      setRegressionScenarioSummary(
        Array.isArray(payload?.scenarios)
          ? payload.scenarios.map((row: { scenario: ScenarioCheckSummary["scenario"]; pass: boolean; diffCount: number }) => ({
              scenario: row.scenario,
              pass: row.pass,
              diffCount: row.diffCount,
            }))
          : [],
      )
    } catch {
      setRegressionStatus("fail")
      setRegressionDiffCount(null)
      setRegressionScenarioSummary([])
    }
  }

  function buildSimulationRequest(data: FormSubmitData, scenario: SimulationRequestInput["scenario"] = "standard"): SimulationRequestInput {
    return {
      storeName: data.storeInfo.storeName,
      location: data.storeInfo.address,
      scenario,
      floorAreaTsubo: data.storeInfo.floorArea,
      rentPerTsubo: data.storeInfo.rentPerTsubo,
      royaltyRate: data.calcParams.royaltyRate,
      competitorCount: data.calcParams.competitorCount,
      locationType: data.calcParams.locationType,
      runningCostTotal: data.runningCosts.total,
      initialInvestmentTotal: data.investmentCosts.total,
      franchiseRate: 0,
      includeDepreciation: true,
    }
  }

  async function handleSubmitWithData(data: FormSubmitData) {
    setSubmittedData(data)
    const requestBody = buildSimulationRequest(data)
    setSimulationRequest(requestBody)

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.data) {
        throw new Error(getErrorMessage(payload, "試算APIの実行に失敗しました。"))
      }

      setResultData(payload.data as SimulationResult)
    } catch {
      // APIが利用できない場合でも画面利用を止めないため、従来のプレビュー計算にフォールバックする
      setResultData(buildPreviewResult(data))
    }

    setShowResult(true)
  }

  const displayResult = resultData ?? buildPreviewResult(submittedData)

  if (showResult) {
    return (
      <>
        <PageHeader
          title="試算結果"
          description="入力情報をもとにした収益シミュレーション結果です"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResult(false)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeftIcon className="size-3.5" />
              入力に戻る
            </Button>
          }
        />
        <div className="overflow-auto">
          <div className="mx-auto max-w-6xl px-8 py-7">
            <ResultTabs
              data={displayResult}
              demographicsData={submittedData?.demographics}
              demographicsError={submittedData?.demographicsError}
              simulationRequest={simulationRequest}
            />
          </div>
        </div>
      </>
    )
  }

  const regressionActions = (
    <div className="flex items-center gap-2">
      {regressionStatus === "pass" && (
        <Badge className="border border-chart-2/30 bg-chart-2/10 text-chart-2 text-[10px] font-semibold">
          PASS
        </Badge>
      )}
      {regressionStatus === "fail" && (
        <Badge className="border border-destructive/30 bg-destructive/10 text-destructive text-[10px] font-semibold">
          FAIL
        </Badge>
      )}
      {regressionDiffCount != null && (
        <span className="text-[10px] text-muted-foreground font-mono">
          差分 {regressionDiffCount} 件
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => { void handleRunRegression() }}
        disabled={regressionStatus === "running"}
      >
        <FlaskConicalIcon className="size-3.5" />
        {regressionStatus === "running" ? "検証中..." : "回帰検証（全シナリオ）"}
      </Button>
    </div>
  )

  return (
    <>
      <PageHeader
        title="新規試算"
        description="店舗情報を入力して、初期投資・月間収益・回収期間を試算します"
        actions={regressionActions}
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-7">
          {/* Intro banner */}
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
            <SparklesIcon className="mt-0.5 size-4 shrink-0 text-accent" />
            <p className="text-xs leading-relaxed text-foreground/70">
              各タブを順番に入力し、最後のタブで「試算を実行する」ボタンを押してください。エリアを選択すると坪単価が自動入力されます。
            </p>
          </div>
          <SimulationForm
            onSubmitWithData={handleSubmitWithData}
          />
          {regressionScenarioSummary.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">回帰検証詳細</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {regressionScenarioSummary.map((row) => (
                  <div key={row.scenario} className="rounded-md border border-border bg-background px-2.5 py-2">
                    <p className="text-[11px] font-medium text-foreground">{row.scenario}</p>
                    <p className={`text-[11px] ${row.pass ? "text-chart-2" : "text-destructive"}`}>
                      {row.pass ? "PASS" : "FAIL"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">差分 {row.diffCount} 件</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
