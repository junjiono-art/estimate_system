import type { CalcCapacityConfig, LocationType } from "@/lib/types"

export interface CapacityResult {
  /** 実質最大会員数 キャパシティ計算!D18（事業計画のキャパ上限 E4） */
  maxMembers: number
  /** 同時利用人数 D13/D21 = 床面積 / 1人当たり必要面積 */
  concurrentUsers: number
  /** 駐車場必要台数 D23 = ROUND(駐車場利用率 × 同時利用人数) */
  parkingSpaces: number
}

// キャパシティ計算シートの移植。
// D13 = 床面積 / 必要面積、D15 = D13 × 営業時間 × 7、D16 = D15 / (利用回数 × 滞在時間)
// D18 = 平均稼働率 × D16（田舎型は × ruralFactor）
export function computeCapacity(
  floorAreaTsubo: number,
  locationType: LocationType,
  params: CalcCapacityConfig,
): CapacityResult {
  const area = Number.isFinite(floorAreaTsubo) && floorAreaTsubo > 0 ? floorAreaTsubo : 0
  const concurrentUsers = params.areaPerMemberTsubo > 0 ? area / params.areaPerMemberTsubo : 0

  const weeklySlots = concurrentUsers * params.businessHours * 7
  const usageDemand = params.visitsPerWeek * params.avgStayHours
  const capacityBase = usageDemand > 0 ? weeklySlots / usageDemand : 0

  const ruralAdj = locationType === "rural" ? params.ruralFactor : 1
  const maxMembers = capacityBase * params.avgUtilization * ruralAdj

  const parkingSpaces = Math.round(params.parkingUtilization * concurrentUsers)

  return { maxMembers, concurrentUsers, parkingSpaces }
}
