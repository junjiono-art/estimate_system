"use client"

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
import { franchiseCosts } from "@/lib/mock-data"
import type { FranchiseCost } from "@/lib/types"

const columns = [
  {
    key: "label",
    label: "費目",
    render: (row: FranchiseCost) => (
      <span className="font-medium text-foreground">{row.label}</span>
    ),
  },
  {
    key: "type",
    label: "種別",
    render: (row: FranchiseCost) => (
      <Badge variant={row.type === "初期" ? "default" : "secondary"} className="text-xs">
        {row.type}
      </Badge>
    ),
  },
  {
    key: "amount",
    label: "金額",
    className: "text-right" as const,
    render: (row: FranchiseCost) => (
      <span className="font-mono text-sm">{row.amount.toLocaleString()}円</span>
    ),
  },
  {
    key: "note",
    label: "備考",
    render: (row: FranchiseCost) => (
      <span className="text-xs text-muted-foreground">{row.note}</span>
    ),
  },
]

function FranchiseCostForm() {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>費目名</Label>
        <Input placeholder="例: 加盟金" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>種別</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="初期">初期</SelectItem>
              <SelectItem value="月額">月額</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>金額（円）</Label>
          <Input type="number" placeholder="3000000" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>備考</Label>
        <Textarea placeholder="条件や備考など" rows={2} />
      </div>
    </>
  )
}

export default function FranchisePage() {
  return (
    <>
      <PageHeader
        title="FC費用マスタ"
        description="フランチャイズ契約に伴う初期費用・月額費用を管理します。"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-7">
          <MasterTable
            title="FC費用"
            description="フランチャイズ契約に伴う初期費用・月額費用を管理します。"
            data={franchiseCosts}
            columns={columns}
            searchPlaceholder="費目名で検索..."
            searchKey={(row) => row.label}
            renderForm={() => <FranchiseCostForm />}
          />
        </div>
      </div>
    </>
  )
}
