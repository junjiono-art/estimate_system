"use client"

import { useState } from "react"
import { PlusIcon, PencilIcon, TrashIcon, SearchIcon, StoreIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { stores as initialStores } from "@/lib/mock-data"
import type { Store } from "@/lib/types"

const ROWS_PER_PAGE = 10

const emptyStore = (): Omit<Store, "id"> => ({
  name: "",
  address: "",
  openedAt: "",
  note: "",
})

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

export default function StoresPage() {
  const [data, setData] = useState<Store[]>(initialStores)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [editTarget, setEditTarget] = useState<Store | null>(null)
  const [form, setForm] = useState<Omit<Store, "id">>(emptyStore())

  // 絞り込み
  const filtered = data.filter((s) =>
    `${s.name} ${s.address}`.toLowerCase().includes(search.toLowerCase()),
  )

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE)
  const paged = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)

  function resetPage() { setCurrentPage(1) }

  function openAdd() {
    setDialogMode("add")
    setEditTarget(null)
    setForm(emptyStore())
    setDialogOpen(true)
  }

  function openEdit(store: Store) {
    setDialogMode("edit")
    setEditTarget(store)
    setForm({ name: store.name, address: store.address, openedAt: store.openedAt, note: store.note })
    setDialogOpen(true)
  }

  function handleSave() {
    if (!form.name || !form.address || !form.openedAt) return
    if (dialogMode === "add") {
      const newStore: Store = { id: `s${Date.now()}`, ...form }
      setData((prev) => [newStore, ...prev])
      setCurrentPage(1)
    } else if (editTarget) {
      setData((prev) =>
        prev.map((s) => (s.id === editTarget.id ? { ...s, ...form } : s)),
      )
    }
    setDialogOpen(false)
  }

  function handleDelete(id: string) {
    setData((prev) => prev.filter((s) => s.id !== id))
    resetPage()
  }

  function formatDate(iso: string) {
    if (!iso) return "—"
    const [y, m, d] = iso.split("-")
    return `${y}年${m}月${d}日`
  }

  return (
    <>
      <PageHeader
        title="出店済み店舗マスタ"
        description="出店済みの店舗一覧を管理します。"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-7">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {/* ヘッダ */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">出店済み店舗一覧</p>
                <p className="text-xs text-muted-foreground">住所・店舗名・出店日を管理します。</p>
              </div>
              <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={openAdd}>
                <PlusIcon className="size-3.5" />
                追加
              </Button>
            </div>

            {/* 検索 */}
            <div className="border-b border-border bg-muted/20 px-5 py-3">
              <div className="relative max-w-xs">
                <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="店舗名・住所で検索..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); resetPage() }}
                  className="h-7 pl-8 text-xs"
                />
              </div>
            </div>

            {/* テーブル */}
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border bg-muted/10">
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    店舗名
                  </TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    住所
                  </TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    出店日
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
                    <TableCell colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <StoreIcon className="size-8 opacity-30" />
                        <span className="text-xs">店舗データがありません</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((store) => (
                    <TableRow key={store.id} className="border-b border-border/50 hover:bg-muted/20">
                      <TableCell className="text-xs font-medium text-foreground">
                        {store.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {store.address}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {formatDate(store.openedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {store.note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                            onClick={() => openEdit(store)}
                            aria-label="編集"
                          >
                            <PencilIcon className="size-3.5" />
                          </button>
                          <button
                            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(store.id)}
                            aria-label="削除"
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
            <div className="border-t border-border bg-muted/10 px-5 py-2.5 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                {filtered.length > 0
                  ? `${(currentPage - 1) * ROWS_PER_PAGE + 1}–${Math.min(currentPage * ROWS_PER_PAGE, filtered.length)} / 全 ${filtered.length} 件`
                  : "0 件"}
              </p>
              {totalPages > 1 && (
                <Pagination className="w-auto mx-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.max(1, p - 1)) }}
                        className={currentPage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                        aria-disabled={currentPage === 1}
                      />
                    </PaginationItem>
                    {getPageNumbers(totalPages, currentPage).map((page, idx) =>
                      page === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={page === currentPage}
                            onClick={(e) => { e.preventDefault(); setCurrentPage(page) }}
                            className="cursor-pointer text-xs"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); setCurrentPage((p) => Math.min(totalPages, p + 1)) }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                        aria-disabled={currentPage === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 追加 / 編集ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {dialogMode === "add" ? "店舗を新規追加" : "店舗情報を編集"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                店舗名 <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="例: FitGym 渋谷店"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                住所 <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="例: 東京都渋谷区渋谷1-1-1 ○○ビル3F"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                出店日 <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={form.openedAt}
                onChange={(e) => setForm((f) => ({ ...f, openedAt: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">備考</Label>
              <Input
                placeholder="例: FC契約、独立経営 など"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="text-xs">キャンセル</Button>
            </DialogClose>
            <Button
              size="sm"
              className="text-xs"
              onClick={handleSave}
              disabled={!form.name || !form.address || !form.openedAt}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
