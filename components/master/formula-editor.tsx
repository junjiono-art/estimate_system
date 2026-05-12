"use client"

import { useEffect, useState } from "react"
import {
  PlusIcon,
  XIcon,
  PlayIcon,
  SaveIcon,
  ArrowRightIcon,
  GripVerticalIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { FORMULA_FUNCTIONS, FORMULA_VAR_REGISTRY } from "@/lib/formula-vars"
import { toast } from "sonner"

// ── トークン型定義 ──────────────────────────────────────

export type TokenType = "var" | "const" | "op" | "fn" | "paren"

export interface FormulaToken {
  id: string
  type: TokenType
  key?: string    // var
  value?: string | number  // const / op / paren
  name?: string   // fn
  label?: string  // 表示用ラベル
}

// ── 変数候補 ───────────────────────────────────────────

const AVAILABLE_VARS: { key: string; label: string }[] = FORMULA_VAR_REGISTRY.map((v) => ({
  key: v.key,
  label: `${v.label} (${v.key})`,
}))

const OPERATORS = [
  { value: "+", label: "＋" },
  { value: "-", label: "－" },
  { value: "*", label: "×" },
  { value: "/", label: "÷" },
]

const PARENS = [
  { value: "(", label: "（" },
  { value: ")", label: "）" },
]

const FUNCTIONS = FORMULA_FUNCTIONS

// ── ユーティリティ ──────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

function tokenLabel(t: FormulaToken): string {
  if (t.label) return t.label
  if (t.type === "var") {
    const v = AVAILABLE_VARS.find((v) => v.key === t.key)
    return v?.label ?? t.key ?? "?"
  }
  if (t.type === "op") {
    const op = OPERATORS.find((o) => o.value === t.value)
    return op?.label ?? String(t.value)
  }
  if (t.type === "paren") {
    const p = PARENS.find((p) => p.value === t.value)
    return p?.label ?? String(t.value)
  }
  if (t.type === "fn") return `${t.name}()`
  if (t.type === "const") return String(t.value)
  return "?"
}

function tokenColorClass(t: FormulaToken): string {
  switch (t.type) {
    case "var":   return "bg-blue-50 border-blue-200 text-blue-800"
    case "const": return "bg-amber-50 border-amber-200 text-amber-800"
    case "op":    return "bg-slate-50 border-slate-300 text-slate-700"
    case "fn":    return "bg-violet-50 border-violet-200 text-violet-800"
    case "paren": return "bg-slate-50 border-slate-300 text-slate-600"
    default:      return "bg-muted border-border text-foreground"
  }
}

// ── メインコンポーネント ────────────────────────────────

interface FormulaEditorProps {
  formulaKey: string
  label: string
  initialTokens?: FormulaToken[]
  activeVersion?: string
  requirePreviewBeforeActivate?: boolean
  onPreview?: (tokens: FormulaToken[]) => Promise<number>
  onSaveDraft?: (tokens: FormulaToken[], comment: string) => Promise<void>
  onActivate?: (tokens: FormulaToken[], comment: string) => Promise<void>
}

export function FormulaEditor({
  label,
  initialTokens = [],
  activeVersion = "v0001",
  requirePreviewBeforeActivate = true,
  onPreview,
  onSaveDraft,
  onActivate,
}: FormulaEditorProps) {
  const [tokens, setTokens] = useState<FormulaToken[]>(initialTokens)
  const [constInput, setConstInput] = useState("")
  const [comment, setComment] = useState("")
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [previewResult, setPreviewResult] = useState<number | null>(null)
  const [previewDone, setPreviewDone] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isActivating, setIsActivating] = useState(false)

  useEffect(() => {
    setTokens(initialTokens)
    setSelectedIndex(null)
    setPreviewDone(false)
  }, [initialTokens])

  // ── トークン操作 ─────────────────────────────────────

  function addToken(token: Omit<FormulaToken, "id">) {
    const newToken: FormulaToken = { ...token, id: genId() }
    if (selectedIndex !== null) {
      const next = [...tokens]
      next.splice(selectedIndex + 1, 0, newToken)
      setTokens(next)
      setSelectedIndex(selectedIndex + 1)
    } else {
      setTokens([...tokens, newToken])
    }
    setPreviewDone(false)
  }

  function removeToken(index: number) {
    const next = tokens.filter((_, i) => i !== index)
    setTokens(next)
    setSelectedIndex(null)
    setPreviewDone(false)
  }

  function selectToken(index: number) {
    setSelectedIndex(index === selectedIndex ? null : index)
  }

  function addConst() {
    const num = Number(constInput)
    if (!Number.isFinite(num)) {
      toast.error("有効な数値を入力してください。")
      return
    }
    addToken({ type: "const", value: num })
    setConstInput("")
  }

  // ── プレビュー計算 ───────────────────────────────────

  async function runPreview() {
    if (!onPreview) {
      toast.error("プレビューAPIが未接続です。")
      return
    }

    setPreviewResult(null)
    setPreviewDone(false)

    try {
      const value = await onPreview(tokens)
      setPreviewResult(value)
      setPreviewDone(true)
      toast.success("プレビュー計算を実行しました。")
    } catch (error) {
      setPreviewResult(null)
      setPreviewDone(false)
      toast.error(error instanceof Error ? error.message : "プレビュー計算に失敗しました。")
    }
  }

  async function handleSaveDraft() {
    if (!comment.trim()) {
      toast.error("変更コメントを入力してください。")
      return
    }
    setIsSaving(true)
    try {
      await onSaveDraft?.(tokens, comment)
      toast.success("下書き保存しました。")
    } catch {
      toast.error("保存に失敗しました。")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleActivate() {
    if (requirePreviewBeforeActivate && !previewDone) {
      toast.error("本番反映前にプレビュー計算を実行してください。")
      return
    }
    if (!comment.trim()) {
      toast.error("変更コメントを入力してください。")
      return
    }
    setIsActivating(true)
    try {
      await onActivate?.(tokens, comment)
      toast.success("本番に反映しました。")
    } catch {
      toast.error("反映に失敗しました。")
    } finally {
      setIsActivating(false)
    }
  }

  // ── レンダリング ────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">

      {/* ヘッダー情報 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">計算式:</span>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Badge variant="outline" className="ml-auto text-[10px] font-mono">
          {activeVersion}
        </Badge>
      </div>

      {/* 式キャンバス */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 min-h-[80px]">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          式の構成（クリックで選択、×で削除）
        </p>
        <div className="flex flex-wrap gap-2 min-h-[40px] items-start">
          {tokens.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">
              下のパレットからトークンを追加してください
            </span>
          ) : (
            tokens.map((t, i) => (
              <div
                key={t.id}
                className={`group flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium cursor-pointer select-none transition-all ${tokenColorClass(t)} ${selectedIndex === i ? "ring-2 ring-primary ring-offset-1" : ""}`}
                onClick={() => selectToken(i)}
              >
                <GripVerticalIcon className="size-3 text-current opacity-30" />
                <span>{tokenLabel(t)}</span>
                <button
                  className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); removeToken(i) }}
                  aria-label="削除"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* パレット */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">

        {/* 演算子 */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">演算子・括弧</p>
          <div className="flex flex-wrap gap-2">
            {OPERATORS.map((op) => (
              <button
                key={op.value}
                onClick={() => addToken({ type: "op", value: op.value, label: op.label })}
                className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {op.label}
              </button>
            ))}
            {PARENS.map((p) => (
              <button
                key={p.value}
                onClick={() => addToken({ type: "paren", value: p.value, label: p.label })}
                className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 丸め関数 */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">丸め関数</p>
          <div className="flex flex-wrap gap-2">
            {FUNCTIONS.map((fn) => (
              <button
                key={fn.name}
                onClick={() => addToken({ type: "fn", name: fn.name, label: fn.label })}
                className="rounded border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 transition-colors"
              >
                {fn.label}
              </button>
            ))}
          </div>
        </div>

        {/* 変数 */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">変数</p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARS.map((v) => (
              <button
                key={v.key}
                onClick={() => addToken({ type: "var", key: v.key, label: v.label })}
                className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 transition-colors"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* 数値定数 */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">数値定数</p>
          <div className="flex items-center gap-2">
            <Input
              className="h-8 w-36 text-xs"
              inputMode="decimal"
              placeholder="例: 12"
              value={constInput}
              onChange={(e) => setConstInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addConst() }}
            />
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={addConst}>
              <PlusIcon className="size-3.5" />
              追加
            </Button>
          </div>
        </div>
      </div>

      {/* プレビュー結果 */}
      {previewDone && previewResult !== null && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-semibold text-green-700 mb-1">プレビュー計算結果</p>
          <p className="text-2xl font-mono font-bold text-green-800">
            {previewResult.toLocaleString("ja-JP")}
          </p>
        </div>
      )}

      {/* 変更コメント */}
      <div className="space-y-1.5">
        <Label htmlFor="formula-comment" className="text-xs">
          変更コメント <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="formula-comment"
          placeholder="変更理由・内容を記入してください"
          className="h-20 resize-none text-xs"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {/* アクションボタン */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => { void runPreview() }}
        >
          <PlayIcon className="size-3.5" />
          プレビュー計算
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleSaveDraft}
          disabled={isSaving}
        >
          <SaveIcon className="size-3.5" />
          下書き保存
        </Button>
        <Button
          size="sm"
          className="gap-1.5 text-xs ml-auto"
          onClick={handleActivate}
          disabled={(requirePreviewBeforeActivate && !previewDone) || isActivating}
          title={requirePreviewBeforeActivate && !previewDone ? "先にプレビュー計算を実行してください" : undefined}
        >
          本番に反映
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>

      {requirePreviewBeforeActivate && !previewDone && (
        <p className="text-[10px] text-muted-foreground text-right -mt-3">
          ※ プレビュー計算完了後に「本番に反映」が有効になります
        </p>
      )}
    </div>
  )
}
