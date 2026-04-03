import { PageHeader } from "@/components/page-header"
import { ResultTabs } from "@/components/result/result-tabs"
import { demoSimulationResults } from "@/lib/mock-data"

export default function ResultPage() {
  const data = demoSimulationResults[0]

  return (
    <>
      <PageHeader
        title="試算結果"
        description="入力情報をもとにした収益シミュレーション結果です"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-7">
          <ResultTabs data={data} />
        </div>
      </div>
    </>
  )
}
