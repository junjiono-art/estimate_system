import type { CalcDeviceCountRule, CalcSecurityConfig } from "@/lib/types"

// ── ALSOK・USEN導入費（投資コスト。元Excel 入力欄 B16/J16）──
// J16 = ROUNDUP(SUM(M13:M17), -4)
//   M13 Wifi 81,000 ／ M14 スピーカー 170,000 ／ M16 ALSOK 95,000（固定額）
//   M15 = 110,000 × カメラ台数(D26) ／ M17 = 170,000 × サイネージ台数(D28)
// D26/D28 はランニングコスト行（防犯カメラ(USEN)・モニター(USEN)）と共有の台数セル。

/** 投資コスト内訳でALSOK・USEN導入費を表すフィールドID（マスタ investment_security） */
export const SECURITY_FIELD_ID = "securityCost"

// ── ALSOK・USEN導入費（投資コスト）の費目メタ情報 ──
// 投資コストはマスタ(DB)駆動だが、マスタに費目が無くてもアプリ側で常に項目を供給するための定数。
// 実額は坪数×計算パラメータ（CalcSecurityConfig）から算出するため、マスタの登録金額には依存しない。
export const SECURITY_CODE = "investment_security"
export const SECURITY_LABEL = "ALSOK/USEN導入費"
export const SECURITY_UNIT = "円"

// ── 防犯カメラ(USEN)・モニター(USEN)（ランニングコスト。元Excel R26/R28）──
// 月額 = 単価 × 台数。台数（D26/D28）は投資側ALSOK・USEN導入費のカメラ/サイネージ台数式と共有のため、
// マスタの数量×単価ではカバーできず、アプリ側の固定枠として坪数から自動算出する。
export const SECURITY_CAMERA_RUNNING_FIELD_ID = "rcSecurityCamera"
export const SECURITY_CAMERA_RUNNING_LABEL = "防犯カメラ(USEN)"
export const SECURITY_MONITOR_RUNNING_FIELD_ID = "rcSecurityMonitor"
export const SECURITY_MONITOR_RUNNING_LABEL = "モニター(USEN)"
export const SECURITY_RUNNING_UNIT = "円/月"
/** 月額単価の既定値（元Excel R26/R28: 2,500円/台/月） */
export const SECURITY_CAMERA_MONTHLY_UNIT_PRICE = 2_500
export const SECURITY_MONITOR_MONTHLY_UNIT_PRICE = 2_500

/**
 * 機器台数の階段式（入力欄 D26/D28 の ROUNDUP を移植）。
 *   台数 = ROUNDUP(基準台数 + (坪数 − 基準坪数) ÷ 坪刻み, 0)
 * 例: カメラ(基準5台/50坪/17坪刻み) → 50坪=5台, 51坪=6台, 67坪=6台, 100坪=8台
 */
export function computeDeviceCount(floorAreaTsubo: number, rule: CalcDeviceCountRule | undefined): number {
  if (!rule) return 0
  const tsubo = Math.max(0, Number(floorAreaTsubo) || 0)
  const baseCount = Math.max(0, Number(rule.baseCount) || 0)
  const baseTsubo = Math.max(0, Number(rule.baseTsubo) || 0)
  const per = Number(rule.tsuboPerUnit)
  if (!Number.isFinite(per) || per <= 0) return baseCount
  return Math.max(0, Math.ceil(baseCount + (tsubo - baseTsubo) / per))
}

/**
 * ALSOK・USEN導入費（投資コスト）を算出する（入力欄 J16 を移植）。
 *   取得額 = ROUNDUP( 固定額合計 + カメラ単価×台数 + サイネージ単価×台数, 丸め単位 )
 * 検算: 50坪 → 346,000 + 110,000×5 + 170,000×4 = 1,576,000 → 万円切り上げ 1,580,000（Excel一致）
 */
export function computeSecurityIntroCost(floorAreaTsubo: number, config: CalcSecurityConfig | undefined): number {
  if (!config) return 0
  const fixedTotal = (config.fixedItems ?? []).reduce(
    (sum, item) => sum + Math.max(0, Number(item?.amount) || 0),
    0,
  )
  const cameraCount = computeDeviceCount(floorAreaTsubo, config.cameraCountRule)
  const monitorCount = computeDeviceCount(floorAreaTsubo, config.monitorCountRule)
  const total =
    fixedTotal +
    cameraCount * Math.max(0, Number(config.cameraUnitPrice) || 0) +
    monitorCount * Math.max(0, Number(config.monitorUnitPrice) || 0)
  const unit = Math.max(1, Math.round(Number(config.roundUpUnit) || 1))
  return Math.ceil(total / unit) * unit
}
