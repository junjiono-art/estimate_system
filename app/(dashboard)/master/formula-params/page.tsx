"use client"

import { FormulaParamsClient } from "@/components/master/formula-params-client"
import { PageHeader } from "@/components/page-header"

export default function FormulaParamsPage() {
  return (
    <>
      <PageHeader
        title="計算式パラメータ"
        description="試算に使用する計算式のインプット値を確認・編集できます。変更後は保存ボタンで反映されます。"
      />
      <FormulaParamsClient />
    </>
  )
}
