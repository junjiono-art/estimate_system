"use client"

import { useState } from "react"
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import type { SimulationResult } from "@/lib/types"

const ROWS_PER_PAGE = 12

interface ChartTableViewProps {
  data: SimulationResult
}

const fmt = (n: number) => `${(n / 10000).toFixed(0)}万`

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  borderColor: "var(--color-border)",
  borderRadius: "6px",
  fontSize: "11px",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
}

type ViewMode = "monthly" | "yearly"

export function ChartTableView({ data }: ChartTableViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly")
  const [currentPage, setCurrentPage] = useState(1)

  // 月次データ
  const monthlyChartData = data.monthlyProjection.map((m) => ({
    name: `${m.month}M`,
    売上: m.revenue,
    コスト: m.cost,
    利益: m.profit,
    累積利益: m.cumulativeProfit,
  }))

  // 年次データ（12ヶ月ごとに合算）
  const yearlyChartData: { name: string; 売上: number; コスト: number; 利益: number; 累積利益: number }[] = []
  const totalMonths = data.monthlyProjection.length
  const years = Math.ceil(totalMonths / 12)
  for (let y = 0; y < years; y++) {
    const startIdx = y * 12
    const endIdx = Math.min(startIdx + 12, totalMonths)
    const slice = data.monthlyProjection.slice(startIdx, endIdx)
    const yearRevenue = slice.reduce((sum, m) => sum + m.revenue, 0)
    const yearCost = slice.reduce((sum, m) => sum + m.cost, 0)
    const yearProfit = slice.reduce((sum, m) => sum + m.profit, 0)
    const lastInSlice = slice[slice.length - 1]
    yearlyChartData.push({
      name: `${y + 1}年目`,
      売上: yearRevenue,
      コスト: yearCost,
      利益: yearProfit,
      累積利益: lastInSlice?.cumulativeProfit ?? 0,
    })
  }

  const chartData = viewMode === "monthly" ? monthlyChartData : yearlyChartData
  const tableData = viewMode === "monthly"
    ? data.monthlyProjection.map((m) => ({ label: `${m.month}M`, ...m }))
    : yearlyChartData.map((y, i) => ({
        label: y.name,
        month: i + 1,
        revenue: y.売上,
        cost: y.コスト,
        profit: y.利益,
        cumulativeProfit: y.累積利益,
      }))

  const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE)
  const pagedTableData = tableData.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE,
  )

  // viewMode 切替時はページをリセット
  function handleViewModeChange(v: ViewMode) {
    setViewMode(v)
    setCurrentPage(1)
  }

  function getPageNumbers(total: number, current: number): (number | "ellipsis")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const pages: (number | "ellipsis")[] = [1]
    if (current > 3) pages.push("ellipsis")
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
      pages.push(p)
    }
    if (current < total - 2) pages.push("ellipsis")
    pages.push(total)
    return pages
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

      {/* 棒グラフ */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {viewMode === "monthly" ? "月次" : "年次"} 売上 / コスト / 利益
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `${(v / 10000).toLocaleString()}万円`} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Bar dataKey="売上"   fill="var(--color-chart-1)" radius={[3,3,0,0]} />
              <Bar dataKey="コスト" fill="var(--color-chart-3)" radius={[3,3,0,0]} />
              <Bar dataKey="利益"   fill="var(--color-chart-2)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 折れ線グラフ */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">累積利益推移（投資回収曲線）</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `${(v / 10000).toLocaleString()}万円`} contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="累積利益" stroke="var(--color-accent)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {viewMode === "monthly" ? "月次" : "年次"}明細データ
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
                <TableHead className="text-right text-xs">売上</TableHead>
                <TableHead className="text-right text-xs">コスト</TableHead>
                <TableHead className="text-right text-xs">利益</TableHead>
                <TableHead className="text-right text-xs">累積利益</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTableData.map((row) => (
                <TableRow key={row.label} className="border-b border-border/50">
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{(row.revenue / 10000).toLocaleString()}万</TableCell>
                  <TableCell className="text-right font-mono text-xs">{(row.cost / 10000).toLocaleString()}万</TableCell>
                  <TableCell className={`text-right font-mono text-xs font-medium ${row.profit >= 0 ? "text-chart-2" : "text-destructive"}`}>
                    {(row.profit / 10000).toLocaleString()}万
                  </TableCell>
                  <TableCell className={`text-right font-mono text-xs font-medium ${row.cumulativeProfit >= 0 ? "text-accent" : "text-destructive"}`}>
                    {(row.cumulativeProfit / 10000).toLocaleString()}万
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="border-t border-border px-5 py-3">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)) }}
                    className={currentPage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                    aria-disabled={currentPage === 1}
                  />
                </PaginationItem>

                {getPageNumbers(totalPages, currentPage).map((page, idx) =>
                  page === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(e) => { e.preventDefault(); setCurrentPage(page) }}
                        className="cursor-pointer text-xs"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.min(totalPages, p + 1)) }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                    aria-disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  )
}
