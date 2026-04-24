"use client"

import { useEffect, useState } from "react"
import {
  CalculatorIcon,
  BuildingIcon,
  WalletIcon,
  BanknoteIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  SlidersHorizontalIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/error-utils"
import { getFitnessMachineUnitPriceByAddress } from "@/lib/fitness-machine-cost"
import type { LocationType, MasterValue } from "@/lib/types"
import { toast } from "sonner"
import {
  INVESTMENT_COST_CODE_TO_FIELD_ID,
  resolveMasterFieldValues,
  RUNNING_COST_CODE_TO_FIELD_ID,
} from "@/lib/master-value-mapping"

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
    total: number
  }
  investmentCosts: {
    byField: Record<string, number>
    total: number
    byRoyaltyRate: Record<"0" | "10" | "15", number>
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

export function SimulationForm({ onSubmit, onSubmitWithData }: SimulationFormProps) {
  const allRunningFieldIds = Object.values(RUNNING_COST_CODE_TO_FIELD_ID)
  const allInvestmentFieldIds = Object.values(INVESTMENT_COST_CODE_TO_FIELD_ID)
  const [activeTab, setActiveTab] = useState<TabId>("store")
  const [costPage,  setCostPage]  = useState(0)
  const [rcPage,    setRcPage]    = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [nearbyDialogOpen, setNearbyDialogOpen] = useState(false)
  const [nearbyStoresSummary, setNearbyStoresSummary] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isMasterLoading, setIsMasterLoading] = useState(false)
  const [masterLoadError, setMasterLoadError] = useState("")
  const [masterValues, setMasterValues] = useState<MasterValue[]>([])
  const [visibleRunningCostIds, setVisibleRunningCostIds] = useState<string[]>(allRunningFieldIds)
  const [visibleInvestmentCostIds, setVisibleInvestmentCostIds] = useState<string[]>(allInvestmentFieldIds)

  // 計算パラメータ
  const [royaltyRate,      setRoyaltyRate]      = useState<"0" | "10" | "15">("0")
  const [competitorCount,  setCompetitorCount]  = useState("")
  const [locationType,     setLocationType]     = useState<LocationType>("suburban")

  // 店舗基本情報
  const [storeName,      setStoreName]      = useState("")
  const [address,        setAddress]        = useState("")
  const [floorArea,      setFloorArea]      = useState("")
  const [rentPerTsubo,   setRentPerTsubo]   = useState("")

  // 投資コスト
  const [fitnessMachineCost,  setFitnessMachineCost]  = useState("")
  const [interiorCost,        setInteriorCost]        = useState("")
  const [flapperGateCost,     setFlapperGateCost]     = useState("")
  const [bodyCompositionCost, setBodyCompositionCost] = useState("")
  const [waterServerCost,     setWaterServerCost]     = useState("")
  const [franchiseFeeCost,    setFranchiseFeeCost]    = useState("")
  const [systemCost,          setSystemCost]          = useState("")
  const [openingPrepCost,     setOpeningPrepCost]     = useState("")
  const [openingPackageCost,  setOpeningPackageCost]  = useState("")
  const [securityCost,        setSecurityCost]        = useState("")
  const [otherInitialCost,    setOtherInitialCost]    = useState("")
  const [isFitnessMachineCostManual, setIsFitnessMachineCostManual] = useState(false)

  // ゴルフ設備
  const [golfRightBayCount, setGolfRightBayCount] = useState("0")
  const [golfDualBayCount,  setGolfDualBayCount]  = useState("0")

  // ランニングコスト
  const [rcElectricity,   setRcElectricity]   = useState("")
  const [rcWater,         setRcWater]         = useState("")
  const [rcStaff,         setRcStaff]         = useState("")
  const [rcCleaning,      setRcCleaning]      = useState("")
  const [rcCommunication, setRcCommunication] = useState("")
  const [rcSupplies,      setRcSupplies]      = useState("")
  const [rcInsurance,     setRcInsurance]     = useState("")
  const [rcAdvertising,   setRcAdvertising]   = useState("")
  const [rcOther,         setRcOther]         = useState("")

  const runningCostSetters: Record<string, (value: string) => void> = {
    rcElectricity: setRcElectricity,
    rcWater: setRcWater,
    rcStaff: setRcStaff,
    rcCleaning: setRcCleaning,
    rcCommunication: setRcCommunication,
    rcSupplies: setRcSupplies,
    rcInsurance: setRcInsurance,
    rcAdvertising: setRcAdvertising,
    rcOther: setRcOther,
  }

  const investmentCostSetters: Record<string, (value: string) => void> = {
    fitnessMachineCost: setFitnessMachineCost,
    interiorCost: setInteriorCost,
    flapperGateCost: setFlapperGateCost,
    bodyCompositionCost: setBodyCompositionCost,
    waterServerCost: setWaterServerCost,
    franchiseFeeCost: setFranchiseFeeCost,
    systemCost: setSystemCost,
    openingPrepCost: setOpeningPrepCost,
    openingPackageCost: setOpeningPackageCost,
    securityCost: setSecurityCost,
    otherInitialCost: setOtherInitialCost,
  }

  function getAddressBasedFitnessMachineCost(
    values: MasterValue[],
    selectedRoyaltyRate: "0" | "10" | "15",
    currentAddress: string,
    currentFloorArea: string,
    currentGolfRightBay: string,
    currentGolfDualBay: string,
  ): number {
    const numericRoyaltyRate = parseInt(selectedRoyaltyRate, 10) as 0 | 10 | 15
    const resolved = resolveMasterFieldValues(values, numericRoyaltyRate)
    const dbUnitPrice = resolved.investmentByField.fitnessMachineCost
      ?? Math.max(0, Number(values.find((v) => v.code === "investment_fitness_machine")?.currentAmount) || 0)

    // J8式: =IFS(L11=1,H3*I8, L11=2,(H3-(H6*7))*I8, L11=3,(H3-(H7*9))*I8, L11=4,(H3-(H6*7)-(H7*9))*I8)
    const unitPrice = getFitnessMachineUnitPriceByAddress(currentAddress, dbUnitPrice)
    const floorAreaTsubo = Math.max(0, parseInt(currentFloorArea, 10) || 0)
    const rightBay = Math.max(0, parseInt(currentGolfRightBay, 10) || 0)  // H6
    const dualBay  = Math.max(0, parseInt(currentGolfDualBay,  10) || 0)  // H7
    const hasRight = rightBay > 0
    const hasDual  = dualBay  > 0
    // L11 判定: 1=ゴルフなし, 2=右打席のみ, 3=両打席のみ, 4=両方
    let effectiveTsubo: number
    if (!hasRight && !hasDual) {
      effectiveTsubo = floorAreaTsubo
    } else if (hasRight && !hasDual) {
      effectiveTsubo = floorAreaTsubo - rightBay * 7
    } else if (!hasRight && hasDual) {
      effectiveTsubo = floorAreaTsubo - dualBay * 9
    } else {
      effectiveTsubo = floorAreaTsubo - rightBay * 7 - dualBay * 9
    }
    return Math.max(0, Math.round(unitPrice * Math.max(0, effectiveTsubo)))
  }

  function applyMasterDefaults(values: MasterValue[], selectedRoyaltyRate: "0" | "10" | "15") {
    const numericRoyaltyRate = parseInt(selectedRoyaltyRate, 10) as 0 | 10 | 15
    const resolved = resolveMasterFieldValues(values, numericRoyaltyRate)

    Object.entries(resolved.runningByField).forEach(([fieldId, amount]) => {
      runningCostSetters[fieldId]?.(String(amount ?? 0))
    })
    Object.entries(resolved.investmentByField).forEach(([fieldId, amount]) => {
      investmentCostSetters[fieldId]?.(String(amount ?? 0))
    })

    const fitnessMachineCostByAddress = getAddressBasedFitnessMachineCost(values, selectedRoyaltyRate, address, floorArea, golfRightBayCount, golfDualBayCount)
    setFitnessMachineCost(String(fitnessMachineCostByAddress))
    setIsFitnessMachineCostManual(false)

    setVisibleRunningCostIds(resolved.visibleRunningFieldIds)
    setVisibleInvestmentCostIds(resolved.visibleInvestmentFieldIds)
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

  useEffect(() => {
    if (masterValues.length === 0) return
    applyMasterDefaults(masterValues, royaltyRate)
  }, [masterValues, royaltyRate])

  useEffect(() => {
    if (masterValues.length === 0) return
    if (isFitnessMachineCostManual) return

    const fitnessMachineCostByAddress = getAddressBasedFitnessMachineCost(masterValues, royaltyRate, address, floorArea, golfRightBayCount, golfDualBayCount)
    setFitnessMachineCost(String(fitnessMachineCostByAddress))
  }, [address, floorArea, golfRightBayCount, golfDualBayCount, isFitnessMachineCostManual, masterValues, royaltyRate])

  // ── アイテム定義（全state宣言の後に記述）──
  const RC_ITEMS = [
    { id: "rcElectricity",   label: "水道光熱費（円/月）", placeholder: "例: 150,000", value: rcElectricity,   setter: setRcElectricity   },
    { id: "rcWater",         label: "水道代（円/月）",     placeholder: "例: 30,000",  value: rcWater,         setter: setRcWater         },
    { id: "rcStaff",         label: "人件費（円/月）",     placeholder: "例: 500,000", value: rcStaff,         setter: setRcStaff         },
    { id: "rcCleaning",      label: "清掃費（円/月）",     placeholder: "例: 50,000",  value: rcCleaning,      setter: setRcCleaning      },
    { id: "rcCommunication", label: "通信費（円/月）",     placeholder: "例: 20,000",  value: rcCommunication, setter: setRcCommunication },
    { id: "rcSupplies",      label: "消耗品費（円/月）",   placeholder: "例: 30,000",  value: rcSupplies,      setter: setRcSupplies      },
    { id: "rcInsurance",     label: "保険料（円/月）",     placeholder: "例: 15,000",  value: rcInsurance,     setter: setRcInsurance     },
    { id: "rcAdvertising",   label: "広告宣伝費（円/月）", placeholder: "例: 100,000", value: rcAdvertising,   setter: setRcAdvertising   },
    { id: "rcOther",         label: "その他（円/月）",     placeholder: "例: 50,000",  value: rcOther,         setter: setRcOther         },
  ].filter((item) => visibleRunningCostIds.includes(item.id))

  const COST_ITEMS = [
    { id: "fitnessMachineCost",  label: "フィットネスマシン費（円）",  placeholder: "例: 12,000,000", value: fitnessMachineCost,  setter: setFitnessMachineCost  },
    { id: "interiorCost",        label: "内装工事費（円）",             placeholder: "例: 8,000,000",  value: interiorCost,        setter: setInteriorCost        },
    { id: "flapperGateCost",     label: "フラッパーゲート（円）",       placeholder: "例: 1,500,000",  value: flapperGateCost,     setter: setFlapperGateCost     },
    { id: "bodyCompositionCost", label: "体組成計（円）",               placeholder: "例: 500,000",    value: bodyCompositionCost, setter: setBodyCompositionCost },
    { id: "waterServerCost",     label: "ウォーターサーバー（円）",     placeholder: "例: 100,000",    value: waterServerCost,     setter: setWaterServerCost     },
    { id: "franchiseFeeCost",    label: "フランチャイズ加盟費用（円）", placeholder: "例: 4,500,000",  value: franchiseFeeCost,    setter: setFranchiseFeeCost    },
    { id: "systemCost",          label: "システム導入費（円）",         placeholder: "例: 800,000",    value: systemCost,          setter: setSystemCost          },
    { id: "openingPrepCost",     label: "開業準備費（円）",             placeholder: "例: 300,000",    value: openingPrepCost,     setter: setOpeningPrepCost     },
    { id: "openingPackageCost",  label: "開業前パッケージ費（円）",     placeholder: "例: 600,000",    value: openingPackageCost,  setter: setOpeningPackageCost  },
    { id: "securityCost",        label: "ALSOK/USEN導入費（円）",       placeholder: "例: 200,000",    value: securityCost,        setter: setSecurityCost        },
    { id: "otherInitialCost",    label: "その他（円）",                 placeholder: "例: 500,000",    value: otherInitialCost,    setter: setOtherInitialCost    },
  ].filter((item) => visibleInvestmentCostIds.includes(item.id))

  const rcTotalPages   = Math.ceil(RC_ITEMS.length   / PAGE_SIZE)
  const costTotalPages = Math.ceil(COST_ITEMS.length / PAGE_SIZE)
  const rcPageItems    = RC_ITEMS.slice(rcPage     * PAGE_SIZE, (rcPage   + 1) * PAGE_SIZE)
  const costPageItems  = COST_ITEMS.slice(costPage * PAGE_SIZE, (costPage + 1) * PAGE_SIZE)

  const totalRunningCost = RC_ITEMS.reduce((acc, item) => acc + (parseInt(item.value) || 0), 0)
  const totalInitialCost = COST_ITEMS.reduce((acc, item) => acc + (parseInt(item.value) || 0), 0)

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

      try {
        const nearbyResponse = await fetch("/api/stores/check-nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: geocodePayload.latitude,
            longitude: geocodePayload.longitude,
            prefecture: geocodePayload.prefecture,
            radiusKm: 1,
          }),
        })

        const nearbyPayload = await nearbyResponse.json()
        if (!nearbyResponse.ok) {
          console.warn(getErrorMessage(nearbyPayload, "近隣店舗チェックに失敗しました。試算を続行します。"))
        } else if (nearbyPayload?.hasNearbyStore) {
          const nearest = (nearbyPayload.nearbyStores as Array<{ name: string; distanceKm: number }>).slice(0, 3)
          const nearestText = nearest.map((s) => `${s.name}（${s.distanceKm}km）`).join("、")
          setNearbyStoresSummary(nearestText)
          setNearbyDialogOpen(true)
          return
        }
      } catch (nearbyError) {
        console.warn(nearbyError instanceof Error ? nearbyError.message : "近隣店舗チェックに失敗しました。試算を続行します。")
      }

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
        console.warn(meshPopResult.reason instanceof Error ? meshPopResult.reason.message : "メッシュ人口データの取得に失敗しました。試算を続行します。")
      }

      const investmentByField = Object.fromEntries(
        COST_ITEMS.map((item) => [item.id, Math.max(0, parseInt(item.value) || 0)]),
      )

      const selectedRoyaltyRate = parseInt(royaltyRate) as 0 | 10 | 15
      const investmentByRoyaltyRate: Record<"0" | "10" | "15", number> = masterValues.length > 0
        ? (() => {
            const currentResolved = resolveMasterFieldValues(masterValues, selectedRoyaltyRate)
            const currentResolvedByField = currentResolved.investmentByField as Record<string, number | undefined>
            const fieldDeltaById = Object.fromEntries(
              Object.entries(investmentByField).map(([fieldId, enteredAmount]) => {
                const baseAmount = Number(currentResolvedByField[fieldId] ?? enteredAmount)
                return [fieldId, enteredAmount - baseAmount]
              }),
            ) as Record<string, number>

            const calcTotalForRate = (rate: 0 | 10 | 15): number => {
              const targetResolved = resolveMasterFieldValues(masterValues, rate)
              const targetResolvedByField = targetResolved.investmentByField as Record<string, number | undefined>
              return Object.entries(investmentByField).reduce((sum, [fieldId, enteredAmount]) => {
                const targetBaseAmount = Number(targetResolvedByField[fieldId] ?? enteredAmount)
                const adjustedAmount = Math.max(0, Math.round(targetBaseAmount + (fieldDeltaById[fieldId] ?? 0)))
                return sum + adjustedAmount
              }, 0)
            }

            return {
              "0": calcTotalForRate(0),
              "10": calcTotalForRate(10),
              "15": calcTotalForRate(15),
            }
          })()
        : {
            "0": totalInitialCost,
            "10": totalInitialCost,
            "15": totalInitialCost,
          }

      const formData: FormSubmitData = {
        storeInfo: {
          storeName,
          address,
          floorArea: parseInt(floorArea) || 0,
          rentPerTsubo: parseInt(rentPerTsubo) || 0,
        },
        calcParams: {
          royaltyRate: parseInt(royaltyRate) as 0 | 10 | 15,
          competitorCount: Math.max(0, parseInt(competitorCount) || 0),
          locationType,
        },
        runningCosts: {
          byField: Object.fromEntries(RC_ITEMS.map((item) => [item.id, Math.max(0, parseInt(item.value) || 0)])),
          total: totalRunningCost,
        },
        investmentCosts: {
          byField: investmentByField,
          total: totalInitialCost,
          byRoyaltyRate: investmentByRoyaltyRate,
        },
        demographics,
        demographicsError,
        populationByRadius,
      }

      await onSubmitWithData?.(formData)
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
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="rentPerTsubo" className="flex items-center gap-1.5 text-xs font-medium">
                        家賃（円）
                        <span className="rounded px-1 py-0.5 text-[10px] font-semibold bg-destructive/10 text-destructive">必須</span>
                      </Label>
                      <Input
                        id="rentPerTsubo"
                        type="number"
                        placeholder="例: 300000"
                        value={rentPerTsubo}
                        onChange={(e) => { setRentPerTsubo(e.target.value); setFieldErrors((prev) => ({ ...prev, rentPerTsubo: "" })) }}
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

              <Separator />

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">ゴルフ設備</p>
                <p className="mb-3 text-[11px] text-muted-foreground leading-relaxed">
                  ゴルフ打席を設ける場合は台数を入力してください。フィットネスマシン費の計算に使用します（右打席: 7坪/台、両打席: 9坪/台を除外）。
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="golfRightBayCount" className="text-xs font-medium">
                      ゴルフ（右打席）台数
                    </Label>
                    <Input
                      id="golfRightBayCount"
                      type="number"
                      min={0}
                      placeholder="例: 0"
                      value={golfRightBayCount}
                      onChange={(e) => setGolfRightBayCount(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="golfDualBayCount" className="text-xs font-medium">
                      ゴルフ（両打席）台数
                    </Label>
                    <Input
                      id="golfDualBayCount"
                      type="number"
                      min={0}
                      placeholder="例: 0"
                      value={golfDualBayCount}
                      onChange={(e) => setGolfDualBayCount(e.target.value)}
                    />
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
                  合計 {totalRunningCost.toLocaleString()} 円/月
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

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {rcPageItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={item.id} className="text-xs font-medium">{item.label}</Label>
                    <Input
                      id={item.id}
                      type="number"
                      placeholder={item.placeholder}
                      value={item.value}
                      onChange={(e) => item.setter(e.target.value)}
                    />
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

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {costPageItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1.5">
                    <Label htmlFor={item.id} className="text-xs font-medium">{item.label}</Label>
                    <Input
                      id={item.id}
                      type="number"
                      placeholder={item.placeholder}
                      value={item.value}
                      onChange={(e) => {
                        if (item.id === "fitnessMachineCost") {
                          setIsFitnessMachineCostManual(true)
                        }
                        item.setter(e.target.value)
                      }}
                    />
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
                  {costPage + 1} / {costTotalPages} ページ（{costPage * PAGE_SIZE + 1}〜{Math.min((costPage + 1) * PAGE_SIZE, COST_ITEMS.length)} 件目）
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

      <AlertDialog open={nearbyDialogOpen} onOpenChange={setNearbyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">近隣店舗チェックで出店条件に抵触しました</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              同一都道府県内の1km圏内に既存店舗が見つかりました。
              {nearbyStoresSummary ? ` 近隣店舗: ${nearbyStoresSummary}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>確認</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
