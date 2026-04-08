"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClockIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ResultTabs } from "@/components/result/result-tabs"
import { Button } from "@/components/ui/button"
import type { SimulationResult } from "@/lib/types"
import { getErrorMessage } from "@/lib/error-utils"
import { mapHistoryItemsToResults } from "@/lib/simulation-result-mapper"

export default function ResultPage() {
  const [data, setData] = useState<SimulationResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let active = true

    async function loadLatestResult() {
      try {
        setIsLoading(true)
        setLoadError("")

        const response = await fetch("/api/history?limit=1", { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "試算結果の取得に失敗しました。"))
        }

        const items = Array.isArray(payload?.items) ? payload.items : []
        const mapped = mapHistoryItemsToResults(items)
        if (!active) return
        setData(mapped[0] ?? null)
      } catch (error) {
        if (!active) return
        setData(null)
        setLoadError(error instanceof Error ? error.message : "試算結果の取得に失敗しました。")
      } finally {
        if (!active) return
        setIsLoading(false)
      }
    }

    void loadLatestResult()
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <PageHeader
        title="試算結果"
        description="入力情報をもとにした収益シミュレーション結果です"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-7">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 py-16">
              <ClockIcon className="size-8 animate-pulse text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">試算結果を読み込み中です...</p>
            </div>
          ) : data ? (
            <ResultTabs data={data} />
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
