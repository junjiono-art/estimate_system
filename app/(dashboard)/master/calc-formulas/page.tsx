"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, CheckCircleIcon, ClockIcon, FunctionSquareIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"

type FormulaSummary = {
  key: string
  label: string
  description: string
  activeVersion: string
  updatedAt: string
  updatedBy: string
  tokenCount: number
}

type ApiFormulaSet = {
  setVersion: string
  createdAt: string
  createdBy: string
  formulas: Record<string, { key: string; label: string; tokens: unknown[] }>
}

// ── カードコンポーネント ────────────────────────────────

function FormulaCard({
  formula,
}: {
  formula: FormulaSummary
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
  const [formulas, setFormulas] = useState<FormulaSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadCurrentFormulaSet() {
      try {
        setIsLoading(true)
        setErrorMessage(null)

        const response = await fetch("/api/master/calc-formulas/sets/current", {
          method: "GET",
          cache: "no-store",
        })

        if (!response.ok) {
          if (response.status === 404) {
            setFormulas([])
            return
          }
          throw new Error("計算式セットの取得に失敗しました。")
        }

        const data = (await response.json()) as { formulaSet?: ApiFormulaSet }
        const formulaSet = data.formulaSet
        if (!formulaSet?.formulas) {
          setFormulas([])
          return
        }

        const mapped = Object.entries(formulaSet.formulas).map(([key, formula]) => ({
          key,
          label: formula.label || key,
          description: "式セットから読み込んだ計算式",
          activeVersion: formulaSet.setVersion,
          updatedAt: formulaSet.createdAt,
          updatedBy: formulaSet.createdBy,
          tokenCount: Array.isArray(formula.tokens) ? formula.tokens.length : 0,
        }))

        setFormulas(mapped)
      } catch (error) {
        setFormulas([])
        setErrorMessage(error instanceof Error ? error.message : "計算式セットの取得に失敗しました。")
      } finally {
        setIsLoading(false)
      }
    }

    void loadCurrentFormulaSet()
  }, [])

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
            {isLoading ? (
              <div className="rounded-lg border border-border bg-muted/20 px-5 py-8 text-center">
                <p className="text-sm font-medium text-foreground">計算式データを読み込み中です</p>
              </div>
            ) : formulas.length > 0 ? (
              formulas.map((f) => (
                <FormulaCard key={f.key} formula={f} />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
                <p className="text-sm font-medium text-foreground">計算式データがありません</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {errorMessage ?? "現行計算式セットが未作成です。まず式セットを作成してください。"}
                </p>
                <div className="mt-3">
                  <Link href="/master/calc-params" className="text-xs text-primary hover:underline">
                    計算パラメータ管理を開く
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
