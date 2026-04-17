import type { AreaDemographics, ScenarioType, SimulationResult } from "@/lib/types"

export type HistoryApiResult = {
  resultId?: string
  createdAt?: number
  storeName?: string
  username?: string
  scenario?: ScenarioType
  input?: {
    location?: string
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
    monthlyProjection?: Array<{
      month?: number
      revenue?: number
      cost?: number
      profit?: number
      cumulativeProfit?: number
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
    rating: typeof item.rating === "number" ? item.rating : undefined,
    demographics: mapDemographics(item.result.demographics),
    monthlyProjection: Array.isArray(item.result.monthlyProjection)
      ? item.result.monthlyProjection.map((row, index) => ({
          month: toNumber(row.month) || index + 1,
          revenue: toNumber(row.revenue),
          cost: toNumber(row.cost),
          profit: toNumber(row.profit),
          cumulativeProfit: toNumber(row.cumulativeProfit),
        }))
      : [],
  }
}

export function mapHistoryItemsToResults(items: unknown[]): SimulationResult[] {
  return items
    .map((item) => mapHistoryItemToResult(item as HistoryApiResult))
    .filter((item): item is SimulationResult => Boolean(item))
}