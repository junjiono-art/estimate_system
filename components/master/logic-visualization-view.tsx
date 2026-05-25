"use client"

import { useEffect, useState } from "react"
import { AlertTriangleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type LogicVisualizationResponse = {
  generatedAt: string
  source: {
    hasLambdaGateway: boolean
    formulaSetSource: string
  }
  activeFormulaSet: {
    setVersion: string
    status: string
    comment: string
    createdBy: string
    createdAt: string
    basedOnVersion?: string
  } | null
  summary: {
    formulaCount: number
    variableCount: number
    dependencyCount: number
  }
  formulas: Array<{
    key: string
    label: string
    tokenCount: number
    expression: string
    inputVars: string[]
    dependsOn: string[]
    phase: "pre" | "monthly" | "post"
  }>
  variables: Array<{
    key: string
    label: string
    source: string
    unit?: string
    description?: string
  }>
  dependencies: Array<{
    key: string
    label: string
    dependsOn: string[]
    phase: "pre" | "monthly" | "post"
  }>
  warnings: string[]
}

function MetaCard({ title, value, note }: { title: string; value: string | number; note?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
      {note ? (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{note}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function LogicVisualizationView() {
  const [data, setData] = useState<LogicVisualizationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/master/logic-visualization", { cache: "no-store" })
        const payload = (await response.json().catch(() => null)) as LogicVisualizationResponse | { error?: { message?: string } } | null

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "error" in payload && payload.error?.message
              ? payload.error.message
              : "ロジック可視化データの取得に失敗しました。"
          if (!disposed) setError(message)
          return
        }

        if (!disposed) setData(payload as LogicVisualizationResponse)
      } catch (err) {
        const message = err instanceof Error ? err.message : "ロジック可視化データの取得に失敗しました。"
        if (!disposed) setError(message)
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    void load()

    return () => {
      disposed = true
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>データ取得エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-4 p-6">
      {data.warnings.length > 0 ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>注意事項</AlertTitle>
          <AlertDescription>
            {data.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetaCard
          title="アクティブ式セット"
          value={data.activeFormulaSet?.setVersion || "未取得"}
          note={data.activeFormulaSet?.status || "status: unknown"}
        />
        <MetaCard title="式数" value={data.summary.formulaCount} />
        <MetaCard title="変数数" value={data.summary.variableCount} />
        <MetaCard
          title="取得時刻"
          value={new Date(data.generatedAt).toLocaleString("ja-JP")}
          note={data.source.formulaSetSource}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>式一覧</CardTitle>
          <CardDescription>現在アクティブな式セットに含まれる定義（閲覧専用）</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>キー</TableHead>
                <TableHead>ラベル</TableHead>
                <TableHead>フェーズ</TableHead>
                <TableHead>依存</TableHead>
                <TableHead className="min-w-[360px]">式</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.formulas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    取得可能な式セットがありません。
                  </TableCell>
                </TableRow>
              ) : (
                data.formulas.map((formula) => (
                  <TableRow key={formula.key}>
                    <TableCell className="font-mono text-xs">{formula.key}</TableCell>
                    <TableCell>{formula.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{formula.phase}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formula.dependsOn.length > 0 ? formula.dependsOn.join(", ") : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-normal">{formula.expression || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>変数定義</CardTitle>
            <CardDescription>入力・定数・派生値・地理情報の一覧</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>キー</TableHead>
                  <TableHead>ラベル</TableHead>
                  <TableHead>ソース</TableHead>
                  <TableHead>単位</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.variables.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-mono text-xs">{item.key}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.source}</TableCell>
                    <TableCell>{item.unit || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>依存関係</CardTitle>
            <CardDescription>式同士の依存定義（デフォルト定義ベース）</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>キー</TableHead>
                  <TableHead>フェーズ</TableHead>
                  <TableHead>依存先</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dependencies.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-mono text-xs">{item.key}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.phase}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.dependsOn.length > 0 ? item.dependsOn.join(", ") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
