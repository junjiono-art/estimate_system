"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClockIcon, PencilIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ResultTabs } from "@/components/result/result-tabs"
import { Button } from "@/components/ui/button"
import type { SimulationRequestInput, SimulationResult } from "@/lib/types"
import { getErrorMessage } from "@/lib/error-utils"
import {
  type HistoryApiResult,
  mapHistoryItemToResult,
  mapHistoryItemToSimulationRequest,
} from "@/lib/simulation-result-mapper"

export default function ResultPage() {
  const [data, setData] = useState<SimulationResult | null>(null)
  const [simulationRequest, setSimulationRequest] = useState<SimulationRequestInput | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let active = true

    // ?id=<resultId> があればその履歴、無ければ最新1件を表示する。
    // 以前は常に最新1件を表示していたため、履歴一覧のどの行の「詳細」を押しても同じ結果が開いていた。
    async function loadResult() {
      try {
        setIsLoading(true)
        setLoadError("")

        const resultId = new URLSearchParams(window.location.search).get("id")?.trim()
        let latestRaw: HistoryApiResult | null
        if (resultId) {
          const response = await fetch(`/api/results/${encodeURIComponent(resultId)}`, { cache: "no-store" })
          const payload = await response.json().catch(() => null)
          if (!response.ok) {
            throw new Error(getErrorMessage(payload, "試算結果の取得に失敗しました。"))
          }
          latestRaw = (payload?.item ?? null) as HistoryApiResult | null
        } else {
          const response = await fetch("/api/history?limit=1", { cache: "no-store" })
          const payload = await response.json().catch(() => null)
          if (!response.ok) {
            throw new Error(getErrorMessage(payload, "試算結果の取得に失敗しました。"))
          }
          const items = Array.isArray(payload?.items) ? payload.items : []
          latestRaw = (items[0] ?? null) as HistoryApiResult | null
        }

        const latest = latestRaw ? mapHistoryItemToResult(latestRaw) : null
        if (!active) return
        setData(latest)
        setSimulationRequest(latest && latestRaw ? mapHistoryItemToSimulationRequest(latestRaw, latest) : null)
      } catch (error) {
        if (!active) return
        setData(null)
        setSimulationRequest(null)
        setLoadError(error instanceof Error ? error.message : "試算結果の取得に失敗しました。")
      } finally {
        if (!active) return
        setIsLoading(false)
      }
    }

    void loadResult()
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <PageHeader
        title="試算結果"
        description="入力情報をもとにした収益シミュレーション結果です"
        actions={
          // この画面はフォームstateを持たないため、新規試算画面へ表示中の履歴IDを渡し、
          // その条件をフォームの初期値として読み込ませる（/?from=<resultId>）。
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href={data?.id ? `/?from=${encodeURIComponent(data.id)}` : "/"}>
              <PencilIcon className="size-3.5" />
              条件を変えて試算する
            </Link>
          </Button>
        }
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-screen-2xl px-8 py-7">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 py-16">
              <ClockIcon className="size-8 animate-pulse text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">試算結果を読み込み中です...</p>
            </div>
          ) : data ? (
            <ResultTabs data={data} simulationRequest={simulationRequest} />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 py-16">
              <ClockIcon className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">表示できる試算結果がありません</p>
              {loadError && <p className="text-xs text-destructive">{loadError}</p>}
              <Button asChild size="sm" className="text-xs">
                <Link href="/">新規試算を開始</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
