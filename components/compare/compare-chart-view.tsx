"use client"

import { useState } from "react"
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SimulationResult } from "@/lib/types"

const fmt = (n: number) => `${(n / 10000).toFixed(0)}万`

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  borderColor: "var(--color-border)",
  borderRadius: "6px",
  fontSize: "11px",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
}

type ViewMode = "monthly" | "yearly"

interface CompareChartViewProps {
  left: SimulationResult
  right: SimulationResult
  displayMonths?: number
}

function buildChartData(
  left: SimulationResult,
  right: SimulationResult,
  mode: ViewMode,
) {
  if (mode === "monthly") {
    const maxLen = Math.max(left.monthlyProjection.length, right.monthlyProjection.length)
    return Array.from({ length: maxLen }, (_, i) => {
      const lm = left.monthlyProjection[i]
      const rm = right.monthlyProjection[i]
      return {
        name: `${i + 1}M`,
        [`${left.storeName}_利益`]: lm?.profit ?? null,
        [`${right.storeName}_利益`]: rm?.profit ?? null,
        [`${left.storeName}_累積`]: lm?.cumulativeProfit ?? null,
        [`${right.storeName}_累積`]: rm?.cumulativeProfit ?? null,
      }
    })
  }

  // 年次
  const lYears = Math.ceil(left.monthlyProjection.length / 12)
  const rYears = Math.ceil(right.monthlyProjection.length / 12)
  const maxYears = Math.max(lYears, rYears)
  return Array.from({ length: maxYears }, (_, y) => {
    const lSlice = left.monthlyProjection.slice(y * 12, (y + 1) * 12)
    const rSlice = right.monthlyProjection.slice(y * 12, (y + 1) * 12)
    const lProfit = lSlice.reduce((s, m) => s + m.profit, 0)
    const rProfit = rSlice.reduce((s, m) => s + m.profit, 0)
    const lCum = lSlice[lSlice.length - 1]?.cumulativeProfit ?? null
    const rCum = rSlice[rSlice.length - 1]?.cumulativeProfit ?? null
    return {
      name: `${y + 1}年目`,
      [`${left.storeName}_利益`]: lSlice.length > 0 ? lProfit : null,
      [`${right.storeName}_利益`]: rSlice.length > 0 ? rProfit : null,
      [`${left.storeName}_累積`]: lCum,
      [`${right.storeName}_累積`]: rCum,
    }
  })
}

function buildTableData(
  left: SimulationResult,
  right: SimulationResult,
  mode: ViewMode,
) {
  if (mode === "monthly") {
    const maxLen = Math.max(left.monthlyProjection.length, right.monthlyProjection.length)
    return Array.from({ length: maxLen }, (_, i) => ({
      label: `${i + 1}M`,
      lProfit: left.monthlyProjection[i]?.profit ?? null,
      rProfit: right.monthlyProjection[i]?.profit ?? null,
      lCumulative: left.monthlyProjection[i]?.cumulativeProfit ?? null,
      rCumulative: right.monthlyProjection[i]?.cumulativeProfit ?? null,
    }))
  }
  const lYears = Math.ceil(left.monthlyProjection.length / 12)
  const rYears = Math.ceil(right.monthlyProjection.length / 12)
  const maxYears = Math.max(lYears, rYears)
  return Array.from({ length: maxYears }, (_, y) => {
    const lSlice = left.monthlyProjection.slice(y * 12, (y + 1) * 12)
    const rSlice = right.monthlyProjection.slice(y * 12, (y + 1) * 12)
    return {
      label: `${y + 1}年目`,
      lProfit: lSlice.length > 0 ? lSlice.reduce((s, m) => s + m.profit, 0) : null,
      rProfit: rSlice.length > 0 ? rSlice.reduce((s, m) => s + m.profit, 0) : null,
      lCumulative: lSlice[lSlice.length - 1]?.cumulativeProfit ?? null,
      rCumulative: rSlice[rSlice.length - 1]?.cumulativeProfit ?? null,
    }
  })
}

const ROWS_PER_PAGE = 12

