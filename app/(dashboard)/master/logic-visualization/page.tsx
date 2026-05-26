import { PageHeader } from "@/components/page-header"
import { LogicVisualizationView } from "@/components/master/logic-visualization-view"

export default function LogicVisualizationPage() {
  return (
    <>
      <PageHeader
        title="ロジック可視化"
        description="現在アクティブな試算ロジックを閲覧し、試算に使用する係数・定数をこの画面で編集できます。"
      />
      <LogicVisualizationView />
    </>
  )
}
