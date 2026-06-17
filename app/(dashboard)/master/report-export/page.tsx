"use client"

import { useEffect, useState } from "react"
import { ChevronUpIcon, ChevronDownIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_REPORT_EXPORT_CONFIG,
  REPORT_KPI_LABELS,
  REPORT_SECTION_LABELS,
  normalizeReportExportConfig,
} from "@/lib/default-report-export"
import type { ReportExportConfig } from "@/lib/types"

export default function ReportExportMasterPage() {
  const [config, setConfig] = useState<ReportExportConfig>(DEFAULT_REPORT_EXPORT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: "ok" | "error"; message: string } | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await fetch("/api/master/report-export", { cache: "no-store" })
        const payload = await res.json().catch(() => null)
        if (active && res.ok && payload?.config) {
          setConfig(normalizeReportExportConfig(payload.config))
        }
      } catch {
        // 取得失敗時は既定値のまま
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  function toggleSection(id: string) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }))
  }

  function moveSection(index: number, dir: -1 | 1) {
    setConfig((c) => {
      const next = [...c.sections]
      const target = index + dir
      if (target < 0 || target >= next.length) return c
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...c, sections: next }
    })
  }

  function toggleKpi(id: string) {
    setConfig((c) => ({
      ...c,
      kpiItems: c.kpiItems.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k)),
    }))
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setConfig((c) => ({ ...c, cover: { ...c.cover, logoDataUrl: String(reader.result) } }))
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch("/api/master/report-export", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "保存に失敗しました。")
      }
      if (payload?.config) setConfig(normalizeReportExportConfig(payload.config))
      setStatus({ kind: "ok", message: "保存しました。" })
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "保存に失敗しました。" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="レポート出力設定"
        description="PDF / PPTX エクスポートのフォーマット（セクション・項目・表紙・テーマ・用紙）を編集します。"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-7">
          {loading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="flex flex-col gap-8">
              {/* セクション ON/OFF・並べ替え */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">出力セクション（表示順）</h3>
                <p className="text-xs text-muted-foreground">チェックで出力対象、矢印で順序を変更します（PDF/PPTX共通）。</p>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {config.sections.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={s.enabled}
                        onChange={() => toggleSection(s.id)}
                      />
                      <span className="flex-1 text-sm text-foreground">{REPORT_SECTION_LABELS[s.id]}</span>
                      <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                      <div className="flex flex-col">
                        <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => moveSection(i, -1)}>
                          <ChevronUpIcon className="size-4" />
                        </button>
                        <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === config.sections.length - 1} onClick={() => moveSection(i, 1)}>
                          <ChevronDownIcon className="size-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* KPI 取捨選択 */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">サマリに載せるKPI</h3>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                  {config.kpiItems.map((k) => (
                    <label key={k.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-primary" checked={k.enabled} onChange={() => toggleKpi(k.id)} />
                      {REPORT_KPI_LABELS[k.id]}
                    </label>
                  ))}
                </div>
              </section>

              {/* 表紙 */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">表紙</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">レポートタイトル</Label>
                    <Input value={config.cover.title} onChange={(e) => setConfig((c) => ({ ...c, cover: { ...c.cover, title: e.target.value } }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">会社名</Label>
                    <Input value={config.cover.companyName} onChange={(e) => setConfig((c) => ({ ...c, cover: { ...c.cover, companyName: e.target.value } }))} placeholder="例: 株式会社〇〇" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">ロゴ画像</Label>
                  <div className="flex items-center gap-3">
                    <Input type="file" accept="image/*" className="max-w-xs text-xs" onChange={onLogoChange} />
                    {config.cover.logoDataUrl && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={config.cover.logoDataUrl} alt="logo" className="h-10 w-auto rounded border border-border bg-muted/30 object-contain" />
                        <button type="button" className="text-[11px] text-muted-foreground underline hover:text-foreground" onClick={() => setConfig((c) => ({ ...c, cover: { ...c.cover, logoDataUrl: undefined } }))}>
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* テーマ色・用紙 */}
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">テーマ・用紙</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">アクセント色</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                        value={`#${config.theme.accentColor}`}
                        onChange={(e) => setConfig((c) => ({ ...c, theme: { accentColor: e.target.value.replace("#", "") } }))}
                      />
                      <span className="font-mono text-xs text-muted-foreground">#{config.theme.accentColor}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">用紙サイズ</Label>
                    <Select value={config.page.size} onValueChange={(v) => setConfig((c) => ({ ...c, page: { ...c.page, size: v as "A4" | "Letter" } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4</SelectItem>
                        <SelectItem value="Letter">Letter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">向き</Label>
                    <Select value={config.page.orientation} onValueChange={(v) => setConfig((c) => ({ ...c, page: { ...c.page, orientation: v as "portrait" | "landscape" } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landscape">横（landscape）</SelectItem>
                        <SelectItem value="portrait">縦（portrait）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* 保存 */}
              <div className="flex items-center gap-3 border-t border-border pt-4">
                <Button onClick={handleSave} disabled={saving} className="text-xs">
                  {saving ? "保存中..." : "保存する"}
                </Button>
                {status && (
                  <span className={status.kind === "ok" ? "text-xs text-chart-3" : "text-xs text-destructive"}>
                    {status.message}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
