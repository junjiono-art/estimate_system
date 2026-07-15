"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  CreditCardIcon,
  DumbbellIcon,
  GitBranchIcon,
  LayersIcon,
  MegaphoneIcon,
  SaveIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  VariableIcon,
  WrenchIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CalcMachineMaintenanceConfig, CalcParameterConfig, CalcPricingOption } from "@/lib/types"
import { DEFAULT_CALC_PARAMS } from "@/lib/default-calc-params"
import { resolveMaintenanceUnitPrice } from "@/lib/machine-maintenance"
import { PREFECTURE_FULL_NAMES, toPrefectureKey } from "@/lib/fitness-machine-cost"
import { computeDeviceCount, computeSecurityIntroCost } from "@/lib/security-cost"
import { computeAveragePrice } from "@/lib/average-price"
import { formatThousands, toDigits } from "@/lib/number-format"
import { toast } from "sonner"

type ScenarioKey = "conservative" | "standard" | "aggressive"
const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  conservative: "保守",
  standard: "標準",
  aggressive: "アグレッシブ",
}

type LogicVisualizationResponse = {
  generatedAt: string
  source: {
    hasLambdaGateway: boolean
    formulaSetSource: string
  }
  activeFormulaSet: {
    setVersion: string
    status: string
    comment: string
    createdBy: string
    createdAt: string
    basedOnVersion?: string
  } | null
  summary: {
    formulaCount: number
    variableCount: number
    dependencyCount: number
  }
  formulas: Array<{
    key: string
    label: string
    tokenCount: number
    expression: string
    inputVars: string[]
    dependsOn: string[]
    phase: "pre" | "monthly" | "post"
  }>
  variables: Array<{
    key: string
    label: string
    source: string
    unit?: string
    description?: string
  }>
  dependencies: Array<{
    key: string
    label: string
    dependsOn: string[]
    phase: "pre" | "monthly" | "post"
  }>
  warnings: string[]
}

type CalcParamsPayload = {
  params?: CalcParameterConfig
  error?: { message?: string }
}

const DEMO_CALC_PARAMS: CalcParameterConfig = DEFAULT_CALC_PARAMS

