"use client"

import { useState } from "react"
import { ArrowLeftIcon, CalculatorIcon, SparklesIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { SimulationForm } from "@/components/simulation-form"
import { ResultTabs } from "@/components/result/result-tabs"
import { Button } from "@/components/ui/button"
import { demoSimulationResults } from "@/lib/mock-data"

export default function NewSimulationPage() {
  const [showResult, setShowResult] = useState(false)
  const data = demoSimulationResults[0]

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
            <ResultTabs data={data} />
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
          <SimulationForm onSubmit={() => setShowResult(true)} />
        </div>
      </div>
    </>
  )
}
