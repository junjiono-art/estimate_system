"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { MasterTable, Badge } from "@/components/master/master-table"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { unitPrices } from "@/lib/mock-data"
import type { UnitPrice } from "@/lib/types"

const columns = [
  {
    key: "category",
    label: "カテゴリ",
    render: (row: UnitPrice) => (
      <Badge
        variant={row.category === "ランニングコスト" ? "secondary" : "default"}
        className="text-xs whitespace-nowrap"
      >
        {row.category}
      </Badge>
    ),
  },
  {
    key: "label",
    label: "費目名",
    render: (row: UnitPrice) => (
      <span className="font-medium text-foreground">{row.label}</span>
    ),
  },
  {
    key: "currentAmount",
    label: "現在の単価",
    className: "text-right" as const,
    render: (row: UnitPrice) => (
      <span className="font-mono text-sm">
        {row.currentAmount.toLocaleString()}
        <span className="ml-0.5 text-[11px] text-muted-foreground">{row.unit}</span>
      </span>
    ),
  },
  {
    key: "defaultAmount",
    label: "デフォルト単価",
    className: "text-right" as const,
    render: (row: UnitPrice) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.defaultAmount.toLocaleString()}
        <span className="ml-0.5 text-[11px]">{row.unit}</span>
      </span>
    ),
  },
  {
    key: "note",
    label: "備考",
    render: (row: UnitPrice) => (
      <span className="text-xs text-muted-foreground">{row.note}</span>
    ),
  },
]

function UnitPriceForm() {
  const [category, setCategory] = useState("")
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>カテゴリ</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ランニングコスト">ランニングコスト</SelectItem>
              <SelectItem value="投資コスト">投資コスト</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>費目名</Label>
          <Input placeholder="例: 水道光熱費" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>単価（円）</Label>
          <Input type="number" placeholder="例: 150000" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>単位</Label>
          <Input placeholder="例: 円/月" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>備考</Label>
        <Textarea placeholder="補足や算出根拠など" rows={2} />
      </div>
    </>
  )
}

export default function UnitPricePage() {
  return (
    <>
      <PageHeader
        title="単価マスタ"
        description="ランニングコスト・投資コストの各費目の単価を管理します。試算時の初期値として使用されます。"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-7">
          <MasterTable
            title="費目単価"
            description="ランニングコスト・投資コストに使用する費目ごとの単価を管理します。"
            data={unitPrices}
            columns={columns}
            searchPlaceholder="費目名で検索..."
            searchKey={(row) => `${row.category} ${row.label}`}
            renderForm={() => <UnitPriceForm />}
          />
        </div>
      </div>
    </>
  )
}
