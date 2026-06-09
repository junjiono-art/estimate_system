import type { ScenarioType, SimulationRequestInput, SimulationResult } from "@/lib/types"
import type { CalcParameterConfig } from "@/lib/types"
import type { FormulaSetRecordLike } from "@/lib/formula-types"
import { computeAveragePrice, computeVariableCostPerMember } from "@/lib/average-price"
import { computeCapacity } from "@/lib/capacity"
import { simulateMemberGrowth } from "@/lib/member-growth"
import { computeMonthlyDepreciation } from "@/lib/depreciation"
import { calculateLtv } from "@/lib/ltv"
import { buildFormulaContext, buildInitialPhaseContext } from "@/lib/server/formula-runtime"
import {
  FITNESS_MACHINE_BASE_COST,
  resolveFitnessMachineCostByAddress,
} from "@/lib/fitness-machine-cost"
import { computeMachineMaintenanceMonthly } from "@/lib/machine-maintenance"
import { FormulaEvaluationEngine } from "@/lib/server/formula-evaluation-engine"

export type SimulateInput = SimulationRequestInput

export type RegressionMonthlyRow = {
  month: number
  members: number
  revenue: number
  cost: number
  profit: number
}

const PROJECTION_MONTHS = 120

const INITIAL_INVESTMENT = 23_110_000
const INTERIOR_COST = 15_000_000
const DEFAULT_MONTHLY_RENT = 900_000
const DEFAULT_MONTHLY_RUNNING = 308_000
const BASE_FLOOR_AREA_TSUBO = 50
const BASE_SUBURBAN_FIRST_MONTH_JOINERS = 334
const BASE_URBAN_ESTIMATED_JOINERS = 137
const BASE_SUBURBAN_ESTIMATED_JOINERS = 137 + 316
const BASE_RURAL_ESTIMATED_JOINERS = 137 + 316 + 65
const POPULATION_FACTOR = 1 - 0.26

// 回帰テスト/未入力時の基準ケース（元Excel「入力欄」の基準値。data/regression/input-base.csv 準拠）
const BASE_REGRESSION_INPUT: SimulateInput = {
  storeName: "regression-base",
  locationType: "suburban",
  floorAreaTsubo: BASE_FLOOR_AREA_TSUBO,
  rentPerTsubo: DEFAULT_MONTHLY_RENT,
  runningCostTotal: DEFAULT_MONTHLY_RUNNING,
  initialInvestmentTotal: INITIAL_INVESTMENT,
  competitorCount: 2,
  royaltyRate: 0,
  franchiseRate: 0,
  populationByRadius: { km1Ring: 11_416, km3Ring: 39_505, km5Ring: 64_764 },
}

function roundDown1(value: number): number {
  return Math.floor(value * 10) / 10
}

function getCompetitorImpactRate(competitorCount: number, calcParams: CalcParameterConfig): number {
  if (competitorCount <= 0) return 0
  if (competitorCount <= 2) return calcParams.competitorImpact.upTo2
  if (competitorCount === 3) return calcParams.competitorImpact.for3
  if (competitorCount === 4) return calcParams.competitorImpact.for4
  return calcParams.competitorImpact.over4
}

function getDemandMultiplier(locationType: SimulateInput["locationType"], competitorCount: number, calcParams: CalcParameterConfig): number {
  if (locationType === "urban") {
    const urbanJoiners = BASE_URBAN_ESTIMATED_JOINERS * POPULATION_FACTOR
    return urbanJoiners / BASE_SUBURBAN_FIRST_MONTH_JOINERS
  }

  if (locationType === "rural") {
    const ruralJoiners = BASE_RURAL_ESTIMATED_JOINERS * POPULATION_FACTOR * (1 - getCompetitorImpactRate(competitorCount, calcParams))
    return ruralJoiners / BASE_SUBURBAN_FIRST_MONTH_JOINERS
  }

  const suburbanJoiners = BASE_SUBURBAN_ESTIMATED_JOINERS * POPULATION_FACTOR
  return suburbanJoiners / BASE_SUBURBAN_FIRST_MONTH_JOINERS
}

function getPaymentFee(revenue: number, calcParams: CalcParameterConfig): number {
  return Math.round(revenue * calcParams.paymentFeeRate)
}

