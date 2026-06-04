import type { AreaDemographics, LocationType, ScenarioType, SimulationRequestInput, SimulationResult } from "@/lib/types"

export type HistoryApiResult = {
  resultId?: string
  createdAt?: number
  storeName?: string
  username?: string
  scenario?: ScenarioType
  input?: {
    storeName?: string
    location?: string
    prefecture?: string
    city?: string
    // 再計算復元用の拡張フィールド（旧履歴データには含まれない場合あり）
    floorAreaTsubo?: number
    rentPerTsubo?: number
    competitorCount?: number
    locationType?: LocationType
    royaltyRate?: 0 | 10 | 15
    franchiseRate?: 0 | 10 | 15
    runningCostTotal?: number
    initialInvestmentTotal?: number
    initialInvestmentByRoyaltyRate?: Partial<Record<"0" | "10" | "15", number>>
    investmentBreakdown?: Record<string, number>
    populationByRadius?: {
      km1Ring: number
      km3Ring: number
      km5Ring: number
    }
    includeDepreciation?: boolean
  }
  result?: {
    totalInitialInvestment?: number
    machinesCost?: number
    interiorCost?: number
    franchiseInitialCost?: number
    otherInitialCost?: number
    monthlyRevenue?: number
    monthlyRent?: number
    monthlyRunningCost?: number
    monthlyFranchiseCost?: number
    monthlyProfit?: number
    paybackMonths?: number
    breakevenMembers?: number
    breakevenVariants?: {
      fixedOnly?: number
      withAdCost?: number
      withDepreciation?: number
      withAdCostAndDepreciation?: number
    }
    averagePrice?: number
    variableCostPerMember?: number
    contributionMarginPerMember?: number
    minimumUnitPrice?: number
    capacity?: { maxMembers?: number; concurrentUsers?: number; parkingSpaces?: number }
    annualProjection?: Array<{
      year?: number
      yearEndMembers?: number
      revenue?: number
      cost?: number
      pretaxProfit?: number
      afterTaxProfit?: number
      revenueGrowthRate?: number
      paybackRatio?: number
    }>
    cashCollectionLagMonths?: number
    monthlyProjection?: Array<{
      month?: number
      members?: number
      revenue?: number
      cost?: number
      profit?: number
      cumulativeProfit?: number
      cumulativeCash?: number
    }>
    demographics?: {
      municipality?: {
        prefecture?: string
        city?: string
        areaCode?: string
      }
      bySex?: {
        male?: number
        female?: number
        total?: number
      }
      byAgeGender?: Array<{
        ageGroup?: string
        male?: number
        female?: number
        total?: number
      }>
    }
  }
  rating?: number
}

function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function mapDemographics(value: unknown): AreaDemographics | undefined {
  if (!value || typeof value !== "object") return undefined

  const municipality = (value as { municipality?: unknown }).municipality
  const bySex = (value as { bySex?: unknown }).bySex
  const byAgeGender = (value as { byAgeGender?: unknown }).byAgeGender

  if (!municipality || typeof municipality !== "object") return undefined
  if (!bySex || typeof bySex !== "object") return undefined
  if (!Array.isArray(byAgeGender)) return undefined

  return {
    municipality: {
      prefecture: String((municipality as { prefecture?: unknown }).prefecture ?? ""),
      city: String((municipality as { city?: unknown }).city ?? ""),
      areaCode: String((municipality as { areaCode?: unknown }).areaCode ?? ""),
    },
    bySex: {
      male: toNumber((bySex as { male?: unknown }).male),
      female: toNumber((bySex as { female?: unknown }).female),
      total: toNumber((bySex as { total?: unknown }).total),
    },
    byAgeGender: byAgeGender.map((row) => ({
      ageGroup: String((row as { ageGroup?: unknown }).ageGroup ?? ""),
      male: toNumber((row as { male?: unknown }).male),
      female: toNumber((row as { female?: unknown }).female),
      total: toNumber((row as { total?: unknown }).total),
    })),
  }
}

