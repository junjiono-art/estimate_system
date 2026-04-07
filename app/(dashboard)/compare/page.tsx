"use client"

import { useState, useMemo } from "react"
import { ArrowRightLeftIcon, WalletIcon, BanknoteIcon, TrendingUpIcon, CalendarIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StarRating } from "@/components/star-rating"
import { CompareKpiSection } from "@/components/compare/compare-kpi-section"
import { CompareChartView } from "@/components/compare/compare-chart-view"
import { CompareDashboardView } from "@/components/compare/compare-dashboard-view"
import { demoSimulationResults } from "@/lib/mock-data"
import type { SimulationResult } from "@/lib/types"

const fmt = (n: number) =>
  `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`

const comparisonItems = [
  { label: "初期投資額",           key: "totalInitialInvestment" as const, icon: WalletIcon },
  { label: "月間売上",             key: "monthlyRevenue"         as const, icon: BanknoteIcon },
  { label: "月間利益",             key: "monthlyProfit"          as const, icon: TrendingUpIcon },
  { label: "投資回収期間",         key: "paybackMonths"          as const, icon: CalendarIcon },
  { label: "月間賃料",             key: "monthlyRent"            as const },
  { label: "月間ランニングコスト", key: "monthlyRunningCost"     as const },
  { label: "マシン費用",           key: "machinesCost"           as const },
  { label: "内装工事費",           key: "interiorCost"           as const },
]

const COST_KEYS = new Set(["monthlyRent","monthlyRunningCost","totalInitialInvestment","machinesCost","interiorCost"])

interface FilterState {
  yearMonth: string
  createdBy: string
  rating: number | undefined
}

function applyFilter(results: SimulationResult[], filter: FilterState): SimulationResult[] {
  return results.filter((r) => {
    if (filter.yearMonth) {
      const d = new Date(r.createdAt)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (ym !== filter.yearMonth) return false
    }
    if (filter.createdBy && !r.createdBy.includes(filter.createdBy)) return false
    if (filter.rating !== undefined && r.rating !== filter.rating) return false
    return true
  })
}