// 広告費（コスト側）の月次スケジュール。事業計画 R42（Web広告費+SNS広告費）。
function getMonthlyAdCost(month: number, calcParams: CalcParameterConfig): number {
  const year = Math.ceil(month / 12)
  const monthInYear = ((month - 1) % 12) + 1

  if (year === 1) {
    if (monthInYear === 1) return calcParams.adCost.year1Month1
    if (monthInYear === 2) return calcParams.adCost.year1Month2
    if (monthInYear === 3 || monthInYear === 4) return calcParams.adCost.year1Month3To4
    return calcParams.adCost.year1Month5To12
  }

  if (year === 2) return calcParams.adCost.year2Monthly
  return calcParams.adCost.year3PlusMonthly
}

function resolveMonthlyRent(input?: SimulateInput): number {
  if (!input) return DEFAULT_MONTHLY_RENT
  const rentPerTsubo = Number(input.rentPerTsubo)

  if (Number.isFinite(rentPerTsubo) && rentPerTsubo > 0) {
    return Math.round(rentPerTsubo)
  }

  return DEFAULT_MONTHLY_RENT
}

function resolveMonthlyRunning(input?: SimulateInput): number {
  const running = Number(input?.runningCostTotal)
  if (Number.isFinite(running) && running >= 0) return Math.round(running)
  return DEFAULT_MONTHLY_RUNNING
}

/**
 * マシンメンテナンス費（月額）を決定する。
 * 入力タブの固定枠で手入力された値（machineMaintenanceCost）があればそれを優先採用し、
 * 無ければ machineMaintenance パラメータから自動算出する（入力欄 B34）。
 */
function resolveMachineMaintenance(
  input: SimulateInput | undefined,
  calcParams: CalcParameterConfig,
  floorAreaTsubo: number,
  royaltyRate: number,
): number {
  const manual = Number(input?.machineMaintenanceCost)
  if (Number.isFinite(manual) && manual >= 0) return Math.round(manual)
  return computeMachineMaintenanceMonthly({
    address: input?.prefecture ?? input?.location,
    floorAreaTsubo,
    royaltyRate,
    config: calcParams.machineMaintenance,
  })
}

function resolveInitialInvestment(input?: SimulateInput): number {
  const total = Number(input?.initialInvestmentTotal)
  if (Number.isFinite(total) && total > 0) return Math.round(total)
  return INITIAL_INVESTMENT
}

function resolveFranchiseRate(input?: SimulateInput): 0 | 10 | 15 {
  const rate = input?.franchiseRate ?? input?.royaltyRate ?? 0
  if (rate === 10 || rate === 15) return rate
  return 0
}

/**
 * 見込み人数テーブル VLOOKUP (見込み人数テーブル A5:C77)
 * 20〜59歳人口 → 見込み人数係数（負の割合）
 * 0→-16%, 5000→-17%, ..., 360000(72ステップ)→-88%
 */
function lookupMemberCoefficient(population: number): number {
  const steps = Math.min(72, Math.floor(Math.max(0, population) / 5000))
  return -(16 + steps) / 100
}

/**
 * 初月見込み入会人数 G38 を計算する（未丸め）。
 * =IF(都市型,E60*(1+E38),IF(郊外型,E60+F60*(1+E38),IF(田舎型,E60+F60+G60*(1+E38))))*(1-E78)
 *
 * E60 = km1Ring × 1.20%、F60 = km3Ring × 0.80%、G60 = km5Ring × 0.10%
 * E38 = VLOOKUP(累計人口, 見込み人数テーブル) ← 立地タイプで累計範囲が変わる
 * E78 = 競合影響率
 *
 * populationByRadius が未設定の場合は従来ロジック（立地タイプ×坪数ベース）にフォールバック。
 * 会員数成長モデルが精度を要するため、丸めは行わない。
 */
