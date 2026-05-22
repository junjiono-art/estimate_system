"use client"

import { useEffect, useMemo, useState } from "react"
import { SaveIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { CalcParameterConfig } from "@/lib/types"

function toRatePercent(value: number): string {
  return String(Math.round(value * 10_000) / 100)
}

function parseRatePercent(value: string, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return num / 100
}

function parseMoney(value: string, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(0, Math.round(num))
}

export default function CalcParamsPage() {
  const [form, setForm] = useState<CalcParameterConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [paymentFeeRatePercent, setPaymentFeeRatePercent] = useState("3.5")
  const [competitorUpTo2Percent, setCompetitorUpTo2Percent] = useState("10")
  const [competitorFor3Percent, setCompetitorFor3Percent] = useState("15")
  const [competitorFor4Percent, setCompetitorFor4Percent] = useState("20")
  const [competitorOver4Percent, setCompetitorOver4Percent] = useState("25")

  async function loadParams() {
    setIsLoading(true)
    try {
      const response = await fetch("/api/master/calc-params", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.params) {
        toast.error("計算パラメータの取得に失敗しました。")
        return
      }

      const next = payload.params as CalcParameterConfig
      setForm(next)
      setPaymentFeeRatePercent(toRatePercent(next.paymentFeeRate))
      setCompetitorUpTo2Percent(toRatePercent(next.competitorImpact.upTo2))
      setCompetitorFor3Percent(toRatePercent(next.competitorImpact.for3))
      setCompetitorFor4Percent(toRatePercent(next.competitorImpact.for4))
      setCompetitorOver4Percent(toRatePercent(next.competitorImpact.over4))
    } catch {
      toast.error("計算パラメータの取得に失敗しました。")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadParams()
  }, [])

  const normalizedPayload = useMemo<CalcParameterConfig | null>(() => {
    if (!form) return null
    return {
      paymentFeeRate: parseRatePercent(paymentFeeRatePercent, form.paymentFeeRate),
      royaltyCapMonthly: form.royaltyCapMonthly,
      appFeeMonthly: form.appFeeMonthly,
      competitorImpact: {
        upTo2: parseRatePercent(competitorUpTo2Percent, form.competitorImpact.upTo2),
        for3: parseRatePercent(competitorFor3Percent, form.competitorImpact.for3),
        for4: parseRatePercent(competitorFor4Percent, form.competitorImpact.for4),
        over4: parseRatePercent(competitorOver4Percent, form.competitorImpact.over4),
      },
      adCost: {
        ...form.adCost,
      },
    }
  }, [
    competitorFor3Percent,
    competitorFor4Percent,
    competitorOver4Percent,
    competitorUpTo2Percent,
    form,
    paymentFeeRatePercent,
  ])

  async function saveParams() {
    if (!normalizedPayload) {
      toast.error("計算パラメータが読み込まれていません。")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/master/calc-params", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedPayload),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.params) {
        toast.error("計算パラメータの保存に失敗しました。")
        return
      }

      toast.success("計算パラメータを保存しました。")
      await loadParams()
    } catch {
      toast.error("計算パラメータの保存に失敗しました。")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="計算パラメータ"
        description="定数・係数をGUIで編集します。保存後、次回試算から反映されます。"
      />
      <div className="overflow-auto">
        {!form ? (
          <div className="mx-auto max-w-4xl px-8 py-7">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              DBから計算パラメータを取得できませんでした。初期データ投入後に再度お試しください。
            </div>
          </div>
        ) : (
        <div className="mx-auto max-w-4xl px-8 py-7 space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">手数料・上限</h2>
              <p className="text-xs text-muted-foreground">決済手数料率、ロイヤリティ上限、アプリ利用料を管理します。</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="paymentFeeRate">決済手数料率（%）</Label>
                <Input
                  id="paymentFeeRate"
                  inputMode="decimal"
                  value={paymentFeeRatePercent}
                  onChange={(e) => setPaymentFeeRatePercent(e.target.value)}
                  disabled={isLoading || isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="royaltyCap">ロイヤリティ月額上限（円）</Label>
                <Input
                  id="royaltyCap"
                  inputMode="numeric"
                  value={form.royaltyCapMonthly}
                  onChange={(e) => {
                    if (!form) return
                    setForm((prev) => ({
                      ...(prev as CalcParameterConfig),
                      royaltyCapMonthly: parseMoney(e.target.value, form.royaltyCapMonthly),
                    }))
                  }}
                  disabled={isLoading || isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="appFee">アプリ利用料（円/月）</Label>
                <Input
                  id="appFee"
                  inputMode="numeric"
                  value={form.appFeeMonthly}
                  onChange={(e) => {
                    if (!form) return
                    setForm((prev) => ({
                      ...(prev as CalcParameterConfig),
                      appFeeMonthly: parseMoney(e.target.value, form.appFeeMonthly),
                    }))
                  }}
                  disabled={isLoading || isSaving}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">競合影響率</h2>
              <p className="text-xs text-muted-foreground">競合店舗数に応じた需要減衰率を設定します。</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="impactUpTo2">競合1-2店舗（%）</Label>
                <Input id="impactUpTo2" value={competitorUpTo2Percent} onChange={(e) => setCompetitorUpTo2Percent(e.target.value)} disabled={isLoading || isSaving} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="impactFor3">競合3店舗（%）</Label>
                <Input id="impactFor3" value={competitorFor3Percent} onChange={(e) => setCompetitorFor3Percent(e.target.value)} disabled={isLoading || isSaving} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="impactFor4">競合4店舗（%）</Label>
                <Input id="impactFor4" value={competitorFor4Percent} onChange={(e) => setCompetitorFor4Percent(e.target.value)} disabled={isLoading || isSaving} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="impactOver4">競合5店舗以上（%）</Label>
                <Input id="impactOver4" value={competitorOver4Percent} onChange={(e) => setCompetitorOver4Percent(e.target.value)} disabled={isLoading || isSaving} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">広告費テーブル</h2>
              <p className="text-xs text-muted-foreground">月次広告費のルールを年次・月次区分で設定します。</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="adY1M1">1年目 1月（円）</Label>
                <Input id="adY1M1" inputMode="numeric" value={form.adCost.year1Month1} onChange={(e) => setForm((prev) => ({ ...(prev as CalcParameterConfig), adCost: { ...(prev as CalcParameterConfig).adCost, year1Month1: parseMoney(e.target.value, (prev as CalcParameterConfig).adCost.year1Month1) } }))} disabled={isLoading || isSaving} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adY1M2">1年目 2月（円）</Label>
                <Input id="adY1M2" inputMode="numeric" value={form.adCost.year1Month2} onChange={(e) => setForm((prev) => ({ ...(prev as CalcParameterConfig), adCost: { ...(prev as CalcParameterConfig).adCost, year1Month2: parseMoney(e.target.value, (prev as CalcParameterConfig).adCost.year1Month2) } }))} disabled={isLoading || isSaving} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adY1M34">1年目 3-4月（円）</Label>
                <Input id="adY1M34" inputMode="numeric" value={form.adCost.year1Month3To4} onChange={(e) => setForm((prev) => ({ ...(prev as CalcParameterConfig), adCost: { ...(prev as CalcParameterConfig).adCost, year1Month3To4: parseMoney(e.target.value, (prev as CalcParameterConfig).adCost.year1Month3To4) } }))} disabled={isLoading || isSaving} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adY1M512">1年目 5-12月（円）</Label>
                <Input id="adY1M512" inputMode="numeric" value={form.adCost.year1Month5To12} onChange={(e) => setForm((prev) => ({ ...(prev as CalcParameterConfig), adCost: { ...(prev as CalcParameterConfig).adCost, year1Month5To12: parseMoney(e.target.value, (prev as CalcParameterConfig).adCost.year1Month5To12) } }))} disabled={isLoading || isSaving} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adY2">2年目 毎月（円）</Label>
                <Input id="adY2" inputMode="numeric" value={form.adCost.year2Monthly} onChange={(e) => setForm((prev) => ({ ...(prev as CalcParameterConfig), adCost: { ...(prev as CalcParameterConfig).adCost, year2Monthly: parseMoney(e.target.value, (prev as CalcParameterConfig).adCost.year2Monthly) } }))} disabled={isLoading || isSaving} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adY3p">3年目以降 毎月（円）</Label>
                <Input id="adY3p" inputMode="numeric" value={form.adCost.year3PlusMonthly} onChange={(e) => setForm((prev) => ({ ...(prev as CalcParameterConfig), adCost: { ...(prev as CalcParameterConfig).adCost, year3PlusMonthly: parseMoney(e.target.value, (prev as CalcParameterConfig).adCost.year3PlusMonthly) } }))} disabled={isLoading || isSaving} />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2">
            <Button onClick={saveParams} disabled={isLoading || isSaving}>
              <SaveIcon className="size-4" />
              保存
            </Button>
          </div>
        </div>
        )}
      </div>
    </>
  )
}
