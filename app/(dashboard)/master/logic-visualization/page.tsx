import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { LogicVisualizationView } from "@/components/master/logic-visualization-view"

export default function LogicVisualizationPage() {
  return (
    <>
      <PageHeader
        title="ロジック可視化"
        description="現在アクティブな試算ロジックを閲覧し、phase 2-① の手数料・上限パラメータを編集できます。"
        actions={
          <Button asChild size="sm" className="h-8 text-xs">
            <Link href="/master/calc-params">計算パラメータを編集</Link>
          </Button>
        }
      />
      <LogicVisualizationView />
    </>
  )
}
