import { NextResponse } from "next/server"
import { ErrorCode, errorResponse } from "@/lib/server/api-error"
import { calculateSimulation } from "@/lib/server/calc-engine"
import type { SimulationRequestInput } from "@/lib/types"

const SIMULATION_CACHE_TTL_MS = 5 * 60 * 1000
const SIMULATION_CACHE_MAX_ENTRIES = 200

type CachedSimulation = {
  expiresAt: number
  data: ReturnType<typeof calculateSimulation>
}

const simulationCache = new Map<string, CachedSimulation>()

function sanitizeRate(value: unknown): 0 | 10 | 15 {
  const rate = Number(value)
  if (rate === 10 || rate === 15) return rate
  return 0
}

function buildCacheKey(body: Partial<SimulationRequestInput>): string {
  return JSON.stringify({
    storeName: body.storeName?.trim() || "",
    location: body.location?.trim() || "",
    scenario: body.scenario || "standard",
    floorAreaTsubo: Number(body.floorAreaTsubo) || 0,
    rentPerTsubo: Number(body.rentPerTsubo) || 0,
    runningCostTotal: Number(body.runningCostTotal) || 0,
    initialInvestmentTotal: Number(body.initialInvestmentTotal) || 0,
    competitorCount: Number(body.competitorCount) || 0,
    locationType: body.locationType || "suburban",
    includeDepreciation: body.includeDepreciation !== false,
    franchiseRate: sanitizeRate(body.franchiseRate ?? body.royaltyRate),
  })
}

function setCachedSimulation(key: string, data: ReturnType<typeof calculateSimulation>) {
  if (simulationCache.size >= SIMULATION_CACHE_MAX_ENTRIES) {
    const oldestKey = simulationCache.keys().next().value
    if (oldestKey) simulationCache.delete(oldestKey)
  }

  simulationCache.set(key, {
    expiresAt: Date.now() + SIMULATION_CACHE_TTL_MS,
    data,
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<SimulationRequestInput> | null

  if (!body?.storeName?.trim()) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, "storeName は必須です。", 400)
  }

  if (body.scenario && !["conservative", "standard", "aggressive"].includes(body.scenario)) {
    return errorResponse(
      ErrorCode.VALIDATION_ERROR,
      "scenario は conservative / standard / aggressive のいずれかを指定してください。",
      400,
    )
  }

  try {
    const cacheKey = buildCacheKey(body)
    const cached = simulationCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        {
          success: true,
          data: cached.data,
        },
        {
          status: 200,
          headers: { "x-sim-cache": "HIT" },
        },
      )
    }

    if (cached && cached.expiresAt <= Date.now()) {
      simulationCache.delete(cacheKey)
    }

    const result = calculateSimulation({
      ...body,
      storeName: body.storeName,
    })

    setCachedSimulation(cacheKey, result)

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        status: 200,
        headers: { "x-sim-cache": "MISS" },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "試算に失敗しました。"
    return errorResponse(ErrorCode.INTERNAL_ERROR, message, 500)
  }
}
