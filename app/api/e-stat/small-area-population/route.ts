import { NextResponse } from "next/server"
import { aggregateSmallAreaPopulation } from "@/lib/server/small-area"

/**
 * 指定地点（緯度経度）から半径1km/3km/5km圏の男女・年齢別人口を集計して返す。
 *
 * 旧 /api/e-stat/mesh-population の置き換え。
 * e-Stat の統計表APIは市区町村が最小粒度でメッシュ統計を持たず（統計GIS用のAPIも存在しない）、
 * メッシュ統計にはそもそも5歳階級が無い。そのため統計GISから取り込んだ小地域データを
 * サーバ側で円集計する方式に変更した。詳細は lib/server/small-area.ts と
 * scripts/build-small-area-data.mjs を参照。
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    latitude?: number
    longitude?: number
  } | null

  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "latitude と longitude は必須です。" }, { status: 400 })
  }

  try {
    const result = aggregateSmallAreaPopulation(latitude, longitude)

    // 商圏に町丁字が1件も掛からない場合（海上・国外など）は概算に落とさず失敗させる。
    // 無音フォールバックで Excel と無関係な会員数が出る事故を防ぐ（doc/不具合一覧.md #32）。
    if (result.cumulative.km5 <= 0) {
      return NextResponse.json(
        {
          error:
            "指定地点の半径5km圏に人口データのある町丁・字が見つかりませんでした。住所を確認してください。",
        },
        { status: 502 },
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "商圏人口の集計に失敗しました。"
    const missingData = message.startsWith("SMALL_AREA_DATA_MISSING:")
    return NextResponse.json(
      { error: missingData ? message.replace("SMALL_AREA_DATA_MISSING:", "").trim() : message },
      { status: missingData ? 500 : 502 },
    )
  }
}
