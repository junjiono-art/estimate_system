import { PageHeader } from "@/components/page-header"
import { FormulaEditor } from "@/components/master/formula-editor"

export const metadata = {
  title: "計算式編集 | FitCalc",
  description: "試算エンジンで使用される計算式をGUIで確認・編集します。",
}

export default function FormulaEditorPage() {
  return (
    <>
      <PageHeader
        title="計算式編集"
        description="レベル2: 試算エンジンの計算式をGUIで確認・編集します。保存後、次回試算から反映されます。"
      />
      <div className="overflow-auto">
        <FormulaEditor />
      </div>
    </>
  )
}
