import type { ScenarioType, SimulationResult } from "@/lib/types"

export type SimulateInput = {
  storeName: string
  location?: string
  scenario?: ScenarioType
  createdBy?: string
}

type MonthlySeed = {
  month: number
  members: number
  revenue: number
  cost: number
  profit: number
}

type AnnualSeed = {
  year: number
  yearEndMembers: number
  annualRevenue: number
  annualCost: number
}

export type RegressionMonthlyRow = {
  month: number
  members: number
  revenue: number
  cost: number
  profit: number
}

const INITIAL_INVESTMENT = 23_110_000
const DEFAULT_BREAKEVEN_MEMBERS = 374
const DEFAULT_MONTHLY_RENT = 900_000
const DEFAULT_MONTHLY_RUNNING = 308_000

const MONTHLY_SEEDS: Record<ScenarioType, MonthlySeed[]> = {
  conservative: [
    { month: 1, members: 210, revenue: 702_785, cost: 1_752_597, profit: -1_049_813 },
    { month: 2, members: 274, revenue: 916_530, cost: 1_520_079, profit: -603_549 },
    { month: 3, members: 323, revenue: 1_081_773, cost: 1_485_862, profit: -404_089 },
    { month: 4, members: 363, revenue: 1_214_904, cost: 1_490_522, profit: -275_618 },
    { month: 5, members: 400, revenue: 1_337_666, cost: 1_434_818, profit: -97_153 },
    { month: 6, members: 434, revenue: 1_450_727, cost: 1_438_775, profit: 11_951 },
    { month: 7, members: 465, revenue: 1_554_087, cost: 1_442_393, profit: 111_694 },
    { month: 8, members: 493, revenue: 1_647_747, cost: 1_445_671, profit: 202_076 },
    { month: 9, members: 518, revenue: 1_732_376, cost: 1_448_633, profit: 283_742 },
    { month: 10, members: 541, revenue: 1_807_973, cost: 1_451_279, profit: 356_693 },
    { month: 11, members: 561, revenue: 1_875_207, cost: 1_453_632, profit: 421_575 },
    { month: 12, members: 578, revenue: 1_934_748, cost: 1_455_716, profit: 479_032 },
  ],
  standard: [
    { month: 1, members: 304, revenue: 1_015_542, cost: 1_763_544, profit: -748_002 },
    { month: 2, members: 393, revenue: 1_314_251, cost: 1_533_999, profit: -219_748 },
    { month: 3, members: 456, revenue: 1_525_320, cost: 1_501_386, profit: 23_934 },
    { month: 4, members: 498, revenue: 1_664_807, cost: 1_506_268, profit: 158_538 },
    { month: 5, members: 534, revenue: 1_784_892, cost: 1_450_471, profit: 334_421 },
    { month: 6, members: 565, revenue: 1_889_925, cost: 1_454_147, profit: 435_778 },
    { month: 7, members: 592, revenue: 1_980_909, cost: 1_457_332, profit: 523_577 },
    { month: 8, members: 615, revenue: 2_058_513, cost: 1_460_048, profit: 598_465 },
    { month: 9, members: 635, revenue: 2_124_410, cost: 1_462_354, profit: 662_055 },
    { month: 10, members: 652, revenue: 2_179_602, cost: 1_464_286, profit: 715_316 },
    { month: 11, members: 665, revenue: 2_225_429, cost: 1_465_890, profit: 759_539 },
    { month: 12, members: 677, revenue: 2_263_227, cost: 1_467_213, profit: 796_014 },
  ],
  aggressive: [
    { month: 1, members: 374, revenue: 1_250_027, cost: 1_771_751, profit: -521_724 },
    { month: 2, members: 539, revenue: 1_803_624, cost: 1_551_127, profit: 252_497 },
    { month: 3, members: 609, revenue: 2_037_774, cost: 1_519_322, profit: 518_452 },
    { month: 4, members: 644, revenue: 2_155_518, cost: 1_523_443, profit: 632_075 },
    { month: 5, members: 672, revenue: 2_248_509, cost: 1_466_698, profit: 781_811 },
    { month: 6, members: 695, revenue: 2_324_106, cost: 1_469_344, profit: 854_762 },
    { month: 7, members: 713, revenue: 2_384_651, cost: 1_471_463, profit: 913_188 },
    { month: 8, members: 725, revenue: 2_425_125, cost: 1_472_879, profit: 952_246 },
    { month: 9, members: 725, revenue: 2_425_125, cost: 1_472_879, profit: 952_246 },
    { month: 10, members: 725, revenue: 2_425_125, cost: 1_472_879, profit: 952_246 },
    { month: 11, members: 725, revenue: 2_425_125, cost: 1_472_879, profit: 952_246 },
    { month: 12, members: 725, revenue: 2_425_125, cost: 1_472_879, profit: 952_246 },
  ],
}

