"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { MapPinIcon, UsersIcon, AlertCircleIcon } from "lucide-react"
import { extractCity } from "@/lib/utils"
import { findCityDemographics } from "@/lib/mock-data"
import type { SimulationResult } from "@/lib/types"
import type { FormSubmitData } from "@/components/simulation-form"

interface DemographicsViewProps {
  data: SimulationResult
  demographicsData?: FormSubmitData["demographics"]
  demographicsError?: string
}

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  borderColor: "var(--color-border)",
  borderRadius: "6px",
  fontSize: "11px",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
}

function normalizeAgeLabel(label: string): string {
  return label
    .replace(/\s+/g, "")
    .replace(/[〜～−―ー]/g, "-")
}

function shouldDisplayAgeLabel(label: string): boolean {
  const normalized = normalizeAgeLabel(label)
  return !/(再掲|不詳|総数|合計|計)/.test(normalized)
}

function isFitnessAgeGroup(label: string): boolean {
  if (!shouldDisplayAgeLabel(label)) return false

  const normalized = normalizeAgeLabel(label)
  const rangeMatch = normalized.match(/(\d+)-(\d+)歳/)
  if (rangeMatch) {
    const start = Number(rangeMatch[1])
    const end = Number(rangeMatch[2])
    return Number.isFinite(start) && Number.isFinite(end) && start >= 20 && end <= 59
  }

  const overMatch = normalized.match(/(\d+)歳以上/)
  if (overMatch) {
    const start = Number(overMatch[1])
    return Number.isFinite(start) && start >= 20 && start <= 59
  }

  return false
}

const fmtPopulation = (n: number) =>
  n >= 10000
    ? `${(n / 10000).toFixed(1)}万人`
    : `${n.toLocaleString()}人`