export function mapHistoryItemToResult(item: HistoryApiResult): SimulationResult | null {
  if (!item.resultId || !item.storeName || !item.username || !item.scenario || !item.result) return null

  const createdAtEpoch = toNumber(item.createdAt)
  const createdAt = createdAtEpoch > 0 ? new Date(createdAtEpoch).toISOString() : new Date().toISOString()

  return {
    id: item.resultId,
    storeName: item.storeName,
    location: item.input?.location,
    createdAt,
    createdBy: item.username,
    scenario: item.scenario,
    totalInitialInvestment: toNumber(item.result.totalInitialInvestment),
    machinesCost: toNumber(item.result.machinesCost),
    interiorCost: toNumber(item.result.interiorCost),
    franchiseInitialCost: toNumber(item.result.franchiseInitialCost),
    otherInitialCost: toNumber(item.result.otherInitialCost),
    monthlyRevenue: toNumber(item.result.monthlyRevenue),
    monthlyRent: toNumber(item.result.monthlyRent),
    monthlyRunningCost: toNumber(item.result.monthlyRunningCost),
    monthlyFranchiseCost: toNumber(item.result.monthlyFranchiseCost),
    monthlyProfit: toNumber(item.result.monthlyProfit),
    paybackMonths: toNumber(item.result.paybackMonths),
    breakevenMembers: item.result.breakevenMembers != null ? toNumber(item.result.breakevenMembers) : undefined,
    breakevenVariants: item.result.breakevenVariants
      ? {
          fixedOnly: toNumber(item.result.breakevenVariants.fixedOnly),
          withAdCost: toNumber(item.result.breakevenVariants.withAdCost),
          withDepreciation: toNumber(item.result.breakevenVariants.withDepreciation),
          withAdCostAndDepreciation: toNumber(item.result.breakevenVariants.withAdCostAndDepreciation),
        }
      : undefined,
    rating: typeof item.rating === "number" ? item.rating : undefined,
    averagePrice: item.result.averagePrice != null ? toNumber(item.result.averagePrice) : undefined,
    variableCostPerMember: item.result.variableCostPerMember != null ? toNumber(item.result.variableCostPerMember) : undefined,
    contributionMarginPerMember: item.result.contributionMarginPerMember != null ? toNumber(item.result.contributionMarginPerMember) : undefined,
    minimumUnitPrice: item.result.minimumUnitPrice != null ? toNumber(item.result.minimumUnitPrice) : undefined,
    capacity: item.result.capacity
      ? {
          maxMembers: toNumber(item.result.capacity.maxMembers),
          concurrentUsers: toNumber(item.result.capacity.concurrentUsers),
          parkingSpaces: toNumber(item.result.capacity.parkingSpaces),
        }
      : undefined,
    annualProjection: Array.isArray(item.result.annualProjection)
      ? item.result.annualProjection.map((row, index) => ({
          year: toNumber(row.year) || index + 1,
          yearEndMembers: toNumber(row.yearEndMembers),
          revenue: toNumber(row.revenue),
          cost: toNumber(row.cost),
          pretaxProfit: toNumber(row.pretaxProfit),
          afterTaxProfit: toNumber(row.afterTaxProfit),
          revenueGrowthRate: row.revenueGrowthRate != null ? toNumber(row.revenueGrowthRate) : undefined,
          paybackRatio: toNumber(row.paybackRatio),
        }))
      : undefined,
    cashCollectionLagMonths:
      item.result.cashCollectionLagMonths != null ? toNumber(item.result.cashCollectionLagMonths) : undefined,
    demographics: mapDemographics(item.result.demographics),
    monthlyProjection: Array.isArray(item.result.monthlyProjection)
      ? item.result.monthlyProjection.map((row, index) => ({
          month: toNumber(row.month) || index + 1,
          members: row.members != null ? toNumber(row.members) : undefined,
          revenue: toNumber(row.revenue),
          cost: toNumber(row.cost),
          profit: toNumber(row.profit),
          cumulativeProfit: toNumber(row.cumulativeProfit),
          cumulativeCash: row.cumulativeCash != null ? toNumber(row.cumulativeCash) : undefined,
        }))
      : [],
  }
}

export function mapHistoryItemsToResults(items: unknown[]): SimulationResult[] {
  return items
    .map((item) => mapHistoryItemToResult(item as HistoryApiResult))
    .filter((item): item is SimulationResult => Boolean(item))
}

function isRoyaltyRate(value: unknown): value is 0 | 10 | 15 {
  return value === 0 || value === 10 || value === 15
}

// 履歴 raw データから再計算用の SimulationRequestInput を組み立てる
// 旧履歴データには input 拡張フィールドが含まれないため、SimulationResult の値で補完する
export function mapHistoryItemToSimulationRequest(
  item: HistoryApiResult,
  fallback: SimulationResult,
): SimulationRequestInput {
  const input = item.input ?? {}
  const rawRoyalty = input.royaltyRate ?? input.franchiseRate
  const royaltyRate: 0 | 10 | 15 = isRoyaltyRate(rawRoyalty)
    ? rawRoyalty
    : isRoyaltyRate(fallback.franchiseRate)
      ? fallback.franchiseRate
      : 0

  return {
    storeName: fallback.storeName,
    location: input.location ?? fallback.location,
    scenario: item.scenario ?? fallback.scenario,
    floorAreaTsubo: input.floorAreaTsubo,
    rentPerTsubo: input.rentPerTsubo,
    competitorCount: input.competitorCount,
    locationType: input.locationType ?? fallback.locationType,
    royaltyRate,
    franchiseRate: royaltyRate,
    runningCostTotal: input.runningCostTotal ?? fallback.monthlyRunningCost,
    initialInvestmentTotal: input.initialInvestmentTotal ?? fallback.totalInitialInvestment,
    initialInvestmentByRoyaltyRate: input.initialInvestmentByRoyaltyRate,
    investmentBreakdown: input.investmentBreakdown ?? fallback.investmentBreakdown,
    populationByRadius: input.populationByRadius,
    includeDepreciation: input.includeDepreciation ?? true,
  }
}