const ANNUAL_SEEDS: Record<ScenarioType, AnnualSeed[]> = {
  conservative: [
    { year: 1, yearEndMembers: 578, annualRevenue: 17_256_521, annualCost: 17_819_978 },
    { year: 2, yearEndMembers: 583, annualRevenue: 23_362_484, annualCost: 16_753_687 },
    { year: 3, yearEndMembers: 585, annualRevenue: 23_445_440, annualCost: 17_476_590 },
    { year: 4, yearEndMembers: 585, annualRevenue: 23_467_182, annualCost: 16_757_351 },
    { year: 5, yearEndMembers: 585, annualRevenue: 23_472_869, annualCost: 16_757_550 },
    { year: 6, yearEndMembers: 558, annualRevenue: 22_779_450, annualCost: 16_733_281 },
    { year: 7, yearEndMembers: 550, annualRevenue: 22_198_424, annualCost: 16_712_945 },
    { year: 8, yearEndMembers: 548, annualRevenue: 22_034_853, annualCost: 16_707_220 },
    { year: 9, yearEndMembers: 548, annualRevenue: 21_987_354, annualCost: 17_425_557 },
    { year: 10, yearEndMembers: 547, annualRevenue: 21_973_974, annualCost: 16_705_089 },
  ],
  standard: [
    { year: 1, yearEndMembers: 677, annualRevenue: 22_026_825, annualCost: 17_986_939 },
    { year: 2, yearEndMembers: 691, annualRevenue: 27_542_396, annualCost: 17_619_984 },
    { year: 3, yearEndMembers: 693, annualRevenue: 27_791_264, annualCost: 16_908_694 },
    { year: 4, yearEndMembers: 694, annualRevenue: 27_839_432, annualCost: 16_910_380 },
    { year: 5, yearEndMembers: 694, annualRevenue: 27_848_798, annualCost: 16_910_708 },
    { year: 6, yearEndMembers: 670, annualRevenue: 27_201_875, annualCost: 16_888_066 },
    { year: 7, yearEndMembers: 665, annualRevenue: 26_742_941, annualCost: 16_872_003 },
    { year: 8, yearEndMembers: 664, annualRevenue: 26_647_943, annualCost: 16_868_678 },
    { year: 9, yearEndMembers: 663, annualRevenue: 26_627_873, annualCost: 16_867_976 },
    { year: 10, yearEndMembers: 663, annualRevenue: 26_624_862, annualCost: 17_587_870 },
  ],
  aggressive: [
    { year: 1, yearEndMembers: 725, annualRevenue: 26_329_833, annualCost: 18_137_544 },
    { year: 2, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 17_674_553 },
    { year: 3, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 16_954_553 },
    { year: 4, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 16_954_553 },
    { year: 5, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 16_954_553 },
    { year: 6, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 16_954_553 },
    { year: 7, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 16_954_553 },
    { year: 8, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 16_954_553 },
    { year: 9, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 16_954_553 },
    { year: 10, yearEndMembers: 725, annualRevenue: 29_101_500, annualCost: 16_954_553 },
  ],
}