export default function ComparePage() {
  const results = demoSimulationResults

  const yearMonths = useMemo(() => {
    const set = new Set<string>()
    results.forEach((r) => {
      const d = new Date(r.createdAt)
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    })
    return [...set].sort().reverse()
  }, [results])

  const [leftFilter,  setLeftFilter]  = useState<FilterState>({ yearMonth: "", createdBy: "", rating: undefined })
  const [rightFilter, setRightFilter] = useState<FilterState>({ yearMonth: "", createdBy: "", rating: undefined })

  const leftFiltered  = useMemo(() => applyFilter(results, leftFilter),  [results, leftFilter])
  const rightFiltered = useMemo(() => applyFilter(results, rightFilter), [results, rightFilter])

  const [leftId,  setLeftId]  = useState(results[0]?.id ?? "")
  const [rightId, setRightId] = useState(results[1]?.id ?? "")
  const [displayMonths, setDisplayMonths] = useState<number>(24)

  const left  = results.find((r) => r.id === leftId)
  const right = results.find((r) => r.id === rightId)

  function fmtVal(key: string, val: number) {
    return key === "paybackMonths" ? `${val}ヶ月` : fmt(val)
  }

  function diffBadge(key: string, lv: number, rv: number) {
    const d = rv - lv
    if (d === 0) return null
    const isBetter = COST_KEYS.has(key) ? d < 0 : (key === "paybackMonths" ? d < 0 : d > 0)
    const label = key === "paybackMonths"
      ? `${d > 0 ? "+" : ""}${d}ヶ月`
      : `${d > 0 ? "+" : ""}${fmt(d)}`
    return (
      <Badge variant="outline" className={`text-[10px] font-mono ${isBetter ? "border-chart-2/40 text-chart-2" : "border-destructive/40 text-destructive"}`}>
        {label}
      </Badge>
    )
  }

  function FilterPanel({
    filter,
    setFilter,
    label,
  }: {
    filter: FilterState
    setFilter: React.Dispatch<React.SetStateAction<FilterState>>
    label: string
  }) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">作成時期（年月）</Label>
            <Select value={filter.yearMonth || "__all__"} onValueChange={(v) => setFilter((f) => ({ ...f, yearMonth: v === "__all__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">すべて</SelectItem>
                {yearMonths.map((ym) => (
                  <SelectItem key={ym} value={ym} className="text-xs">{ym}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">作成者</Label>
            <Input
              type="text"
              placeholder="名前で検索"
              value={filter.createdBy}
              onChange={(e) => setFilter((f) => ({ ...f, createdBy: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] text-muted-foreground">評価</Label>
            <Select
              value={filter.rating !== undefined ? String(filter.rating) : "__all__"}
              onValueChange={(v) => setFilter((f) => ({ ...f, rating: v === "__all__" ? undefined : Number(v) }))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">すべて</SelectItem>
                <SelectItem value="1" className="text-xs">★</SelectItem>
                <SelectItem value="2" className="text-xs">★★</SelectItem>
                <SelectItem value="3" className="text-xs">★★★</SelectItem>
                <SelectItem value="4" className="text-xs">★★★★</SelectItem>
                <SelectItem value="5" className="text-xs">★★★★★</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="試算比較"
        description="2つの試算結果を並べて比較します"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-7">

          {/* 比較元・比較先のフィルタとセレクタ */}
          <div className="mb-6 flex flex-col gap-3">
            {/* フィルタ行：左右等幅、中央はボタン幅分のスペーサー */}
            <div className="grid grid-cols-[1fr_2.25rem_1fr] items-start gap-3">
              <FilterPanel filter={leftFilter} setFilter={setLeftFilter} label="比較元 絞り込み" />
              <div className="h-full" />
              <FilterPanel filter={rightFilter} setFilter={setRightFilter} label="比較先 絞り込み" />
            </div>

            {/* セレクト行：左右等幅、中央に入れ替えボタン */}
            <div className="grid grid-cols-[1fr_2.25rem_1fr] items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">比較元を選択</Label>
                <Select value={leftId} onValueChange={setLeftId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    {leftFiltered.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">該当なし</div>
                    )}
                    {leftFiltered.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.rating !== undefined && "★".repeat(r.rating) + " "}
                        {r.storeName}（{r.createdBy} / {new Date(r.createdAt).toLocaleDateString("ja-JP")}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 入れ替えボタン */}
              <button
                type="button"
                onClick={() => {
                  const tmp = leftId
                  setLeftId(rightId)
                  setRightId(tmp)
                }}
                className="flex size-9 items-center justify-center self-end rounded-full border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground"
                aria-label="比較元と比較先を入れ替え"
              >
                <ArrowRightLeftIcon className="size-4" />
              </button>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">比較先を選択</Label>
                <Select value={rightId} onValueChange={setRightId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    {rightFiltered.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">該当なし</div>
                    )}
                    {rightFiltered.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.rating !== undefined && "★".repeat(r.rating) + " "}
                        {r.storeName}（{r.createdBy} / {new Date(r.createdAt).toLocaleDateString("ja-JP")}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 比較表 + ダッシュボード/グラフタブ */}
          {left && right && (
            <div className="flex flex-col gap-5">
              {/* KPI比較セクション（常時表示） */}
              <CompareKpiSection left={left} right={right} />

              <Tabs defaultValue="table">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <TabsList className="rounded-md border border-border bg-muted/40 p-0.5">
                    <TabsTrigger value="table" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      比較表
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      ダッシュボード
                    </TabsTrigger>
                    <TabsTrigger value="chart" className="rounded text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      グラフ + 表
                    </TabsTrigger>
                  </TabsList>

                  {/* 表示月数セレクタ（ダッシュボード/グラフタブで有効） */}
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] text-muted-foreground whitespace-nowrap">表示月数</Label>
                    <Select value={String(displayMonths)} onValueChange={(v) => setDisplayMonths(Number(v))}>
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6"  className="text-xs">6ヶ月</SelectItem>
                        <SelectItem value="12" className="text-xs">12ヶ月</SelectItem>
                        <SelectItem value="24" className="text-xs">24ヶ月</SelectItem>
                        <SelectItem value="36" className="text-xs">36ヶ月</SelectItem>
                        <SelectItem value="60" className="text-xs">60ヶ月</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ---- 比較表タブ ---- */}
                <TabsContent value="table" className="mt-4">
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    {/* ヘッダー */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border bg-muted/30">
                      <div className="px-5 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">項目</div>
                      <div className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-chart-1">{left.storeName}</div>
                      <div className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-chart-2">{right.storeName}</div>
                      <div className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">差分</div>
                    </div>

                    {/* 作成者行 */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border/50 bg-muted/10">
                      <div className="flex items-center gap-2 px-5 py-3">
                        <span className="text-xs text-foreground">作成者</span>
                      </div>
                      <div className="px-4 py-3 text-right text-xs text-muted-foreground">{left.createdBy}</div>
                      <div className="px-4 py-3 text-right text-xs text-muted-foreground">{right.createdBy}</div>
                      <div className="px-4 py-3" />
                    </div>

                    {/* 評価行 */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border/50 bg-muted/20">
                      <div className="flex items-center gap-2 px-5 py-3">
                        <span className="text-xs text-foreground">評価</span>
                      </div>
                      <div className="flex items-center justify-end px-4 py-3">
                        {left.rating !== undefined
                          ? <StarRating value={left.rating} readonly size="sm" />
                          : <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                      <div className="flex items-center justify-end px-4 py-3">
                        {right.rating !== undefined
                          ? <StarRating value={right.rating} readonly size="sm" />
                          : <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                      <div className="px-4 py-3" />
                    </div>

                    {comparisonItems.map((item, idx) => {
                      const lv = left[item.key]
                      const rv = right[item.key]
                      return (
                        <div
                          key={item.key}
                          className={`grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-border/50 last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                        >
                          <div className="flex items-center gap-2 px-5 py-3">
                            {item.icon && <item.icon className="size-3.5 text-muted-foreground/60" />}
                            <span className="text-xs text-foreground">{item.label}</span>
                          </div>
                          <div className="px-4 py-3 text-right font-mono text-xs text-foreground">{fmtVal(item.key, lv)}</div>
                          <div className="px-4 py-3 text-right font-mono text-xs text-foreground">{fmtVal(item.key, rv)}</div>
                          <div className="flex items-center justify-end px-4 py-3">{diffBadge(item.key, lv, rv)}</div>
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>

                {/* ---- ダッシュボードタブ ---- */}
                <TabsContent value="dashboard" className="mt-4">
                  <CompareDashboardView left={left} right={right} displayMonths={displayMonths} />
                </TabsContent>

                {/* ---- グラフ+表タブ ---- */}
                <TabsContent value="chart" className="mt-4">
                  <CompareChartView left={left} right={right} displayMonths={displayMonths} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
