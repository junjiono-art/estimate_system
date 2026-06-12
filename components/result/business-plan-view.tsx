"use client"

import { useMemo, useState } from "react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import type { BusinessPlanMonth, SimulationResult } from "@/lib/types"

interface BusinessPlanViewProps {
  data: SimulationResult
}

type RowKind = "section" | "item" | "subtotal" | "total" | "reference"

type PlanRow = {
  key: string
  label: string
  kind: RowKind
  /** 12ヶ月分の値（データなし月は null） */
  values: (number | null)[]
  /** 通期列（合計を出さない行は null） */
  total: number | null
  /** 人数行（円ではなく人数として表示） */
  isCount?: boolean
}

function formatMoney(value: number): string {
  const rounded = Math.round(value)
  if (rounded < 0) return `(${Math.abs(rounded).toLocaleString("ja-JP")})`
  return rounded.toLocaleString("ja-JP")
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("ja-JP")
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0)
}

/**
 * 事業計画タブ（元Excel「事業計画」シートの再現）。
 * 年次サマリ表と、年選択式の月次内訳表（マーケティング計画・経費計画）を表示する。
 */
export function BusinessPlanView({ data }: BusinessPlanViewProps) {
  const plan = data.businessPlan
  const [selectedYear, setSelectedYear] = useState("1")

  const yearCount = plan ? Math.max(1, Math.ceil(plan.months.length / 12)) : 0
  const yearOptions = Array.from({ length: yearCount }, (_, i) => String(i + 1))

  const yearMonths: BusinessPlanMonth[] = useMemo(() => {
    if (!plan) return []
    const year = parseInt(selectedYear, 10) || 1
    return plan.months.slice((year - 1) * 12, year * 12)
  }, [plan, selectedYear])

  const rows: PlanRow[] = useMemo(() => {
    if (!plan || yearMonths.length === 0) return []

    const pick = (selector: (m: BusinessPlanMonth) => number) => yearMonths.map(selector)
    const monthCount = yearMonths.length

    const result: PlanRow[] = []

    // ── 売上 ──
    result.push({ key: "members", label: "会員数", kind: "item", values: pick((m) => m.members), total: null, isCount: true })
    result.push({ key: "revenue", label: "売上（月契約）", kind: "item", values: pick((m) => m.revenue), total: sum(pick((m) => m.revenue)) })
    result.push({ key: "revenueTotal", label: "売上合計", kind: "subtotal", values: pick((m) => m.revenue), total: sum(pick((m) => m.revenue)) })

    // ── マーケティング計画 ──
    result.push({ key: "marketing", label: "マーケティング計画", kind: "section", values: [], total: null })
    result.push({ key: "newMembers", label: "新規会員数", kind: "item", values: pick((m) => m.newMembers), total: null, isCount: true })
    result.push({ key: "retainedMembers", label: "継続会員数", kind: "item", values: pick((m) => m.retainedMembers), total: null, isCount: true })
    result.push({ key: "signage", label: "店頭看板効果", kind: "item", values: pick((m) => m.signageJoiners), total: sum(pick((m) => m.signageJoiners)), isCount: true })
    result.push({ key: "web", label: "Web広告獲得", kind: "item", values: pick((m) => m.webJoiners), total: sum(pick((m) => m.webJoiners)), isCount: true })
    result.push({ key: "sns", label: "SNS広告", kind: "item", values: pick((m) => m.snsJoiners), total: sum(pick((m) => m.snsJoiners)), isCount: true })
    result.push({ key: "organic", label: "自然検索", kind: "item", values: pick((m) => m.organicJoiners), total: sum(pick((m) => m.organicJoiners)), isCount: true })
    result.push({ key: "referral", label: "口コミ紹介", kind: "item", values: pick((m) => m.referralJoiners), total: sum(pick((m) => m.referralJoiners)), isCount: true })

    // ── 広告予算 ──
    result.push({ key: "adBudget", label: "広告予算", kind: "section", values: [], total: null })
    result.push({ key: "adCost", label: "広告費", kind: "subtotal", values: pick((m) => m.adCost), total: sum(pick((m) => m.adCost)) })
    result.push({ key: "adCostWeb", label: "Web広告費", kind: "item", values: pick((m) => m.adCostWeb), total: sum(pick((m) => m.adCostWeb)) })
    result.push({ key: "adCostSns", label: "SNS広告費", kind: "item", values: pick((m) => m.adCostSns), total: sum(pick((m) => m.adCostSns)) })

    // ── 経費計画（固定費） ──
    result.push({ key: "expense", label: "経費計画", kind: "section", values: [], total: null })
    for (const item of plan.fixedCostItems) {
      result.push({
        key: `fixed-${item.id}`,
        label: item.label,
        kind: "item",
        values: Array(monthCount).fill(item.monthlyAmount),
        total: item.monthlyAmount * monthCount,
      })
    }
    result.push({ key: "fixedTotal", label: "固定費計", kind: "subtotal", values: pick((m) => m.fixedCostTotal), total: sum(pick((m) => m.fixedCostTotal)) })

    // ── 変動費 ──
    result.push({ key: "appFee", label: "アプリ利用料", kind: "item", values: pick((m) => m.appFee), total: sum(pick((m) => m.appFee)) })
    result.push({ key: "royalty", label: "ロイヤリティ", kind: "item", values: pick((m) => m.royalty), total: sum(pick((m) => m.royalty)) })
    result.push({ key: "paymentFee", label: "決済手数料", kind: "item", values: pick((m) => m.paymentFee), total: sum(pick((m) => m.paymentFee)) })
    result.push({ key: "variableTotal", label: "変動費計", kind: "subtotal", values: pick((m) => m.variableCostTotal), total: sum(pick((m) => m.variableCostTotal)) })

    // ── 広告費用・減価償却・経費合計 ──
    result.push({ key: "adCostExpense", label: "広告費用", kind: "item", values: pick((m) => m.adCost), total: sum(pick((m) => m.adCost)) })

    if (plan.depreciationIncludedInCost) {
      result.push({
        key: "depreciation",
        label: "減価償却費",
        kind: "item",
        values: Array(monthCount).fill(plan.monthlyDepreciation),
        total: plan.monthlyDepreciation * monthCount,
      })
    }

    // 内訳合計と経費合計の差（数式セットの上書き等で生じうる）を調整行として表示する
    const componentTotals = yearMonths.map((m) =>
      m.fixedCostTotal + m.variableCostTotal + m.adCost + (plan.depreciationIncludedInCost ? plan.monthlyDepreciation : 0),
    )
    const adjustments = yearMonths.map((m, i) => m.totalCost - componentTotals[i])
    if (adjustments.some((v) => Math.abs(v) >= 1)) {
      result.push({ key: "costAdjustment", label: "その他（式調整）", kind: "item", values: adjustments, total: sum(adjustments) })
    }

    result.push({ key: "totalCost", label: "経費合計", kind: "total", values: pick((m) => m.totalCost), total: sum(pick((m) => m.totalCost)) })
    result.push({ key: "pretaxProfit", label: "税引前利益", kind: "total", values: pick((m) => m.pretaxProfit), total: sum(pick((m) => m.pretaxProfit)) })

    if (!plan.depreciationIncludedInCost) {
      result.push({
        key: "depreciationRef",
        label: "減価償却費（参考・経費合計に含まず）",
        kind: "reference",
        values: Array(monthCount).fill(plan.monthlyDepreciation),
        total: plan.monthlyDepreciation * monthCount,
      })
    }

    return result
  }, [plan, yearMonths])

  if (!plan || plan.months.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
        この試算結果には事業計画の内訳データがありません。再度試算を実行すると表示されます。
      </div>
    )
  }

  const yearStartMonth = ((parseInt(selectedYear, 10) || 1) - 1) * 12
  const annualRows = data.annualProjection ?? []
  let cumulativePretax = 0
  const annualWithCumulative = annualRows.map((row) => {
    cumulativePretax += row.pretaxProfit
    return { ...row, cumulativePretax }
  })

  const rowStyle = (kind: RowKind): string => {
    if (kind === "section") return "bg-muted/60 font-medium text-foreground"
    if (kind === "subtotal") return "bg-muted/30 font-medium"
    if (kind === "total") return "bg-muted/40 font-semibold"
    if (kind === "reference") return "text-muted-foreground"
    return ""
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 年次サマリ表（事業計画 上段の年次推移） */}
      {annualWithCumulative.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium text-foreground">年次推移</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">期</th>
                  <th className="px-3 py-2 text-right font-medium">年度末会員数</th>
                  <th className="px-3 py-2 text-right font-medium">売上</th>
                  <th className="px-3 py-2 text-right font-medium">売上増加率</th>
                  <th className="px-3 py-2 text-right font-medium">経費</th>
                  <th className="px-3 py-2 text-right font-medium">税引前利益</th>
                  <th className="px-3 py-2 text-right font-medium">投資回収率</th>
                  <th className="px-3 py-2 text-right font-medium">税引前利益累計</th>
                  <th className="px-3 py-2 text-right font-medium">税引後利益</th>
                </tr>
              </thead>
              <tbody>
                {annualWithCumulative.map((row) => (
                  <tr key={row.year} className="border-b border-border/50">
                    <td className="px-3 py-1.5">{row.year}期</td>
                    <td className="px-3 py-1.5 text-right">{row.yearEndMembers.toLocaleString("ja-JP")}</td>
                    <td className="px-3 py-1.5 text-right">¥{formatMoney(row.revenue)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {row.revenueGrowthRate != null ? `${Math.round(row.revenueGrowthRate * 100)}%` : "-"}
                    </td>
                    <td className="px-3 py-1.5 text-right">¥{formatMoney(row.cost)}</td>
                    <td className={`px-3 py-1.5 text-right ${row.pretaxProfit < 0 ? "text-destructive" : ""}`}>
                      ¥{formatMoney(row.pretaxProfit)}
                    </td>
                    <td className="px-3 py-1.5 text-right">{Math.round(row.paybackRatio * 100)}%</td>
                    <td className={`px-3 py-1.5 text-right ${row.cumulativePretax < 0 ? "text-destructive" : ""}`}>
                      ¥{formatMoney(row.cumulativePretax)}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${row.afterTaxProfit < 0 ? "text-destructive" : ""}`}>
                      ¥{formatMoney(row.afterTaxProfit)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-3 py-1.5">合計</td>
                  <td className="px-3 py-1.5 text-right">-</td>
                  <td className="px-3 py-1.5 text-right">¥{formatMoney(sum(annualWithCumulative.map((r) => r.revenue)))}</td>
                  <td className="px-3 py-1.5 text-right">-</td>
                  <td className="px-3 py-1.5 text-right">¥{formatMoney(sum(annualWithCumulative.map((r) => r.cost)))}</td>
                  <td className="px-3 py-1.5 text-right">¥{formatMoney(sum(annualWithCumulative.map((r) => r.pretaxProfit)))}</td>
                  <td className="px-3 py-1.5 text-right">-</td>
                  <td className="px-3 py-1.5 text-right">-</td>
                  <td className="px-3 py-1.5 text-right">¥{formatMoney(sum(annualWithCumulative.map((r) => r.afterTaxProfit)))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 月次内訳表（事業計画 下段の月次ブロック） */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-foreground">月次内訳（金額の内訳）</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">表示年</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y} className="text-xs">{y}年目</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="sticky left-0 z-10 min-w-44 bg-card px-3 py-2 text-left font-medium">項目</th>
                {yearMonths.map((m) => (
                  <th key={m.month} className="min-w-20 px-2 py-2 text-right font-medium">
                    {yearStartMonth === 0 && m.month === 1 ? "初月" : `${m.month}ヶ月目`}
                  </th>
                ))}
                <th className="min-w-24 px-3 py-2 text-right font-medium">通期</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row.kind === "section") {
                  return (
                    <tr key={row.key} className={`border-b border-border/50 ${rowStyle(row.kind)}`}>
                      <td className="sticky left-0 z-10 bg-muted/60 px-3 py-1.5" colSpan={yearMonths.length + 2}>
                        {row.label}
                      </td>
                    </tr>
                  )
                }
                const format = row.isCount ? formatCount : formatMoney
                return (
                  <tr key={row.key} className={`border-b border-border/50 ${rowStyle(row.kind)}`}>
                    <td className={`sticky left-0 z-10 bg-card px-3 py-1.5 ${row.kind === "item" ? "pl-5" : ""}`}>
                      {row.label}
                    </td>
                    {row.values.map((value, i) => (
                      <td
                        key={i}
                        className={`px-2 py-1.5 text-right ${value != null && value < 0 ? "text-destructive" : ""}`}
                      >
                        {value != null ? format(value) : "-"}
                      </td>
                    ))}
                    <td className={`px-3 py-1.5 text-right font-medium ${row.total != null && row.total < 0 ? "text-destructive" : ""}`}>
                      {row.total != null ? format(row.total) : "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground">
          元Excel「事業計画」シートの月次内訳を再現しています。人数は表示上四捨五入（計算は未丸めの値で実施）。
          {plan.depreciationIncludedInCost
            ? "減価償却費は経費合計に含まれています（フィルタの「減価償却を利益計算に含める」設定に連動）。"
            : "減価償却費は経費合計に含まれていません（参考行として表示）。"}
        </p>
      </div>
    </div>
  )
}