function resolveInitialJoiners(input: SimulateInput, calcParams: CalcParameterConfig): number {
  const pop = input.populationByRadius
  const locationType = input.locationType ?? "suburban"
  const competitorCount = Math.max(0, input.competitorCount ?? 0)

  if (!pop) {
    const locationMultiplier = getDemandMultiplier(locationType, competitorCount, calcParams)
    const floorArea = Number(input.floorAreaTsubo)
    const areaMultiplier = Number.isFinite(floorArea) && floorArea > 0 ? floorArea / BASE_FLOOR_AREA_TSUBO : 1
    return Math.max(0.2, locationMultiplier * areaMultiplier) * BASE_SUBURBAN_FIRST_MONTH_JOINERS
  }

  const { km1Ring, km3Ring, km5Ring } = pop

  const e60 = km1Ring * 0.012 // 1km圏: 1.20%
  const f60 = km3Ring * 0.008 // 3km圏リング: 0.80%
  const g60 = km5Ring * 0.001 // 5km圏リング: 0.10%

  const lookupPop =
    locationType === "urban"
      ? km1Ring
      : locationType === "suburban"
        ? km1Ring + km3Ring
        : km1Ring + km3Ring + km5Ring

  const e38 = lookupMemberCoefficient(lookupPop)

  let baseJoiners: number
  if (locationType === "urban") {
    baseJoiners = e60 * (1 + e38)
  } else if (locationType === "suburban") {
    baseJoiners = e60 + f60 * (1 + e38)
  } else {
    baseJoiners = e60 + f60 + g60 * (1 + e38)
  }

  const competitorImpact = getCompetitorImpactRate(competitorCount, calcParams)
  return Math.max(0, baseJoiners * (1 - competitorImpact))
}

function buildMonthlyDerivedContext(
  month: number,
  monthlyRevenue: number,
  members: number,
  monthlyRent: number,
  monthlyRunningCost: number,
  adCostMonthly: number,
): Record<string, number> {
  return {
    month,
    members,
    monthlyRevenue,
    monthlyRent,
    monthlyRunningCost,
    adCostMonthly,
  }
}

// 初月見込み客（G38）。formulaSet に pre 層の override があれば優先する。
function resolveInitialJoinersWithFormula(
  input: SimulateInput,
  calcParams: CalcParameterConfig,
  engine?: FormulaEvaluationEngine,
): number {
  const fallback = resolveInitialJoiners(input, calcParams)
  if (!engine) return fallback
  try {
    const preContext = buildInitialPhaseContext(input, calcParams)
    const pre = engine.evaluatePhase("pre", preContext, { initialJoiners: fallback, demandMultiplier: 1 })
    return Number.isFinite(pre.initialJoiners) ? pre.initialJoiners : fallback
  } catch {
    return fallback
  }
}

