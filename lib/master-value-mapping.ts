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

import type { MasterValue, MasterValueQuantityBasis, MasterValueRoyaltyMode } from "@/lib/types"

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
  // ゴルフ設備（数量×単価・有効坪数を消費する投資費目）。
  investment_golf_right: "golfRightBayCost",
  investment_golf_dual: "golfDualBayCost",
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
  /** マスタで設定した単位（例: "円/月", "円", "回"） */
  unit: string
  /**
   * 初期金額。
   * ランニング: 坪数を掛ける前の単価ベース金額（単価 × 数量）。坪連動(perTsubo)の坪数は試算画面側で掛ける。
   * 投資: 取得額。
   */
  amount: number
  /** 投資コストの耐用年数（償却年）。未設定/0 は非償却 */
  depreciationYears?: number
  /** 数量基準（ランニング/投資 共通）。perTsubo は試算画面で坪数を掛けて実コスト化する */
  quantityBasis?: MasterValueQuantityBasis
  /** 単価（数量を掛ける前の1単位あたり金額）。fixed/perTsubo の数量入力欄の初期値算出に使う */
  unitAmount?: number
  /** 既定数量（マスタ登録値）。fixed/perTsubo の数量入力欄の初期値に使う */
  quantity?: number
  /** 投資コスト: 1単位あたり占有坪数（坪/単位）。>0 なら有効坪数を減らす */
  tsuboPerUnit?: number
}

/**
 * ランニングコストの実効数量を算出する。
 * - monthly（既定）: 1（単価をそのまま月額計上）
 * - perTsubo: 坪数 × 数量（坪連動）
 * - fixed: 数量そのもの（回数・台数等）
 * 後方互換: quantityBasis 未設定は monthly 扱い（従来は単価＝月額のため数量1相当）。
 */
export function resolveRunningQuantity(value: MasterValue, floorAreaTsubo: number): number {
  const quantity = Number.isFinite(Number(value.quantity)) && Number(value.quantity) > 0 ? Number(value.quantity) : 1
  if (value.quantityBasis === "perTsubo") {
    return Math.max(0, floorAreaTsubo) * quantity
  }
  if (value.quantityBasis === "fixed") {
    return quantity
  }
  return 1
}

/**
 * 坪数を掛ける前の実効数量を算出する（試算画面のランニングコスト入力欄に表示する単価ベースの数量）。
 * - perTsubo: 数量のみ（坪数は掛けない。坪数は試算画面側で別途掛ける）
 * - fixed: 数量そのもの（回数・台数等）
 * - monthly（既定）: 1
 */
/** 数量入力欄を持つ基準か（fixed=数量×単価／perTsubo=床面積×単価×数量／perOccupancy=占有坪数×単価×数量）。monthly/未設定は単価そのまま。 */
export function hasInvestmentQuantity(basis?: MasterValueQuantityBasis): boolean {
  return basis === "fixed" || basis === "perTsubo" || basis === "perOccupancy"
}

export function resolveRunningBaseQuantity(value: MasterValue): number {
  const quantity = Number.isFinite(Number(value.quantity)) && Number(value.quantity) > 0 ? Number(value.quantity) : 1
  if (value.quantityBasis === "perTsubo" || value.quantityBasis === "fixed") {
    return quantity
  }
  return 1
}

/**
 * 投資コストの既定数量を返す。
 * ランニングと違い 0 を許容する（ゴルフ等の任意設備は既定 0 台＝未導入から始める）。
 * monthly/未設定（取得額そのまま）は常に1。
 */
export function resolveInvestmentBaseQuantity(value: MasterValue): number {
  if (!hasInvestmentQuantity(value.quantityBasis)) return 1
  const raw = Number(value.quantity)
  return Number.isFinite(raw) && raw >= 0 ? raw : 1
}

/**
 * 投資費目群が消費する有効坪数の合計減算量を返す（= Σ 数量 × tsuboPerUnit）。
 * quantityByFieldId が与えられればその実数量（試算画面の入力値）を優先し、無ければマスタ既定数量を使う。
 */
