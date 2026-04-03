"use client"

import { PageHeader } from "@/components/page-header"
import { MasterTable } from "@/components/master/master-table"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { areaRents } from "@/lib/mock-data"
import type { AreaRent } from "@/lib/types"

const columns = [
  {
    key: "prefecture",
    label: "都道府県",
    render: (row: AreaRent) => (
      <span className="font-medium text-foreground">{row.prefecture}</span>
    ),
  },
  {
    key: "city",
    label: "市区町村",
    render: (row: AreaRent) => <span className="text-foreground">{row.city}</span>,
  },
  {
    key: "rent",
    label: "坪単価",
    className: "text-right" as const,
    render: (row: AreaRent) => (
      <span className="font-mono text-sm">
        {row.averageRentPerTsubo.toLocaleString()}円/坪
      </span>
    ),
  },
]

function AreaRentForm() {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label>都道府県</Label>
        <Input placeholder="例: 東京都" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>市区町村</Label>
        <Input placeholder="例: 渋谷区" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>坪単価（円）</Label>
        <Input type="number" placeholder="35000" />
      </div>
    </>
  )
}

export default function AreaRentPage() {
  return (
    <>
      <PageHeader
        title="エリア賃料マスタ"
        description="地域ごとの坪単価を管理します。試算時の賃料自動入力に使用されます。"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-7">
          <MasterTable
            title="エリア賃料相場"
            description="地域ごとの坪単価目安を管理します。試算時の賃料自動入力に使用されます。"
            data={areaRents}
            columns={columns}
            searchPlaceholder="都道府県・市区町村で検索..."
            searchKey={(row) => `${row.prefecture} ${row.city}`}
            renderForm={() => <AreaRentForm />}
          />
        </div>
      </div>
    </>
  )
}
