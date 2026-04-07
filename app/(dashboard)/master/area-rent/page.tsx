"use client"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function AreaRentPage() {
  return (
    <>
      <PageHeader
        title="エリア統計連携"
        description="地域別賃料相場はマスタ管理せず、試算実行時に外部APIから取得する方針です。"
      />
      <div className="overflow-auto">
        <div className="mx-auto max-w-4xl px-8 py-7">
          <Card className="border-border shadow-none">
            <CardHeader>
              <CardTitle>現在の仕様</CardTitle>
              <CardDescription>
                エリア賃料相場のDynamoDBマスタは作成せず、住所をもとに統計APIを呼び出して試算時に必要な値を取得します。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>この画面は旧「エリア賃料マスタ」運用の名残です。現在は固定マスタの登録・編集は行いません。</p>
              <p>保存対象はAPIレスポンスそのものではなく、試算に使用した賃料単価のみです。</p>
              <p>将来的にAPI制限やレスポンス速度が課題になった場合のみ、キャッシュ用テーブルの追加を検討します。</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
