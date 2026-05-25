import { PageHeader } from "@/components/page-header"
import { LogicVisualizationView } from "@/components/master/logic-visualization-view"

export default function LogicVisualizationPage() {
  return (
    <>
      <PageHeader
        title="ロジック可視化"
        description="現在アクティブな試算ロジックを閲覧します。編集は次フェーズで対応予定です。"
      />
      <LogicVisualizationView />
    </>
  )
}
