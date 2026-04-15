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
  cumulativePretaxProfit: number
  annualPretaxProfit: number
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
    { year: 1, cumulativePretaxProfit: -563_458, annualPretaxProfit: -563_458 },
    { year: 2, cumulativePretaxProfit: 6_045_339, annualPretaxProfit: 6_608_797 },
    { year: 3, cumulativePretaxProfit: 12_014_188, annualPretaxProfit: 5_968_849 },
    { year: 4, cumulativePretaxProfit: 18_724_019, annualPretaxProfit: 6_709_831 },
    { year: 5, cumulativePretaxProfit: 25_439_337, annualPretaxProfit: 6_715_318 },
  ],
  standard: [
    { year: 1, cumulativePretaxProfit: 4_039_886, annualPretaxProfit: 4_039_886 },
    { year: 2, cumulativePretaxProfit: 13_962_298, annualPretaxProfit: 9_922_412 },
    { year: 3, cumulativePretaxProfit: 24_844_867, annualPretaxProfit: 10_882_569 },
  ],
  aggressive: [
    { year: 1, cumulativePretaxProfit: 8_192_289, annualPretaxProfit: 8_192_289 },
    { year: 2, cumulativePretaxProfit: 19_619_236, annualPretaxProfit: 11_426_948 },
    { year: 3, cumulativePretaxProfit: 31_766_184, annualPretaxProfit: 12_146_948 },
  ],
}

function estimatePaybackMonths(scenario: ScenarioType): number {
  const seeds = ANNUAL_SEEDS[scenario]
  if (seeds.length === 0) return 999

  let previousCumulative = 0
  for (const seed of seeds) {
    if (seed.cumulativePretaxProfit >= INITIAL_INVESTMENT) {
      const remaining = INITIAL_INVESTMENT - previousCumulative
      const monthlyProfit = seed.annualPretaxProfit / 12
      if (monthlyProfit <= 0) return 999
      const offset = Math.ceil(remaining / monthlyProfit)
      return (seed.year - 1) * 12 + offset
    }
    previousCumulative = seed.cumulativePretaxProfit
  }

  return 999
}

function buildMonthlyProjection(scenario: ScenarioType) {
  let cumulativeProfit = -INITIAL_INVESTMENT
  return MONTHLY_SEEDS[scenario].map((seed) => {
    cumulativeProfit += seed.profit
    return {
      month: seed.month,
      revenue: seed.revenue,
      cost: seed.cost,
      profit: seed.profit,
      cumulativeProfit,
    }
  })
}

export function calculateSimulation(input: SimulateInput): SimulationResult {
  const scenario = input.scenario ?? "standard"
  const monthlyProjection = buildMonthlyProjection(scenario)
  const last = monthlyProjection[monthlyProjection.length - 1]

  const monthlyRevenue = last?.revenue ?? 0
  const monthlyCost = last?.cost ?? 0
  const monthlyProfit = last?.profit ?? 0

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
    paybackMonths: estimatePaybackMonths(scenario),
    breakevenMembers: DEFAULT_BREAKEVEN_MEMBERS,
    monthlyProjection,
  }
}
