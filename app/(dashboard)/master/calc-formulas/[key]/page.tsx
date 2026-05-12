"use client"

import { useState } from "react"
import { notFound, useParams } from "next/navigation"
import { HistoryIcon, ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { FormulaEditor } from "@/components/master/formula-editor"
import { FormulaVersionPanel, MOCK_VERSIONS } from "@/components/master/formula-version-panel"
import type { FormulaToken } from "@/components/master/formula-editor"
import { toast } from "sonner"

// ── モック：計算式の初期トークン ──────────────────────

const FORMULA_META: Record<string, { label: string; tokens: FormulaToken[] }> = {
  monthlyRevenue: {
    label: "月次収益",
    tokens: [
      { id: "1", type: "var",   key: "memberCount",   label: "会員数" },
      { id: "2", type: "op",    value: "*",            label: "×" },
      { id: "3", type: "var",   key: "monthlyFee",    label: "月会費" },
      { id: "4", type: "op",    value: "+",            label: "＋" },
      { id: "5", type: "fn",    name: "round",         label: "round()" },
      { id: "6", type: "paren", value: "(",            label: "（" },
      { id: "7", type: "var",   key: "enrollmentFee", label: "入会費" },
      { id: "8", type: "op",    value: "/",            label: "÷" },
      { id: "9", type: "const", value: 12 },
      { id:"10", type: "paren", value: ")",            label: "）" },
    ],
  },
  monthlyRunningCost: {
    label: "月次ランニングコスト",
    tokens: [
      { id: "1", type: "var",   key: "tsubo",         label: "坪数" },
      { id: "2", type: "op",    value: "*",            label: "×" },
      { id: "3", type: "var",   key: "rentPerTsubo",  label: "家賃/坪" },
      { id: "4", type: "op",    value: "+",            label: "＋" },
      { id: "5", type: "var",   key: "adCostMonthly", label: "月次広告費" },
      { id: "6", type: "op",    value: "+",            label: "＋" },
      { id: "7", type: "var",   key: "appFeeMonthly", label: "アプリ利用料" },
    ],
  },
  initialInvestment: {
    label: "初期投資合計",
    tokens: [
      { id: "1", type: "var",   key: "tsubo",         label: "坪数" },
      { id: "2", type: "op",    value: "*",            label: "×" },
      { id: "3", type: "const", value: 300000 },
      { id: "4", type: "op",    value: "+",            label: "＋" },
      { id: "5", type: "var",   key: "enrollmentFee", label: "入会費" },
    ],
  },
  breakEvenMembers: {
    label: "損益分岐会員数",
    tokens: [
      { id: "1", type: "fn",    name: "ceil",          label: "ceil()" },
      { id: "2", type: "paren", value: "(",             label: "（" },
      { id: "3", type: "var",   key: "adCostMonthly",  label: "月次広告費" },
      { id: "4", type: "op",    value: "/",             label: "÷" },
      { id: "5", type: "var",   key: "monthlyFee",     label: "月会費" },
      { id: "6", type: "paren", value: ")",             label: "）" },
    ],
  },
}

// ── ページ ──────────────────────────────────────────────

export default function FormulaEditorPage() {
  const params = useParams<{ key: string }>()
  const formulaKey = params.key

  const meta = FORMULA_META[formulaKey]
  if (!meta) {
    notFound()
  }

  const [panelOpen, setPanelOpen] = useState(false)
  const activeVersion = MOCK_VERSIONS.find((v) => v.status === "active")?.version ?? "v0001"

  async function handleSaveDraft(tokens: FormulaToken[], comment: string) {
    // 実装後: POST /api/master/calc-formulas/[key]
    await new Promise((r) => setTimeout(r, 600))
    console.info("[formula] draft saved", { tokens, comment })
  }

  async function handleActivate(tokens: FormulaToken[], comment: string) {
    // 実装後: PUT /api/master/calc-formulas/[key]/activate
    await new Promise((r) => setTimeout(r, 800))
    console.info("[formula] activated", { tokens, comment })
  }

  function handleView(version: string) {
    toast.info(`${version} を表示します（実装後に有効）`)
  }

  function handleRestore(version: string) {
    toast.info(`${version} に戻します（実装後に有効）`)
  }

  return (
    <>
      <PageHeader
        title={`計算式エディタ：${meta.label}`}
        description="トークンを組み合わせて計算式を編集します。本番反映前にプレビュー計算を実行してください。"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setPanelOpen((prev) => !prev)}
            >
              <HistoryIcon className="size-3.5" />
              バージョン履歴
            </Button>
          </div>
        }
      />

      {/* パンくずナビ */}
      <div className="border-b border-border bg-muted/10 px-8 py-2">
        <Link
          href="/master/calc-formulas"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeftIcon className="size-3" />
          計算式管理に戻る
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* メインエディタ */}
        <div className="flex-1 overflow-auto px-8 py-7">
          <div className="mx-auto max-w-3xl">
            <FormulaEditor
              formulaKey={formulaKey}
              label={meta.label}
              initialTokens={meta.tokens}
              activeVersion={activeVersion}
              onSaveDraft={handleSaveDraft}
              onActivate={handleActivate}
            />
          </div>
        </div>

        {/* バージョン履歴サイドパネル */}
        {panelOpen && (
          <div className="w-80 shrink-0 border-l border-border bg-background overflow-hidden flex flex-col">
            <FormulaVersionPanel
              versions={MOCK_VERSIONS}
              activeVersion={activeVersion}
              onClose={() => setPanelOpen(false)}
              onView={handleView}
              onRestore={handleRestore}
            />
          </div>
        )}
      </div>
    </>
  )
}
