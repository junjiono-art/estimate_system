import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { hasLambdaGatewayConfigured, invokeLambdaGateway } from "@/lib/server/lambda-gateway"
import { DEFAULT_REPORT_EXPORT_CONFIG, normalizeReportExportConfig } from "@/lib/default-report-export"
import type { ReportExportConfig } from "@/lib/types"

export const runtime = "nodejs"

const lambdaReportExportBasePath = process.env.LAMBDA_REPORT_EXPORT_BASE_PATH?.trim() || "/master/report-export"

export async function GET() {
  try {
    // Lambda 未設定時は既定値を返す（出力機能は常に動作させる）。
    if (!hasLambdaGatewayConfigured()) {
      return NextResponse.json({ config: DEFAULT_REPORT_EXPORT_CONFIG })
    }

    const result = await invokeLambdaGateway<{ config: Partial<ReportExportConfig> }>({
      method: "GET",
      path: lambdaReportExportBasePath,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "レポート出力設定の取得に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    return NextResponse.json({ config: normalizeReportExportConfig(result.data.config) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "レポート出力設定の取得に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ReportExportConfig> | null

  if (!body || typeof body !== "object") {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "更新内容が不正です。", 400)
  }

  try {
    if (!hasLambdaGatewayConfigured()) {
      return errorResponse(ErrorCode.EXTERNAL_API_ERROR, "LAMBDA_API_BASE_URL が未設定のため保存できません。", 500)
    }

    // 不正値を弾くため正規化してから保存する。
    const normalized = normalizeReportExportConfig(body)

    const result = await invokeLambdaGateway<{ config: Partial<ReportExportConfig> }>({
      method: "PUT",
      path: lambdaReportExportBasePath,
      body: normalized,
    })

    if (!result.ok || !result.data) {
      return errorResponse(
        ErrorCode.INTERNAL_ERROR,
        result.errorMessage || "レポート出力設定の更新に失敗しました。",
        result.status || 502,
        { upstreamCode: result.errorCode, upstreamDetails: result.errorDetails },
      )
    }

    return NextResponse.json({ config: normalizeReportExportConfig(result.data.config) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "レポート出力設定の更新に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
