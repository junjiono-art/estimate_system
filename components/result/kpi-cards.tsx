"use client"

import { BanknoteIcon, TrendingUpIcon, CalendarIcon, WalletIcon, UsersIcon } from "lucide-react"
import type { SimulationResult } from "@/lib/types"

interface KpiCardsProps {
  data: SimulationResult
}

const formatYen = (n: number) =>
  `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`

export function KpiCards({ data }: KpiCardsProps) {
  const projectedMonth12Members = data.monthlyProjection[11]?.members
  const estimatedMonthlyFee = 2980
  const estimatedMembers =
    Number.isFinite(projectedMonth12Members)
      ? Math.max(0, Math.round(projectedMonth12Members ?? 0))
      : estimatedMonthlyFee > 0
        ? Math.round(data.monthlyRevenue / estimatedMonthlyFee)
        : 0

  const cards = [
    {
      label: "初期投資額",
      value: formatYen(data.totalInitialInvestment),
      icon: WalletIcon,
      accent: "bg-chart-1/10 text-chart-1",
      border: "border-chart-1/20",
    },
    {
      label: "月間売上予測",
      value: formatYen(data.monthlyRevenue),
      icon: BanknoteIcon,
      accent: "bg-chart-2/10 text-chart-2",
      border: "border-chart-2/20",
    },
    {
      label: "月間利益予測",
      value: formatYen(data.monthlyProfit),
      icon: TrendingUpIcon,
      accent: "bg-accent/10 text-accent",
      border: "border-accent/20",
    },
    {
      label: "投資回収期間",
      value: `${data.paybackMonths} ヶ月`,
      icon: CalendarIcon,
      accent: "bg-chart-4/10 text-chart-4",
      border: "border-chart-4/20",
    },
    {
      label: "見込み会員数",
      value: `${estimatedMembers.toLocaleString()} 人`,
      icon: UsersIcon,
      accent: "bg-chart-5/10 text-chart-5",
      border: "border-chart-5/20",
    },
    {
      label: "損益分岐点（会員数）",
      value: data.breakevenMembers !== undefined ? `${data.breakevenMembers} 人` : "－",
      icon: UsersIcon,
      accent: "bg-chart-3/10 text-chart-3",
      border: "border-chart-3/20",
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`flex items-start gap-3 rounded-lg border bg-card p-4 ${c.border}`}
        >
          <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${c.accent}`}>
            <c.icon className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {c.label}
            </span>
            <span className="text-xl font-bold leading-none tracking-tight text-foreground">
              {c.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
