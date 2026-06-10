import type { CalcMachineMaintenanceConfig, CalcMachineMaintenanceTsuboTier } from "@/lib/types"
import { extractPrefectureFromAddress } from "@/lib/fitness-machine-cost"

/**
 * 坪数に該当する作業人数・日数の行を返す（入力欄 N19/P19 の IF カスケード相当）。
 * floorAreaTsubo 以下で最大の minTsubo を持つ行を採用。該当が無ければ最小行。
 */
export function resolveMaintenanceTsuboTier(
  tiers: CalcMachineMaintenanceTsuboTier[],
  floorAreaTsubo: number,
): CalcMachineMaintenanceTsuboTier | null {
  if (!Array.isArray(tiers) || tiers.length === 0) return null
  const sorted = [...tiers].sort((a, b) => a.minTsubo - b.minTsubo)
  let chosen = sorted[0]
  for (const tier of sorted) {
    if (floorAreaTsubo >= tier.minTsubo) chosen = tier
  }
  return chosen
}

/**
 * 都道府県別のメンテ単価（入力欄 Q列）を解決する。
 *   1. Q列が手入力固定値で上書きされている県 → その固定値を採用（unitPriceByPrefecture）
 *   2. それ以外（Q=P/2 の式の県） → 拠点(愛知)からの距離(L列)連動で算出
 *        M = ROUNDDOWN(L, -2)       → Math.floor(距離 / distanceStepKm) × distanceStepKm
 *        N = M / distanceStepKm
 *        O = N × distanceStepCost
 *        P = baseUnitPrice + O      （入力欄 P=$L$47+O）
 *        Q = P / unitPriceDivisor   （入力欄 Q=P/2）
 *   3. 距離も固定値も無い → fallbackUnitPrice
 */
export function resolveMaintenanceUnitPrice(
  prefecture: string | null,
  config: CalcMachineMaintenanceConfig,
): number {
  // 1. 手入力固定値の上書き（Excel で式を外して直接入力されている県）
  const override = prefecture ? config.unitPriceByPrefecture?.[prefecture] : undefined
  if (override != null && Number.isFinite(Number(override))) {
    return Math.max(0, Number(override))
  }

  // 2. 距離連動の計算（Q=P/2 の式の県）
  const distance = prefecture ? config.distanceByPrefecture?.[prefecture] : undefined
  if (distance != null && Number.isFinite(Number(distance))) {
    const stepKm = Math.max(1, Number(config.distanceStepKm) || 100)
    const stepCost = Math.max(0, Number(config.distanceStepCost) || 0)
    const base = Math.max(0, Number(config.baseUnitPrice) || 0)
    const divisor = Math.max(1, Number(config.unitPriceDivisor) || 1)

    const n = Math.floor(Math.max(0, Number(distance)) / stepKm) // M/distanceStepKm = ROUNDDOWN(L,-2)/100
    const o = n * stepCost
    const p = base + o
    return p / divisor
  }

  // 3. フォールバック（都道府県が取れない／表に無い）
  return Math.max(0, Number(config.fallbackUnitPrice) || 0)
}

/**
 * マシンメンテナンス費の月額を算出する（入力欄 B34 を移植）。
 *   1回費用 = 都道府県別単価(K23) × 作業人数(N19) × 作業日数(P19)
 *   月額    = 1回費用 ÷ 実施間隔(ヶ月)
 * FC（ロイヤリティ>0）のときのみ計上する設定にも対応（Excel C34=IF(C73=0,0,…)）。
 */
export function computeMachineMaintenanceMonthly(args: {
  address?: string
  floorAreaTsubo: number
  royaltyRate: number
  config: CalcMachineMaintenanceConfig | undefined
}): number {
  const { address, floorAreaTsubo, royaltyRate, config } = args
  if (!config) return 0

  // 直営（ロイヤリティ=0）は計上しない（Excel C73=0→0）
  if (config.applyOnlyWhenFranchise && royaltyRate <= 0) return 0

  const interval = Math.max(1, Number(config.intervalMonths) || 1)

  // 都道府県別単価（入力欄 Q列）。固定値上書きが無ければ距離(L列)連動で算出
  const prefecture = extractPrefectureFromAddress(address)
  const unitPrice = resolveMaintenanceUnitPrice(prefecture, config)

  // 坪数帯から作業人数・日数を決定
  const tier = resolveMaintenanceTsuboTier(config.tsuboTiers, Number(floorAreaTsubo) || 0)
  if (!tier) return 0

  const workers = Math.max(0, Number(tier.workers) || 0)
  const days = Math.max(0, Number(tier.days) || 0)

  const perVisit = unitPrice * workers * days
  return Math.round(perVisit / interval)
}
