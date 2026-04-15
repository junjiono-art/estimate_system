"use client"

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts"
import { Progress } from "@/components/ui/progress"
import type { SimulationResult } from "@/lib/types"

const SCENARIO_LABELS: Record<string, string> = {
  conservative: "保守",
  standard:     "スタンダード",
  aggressive:   "アグレッシブ",
}

const LOCATION_LABELS: Record<string, string> = {
  urban:    "都市型",
  suburban: "郊外型",
  rural:    "田舎型",
}

interface DashboardViewProps {
  data: SimulationResult
  includeDepreciation?: boolean
  competitorCount?: number | null
  locationType?: string | null
}

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
]

const fmt = (n: number) =>
  `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  borderColor: "var(--color-border)",
  borderRadius: "6px",
  fontSize: "11px",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
}

export function DashboardView({
  data,
  includeDepreciation = true,
  competitorCount = null,
  locationType = null,
}: DashboardViewProps) {
  const investmentBreakdown = [
    { name: "マシン費",    value: data.machinesCost },
    { name: "内装工事",    value: data.interiorCost },
    { name: "FC初期費用",  value: data.franchiseInitialCost },
    { name: "その他",      value: data.otherInitialCost },
  ].filter((d) => d.value > 0)

  const monthlyCostBreakdown = [
    { name: "賃料",             value: data.monthlyRent },
    { name: "ランニングコスト", value: data.monthlyRunningCost },
    { name: "FC月額",           value: data.monthlyFranchiseCost },
  ].filter((d) => d.value > 0)

  const profitMargin = data.monthlyRevenue > 0
    ? Math.round((data.monthlyProfit / data.monthlyRevenue) * 100)
    : 0

  const projLen = data.monthlyProjection.length
  const last = data.monthlyProjection[projLen - 1]
  const recoveredAmount = data.totalInitialInvestment + (last?.cumulativeProfit ?? 0)
  const recoveryPercent = Math.max(0, Math.min(100, Math.round((recoveredAmount / data.totalInitialInvestment) * 100)))

  return (
    <div className="flex flex-col gap-5">
      {/* 上段: 3カラム */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 初期投資円グラフ */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">初期投資内訳</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={investmentBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={3}>
                  {investmentBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {investmentBreakdown.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="block size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-[10px] text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-mono text-[10px] text-foreground">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 月間コスト横棒 */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">月間コスト内訳</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCostBreakdown} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 収益サマリ */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">収益サマリ</p>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-muted-foreground">月間利益率</span>
                <span className="text-2xl font-bold tracking-tight text-foreground">{profitMargin}<span className="text-sm font-normal text-muted-foreground ml-0.5">%</span></span>
              </div>
              <Progress value={profitMargin} className="h-1.5" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-muted-foreground">投資回収進捗（{projLen}ヶ月）</span>
                <span className="text-2xl font-bold tracking-tight text-foreground">{recoveryPercent}<span className="text-sm font-normal text-muted-foreground ml-0.5">%</span></span>
              </div>
              <Progress value={recoveryPercent} className="h-1.5" />
            </div>
            <div className="mt-auto rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-muted-foreground">想定回収期間</span>
                <span className="font-mono text-sm font-semibold text-foreground">{data.paybackMonths} ヶ月</span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                約 {Math.floor(data.paybackMonths / 12)} 年 {data.paybackMonths % 12} ヶ月で回収見込み
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 計算条件サマリーカード */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">計算条件サマリー</p>
        </div>
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              label: "計算シナリオ",
              value: SCENARIO_LABELS[data.scenario ?? "standard"] ?? "—",
            },
            {
              label: "ロイヤリティ率",
              value: data.franchiseRate > 0 ? `${data.franchiseRate}%` : "直営 (0%)",
            },
            {
              label: "競合ジム件数",
              value: competitorCount != null ? `${competitorCount} 件` : "—",
            },
            {
              label: "減価償却",
              value: includeDepreciation ? "含める" : "含めない",
            },
            {
              label: "計算方式",
              value: "API計算",
            },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`flex flex-col gap-1 px-5 py-3 ${i < 4 ? "border-b sm:border-b-0 sm:border-r border-border/60" : ""}`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{item.label}</span>
              <span className="text-sm font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 下段: 明細テーブル 2カラム */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 初期投資明細 */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">初期投資明細</p>
          </div>
          <div className="flex flex-col">
            {[
              { label: "マシン購入費",  value: data.machinesCost },
              { label: "内装工事費",    value: data.interiorCost },
              { label: "FC初期費用",    value: data.franchiseInitialCost },
              { label: "その他初期費用",value: data.otherInitialCost },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between border-b border-border/50 px-5 py-2.5 last:border-0">
                <span className="text-xs text-foreground">{item.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{fmt(item.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-muted/30 px-5 py-2.5">
              <span className="text-xs font-semibold text-foreground">合計</span>
              <span className="font-mono text-xs font-bold text-primary">{fmt(data.totalInitialInvestment)}</span>
            </div>
          </div>
        </div>

        {/* 月間収支明細 */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">月間収支明細</p>
          </div>
          <div className="flex flex-col">
            {[
              { label: "月間売上",           value: data.monthlyRevenue,      positive: true  },
              { label: "賃料",               value: data.monthlyRent,         positive: false },
              { label: "ランニングコスト",   value: data.monthlyRunningCost,  positive: false },
              { label: "FC月額費用",         value: data.monthlyFranchiseCost,positive: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between border-b border-border/50 px-5 py-2.5 last:border-0">
                <span className="text-xs text-foreground">{item.label}</span>
                <span className={`font-mono text-xs ${item.positive ? "text-chart-2" : "text-muted-foreground"}`}>
                  {item.positive ? "" : "−"}{fmt(Math.abs(item.value))}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-muted/30 px-5 py-2.5">
              <span className="text-xs font-semibold text-foreground">月間利益</span>
              <span className={`font-mono text-xs font-bold ${data.monthlyProfit >= 0 ? "text-chart-2" : "text-destructive"}`}>
                {fmt(data.monthlyProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