// ────────────────────────────────────────────────────
// 月次の会員数・売上・費用（減価償却を除く）を算出する。
// 元Excel「事業計画」シートの移植（会員数成長＋平均単価×会員数＋費用積み上げ）。
// 減価償却は calculateSimulation 側で includeDepreciation に応じて加算する。
// ────────────────────────────────────────────────────
export function buildRegressionRows(
  scenario: ScenarioType,
  input: SimulateInput | undefined,
  calcParams: CalcParameterConfig,
  formulaSet?: FormulaSetRecordLike,
): RegressionMonthlyRow[] {
  const resolvedInput = input ?? BASE_REGRESSION_INPUT

  const averagePrice = computeAveragePrice(calcParams.pricing)
  const locationType = resolvedInput.locationType ?? "suburban"
  const floorArea = Number(resolvedInput.floorAreaTsubo) || BASE_FLOOR_AREA_TSUBO
  const capacity = computeCapacity(floorArea, locationType, calcParams.capacity)

  let engine: FormulaEvaluationEngine | undefined
  if (formulaSet) {
    try {
      engine = new FormulaEvaluationEngine(formulaSet)
    } catch {
      engine = undefined
    }
  }

  const initialJoiners = resolveInitialJoinersWithFormula(resolvedInput, calcParams, engine)

  const growth = simulateMemberGrowth({
    initialJoiners,
    maxMembers: capacity.maxMembers,
    months: PROJECTION_MONTHS,
    retention: calcParams.retention,
    acquisition: calcParams.acquisition,
    signage: calcParams.signage[scenario],
  })

  const royaltyRate = Math.max(0, resolveFranchiseRate(resolvedInput)) / 100
  const monthlyRent = resolveMonthlyRent(resolvedInput)
  // ランニングコストにマシンメンテナンス費（入力欄 B34）を内包する。
  // 手入力（固定枠）があればそれを優先、無ければパラメータから自動算出する。
  const machineMaintenance = resolveMachineMaintenance(resolvedInput, calcParams, floorArea, royaltyRate)
  const monthlyRunning = resolveMonthlyRunning(resolvedInput) + machineMaintenance
  const fixedCost = monthlyRent + monthlyRunning

  return growth.map((g) => {
    const members = Math.round(g.members)
    // 売上は会員数を ROUNDDOWN(,1) した値 × 平均単価（事業計画 D27 = C4 × ROUNDDOWN(D31,1)）
    const revenue = Math.round(averagePrice * roundDown1(g.members))
    const adCost = getMonthlyAdCost(g.month, calcParams)

    const defaultPaymentFee = getPaymentFee(revenue, calcParams)
    const defaultRoyalty = Math.min(Math.round(revenue * royaltyRate), calcParams.royaltyCapMonthly)
    const defaultAppFee = defaultRoyalty > 0 ? calcParams.appFeeMonthly : 0
    const defaultCost = fixedCost + adCost + defaultPaymentFee + defaultRoyalty + defaultAppFee

    let cost = defaultCost

    if (engine) {
      try {
        const context = buildFormulaContext({
          input: resolvedInput,
          calcParams,
          derived: buildMonthlyDerivedContext(g.month, revenue, members, monthlyRent, monthlyRunning, adCost),
          initialPhase: { initialJoiners, demandMultiplier: 1 },
        })
        const results = engine.evaluatePhase("monthly", context, {
          paymentFee: defaultPaymentFee,
          monthlyRoyalty: defaultRoyalty,
          appFee: defaultAppFee,
          monthlyCost: defaultCost,
        })
        const paymentFee = Number.isFinite(results.paymentFee) ? results.paymentFee : defaultPaymentFee
        const royalty = Number.isFinite(results.monthlyRoyalty) ? results.monthlyRoyalty : defaultRoyalty
        const appFee = Number.isFinite(results.appFee) ? results.appFee : defaultAppFee
        cost = Number.isFinite(results.monthlyCost)
          ? results.monthlyCost
          : fixedCost + adCost + paymentFee + royalty + appFee
      } catch {
        cost = defaultCost
      }
    }

    return {
      month: g.month,
      members,
      revenue,
      cost,
      profit: revenue - cost,
    }
  })
}

function estimatePaybackMonths(rows: RegressionMonthlyRow[], initialInvestment: number): number {
  let cumulativeProfit = -initialInvestment
  for (const row of rows) {
    cumulativeProfit += row.profit
    if (cumulativeProfit >= 0) return row.month
  }
  return 999
}

function buildMonthlyProjection(rows: RegressionMonthlyRow[], initialInvestment: number, cashLagMonths: number) {
  const lag = Math.max(0, Math.round(cashLagMonths))
  let cumulativeProfit = -initialInvestment
  let cumulativeCash = -initialInvestment
  return rows.map((row, index) => {
    cumulativeProfit += row.profit
    // 入金サイクル: 売上は lag ヶ月後に入金（費用は当月）。
    const laggedRevenue = index - lag >= 0 ? rows[index - lag].revenue : 0
    cumulativeCash += laggedRevenue - row.cost
    return {
      month: row.month,
      members: row.members,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
      cumulativeProfit,
      cumulativeCash,
    }
  })
}

function buildAnnualProjection(rows: RegressionMonthlyRow[], initialInvestment: number, taxRate: number) {
  const annual: NonNullable<SimulationResult["annualProjection"]> = []
  let cumulativePretax = 0
  let prevRevenue: number | undefined

  for (let year = 1; year <= 10; year += 1) {
    const slice = rows.slice((year - 1) * 12, year * 12)
    if (slice.length === 0) break

    const revenue = slice.reduce((sum, row) => sum + row.revenue, 0)
    const cost = slice.reduce((sum, row) => sum + row.cost, 0)
    const pretaxProfit = revenue - cost
    cumulativePretax += pretaxProfit
    const afterTaxProfit = pretaxProfit > 0 ? Math.round(pretaxProfit * (1 - taxRate)) : pretaxProfit

    annual.push({
      year,
      yearEndMembers: slice[slice.length - 1].members,
      revenue,
      cost,
      pretaxProfit,
      afterTaxProfit,
      revenueGrowthRate: prevRevenue && prevRevenue > 0 ? revenue / prevRevenue : undefined,
      paybackRatio: initialInvestment > 0 ? cumulativePretax / initialInvestment : 0,
    })
    prevRevenue = revenue
  }

  return annual
}

