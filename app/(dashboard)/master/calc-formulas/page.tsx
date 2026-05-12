"use client"

import Link from "next/link"
import { ArrowRightIcon, CheckCircleIcon, ClockIcon, FunctionSquareIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"

// ── モックデータ ────────────────────────────────────────

const FORMULAS = [
  {
    key: "monthlyRevenue",
    label: "月次収益",
    description: "会員数・月会費・入会費月按分をもとに月次粗収益を算出",
    activeVersion: "v0042",
    updatedAt: "2026-05-10",
    updatedBy: "田中",
    status: "active" as const,
    tokenCount: 9,
  },
  {
    key: "monthlyRunningCost",
    label: "月次ランニングコスト",
    description: "家賃・人件費・広告費・ロイヤリティ等を合算した月次コスト",
    activeVersion: "v0018",
    updatedAt: "2026-04-25",
    updatedBy: "鈴木",
    status: "active" as const,
    tokenCount: 14,
  },
  {
    key: "initialInvestment",
    label: "初期投資合計",
    description: "物件取得・内装・設備・フランチャイズ加盟金の合計",
    activeVersion: "v0007",
    updatedAt: "2026-03-20",
    updatedBy: "山田",
    status: "active" as const,
    tokenCount: 6,
  },
  {
    key: "breakEvenMembers",
    label: "損益分岐会員数",
    description: "ランニングコストを月次会費で割り、最低必要会員数を算出",
    activeVersion: "v0003",
    updatedAt: "2026-03-01",
    updatedBy: "山田",
    status: "active" as const,
    tokenCount: 5,
  },
]

// ── カードコンポーネント ────────────────────────────────

function FormulaCard({
  formula,
}: {
  formula: (typeof FORMULAS)[number]
}) {
  return (
    <Link
      href={`/master/calc-formulas/${formula.key}`}
      className="group block rounded-lg border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
            <FunctionSquareIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-foreground">{formula.label}</p>
              <Badge variant="outline" className="font-mono text-[10px]">{formula.activeVersion}</Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{formula.description}</p>
          </div>
        </div>
        <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors mt-1" />
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <CheckCircleIcon className="size-3 text-green-500" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <ClockIcon className="size-3" />
          <span>{formula.updatedAt} — {formula.updatedBy}</span>
        </div>
        <div className="ml-auto text-[10px] text-muted-foreground">
          {formula.tokenCount} トークン
        </div>
      </div>
    </Link>
  )
}

// ── ページ ──────────────────────────────────────────────

export default function CalcFormulasPage() {
  return (
    <>
      <PageHeader
        title="計算式管理"
        description="レベル2: 計算式そのものをGUIで編集・バージョン管理します。本番反映前にプレビュー計算が必要です。"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-7 space-y-4">
          {/* 説明バナー */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-3.5 flex items-start gap-3">
            <FunctionSquareIcon className="size-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">計算式の編集について</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                各計算式はトークン列（変数・演算子・定数・関数）で管理されています。
                編集後は必ず「プレビュー計算」を実行し、結果を確認してから「本番に反映」してください。
                すべての変更はバージョン履歴に記録されます。
              </p>
            </div>
          </div>

          {/* 計算式一覧 */}
          <div className="grid grid-cols-1 gap-3">
            {FORMULAS.map((f) => (
              <FormulaCard key={f.key} formula={f} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
