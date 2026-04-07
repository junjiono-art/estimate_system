"use client"

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ReferenceLine, Legend,
} from "recharts"
import { Progress } from "@/components/ui/progress"
import type { SimulationResult } from "@/lib/types"

const fmt = (n: number) =>
  `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  borderColor: "var(--color-border)",
  borderRadius: "6px",
  fontSize: "11px",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
}

interface CompareDashboardViewProps {
  left: SimulationResult
  right: SimulationResult
  displayMonths?: number
}

export function CompareDashboardView({ left, right, displayMonths = 24 }: CompareDashboardViewProps) {
  // displayMonths でスライスした月次データを使って集計
  const lProjection = left.monthlyProjection.slice(0, displayMonths)
  const rProjection = right.monthlyProjection.slice(0, displayMonths)

  // 累積利益推移データ（displayMonths 適用）
  const cumulativeData = Array.from(
    { length: Math.max(lProjection.length, rProjection.length) },
    (_, i) => ({
      name: `${i + 1}M`,
      [left.storeName]:  lProjection[i]?.cumulativeProfit ?? null,
      [right.storeName]: rProjection[i]?.cumulativeProfit ?? null,
    })
  )
  // 月間収支比較棒グラフデータ
  const monthlyData = [
    { name: "月間売上",   [left.storeName]: left.monthlyRevenue,      [right.storeName]: right.monthlyRevenue },
    { name: "月間コスト", [left.storeName]: left.monthlyRevenue - left.monthlyProfit, [right.storeName]: right.monthlyRevenue - right.monthlyProfit },
    { name: "月間利益",   [left.storeName]: left.monthlyProfit,       [right.storeName]: right.monthlyProfit },
  ]

  // 初期投資比較棒グラフデータ
  const investmentData = [
    { name: "マシン費",   [left.storeName]: left.machinesCost,          [right.storeName]: right.machinesCost },
    { name: "内装工事",   [left.storeName]: left.interiorCost,          [right.storeName]: right.interiorCost },
    { name: "FC初期費用", [left.storeName]: left.franchiseInitialCost,  [right.storeName]: right.franchiseInitialCost },
    { name: "その他",     [left.storeName]: left.otherInitialCost,      [right.storeName]: right.otherInitialCost },
  ].filter((d) => d[left.storeName] > 0 || d[right.storeName] > 0)

  // レーダーチャートデータ（スコア正規化）
  const maxRevenue    = Math.max(left.monthlyRevenue, right.monthlyRevenue) || 1
  const maxProfit     = Math.max(left.monthlyProfit,  right.monthlyProfit)  || 1
  const maxPayback    = Math.max(left.paybackMonths,  right.paybackMonths)  || 1
  const maxInvestment = Math.max(left.totalInitialInvestment, right.totalInitialInvestment) || 1

  const radarData = [
    {
      subject: "月間売上",
      [left.storeName]:  Math.round((left.monthlyRevenue  / maxRevenue)    * 100),
      [right.storeName]: Math.round((right.monthlyRevenue / maxRevenue)    * 100),
    },
    {
      subject: "月間利益",
      [left.storeName]:  Math.max(0, Math.round((left.monthlyProfit  / maxProfit) * 100)),
      [right.storeName]: Math.max(0, Math.round((right.monthlyProfit / maxProfit) * 100)),
    },
    {
      subject: "回収速度",
      [left.storeName]:  Math.round(((maxPayback - left.paybackMonths)  / maxPayback) * 100),
      [right.storeName]: Math.round(((maxPayback - right.paybackMonths) / maxPayback) * 100),
    },
    {
      subject: "投資効率",
      [left.storeName]:  left.totalInitialInvestment  > 0 ? Math.round(((maxInvestment - left.totalInitialInvestment)  / maxInvestment) * 100) : 50,
      [right.storeName]: right.totalInitialInvestment > 0 ? Math.round(((maxInvestment - right.totalInitialInvestment) / maxInvestment) * 100) : 50,
    },
    {
      subject: "利益率",
      [left.storeName]:  left.monthlyRevenue  > 0 ? Math.round((left.monthlyProfit  / left.monthlyRevenue)  * 100) : 0,
      [right.storeName]: right.monthlyRevenue > 0 ? Math.round((right.monthlyProfit / right.monthlyRevenue) * 100) : 0,
    },
  ]

  const leftMargin   = left.monthlyRevenue  > 0 ? Math.round((left.monthlyProfit  / left.monthlyRevenue)  * 100) : 0
  const rightMargin  = right.monthlyRevenue > 0 ? Math.round((right.monthlyProfit / right.monthlyRevenue) * 100) : 0
  const maxPaybackDisplay = Math.max(left.paybackMonths, right.paybackMonths)

  return (
    <div className="flex flex-col gap-5">
      {/* 上段: レーダー + 月間収支比較 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* レーダーチャート */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">総合スコア比較</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="block size-2 rounded-full bg-chart-1" />
              <span className="text-[10px] text-muted-foreground">{left.storeName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="block size-2 rounded-full bg-chart-2" />
              <span className="text-[10px] text-muted-foreground">{right.storeName}</span>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey={left.storeName}  fill="var(--color-chart-1)" fillOpacity={0.25} stroke="var(--color-chart-1)" strokeWidth={2} />
                <Radar dataKey={right.storeName} fill="var(--color-chart-2)" fillOpacity={0.25} stroke="var(--color-chart-2)" strokeWidth={2} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 月間収支比較 */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">月間収支比較</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={2} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={tooltipStyle} />
                <Bar dataKey={left.storeName}  fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
                <Bar dataKey={right.storeName} fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 中段: 初期投資内訳比較 */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">初期投資内訳比較</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={investmentData} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={tooltipStyle} />
              <Bar dataKey={left.storeName}  fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
              <Bar dataKey={right.storeName} fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 累積利益推移（displayMonths 分） */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          累積利益推移（{displayMonths}ヶ月）
        </p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => `${(v / 10000).toLocaleString()}万円`} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey={left.storeName}  stroke="var(--color-chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey={right.storeName} stroke="var(--color-chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 下段: 利益率・回収進捗 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 月間利益率 */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">月間利益率</p>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="block size-2 rounded-full bg-chart-1" />
                  <span className="text-xs text-foreground">{left.storeName}</span>
                </div>
                <span className="font-mono text-lg font-bold text-foreground">{leftMargin}<span className="text-xs font-normal text-muted-foreground ml-0.5">%</span></span>
              </div>
              <Progress value={Math.max(0, leftMargin)} className="h-2" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="block size-2 rounded-full bg-chart-2" />
                  <span className="text-xs text-foreground">{right.storeName}</span>
                </div>
                <span className="font-mono text-lg font-bold text-foreground">{rightMargin}<span className="text-xs font-normal text-muted-foreground ml-0.5">%</span></span>
              </div>
              <Progress value={Math.max(0, rightMargin)} className="h-2" />
            </div>
          </div>
        </div>

        {/* 投資回収期間比較 */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">投資回収期間</p>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="block size-2 rounded-full bg-chart-1" />
                  <span className="text-xs text-foreground">{left.storeName}</span>
                </div>
                <span className="font-mono text-lg font-bold text-foreground">
                  {left.paybackMonths}<span className="text-xs font-normal text-muted-foreground ml-0.5">ヶ月</span>
                </span>
              </div>
              <Progress value={maxPaybackDisplay > 0 ? Math.round((left.paybackMonths / maxPaybackDisplay) * 100) : 50} className="h-2" />
              <span className="text-[10px] text-muted-foreground">約 {Math.floor(left.paybackMonths / 12)} 年 {left.paybackMonths % 12} ヶ月</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="block size-2 rounded-full bg-chart-2" />
                  <span className="text-xs text-foreground">{right.storeName}</span>
                </div>
                <span className="font-mono text-lg font-bold text-foreground">
                  {right.paybackMonths}<span className="text-xs font-normal text-muted-foreground ml-0.5">ヶ月</span>
                </span>
              </div>
              <Progress value={maxPaybackDisplay > 0 ? Math.round((right.paybackMonths / maxPaybackDisplay) * 100) : 50} className="h-2" />
              <span className="text-[10px] text-muted-foreground">約 {Math.floor(right.paybackMonths / 12)} 年 {right.paybackMonths % 12} ヶ月</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