function MetaCard({
  title,
  value,
  note,
  icon: Icon,
  accent = "primary",
}: {
  title: string
  value: string | number
  note?: string
  icon?: React.ComponentType<{ className?: string }>
  accent?: "primary" | "chart-1" | "chart-2" | "chart-3" | "chart-4"
}) {
  const accentStyles: Record<string, string> = {
    primary: "border-l-primary/60 bg-gradient-to-br from-primary/5 to-transparent",
    "chart-1": "border-l-chart-1/60 bg-gradient-to-br from-chart-1/5 to-transparent",
    "chart-2": "border-l-chart-2/60 bg-gradient-to-br from-chart-2/5 to-transparent",
    "chart-3": "border-l-chart-3/60 bg-gradient-to-br from-chart-3/5 to-transparent",
    "chart-4": "border-l-chart-4/60 bg-gradient-to-br from-chart-4/5 to-transparent",
  }
  const iconStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    "chart-1": "bg-chart-1/10 text-chart-1",
    "chart-2": "bg-chart-2/10 text-chart-2",
    "chart-3": "bg-chart-3/10 text-chart-3",
    "chart-4": "bg-chart-4/10 text-chart-4",
  }
  return (
    <Card className={`border-l-4 transition-shadow hover:shadow-md ${accentStyles[accent]}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardDescription className="text-[11px] uppercase tracking-wider">{title}</CardDescription>
            <CardTitle className="mt-1 truncate text-lg font-bold">{value}</CardTitle>
          </div>
          {Icon && (
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${iconStyles[accent]}`}>
              <Icon className="size-4" />
            </div>
          )}
        </div>
      </CardHeader>
      {note ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  accent = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  accent?: "primary" | "chart-1" | "chart-2" | "chart-3" | "chart-4"
}) {
  const iconStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    "chart-1": "bg-chart-1/10 text-chart-1",
    "chart-2": "bg-chart-2/10 text-chart-2",
    "chart-3": "bg-chart-3/10 text-chart-3",
    "chart-4": "bg-chart-4/10 text-chart-4",
  }
  return (
    <div className="flex items-start gap-3">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconStyles[accent]}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function InfoTile({
  label,
  children,
  accent = "muted",
}: {
  label: string
  children: React.ReactNode
  accent?: "muted" | "chart-1" | "chart-2" | "chart-3" | "chart-4"
}) {
  const accentStyles: Record<string, string> = {
    muted: "border-border/60 bg-muted/30",
    "chart-1": "border-chart-1/30 bg-chart-1/5",
    "chart-2": "border-chart-2/30 bg-chart-2/5",
    "chart-3": "border-chart-3/30 bg-chart-3/5",
    "chart-4": "border-chart-4/30 bg-chart-4/5",
  }
  return (
    <div className={`rounded-lg border p-3 ${accentStyles[accent]}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-xs leading-relaxed text-foreground">{children}</div>
    </div>
  )
}

function SuffixedInput({
  id,
  value,
  onChange,
  disabled,
  suffix,
  inputMode = "decimal",
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  suffix: string
  inputMode?: "decimal" | "numeric"
  placeholder?: string
}) {
  // 金額（円）フィールドは3桁区切りで表示する。状態へはカンマ無しの数字文字列を渡す。
  const isAmount = suffix.includes("円")
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode={inputMode}
        value={isAmount ? formatThousands(value) : value}
        onChange={(event) => onChange(isAmount ? toDigits(event.target.value) : event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="pr-10"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  )
}

function parseRequiredNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

// 比率（0.034567 など）を % 文字列に変換する際の浮動小数誤差を除去する
// 例: 0.001 * 100 → 0.10000000000000002 を "0.1" に丸める
function formatRatePercent(rate: number): string {
  if (!Number.isFinite(rate)) return ""
  // 小数点以下 6 桁で丸めてから Number 経由で末尾の余計な 0 と小数点を除去
  return Number((rate * 100).toFixed(6)).toString()
}

function toCalcUnitLabel(unit: LogicVisualizationResponse["formulas"][number]["phase"]): string {
  if (unit === "pre") return "初期計算"
  if (unit === "monthly") return "月次計算"
  return "集計"
}

function buildFormulaLines(
  formulas: LogicVisualizationResponse["formulas"],
  pairs: Array<{ key: string; label: string; fallback: string }>,
): string[] {
  const formulaMap = new Map(formulas.map((formula) => [formula.key, formula]))
  return pairs.map(({ key, label, fallback }) => {
    const formula = formulaMap.get(key)
    if (!formula?.expression) return `${label}: ${fallback}`
    const formulaLabel = formula.label || label
    return `${formulaLabel}: ${formula.expression}`
  })
}

export function LogicVisualizationView() {
  const [data, setData] = useState<LogicVisualizationResponse | null>(null)
  const [calcParams, setCalcParams] = useState<CalcParameterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calcWarning, setCalcWarning] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isSavingStep1, setIsSavingStep1] = useState(false)
  const [isSavingStep2, setIsSavingStep2] = useState(false)
  const [isSavingStep3, setIsSavingStep3] = useState(false)
  const [paymentFeeRatePercent, setPaymentFeeRatePercent] = useState("")
  const [royaltyCapMonthly, setRoyaltyCapMonthly] = useState("")
  const [appFeeMonthly, setAppFeeMonthly] = useState("")
  const [competitorUpTo2Percent, setCompetitorUpTo2Percent] = useState("")
  const [competitorFor3Percent, setCompetitorFor3Percent] = useState("")
  const [competitorFor4Percent, setCompetitorFor4Percent] = useState("")
  const [competitorOver4Percent, setCompetitorOver4Percent] = useState("")
  const [adCostYear1Month1, setAdCostYear1Month1] = useState("")
  const [adCostYear1Month2, setAdCostYear1Month2] = useState("")
  const [adCostYear1Month3To4, setAdCostYear1Month3To4] = useState("")
  const [adCostYear1Month5To12, setAdCostYear1Month5To12] = useState("")
  const [adCostYear2Monthly, setAdCostYear2Monthly] = useState("")
  const [adCostYear3PlusMonthly, setAdCostYear3PlusMonthly] = useState("")
  // 拡張パラメータ（Excelモデル移植）
  const [isSavingStep4, setIsSavingStep4] = useState(false)
  const [isSavingStep5, setIsSavingStep5] = useState(false)
  const [isSavingStep6, setIsSavingStep6] = useState(false)
  const [isSavingStep7, setIsSavingStep7] = useState(false)
  const [isSavingStep8, setIsSavingStep8] = useState(false)
  const [isSavingStepMM, setIsSavingStepMM] = useState(false)
  const [isSavingStepFM, setIsSavingStepFM] = useState(false)
  const [isSavingStepSec, setIsSavingStepSec] = useState(false)
  // 平均単価（会費＋オプション）
  const [memberFeeExTax, setMemberFeeExTax] = useState("")
  const [pricingOptions, setPricingOptions] = useState<Array<{ label: string; price: string; ratio: string }>>([])
  // 継続率・会員獲得
  const [retentionFirstMonth, setRetentionFirstMonth] = useState("")
  const [retentionSubsequent, setRetentionSubsequent] = useState("")
  const [organicSearchRate, setOrganicSearchRate] = useState("")
  const [referralRate, setReferralRate] = useState("")
  const [splitSignage, setSplitSignage] = useState("")
  const [splitWeb, setSplitWeb] = useState("")
  const [splitSns, setSplitSns] = useState("")
  const [semCpaY1Y2, setSemCpaY1Y2] = useState("")
  const [semCpaY3Plus, setSemCpaY3Plus] = useState("")
  const [snsAdUnitCost, setSnsAdUnitCost] = useState("")
  const [webBudgetMonthly, setWebBudgetMonthly] = useState("")
  const [snsBudgetMonthly, setSnsBudgetMonthly] = useState("")
  const [snsInitialBonus, setSnsInitialBonus] = useState("")
  // キャパシティ
  const [capVisitsPerWeek, setCapVisitsPerWeek] = useState("")
  const [capAvgStayHours, setCapAvgStayHours] = useState("")
  const [capAreaPerMember, setCapAreaPerMember] = useState("")
  const [capBusinessHours, setCapBusinessHours] = useState("")
  const [capAvgUtilization, setCapAvgUtilization] = useState("")
  const [capRuralFactor, setCapRuralFactor] = useState("")
  const [capParkingUtilization, setCapParkingUtilization] = useState("")
  // シナリオ係数（店頭看板・広告効果）
  const [signageByScenario, setSignageByScenario] = useState<Record<ScenarioKey, {
    baseFactor: string; month2Factor: string; month3Factor: string; month4Factor: string
    monthlyDecay: string; adEffectivenessYear2to5: string; adEffectivenessYear6Plus: string
  }>>({
    conservative: { baseFactor: "", month2Factor: "", month3Factor: "", month4Factor: "", monthlyDecay: "", adEffectivenessYear2to5: "", adEffectivenessYear6Plus: "" },
    standard: { baseFactor: "", month2Factor: "", month3Factor: "", month4Factor: "", monthlyDecay: "", adEffectivenessYear2to5: "", adEffectivenessYear6Plus: "" },
    aggressive: { baseFactor: "", month2Factor: "", month3Factor: "", month4Factor: "", monthlyDecay: "", adEffectivenessYear2to5: "", adEffectivenessYear6Plus: "" },
  })
  // 減価償却（耐用年数）・税・入金サイクル
  const [deprInterior, setDeprInterior] = useState("")
  const [deprMachine, setDeprMachine] = useState("")
  const [deprFlapper, setDeprFlapper] = useState("")
  const [deprBodyComp, setDeprBodyComp] = useState("")
  const [corporateTaxRate, setCorporateTaxRate] = useState("")
  const [cashCollectionLagMonths, setCashCollectionLagMonths] = useState("")
  // マシンメンテナンス費（入力欄 B34）
  const [mmApplyOnlyWhenFranchise, setMmApplyOnlyWhenFranchise] = useState(true)
  const [mmIntervalMonths, setMmIntervalMonths] = useState("")
  const [mmFallbackUnitPrice, setMmFallbackUnitPrice] = useState("")
  const [mmTsuboTiers, setMmTsuboTiers] = useState<Array<{ minTsubo: string; workers: string; days: string }>>([])
  // 距離連動の単価モデル（入力欄 Q=P/2, P=$L$47+O, O=N×20000, N=ROUNDDOWN(L,-2)/100）
  const [mmBaseUnitPrice, setMmBaseUnitPrice] = useState("")
  const [mmDistanceStepKm, setMmDistanceStepKm] = useState("")
  const [mmDistanceStepCost, setMmDistanceStepCost] = useState("")
  const [mmUnitPriceDivisor, setMmUnitPriceDivisor] = useState("")
  // 都道府県別 距離(L列) / 固定値上書き(Q列が手入力の県)
  const [mmPrefRows, setMmPrefRows] = useState<Array<{ key: string; distance: string; override: string }>>([])
  // 算出単価プレビュー用の設定（編集中の値を実エンジン resolveMaintenanceUnitPrice に渡して表示）
  const mmPreviewConfig = useMemo<CalcMachineMaintenanceConfig>(() => {
    const distanceByPrefecture: Record<string, number> = {}
    const unitPriceByPrefecture: Record<string, number> = {}
    for (const row of mmPrefRows) {
      if (row.distance.trim() !== "" && Number.isFinite(Number(row.distance))) {
        distanceByPrefecture[row.key] = Number(row.distance)
      }
      if (row.override.trim() !== "" && Number.isFinite(Number(row.override))) {
        unitPriceByPrefecture[row.key] = Number(row.override)
      }
    }
    return {
      ...DEFAULT_CALC_PARAMS.machineMaintenance,
      baseUnitPrice: Number(mmBaseUnitPrice) || 0,
      distanceStepKm: Number(mmDistanceStepKm) || 100,
      distanceStepCost: Number(mmDistanceStepCost) || 0,
      unitPriceDivisor: Number(mmUnitPriceDivisor) || 1,
      fallbackUnitPrice: Number(mmFallbackUnitPrice) || 0,
      distanceByPrefecture,
      unitPriceByPrefecture,
    }
  }, [mmPrefRows, mmBaseUnitPrice, mmDistanceStepKm, mmDistanceStepCost, mmUnitPriceDivisor, mmFallbackUnitPrice])

  // フィットネスマシン費（入力欄 J8 = 坪単価 × 有効坪数。単価は都道府県別、直営は割り戻し）
  const [fmDirectDivisor, setFmDirectDivisor] = useState("")
  const [fmFallbackUnitPrice, setFmFallbackUnitPrice] = useState("")
  // 都道府県別 坪単価（FC満額）。直営単価はプレビュー列で 満額 ÷ 割り戻し係数 を表示
  const [fmPrefRows, setFmPrefRows] = useState<Array<{ key: string; unitPrice: string }>>([])

  // ALSOK・USEN導入費（入力欄 B16/J16 = 固定額＋台数×単価の合算を万円切り上げ）
  const [secFixedItems, setSecFixedItems] = useState<Array<{ label: string; amount: string }>>([])
  const [secCameraUnitPrice, setSecCameraUnitPrice] = useState("")
  const [secCameraBaseCount, setSecCameraBaseCount] = useState("")
  const [secCameraBaseTsubo, setSecCameraBaseTsubo] = useState("")
  const [secCameraTsuboPer, setSecCameraTsuboPer] = useState("")
  const [secMonitorUnitPrice, setSecMonitorUnitPrice] = useState("")
  const [secMonitorBaseCount, setSecMonitorBaseCount] = useState("")
  const [secMonitorBaseTsubo, setSecMonitorBaseTsubo] = useState("")
  const [secMonitorTsuboPer, setSecMonitorTsuboPer] = useState("")
  const [secRoundUpUnit, setSecRoundUpUnit] = useState("")
  // 算出プレビュー用の坪数（保存対象外。編集中の値を実エンジンに渡して台数・合計を表示）
  const [secPreviewTsubo, setSecPreviewTsubo] = useState("50")
  const secPreviewConfig = useMemo<CalcParameterConfig["security"]>(() => ({
    fixedItems: secFixedItems.map((item) => ({ label: item.label, amount: Number(item.amount) || 0 })),
    cameraUnitPrice: Number(secCameraUnitPrice) || 0,
    cameraCountRule: {
      baseCount: Number(secCameraBaseCount) || 0,
      baseTsubo: Number(secCameraBaseTsubo) || 0,
      tsuboPerUnit: Number(secCameraTsuboPer) || 0,
    },
    monitorUnitPrice: Number(secMonitorUnitPrice) || 0,
    monitorCountRule: {
      baseCount: Number(secMonitorBaseCount) || 0,
      baseTsubo: Number(secMonitorBaseTsubo) || 0,
      tsuboPerUnit: Number(secMonitorTsuboPer) || 0,
    },
    roundUpUnit: Number(secRoundUpUnit) || 1,
  }), [
    secFixedItems, secCameraUnitPrice, secCameraBaseCount, secCameraBaseTsubo, secCameraTsuboPer,
    secMonitorUnitPrice, secMonitorBaseCount, secMonitorBaseTsubo, secMonitorTsuboPer, secRoundUpUnit,
  ])

  function syncFeeParams(params: CalcParameterConfig) {
    setPaymentFeeRatePercent(formatRatePercent(params.paymentFeeRate))
    setRoyaltyCapMonthly(String(params.royaltyCapMonthly))
    setAppFeeMonthly(String(params.appFeeMonthly))
  }

  function syncCompetitorParams(params: CalcParameterConfig) {
    setCompetitorUpTo2Percent(formatRatePercent(params.competitorImpact.upTo2))
    setCompetitorFor3Percent(formatRatePercent(params.competitorImpact.for3))
    setCompetitorFor4Percent(formatRatePercent(params.competitorImpact.for4))
    setCompetitorOver4Percent(formatRatePercent(params.competitorImpact.over4))
  }

  function syncAdCostParams(params: CalcParameterConfig) {
    setAdCostYear1Month1(String(params.adCost.year1Month1))
    setAdCostYear1Month2(String(params.adCost.year1Month2))
    setAdCostYear1Month3To4(String(params.adCost.year1Month3To4))
    setAdCostYear1Month5To12(String(params.adCost.year1Month5To12))
    setAdCostYear2Monthly(String(params.adCost.year2Monthly))
    setAdCostYear3PlusMonthly(String(params.adCost.year3PlusMonthly))
  }

  function syncPricingParams(params: CalcParameterConfig) {
    setMemberFeeExTax(String(params.pricing.memberFeeExTax))
    setPricingOptions(params.pricing.options.map((opt) => ({
      label: opt.label,
      price: String(opt.price),
      ratio: String(opt.ratio),
    })))
  }

  function syncGrowthParams(params: CalcParameterConfig) {
    setRetentionFirstMonth(String(params.retention.firstMonth))
    setRetentionSubsequent(String(params.retention.subsequent))
    setOrganicSearchRate(String(params.acquisition.organicSearchRate))
    setReferralRate(String(params.acquisition.referralRate))
    setSplitSignage(String(params.acquisition.channelSplit.signage))
    setSplitWeb(String(params.acquisition.channelSplit.web))
    setSplitSns(String(params.acquisition.channelSplit.sns))
    setSemCpaY1Y2(String(params.acquisition.semCpaY1Y2))
    setSemCpaY3Plus(String(params.acquisition.semCpaY3Plus))
    setSnsAdUnitCost(String(params.acquisition.snsAdUnitCost))
    setWebBudgetMonthly(String(params.acquisition.webBudgetMonthly))
    setSnsBudgetMonthly(String(params.acquisition.snsBudgetMonthly))
    setSnsInitialBonus(String(params.acquisition.snsInitialBonus))
  }

  function syncCapacityParams(params: CalcParameterConfig) {
    setCapVisitsPerWeek(String(params.capacity.visitsPerWeek))
    setCapAvgStayHours(String(params.capacity.avgStayHours))
    setCapAreaPerMember(String(params.capacity.areaPerMemberTsubo))
    setCapBusinessHours(String(params.capacity.businessHours))
    setCapAvgUtilization(String(params.capacity.avgUtilization))
    setCapRuralFactor(String(params.capacity.ruralFactor))
    setCapParkingUtilization(String(params.capacity.parkingUtilization))
  }

  function syncScenarioParams(params: CalcParameterConfig) {
    const toRow = (s: ScenarioKey) => ({
      baseFactor: String(params.signage[s].baseFactor),
      month2Factor: String(params.signage[s].month2Factor),
      month3Factor: String(params.signage[s].month3Factor),
      month4Factor: String(params.signage[s].month4Factor),
      monthlyDecay: String(params.signage[s].monthlyDecay),
      adEffectivenessYear2to5: String(params.signage[s].adEffectivenessYear2to5),
      adEffectivenessYear6Plus: String(params.signage[s].adEffectivenessYear6Plus),
    })
    setSignageByScenario({
      conservative: toRow("conservative"),
      standard: toRow("standard"),
      aggressive: toRow("aggressive"),
    })
  }

  function syncOtherParams(params: CalcParameterConfig) {
    setDeprInterior(String(params.depreciation.usefulLifeYears.interiorCost ?? ""))
    setDeprMachine(String(params.depreciation.usefulLifeYears.fitnessMachineCost ?? ""))
    setDeprFlapper(String(params.depreciation.usefulLifeYears.flapperGateCost ?? ""))
    setDeprBodyComp(String(params.depreciation.usefulLifeYears.bodyCompositionCost ?? ""))
    setCorporateTaxRate(String(params.corporateTaxRate))
    setCashCollectionLagMonths(String(params.cashCollectionLagMonths))
  }

  function syncMachineMaintenanceParams(params: CalcParameterConfig) {
    // 旧レコードに machineMaintenance が無い場合は既定値で補完
    const mm = params.machineMaintenance ?? DEFAULT_CALC_PARAMS.machineMaintenance
    setMmApplyOnlyWhenFranchise(mm.applyOnlyWhenFranchise)
    setMmIntervalMonths(String(mm.intervalMonths))
    setMmFallbackUnitPrice(String(mm.fallbackUnitPrice))
    setMmTsuboTiers(
      [...mm.tsuboTiers]
        .sort((a, b) => a.minTsubo - b.minTsubo)
        .map((t) => ({ minTsubo: String(t.minTsubo), workers: String(t.workers), days: String(t.days) })),
    )
    setMmBaseUnitPrice(String(mm.baseUnitPrice ?? ""))
    setMmDistanceStepKm(String(mm.distanceStepKm ?? ""))
    setMmDistanceStepCost(String(mm.distanceStepCost ?? ""))
    setMmUnitPriceDivisor(String(mm.unitPriceDivisor ?? ""))
    const distMap = mm.distanceByPrefecture ?? {}
    const overrideMap = mm.unitPriceByPrefecture ?? {}
    // 距離テーブルを基準に全県を列挙（固定値しか無い県があれば併合）
    const prefKeys = Array.from(new Set([...Object.keys(distMap), ...Object.keys(overrideMap)]))
    setMmPrefRows(
      prefKeys.map((key) => ({
        key,
        distance: distMap[key] != null ? String(distMap[key]) : "",
        override: overrideMap[key] != null ? String(overrideMap[key]) : "",
      })),
    )
  }

  function syncFitnessMachineParams(params: CalcParameterConfig) {
    // 旧レコードに fitnessMachine が無い場合は既定値（アプリ内蔵の都道府県別料金表）で補完
    const fm = params.fitnessMachine ?? DEFAULT_CALC_PARAMS.fitnessMachine
    setFmDirectDivisor(String(fm.directDivisor ?? ""))
    setFmFallbackUnitPrice(String(fm.fallbackUnitPrice ?? ""))
    const priceMap = fm.unitPriceByPrefecture ?? {}
    // 47都道府県の並び（北→南）で列挙し、料金表に独自キーがあれば末尾へ併合
    const orderedKeys = PREFECTURE_FULL_NAMES.map(toPrefectureKey)
    const extraKeys = Object.keys(priceMap).filter((key) => !orderedKeys.includes(key))
    setFmPrefRows(
      [...orderedKeys, ...extraKeys].map((key) => ({
        key,
        unitPrice: priceMap[key] != null ? String(priceMap[key]) : "",
      })),
    )
  }

  function syncSecurityParams(params: CalcParameterConfig) {
    // 旧レコードに security が無い場合は既定値（Excel 入力欄 B16/J16 の内訳）で補完
    const sec = params.security ?? DEFAULT_CALC_PARAMS.security
    setSecFixedItems((sec.fixedItems ?? []).map((item) => ({ label: item.label, amount: String(item.amount) })))
    setSecCameraUnitPrice(String(sec.cameraUnitPrice ?? ""))
    setSecCameraBaseCount(String(sec.cameraCountRule?.baseCount ?? ""))
    setSecCameraBaseTsubo(String(sec.cameraCountRule?.baseTsubo ?? ""))
    setSecCameraTsuboPer(String(sec.cameraCountRule?.tsuboPerUnit ?? ""))
    setSecMonitorUnitPrice(String(sec.monitorUnitPrice ?? ""))
    setSecMonitorBaseCount(String(sec.monitorCountRule?.baseCount ?? ""))
    setSecMonitorBaseTsubo(String(sec.monitorCountRule?.baseTsubo ?? ""))
    setSecMonitorTsuboPer(String(sec.monitorCountRule?.tsuboPerUnit ?? ""))
    setSecRoundUpUnit(String(sec.roundUpUnit ?? ""))
  }

  function syncAllParams(params: CalcParameterConfig) {
    syncFeeParams(params)
    syncCompetitorParams(params)
    syncAdCostParams(params)
    syncPricingParams(params)
    syncGrowthParams(params)
    syncCapacityParams(params)
    syncScenarioParams(params)
    syncOtherParams(params)
    syncMachineMaintenanceParams(params)
    syncFitnessMachineParams(params)
    syncSecurityParams(params)
  }

  async function fetchLatestCalcParams(): Promise<CalcParameterConfig | null> {
    const latestResponse = await fetch("/api/master/calc-params", { cache: "no-store" })
    const latestPayload = (await latestResponse.json().catch(() => null)) as CalcParamsPayload | null
    if (!latestResponse.ok || !latestPayload?.params) {
      const message = latestPayload?.error?.message || "最新の計算パラメータ取得に失敗しました。"
      toast.error(message)
      return null
    }
    return latestPayload.params
  }

  async function saveStep1Params() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }

    const paymentFeeRateRaw = parseRequiredNumber(paymentFeeRatePercent)
    const royaltyCapRaw = parseRequiredNumber(royaltyCapMonthly)
    const appFeeRaw = parseRequiredNumber(appFeeMonthly)

    if (paymentFeeRateRaw === null || paymentFeeRateRaw < 0 || paymentFeeRateRaw > 100) {
      toast.error("決済手数料率は 0〜100 の範囲で入力してください。")
      return
    }

    if (royaltyCapRaw === null || royaltyCapRaw < 0) {
      toast.error("ロイヤリティ月額上限は 0 以上で入力してください。")
      return
    }

    if (appFeeRaw === null || appFeeRaw < 0) {
      toast.error("アプリ利用料は 0 以上で入力してください。")
      return
    }

    setIsSavingStep1(true)
    try {
      const latestParams = await fetchLatestCalcParams()
      if (!latestParams) return

      const nextPayload: CalcParameterConfig = {
        ...latestParams,
        paymentFeeRate: paymentFeeRateRaw / 100,
        royaltyCapMonthly: Math.round(royaltyCapRaw),
        appFeeMonthly: Math.round(appFeeRaw),
      }

      const response = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      })
      const payload = (await response.json().catch(() => null)) as { params?: CalcParameterConfig; error?: { message?: string } } | null

      if (!response.ok || !payload?.params) {
        const message = payload?.error?.message || "計算パラメータの保存に失敗しました。"
        toast.error(message)
        return
      }

      setCalcParams(payload.params)
      syncFeeParams(payload.params)
      toast.success("手数料・上限パラメータを保存しました。")
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSavingStep1(false)
    }
  }

  async function saveStep2Params() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }

    const upTo2Raw = parseRequiredNumber(competitorUpTo2Percent)
    const for3Raw = parseRequiredNumber(competitorFor3Percent)
    const for4Raw = parseRequiredNumber(competitorFor4Percent)
    const over4Raw = parseRequiredNumber(competitorOver4Percent)

    const rates = [upTo2Raw, for3Raw, for4Raw, over4Raw]
    if (rates.some((value) => value === null || value < 0 || value > 100)) {
      toast.error("競合影響率はすべて 0〜100 の範囲で入力してください。")
      return
    }

    setIsSavingStep2(true)
    try {
      const latestParams = await fetchLatestCalcParams()
      if (!latestParams) return

      const nextPayload: CalcParameterConfig = {
        ...latestParams,
        competitorImpact: {
          ...latestParams.competitorImpact,
          upTo2: (upTo2Raw as number) / 100,
          for3: (for3Raw as number) / 100,
          for4: (for4Raw as number) / 100,
          over4: (over4Raw as number) / 100,
        },
      }

      const response = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      })
      const payload = (await response.json().catch(() => null)) as { params?: CalcParameterConfig; error?: { message?: string } } | null

      if (!response.ok || !payload?.params) {
        const message = payload?.error?.message || "計算パラメータの保存に失敗しました。"
        toast.error(message)
        return
      }

      setCalcParams(payload.params)
      syncCompetitorParams(payload.params)
      toast.success("競合影響率パラメータを保存しました。")
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSavingStep2(false)
    }
  }

  async function saveStep3Params() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }

    const year1Month1Raw = parseRequiredNumber(adCostYear1Month1)
    const year1Month2Raw = parseRequiredNumber(adCostYear1Month2)
    const year1Month3To4Raw = parseRequiredNumber(adCostYear1Month3To4)
    const year1Month5To12Raw = parseRequiredNumber(adCostYear1Month5To12)
    const year2MonthlyRaw = parseRequiredNumber(adCostYear2Monthly)
    const year3PlusMonthlyRaw = parseRequiredNumber(adCostYear3PlusMonthly)

    const values = [
      year1Month1Raw,
      year1Month2Raw,
      year1Month3To4Raw,
      year1Month5To12Raw,
      year2MonthlyRaw,
      year3PlusMonthlyRaw,
    ]

    if (values.some((value) => value === null || value < 0)) {
      toast.error("広告費はすべて 0 以上で入力してください。")
      return
    }

    setIsSavingStep3(true)
    try {
      const latestParams = await fetchLatestCalcParams()
      if (!latestParams) return

      const nextPayload: CalcParameterConfig = {
        ...latestParams,
        adCost: {
          ...latestParams.adCost,
          year1Month1: Math.round(year1Month1Raw as number),
          year1Month2: Math.round(year1Month2Raw as number),
          year1Month3To4: Math.round(year1Month3To4Raw as number),
          year1Month5To12: Math.round(year1Month5To12Raw as number),
          year2Monthly: Math.round(year2MonthlyRaw as number),
          year3PlusMonthly: Math.round(year3PlusMonthlyRaw as number),
        },
      }

      const response = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      })
      const payload = (await response.json().catch(() => null)) as { params?: CalcParameterConfig; error?: { message?: string } } | null

      if (!response.ok || !payload?.params) {
        const message = payload?.error?.message || "計算パラメータの保存に失敗しました。"
        toast.error(message)
        return
      }

      setCalcParams(payload.params)
      syncAdCostParams(payload.params)
      toast.success("広告費パラメータを保存しました。")
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSavingStep3(false)
    }
  }

  // 拡張パラメータ用の汎用保存（最新値に partial をマージして PUT）
  async function persistParams(
    partial: Partial<CalcParameterConfig>,
    setSaving: (value: boolean) => void,
    successMessage: string,
    syncFn: (params: CalcParameterConfig) => void,
  ) {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }
    setSaving(true)
    try {
      const latestParams = await fetchLatestCalcParams()
      if (!latestParams) return

      const nextPayload: CalcParameterConfig = { ...latestParams, ...partial }
      const response = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPayload),
      })
      const payload = (await response.json().catch(() => null)) as { params?: CalcParameterConfig; error?: { message?: string } } | null

      if (!response.ok || !payload?.params) {
        toast.error(payload?.error?.message || "計算パラメータの保存に失敗しました。")
        return
      }

      setCalcParams(payload.params)
      syncFn(payload.params)
      toast.success(successMessage)
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setSaving(false)
    }
  }

  async function saveStep4Params() {
    const fee = parseRequiredNumber(memberFeeExTax)
    if (fee === null || fee < 0) {
      toast.error("会費は 0 以上で入力してください。")
      return
    }
    const options: CalcPricingOption[] = []
    for (const opt of pricingOptions) {
      const price = parseRequiredNumber(opt.price)
      const ratio = parseRequiredNumber(opt.ratio)
      if (price === null || price < 0) {
        toast.error(`オプション「${opt.label}」の単価は 0 以上で入力してください。`)
        return
      }
      if (ratio === null || ratio < 0 || ratio > 1) {
        toast.error(`オプション「${opt.label}」の構成比は 0〜1 で入力してください。`)
        return
      }
      options.push({ label: opt.label, price: Math.round(price), ratio })
    }
    await persistParams(
      { pricing: { memberFeeExTax: Math.round(fee), options } },
      setIsSavingStep4,
      "平均単価パラメータを保存しました。",
      syncPricingParams,
    )
  }

  async function saveStep5Params() {
    const rates: Array<[string, number | null]> = [
      ["初月継続率", parseRequiredNumber(retentionFirstMonth)],
      ["2か月目以降継続率", parseRequiredNumber(retentionSubsequent)],
      ["自然検索率", parseRequiredNumber(organicSearchRate)],
      ["口コミ紹介率", parseRequiredNumber(referralRate)],
      ["看板配分", parseRequiredNumber(splitSignage)],
      ["Web配分", parseRequiredNumber(splitWeb)],
      ["SNS配分", parseRequiredNumber(splitSns)],
    ]
    for (const [label, value] of rates) {
      if (value === null || value < 0 || value > 1) {
        toast.error(`${label}は 0〜1 で入力してください。`)
        return
      }
    }
    const moneys: Array<[string, number | null]> = [
      ["SEM CPA(1〜2年目)", parseRequiredNumber(semCpaY1Y2)],
      ["SEM CPA(3年目以降)", parseRequiredNumber(semCpaY3Plus)],
      ["SNS広告単価", parseRequiredNumber(snsAdUnitCost)],
      ["Web広告月予算", parseRequiredNumber(webBudgetMonthly)],
      ["SNS広告月予算", parseRequiredNumber(snsBudgetMonthly)],
      ["SNS初月上乗せ", parseRequiredNumber(snsInitialBonus)],
    ]
    for (const [label, value] of moneys) {
      if (value === null || value < 0) {
        toast.error(`${label}は 0 以上で入力してください。`)
        return
      }
    }
    await persistParams(
      {
        retention: {
          firstMonth: parseRequiredNumber(retentionFirstMonth) as number,
          subsequent: parseRequiredNumber(retentionSubsequent) as number,
        },
        acquisition: {
          organicSearchRate: parseRequiredNumber(organicSearchRate) as number,
          referralRate: parseRequiredNumber(referralRate) as number,
          channelSplit: {
            signage: parseRequiredNumber(splitSignage) as number,
            web: parseRequiredNumber(splitWeb) as number,
            sns: parseRequiredNumber(splitSns) as number,
          },
          semCpaY1Y2: Math.round(parseRequiredNumber(semCpaY1Y2) as number),
          semCpaY3Plus: Math.round(parseRequiredNumber(semCpaY3Plus) as number),
          snsAdUnitCost: Math.round(parseRequiredNumber(snsAdUnitCost) as number),
          webBudgetMonthly: Math.round(parseRequiredNumber(webBudgetMonthly) as number),
          snsBudgetMonthly: Math.round(parseRequiredNumber(snsBudgetMonthly) as number),
          snsInitialBonus: parseRequiredNumber(snsInitialBonus) as number,
        },
      },
      setIsSavingStep5,
      "会員獲得モデルのパラメータを保存しました。",
      syncGrowthParams,
    )
  }

  async function saveStep6Params() {
    const positives: Array<[string, number | null]> = [
      ["1人あたり利用回数", parseRequiredNumber(capVisitsPerWeek)],
      ["平均滞在時間", parseRequiredNumber(capAvgStayHours)],
      ["1人当たり必要面積", parseRequiredNumber(capAreaPerMember)],
      ["営業時間", parseRequiredNumber(capBusinessHours)],
    ]
    for (const [label, value] of positives) {
      if (value === null || value <= 0) {
        toast.error(`${label}は 0 より大きい値を入力してください。`)
        return
      }
    }
    const rates: Array<[string, number | null]> = [
      ["平均稼働率", parseRequiredNumber(capAvgUtilization)],
      ["田舎型係数", parseRequiredNumber(capRuralFactor)],
      ["駐車場利用率", parseRequiredNumber(capParkingUtilization)],
    ]
    for (const [label, value] of rates) {
      if (value === null || value < 0 || value > 1) {
        toast.error(`${label}は 0〜1 で入力してください。`)
        return
      }
    }
    await persistParams(
      {
        capacity: {
          visitsPerWeek: parseRequiredNumber(capVisitsPerWeek) as number,
          avgStayHours: parseRequiredNumber(capAvgStayHours) as number,
          areaPerMemberTsubo: parseRequiredNumber(capAreaPerMember) as number,
          businessHours: parseRequiredNumber(capBusinessHours) as number,
          avgUtilization: parseRequiredNumber(capAvgUtilization) as number,
          ruralFactor: parseRequiredNumber(capRuralFactor) as number,
          parkingUtilization: parseRequiredNumber(capParkingUtilization) as number,
        },
      },
      setIsSavingStep6,
      "キャパシティパラメータを保存しました。",
      syncCapacityParams,
    )
  }

  async function saveStep7Params() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }
    const scenarios: ScenarioKey[] = ["conservative", "standard", "aggressive"]
    const built = {} as CalcParameterConfig["signage"]
    for (const s of scenarios) {
      const row = signageByScenario[s]
      const fields: Array<[string, number | null, boolean]> = [
        ["基準係数", parseRequiredNumber(row.baseFactor), false],
        ["2か月目係数", parseRequiredNumber(row.month2Factor), false],
        ["3か月目係数", parseRequiredNumber(row.month3Factor), false],
        ["4か月目係数", parseRequiredNumber(row.month4Factor), false],
        ["月次逓減率", parseRequiredNumber(row.monthlyDecay), true],
        ["広告効果(年2-5)", parseRequiredNumber(row.adEffectivenessYear2to5), true],
        ["広告効果(年6-10)", parseRequiredNumber(row.adEffectivenessYear6Plus), true],
      ]
      for (const [label, value, isRateField] of fields) {
        if (value === null || value < 0 || (isRateField && value > 1)) {
          toast.error(`${SCENARIO_LABELS[s]}の${label}が不正です（0以上${isRateField ? "・1以下" : ""}）。`)
          return
        }
      }
      built[s] = {
        baseFactor: parseRequiredNumber(row.baseFactor) as number,
        // roundDownBase は編集対象外のため現行値を維持
        roundDownBase: calcParams.signage[s].roundDownBase,
        month2Factor: parseRequiredNumber(row.month2Factor) as number,
        month3Factor: parseRequiredNumber(row.month3Factor) as number,
        month4Factor: parseRequiredNumber(row.month4Factor) as number,
        monthlyDecay: parseRequiredNumber(row.monthlyDecay) as number,
        adEffectivenessYear2to5: parseRequiredNumber(row.adEffectivenessYear2to5) as number,
        adEffectivenessYear6Plus: parseRequiredNumber(row.adEffectivenessYear6Plus) as number,
      }
    }
    await persistParams({ signage: built }, setIsSavingStep7, "シナリオ係数を保存しました。", syncScenarioParams)
  }

  async function saveStep8Params() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }
    const lives: Array<[string, number | null]> = [
      ["内装の耐用年数", parseRequiredNumber(deprInterior)],
      ["フィットネスマシンの耐用年数", parseRequiredNumber(deprMachine)],
      ["フラッパーゲートの耐用年数", parseRequiredNumber(deprFlapper)],
      ["体組成計の耐用年数", parseRequiredNumber(deprBodyComp)],
    ]
    for (const [label, value] of lives) {
      if (value === null || value <= 0) {
        toast.error(`${label}は 0 より大きい値を入力してください。`)
        return
      }
    }
    const tax = parseRequiredNumber(corporateTaxRate)
    if (tax === null || tax < 0 || tax > 1) {
      toast.error("法人税率は 0〜1 で入力してください。")
      return
    }
    const lag = parseRequiredNumber(cashCollectionLagMonths)
    if (lag === null || lag < 0) {
      toast.error("入金サイクルは 0 以上で入力してください。")
      return
    }
    await persistParams(
      {
        depreciation: {
          usefulLifeYears: {
            ...calcParams.depreciation.usefulLifeYears,
            interiorCost: parseRequiredNumber(deprInterior) as number,
            fitnessMachineCost: parseRequiredNumber(deprMachine) as number,
            flapperGateCost: parseRequiredNumber(deprFlapper) as number,
            bodyCompositionCost: parseRequiredNumber(deprBodyComp) as number,
          },
        },
        corporateTaxRate: tax,
        cashCollectionLagMonths: Math.round(lag),
      },
      setIsSavingStep8,
      "減価償却・税・入金サイクルを保存しました。",
      syncOtherParams,
    )
  }

  async function saveMachineMaintenanceParams() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }
    const interval = parseRequiredNumber(mmIntervalMonths)
    if (interval === null || interval < 1) {
      toast.error("実施間隔は 1 以上（ヶ月）で入力してください。")
      return
    }
    const fallback = parseRequiredNumber(mmFallbackUnitPrice)
    if (fallback === null || fallback < 0) {
      toast.error("都道府県不明時の単価は 0 以上で入力してください。")
      return
    }
    // 距離連動モデルのパラメータ
    const baseUnitPrice = parseRequiredNumber(mmBaseUnitPrice)
    if (baseUnitPrice === null || baseUnitPrice < 0) {
      toast.error("基本料金は 0 以上で入力してください。")
      return
    }
    const distanceStepKm = parseRequiredNumber(mmDistanceStepKm)
    if (distanceStepKm === null || distanceStepKm < 1) {
      toast.error("距離の丸め単位(km)は 1 以上で入力してください。")
      return
    }
    const distanceStepCost = parseRequiredNumber(mmDistanceStepCost)
    if (distanceStepCost === null || distanceStepCost < 0) {
      toast.error("距離加算額は 0 以上で入力してください。")
      return
    }
    const unitPriceDivisor = parseRequiredNumber(mmUnitPriceDivisor)
    if (unitPriceDivisor === null || unitPriceDivisor < 1) {
      toast.error("割り戻し係数は 1 以上で入力してください。")
      return
    }
    // 都道府県別 距離(L列) / 固定値上書き(Q列)
    const distanceByPrefecture: Record<string, number> = {}
    const unitPriceByPrefecture: Record<string, number> = {}
    for (const row of mmPrefRows) {
      const distRaw = row.distance.trim()
      if (distRaw !== "") {
        const dist = Number(distRaw)
        if (!Number.isFinite(dist) || dist < 0) {
          toast.error(`${row.key} の距離は 0 以上の数値で入力してください。`)
          return
        }
        distanceByPrefecture[row.key] = dist
      }
      const overrideRaw = row.override.trim()
      if (overrideRaw !== "") {
        const override = Number(overrideRaw)
        if (!Number.isFinite(override) || override < 0) {
          toast.error(`${row.key} の固定単価は 0 以上の数値で入力してください。`)
          return
        }
        unitPriceByPrefecture[row.key] = Math.round(override)
      }
    }
    const tiers: CalcParameterConfig["machineMaintenance"]["tsuboTiers"] = []
    for (const [index, row] of mmTsuboTiers.entries()) {
      const minTsubo = parseRequiredNumber(row.minTsubo)
      const workers = parseRequiredNumber(row.workers)
      const days = parseRequiredNumber(row.days)
      if (minTsubo === null || minTsubo < 0) {
        toast.error(`坪数帯${index + 1}の「坪数以上」は 0 以上で入力してください。`)
        return
      }
      if (workers === null || workers < 0) {
        toast.error(`坪数帯${index + 1}の「人数」は 0 以上で入力してください。`)
        return
      }
      if (days === null || days < 0) {
        toast.error(`坪数帯${index + 1}の「日数」は 0 以上で入力してください。`)
        return
      }
      tiers.push({ minTsubo, workers, days })
    }
    if (tiers.length === 0) {
      toast.error("坪数帯を 1 行以上設定してください。")
      return
    }
    await persistParams(
      {
        machineMaintenance: {
          ...calcParams.machineMaintenance,
          applyOnlyWhenFranchise: mmApplyOnlyWhenFranchise,
          intervalMonths: Math.round(interval),
          fallbackUnitPrice: Math.round(fallback),
          tsuboTiers: tiers.sort((a, b) => a.minTsubo - b.minTsubo),
          baseUnitPrice: Math.round(baseUnitPrice),
          distanceStepKm: Math.round(distanceStepKm),
          distanceStepCost: Math.round(distanceStepCost),
          unitPriceDivisor,
          distanceByPrefecture,
          unitPriceByPrefecture,
        },
      },
      setIsSavingStepMM,
      "マシンメンテナンス費を保存しました。",
      syncMachineMaintenanceParams,
    )
  }

  async function saveFitnessMachineParams() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }
    const divisor = parseRequiredNumber(fmDirectDivisor)
    if (divisor === null || divisor < 1) {
      toast.error("直営の割り戻し係数は 1 以上で入力してください。")
      return
    }
    const fallback = parseRequiredNumber(fmFallbackUnitPrice)
    if (fallback === null || fallback < 0) {
      toast.error("都道府県不明時の坪単価は 0 以上で入力してください。")
      return
    }
    const unitPriceByPrefecture: Record<string, number> = {}
    for (const row of fmPrefRows) {
      const raw = row.unitPrice.trim()
      if (raw === "") continue // 空欄の県はフォールバック単価を使う
      const price = Number(raw)
      if (!Number.isFinite(price) || price < 0) {
        toast.error(`${row.key} の坪単価は 0 以上の数値で入力してください。`)
        return
      }
      unitPriceByPrefecture[row.key] = Math.round(price)
    }
    if (Object.keys(unitPriceByPrefecture).length === 0) {
      toast.error("坪単価を 1 県以上設定してください。")
      return
    }
    await persistParams(
      {
        fitnessMachine: {
          ...(calcParams.fitnessMachine ?? DEFAULT_CALC_PARAMS.fitnessMachine),
          directDivisor: divisor,
          fallbackUnitPrice: Math.round(fallback),
          unitPriceByPrefecture,
        },
      },
      setIsSavingStepFM,
      "フィットネスマシン費を保存しました。",
      syncFitnessMachineParams,
    )
  }

  async function saveSecurityParams() {
    if (!calcParams) {
      toast.error("計算パラメータが取得できていません。")
      return
    }
    const fixedItems: Array<{ label: string; amount: number }> = []
    for (const [index, item] of secFixedItems.entries()) {
      const label = item.label.trim()
      if (!label) {
        toast.error(`固定額${index + 1}の項目名を入力してください。`)
        return
      }
      const amount = parseRequiredNumber(item.amount)
      if (amount === null || amount < 0) {
        toast.error(`固定額「${label}」の金額は 0 以上で入力してください。`)
        return
      }
      fixedItems.push({ label, amount: Math.round(amount) })
    }
    const numberOrError = (raw: string, name: string, min: number): number | null => {
      const value = parseRequiredNumber(raw)
      if (value === null || value < min) {
        toast.error(`${name}は ${min} 以上で入力してください。`)
        return null
      }
      return value
    }
    const cameraUnitPrice = numberOrError(secCameraUnitPrice, "カメラ導入単価", 0)
    if (cameraUnitPrice === null) return
    const cameraBaseCount = numberOrError(secCameraBaseCount, "カメラの基準台数", 0)
    if (cameraBaseCount === null) return
    const cameraBaseTsubo = numberOrError(secCameraBaseTsubo, "カメラの基準坪数", 0)
    if (cameraBaseTsubo === null) return
    const cameraTsuboPer = numberOrError(secCameraTsuboPer, "カメラの坪刻み", 1)
    if (cameraTsuboPer === null) return
    const monitorUnitPrice = numberOrError(secMonitorUnitPrice, "サイネージ導入単価", 0)
    if (monitorUnitPrice === null) return
    const monitorBaseCount = numberOrError(secMonitorBaseCount, "サイネージの基準台数", 0)
    if (monitorBaseCount === null) return
    const monitorBaseTsubo = numberOrError(secMonitorBaseTsubo, "サイネージの基準坪数", 0)
    if (monitorBaseTsubo === null) return
    const monitorTsuboPer = numberOrError(secMonitorTsuboPer, "サイネージの坪刻み", 1)
    if (monitorTsuboPer === null) return
    const roundUpUnit = numberOrError(secRoundUpUnit, "切り上げ単位", 1)
    if (roundUpUnit === null) return
    await persistParams(
      {
        security: {
          fixedItems,
          cameraUnitPrice: Math.round(cameraUnitPrice),
          cameraCountRule: { baseCount: cameraBaseCount, baseTsubo: cameraBaseTsubo, tsuboPerUnit: cameraTsuboPer },
          monitorUnitPrice: Math.round(monitorUnitPrice),
          monitorCountRule: { baseCount: monitorBaseCount, baseTsubo: monitorBaseTsubo, tsuboPerUnit: monitorTsuboPer },
          roundUpUnit: Math.round(roundUpUnit),
        },
      },
      setIsSavingStepSec,
      "ALSOK・USEN導入費を保存しました。",
      syncSecurityParams,
    )
  }

  useEffect(() => {
    let disposed = false

    async function load() {
      setLoading(true)
      setError(null)
      setCalcWarning(null)
      setIsDemoMode(false)

      try {
        const [logicResponse, calcResponse] = await Promise.all([
          fetch("/api/master/logic-visualization", { cache: "no-store" }),
          fetch("/api/master/calc-params", { cache: "no-store" }),
        ])

        const logicPayload = (await logicResponse.json().catch(() => null)) as LogicVisualizationResponse | { error?: { message?: string } } | null
        const calcPayload = (await calcResponse.json().catch(() => null)) as CalcParamsPayload | { error?: { message?: string } } | null

        if (!logicResponse.ok) {
          const message =
            logicPayload && typeof logicPayload === "object" && "error" in logicPayload && logicPayload.error?.message
              ? logicPayload.error.message
              : "ロジック可視化データの取得に失敗しました。"
          if (!disposed) setError(message)
          return
        }

        if (!calcResponse.ok) {
          const message =
            calcPayload && typeof calcPayload === "object" && "error" in calcPayload && calcPayload.error?.message
              ? calcPayload.error.message
              : "計算パラメータの取得に失敗しました。"
          if (!disposed) {
            setData(logicPayload as LogicVisualizationResponse)
            setCalcParams(DEMO_CALC_PARAMS)
            setIsDemoMode(true)
            setCalcWarning(message)
            syncAllParams(DEMO_CALC_PARAMS)
          }
          return
        }

        if (!disposed) {
          setData(logicPayload as LogicVisualizationResponse)
          const params = (calcPayload as CalcParamsPayload)?.params ?? null
          setCalcParams(params)
          setIsDemoMode(false)
          if (params) {
            syncAllParams(params)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "ロジック可視化データの取得に失敗しました。"
        if (!disposed) setError(message)
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void load()

    return () => {
      disposed = true
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const formulaLabelMap = new Map(data.formulas.map((formula) => [formula.key, formula.label]))
  const toFormulaLabel = (key: string): string => formulaLabelMap.get(key) || "未定義の式"

  const feeFormulaLines = buildFormulaLines(data.formulas, [
    { key: "paymentFee", label: "決済手数料", fallback: "有効な式セット定義を参照" },
    { key: "monthlyRoyalty", label: "月次ロイヤリティ", fallback: "有効な式セット定義を参照" },
    { key: "appFee", label: "アプリ利用料", fallback: "有効な式セット定義を参照" },
  ])
  const competitorFormulaLines = buildFormulaLines(data.formulas, [
    { key: "initialJoiners", label: "初月入会人数", fallback: "有効な式セット定義を参照" },
    { key: "demandMultiplier", label: "需要乗数", fallback: "有効な式セット定義を参照" },
  ])
  const adCostFormulaLines = buildFormulaLines(data.formulas, [
    { key: "adCostMonthly", label: "月次広告費", fallback: "有効な式セット定義を参照" },
    {
      key: "monthlyCost",
      label: "月次総コスト",
      fallback: "有効な式セット定義を参照",
    },
  ])

  // 損益分岐点ロジックのライブプレビュー（平均単価・限界利益単価を現在の入力値から算出）
  const avgPriceLive = computeAveragePrice({
    memberFeeExTax: Number(memberFeeExTax) || 0,
    options: pricingOptions.map((opt) => ({
      label: opt.label,
      price: Number(opt.price) || 0,
      ratio: Number(opt.ratio) || 0,
    })),
  })
  const paymentFeeRateLive = (Number(paymentFeeRatePercent) || 0) / 100
  const variableCostPerMemberLive = avgPriceLive * paymentFeeRateLive
  const contributionMarginLive = avgPriceLive - variableCostPerMemberLive
  const yen = (value: number) => `${Math.round(value).toLocaleString("ja-JP")} 円`
  const updateOption = (index: number, field: "price" | "ratio", value: string) =>
    setPricingOptions((prev) => prev.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)))

  return (
    <div className="space-y-5 p-6">
      {isDemoMode ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>デモ表示</AlertTitle>
          <AlertDescription>
            計算パラメータの取得に失敗したため、デモ値で表示しています。保存先が利用可能な環境ではそのまま反映できます。
          </AlertDescription>
        </Alert>
      ) : null}

      {calcWarning ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>計算パラメータ警告</AlertTitle>
          <AlertDescription>{calcWarning}</AlertDescription>
        </Alert>
      ) : null}

      {data.warnings.length > 0 ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>注意事項</AlertTitle>
          <AlertDescription>
            {data.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetaCard
          title="アクティブ式セット"
          value={data.activeFormulaSet?.setVersion || "未取得"}
          note={data.activeFormulaSet?.status || "status: unknown"}
          icon={SparklesIcon}
          accent="primary"
        />
        <MetaCard title="式数" value={data.summary.formulaCount} icon={LayersIcon} accent="chart-1" />
        <MetaCard title="変数数" value={data.summary.variableCount} icon={VariableIcon} accent="chart-2" />
        <MetaCard
          title="取得時刻"
          value={new Date(data.generatedAt).toLocaleString("ja-JP")}
          note={data.source.formulaSetSource}
          icon={GitBranchIcon}
          accent="chart-4"
        />
      </div>

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={CreditCardIcon}
          title="手数料・上限"
          description="決済手数料率、ロイヤリティ上限、アプリ利用料を管理します。"
          accent="chart-1"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="式" accent="chart-1">
            {feeFormulaLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </InfoTile>
          <InfoTile label="影響範囲">月次損益、ロイヤリティ計算、キャッシュフローに影響</InfoTile>
          <InfoTile label="インプット">決済手数料率 / ロイヤリティ月額上限 / アプリ利用料</InfoTile>
          <InfoTile label="アウトプット">決済手数料 / 月次ロイヤリティ / 月次損益 など</InfoTile>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="paymentFeeRateStep1" className="text-xs font-medium">決済手数料率</Label>
            <SuffixedInput
              id="paymentFeeRateStep1"
              value={paymentFeeRatePercent}
              onChange={setPaymentFeeRatePercent}
              disabled={isSavingStep1}
              suffix="%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="royaltyCapMonthlyStep1" className="text-xs font-medium">ロイヤリティ月額上限</Label>
            <SuffixedInput
              id="royaltyCapMonthlyStep1"
              value={royaltyCapMonthly}
              onChange={setRoyaltyCapMonthly}
              disabled={isSavingStep1}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appFeeMonthlyStep1" className="text-xs font-medium">アプリ利用料</Label>
            <SuffixedInput
              id="appFeeMonthlyStep1"
              value={appFeeMonthly}
              onChange={setAppFeeMonthly}
              disabled={isSavingStep1}
              suffix="円/月"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep1Params} disabled={isSavingStep1} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep1 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={UsersIcon}
          title="競合影響率"
          description="競合店舗数に応じた需要減衰率を設定します。"
          accent="chart-2"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="式" accent="chart-2">
            {competitorFormulaLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </InfoTile>
          <InfoTile label="影響範囲">需要予測、売上予測、損益シミュレーション全体に影響</InfoTile>
          <InfoTile label="インプット">競合影響率（1〜2店舗 / 3店舗 / 4店舗 / 5店舗以上）</InfoTile>
          <InfoTile label="アウトプット">需要乗数 / 売上予測 / 月次損益 など</InfoTile>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="competitorUpTo2Step2" className="text-xs font-medium">競合1〜2店舗</Label>
            <SuffixedInput
              id="competitorUpTo2Step2"
              value={competitorUpTo2Percent}
              onChange={setCompetitorUpTo2Percent}
              disabled={isSavingStep2}
              suffix="%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorFor3Step2" className="text-xs font-medium">競合3店舗</Label>
            <SuffixedInput
              id="competitorFor3Step2"
              value={competitorFor3Percent}
              onChange={setCompetitorFor3Percent}
              disabled={isSavingStep2}
              suffix="%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorFor4Step2" className="text-xs font-medium">競合4店舗</Label>
            <SuffixedInput
              id="competitorFor4Step2"
              value={competitorFor4Percent}
              onChange={setCompetitorFor4Percent}
              disabled={isSavingStep2}
              suffix="%"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="competitorOver4Step2" className="text-xs font-medium">競合5店舗以上</Label>
            <SuffixedInput
              id="competitorOver4Step2"
              value={competitorOver4Percent}
              onChange={setCompetitorOver4Percent}
              disabled={isSavingStep2}
              suffix="%"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep2Params} disabled={isSavingStep2} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep2 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={MegaphoneIcon}
          title="広告費テーブル"
          description="月次広告費のルールを年次・月次区分で設定します。"
          accent="chart-4"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="式" accent="chart-4">
            {adCostFormulaLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </InfoTile>
          <InfoTile label="影響範囲">月次販促費、損益推移、投資回収期間に影響</InfoTile>
          <InfoTile label="インプット">広告費テーブル（1年目1月〜3年目以降）</InfoTile>
          <InfoTile label="アウトプット">月次広告費 / 月次損益 / 累積キャッシュフロー など</InfoTile>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month1Step3" className="text-xs font-medium">1年目 1月</Label>
            <SuffixedInput
              id="adCostYear1Month1Step3"
              value={adCostYear1Month1}
              onChange={setAdCostYear1Month1}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month2Step3" className="text-xs font-medium">1年目 2月</Label>
            <SuffixedInput
              id="adCostYear1Month2Step3"
              value={adCostYear1Month2}
              onChange={setAdCostYear1Month2}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month34Step3" className="text-xs font-medium">1年目 3〜4月</Label>
            <SuffixedInput
              id="adCostYear1Month34Step3"
              value={adCostYear1Month3To4}
              onChange={setAdCostYear1Month3To4}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear1Month512Step3" className="text-xs font-medium">1年目 5〜12月</Label>
            <SuffixedInput
              id="adCostYear1Month512Step3"
              value={adCostYear1Month5To12}
              onChange={setAdCostYear1Month5To12}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear2MonthlyStep3" className="text-xs font-medium">2年目 毎月</Label>
            <SuffixedInput
              id="adCostYear2MonthlyStep3"
              value={adCostYear2Monthly}
              onChange={setAdCostYear2Monthly}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adCostYear3PlusMonthlyStep3" className="text-xs font-medium">3年目以降 毎月</Label>
            <SuffixedInput
              id="adCostYear3PlusMonthlyStep3"
              value={adCostYear3PlusMonthly}
              onChange={setAdCostYear3PlusMonthly}
              disabled={isSavingStep3}
              suffix="円"
              inputMode="numeric"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep3Params} disabled={isSavingStep3} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep3 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      {/* 平均単価（会費＋オプション） */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={CreditCardIcon}
          title="平均単価（会費＋オプション）"
          description="会費とオプション料金表（単価×加入構成比）から平均単価を算出します。売上・損益分岐点の基礎です。"
          accent="chart-1"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="式" accent="chart-1">平均単価 = 会費 + Σ(オプション単価 × 構成比)</InfoTile>
          <InfoTile label="影響範囲">月次売上、限界利益、損益分岐点に影響</InfoTile>
          <InfoTile label="インプット">会費 / オプション料金表</InfoTile>
          <InfoTile label="アウトプット">平均単価 = <span className="font-semibold text-foreground">{yen(avgPriceLive)}</span></InfoTile>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="memberFeeExTaxStep4" className="text-xs font-medium">会費（税抜）</Label>
            <SuffixedInput id="memberFeeExTaxStep4" value={memberFeeExTax} onChange={setMemberFeeExTax} disabled={isSavingStep4} suffix="円/月" inputMode="numeric" />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-medium">オプション</TableHead>
                <TableHead className="text-xs font-medium">単価（円/月）</TableHead>
                <TableHead className="text-xs font-medium">加入構成比（0〜1）</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingOptions.map((opt, index) => (
                <TableRow key={opt.label} className="border-border/40">
                  <TableCell className="text-xs font-medium">{opt.label}</TableCell>
                  <TableCell>
                    <Input inputMode="numeric" value={formatThousands(opt.price)} onChange={(e) => updateOption(index, "price", toDigits(e.target.value))} disabled={isSavingStep4} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input inputMode="decimal" value={opt.ratio} onChange={(e) => updateOption(index, "ratio", e.target.value)} disabled={isSavingStep4} className="h-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep4Params} disabled={isSavingStep4} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep4 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      {/* 損益分岐点ロジック（閲覧専用） */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
        <SectionHeader
          icon={SparklesIcon}
          title="損益分岐点ロジック"
          description="損益分岐会員数の算出ロジックです。平均単価と決済手数料率から限界利益単価を求め、固定費を割って算出します。"
          accent="chart-3"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoTile label="① 限界利益単価" accent="chart-3">
            平均単価 − 平均単価 × 決済手数料率<br />
            = {yen(avgPriceLive)} − {yen(variableCostPerMemberLive)}<br />
            = <span className="font-semibold text-foreground">{yen(contributionMarginLive)}</span>
            <span className="block text-[10px] text-muted-foreground">※FC契約時はロイヤリティ単価も変動費に加算</span>
          </InfoTile>
          <InfoTile label="② 損益分岐会員数" accent="chart-3">
            固定費 ÷ 限界利益単価<br />
            = (家賃 + ランニングコスト) ÷ {yen(contributionMarginLive)}
            <span className="block text-[10px] text-muted-foreground">※固定費は試算ごとの入力値（家賃・ランニングコスト合計）</span>
          </InfoTile>
          <InfoTile label="参考: 基準ケース" accent="chart-3">
            固定費 1,208,000 円 ÷ {contributionMarginLive > 0 ? Math.round(1_208_000 / contributionMarginLive).toLocaleString("ja-JP") : "—"} 名
            <span className="block text-[10px] text-muted-foreground">固定費=家賃900,000＋ランニング308,000の例</span>
          </InfoTile>
        </div>
        <Alert>
          <AlertTriangleIcon />
          <AlertDescription>
            損益分岐会員数は試算結果から自動算出されます（このセクションは計算ロジックの確認用）。値を変えるには平均単価・決済手数料率を編集してください。
          </AlertDescription>
        </Alert>
      </section>

      {/* 会員獲得モデル（継続率・獲得チャネル） */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={UsersIcon}
          title="会員獲得モデル"
          description="継続率（コホート）と媒体別獲得（自然検索・口コミ・Web・SNS）のパラメータを管理します。"
          accent="chart-2"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">初月継続率（0〜1）</Label>
            <SuffixedInput id="retentionFirstMonth" value={retentionFirstMonth} onChange={setRetentionFirstMonth} disabled={isSavingStep5} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">2か月目以降継続率（0〜1）</Label>
            <SuffixedInput id="retentionSubsequent" value={retentionSubsequent} onChange={setRetentionSubsequent} disabled={isSavingStep5} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">自然検索率（0〜1）</Label>
            <SuffixedInput id="organicSearchRate" value={organicSearchRate} onChange={setOrganicSearchRate} disabled={isSavingStep5} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">口コミ紹介率（0〜1）</Label>
            <SuffixedInput id="referralRate" value={referralRate} onChange={setReferralRate} disabled={isSavingStep5} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">初月配分 看板（0〜1）</Label>
            <SuffixedInput id="splitSignage" value={splitSignage} onChange={setSplitSignage} disabled={isSavingStep5} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">初月配分 Web（0〜1）</Label>
            <SuffixedInput id="splitWeb" value={splitWeb} onChange={setSplitWeb} disabled={isSavingStep5} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">初月配分 SNS（0〜1）</Label>
            <SuffixedInput id="splitSns" value={splitSns} onChange={setSplitSns} disabled={isSavingStep5} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">SEM CPA（1〜2年目）</Label>
            <SuffixedInput id="semCpaY1Y2" value={semCpaY1Y2} onChange={setSemCpaY1Y2} disabled={isSavingStep5} suffix="円" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">SEM CPA（3年目以降）</Label>
            <SuffixedInput id="semCpaY3Plus" value={semCpaY3Plus} onChange={setSemCpaY3Plus} disabled={isSavingStep5} suffix="円" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">SNS広告単価</Label>
            <SuffixedInput id="snsAdUnitCost" value={snsAdUnitCost} onChange={setSnsAdUnitCost} disabled={isSavingStep5} suffix="円" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Web広告月予算</Label>
            <SuffixedInput id="webBudgetMonthly" value={webBudgetMonthly} onChange={setWebBudgetMonthly} disabled={isSavingStep5} suffix="円" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">SNS広告月予算</Label>
            <SuffixedInput id="snsBudgetMonthly" value={snsBudgetMonthly} onChange={setSnsBudgetMonthly} disabled={isSavingStep5} suffix="円" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">SNS初月上乗せ人数</Label>
            <SuffixedInput id="snsInitialBonus" value={snsInitialBonus} onChange={setSnsInitialBonus} disabled={isSavingStep5} suffix="人" inputMode="numeric" />
          </div>
        </div>
        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep5Params} disabled={isSavingStep5} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep5 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      {/* キャパシティ */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={LayersIcon}
          title="キャパシティ"
          description="床面積・利用回数・稼働率から最大会員数（キャパ上限）と駐車場必要台数を算出します。"
          accent="chart-4"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoTile label="式" accent="chart-4">最大会員数 = 平均稼働率 × (同時収容 × 営業時間 × 7) ÷ (利用回数 × 滞在時間)</InfoTile>
          <InfoTile label="影響範囲">会員数の上限、売上の頭打ち、損益分岐に影響</InfoTile>
          <InfoTile label="アウトプット">最大会員数 / 同時利用人数 / 駐車場必要台数</InfoTile>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">1人あたり利用回数</Label>
            <SuffixedInput id="capVisitsPerWeek" value={capVisitsPerWeek} onChange={setCapVisitsPerWeek} disabled={isSavingStep6} suffix="回/週" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">平均滞在時間</Label>
            <SuffixedInput id="capAvgStayHours" value={capAvgStayHours} onChange={setCapAvgStayHours} disabled={isSavingStep6} suffix="時間" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">1人当たり必要面積</Label>
            <SuffixedInput id="capAreaPerMember" value={capAreaPerMember} onChange={setCapAreaPerMember} disabled={isSavingStep6} suffix="坪" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">営業時間</Label>
            <SuffixedInput id="capBusinessHours" value={capBusinessHours} onChange={setCapBusinessHours} disabled={isSavingStep6} suffix="時間/日" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">平均稼働率（0〜1）</Label>
            <SuffixedInput id="capAvgUtilization" value={capAvgUtilization} onChange={setCapAvgUtilization} disabled={isSavingStep6} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">田舎型係数（0〜1）</Label>
            <SuffixedInput id="capRuralFactor" value={capRuralFactor} onChange={setCapRuralFactor} disabled={isSavingStep6} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">駐車場利用率（0〜1）</Label>
            <SuffixedInput id="capParkingUtilization" value={capParkingUtilization} onChange={setCapParkingUtilization} disabled={isSavingStep6} suffix="率" />
          </div>
        </div>
        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep6Params} disabled={isSavingStep6} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep6 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      {/* シナリオ係数（店頭看板・広告効果） */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={GitBranchIcon}
          title="シナリオ係数（看板・広告効果）"
          description="保守／標準／アグレッシブ別の店頭看板獲得係数と、年2以降のWeb/SNS広告効果係数を設定します。"
          accent="chart-2"
        />
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-medium">シナリオ</TableHead>
                <TableHead className="text-xs font-medium">基準係数</TableHead>
                <TableHead className="text-xs font-medium">2か月目</TableHead>
                <TableHead className="text-xs font-medium">3か月目</TableHead>
                <TableHead className="text-xs font-medium">4か月目</TableHead>
                <TableHead className="text-xs font-medium">月次逓減</TableHead>
                <TableHead className="text-xs font-medium">広告効果 年2-5</TableHead>
                <TableHead className="text-xs font-medium">広告効果 年6-10</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(["conservative", "standard", "aggressive"] as ScenarioKey[]).map((s) => {
                const row = signageByScenario[s]
                const upd = (field: keyof typeof row, value: string) =>
                  setSignageByScenario((prev) => ({ ...prev, [s]: { ...prev[s], [field]: value } }))
                return (
                  <TableRow key={s} className="border-border/40">
                    <TableCell className="text-xs font-medium">{SCENARIO_LABELS[s]}</TableCell>
                    {(["baseFactor", "month2Factor", "month3Factor", "month4Factor", "monthlyDecay", "adEffectivenessYear2to5", "adEffectivenessYear6Plus"] as Array<keyof typeof row>).map((field) => (
                      <TableCell key={field}>
                        <Input inputMode="decimal" value={row[field]} onChange={(e) => upd(field, e.target.value)} disabled={isSavingStep7} className="h-8 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep7Params} disabled={isSavingStep7} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep7 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      {/* 減価償却・税・入金サイクル */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={VariableIcon}
          title="減価償却・税・入金サイクル"
          description="投資項目別の耐用年数、法人税率、入金サイクル（資金繰りラグ）を設定します。"
          accent="chart-3"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">内装 耐用年数</Label>
            <SuffixedInput id="deprInterior" value={deprInterior} onChange={setDeprInterior} disabled={isSavingStep8} suffix="年" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">フィットネスマシン 耐用年数</Label>
            <SuffixedInput id="deprMachine" value={deprMachine} onChange={setDeprMachine} disabled={isSavingStep8} suffix="年" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">フラッパーゲート 耐用年数</Label>
            <SuffixedInput id="deprFlapper" value={deprFlapper} onChange={setDeprFlapper} disabled={isSavingStep8} suffix="年" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">体組成計 耐用年数</Label>
            <SuffixedInput id="deprBodyComp" value={deprBodyComp} onChange={setDeprBodyComp} disabled={isSavingStep8} suffix="年" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">法人税率（0〜1）</Label>
            <SuffixedInput id="corporateTaxRate" value={corporateTaxRate} onChange={setCorporateTaxRate} disabled={isSavingStep8} suffix="率" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">入金サイクル</Label>
            <SuffixedInput id="cashCollectionLagMonths" value={cashCollectionLagMonths} onChange={setCashCollectionLagMonths} disabled={isSavingStep8} suffix="ヶ月" inputMode="numeric" />
          </div>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
          ※ 耐用年数に掲載の無い投資項目（WS・FC加盟費・システム・開業準備・パッケージ・ALSOK/USEN 等）は非償却です。
        </div>
        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveStep8Params} disabled={isSavingStep8} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStep8 ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      {/* マシンメンテナンス費（入力欄 B34） */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={WrenchIcon}
          title="マシンメンテナンス費"
          description="1回費用 = 都道府県別単価 × 作業人数 × 作業日数。月額 = 1回費用 ÷ 実施間隔。ランニングコストに内包されます。"
          accent="chart-4"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">実施間隔</Label>
            <SuffixedInput id="mmIntervalMonths" value={mmIntervalMonths} onChange={setMmIntervalMonths} disabled={isSavingStepMM} suffix="ヶ月に1回" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">都道府県不明時の単価</Label>
            <SuffixedInput id="mmFallbackUnitPrice" value={mmFallbackUnitPrice} onChange={setMmFallbackUnitPrice} disabled={isSavingStepMM} suffix="円" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">FC（ロイヤリティ&gt;0）のみ計上</Label>
            <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs">
              <input
                type="checkbox"
                checked={mmApplyOnlyWhenFranchise}
                onChange={(event) => setMmApplyOnlyWhenFranchise(event.target.checked)}
                disabled={isSavingStepMM}
                className="size-4 accent-chart-4"
              />
              <span className="text-muted-foreground">{mmApplyOnlyWhenFranchise ? "直営（ロイヤリティ=0）は0円" : "直営でも計上する"}</span>
            </label>
          </div>
        </div>

        {/* 距離連動の単価モデル（入力欄 Q=P/2, P=基本料+距離加算, 距離加算=⌊距離/丸め単位⌋×加算額） */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">距離連動の単価モデル（入力欄 K25:Q72）</Label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">基本料金（距離0=拠点）</Label>
              <SuffixedInput id="mmBaseUnitPrice" value={mmBaseUnitPrice} onChange={setMmBaseUnitPrice} disabled={isSavingStepMM} suffix="円" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">距離の丸め単位</Label>
              <SuffixedInput id="mmDistanceStepKm" value={mmDistanceStepKm} onChange={setMmDistanceStepKm} disabled={isSavingStepMM} suffix="km" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">丸め単位ごとの距離加算</Label>
              <SuffixedInput id="mmDistanceStepCost" value={mmDistanceStepCost} onChange={setMmDistanceStepCost} disabled={isSavingStepMM} suffix="円" inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">割り戻し係数（Q=P÷係数）</Label>
              <SuffixedInput id="mmUnitPriceDivisor" value={mmUnitPriceDivisor} onChange={setMmUnitPriceDivisor} disabled={isSavingStepMM} suffix="で割る" inputMode="numeric" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            単価 = （基本料 + ⌊距離 ÷ 丸め単位⌋ × 距離加算）÷ 割り戻し係数。固定値が入力された県はこの計算より固定値を優先します。
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">坪数帯 → 作業人数・日数（入力欄 N19/P19）</Label>
          <div className="overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">坪数以上</TableHead>
                  <TableHead className="text-xs">作業人数</TableHead>
                  <TableHead className="text-xs">作業日数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mmTsuboTiers.map((row, index) => {
                  const updateRow = (field: "minTsubo" | "workers" | "days", value: string) =>
                    setMmTsuboTiers((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <SuffixedInput id={`mmTier-min-${index}`} value={row.minTsubo} onChange={(v) => updateRow("minTsubo", v)} disabled={isSavingStepMM} suffix="坪" inputMode="numeric" />
                      </TableCell>
                      <TableCell>
                        <SuffixedInput id={`mmTier-workers-${index}`} value={row.workers} onChange={(v) => updateRow("workers", v)} disabled={isSavingStepMM} suffix="名" inputMode="numeric" />
                      </TableCell>
                      <TableCell>
                        <SuffixedInput id={`mmTier-days-${index}`} value={row.days} onChange={(v) => updateRow("days", v)} disabled={isSavingStepMM} suffix="日" inputMode="numeric" />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 都道府県別 距離・単価表（入力欄 K25:Q72） */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">都道府県別 距離・単価表（入力欄 L列＝拠点からの距離 / Q列＝単価）</Label>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="text-xs">都道府県</TableHead>
                  <TableHead className="text-xs">距離（km）</TableHead>
                  <TableHead className="text-xs">固定値上書き</TableHead>
                  <TableHead className="text-right text-xs">算出単価</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mmPrefRows.map((row, index) => {
                  const updateRow = (field: "distance" | "override", value: string) =>
                    setMmPrefRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
                  const resolved = resolveMaintenanceUnitPrice(row.key, mmPreviewConfig)
                  const isOverride = row.override.trim() !== ""
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{row.key}</TableCell>
                      <TableCell>
                        <SuffixedInput id={`mmPref-distance-${row.key}`} value={row.distance} onChange={(v) => updateRow("distance", v)} disabled={isSavingStepMM} suffix="km" inputMode="decimal" />
                      </TableCell>
                      <TableCell>
                        <SuffixedInput id={`mmPref-override-${row.key}`} value={row.override} onChange={(v) => updateRow("override", v)} disabled={isSavingStepMM} suffix="円" inputMode="numeric" placeholder="（距離計算）" />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">
                        ¥{formatThousands(String(Math.round(resolved)))}
                        <span className={`ml-1.5 text-[10px] ${isOverride ? "text-chart-4" : "text-muted-foreground"}`}>
                          {isOverride ? "固定" : "距離"}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
          ※ 「固定値上書き」が空欄の県は距離から自動計算（Excel の Q=P/2 式の県）。値を入れた県はその固定値を採用します（Excel で式を外して手入力された県）。<br />
          ※ 距離は拠点（愛知）からの距離（入力欄 L列）。愛知は基準額アンカーのため距離0です。<br />
          ※ Excel 原本は「2〜3ヶ月に1回」と注記しつつ毎月1回分を計上していました。本システムでは実施間隔で月割りし、実態に即した月額へ補正しています。
        </div>
        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveMachineMaintenanceParams} disabled={isSavingStepMM} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStepMM ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      {/* フィットネスマシン費（入力欄 J8 = 坪単価 × 有効坪数） */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={DumbbellIcon}
          title="フィットネスマシン費"
          description="取得額 = 都道府県別の坪単価 × 有効坪数（床面積 − ゴルフ打席の占有坪）。直営（ロイヤリティ0）は坪単価を割り戻し（既定: 半額）、FC（10/15%）は満額。投資コストに計上されます。"
          accent="chart-1"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">直営の割り戻し係数（直営単価 = 満額 ÷ 係数）</Label>
            <SuffixedInput id="fmDirectDivisor" value={fmDirectDivisor} onChange={setFmDirectDivisor} disabled={isSavingStepFM} suffix="で割る" inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">都道府県不明時の坪単価（FC満額ベース）</Label>
            <SuffixedInput id="fmFallbackUnitPrice" value={fmFallbackUnitPrice} onChange={setFmFallbackUnitPrice} disabled={isSavingStepFM} suffix="円/坪" inputMode="numeric" />
          </div>
        </div>

        {/* 都道府県別 坪単価表（入力欄 料金表の最右列） */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">都道府県別 坪単価表（入力欄 料金表の最右列＝FC満額）</Label>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="text-xs">都道府県</TableHead>
                  <TableHead className="text-xs">坪単価（FC満額）</TableHead>
                  <TableHead className="text-right text-xs">直営単価（÷係数）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fmPrefRows.map((row, index) => {
                  const updateRow = (value: string) =>
                    setFmPrefRows((prev) => prev.map((r, i) => (i === index ? { ...r, unitPrice: value } : r)))
                  const divisorValue = Math.max(1, Number(fmDirectDivisor) || 2)
                  const raw = row.unitPrice.trim()
                  const fullPrice = raw !== "" && Number.isFinite(Number(raw))
                    ? Number(raw)
                    : Math.max(0, Number(fmFallbackUnitPrice) || 0)
                  const isFallback = raw === ""
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{row.key}</TableCell>
                      <TableCell>
                        <SuffixedInput id={`fmPref-price-${row.key}`} value={row.unitPrice} onChange={updateRow} disabled={isSavingStepFM} suffix="円/坪" inputMode="numeric" placeholder="（不明時単価）" />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums whitespace-nowrap">
                        ¥{formatThousands(String(Math.round(fullPrice / divisorValue)))}
                        <span className={`ml-1.5 text-[10px] ${isFallback ? "text-chart-1" : "text-muted-foreground"}`}>
                          {isFallback ? "不明時" : "直営"}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
          ※ 都道府県は試算画面の住所（都道府県名の前方一致）から判定します。空欄の県は「不明時の坪単価」を使用します。<br />
          ※ 有効坪数 = 床面積 − ゴルフ打席の占有坪（右打席7坪/台・両打席9坪/台。投資マスタの「占有坪」設定に連動）。<br />
          ※ 元Excel検算: 愛知150,000円/坪 ÷2（直営）× 50坪 = ¥3,750,000（入力欄 表示値と一致）。<br />
          ※ 償却年は「減価償却・税・入金サイクル」セクションのフィットネスマシン（既定6年）で管理します。
        </div>
        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveFitnessMachineParams} disabled={isSavingStepFM} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStepFM ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      {/* ALSOK・USEN導入費（入力欄 B16/J16） */}
      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
        <SectionHeader
          icon={ShieldIcon}
          title="ALSOK・USEN導入費"
          description="取得額 = 固定額合計 ＋ カメラ単価×台数 ＋ サイネージ単価×台数 を切り上げ単位で丸め。台数は坪数の階段式（基準台数から坪刻みごとに+1台）。ロイヤリティ非連動・非償却で投資コストに計上されます。"
          accent="chart-2"
        />

        {/* 固定額の内訳（入力欄 M13/M14/M16） */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">固定額の内訳（入力欄 M13/M14/M16。坪数に依存しない項目）</Label>
          <div className="overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">項目名</TableHead>
                  <TableHead className="text-xs">金額</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {secFixedItems.map((item, index) => {
                  const updateRow = (field: "label" | "amount", value: string) =>
                    setSecFixedItems((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          id={`secFixed-label-${index}`}
                          value={item.label}
                          onChange={(event) => updateRow("label", event.target.value)}
                          disabled={isSavingStepSec}
                        />
                      </TableCell>
                      <TableCell>
                        <SuffixedInput id={`secFixed-amount-${index}`} value={item.amount} onChange={(v) => updateRow("amount", v)} disabled={isSavingStepSec} suffix="円" inputMode="numeric" />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* カメラ・サイネージの台数式（入力欄 D26/D28） */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">坪数連動の機器（台数 = 基準台数 + (坪数 − 基準坪数) ÷ 坪刻み を切り上げ。入力欄 D26/D28）</Label>
          <div className="overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">機器</TableHead>
                  <TableHead className="text-xs">導入単価</TableHead>
                  <TableHead className="text-xs">基準台数</TableHead>
                  <TableHead className="text-xs">基準坪数</TableHead>
                  <TableHead className="text-xs">坪刻み（+1台）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs font-medium whitespace-nowrap">カメラ</TableCell>
                  <TableCell><SuffixedInput id="secCameraUnitPrice" value={secCameraUnitPrice} onChange={setSecCameraUnitPrice} disabled={isSavingStepSec} suffix="円/台" inputMode="numeric" /></TableCell>
                  <TableCell><SuffixedInput id="secCameraBaseCount" value={secCameraBaseCount} onChange={setSecCameraBaseCount} disabled={isSavingStepSec} suffix="台" inputMode="numeric" /></TableCell>
                  <TableCell><SuffixedInput id="secCameraBaseTsubo" value={secCameraBaseTsubo} onChange={setSecCameraBaseTsubo} disabled={isSavingStepSec} suffix="坪" inputMode="numeric" /></TableCell>
                  <TableCell><SuffixedInput id="secCameraTsuboPer" value={secCameraTsuboPer} onChange={setSecCameraTsuboPer} disabled={isSavingStepSec} suffix="坪ごと" inputMode="decimal" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs font-medium whitespace-nowrap">サイネージ（モニター）</TableCell>
                  <TableCell><SuffixedInput id="secMonitorUnitPrice" value={secMonitorUnitPrice} onChange={setSecMonitorUnitPrice} disabled={isSavingStepSec} suffix="円/台" inputMode="numeric" /></TableCell>
                  <TableCell><SuffixedInput id="secMonitorBaseCount" value={secMonitorBaseCount} onChange={setSecMonitorBaseCount} disabled={isSavingStepSec} suffix="台" inputMode="numeric" /></TableCell>
                  <TableCell><SuffixedInput id="secMonitorBaseTsubo" value={secMonitorBaseTsubo} onChange={setSecMonitorBaseTsubo} disabled={isSavingStepSec} suffix="坪" inputMode="numeric" /></TableCell>
                  <TableCell><SuffixedInput id="secMonitorTsuboPer" value={secMonitorTsuboPer} onChange={setSecMonitorTsuboPer} disabled={isSavingStepSec} suffix="坪ごと" inputMode="decimal" /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">合計の切り上げ単位（Excel ROUNDUP(M18,-4)＝10,000円）</Label>
            <SuffixedInput id="secRoundUpUnit" value={secRoundUpUnit} onChange={setSecRoundUpUnit} disabled={isSavingStepSec} suffix="円単位" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">算出プレビュー用の坪数（保存されません）</Label>
            <SuffixedInput id="secPreviewTsubo" value={secPreviewTsubo} onChange={setSecPreviewTsubo} disabled={isSavingStepSec} suffix="坪" inputMode="decimal" />
          </div>
        </div>

        {/* 編集中の値を実エンジン（computeDeviceCount / computeSecurityIntroCost）に渡した算出プレビュー */}
        {(() => {
          const previewTsubo = Math.max(0, Number(secPreviewTsubo) || 0)
          const cameraCount = computeDeviceCount(previewTsubo, secPreviewConfig.cameraCountRule)
          const monitorCount = computeDeviceCount(previewTsubo, secPreviewConfig.monitorCountRule)
          const total = computeSecurityIntroCost(previewTsubo, secPreviewConfig)
          return (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InfoTile label={`カメラ台数（${previewTsubo}坪）`} accent="chart-2">
                {cameraCount}台 × ¥{formatThousands(secCameraUnitPrice || "0")}
              </InfoTile>
              <InfoTile label={`サイネージ台数（${previewTsubo}坪）`} accent="chart-2">
                {monitorCount}台 × ¥{formatThousands(secMonitorUnitPrice || "0")}
              </InfoTile>
              <InfoTile label="ALSOK・USEN導入費（切り上げ後）" accent="chart-2">
                ¥{formatThousands(String(total))}
              </InfoTile>
            </div>
          )
        })()}

        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
          ※ 元Excel検算: 50坪 → 固定346,000 ＋ カメラ5台×110,000 ＋ サイネージ4台×170,000 ＝ 1,576,000 → 万円切り上げ ¥1,580,000。<br />
          ※ この台数（入力欄 D26/D28）は、ランニングコストの「防犯カメラ(USEN)」「モニター(USEN)」の月額台数と共有です。新規試算のランニングコストタブでは、この台数式から坪数連動で自動算出されます（単価は試算画面で変更可）。<br />
          ※ Excel の光回線 21,000（M12）は SUM 範囲外のため既定では含めていません。含める場合は固定額の内訳に加算してください。
        </div>
        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button onClick={saveSecurityParams} disabled={isSavingStepSec} size="sm" className="gap-1.5">
            <SaveIcon className="size-3.5" />
            {isSavingStepSec ? "保存中..." : "保存"}
          </Button>
        </div>
      </section>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3">
              <LayersIcon className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">式一覧</CardTitle>
              <CardDescription className="text-xs">現在アクティブな式セットに含まれる定義（閲覧専用）</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-medium">ラベル</TableHead>
                  <TableHead className="text-xs font-medium">計算区分</TableHead>
                  <TableHead className="text-xs font-medium">依存</TableHead>
                  <TableHead className="text-xs font-medium">定義</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.formulas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      取得可能な式セットがありません。
                    </TableCell>
                  </TableRow>
                ) : (
                  data.formulas.map((formula) => (
                    <TableRow key={formula.key} className="border-border/40">
                      <TableCell className="text-xs font-medium">{formula.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{toCalcUnitLabel(formula.phase)}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {formula.dependsOn.length > 0 ? formula.dependsOn.map(toFormulaLabel).join("、") : "-"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-normal text-muted-foreground">
                        {formula.expression || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                <VariableIcon className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">変数定義</CardTitle>
                <CardDescription className="text-xs">入力・定数・派生値・地理情報の一覧（折りたたみ表示）</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <details className="group rounded-md border border-border/60">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
                <span>変数定義を表示する</span>
              </summary>
              <div className="border-t border-border/60 p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ラベル</TableHead>
                      <TableHead>ソース</TableHead>
                      <TableHead>単位</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.variables.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell>{item.source}</TableCell>
                        <TableCell>{item.unit || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4">
                <GitBranchIcon className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">依存関係</CardTitle>
                <CardDescription className="text-xs">式同士の依存定義（折りたたみ表示）</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <details className="group rounded-md border border-border/60">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90" />
                <span>依存関係を表示する</span>
              </summary>
              <div className="border-t border-border/60 p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>対象式</TableHead>
                      <TableHead>計算区分</TableHead>
                      <TableHead>依存先</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dependencies.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>{toFormulaLabel(item.key)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{toCalcUnitLabel(item.phase)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.dependsOn.length > 0 ? item.dependsOn.map(toFormulaLabel).join("、") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
