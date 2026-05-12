"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { HistoryIcon, ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { FormulaEditor } from "@/components/master/formula-editor"
import { FormulaVersionPanel, type FormulaVersion } from "@/components/master/formula-version-panel"
import type { FormulaToken } from "@/components/master/formula-editor"
import { toast } from "sonner"

type ApiFormulaToken = {
  type: "var" | "const" | "op" | "fn" | "paren"
  varKey?: string
  value?: number
  op?: string
  fnName?: string
  paren?: "(" | ")"
  label?: string
}

type ApiFormulaDefinition = {
  key: string
  label: string
  tokens: ApiFormulaToken[]
}

type ApiFormulaSet = {
  setVersion: string
  status: "draft" | "active" | "archived"
  comment: string
  createdBy: string
  createdAt: string
  basedOnVersion?: string
  formulas: Record<string, ApiFormulaDefinition>
}

function toEditorToken(token: ApiFormulaToken, index: number): FormulaToken {
  if (token.type === "var") return { id: `t-${index}`, type: "var", key: token.varKey, label: token.label }
  if (token.type === "const") return { id: `t-${index}`, type: "const", value: token.value }
  if (token.type === "op") return { id: `t-${index}`, type: "op", value: token.op, label: token.label }
  if (token.type === "fn") return { id: `t-${index}`, type: "fn", name: token.fnName, label: token.label }
  return { id: `t-${index}`, type: "paren", value: token.paren, label: token.label }
}

function toApiToken(token: FormulaToken): ApiFormulaToken {
  if (token.type === "var") return { type: "var", varKey: token.key, label: token.label }
  if (token.type === "const") return { type: "const", value: Number(token.value ?? 0) }
  if (token.type === "op") return { type: "op", op: String(token.value ?? ""), label: token.label }
  if (token.type === "fn") return { type: "fn", fnName: token.name, label: token.label }
  return { type: "paren", paren: token.value === ")" ? ")" : "(", label: token.label }
}

// ── ページ ──────────────────────────────────────────────

export default function FormulaEditorPage() {
  const params = useParams<{ key: string }>()
  const formulaKey = params.key

  const [panelOpen, setPanelOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formulaSets, setFormulaSets] = useState<ApiFormulaSet[]>([])
  const [activeVersion, setActiveVersion] = useState<string | undefined>(undefined)
  const [viewingVersion, setViewingVersion] = useState<string | undefined>(undefined)

  const selectedVersion = viewingVersion ?? activeVersion
  const selectedSet = useMemo(
    () => formulaSets.find((s) => s.setVersion === selectedVersion),
    [formulaSets, selectedVersion],
  )
  const currentSet = useMemo(
    () => formulaSets.find((s) => s.setVersion === activeVersion),
    [formulaSets, activeVersion],
  )

  const selectedFormula = selectedSet?.formulas?.[formulaKey]
  const label = selectedFormula?.label || formulaKey
  const initialTokens: FormulaToken[] = (selectedFormula?.tokens || []).map(toEditorToken)
  const versions: FormulaVersion[] = formulaSets.map((set) => ({
    version: set.setVersion,
    createdBy: set.createdBy,
    createdAt: set.createdAt,
    comment: set.comment,
    status: set.status,
  }))

  async function loadSets() {
    const [currentRes, listRes] = await Promise.all([
      fetch("/api/master/calc-formulas/sets/current", { method: "GET", cache: "no-store" }),
      fetch("/api/master/calc-formulas/sets", { method: "GET", cache: "no-store" }),
    ])

    if (!listRes.ok) throw new Error("計算式セット一覧の取得に失敗しました。")

    const listData = (await listRes.json()) as { formulaSets?: ApiFormulaSet[] }
    const items = listData.formulaSets || []
    setFormulaSets(items)

    if (currentRes.ok) {
      const currentData = (await currentRes.json()) as { formulaSet?: ApiFormulaSet }
      const currentVersion = currentData.formulaSet?.setVersion
      setActiveVersion(currentVersion)
      setViewingVersion(currentVersion)
      return
    }

    const fallback = items.find((v) => v.status === "active")?.setVersion ?? items[0]?.setVersion
    setActiveVersion(fallback)
    setViewingVersion(fallback)
  }

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        await loadSets()
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "計算式セットの取得に失敗しました。")
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  async function handleSaveDraft(tokens: FormulaToken[], comment: string) {
    const base = currentSet || selectedSet
    if (!base) throw new Error("ベースとなる計算式セットがありません。")

    const payload = {
      comment,
      createdBy: "ui-user",
      basedOnVersion: base.setVersion,
      formulas: {
        ...base.formulas,
        [formulaKey]: {
          key: formulaKey,
          label,
          tokens: tokens.map(toApiToken),
        },
      },
    }

    const response = await fetch("/api/master/calc-formulas/sets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) throw new Error("下書き保存に失敗しました。")

    const data = (await response.json()) as { formulaSet?: ApiFormulaSet }
    const newVersion = data.formulaSet?.setVersion
    await loadSets()

    if (newVersion) {
      setViewingVersion(newVersion)
      toast.success(`${newVersion} を作成しました。`)
    }
  }

  async function handleActivate(tokens: FormulaToken[], comment: string) {
    await handleSaveDraft(tokens, comment)

    const latestRes = await fetch("/api/master/calc-formulas/sets", {
      method: "GET",
      cache: "no-store",
    })
    if (!latestRes.ok) throw new Error("反映対象バージョンの取得に失敗しました。")
    const latestData = (await latestRes.json()) as { formulaSets?: ApiFormulaSet[] }
    const latest = latestData.formulaSets?.[0]?.setVersion
    if (!latest) throw new Error("反映対象バージョンがありません。")

    const activateRes = await fetch(`/api/master/calc-formulas/sets/${latest}/activate`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ updatedBy: "ui-user" }),
    })

    if (!activateRes.ok) throw new Error("本番反映に失敗しました。")
    await loadSets()
    toast.success(`${latest} を本番反映しました。`)
  }

  async function handleRestore(version: string) {
    const activateRes = await fetch(`/api/master/calc-formulas/sets/${version}/activate`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ updatedBy: "ui-user" }),
    })

    if (!activateRes.ok) {
      toast.error("バージョンの反映に失敗しました。")
      return
    }

    await loadSets()
    toast.success(`${version} を本番反映しました。`)
  }

  return (
    <>
      <PageHeader
        title={`計算式エディタ：${label}`}
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
            {isLoading ? (
              <div className="rounded-lg border border-border bg-muted/20 px-5 py-8 text-center">
                <p className="text-sm font-medium text-foreground">計算式データを読み込み中です</p>
              </div>
            ) : errorMessage ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
                <p className="text-sm font-medium text-foreground">計算式データの取得に失敗しました</p>
                <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
              </div>
            ) : (
              <FormulaEditor
                formulaKey={formulaKey}
                label={label}
                initialTokens={initialTokens}
                activeVersion={selectedVersion}
                requirePreviewBeforeActivate={false}
                onSaveDraft={handleSaveDraft}
                onActivate={handleActivate}
              />
            )}
          </div>
        </div>

        {/* バージョン履歴サイドパネル */}
        {panelOpen && (
          <div className="w-80 shrink-0 border-l border-border bg-background overflow-hidden flex flex-col">
            <FormulaVersionPanel
              versions={versions}
              activeVersion={activeVersion}
              onClose={() => setPanelOpen(false)}
              onView={(version) => setViewingVersion(version)}
              onRestore={handleRestore}
            />
          </div>
        )}
      </div>
    </>
  )
}
