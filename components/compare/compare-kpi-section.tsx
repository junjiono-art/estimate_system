"use client"

import { BanknoteIcon, TrendingUpIcon, CalendarIcon, WalletIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SimulationResult } from "@/lib/types"

const fmt = (n: number) =>
  `${(n / 10000).toLocaleString(undefined, { maximumFractionDigits: 0 })}万円`

const COST_KEYS = new Set(["totalInitialInvestment", "paybackMonths"])

interface CompareKpiSectionProps {
  left: SimulationResult
  right: SimulationResult
}

interface KpiItem {
  label: string
  key: keyof SimulationResult
  icon: React.ElementType
  accent: string
  border: string
  format: (v: number) => string
  lowerIsBetter?: boolean
}

const kpiItems: KpiItem[] = [
  {
    label: "初期投資額",
    key: "totalInitialInvestment",
    icon: WalletIcon,
    accent: "bg-chart-1/10 text-chart-1",
    border: "border-chart-1/20",
    format: fmt,
    lowerIsBetter: true,
  },
  {
    label: "月間売上予測",
    key: "monthlyRevenue",
    icon: BanknoteIcon,
    accent: "bg-chart-2/10 text-chart-2",
    border: "border-chart-2/20",
    format: fmt,
    lowerIsBetter: false,
  },
  {
    label: "月間利益予測",
    key: "monthlyProfit",
    icon: TrendingUpIcon,
    accent: "bg-accent/10 text-accent",
    border: "border-accent/20",
    format: fmt,
    lowerIsBetter: false,
  },
  {
    label: "投資回収期間",
    key: "paybackMonths",
    icon: CalendarIcon,
    accent: "bg-chart-4/10 text-chart-4",
    border: "border-chart-4/20",
    format: (v) => `${v} ヶ月`,
    lowerIsBetter: true,
  },
]

export function CompareKpiSection({ left, right }: CompareKpiSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        KPI 比較
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiItems.map((item) => {
          const lv = left[item.key] as number
          const rv = right[item.key] as number
          const diff = rv - lv
          const isBetter = item.lowerIsBetter ? diff < 0 : diff > 0
          const diffLabel =
            item.key === "paybackMonths"
              ? `${diff > 0 ? "+" : ""}${diff}ヶ月`
              : `${diff > 0 ? "+" : ""}${fmt(diff)}`

          return (
            <div
              key={item.key}
              className={`flex flex-col gap-3 rounded-lg border bg-card p-4 ${item.border}`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex size-7 items-center justify-center rounded-md ${item.accent}`}>
                  <item.icon className="size-3.5" />
                </div>
                {diff !== 0 && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono ${isBetter ? "border-chart-2/40 text-chart-2" : "border-destructive/40 text-destructive"}`}
                  >
                    {diffLabel}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="truncate text-[9px] text-muted-foreground/70">{left.storeName}</span>
                  <span className="font-mono text-sm font-bold leading-none text-foreground">
                    {item.format(lv)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="truncate text-[9px] text-muted-foreground/70">{right.storeName}</span>
                  <span className="font-mono text-sm font-bold leading-none text-foreground">
                    {item.format(rv)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
