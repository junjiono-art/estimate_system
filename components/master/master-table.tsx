"use client"

import { useState } from "react"
import { PlusIcon, PencilIcon, TrashIcon, SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

export interface ColumnDef<T> {
  key: string
  label: string
  render: (row: T) => React.ReactNode
  className?: string
}

interface MasterTableProps<T> {
  title: string
  description: string
  data: T[]
  columns: ColumnDef<T>[]
  searchPlaceholder?: string
  searchKey?: (row: T) => string
  renderForm?: () => React.ReactNode
}

export function MasterTable<T extends { id: string }>({
  title,
  description,
  data,
  columns,
  searchPlaceholder = "検索...",
  searchKey,
  renderForm,
}: MasterTableProps<T>) {
  const [search,      setSearch]      = useState("")
  const [dialogOpen,  setDialogOpen]  = useState(false)
  const [dialogMode,  setDialogMode]  = useState<"add" | "edit">("add")

  const filtered = searchKey
    ? data.filter((row) => searchKey(row).toLowerCase().includes(search.toLowerCase()))
    : data

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* テーブルヘッダ */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => { setDialogMode("add"); setDialogOpen(true) }}>
            <PlusIcon className="size-3.5" />
            追加
          </Button>
        </div>

        {/* 検索 */}
        <div className="border-b border-border bg-muted/20 px-5 py-3">
          <div className="relative max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-8 text-xs"
            />
          </div>
        </div>

        {/* テーブル本体 */}
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border bg-muted/10">
              {columns.map((col) => (
                <TableHead key={col.key} className={`text-[10px] font-medium uppercase tracking-wider text-muted-foreground ${col.className ?? ""}`}>
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="w-20 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="py-10 text-center text-xs text-muted-foreground">
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                  {columns.map((col) => (
                    <TableCell key={col.key} className={`text-xs ${col.className ?? ""}`}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                        onClick={() => { setDialogMode("edit"); setDialogOpen(true) }}
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                      <button
                        className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => alert("削除機能は実装後に利用可能になります。")}
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
        <div className="border-t border-border bg-muted/10 px-5 py-2.5">
          <p className="text-[10px] text-muted-foreground">{filtered.length} 件表示 / 全 {data.length} 件</p>
        </div>
      </div>

      {/* ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {dialogMode === "add" ? `${title} — 新規追加` : `${title} — 編集`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {renderForm ? renderForm() : (
              <p className="text-xs text-muted-foreground">フォームは実装後に表示されます。</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="text-xs">キャンセル</Button>
            </DialogClose>
            <Button size="sm" className="text-xs" onClick={() => setDialogOpen(false)}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export { Badge }
