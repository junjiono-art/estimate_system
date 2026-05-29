import { ErrorCode } from "@/lib/server/api-error"
import { invokeLambdaGateway } from "@/lib/server/lambda-gateway"
import { DEFAULT_CALC_PARAMS, normalizeCalcParams } from "@/lib/default-calc-params"
import type { CalcParameterConfig } from "@/lib/types"

const lambdaCalcParamsBasePath = process.env.LAMBDA_CALC_PARAMS_BASE_PATH?.trim() || "/api/master/calc-params"

type CalcParamsResponse = {
  params: CalcParameterConfig
}

let cachedParams: CalcParameterConfig | null = null
let cachedAt = 0
const CACHE_TTL_MS = 60 * 1000

export function invalidateCalcParamsCache(): void {
  cachedParams = null
  cachedAt = 0
}

export async function getCalcParamsFromDb(options?: {
  forceRefresh?: boolean
  fallbackOnError?: boolean
}): Promise<CalcParameterConfig> {
  const now = Date.now()
  if (!options?.forceRefresh && cachedParams && now - cachedAt < CACHE_TTL_MS) {
    return cachedParams
  }

  const result = await invokeLambdaGateway<CalcParamsResponse>({
    method: "GET",
    path: lambdaCalcParamsBasePath,
  })

  if (!result.ok || !result.data?.params) {
    const code = result.errorCode || ErrorCode.EXTERNAL_API_ERROR
    const message = result.errorMessage || "計算パラメータの取得に失敗しました。"
    if (options?.fallbackOnError) {
      console.warn(
        `[calc-params] Lambdaから計算パラメータを取得できませんでした。デフォルト値で試算を継続します: ${code}: ${message}`,
        result.errorDetails ?? "",
      )
      return DEFAULT_CALC_PARAMS
    }
    throw new Error(`${code}: ${message}`)
  }

  cachedParams = normalizeCalcParams(result.data.params)
  cachedAt = now
  return cachedParams
}
