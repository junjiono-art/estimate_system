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
import type { MasterValue } from "@/lib/types"
import { toast } from "sonner"
import {
  INVESTMENT_COST_CODE_TO_FIELD_ID,
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
  runningCosts: {
    byField: Record<string, number>
    total: number
  }
  investmentCosts: {
    byField: Record<string, number>
    total: number
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
}

const TABS = [
  { id: "store",        label: "店舗基本情報",     icon: BuildingIcon  },
  { id: "running-cost", label: "ランニングコスト", icon: WalletIcon    },
  { id: "initial-cost", label: "投資コスト",       icon: BanknoteIcon  },
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
      values.forEach((value) => {
        const amountText = String(Math.max(0, Number(value.defaultAmount) || 0))
        if (value.category === "ランニングコスト") {
          const fieldId = RUNNING_COST_CODE_TO_FIELD_ID[value.code as keyof typeof RUNNING_COST_CODE_TO_FIELD_ID]
          if (fieldId) runningCostSetters[fieldId]?.(amountText)
          return
        }
        if (value.category === "投資コスト") {
          const fieldId = INVESTMENT_COST_CODE_TO_FIELD_ID[value.code as keyof typeof INVESTMENT_COST_CODE_TO_FIELD_ID]
          if (fieldId) investmentCostSetters[fieldId]?.(amountText)
        }
      })
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
  ]

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
  ]

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

      try {
        const response = await fetch("/api/e-stat/demographics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: targetAddress }),
        })

        const payload = await response.json()
        if (!response.ok) {
          demographicsError = getErrorMessage(payload, "人口統計データの取得に失敗しました。")
          console.warn(demographicsError)
        } else {
          demographics = payload
        }
      } catch (demographicsFetchError) {
        demographicsError = demographicsFetchError instanceof Error
          ? demographicsFetchError.message
          : "人口統計データの取得に失敗しました。"
        console.warn(demographicsError)
      }

      const formData: FormSubmitData = {
        storeInfo: {
          storeName,
          address,
          floorArea: parseInt(floorArea) || 0,
          rentPerTsubo: parseInt(rentPerTsubo) || 0,
        },
        runningCosts: {
          byField: Object.fromEntries(RC_ITEMS.map((item) => [item.id, Math.max(0, parseInt(item.value) || 0)])),
          total: totalRunningCost,
        },
        investmentCosts: {
          byField: Object.fromEntries(COST_ITEMS.map((item) => [item.id, Math.max(0, parseInt(item.value) || 0)])),
          total: totalInitialCost,
        },
        demographics,
        demographicsError,
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
