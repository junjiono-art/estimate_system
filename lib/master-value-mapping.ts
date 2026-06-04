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
  // マスタに登録された費目のみを対象とする。既知コードは固定フィールドIDへ、
  // 未知コード（マスタで新規追加した費目）は code をそのままキーとして扱う。
  runningByField: Record<string, number>
  investmentByField: Record<string, number>
  totalRunningCost: number
  totalInvestmentCost: number
  visibleRunningFieldIds: string[]
  visibleInvestmentFieldIds: string[]
}

/** 試算フォームの1費目分の表示・入力モデル */
export type MasterFormItem = {
  /** 入力値・計算で使う安定キー。既知コードは固定フィールドID、未知コードは code 自体 */
  fieldId: string
  code: string
  /** マスタで設定した費目名（試算画面の項目名として表示） */
  label: string
  /** マスタで設定した単位（例: "円/月", "円"） */
  unit: string
  /** ロイヤリティ率を反映した初期金額 */
  amount: number
}

export type MasterFormModel = {
  running: MasterFormItem[]
  investment: MasterFormItem[]
}

const RUNNING_FIELD_ORDER: string[] = Object.values(RUNNING_COST_CODE_TO_FIELD_ID)
const INVESTMENT_FIELD_ORDER: string[] = Object.values(INVESTMENT_COST_CODE_TO_FIELD_ID)

/** 既知の費目を従来の並び順に保ちつつ、未知の費目を末尾へ寄せる */
function sortByKnownOrder(items: MasterFormItem[], order: string[]): MasterFormItem[] {
  return [...items].sort((a, b) => {
    const ia = order.indexOf(a.fieldId)
    const ib = order.indexOf(b.fieldId)
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib)
  })
}

/**
 * マスタ値から試算フォームの表示モデル（label/unit/金額/並び順）を生成する。
 * 試算画面の項目名・項目構成をマスタ完全駆動にするためのエントリポイント。
 */
export function resolveMasterFormModel(values: MasterValue[], royaltyRate: RoyaltyRate): MasterFormModel {
  const running: MasterFormItem[] = []
  const investment: MasterFormItem[] = []

  values.forEach((value) => {
    if (!value.code) return
    const amount = resolveMasterValueAmount(value, royaltyRate)
    if (value.category === "ランニングコスト") {
      const fieldId = RUNNING_COST_CODE_TO_FIELD_ID[value.code as keyof typeof RUNNING_COST_CODE_TO_FIELD_ID] ?? value.code
      running.push({ fieldId, code: value.code, label: value.label, unit: value.unit, amount })
      return
    }
    if (value.category === "投資コスト") {
      const fieldId = INVESTMENT_COST_CODE_TO_FIELD_ID[value.code as keyof typeof INVESTMENT_COST_CODE_TO_FIELD_ID] ?? value.code
      investment.push({ fieldId, code: value.code, label: value.label, unit: value.unit, amount })
    }
  })

  return {
    running: sortByKnownOrder(running, RUNNING_FIELD_ORDER),
    investment: sortByKnownOrder(investment, INVESTMENT_FIELD_ORDER),
  }
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
  const runningByField: Record<string, number> = {}
  const investmentByField: Record<string, number> = {}
  const visibleRunningFieldIds: string[] = []
  const visibleInvestmentFieldIds: string[] = []

  values.forEach((value) => {
    if (!value.code) return
    const amount = resolveMasterValueAmount(value, royaltyRate)
    if (value.category === "ランニングコスト") {
      const fieldId = RUNNING_COST_CODE_TO_FIELD_ID[value.code as keyof typeof RUNNING_COST_CODE_TO_FIELD_ID] ?? value.code
      runningByField[fieldId] = amount
      visibleRunningFieldIds.push(fieldId)
      return
    }

    if (value.category === "投資コスト") {
      const fieldId = INVESTMENT_COST_CODE_TO_FIELD_ID[value.code as keyof typeof INVESTMENT_COST_CODE_TO_FIELD_ID] ?? value.code
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