export function CompareChartView({ left, right, displayMonths = 24 }: CompareChartViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly")
  const [currentPage, setCurrentPage] = useState(1)

  // displayMonths でデータをスライスした結果を各関数に渡す
  const slicedLeft  = { ...left,  monthlyProjection: left.monthlyProjection.slice(0, displayMonths) }
  const slicedRight = { ...right, monthlyProjection: right.monthlyProjection.slice(0, displayMonths) }

  const chartData = buildChartData(slicedLeft, slicedRight, viewMode)
  const tableData = buildTableData(slicedLeft, slicedRight, viewMode)
  const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE)
  const pagedData = tableData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)

  const leftKey利益  = `${slicedLeft.storeName}_利益`
  const rightKey利益 = `${slicedRight.storeName}_利益`
  const leftKey累積  = `${slicedLeft.storeName}_累積`
  const rightKey累積 = `${slicedRight.storeName}_累積`

  function handleViewModeChange(v: ViewMode) {
    setViewMode(v)
    setCurrentPage(1)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 月次/年次切替 */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">表示単位</span>
        <Tabs value={viewMode} onValueChange={(v) => handleViewModeChange(v as ViewMode)}>
          <TabsList className="h-7 rounded-md border border-border bg-muted/40 p-0.5">
            <TabsTrigger value="monthly" className="h-6 rounded px-3 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
              月次
            </TabsTrigger>
            <TabsTrigger value="yearly" className="h-6 rounded px-3 text-[11px] data-[state=active]:bg-background data-[state=active]:shadow-sm">
              年次
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 利益比較棒グラフ */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {viewMode === "monthly" ? "月次" : "年次"}利益比較
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `${(v / 10000).toLocaleString()}万円`} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <ReferenceLine y={0} stroke="var(--color-border)" />
              <Bar dataKey={leftKey利益}  name={`${slicedLeft.storeName} 利益`}  fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
              <Bar dataKey={rightKey利益} name={`${slicedRight.storeName} 利益`} fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 累積利益折れ線グラフ */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">累積利益推移（投資回収曲線）比較</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `${(v / 10000).toLocaleString()}万円`} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey={leftKey累積}  name={`${slicedLeft.storeName} 累積利益`}  stroke="var(--color-chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey={rightKey累積} name={`${slicedRight.storeName} 累積利益`} stroke="var(--color-chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 比較明細テーブル */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {viewMode === "monthly" ? "月次" : "年次"}明細比較
          </p>
          {totalPages > 1 && (
            <p className="text-[11px] text-muted-foreground">
              {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, tableData.length)} / {tableData.length}件
            </p>
          )}
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="w-14 text-xs">{viewMode === "monthly" ? "月" : "年"}</TableHead>
                <TableHead className="text-right text-xs text-chart-1">{slicedLeft.storeName} 利益</TableHead>
                <TableHead className="text-right text-xs text-chart-2">{slicedRight.storeName} 利益</TableHead>
                <TableHead className="text-right text-xs text-chart-1">{slicedLeft.storeName} 累積</TableHead>
                <TableHead className="text-right text-xs text-chart-2">{slicedRight.storeName} 累積</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedData.map((row) => (
                <TableRow key={row.label} className="border-b border-border/50">
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.label}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${row.lProfit !== null && row.lProfit >= 0 ? "text-chart-2" : "text-destructive"}`}>
                    {row.lProfit !== null ? `${(row.lProfit / 10000).toLocaleString()}万` : "-"}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xs ${row.rProfit !== null && row.rProfit >= 0 ? "text-chart-2" : "text-destructive"}`}>
                    {row.rProfit !== null ? `${(row.rProfit / 10000).toLocaleString()}万` : "-"}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xs ${row.lCumulative !== null && row.lCumulative >= 0 ? "text-chart-1" : "text-destructive"}`}>
                    {row.lCumulative !== null ? `${(row.lCumulative / 10000).toLocaleString()}万` : "-"}
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xs ${row.rCumulative !== null && row.rCumulative >= 0 ? "text-chart-2" : "text-destructive"}`}>
                    {row.rCumulative !== null ? `${(row.rCumulative / 10000).toLocaleString()}万` : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              前へ
            </button>
            <span className="text-[11px] text-muted-foreground">{currentPage} / {totalPages}</span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
