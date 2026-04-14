"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  SearchIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import type { MasterValue } from "@/lib/types"
import { toast } from "sonner"
import { normalizeMasterCode } from "@/lib/master-value-mapping"

const ROWS_PER_PAGE = 10
type SortDir = "asc" | "desc" | null

function getPageNumbers(total: number, current: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "ellipsis")[] = [1]
  if (current > 3) pages.push("ellipsis")
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p)
  }
  if (current < total - 2) pages.push("ellipsis")
  pages.push(total)
  return pages
}

const EMPTY_FORM: Omit<MasterValue, "id"> = {
  category: "ランニングコスト",
  code: "",
  label: "",
  unit: "",
  defaultAmount: 0,
  currentAmount: 0,
  note: "",
}

export default function RunningCostPage() {
  const [rows, setRows] = useState<MasterValue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [search, setSearch] = useState("")
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [page, setPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [editTarget, setEditTarget] = useState<MasterValue | null>(null)
  const [form, setForm] = useState<Omit<MasterValue, "id">>(EMPTY_FORM)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError("")
    try {
      const response = await fetch("/api/master/values", { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setRows([])
        setLoadError("ランニングコストマスタの取得に失敗しました。")
        return
      }
      const values = Array.isArray(payload?.values) ? payload.values : []
      setRows(
        (values as MasterValue[])
          .filter((v) => v.category === "ランニングコスト")
          .map((v) => ({ ...v, code: normalizeMasterCode(v.code || v.id) })),
      )
    } catch {
      setRows([])
      setLoadError("ランニングコストマスタの取得に失敗しました。")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const processed = useMemo(() => {
    let result = rows.filter((r) =>
      r.label.toLowerCase().includes(search.toLowerCase()),
    )
    if (sortDir === "asc") result = [...result].sort((a, b) => a.currentAmount - b.currentAmount)
    if (sortDir === "desc") result = [...result].sort((a, b) => b.currentAmount - a.currentAmount)
    return result
  }, [rows, search, sortDir])

  const totalPages = Math.ceil(processed.length / ROWS_PER_PAGE)
  const paged = processed.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  function resetPage() { setPage(1) }

  function cycleSortDir() {
    setSortDir((d) => (d === null ? "asc" : d === "asc" ? "desc" : null))
    resetPage()
  }

  function openAdd() {
    setDialogMode("add")
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(row: MasterValue) {
    setDialogMode("edit")
    setEditTarget(row)
    setForm({ category: row.category, code: row.code, label: row.label, unit: row.unit, defaultAmount: row.defaultAmount, currentAmount: row.currentAmount, note: row.note })
    setDialogOpen(true)
  }

  function validateForm(target: Omit<MasterValue, "id">): string | null {
    if (!target.code.trim()) return "コードは必須です。"
    if (!/^[a-z0-9_]+$/.test(target.code.trim().toLowerCase())) return "コードは英小文字・数字・アンダースコアのみ使用できます。"
    if (!target.label.trim()) return "費目名は必須です。"
    if (!target.unit.trim()) return "単位は必須です。"
    if (!Number.isFinite(target.defaultAmount) || !Number.isFinite(target.currentAmount)) return "単価には数値を入力してください。"
    if (target.defaultAmount < 0 || target.currentAmount < 0) return "単価は0以上で入力してください。"

    const normalizedCode = normalizeMasterCode(target.code)
    const duplicateCode = rows.some((row) =>
      row.category === "ランニングコスト" &&
      normalizeMasterCode(row.code) === normalizedCode &&
      (dialogMode === "add" || row.id !== editTarget?.id),
    )
    if (duplicateCode) return "同一カテゴリ内でコードが重複しています。"

    const duplicateLabel = rows.some((row) =>
      row.category === "ランニングコスト" &&
      row.label.trim() === target.label.trim() &&
      (dialogMode === "add" || row.id !== editTarget?.id),
    )
    if (duplicateLabel) return "同一カテゴリ内で費目名が重複しています。"
    return null
  }

  async function handleSave() {
    const payload: Omit<MasterValue, "id"> = { ...form, code: normalizeMasterCode(form.code) }
    const validationError = validateForm(payload)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setIsSaving(true)
    try {
      const endpoint = dialogMode === "add" ? "/api/master/values" : `/api/master/values/${editTarget?.id ?? ""}`
      const method = dialogMode === "add" ? "POST" : "PUT"
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(result?.error?.message || "保存に失敗しました。")
        return
      }
      toast.success(dialogMode === "add" ? "費目を追加しました。" : "費目を更新しました。")
      setDialogOpen(false)
      await load()
    } catch {
      toast.error("保存に失敗しました。")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (confirm("この費目を削除しますか？")) {
      setIsSaving(true)
      try {
        const response = await fetch(`/api/master/values/${id}`, { method: "DELETE" })
        const result = await response.json().catch(() => null)
        if (!response.ok) {
          toast.error(result?.error?.message || "削除に失敗しました。")
          return
        }
        toast.success("費目を削除しました。")
        await load()
        resetPage()
      } catch {
        toast.error("削除に失敗しました。")
      } finally {
        setIsSaving(false)
      }
    }
  }

  const SortIcon =
    sortDir === "asc" ? ChevronUpIcon : sortDir === "desc" ? ChevronDownIcon : ChevronsUpDownIcon

  return (
    <>
      <PageHeader
        title="ランニングコストマスタ"
        description="毎月発生する運営費（人件費・水道光熱費・消耗品費など）を管理します。試算時の初期値として使用されます。"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-7">
          <div className="rounded-lg border border-border bg-card overflow-hidden">

            {/* ヘッダ */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">ランニングコスト費目</p>
                <p className="text-xs text-muted-foreground">
                  毎月発生する運営費費目を管理します。
                </p>
              </div>
              <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={openAdd}>
                <PlusIcon className="size-3.5" />
                追加
              </Button>
            </div>

            {/* 検索バー */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-5 py-3">
              {loadError && (
                <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                  <span>{loadError}</span>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { void load() }}>
                    再試行
                  </Button>
                </div>
              )}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="費目名で検索..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); resetPage() }}
                  className="h-7 w-48 pl-8 text-xs"
                />
              </div>
            </div>

            {/* テーブル */}
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border bg-muted/10">
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    費目名
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={cycleSortDir}
                    >
                      現在の単価
                      <SortIcon className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    デフォルト単価
                  </TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    備考
                  </TableHead>
                  <TableHead className="w-20 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">
                      {isLoading ? "読み込み中..." : "データがありません"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((row) => (
                    <TableRow key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                      <TableCell className="text-xs font-medium text-foreground">{row.label}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.currentAmount.toLocaleString()}
                        <span className="ml-0.5 text-[11px] text-muted-foreground">{row.unit}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {row.defaultAmount.toLocaleString()}
                        <span className="ml-0.5 text-[11px]">{row.unit}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.note}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                            onClick={() => openEdit(row)}
                            aria-label="編集"
                            disabled={isSaving}
                          >
                            <PencilIcon className="size-3.5" />
                          </button>
                          <button
                            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(row.id)}
                            aria-label="削除"
                            disabled={isSaving}
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* フッター */}
            <div className="flex flex-col items-center gap-3 border-t border-border bg-muted/10 px-5 py-3 sm:flex-row sm:justify-between">
              <p className="text-[10px] text-muted-foreground">
                {processed.length > 0
                  ? `${(page - 1) * ROWS_PER_PAGE + 1}–${Math.min(page * ROWS_PER_PAGE, processed.length)} / 全 ${processed.length} 件`
                  : "0 件"}
              </p>
              {totalPages > 1 && (
                <Pagination className="w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)) }}
                        className={page === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                        aria-disabled={page === 1}
                      />
                    </PaginationItem>
                    {getPageNumbers(totalPages, page).map((p, idx) =>
                      p === "ellipsis" ? (
                        <PaginationItem key={`e-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === page}
                            onClick={(e) => { e.preventDefault(); setPage(p) }}
                            className="cursor-pointer text-xs"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)) }}
                        className={page === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                        aria-disabled={page === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 追加・編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {dialogMode === "add" ? "ランニングコスト費目 — 新規追加" : "ランニングコスト費目 — 編集"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">コード</Label>
              <Input
                className="h-8 text-xs"
                placeholder="例: running_electricity"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: normalizeMasterCode(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">費目名</Label>
              <Input
                className="h-8 text-xs"
                placeholder="例: 水道光熱費"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">現在の単価（円）</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  placeholder="例: 150000"
                  value={form.currentAmount || ""}
                  onChange={(e) => setForm((f) => ({ ...f, currentAmount: Number(e.target.value) }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">単位</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="例: 円/月"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">デフォルト単価（円）</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                placeholder="例: 150000"
                value={form.defaultAmount || ""}
                onChange={(e) => setForm((f) => ({ ...f, defaultAmount: Number(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">備考</Label>
              <Textarea
                className="text-xs"
                placeholder="補足や算出根拠など"
                rows={2}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="text-xs" disabled={isSaving}>キャンセル</Button>
            </DialogClose>
            <Button size="sm" className="text-xs" onClick={() => { void handleSave() }} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
