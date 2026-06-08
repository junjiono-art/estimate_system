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

  // 都道府県別単価（メンテ専用テーブル。取れなければフォールバック単価）
  const prefecture = extractPrefectureFromAddress(address)
  const prefUnitPrice = prefecture ? config.unitPriceByPrefecture?.[prefecture] : undefined
  const unitPrice = Math.max(
    0,
    Number(prefUnitPrice ?? config.fallbackUnitPrice) || 0,
  )

  // 坪数帯から作業人数・日数を決定
  const tier = resolveMaintenanceTsuboTier(config.tsuboTiers, Number(floorAreaTsubo) || 0)
  if (!tier) return 0

  const workers = Math.max(0, Number(tier.workers) || 0)
  const days = Math.max(0, Number(tier.days) || 0)

  const perVisit = unitPrice * workers * days
  return Math.round(perVisit / interval)
}
