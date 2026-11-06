"use client"

import { useEffect, useState } from "react"
import { ArrowLeftIcon, ArrowRightIcon, PencilIcon, SparklesIcon, FlaskConicalIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { SimulationForm, SIMULATION_TABS } from "@/components/simulation-form"
import type { FormSubmitData, SimulationTabId } from "@/components/simulation-form"
import { ResultTabs } from "@/components/result/result-tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { SimulationRequestInput, SimulationResult } from "@/lib/types"
import { getErrorMessage } from "@/lib/error-utils"
import { MONTHLY_MEMBER_FEE_EX_TAX } from "@/lib/calc-constants"
import {
  type HistoryApiResult,
  mapHistoryItemToResult,
  mapHistoryItemToSimulationRequest,
} from "@/lib/simulation-result-mapper"

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
  // マシンメンテナンス費（固定枠）はランニング総額と別枠で渡されるため、ここで合算する
  const submittedMaintenance = submittedData?.runningCosts.machineMaintenance ?? 0
  const monthlyRunningCost = Math.max(0, (submittedRunningCost + submittedMaintenance) || Math.round(monthlyRent * 0.6))
  const franchiseRate = submittedData?.calcParams.royaltyRate ?? 0
  const monthlyRoyalty = Math.min(Math.round(monthlyRevenue * (franchiseRate / 100)), 5000000)
  const monthlyAppFee = franchiseRate > 0 ? 50 : 0
  const monthlyFranchiseCost = monthlyRoyalty + monthlyAppFee
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
  const monthlyMemberFee = MONTHLY_MEMBER_FEE_EX_TAX
  const estimatedMembers = monthlyMemberFee > 0 ? Math.round(monthlyRevenue / monthlyMemberFee) : 0
  const totalMonthlyCost = monthlyRent + monthlyRunningCost + monthlyFranchiseCost
  const breakevenMembers = monthlyMemberFee > 0 ? Math.ceil(totalMonthlyCost / monthlyMemberFee) : 0
  const simpleBreakevenMembers = breakevenMembers

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
    locationType: submittedData?.calcParams.locationType ?? "suburban",
    createdAt: now,
    createdBy: "未保存",
    scenario: "standard",
    franchiseRate,
    totalInitialInvestment,
    machinesCost,
    interiorCost,
    franchiseInitialCost,
    otherInitialCost,
      investmentBreakdown: submittedData?.investmentCosts.byField,
    securityIntroBreakdown: submittedData?.investmentCosts.securityIntroBreakdown,
    monthlyRevenue,
    monthlyRent,
    monthlyRunningCost,
    monthlyFranchiseCost,
    monthlyProfit,
    paybackMonths,
    breakevenMembers,
    simpleBreakevenMembers,
    monthlyProjection,
  }
}

type RegressionStatus = "idle" | "running" | "pass" | "fail"

