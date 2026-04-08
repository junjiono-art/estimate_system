import type { ScenarioType, SimulationResult } from "@/lib/types"

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
  }
  rating?: number
}

function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
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