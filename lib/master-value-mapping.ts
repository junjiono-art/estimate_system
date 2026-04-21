export const RUNNING_COST_CODE_TO_FIELD_ID = {
  running_electricity: "rcElectricity",
  running_water: "rcWater",
  running_staff: "rcStaff",
  running_cleaning: "rcCleaning",
  running_communication: "rcCommunication",
  running_supplies: "rcSupplies",
  running_insurance: "rcInsurance",
  running_advertising: "rcAdvertising",
  running_other: "rcOther",
} as const

import type { MasterValue, MasterValueRoyaltyMode } from "@/lib/types"

export const INVESTMENT_COST_CODE_TO_FIELD_ID = {
  investment_fitness_machine: "fitnessMachineCost",
  investment_interior: "interiorCost",
  investment_flapper_gate: "flapperGateCost",
  investment_body_composition: "bodyCompositionCost",
  investment_water_server: "waterServerCost",
  investment_franchise_fee: "franchiseFeeCost",
  investment_system: "systemCost",
  investment_opening_prep: "openingPrepCost",
  investment_opening_package: "openingPackageCost",
  investment_security: "securityCost",
  investment_other: "otherInitialCost",
} as const

export type RunningCostFieldId = (typeof RUNNING_COST_CODE_TO_FIELD_ID)[keyof typeof RUNNING_COST_CODE_TO_FIELD_ID]
export type InvestmentCostFieldId = (typeof INVESTMENT_COST_CODE_TO_FIELD_ID)[keyof typeof INVESTMENT_COST_CODE_TO_FIELD_ID]

export type RoyaltyRate = 0 | 10 | 15

export type ResolvedMasterValues = {
  runningByField: Partial<Record<RunningCostFieldId, number>>
  investmentByField: Partial<Record<InvestmentCostFieldId, number>>
  totalRunningCost: number
  totalInvestmentCost: number
  visibleRunningFieldIds: RunningCostFieldId[]
  visibleInvestmentFieldIds: InvestmentCostFieldId[]
}

function normalizeRoyaltyMode(value?: MasterValueRoyaltyMode): MasterValueRoyaltyMode {
  return value === "rate" ? "rate" : "binary"
}

export function resolveMasterValueAmount(value: MasterValue, royaltyRate: RoyaltyRate): number {
  if (value.code === "investment_fitness_machine") {
    // マシン費はロイヤリティに依存させず、単価（currentAmount優先）を採用する。
    return Math.max(0, Number(value.currentAmount) || Number(value.defaultAmount) || 0)
  }

  const fallbackAmount = Math.max(0, Number(value.defaultAmount) || 0)

  if (!value.royaltyRuleEnabled) return fallbackAmount

  const amountWithoutRoyalty = Math.max(0, Number(value.amountWithoutRoyalty) || 0)
  if (royaltyRate === 0) return amountWithoutRoyalty

  const mode = normalizeRoyaltyMode(value.royaltyRuleMode)
  if (mode === "rate") {
    if (royaltyRate === 15) {
      return Math.max(0, Number(value.amountWithRoyalty15) || 0)
    }
    return Math.max(0, Number(value.amountWithRoyalty10) || 0)
  }

  return Math.max(0, Number(value.amountWithRoyalty) || 0)
}

export function resolveMasterFieldValues(values: MasterValue[], royaltyRate: RoyaltyRate): ResolvedMasterValues {
  const runningByField: Partial<Record<RunningCostFieldId, number>> = {}
  const investmentByField: Partial<Record<InvestmentCostFieldId, number>> = {}
  const visibleRunningFieldIds: RunningCostFieldId[] = []
  const visibleInvestmentFieldIds: InvestmentCostFieldId[] = []

  values.forEach((value) => {
    const amount = resolveMasterValueAmount(value, royaltyRate)
    if (value.category === "ランニングコスト") {
      const fieldId = RUNNING_COST_CODE_TO_FIELD_ID[value.code as keyof typeof RUNNING_COST_CODE_TO_FIELD_ID]
      if (!fieldId) return
      runningByField[fieldId] = amount
      visibleRunningFieldIds.push(fieldId)
      return
    }

    if (value.category === "投資コスト") {
      const fieldId = INVESTMENT_COST_CODE_TO_FIELD_ID[value.code as keyof typeof INVESTMENT_COST_CODE_TO_FIELD_ID]
      if (!fieldId) return
      investmentByField[fieldId] = amount
      visibleInvestmentFieldIds.push(fieldId)
    }
  })

  const totalRunningCost = Object.values(runningByField).reduce((acc, amount) => acc + (amount ?? 0), 0)
  const totalInvestmentCost = Object.values(investmentByField).reduce((acc, amount) => acc + (amount ?? 0), 0)

  return {
    runningByField,
    investmentByField,
    totalRunningCost,
    totalInvestmentCost,
    visibleRunningFieldIds,
    visibleInvestmentFieldIds,
  }
}

export function normalizeMasterCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")
}