export function calculateSimulation(
  input: SimulateInput,
  calcParams: CalcParameterConfig,
  options?: { formulaSet?: FormulaSetRecordLike },
): SimulationResult {
  const scenario = input.scenario ?? "standard"
  // フォームから投資総額(initialInvestmentTotal)と内訳が来ている場合、フィットネスマシン費は
  // 既に総額へ内包済みのため、住所差分(machineDelta)を二重加算しない（フォームの内訳値を正とする）。
  // 総額未指定（既定値）の場合のみ、住所差分で基準額を補正する。
  const hasFormInvestmentTotal =
    Number.isFinite(Number(input.initialInvestmentTotal)) && Number(input.initialInvestmentTotal) > 0
  const breakdownMachinesCost = Number(input.investmentBreakdown?.fitnessMachineCost)
  const machinesCost = Number.isFinite(breakdownMachinesCost) && breakdownMachinesCost >= 0
    ? Math.round(breakdownMachinesCost)
    : resolveFitnessMachineCostByAddress(input.prefecture ?? input.location)
  const machineDelta = hasFormInvestmentTotal ? 0 : machinesCost - FITNESS_MACHINE_BASE_COST
  const initialInvestment = Math.max(0, resolveInitialInvestment(input) + machineDelta)
  const monthlyRent = resolveMonthlyRent(input)
  const franchiseRate = resolveFranchiseRate(input)
  const royaltyRate = Math.max(0, franchiseRate) / 100
  const includeDepreciation = input.includeDepreciation !== false

  const averagePrice = computeAveragePrice(calcParams.pricing)
  const locationType = input.locationType ?? "suburban"
  const floorArea = Number(input.floorAreaTsubo) || BASE_FLOOR_AREA_TSUBO
  const capacityResult = computeCapacity(floorArea, locationType, calcParams.capacity)

  // マシンメンテナンス費（入力欄 B34）をランニングコストに内包する。
  // 手入力（固定枠）があればそれを優先、無ければパラメータから自動算出する。
  const monthlyMachineMaintenance = resolveMachineMaintenance(input, calcParams, floorArea, royaltyRate)
  const monthlyRunningCost = resolveMonthlyRunning(input) + monthlyMachineMaintenance

  const baseRows = buildRegressionRows(scenario, { ...input, franchiseRate }, calcParams, options?.formulaSet)
  const monthlyDepreciation = includeDepreciation
    ? Math.round(computeMonthlyDepreciation(input.investmentBreakdown, calcParams.depreciation, input.depreciationYearsByField))
    : 0
  const rows: RegressionMonthlyRow[] = baseRows.map((row) => ({
    ...row,
    cost: row.cost + monthlyDepreciation,
    profit: row.revenue - (row.cost + monthlyDepreciation),
  }))

  const monthlyProjection = buildMonthlyProjection(rows, initialInvestment, calcParams.cashCollectionLagMonths)
  const annualProjection = buildAnnualProjection(rows, initialInvestment, calcParams.corporateTaxRate)
  const year1Last = monthlyProjection[11]

  const monthlyRevenue = year1Last?.revenue ?? 0
  const monthlyProfit = year1Last?.profit ?? 0
  const projectedMembers = Math.max(0, year1Last?.members ?? 0)
  const monthlyRoyalty = Math.min(Math.round(monthlyRevenue * royaltyRate), calcParams.royaltyCapMonthly)
  const monthlyAppFee = monthlyRoyalty > 0 ? calcParams.appFeeMonthly : 0

  // 損益分岐会員数（限界利益ベース。事業計画 D4 = O60/L4 = 固定費 / 限界利益単価）
  const memberFee = calcParams.pricing.memberFeeExTax
  // 変動費/人（事業計画!L5）= 決済手数料 + ロイヤリティ + アプリ利用料 + サプリ原価
  const variableCostPerMember = computeVariableCostPerMember(
    averagePrice,
    royaltyRate,
    calcParams.paymentFeeRate,
    calcParams.pricing,
  )
  const contributionMargin = averagePrice - variableCostPerMember
  const fixedCostForBreakeven = monthlyRent + monthlyRunningCost
  const breakevenMembers = contributionMargin > 0 ? Math.round(fixedCostForBreakeven / contributionMargin) : undefined
  const simpleBreakevenMembers = memberFee > 0 ? Math.ceil(fixedCostForBreakeven / memberFee) : undefined

  // 最低単価/人（月）= 変動費/人 + 固定費 ÷ 最大会員数。
  // キャパシティまで会員を埋めた場合に固定費を回収できる1人あたり月額売上の下限。
  // ※結果画面では限界利益を表示する方針のため、最低単価の算出はコメントアウトで残置（削除はしない）。
  // const maxMembers = Math.round(capacityResult.maxMembers)
  // const minimumUnitPrice = maxMembers > 0
  //   ? Math.round(variableCostPerMember + fixedCostForBreakeven / maxMembers)
  //   : undefined

  // 損益分岐点の4パターン（事業計画 I6-I9）。
  // 広告費=年1の定常月額(O66=12ヶ月目)、減価償却=資産別月額(O72)。減価償却計上の有無に関わらず常に算出。
  const adCostForBreakeven = getMonthlyAdCost(12, calcParams)
  const depreciationForBreakeven = Math.round(computeMonthlyDepreciation(input.investmentBreakdown, calcParams.depreciation, input.depreciationYearsByField))
  const breakevenVariants = contributionMargin > 0
    ? {
        fixedOnly: Math.round(fixedCostForBreakeven / contributionMargin),
        withAdCost: Math.round((fixedCostForBreakeven + adCostForBreakeven) / contributionMargin),
        withDepreciation: Math.round((fixedCostForBreakeven + depreciationForBreakeven) / contributionMargin),
        withAdCostAndDepreciation: Math.round((fixedCostForBreakeven + adCostForBreakeven + depreciationForBreakeven) / contributionMargin),
      }
    : undefined

  const interiorCostInput = Number(input.investmentBreakdown?.interiorCost)
  const interiorCost = Number.isFinite(interiorCostInput) && interiorCostInput >= 0
    ? Math.round(interiorCostInput)
    : INTERIOR_COST

  return {
    id: `calc-${Date.now()}`,
    storeName: input.storeName.trim() || "試算結果",
    location: input.location,
    locationType: input.locationType ?? "suburban",
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy?.trim() || "API",
    scenario,
    franchiseRate,
    totalInitialInvestment: initialInvestment,
    machinesCost,
    interiorCost,
    franchiseInitialCost: 0,
    otherInitialCost: Math.max(0, initialInvestment - (machinesCost + interiorCost)),
    investmentBreakdown: input.investmentBreakdown,
    monthlyRevenue,
    monthlyRent,
    monthlyRunningCost,
    monthlyMachineMaintenance,
    monthlyFranchiseCost: monthlyRoyalty + monthlyAppFee,
    monthlyProfit,
    paybackMonths: estimatePaybackMonths(rows, initialInvestment),
    breakevenMembers,
    simpleBreakevenMembers,
    breakevenVariants,
    formulaSetVersion: options?.formulaSet?.setVersion,
    averagePrice,
    variableCostPerMember: Math.round(variableCostPerMember),
    contributionMarginPerMember: Math.round(contributionMargin),
    // minimumUnitPrice,  // 最低単価は非表示方針のためコメントアウト（算出ロジックも上部で残置）
    capacity: {
      maxMembers: Math.round(capacityResult.maxMembers),
      concurrentUsers: Math.round(capacityResult.concurrentUsers),
      parkingSpaces: capacityResult.parkingSpaces,
    },
    annualProjection,
    cashCollectionLagMonths: calcParams.cashCollectionLagMonths,
    monthlyProjection,
    ltv: calculateLtv({
      monthlyFee: calcParams.pricing.memberFeeExTax,
      firstMonthRetention: calcParams.retention.firstMonth,
      subsequentRetention: calcParams.retention.subsequent,
    }),
  }
}