export function DemographicsView({ data, demographicsData, demographicsError }: DemographicsViewProps) {
  const city = extractCity(data.location ?? "")
  const fallbackDemographics = findCityDemographics(city)
  const demographics = demographicsData
    ? {
        city: demographicsData.municipality.city,
        prefecture: demographicsData.municipality.prefecture,
        totalPopulation: demographicsData.bySex.total,
        data: demographicsData.byAgeGender.map((row) => ({
          ageGroup: row.ageGroup,
          male: row.male,
          female: row.female,
        })),
      }
    : fallbackDemographics

  if (!data.location) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-16 text-center">
        <AlertCircleIcon className="size-8 text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium text-foreground">住所が登録されていません</p>
          <p className="mt-1 text-xs text-muted-foreground">
            試算フォームの「住所」欄を入力することで、エリア人口統計が表示されます。
          </p>
        </div>
      </div>
    )
  }

  if (demographicsError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-16 text-center">
        <AlertCircleIcon className="size-8 text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium text-foreground">人口統計データの取得に失敗しました</p>
          <p className="mt-1 text-xs text-muted-foreground">e-Stat API のエラーのため、人口グラフは表示できません。</p>
        </div>
      </div>
    )
  }

  if (!demographics) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-16 text-center">
        <MapPinIcon className="size-8 text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium text-foreground">
            「{city}」の統計データが見つかりません
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            入力住所: {data.location}
          </p>
        </div>
      </div>
    )
  }

  const displayData = demographics.data.filter((d) => shouldDisplayAgeLabel(d.ageGroup))

  // フィットネス適齢期の合計
  const fitnessPopulation = displayData
    .filter((d) => isFitnessAgeGroup(d.ageGroup))
    .reduce((s, d) => s + d.male + d.female, 0)

  const fitnessRate = demographics.totalPopulation > 0
    ? Math.round((fitnessPopulation / demographics.totalPopulation) * 1000) / 10
    : 0

  // 男女合計グラフ用データ
  const totalChartData = displayData.map((d) => ({
    ageGroup: d.ageGroup,
    male: d.male,
    female: d.female,
    total: d.male + d.female,
    isFitness: isFitnessAgeGroup(d.ageGroup),
  }))

  // 人口ピラミッド用データ（男性を負値に）
  const pyramidData = displayData.map((d) => ({
    ageGroup: d.ageGroup,
    male: -d.male,
    female: d.female,
    maleLabel: d.male,
    femaleLabel: d.female,
  }))

  return (
    <div className="flex flex-col gap-5">
      {/* エリアヘッダー */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-5 py-4">
        <div className="flex items-center gap-2">
          <MapPinIcon className="size-4 text-muted-foreground" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">対象エリア</p>
            <p className="text-base font-semibold text-foreground">
              {demographics.prefecture} {demographics.city}
            </p>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-2">
          <UsersIcon className="size-4 text-muted-foreground" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">総人口</p>
            <p className="text-base font-semibold text-foreground">
              {fmtPopulation(demographics.totalPopulation)}
            </p>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            フィットネス適齢期（20〜59歳）
          </p>
          <p className="text-base font-semibold text-foreground">
            {fmtPopulation(fitnessPopulation)}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              （総人口の {fitnessRate}%）
            </span>
          </p>
        </div>
        <div className="ml-auto rounded-md border border-border bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground">
          入力住所: {data.location}
        </div>
      </div>

      {/* グラフ2列 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 年齢帯別・男女別棒グラフ */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            年齢帯別・男女別人口
          </p>
          <p className="mb-4 text-[10px] text-muted-foreground">
            色が濃い帯がフィットネス適齢期（20〜59歳）です
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={totalChartData}
                margin={{ top: 4, right: 4, left: 4, bottom: 40 }}
                barSize={10}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="ageGroup"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    v.toLocaleString() + "人",
                    name === "male" ? "男性" : "女性",
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  formatter={(value) => value === "male" ? "男性" : "女性"}
                  wrapperStyle={{ fontSize: 10 }}
                />
                <Bar dataKey="male" name="male" stackId="a">
                  {totalChartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isFitness ? "var(--color-chart-1)" : "var(--color-chart-1)"}
                      fillOpacity={entry.isFitness ? 1 : 0.35}
                    />
                  ))}
                </Bar>
                <Bar dataKey="female" name="female" stackId="a">
                  {totalChartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isFitness ? "var(--color-chart-3)" : "var(--color-chart-3)"}
                      fillOpacity={entry.isFitness ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 人口ピラミッド */}
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            人口ピラミッド
          </p>
          <p className="mb-4 text-[10px] text-muted-foreground">
            左: 男性 / 右: 女性
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={pyramidData}
                margin={{ top: 4, right: 20, left: 44, bottom: 4 }}
                barSize={10}
                stackOffset="sign"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${Math.abs(v / 1000).toFixed(0)}k`}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="ageGroup"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    Math.abs(v).toLocaleString() + "人",
                    name === "male" ? "男性" : "女性",
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="male" name="male" fill="var(--color-chart-1)" fillOpacity={0.8} radius={[3, 0, 0, 3]} />
                <Bar dataKey="female" name="female" fill="var(--color-chart-3)" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* フィットネス適齢期の詳細 */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            フィットネス適齢期（20〜59歳）詳細
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">年齢帯</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">男性</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">女性</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">合計</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">男女比</th>
              </tr>
            </thead>
            <tbody>
              {displayData
                .filter((d) => isFitnessAgeGroup(d.ageGroup))
                .map((d) => {
                  const total = d.male + d.female
                  const maleRate = total > 0 ? Math.round((d.male / total) * 100) : 50
                  return (
                    <tr key={d.ageGroup} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{d.ageGroup}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground">{d.male.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground">{d.female.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium text-foreground">{total.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] text-chart-1">{maleRate}%</span>
                          <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-chart-3/30">
                            <div
                              className="h-full bg-chart-1"
                              style={{ width: `${maleRate}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-chart-3">{100 - maleRate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30">
                <td className="px-4 py-2.5 text-xs font-semibold text-foreground">合計</td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-foreground">
                  {displayData
                    .filter((d) => isFitnessAgeGroup(d.ageGroup))
                    .reduce((s, d) => s + d.male, 0)
                    .toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-foreground">
                  {displayData
                    .filter((d) => isFitnessAgeGroup(d.ageGroup))
                    .reduce((s, d) => s + d.female, 0)
                    .toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-primary">
                  {fmtPopulation(fitnessPopulation)}
                </td>
                <td className="px-4 py-2.5 text-right text-[10px] text-muted-foreground">
                  総人口の {fitnessRate}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-right">
        {demographicsData
          ? "※ 人口データは e-Stat API 取得値です。"
          : "※ 人口データはデモ用モックデータです。実際のデータは国勢調査・e-Stat等を参照してください。"}
      </p>
    </div>
  )
}
