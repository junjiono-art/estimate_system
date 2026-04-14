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

export function normalizeMasterCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_")
}
