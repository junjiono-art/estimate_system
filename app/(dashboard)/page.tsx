"use client"

import { useState } from "react"
import { ArrowLeftIcon, SparklesIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { SimulationForm } from "@/components/simulation-form"
import type { FormSubmitData } from "@/components/simulation-form"
import { ResultTabs } from "@/components/result/result-tabs"
import { Button } from "@/components/ui/button"
import type { SimulationResult } from "@/lib/types"

function buildPreviewResult(submittedData: FormSubmitData | null): SimulationResult {
  const now = new Date().toISOString()
  const storeName = submittedData?.storeInfo.storeName?.trim() || "試算結果"
  const location = submittedData?.storeInfo.address?.trim() || ""
  const floorArea = submittedData?.storeInfo.floorArea ?? 0
  const rentPerTsubo = submittedData?.storeInfo.rentPerTsubo ?? 0

  // 簡易的な収益計算（床面積ベース）
  const monthlyRevenue = Math.max(0, floorArea * 50000)
  const monthlyRent = Math.max(0, floorArea * rentPerTsubo)
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
  // 月額会員費を8,000円と仮定
  const monthlyMemberFee = 8000
  const totalMonthlyCost = monthlyRent + monthlyRunningCost + monthlyFranchiseCost
  const breakevenMembers = monthlyMemberFee > 0 ? Math.ceil(totalMonthlyCost / monthlyMemberFee) : 0

  const monthlyProjection = Array.from({ length: 120 }, (_, index) => {
    const month = index + 1
    const cumulativeProfit = monthlyProfit * month - totalInitialInvestment
    return {
      month,
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

export default function NewSimulationPage() {
  const [showResult, setShowResult] = useState(false)
  const [submittedData, setSubmittedData] = useState<FormSubmitData | null>(null)
  const resultData = buildPreviewResult(submittedData)

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
              data={resultData}
              demographicsData={submittedData?.demographics}
              demographicsError={submittedData?.demographicsError}
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="新規試算"
        description="店舗情報を入力して、初期投資・月間収益・回収期間を試算します"
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
            onSubmit={() => setShowResult(true)}
            onSubmitWithData={setSubmittedData}
          />
        </div>
      </div>
    </>
  )
}