// 試算履歴からの初期値読込の状態。checking 中はフォームを出さない（初期値なしでマウントされるのを防ぐ）。
type HistorySeedState =
  | { status: "checking" }
  | { status: "none" }
  | { status: "loading" }
  | { status: "loaded"; request: SimulationRequestInput }
  | { status: "error"; message: string }

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
  // 入力フォームの表示タブ。結果画面の「編集」ボタンから特定タブへ直接戻すため、ここで保持する（ユーザーfb③）。
  const [formTab, setFormTab] = useState<SimulationTabId>("store")

  // 試算履歴の「条件を変えて試算する」（/?from=<resultId>）から来た場合、その履歴の条件をフォームの初期値にする。
  const [historySeed, setHistorySeed] = useState<HistorySeedState>({ status: "checking" })
  useEffect(() => {
    const fromId = new URLSearchParams(window.location.search).get("from")?.trim()
    if (!fromId) {
      setHistorySeed({ status: "none" })
      return
    }
    let active = true
    setHistorySeed({ status: "loading" })
    void (async () => {
      try {
        const response = await fetch(`/api/results/${encodeURIComponent(fromId)}`, { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.item) {
          throw new Error(getErrorMessage(payload, "試算履歴の取得に失敗しました。"))
        }
        const item = payload.item as HistoryApiResult
        const mapped = mapHistoryItemToResult(item)
        if (!mapped) throw new Error("試算履歴の形式が不正です。")
        const request = mapHistoryItemToSimulationRequest(item, mapped)
        if (active) setHistorySeed({ status: "loaded", request })
      } catch (error) {
        if (!active) return
        const reason = error instanceof Error ? error.message : "試算履歴の取得に失敗しました。"
        setHistorySeed({ status: "error", message: `試算履歴の条件を読み込めませんでした（${reason}）。空のフォームで開始します。` })
      }
    })()
    return () => {
      active = false
    }
  }, [])

  /** 結果画面から入力フォームの指定タブへ戻る */
  function editInputTab(tab: SimulationTabId) {
    setFormTab(tab)
    setShowResult(false)
  }

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
      runningCostBreakdown: data.runningCosts.items,
      machineMaintenanceCost: data.runningCosts.machineMaintenance,
      initialInvestmentTotal: data.investmentCosts.total,
      initialInvestmentByRoyaltyRate: data.investmentCosts.byRoyaltyRate,
      franchiseRate: data.calcParams.royaltyRate,
      includeDepreciation: true,
      populationByRadius: data.populationByRadius,
      populationByAgeRadius: data.populationByAgeRadius,
    investmentBreakdown: data.investmentCosts.byField,
    depreciationYearsByField: data.investmentCosts.depreciationYearsByField,
    securityIntroBreakdown: data.investmentCosts.securityIntroBreakdown,
      formState: data.formState,
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
  // 一度試算済みか（＝結果画面から入力へ戻ってきた状態か）。実行ボタンの文言切替に使う。
  const hasSimulated = submittedData !== null

  const regressionActions = (
    <div className="flex items-center gap-2">
      {/* 試算済みなら、再実行せずに結果へ戻れるようにする（ユーザーfb③） */}
      {hasSimulated && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowResult(true)}
        >
          <ArrowRightIcon className="size-3.5" />
          試算結果に戻る
        </Button>
      )}
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
        title={showResult ? "試算結果" : "新規試算"}
        description={
          showResult
            ? "入力情報をもとにした収益シミュレーション結果です"
            : "店舗情報を入力して、初期投資・月間収益・回収期間を試算します"
        }
        actions={
          showResult ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => editInputTab(formTab)}
              className="gap-1.5 text-xs"
            >
              <ArrowLeftIcon className="size-3.5" />
              入力条件を編集する
            </Button>
          ) : (
            regressionActions
          )
        }
      />
      <div className="overflow-auto">
        {/*
          入力フォームは結果表示中もアンマウントせず CSS で隠す。
          アンマウントすると SimulationForm 内の入力state（費目ごとの金額・数量・手入力フラグ等）が
          すべて失われ、「入力に戻る」で条件を再編集できなくなるため（ユーザーfb③）。
        */}
        <div className={showResult ? "hidden" : undefined}>
          <div className="mx-auto max-w-3xl px-8 py-7">
            {/* Intro banner */}
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
              <SparklesIcon className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="text-xs leading-relaxed text-foreground/70">
                {hasSimulated
                  ? "条件を修正したら「この条件で再試算する」を押してください。どのタブからでも再試算できます。修正せずに結果へ戻る場合は右上の「試算結果に戻る」から。"
                  : "各タブを順番に入力し、最後のタブで「試算を実行する」ボタンを押してください。エリアを選択すると坪単価が自動入力されます。"}
              </p>
            </div>
            {historySeed.status === "checking" ? null : historySeed.status === "loading" ? (
              <p className="py-10 text-center text-sm text-muted-foreground">試算履歴の条件を読み込み中です...</p>
            ) : (
              <>
                {historySeed.status === "loaded" && (
                  <p className="mb-4 rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    試算履歴「{historySeed.request.storeName}」の条件を読み込みました。変更して試算を実行してください。
                  </p>
                )}
                {historySeed.status === "error" && (
                  <p className="mb-4 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {historySeed.message}
                  </p>
                )}
                {/* 初期値は初回レンダリングで state に入るため、履歴の読込完了後にマウントする */}
                <SimulationForm
                  onSubmitWithData={handleSubmitWithData}
                  submitLabel={hasSimulated ? "この条件で再試算する" : undefined}
                  activeTab={formTab}
                  onActiveTabChange={setFormTab}
                  initialRequest={historySeed.status === "loaded" ? historySeed.request : undefined}
                />
              </>
            )}
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

        {showResult && (
          <div className="mx-auto max-w-6xl px-8 py-7">
            {/*
              結果画面から入力画面（特にコスト画面）へ直接戻るための導線（ユーザーfb③）。
              ヘッダーの「入力条件を編集する」だけでは見落とされやすく、戻り先タブも選べないため、
              結果本体の直前に各タブへのジャンプボタンを常設する。入力値は保持されたままなので、
              金額を直して「この条件で再試算する」を押せばそのまま再計算できる。
            */}
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <PencilIcon className="size-4 shrink-0 text-primary" />
              <span className="text-xs text-foreground/80">
                条件を変えて試算し直せます。入力内容はそのまま残っています。
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {SIMULATION_TABS.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <Button
                      key={tab.id}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 bg-background text-xs"
                      onClick={() => editInputTab(tab.id)}
                    >
                      <Icon className="size-3.5" />
                      {tab.label}を編集
                    </Button>
                  )
                })}
              </div>
            </div>

            <ResultTabs
              data={displayResult}
              demographicsData={submittedData?.demographics}
              demographicsError={submittedData?.demographicsError}
              simulationRequest={simulationRequest}
            />
          </div>
        )}
      </div>
    </>
  )
}
