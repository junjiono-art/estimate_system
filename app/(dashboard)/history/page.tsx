"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CalendarIcon, ArrowRightIcon, TrendingUpIcon,
  WalletIcon, BanknoteIcon, TrashIcon, SearchIcon, ClockIcon,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StarRating } from "@/components/star-rating"
import { getErrorMessage } from "@/lib/error-utils"
import type { SimulationResult } from "@/lib/types"
import { mapHistoryItemsToResults } from "@/lib/simulation-result-mapper"

const fmt = (n: number) =>
  `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`

export default function HistoryPage() {
  const [results, setResults] = useState<SimulationResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [searchName,     setSearchName]     = useState("")
  const [searchDateFrom, setSearchDateFrom] = useState("")
  const [searchDateTo,   setSearchDateTo]   = useState("")
  const [filterRating,   setFilterRating]   = useState<number | undefined>(undefined)

  async function handleDelete(sim: SimulationResult) {
    const shouldDelete = window.confirm(`「${sim.storeName}」の試算履歴を削除します。よろしいですか？`)
    if (!shouldDelete) return

    setDeleteError("")
    setDeletingIds((prev) => [...prev, sim.id])

    try {
      const response = await fetch(`/api/results/${sim.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "試算履歴の削除に失敗しました。"))
      }

      setResults((prev) => prev.filter((item) => item.id !== sim.id))
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "試算履歴の削除に失敗しました。")
    } finally {
      setDeletingIds((prev) => prev.filter((id) => id !== sim.id))
    }
  }

  useEffect(() => {
    let active = true

    async function loadHistory() {
      try {
        setIsLoading(true)
        setLoadError("")

        const response = await fetch("/api/history?limit=100", { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "試算履歴の取得に失敗しました。"))
        }

        const items = Array.isArray(payload?.items) ? payload.items : []
        const mapped = mapHistoryItemsToResults(items)

        if (!active) return
        setResults(mapped)
      } catch (error) {
        if (!active) return
        setResults([])
        setLoadError(error instanceof Error ? error.message : "試算履歴の取得に失敗しました。")
      } finally {
        if (!active) return
        setIsLoading(false)
      }
    }

    void loadHistory()
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    return results.filter((sim) => {
      if (searchName && !sim.storeName.includes(searchName)) return false
      const d = new Date(sim.createdAt)
      if (searchDateFrom && d < new Date(searchDateFrom)) return false
      if (searchDateTo) {
        const to = new Date(searchDateTo)
        to.setHours(23, 59, 59, 999)
        if (d > to) return false
      }
      if (filterRating !== undefined && sim.rating !== filterRating) return false
      return true
    })
  }, [results, searchName, searchDateFrom, searchDateTo, filterRating])

  const hasFilter = searchName || searchDateFrom || searchDateTo || filterRating !== undefined

  return (
    <>
      <PageHeader
        title="試算履歴"
        description="実行済みのシミュレーション結果を確認できます"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-7">

          {/* 検索フィルタ */}
          <div className="mb-5 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-muted/30 px-5 py-4">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                店舗名で検索
              </Label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="例: 渋谷" value={searchName} onChange={(e) => setSearchName(e.target.value)} className="h-8 pl-8 text-xs" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">実施日（開始）</Label>
              <Input type="date" value={searchDateFrom} onChange={(e) => setSearchDateFrom(e.target.value)} className="h-8 w-38 text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">実施日（終了）</Label>
              <Input type="date" value={searchDateTo} onChange={(e) => setSearchDateTo(e.target.value)} className="h-8 w-38 text-xs" />
            </div>
            {hasFilter && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setSearchName(""); setSearchDateFrom(""); setSearchDateTo(""); setFilterRating(undefined) }}>
                クリア
              </Button>
            )}
          </div>

          {/* 評価フィルタ */}
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-5 py-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">評価で絞り込み</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFilterRating(filterRating === star ? undefined : star)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    filterRating === star
                      ? "border-amber-400 bg-amber-400/15 text-amber-500"
                      : "border-border text-muted-foreground hover:border-amber-400/60 hover:text-amber-500"
                  }`}
                >
                  {"★".repeat(star)}
                </button>
              ))}
            </div>
          </div>

          {hasFilter && (
            <p className="mb-4 text-xs text-muted-foreground">{filtered.length} 件の結果</p>
          )}

          {deleteError && (
            <p className="mb-4 text-xs text-destructive">{deleteError}</p>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 py-16">
              <ClockIcon className="size-8 animate-pulse text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">試算履歴を読み込み中です...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 py-16">
              <ClockIcon className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {hasFilter ? "検索条件に一致する試算履歴がありません" : "まだ試算履歴がありません"}
              </p>
              {loadError && (
                <p className="text-xs text-destructive">{loadError}</p>
              )}
              {!hasFilter && (
                <Button asChild size="sm" className="text-xs">
                  <Link href="/">新規試算を開始</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
              {filtered.map((sim) => (
                <div key={sim.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                  {/* 左 */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{sim.storeName}</span>
                      {sim.franchiseInitialCost > 0 && (
                        <Badge variant="secondary" className="text-[10px]">FC</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarIcon className="size-3" />
                        {new Date(sim.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                      {sim.rating !== undefined && (
                        <StarRating value={sim.rating} readonly size="sm" />
                      )}
                    </div>
                  </div>

                  {/* 中: KPI */}
                  <div className="flex flex-wrap items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <WalletIcon className="size-3 text-chart-1" />
                      <span className="text-muted-foreground">初期投資</span>
                      <span className="font-mono font-semibold text-foreground">{fmt(sim.totalInitialInvestment)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BanknoteIcon className="size-3 text-chart-2" />
                      <span className="text-muted-foreground">月間利益</span>
                      <span className="font-mono font-semibold text-foreground">{fmt(sim.monthlyProfit)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUpIcon className="size-3 text-accent" />
                      <span className="text-muted-foreground">回収</span>
                      <span className="font-mono font-semibold text-foreground">{sim.paybackMonths}ヶ月</span>
                    </div>
                  </div>

                  {/* 右: アクション */}
                  <div className="flex items-center gap-1.5">
                    {deletingIds.includes(sim.id) && (
                      <span className="text-[10px] text-muted-foreground">削除中...</span>
                    )}
                    <button
                      type="button"
                      disabled={deletingIds.includes(sim.id)}
                      className="flex size-7 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        void handleDelete(sim)
                      }}
                    >
                      <TrashIcon className="size-3.5" />
                    </button>
                    <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
                      <Link href="/result">
                        詳細
                        <ArrowRightIcon className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