export function resolveInvestmentTsuboReduction(
  values: MasterValue[],
  quantityByFieldId?: Record<string, number>,
): number {
  return values.reduce((sum, value) => {
    if (value.category !== "投資コスト") return sum
    const tsuboPerUnit = Math.max(0, Number(value.tsuboPerUnit) || 0)
    if (tsuboPerUnit <= 0) return sum
    const fieldId = INVESTMENT_COST_CODE_TO_FIELD_ID[value.code as keyof typeof INVESTMENT_COST_CODE_TO_FIELD_ID] ?? value.code
    const overrideQty = quantityByFieldId?.[fieldId]
    const quantity = Number.isFinite(Number(overrideQty)) ? Math.max(0, Number(overrideQty)) : resolveInvestmentBaseQuantity(value)
    return sum + quantity * tsuboPerUnit
  }, 0)
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
 *
 * ランニングコストの初期金額は「単価 × 数量」で算出する（坪連動(perTsubo)の坪数は掛けない）。
 * 坪連動の費目は坪数を掛ける前の単価ベース金額を amount に保持し、坪数は試算画面側で掛ける。
 */
export function resolveMasterFormModel(
  values: MasterValue[],
  royaltyRate: RoyaltyRate,
): MasterFormModel {
  const running: MasterFormItem[] = []
  const investment: MasterFormItem[] = []

  values.forEach((value) => {
    if (!value.code) return
    const unitAmount = resolveMasterValueAmount(value, royaltyRate)
    if (value.category === "ランニングコスト") {
      const fieldId = RUNNING_COST_CODE_TO_FIELD_ID[value.code as keyof typeof RUNNING_COST_CODE_TO_FIELD_ID] ?? value.code
      // 坪連動(perTsubo)は坪数を掛ける前の単価ベース金額を表示する（坪数は試算画面側で掛ける）
      const amount = Math.round(unitAmount * resolveRunningBaseQuantity(value))
      const quantity = Number.isFinite(Number(value.quantity)) && Number(value.quantity) > 0 ? Number(value.quantity) : 1
      running.push({ fieldId, code: value.code, label: value.label, unit: value.unit, amount, quantityBasis: value.quantityBasis, unitAmount: Math.round(unitAmount), quantity })
      return
    }
    if (value.category === "投資コスト") {
      const fieldId = INVESTMENT_COST_CODE_TO_FIELD_ID[value.code as keyof typeof INVESTMENT_COST_CODE_TO_FIELD_ID] ?? value.code
      const depreciationYears = Number(value.depreciationYears) > 0 ? Number(value.depreciationYears) : undefined
      const tsuboPerUnit = Number(value.tsuboPerUnit) > 0 ? Number(value.tsuboPerUnit) : undefined
      const baseQuantity = resolveInvestmentBaseQuantity(value)
      // 数量基準あり(fixed/perTsubo/perOccupancy)は「単価ベース」を保持し、数量は試算画面側で掛ける
      // （perTsuboの床面積・perOccupancyの占有坪数も試算画面側で掛ける）。monthly/未設定は従来どおり取得額そのもの。
      const amount = hasInvestmentQuantity(value.quantityBasis)
        ? Math.round(unitAmount * baseQuantity)
        : unitAmount
      investment.push({
        fieldId,
        code: value.code,
        label: value.label,
        unit: value.unit,
        amount,
        depreciationYears,
        quantityBasis: value.quantityBasis,
        unitAmount: Math.round(unitAmount),
        quantity: baseQuantity,
        tsuboPerUnit,
      })
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

export function resolveMasterFieldValues(values: MasterValue[], royaltyRate: RoyaltyRate, floorAreaTsubo = 0): ResolvedMasterValues {
  const runningByField: Record<string, number> = {}
  const investmentByField: Record<string, number> = {}
  const visibleRunningFieldIds: string[] = []
  const visibleInvestmentFieldIds: string[] = []

  values.forEach((value) => {
    if (!value.code) return
    const amount = resolveMasterValueAmount(value, royaltyRate)
    if (value.category === "ランニングコスト") {
      const fieldId = RUNNING_COST_CODE_TO_FIELD_ID[value.code as keyof typeof RUNNING_COST_CODE_TO_FIELD_ID] ?? value.code
      // 試算画面（フォーム）と同じ実効額に揃える: 単価 × 実効数量（fixed=数量, perTsubo=坪数×数量, monthly=1）。
      runningByField[fieldId] = Math.round(amount * resolveRunningQuantity(value, floorAreaTsubo))
      visibleRunningFieldIds.push(fieldId)
      return
    }

    if (value.category === "投資コスト") {
      const fieldId = INVESTMENT_COST_CODE_TO_FIELD_ID[value.code as keyof typeof INVESTMENT_COST_CODE_TO_FIELD_ID] ?? value.code
      // 試算画面と同じ実効額に揃える:
      //   fixed=単価×数量, perTsubo=単価×床面積×数量, perOccupancy=単価×占有坪数×数量, それ以外=取得額そのまま。
      const quantity = resolveInvestmentBaseQuantity(value)
      let effective = amount
      if (value.quantityBasis === "perTsubo") {
        effective = amount * Math.max(0, floorAreaTsubo) * quantity
      } else if (value.quantityBasis === "perOccupancy") {
        effective = amount * Math.max(0, Number(value.tsuboPerUnit) || 0) * quantity
      } else if (value.quantityBasis === "fixed") {
        effective = amount * quantity
      }
      investmentByField[fieldId] = Math.round(effective)
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
