import type { FormulaSetRecordLike } from "@/lib/formula-types"
import type { SimulationResult } from "@/lib/types"

// 試算結果キャッシュ（buildCacheKey の文字列キー → 計算結果）
type CachedSimulation = {
  expiresAt: number
  data: SimulationResult
}

export const SIMULATION_CACHE_TTL_MS = 5 * 60 * 1000
export const SIMULATION_CACHE_MAX_ENTRIES = 200
export const simulationCache = new Map<string, CachedSimulation>()

// アクティブ式セット（formulaSet）のキャッシュ
export const FORMULA_SET_CACHE_TTL_MS = 60 * 1000
let cachedActiveFormulaSet: FormulaSetRecordLike | undefined = undefined
let cachedActiveFormulaSetAt = 0

export function getCachedActiveFormulaSet(): { value: FormulaSetRecordLike | undefined; cachedAt: number } {
  return { value: cachedActiveFormulaSet, cachedAt: cachedActiveFormulaSetAt }
}

export function setCachedActiveFormulaSet(value: FormulaSetRecordLike): void {
  cachedActiveFormulaSet = value
  cachedActiveFormulaSetAt = Date.now()
}

export function invalidateActiveFormulaSetCache(): void {
  cachedActiveFormulaSet = undefined
  cachedActiveFormulaSetAt = 0
}

export function invalidateSimulationCache(): void {
  simulationCache.clear()
}
