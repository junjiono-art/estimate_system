"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalculatorIcon,
  BuildingIcon,
  WalletIcon,
  BanknoteIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  SlidersHorizontalIcon,
  RotateCcwIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { AmountInput } from "@/components/amount-input"
import { getErrorMessage } from "@/lib/error-utils"
import {
  getFitnessMachineUnitPriceByAddressAndRoyalty,
  FITNESS_MACHINE_CODE,
  FITNESS_MACHINE_FIELD_ID,
  FITNESS_MACHINE_LABEL,
  FITNESS_MACHINE_UNIT,
  FITNESS_MACHINE_DEPRECIATION_YEARS,
} from "@/lib/fitness-machine-cost"
import { computeMachineMaintenanceMonthly } from "@/lib/machine-maintenance"
import {
  computeSecurityIntroCost,
  SECURITY_CODE,
  SECURITY_FIELD_ID,
  SECURITY_LABEL,
  SECURITY_UNIT,
} from "@/lib/security-cost"
import type { CalcFitnessMachineConfig, CalcMachineMaintenanceConfig, CalcSecurityConfig, LocationType, MasterValue } from "@/lib/types"
import { DEFAULT_CALC_PARAMS } from "@/lib/default-calc-params"
import { toast } from "sonner"
import {
  resolveMasterFieldValues,
  resolveMasterFormModel,
  resolveInvestmentTsuboReduction,
  type MasterFormItem,
  type MasterFormModel,
} from "@/lib/master-value-mapping"

/**
 * フィットネスマシン費の費目をモデルに必ず含める。
 * 投資コストはマスタ(DB)駆動だが、マスタに費目が無くてもアプリ側で常に項目（固定枠）を供給する。
 * 実額は住所×坪数×ロイヤリティから別途算出して投入するため、ここでは amount=0 のひな型を先頭に足す。
 */
function withFitnessMachineItem(model: MasterFormModel): MasterFormModel {
  if (model.investment.some((m) => m.fieldId === FITNESS_MACHINE_FIELD_ID)) return model
  const synthetic: MasterFormItem = {
    fieldId: FITNESS_MACHINE_FIELD_ID,
    code: FITNESS_MACHINE_CODE,
    label: FITNESS_MACHINE_LABEL,
    unit: FITNESS_MACHINE_UNIT,
    amount: 0,
    depreciationYears: FITNESS_MACHINE_DEPRECIATION_YEARS,
  }
  return { running: model.running, investment: [synthetic, ...model.investment] }
}

/**
 * ALSOK・USEN導入費の費目をモデルに必ず含める。
 * フィットネスマシン費と同様、マスタ(DB)の投資コストに費目が無くてもアプリ側で常に項目を供給する。
 * 実額は坪数×計算パラメータから別途算出して投入するため、ここでは amount=0 のひな型を足す（非償却）。
 * 表示位置はマスタ由来の並び（その他の直前）に合わせる。
 */
function withSecurityItem(model: MasterFormModel): MasterFormModel {
  if (model.investment.some((m) => m.fieldId === SECURITY_FIELD_ID)) return model
  const synthetic: MasterFormItem = {
    fieldId: SECURITY_FIELD_ID,
    code: SECURITY_CODE,
    label: SECURITY_LABEL,
    unit: SECURITY_UNIT,
    amount: 0,
  }
  const investment = [...model.investment]
  const otherIndex = investment.findIndex((m) => m.fieldId === "otherInitialCost")
  investment.splice(otherIndex === -1 ? investment.length : otherIndex, 0, synthetic)
  return { running: model.running, investment }
}

/** アプリ側で常時供給する投資費目（フィットネスマシン費・ALSOK・USEN導入費）をモデルへ補完する */
function withAppManagedInvestmentItems(model: MasterFormModel): MasterFormModel {
  return withSecurityItem(withFitnessMachineItem(model))
}

interface SimulationFormProps {
  onSubmit?: () => void
  onSubmitWithData?: (data: FormSubmitData) => void | Promise<void>
}

export type FormSubmitData = {
  storeInfo: {
    storeName: string
    address: string
    floorArea: number
    rentPerTsubo: number
  }
  calcParams: {
    royaltyRate: 0 | 10 | 15
    competitorCount: number
    locationType: LocationType
  }
  runningCosts: {
    byField: Record<string, number>
    /** 費目別内訳（ラベル付き・坪数換算後の月額）。事業計画シートの経費計画行に使用 */
    items: Array<{ id: string; label: string; monthlyAmount: number }>
    /** マスタ駆動の費目合計（坪数換算後・家賃/マシンメンテ費は含めない） */
    total: number
    /** マシンメンテナンス費（固定枠）の月額。total には含めず別枠で渡す */
    machineMaintenance: number
  }
  investmentCosts: {
    byField: Record<string, number>
    total: number
    byRoyaltyRate: Record<"0" | "10" | "15", number>
    /** 投資項目別の償却年（フィールドID → 償却年）。マスタ登録値。減価償却の算出に使用 */
    depreciationYearsByField: Record<string, number>
  }
  demographics?: {
    municipality: {
      prefecture: string
      city: string
      areaCode: string
    }
    bySex: {
      male: number
      female: number
      total: number
    }
    byAgeGender: Array<{
      ageGroup: string
      male: number
      female: number
      total: number
    }>
  }
  demographicsError?: string
  populationByRadius?: {
    km1Ring: number
    km3Ring: number
    km5Ring: number
  }
}

const TABS = [
  { id: "store",        label: "店舗基本情報",     icon: BuildingIcon         },
  { id: "running-cost", label: "ランニングコスト", icon: WalletIcon           },
  { id: "initial-cost", label: "投資コスト",       icon: BanknoteIcon         },
  { id: "calc-params",  label: "計算パラメータ",   icon: SlidersHorizontalIcon },
] as const

type TabId = (typeof TABS)[number]["id"]

const PAGE_SIZE = 10

type DemographicRow = {
  ageGroup: string
  male: number
  female: number
  total: number
}

// ── 新規試算フォームの途中保存（下書き）。localStorage に自動保存し、次回起動時に復元を提示する。──
const DRAFT_STORAGE_KEY = "estimate-form-draft-v1"
// v2: ゴルフ専用入力を廃止し、投資費目の数量(investmentQuantities)へ統合。旧v1下書きは復元対象外。
const DRAFT_VERSION = 2

type FormDraft = {
  version: number
  savedAt: string
  storeName: string
  address: string
  floorArea: string
  rentPerTsubo: string
  royaltyRate: "0" | "10" | "15"
  competitorCount: string
  locationType: LocationType
  runningValues: Record<string, string>
  runningQuantities: Record<string, string>
  investmentValues: Record<string, string>
  investmentQuantities: Record<string, string>
  editedRunningFields: string[]
  editedInvestmentFields: string[]
  machineMaintenanceCost: string
  isMachineMaintenanceManual: boolean
  isFitnessMachineCostManual: boolean
}

function formatDraftTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 数量入力欄を出す費目か（fixed=数量×単価／perTsubo=床面積×単価×数量／perOccupancy=占有坪数×単価×数量）。
// これらは「単価」と「数量」を分けて保持する。monthly は単価をそのまま月額計上。
function hasQuantityInput(basis?: string): boolean {
  return basis === "fixed" || basis === "perTsubo" || basis === "perOccupancy"
}

export function SimulationForm({ onSubmit, onSubmitWithData }: SimulationFormProps) {
  const [activeTab, setActiveTab] = useState<TabId>("store")
  const [costPage,  setCostPage]  = useState(0)
  const [rcPage,    setRcPage]    = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isMasterLoading, setIsMasterLoading] = useState(false)
  const [masterLoadError, setMasterLoadError] = useState("")
  const [masterValues, setMasterValues] = useState<MasterValue[]>([])

  // 計算パラメータ
  const [royaltyRate,      setRoyaltyRate]      = useState<"0" | "10" | "15">("0")
  const [competitorCount,  setCompetitorCount]  = useState("")
  const [locationType,     setLocationType]     = useState<LocationType>("suburban")

  // 店舗基本情報
  const [storeName,      setStoreName]      = useState("")
  const [address,        setAddress]        = useState("")
  const [floorArea,      setFloorArea]      = useState("")
  const [rentPerTsubo,   setRentPerTsubo]   = useState("")

  // ランニングコスト・投資コストの入力値（フィールドID → 入力文字列）。
  // 項目構成・項目名・並び順はマスタから動的に決まるため、汎用マップで保持する。
  const [runningValues,    setRunningValues]    = useState<Record<string, string>>({})
  // 数量基準が fixed（数量×単価）の費目の数量入力値（フィールドID → 入力文字列）。
  const [runningQuantities, setRunningQuantities] = useState<Record<string, string>>({})
  const [investmentValues, setInvestmentValues] = useState<Record<string, string>>({})
  // 数量基準が fixed/perTsubo の投資費目の数量入力値（フィールドID → 入力文字列）。ゴルフ台数等。
  const [investmentQuantities, setInvestmentQuantities] = useState<Record<string, string>>({})
  // ユーザーが手入力した費目（フィールドID）。ロイヤリティ変更時の再適用で上書きから保護するために記録する。
  const [editedRunningFields,    setEditedRunningFields]    = useState<Set<string>>(() => new Set())
  const [editedInvestmentFields, setEditedInvestmentFields] = useState<Set<string>>(() => new Set())
  const [isFitnessMachineCostManual, setIsFitnessMachineCostManual] = useState(false)
  // マシンメンテナンス費（固定枠）。初期値は machineMaintenance パラメータから自動算出し、手動で上書き可能。
  const [machineMaintenanceCost, setMachineMaintenanceCost] = useState("")
  const [isMachineMaintenanceManual, setIsMachineMaintenanceManual] = useState(false)
  const [machineMaintenanceConfig, setMachineMaintenanceConfig] =
    useState<CalcMachineMaintenanceConfig>(DEFAULT_CALC_PARAMS.machineMaintenance)
  // フィットネスマシン費の単価表（都道府県別坪単価・直営割り戻し）。マスタ管理＞ロジック可視化で編集可能
  const [fitnessMachineConfig, setFitnessMachineConfig] =
    useState<CalcFitnessMachineConfig>(DEFAULT_CALC_PARAMS.fitnessMachine)
  // ALSOK・USEN導入費のパラメータ（固定額内訳＋カメラ/サイネージの台数式）。マスタ管理＞ロジック可視化で編集可能
  const [securityConfig, setSecurityConfig] =
    useState<CalcSecurityConfig>(DEFAULT_CALC_PARAMS.security)

  // 途中保存（下書き）。draftToRestore があれば復元バナーを出し、決定するまで自動保存しない。
  const [draftToRestore, setDraftToRestore] = useState<FormDraft | null>(null)
  const [draftChecked, setDraftChecked] = useState(false)
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null)

  // 起動時に下書きを読み込む（あれば復元を提示）。
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FormDraft
        const hasContent = Boolean(parsed?.storeName?.trim() || parsed?.address?.trim() || parsed?.floorArea?.trim())
        if (parsed && parsed.version === DRAFT_VERSION && hasContent) {
          setDraftToRestore(parsed)
        }
      }
    } catch {
      // 破損データは無視
    }
    setDraftChecked(true)
  }, [])

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      // 失敗しても致命的ではない
    }
    setAutoSavedAt(null)
  }

  function restoreDraft() {
    const d = draftToRestore
    if (!d) return
    setStoreName(d.storeName ?? "")
    setAddress(d.address ?? "")
    setFloorArea(d.floorArea ?? "")
    setRentPerTsubo(d.rentPerTsubo ?? "")
    setRoyaltyRate(d.royaltyRate === "10" ? "10" : d.royaltyRate === "15" ? "15" : "0")
    setCompetitorCount(d.competitorCount ?? "")
    setLocationType(d.locationType ?? "suburban")
    setRunningValues(d.runningValues ?? {})
    setRunningQuantities(d.runningQuantities ?? {})
    setInvestmentValues(d.investmentValues ?? {})
    setInvestmentQuantities(d.investmentQuantities ?? {})
    // 復元した費目は「手入力済み」として扱い、マスタ/ロイヤリティ再適用で上書きされないようにする。
    setEditedRunningFields(new Set(d.editedRunningFields ?? []))
    setEditedInvestmentFields(new Set(d.editedInvestmentFields ?? []))
    setMachineMaintenanceCost(d.machineMaintenanceCost ?? "")
    setIsMachineMaintenanceManual(Boolean(d.isMachineMaintenanceManual))
    setIsFitnessMachineCostManual(Boolean(d.isFitnessMachineCostManual))
    setAutoSavedAt(d.savedAt)
    setDraftToRestore(null)
  }

  function discardDraft() {
    clearDraft()
    setDraftToRestore(null)
  }

  // 入力変更をデバウンスして localStorage に自動保存（復元待ち・空入力のときは保存しない）。
  useEffect(() => {
    if (!draftChecked || draftToRestore !== null) return
    const hasContent = Boolean(storeName.trim() || address.trim() || floorArea.trim() || rentPerTsubo.trim())
    if (!hasContent) return
    const timer = setTimeout(() => {
      try {
        const draft: FormDraft = {
          version: DRAFT_VERSION,
          savedAt: new Date().toISOString(),
          storeName,
          address,
          floorArea,
          rentPerTsubo,
          royaltyRate,
          competitorCount,
          locationType,
          runningValues,
          runningQuantities,
          investmentValues,
          investmentQuantities,
          editedRunningFields: [...editedRunningFields],
          editedInvestmentFields: [...editedInvestmentFields],
          machineMaintenanceCost,
          isMachineMaintenanceManual,
          isFitnessMachineCostManual,
        }
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
        setAutoSavedAt(draft.savedAt)
      } catch {
        // 容量超過等は無視（自動保存はベストエフォート）
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [
    draftChecked, draftToRestore,
    storeName, address, floorArea, rentPerTsubo,
    royaltyRate, competitorCount, locationType,
    runningValues, runningQuantities, investmentValues, investmentQuantities,
    editedRunningFields, editedInvestmentFields,
    machineMaintenanceCost, isMachineMaintenanceManual, isFitnessMachineCostManual,
  ])

  // マスタ値＋ロイヤリティ率から、試算画面に表示する費目モデルを生成する。
  // 坪連動(perTsubo)のランニングコストは坪数を掛ける前の単価ベース金額を保持する（坪数は下の合計算出で掛ける）。
  const masterModel = useMemo(
    () => withAppManagedInvestmentItems(resolveMasterFormModel(masterValues, parseInt(royaltyRate, 10) as 0 | 10 | 15)),
    [masterValues, royaltyRate],
  )

  // 投資費目が消費する有効坪数の合計減算量（= Σ 数量 × 占有坪/単位）。フィットネスマシン費の坪数を減らす。
  // 入力中の数量(investmentQuantities)を優先し、未入力はマスタ既定数量を使う。
  const investmentTsuboReduction = useMemo(
    () => resolveInvestmentTsuboReduction(
      masterValues,
      Object.fromEntries(
        Object.entries(investmentQuantities).map(([fieldId, raw]) => [fieldId, Math.max(0, parseFloat(raw) || 0)]),
      ),
    ),
    [masterValues, investmentQuantities],
  )

  function handleRunningCostChange(fieldId: string, value: string) {
    setRunningValues((prev) => ({ ...prev, [fieldId]: value }))
    setEditedRunningFields((prev) => new Set(prev).add(fieldId))
  }

  function handleRunningQuantityChange(fieldId: string, value: string) {
    setRunningQuantities((prev) => ({ ...prev, [fieldId]: value }))
    setEditedRunningFields((prev) => new Set(prev).add(fieldId))
  }

  function handleInvestmentCostChange(fieldId: string, value: string) {
    if (fieldId === "fitnessMachineCost") setIsFitnessMachineCostManual(true)
    setInvestmentValues((prev) => ({ ...prev, [fieldId]: value }))
    setEditedInvestmentFields((prev) => new Set(prev).add(fieldId))
  }

  function handleInvestmentQuantityChange(fieldId: string, value: string) {
    setInvestmentQuantities((prev) => ({ ...prev, [fieldId]: value }))
    setEditedInvestmentFields((prev) => new Set(prev).add(fieldId))
  }

  function handleMachineMaintenanceChange(value: string) {
    setIsMachineMaintenanceManual(true)
    setMachineMaintenanceCost(value)
  }

  // マシンメンテナンス費（固定枠）の自動算出値。住所×坪数×ロイヤリティ＋マスタパラメータから算出。
  function getAutoMachineMaintenanceCost(
    currentAddress: string,
    currentFloorArea: string,
    selectedRoyaltyRate: "0" | "10" | "15",
    config: CalcMachineMaintenanceConfig,
  ): number {
    return computeMachineMaintenanceMonthly({
      address: currentAddress,
      floorAreaTsubo: Math.max(0, parseFloat(currentFloorArea) || 0),
      royaltyRate: (parseInt(selectedRoyaltyRate, 10) || 0) / 100,
      config,
    })
  }

  function getAddressBasedFitnessMachineCost(
    selectedRoyaltyRate: "0" | "10" | "15",
    currentAddress: string,
    currentFloorArea: string,
    tsuboReduction: number,
  ): number {
    const numericRoyaltyRate = parseInt(selectedRoyaltyRate, 10) as 0 | 10 | 15

    // 単価はアプリ側の都道府県別料金表から算出する（直営=半額／FC=満額。doc/計算系統・定数込み.md）。
    // 元Excel J8式（=有効坪数×単価）を一般化: 有効坪数 = 床面積 − Σ(投資費目の数量 × 占有坪/単位)。
    // ゴルフ右打席=7坪/台・両打席=9坪/台は投資マスタの tsuboPerUnit として表現する。
    const unitPrice = getFitnessMachineUnitPriceByAddressAndRoyalty(currentAddress, numericRoyaltyRate, fitnessMachineConfig)
    const floorAreaTsubo = Math.max(0, parseFloat(currentFloorArea) || 0)
    const effectiveTsubo = Math.max(0, floorAreaTsubo - Math.max(0, tsuboReduction))
    return Math.max(0, Math.round(unitPrice * effectiveTsubo))
  }

  // マスタを新規取得したときの初期化（全費目をマスタ基準額へリセット）。手入力の記録もクリアする。
  function applyMasterDefaults(values: MasterValue[], selectedRoyaltyRate: "0" | "10" | "15") {
    const numericRoyaltyRate = parseInt(selectedRoyaltyRate, 10) as 0 | 10 | 15
    const model = withAppManagedInvestmentItems(resolveMasterFormModel(values, numericRoyaltyRate))
    setEditedRunningFields(new Set())
    setEditedInvestmentFields(new Set())

    // fixed（数量×単価）/ perTsubo（坪数×単価×数量）は単価と数量を分けて保持する。monthly は金額そのまま。
    setRunningValues(Object.fromEntries(model.running.map((m) =>
      [m.fieldId, String((hasQuantityInput(m.quantityBasis) ? m.unitAmount : m.amount) ?? 0)],
    )))
    setRunningQuantities(Object.fromEntries(
      model.running
        .filter((m) => hasQuantityInput(m.quantityBasis))
        .map((m) => [m.fieldId, String(m.quantity ?? 1)]),
    ))

    // fixed/perTsubo の投資費目は単価ベースを保持（数量は別欄）。それ以外は取得額そのまま。
    const investmentDefaults = Object.fromEntries(model.investment.map((m) =>
      [m.fieldId, String((hasQuantityInput(m.quantityBasis) ? m.unitAmount : m.amount) ?? 0)],
    ))
    const investmentQuantityDefaults = Object.fromEntries(
      model.investment
        .filter((m) => hasQuantityInput(m.quantityBasis))
        .map((m) => [m.fieldId, String(m.quantity ?? 0)]),
    )
    // フィットネスマシン費はアプリ側で算出した値で上書きする（都道府県別単価×有効坪数、直営は半額）。
    // 有効坪数の減算量はマスタ既定数量（ゴルフ既定0台）から算出する。
    if (model.investment.some((m) => m.fieldId === FITNESS_MACHINE_FIELD_ID)) {
      investmentDefaults.fitnessMachineCost = String(
        getAddressBasedFitnessMachineCost(selectedRoyaltyRate, address, floorArea, resolveInvestmentTsuboReduction(values)),
      )
    }
    // ALSOK・USEN導入費もアプリ側で算出した値で上書きする（固定額＋坪数連動の台数×単価、万円切り上げ）。
    // 費目枠は withAppManagedInvestmentItems で常時供給されるため、マスタの有無に依存しない。
    investmentDefaults[SECURITY_FIELD_ID] = String(
      computeSecurityIntroCost(Math.max(0, parseFloat(floorArea) || 0), securityConfig),
    )
    setInvestmentValues(investmentDefaults)
    setInvestmentQuantities(investmentQuantityDefaults)
    setIsFitnessMachineCostManual(false)
    // マシンメンテナンス費（固定枠）も自動算出値へリセット
    setMachineMaintenanceCost(String(
      getAutoMachineMaintenanceCost(address, floorArea, selectedRoyaltyRate, machineMaintenanceConfig),
    ))
    setIsMachineMaintenanceManual(false)
  }

  async function loadMasterDefaults() {
    setIsMasterLoading(true)
    setMasterLoadError("")
    try {
      const response = await fetch("/api/master/values", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        const message = getErrorMessage(payload, "マスタ値の取得に失敗しました。")
        setMasterLoadError(message)
        toast.error(message)
        return
      }

      const values = (Array.isArray(payload?.values) ? payload.values : []) as MasterValue[]
      setMasterValues(values)
      applyMasterDefaults(values, royaltyRate)
    } catch (error) {
      const message = error instanceof Error ? error.message : "マスタ値の取得に失敗しました。"
      setMasterLoadError(message)
      toast.error(message)
    } finally {
      setIsMasterLoading(false)
    }
  }

  useEffect(() => {
    void loadMasterDefaults()
  }, [])

  // マシンメンテナンス費・フィットネスマシン費の自動算出に使うパラメータ（実施間隔・単価表等）を取得
  useEffect(() => {
    let disposed = false
    void (async () => {
      try {
        const response = await fetch("/api/master/calc-params", { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        const config = payload?.params?.machineMaintenance as CalcMachineMaintenanceConfig | undefined
        if (!disposed && config) setMachineMaintenanceConfig(config)
        const fmConfig = payload?.params?.fitnessMachine as CalcFitnessMachineConfig | undefined
        if (!disposed && fmConfig) setFitnessMachineConfig(fmConfig)
        const secConfig = payload?.params?.security as CalcSecurityConfig | undefined
        if (!disposed && secConfig) setSecurityConfig(secConfig)
      } catch {
        // 取得失敗時は既定パラメータ（DEFAULT_CALC_PARAMS）で算出する
      }
    })()
    return () => { disposed = true }
  }, [])

  // ロイヤリティ変更時は全リセットせず、手入力していない費目だけマスタ基準額（ロイヤリティ別単価）を再適用する。
  // 手入力済みの費目・手動上書きフラグは保持する（フィットネスマシン費・マシンメンテナンス費は専用effectでロイヤリティ連動）。
  useEffect(() => {
    if (masterValues.length === 0) return
    const model = withAppManagedInvestmentItems(resolveMasterFormModel(masterValues, parseInt(royaltyRate, 10) as 0 | 10 | 15))
    setRunningValues((prev) => {
      const next = { ...prev }
      model.running.forEach((m) => {
        if (editedRunningFields.has(m.fieldId)) return
        next[m.fieldId] = String((hasQuantityInput(m.quantityBasis) ? m.unitAmount : m.amount) ?? 0)
      })
      return next
    })
    setRunningQuantities((prev) => {
      const next = { ...prev }
      model.running.filter((m) => hasQuantityInput(m.quantityBasis)).forEach((m) => {
        if (editedRunningFields.has(m.fieldId)) return
        next[m.fieldId] = String(m.quantity ?? 1)
      })
      return next
    })
    setInvestmentValues((prev) => {
      const next = { ...prev }
      model.investment.forEach((m) => {
        if (m.fieldId === FITNESS_MACHINE_FIELD_ID) return
        // ALSOK・USEN導入費はロイヤリティ非連動のアプリ側算出値のため、マスタ基準額で戻さない
        if (m.fieldId === SECURITY_FIELD_ID) return
        if (editedInvestmentFields.has(m.fieldId)) return
        next[m.fieldId] = String((hasQuantityInput(m.quantityBasis) ? m.unitAmount : m.amount) ?? 0)
      })
      return next
    })
    setInvestmentQuantities((prev) => {
      const next = { ...prev }
      model.investment.filter((m) => hasQuantityInput(m.quantityBasis)).forEach((m) => {
        if (editedInvestmentFields.has(m.fieldId)) return
        next[m.fieldId] = String(m.quantity ?? 0)
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [royaltyRate])

  useEffect(() => {
    // フィットネスマシン費の単価はアプリ側（都道府県別料金表）で算出するため、マスタの有無に依存しない。
    // 手動上書き中のみ据え置く。
    if (isFitnessMachineCostManual) return

    const fitnessMachineCostByAddress = getAddressBasedFitnessMachineCost(royaltyRate, address, floorArea, investmentTsuboReduction)
    setInvestmentValues((prev) => ({ ...prev, fitnessMachineCost: String(fitnessMachineCostByAddress) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, floorArea, investmentTsuboReduction, isFitnessMachineCostManual, royaltyRate, fitnessMachineConfig])

  // ALSOK・USEN導入費（投資）の自動算出値を坪数・パラメータから更新（手動編集時は据え置き）。
  // ロイヤリティ・住所には依存しない（Excel B16 はロイヤリティ非連動）。
  // 費目枠はアプリ側で常時供給されるため、マスタ(DB)の投資コストに費目が無くても算出・表示される。
  useEffect(() => {
    if (editedInvestmentFields.has(SECURITY_FIELD_ID)) return
    setInvestmentValues((prev) => ({
      ...prev,
      [SECURITY_FIELD_ID]: String(computeSecurityIntroCost(Math.max(0, parseFloat(floorArea) || 0), securityConfig)),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorArea, securityConfig, editedInvestmentFields])

  // マシンメンテナンス費（固定枠）の自動算出値を住所・坪数・ロイヤリティ・パラメータから更新（手動上書き時は据え置き）
  useEffect(() => {
    if (isMachineMaintenanceManual) return
    setMachineMaintenanceCost(String(
      getAutoMachineMaintenanceCost(address, floorArea, royaltyRate, machineMaintenanceConfig),
    ))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, floorArea, royaltyRate, machineMaintenanceConfig, isMachineMaintenanceManual])

  // ── アイテム定義（マスタ駆動）──
  // 項目名・単位・並び順・初期金額はすべてマスタ（masterModel）から生成する。
  // マスタで費目名を変更／費目を追加すると、そのまま試算画面に反映される。
  const RC_ITEMS = masterModel.running.map((m) => ({
    id: m.fieldId,
    label: m.unit ? `${m.label}（${m.unit}）` : m.label,
    placeholder: "例: 0",
    value: runningValues[m.fieldId] ?? "",
    quantityBasis: m.quantityBasis,
  }))

  const COST_ITEMS = masterModel.investment.map((m) => ({
    id: m.fieldId,
    label: m.unit ? `${m.label}（${m.unit}）` : m.label,
    placeholder: "例: 0",
    value: investmentValues[m.fieldId] ?? "",
    quantityBasis: m.quantityBasis,
    tsuboPerUnit: m.tsuboPerUnit,
  }))

  // フィットネスマシン費・ALSOK・USEN導入費は専用の固定枠として描画するため、動的一覧（ページネーション対象）からは除外する。
  // ※ 合計・investmentByField の算出には引き続き COST_ITEMS（全件）を使うため、値は試算に反映される。
  const fitnessMachineItem = masterModel.investment.find((m) => m.fieldId === "fitnessMachineCost")
  const securityItem = masterModel.investment.find((m) => m.fieldId === SECURITY_FIELD_ID)
  const costDisplayItems = COST_ITEMS.filter((item) => item.id !== "fitnessMachineCost" && item.id !== SECURITY_FIELD_ID)

  const rcTotalPages   = Math.ceil(RC_ITEMS.length   / PAGE_SIZE)
  const costTotalPages = Math.ceil(costDisplayItems.length / PAGE_SIZE)
  const rcPageItems    = RC_ITEMS.slice(rcPage     * PAGE_SIZE, (rcPage   + 1) * PAGE_SIZE)
  const costPageItems  = costDisplayItems.slice(costPage * PAGE_SIZE, (costPage + 1) * PAGE_SIZE)

  // 坪数依存（perTsubo）の費目は「入力値 × 坪数」で実コスト化する。それ以外は入力値そのまま。
  const floorAreaTsubo = Math.max(0, parseFloat(floorArea) || 0)
  const rentValue = Math.max(0, parseInt(rentPerTsubo, 10) || 0)
  const perTsuboFieldIds = new Set(
    masterModel.running.filter((m) => m.quantityBasis === "perTsubo").map((m) => m.fieldId),
  )
  // fixed（数量×単価）の費目: 月額 = 単価(入力値) × 数量(入力値)。
  const fixedFieldIds = new Set(
    masterModel.running.filter((m) => m.quantityBasis === "fixed").map((m) => m.fieldId),
  )
  const runningEffectiveByField: Record<string, number> = Object.fromEntries(
    RC_ITEMS.map((item) => {
      const raw = Math.max(0, parseInt(item.value) || 0)
      const qty = Math.max(0, parseInt(runningQuantities[item.id]) || 0)
      let effective = raw
      if (perTsuboFieldIds.has(item.id)) {
        // 坪数×単価×数量
        effective = raw * floorAreaTsubo * qty
      } else if (fixedFieldIds.has(item.id)) {
        // 単価×数量
        effective = raw * qty
      }
      return [item.id, Math.round(effective)]
    }),
  )
  // 試算に渡すランニングコスト総額（坪数換算後・家賃/マシンメンテ費は含めない）
  const runningEffectiveTotal = Object.values(runningEffectiveByField).reduce((acc, v) => acc + v, 0)
  // マシンメンテナンス費（固定枠）の月額。total には含めず別枠で渡す（calc-engine 側で加算）。
  const machineMaintenanceValue = Math.max(0, parseInt(machineMaintenanceCost) || 0)
  // ランニングコストタブ右上に表示する金額（家賃 ＋ ランニング費 ＋ マシンメンテ費）
  const runningCostTotalWithRent = rentValue + runningEffectiveTotal + machineMaintenanceValue

  // 投資費目の数量基準セット（fitnessMachineCost / securityCost は専用固定枠なので除外＝常に取得額そのまま）。
  const isAppFixedInvestmentField = (fieldId: string) => fieldId === "fitnessMachineCost" || fieldId === SECURITY_FIELD_ID
  const investmentPerTsuboFieldIds = new Set(
    masterModel.investment.filter((m) => m.quantityBasis === "perTsubo" && !isAppFixedInvestmentField(m.fieldId)).map((m) => m.fieldId),
  )
  const investmentFixedFieldIds = new Set(
    masterModel.investment.filter((m) => m.quantityBasis === "fixed" && !isAppFixedInvestmentField(m.fieldId)).map((m) => m.fieldId),
  )
  const investmentPerOccupancyFieldIds = new Set(
    masterModel.investment.filter((m) => m.quantityBasis === "perOccupancy" && !isAppFixedInvestmentField(m.fieldId)).map((m) => m.fieldId),
  )
  // 投資費目の実効取得額: fixed=単価×数量, perTsubo=単価×床面積×数量, perOccupancy=単価×占有坪数×数量, それ以外=入力値そのまま。
  const investmentEffectiveByField: Record<string, number> = Object.fromEntries(
    COST_ITEMS.map((item) => {
      const raw = Math.max(0, parseInt(item.value) || 0)
      const qty = Math.max(0, parseInt(investmentQuantities[item.id]) || 0)
      let effective = raw
      if (investmentPerTsuboFieldIds.has(item.id)) {
        effective = raw * floorAreaTsubo * qty
      } else if (investmentPerOccupancyFieldIds.has(item.id)) {
        effective = raw * Math.max(0, item.tsuboPerUnit || 0) * qty
      } else if (investmentFixedFieldIds.has(item.id)) {
        effective = raw * qty
      }
      return [item.id, Math.round(effective)]
    }),
  )
  const totalInitialCost = Object.values(investmentEffectiveByField).reduce((acc, v) => acc + v, 0)

  const currentIndex = TABS.findIndex((t) => t.id === activeTab)
  const isFirst = currentIndex === 0
  const isLast  = currentIndex === TABS.length - 1

  const handleSimulate = async () => {
    setIsSubmitting(true)
    setSubmitError("")

    // 必須項目チェック
    const errors: Record<string, string> = {}
    if (!storeName.trim())    errors.storeName    = "試算名は必須です。"
    if (!address.trim())      errors.address      = "住所は必須です。"
    if (!rentPerTsubo.trim()) errors.rentPerTsubo = "家賃は必須です。"
    if (!floorArea.trim())    errors.floorArea    = "床面積は必須です。"

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setActiveTab("store")
      setIsSubmitting(false)
      return
    }
    setFieldErrors({})

    try {
      const targetAddress = address.trim()
      if (!targetAddress) {
        throw new Error("住所は必須です。")
      }

      const geocodeResponse = await fetch("/api/geocoding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress }),
      })

      const geocodePayload = await geocodeResponse.json()
      if (!geocodeResponse.ok) {
        throw new Error(getErrorMessage(geocodePayload, "住所の座標変換に失敗しました。"))
      }

      // 近隣店舗は「出店条件抵触エラー」での中断はせず、結果画面の地図セクションに距離付き一覧（5km圏）で表示する方針。

      let demographics: FormSubmitData["demographics"] | undefined
      let demographicsError: string | undefined
      let populationByRadius: FormSubmitData["populationByRadius"] | undefined

      // demographics と meshPopulation を並列取得
      const [demographicsResult, meshPopResult] = await Promise.allSettled([
        fetch("/api/e-stat/demographics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: targetAddress }),
        }).then(async (res) => {
          const payload = await res.json()
          if (!res.ok) throw new Error(getErrorMessage(payload, "人口統計データの取得に失敗しました。"))
          return payload
        }),
        fetch("/api/e-stat/mesh-population", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: geocodePayload.latitude,
            longitude: geocodePayload.longitude,
          }),
        }).then(async (res) => {
          const payload = await res.json()
          if (!res.ok) throw new Error(payload?.error ?? "メッシュ人口データの取得に失敗しました。")
          return payload as { km1Ring: number; km3Ring: number; km5Ring: number }
        }),
      ])

      if (demographicsResult.status === "fulfilled") {
        demographics = demographicsResult.value
      } else {
        demographicsError = demographicsResult.reason instanceof Error
          ? demographicsResult.reason.message
          : "人口統計データの取得に失敗しました。"
        console.warn(demographicsError)
      }

      if (meshPopResult.status === "fulfilled") {
        populationByRadius = meshPopResult.value
      } else {
        const meshError = meshPopResult.reason instanceof Error
          ? meshPopResult.reason.message
          : "メッシュ人口データの取得に失敗しました。試算を続行します。"
        console.warn(meshError)
      }

      // 投資費目の実効取得額（fixed=単価×数量, perTsubo=単価×坪数×数量）。ゴルフ設備費もここに含まれる。
      const investmentByField = { ...investmentEffectiveByField }

      // 投資項目別の償却年（マスタ登録値）。減価償却の算出に使用する。ゴルフ等もマスタの償却年が反映される。
      const depreciationYearsByField = Object.fromEntries(
        masterModel.investment
          .filter((m) => m.depreciationYears && m.depreciationYears > 0)
          .map((m) => [m.fieldId, m.depreciationYears as number]),
      )

      const selectedRoyaltyRate = parseInt(royaltyRate) as 0 | 10 | 15
      const currentResolvedByField =
        resolveMasterFieldValues(masterValues, selectedRoyaltyRate, floorAreaTsubo).investmentByField as Record<string, number | undefined>
      // 各費目の「入力値 − マスタ基準額」の差分（手動上書き分）。ロイヤリティ別の再計算でこの差分を引き継ぐ。
      const fieldDeltaById = Object.fromEntries(
        Object.entries(investmentByField).map(([fieldId, enteredAmount]) => {
          const baseAmount = Number(currentResolvedByField[fieldId] ?? enteredAmount)
          return [fieldId, enteredAmount - baseAmount]
        }),
      ) as Record<string, number>

      const calcTotalForRate = (rate: 0 | 10 | 15): number => {
        const targetResolvedByField =
          resolveMasterFieldValues(masterValues, rate, floorAreaTsubo).investmentByField as Record<string, number | undefined>
        return Object.entries(investmentByField).reduce((sum, [fieldId, enteredAmount]) => {
          // フィットネスマシン費は単価がロイヤリティで変わる（直営=半額）。手動上書きが無ければレートごとに再算出する。
          if (fieldId === FITNESS_MACHINE_FIELD_ID && !isFitnessMachineCostManual) {
            return sum + getAddressBasedFitnessMachineCost(
              String(rate) as "0" | "10" | "15", address, floorArea, investmentTsuboReduction,
            )
          }
          // ALSOK・USEN導入費はアプリ側算出（ロイヤリティ非連動）。マスタ基準額との差分方式を使わず入力値をそのまま採用する。
          if (fieldId === SECURITY_FIELD_ID) {
            return sum + enteredAmount
          }
          const targetBaseAmount = Number(targetResolvedByField[fieldId] ?? enteredAmount)
          const adjustedAmount = Math.max(0, Math.round(targetBaseAmount + (fieldDeltaById[fieldId] ?? 0)))
          return sum + adjustedAmount
        }, 0)
      }

      const investmentByRoyaltyRate: Record<"0" | "10" | "15", number> = {
        "0": calcTotalForRate(0),
        "10": calcTotalForRate(10),
        "15": calcTotalForRate(15),
      }

      const formData: FormSubmitData = {
        storeInfo: {
          storeName,
          address,
          floorArea: parseFloat(floorArea) || 0,
          rentPerTsubo: parseInt(rentPerTsubo) || 0,
        },
        calcParams: {
          royaltyRate: parseInt(royaltyRate) as 0 | 10 | 15,
          competitorCount: Math.max(0, parseInt(competitorCount) || 0),
          locationType,
        },
        runningCosts: {
          // 坪数依存の費目は坪数換算後の実コストを渡す（試算側は坪数を掛けた後を使用）
          byField: runningEffectiveByField,
          items: RC_ITEMS.map((item) => ({
            id: item.id,
            label: item.label,
            monthlyAmount: runningEffectiveByField[item.id] ?? 0,
          })),
          total: runningEffectiveTotal,
          machineMaintenance: machineMaintenanceValue,
        },
        investmentCosts: {
          byField: investmentByField,
          total: totalInitialCost,
          byRoyaltyRate: investmentByRoyaltyRate,
          depreciationYearsByField,
        },
        demographics,
        demographicsError,
        populationByRadius,
      }

      await onSubmitWithData?.(formData)
      // 試算実行が成功したら下書きは不要なので消す。
      clearDraft()
      onSubmit?.()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "送信に失敗しました。")
    } finally {
      setIsSubmitting(false)
    }
  }





  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-5"
    >
      {/* ── 途中保存（下書き）の復元バナー ── */}
      {draftToRestore && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-xs text-foreground">
            入力途中の下書きがあります（保存: {formatDraftTime(draftToRestore.savedAt)}）。続きから再開しますか？
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="h-7 text-xs" onClick={restoreDraft}>
              復元する
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={discardDraft}>
              破棄する
            </Button>
          </div>
        </div>
      )}

      {/* ── 自動保存インジケータ ── */}
      {!draftToRestore && autoSavedAt && (
        <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          <span>下書きを自動保存しました（{formatDraftTime(autoSavedAt)}）</span>
          <button type="button" className="underline hover:text-foreground" onClick={discardDraft}>
            下書きを破棄
          </button>
        </div>
      )}

      {/* ── タブナビ ── */}
      <div className="flex gap-0 overflow-x-auto rounded-lg border border-border bg-muted/50">
        {TABS.map((tab, i) => {
          const Icon = tab.icon
          const isActive = tab.id === activeTab
          const isPast   = i < currentIndex
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap border-r border-border px-4 py-2.5 text-xs font-medium transition-all last:border-r-0",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isPast
                    ? "bg-background text-muted-foreground hover:bg-secondary"
                    : "bg-transparent text-muted-foreground hover:bg-secondary",
              )}
            >
              {isPast && !isActive
                ? <CheckIcon className="size-3.5 text-accent" />
                : <Icon className="size-3.5" />
              }
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden font-mono">{i + 1}</span>
            </button>
          )
        })}
      </div>

      {/* ── タブコンテンツ ── */}
      <Card className="border-border shadow-none">
        <CardContent className="p-6">

          {/* 店舗基本情報 */}
          {activeTab === "store" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5 sm:w-96">
                <Label htmlFor="storeName" className="flex items-center gap-1.5 text-xs font-medium">
                  試算名
                  <span className="rounded px-1 py-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive">必須</span>
                </Label>
                <Input
                  id="storeName"
                  placeholder="例: FitGym 渋谷店"
                  value={storeName}
                  onChange={(e) => { setStoreName(e.target.value); setFieldErrors((prev) => ({ ...prev, storeName: "" })) }}
                  className={fieldErrors.storeName ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {fieldErrors.storeName && (
                  <p className="text-[11px] text-destructive">{fieldErrors.storeName}</p>
                )}
              </div>

              <Separator />

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">エリア情報</p>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="address" className="flex items-center gap-1.5 text-xs font-medium">
                      住所
                      <span className="rounded px-1 py-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive">必須</span>
                    </Label>
                    <Input
                      id="address"
                      placeholder="例: 東京都渋谷区渋谷1-1-1 ○○ビル3F"
                      value={address}
                      onChange={(e) => { setAddress(e.target.value); setFieldErrors((prev) => ({ ...prev, address: "" })) }}
                      className={fieldErrors.address ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {fieldErrors.address && (
                      <p className="text-[11px] text-destructive">{fieldErrors.address}</p>
                    )}
                    <span className="text-[10px] leading-relaxed text-muted-foreground">
                      住所の都道府県をもとにフィットネスマシン費・マシンメンテナンス費の単価を算出します。
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="rentPerTsubo" className="flex items-center gap-1.5 text-xs font-medium">
                        家賃（円）
                        <span className="rounded px-1 py-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive">必須</span>
                      </Label>
                      <AmountInput
                        id="rentPerTsubo"
                        placeholder="例: 300,000"
                        value={rentPerTsubo}
                        onValueChange={(raw) => { setRentPerTsubo(raw); setFieldErrors((prev) => ({ ...prev, rentPerTsubo: "" })) }}
                        className={fieldErrors.rentPerTsubo ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {fieldErrors.rentPerTsubo && (
                        <p className="text-[11px] text-destructive">{fieldErrors.rentPerTsubo}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="floorArea" className="flex items-center gap-1.5 text-xs font-medium">
                        床面積（坪）
                        <span className="rounded px-1 py-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive">必須</span>
                      </Label>
                      <Input
                        id="floorArea"
                        type="number"
                        placeholder="例: 50"
                        value={floorArea}
                        onChange={(e) => { setFloorArea(e.target.value); setFieldErrors((prev) => ({ ...prev, floorArea: "" })) }}
                        className={fieldErrors.floorArea ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {fieldErrors.floorArea && (
                        <p className="text-[11px] text-destructive">{fieldErrors.floorArea}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 計算パラメータ */}
          {activeTab === "calc-params" && (
            <div className="flex flex-col gap-6">
              <p className="text-xs text-muted-foreground leading-relaxed">
                計算に使用するパラメータを確認・調整してください。配線は後続対応予定です。
              </p>

              {/* ロイヤリティ率 */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ロイヤリティ率</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["0", "10", "15"] as const).map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setRoyaltyRate(rate)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-center transition-all",
                        royaltyRate === rate
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-background hover:bg-muted/50",
                      )}
                    >
                      <span className="text-sm font-semibold text-foreground">{rate === "0" ? "直営 (0%)" : `${rate}%`}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 競合ジム件数 */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">競合ジム件数</p>
                <div className="sm:w-48">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="competitorCount" className="text-xs font-medium">
                      半径1km圏内の競合ジム数
                    </Label>
                    <Input
                      id="competitorCount"
                      type="number"
                      placeholder="例: 3"
                      min={0}
                      value={competitorCount}
                      onChange={(e) => setCompetitorCount(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* 立地タイプ */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">立地タイプ</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      { value: "urban",    label: "都市型",  desc: "駅近・繁華街。集客力高め。"     },
                      { value: "suburban", label: "郊外型",  desc: "住宅街・ロードサイド。"         },
                      { value: "rural",    label: "田舎型",  desc: "地方・競合少なめ。"             },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLocationType(opt.value)}
                      className={cn(
                        "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                        locationType === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-background hover:bg-muted/50",
                      )}
                    >
                      <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                      <span className="text-[10px] leading-relaxed text-muted-foreground">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ランニングコスト */}
          {activeTab === "running-cost" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  地域・店舗の実情に合わせて各費目の月額を入力してください。
                </p>
                <span className="shrink-0 rounded-md border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-medium">
                  合計（家賃込） {runningCostTotalWithRent.toLocaleString()} 円/月
                </span>
              </div>
              {masterLoadError && (
                <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                  <span>{masterLoadError}</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { void loadMasterDefaults() }} disabled={isMasterLoading}>
                    再試行
                  </Button>
                </div>
              )}

              {/* 固定枠：マシンメンテナンス費（ランニングコスト） */}
              <div className="rounded-lg border border-chart-4/40 bg-chart-4/5 p-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <Label htmlFor="machineMaintenanceCost" className="text-xs font-semibold">マシンメンテナンス費（円/月）</Label>
                    <span className="text-[10px] leading-relaxed text-muted-foreground">
                      都道府県単価 × 人数 × 日数 ÷ 実施間隔から自動算出。手動で変更できます。
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AmountInput
                      id="machineMaintenanceCost"
                      className="w-40"
                      value={machineMaintenanceCost}
                      onValueChange={(raw) => handleMachineMaintenanceChange(raw)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1 text-[10px]"
                      title="住所・坪数・ロイヤリティ・マスタパラメータから自動算出し直します"
                      onClick={() => {
                        setIsMachineMaintenanceManual(false)
                        setMachineMaintenanceCost(String(getAutoMachineMaintenanceCost(address, floorArea, royaltyRate, machineMaintenanceConfig)))
                      }}
                    >
                      <RotateCcwIcon className="size-3" />
                      再計算
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {rcPageItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={item.id} className="text-xs font-medium">{item.label}</Label>
                    {hasQuantityInput(item.quantityBasis) ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-1 flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {item.quantityBasis === "perTsubo" ? "単価（/坪）" : "単価"}
                            </span>
                            <AmountInput
                              id={item.id}
                              placeholder={item.placeholder}
                              value={item.value}
                              onValueChange={(raw) => handleRunningCostChange(item.id, raw)}
                            />
                          </div>
                          {item.quantityBasis === "perTsubo" && (
                            <span className="self-end pb-2 text-[10px] text-muted-foreground">× 坪数</span>
                          )}
                          <span className="self-end pb-2 text-xs text-muted-foreground">×</span>
                          <div className="flex w-20 flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground">数量</span>
                            <AmountInput
                              id={`${item.id}-qty`}
                              placeholder="例: 1"
                              value={runningQuantities[item.id] ?? ""}
                              onValueChange={(raw) => handleRunningQuantityChange(item.id, raw)}
                            />
                          </div>
                        </div>
                        <span className="text-right text-[10px] text-muted-foreground">
                          = {(runningEffectiveByField[item.id] ?? 0).toLocaleString()} 円/月
                        </span>
                      </div>
                    ) : (
                      <AmountInput
                        id={item.id}
                        placeholder={item.placeholder}
                        value={item.value}
                        onValueChange={(raw) => handleRunningCostChange(item.id, raw)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* ページネーション */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  disabled={rcPage === 0}
                  onClick={() => setRcPage((p) => p - 1)}
                >
                  <ChevronLeftIcon className="size-3.5" />
                  前の10件
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {rcPage + 1} / {rcTotalPages} ページ（{rcPage * PAGE_SIZE + 1}〜{Math.min((rcPage + 1) * PAGE_SIZE, RC_ITEMS.length)} 件目）
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  disabled={rcPage >= rcTotalPages - 1}
                  onClick={() => setRcPage((p) => p + 1)}
                >
                  次の10件
                  <ChevronRightIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* 投資コスト */}
          {activeTab === "initial-cost" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  開業にかかる各投資コストを入力してください。
                  {investmentTsuboReduction > 0 && (
                    <span className="block text-[10px] text-muted-foreground/80">
                      ※ ゴルフ等の設備が有効坪数を {investmentTsuboReduction.toLocaleString()} 坪消費し、フィットネスマシン費に連動して反映されます。
                    </span>
                  )}
                </p>
                <span className="shrink-0 rounded-md border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-medium">
                  合計 {totalInitialCost.toLocaleString()} 円
                </span>
              </div>
              {masterLoadError && (
                <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                  <span>{masterLoadError}</span>
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { void loadMasterDefaults() }} disabled={isMasterLoading}>
                    再試行
                  </Button>
                </div>
              )}

              {/* 固定枠：フィットネスマシン費（投資コスト） */}
              {fitnessMachineItem && (
                <div className="rounded-lg border border-chart-4/40 bg-chart-4/5 p-3">
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-1 flex-col gap-0.5">
                      <Label htmlFor="fitnessMachineCost" className="text-xs font-semibold">
                        {fitnessMachineItem.unit ? `フィットネスマシン費（${fitnessMachineItem.unit}）` : "フィットネスマシン費（円）"}
                      </Label>
                      <span className="text-[10px] leading-relaxed text-muted-foreground">
                        都道府県別単価（直営は半額）× 有効坪数から自動算出。手動で変更できます。
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AmountInput
                        id="fitnessMachineCost"
                        className="w-40"
                        value={investmentValues.fitnessMachineCost ?? ""}
                        onValueChange={(raw) => handleInvestmentCostChange("fitnessMachineCost", raw)}
                      />
                      {isFitnessMachineCostManual && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 text-[10px]"
                          onClick={() => {
                            setIsFitnessMachineCostManual(false)
                            setInvestmentValues((prev) => ({
                              ...prev,
                              fitnessMachineCost: String(getAddressBasedFitnessMachineCost(royaltyRate, address, floorArea, investmentTsuboReduction)),
                            }))
                          }}
                        >
                          自動に戻す
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 固定枠：ALSOK・USEN導入費（投資コスト） */}
              {securityItem && (
                <div className="rounded-lg border border-chart-4/40 bg-chart-4/5 p-3">
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-1 flex-col gap-0.5">
                      <Label htmlFor={SECURITY_FIELD_ID} className="text-xs font-semibold">
                        {`${securityItem.label}（${securityItem.unit || "円"}）`}
                      </Label>
                      <span className="text-[10px] leading-relaxed text-muted-foreground">
                        固定額（Wifi・スピーカー・ALSOK等）＋坪数連動の機器台数×単価から自動算出（万円切り上げ）。手動で変更できます。
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AmountInput
                        id={SECURITY_FIELD_ID}
                        className="w-40"
                        value={investmentValues[SECURITY_FIELD_ID] ?? ""}
                        onValueChange={(raw) => handleInvestmentCostChange(SECURITY_FIELD_ID, raw)}
                      />
                      {editedInvestmentFields.has(SECURITY_FIELD_ID) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 text-[10px]"
                          onClick={() => {
                            setEditedInvestmentFields((prev) => {
                              const next = new Set(prev)
                              next.delete(SECURITY_FIELD_ID)
                              return next
                            })
                            setInvestmentValues((prev) => ({
                              ...prev,
                              [SECURITY_FIELD_ID]: String(computeSecurityIntroCost(Math.max(0, parseFloat(floorArea) || 0), securityConfig)),
                            }))
                          }}
                        >
                          自動に戻す
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {costPageItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={item.id} className="text-xs font-medium">{item.label}</Label>
                    {hasQuantityInput(item.quantityBasis) ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-1 flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {item.quantityBasis === "perTsubo" ? "単価（/坪）" : "単価"}
                            </span>
                            <AmountInput
                              id={item.id}
                              placeholder={item.placeholder}
                              value={item.value}
                              onValueChange={(raw) => handleInvestmentCostChange(item.id, raw)}
                            />
                          </div>
                          {item.quantityBasis === "perTsubo" && (
                            <span className="self-end pb-2 text-[10px] text-muted-foreground">× 坪数</span>
                          )}
                          <span className="self-end pb-2 text-xs text-muted-foreground">×</span>
                          <div className="flex w-20 flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground">数量</span>
                            <AmountInput
                              id={`${item.id}-qty`}
                              placeholder="例: 0"
                              value={investmentQuantities[item.id] ?? ""}
                              onValueChange={(raw) => handleInvestmentQuantityChange(item.id, raw)}
                            />
                          </div>
                        </div>
                        <span className="text-right text-[10px] text-muted-foreground">
                          = {(investmentEffectiveByField[item.id] ?? 0).toLocaleString()} 円
                          {item.tsuboPerUnit && item.tsuboPerUnit > 0
                            ? `（有効坪数 −${(Math.max(0, parseInt(investmentQuantities[item.id]) || 0) * item.tsuboPerUnit).toLocaleString()}坪）`
                            : ""}
                        </span>
                      </div>
                    ) : (
                      <AmountInput
                        id={item.id}
                        placeholder={item.placeholder}
                        value={item.value}
                        onValueChange={(raw) => handleInvestmentCostChange(item.id, raw)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* ページネーション */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  disabled={costPage === 0}
                  onClick={() => setCostPage((p) => p - 1)}
                >
                  <ChevronLeftIcon className="size-3.5" />
                  前の10件
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {costPage + 1} / {costTotalPages} ページ（{costPage * PAGE_SIZE + 1}〜{Math.min((costPage + 1) * PAGE_SIZE, costDisplayItems.length)} 件目）
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  disabled={costPage >= costTotalPages - 1}
                  onClick={() => setCostPage((p) => p + 1)}
                >
                  次の10件
                  <ChevronRightIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ── フッターナビ ── */}
      {submitError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {submitError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => !isFirst && setActiveTab(TABS[currentIndex - 1].id)}
          disabled={isFirst}
          className="gap-1.5 text-xs"
        >
          <ChevronLeftIcon className="size-3.5" />
          前へ
        </Button>

        <div className="flex items-center gap-1.5">
          {TABS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "block h-1.5 rounded-full transition-all",
                i === currentIndex ? "w-5 bg-primary" : i < currentIndex ? "w-1.5 bg-accent" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>

        {isLast ? (
          <Button type="button" onClick={() => { void handleSimulate() }} disabled={isSubmitting} className="gap-1.5 text-xs">
            <CalculatorIcon className="size-3.5" />
            {isSubmitting ? "試算中..." : "試算を実行する"}
          </Button>
        ) : (
          <Button type="button" onClick={() => setActiveTab(TABS[currentIndex + 1].id)} className="gap-1.5 text-xs">
            次へ
            <ChevronRightIcon className="size-3.5" />
          </Button>
        )}
      </div>
    </form>
  )
}