function distributeToMonths(total: number): number[] {
  const base = Math.trunc(total / 12)
  const remainder = total - base * 12
  return Array.from({ length: 12 }, (_, index) => {
    if (remainder > 0) return index < remainder ? base + 1 : base
    if (remainder < 0) return index < Math.abs(remainder) ? base - 1 : base
    return base
  })
}

function buildMemberSeries(start: number, end: number): number[] {
  const members = Array.from({ length: 12 }, (_, index) => {
    const progress = (index + 1) / 12
    return Math.round(start + (end - start) * progress)
  })
  members[11] = end
  return members
}

export function buildRegressionRows(scenario: ScenarioType): RegressionMonthlyRow[] {
  const year1 = MONTHLY_SEEDS[scenario].map((row) => ({ ...row }))
  const annualSeeds = ANNUAL_SEEDS[scenario]
  const rows: RegressionMonthlyRow[] = [...year1]

  let monthCursor = 12
  let previousYearEndMembers = year1[11]?.members ?? annualSeeds[0]?.yearEndMembers ?? 0

  for (const year of annualSeeds) {
    if (year.year === 1) {
      previousYearEndMembers = year.yearEndMembers
      continue
    }

    const members = buildMemberSeries(previousYearEndMembers, year.yearEndMembers)
    const monthlyRevenue = distributeToMonths(year.annualRevenue)
    const monthlyCost = distributeToMonths(year.annualCost)

    for (let i = 0; i < 12; i += 1) {
      monthCursor += 1
      const revenue = monthlyRevenue[i]
      const cost = monthlyCost[i]
      rows.push({
        month: monthCursor,
        members: members[i],
        revenue,
        cost,
        profit: revenue - cost,
      })
    }

    previousYearEndMembers = year.yearEndMembers
  }

  return rows
}

function estimatePaybackMonths(rows: RegressionMonthlyRow[]): number {
  let cumulativeProfit = -INITIAL_INVESTMENT
  for (const row of rows) {
    cumulativeProfit += row.profit
    if (cumulativeProfit >= 0) return row.month
  }
  return 999
}

function buildMonthlyProjection(rows: RegressionMonthlyRow[]) {
  let cumulativeProfit = -INITIAL_INVESTMENT
  return rows.map((row) => {
    cumulativeProfit += row.profit
    return {
      month: row.month,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
      cumulativeProfit,
    }
  })
}

export function calculateSimulation(input: SimulateInput): SimulationResult {
  const scenario = input.scenario ?? "standard"
  const rows = buildRegressionRows(scenario)
  const monthlyProjection = buildMonthlyProjection(rows)
  const year1Last = monthlyProjection[11]

  const monthlyRevenue = year1Last?.revenue ?? 0
  const monthlyCost = year1Last?.cost ?? 0
  const monthlyProfit = year1Last?.profit ?? 0

  return {
    id: `calc-${Date.now()}`,
    storeName: input.storeName.trim() || "試算結果",
    location: input.location,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy?.trim() || "API",
    scenario,
    franchiseRate: 0,
    totalInitialInvestment: INITIAL_INVESTMENT,
    machinesCost: 3_750_000,
    interiorCost: 15_000_000,
    franchiseInitialCost: 0,
    otherInitialCost: 4_360_000,
    monthlyRevenue,
    monthlyRent: DEFAULT_MONTHLY_RENT,
    monthlyRunningCost: DEFAULT_MONTHLY_RUNNING,
    monthlyFranchiseCost: 0,
    monthlyProfit,
    paybackMonths: estimatePaybackMonths(rows),
    breakevenMembers: DEFAULT_BREAKEVEN_MEMBERS,
    monthlyProjection,
  }
}
