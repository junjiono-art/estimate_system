import type { CalcOpeningPackageConfig, OpeningPackageBreakdown } from "@/lib/types"

// ── 開業前パッケージ費（投資コスト。元Excel 入力欄 B15/I15/J15）──
// I15 = ROUND(1400000 + (H3 - 50) * 10000, -5)      H3 = 入力坪数
// J15 = IF(C73 = 0, I15 * 0.5 + 200000, I15)        C73 = ロイヤリティ率（0 = 直営）
//
// つまり「基準額（50坪時）＋ 基準坪からの増減 × 坪単価」を10万円単位で丸め、
// 直営（ロイヤリティ0%）のみ半額にしたうえで定額を上乗せする。
// 従来はマスタ登録の固定額（FC 1,100,000 / 直営 550,000）で坪数に連動していなかった。

/** 投資コスト内訳で開業前パッケージ費を表すフィールドID（マスタ investment_opening_package） */
export const OPENING_PACKAGE_FIELD_ID = "openingPackageCost"

// ── 費目メタ情報 ──
// 投資コストはマスタ(DB)駆動だが、マスタに費目が無くてもアプリ側で常に項目を供給するための定数。
// 実額は坪数×ロイヤリティ×計算パラメータから算出するため、マスタの登録金額には依存しない。
export const OPENING_PACKAGE_CODE = "investment_opening_package"
export const OPENING_PACKAGE_LABEL = "開業前パッケージ費"
export const OPENING_PACKAGE_UNIT = "円"

/**
 * 丸め単位（円）から Excel の ROUND(x, digits) の digits を求める。
 * 例: 100,000 → -5、10,000 → -4、1 → 0。表示・説明用。
 */
export function roundUnitToDigits(roundUnit: number): number {
  const unit = Math.max(1, Math.round(Number(roundUnit) || 1))
  return -Math.round(Math.log10(unit))
}

/**
 * 開業前パッケージ費の内訳を算出する（入力欄 I15/J15 を移植）。
 *
 * 1. 丸め前額  = baseAmount + (坪数 − baseTsubo) × amountPerTsubo
 * 2. I15       = 丸め前額を roundUnit 単位で四捨五入（Excel ROUND 相当。負値は 0 で下支え）
 * 3. J15       = 直営なら I15 × directRateFactor + directRateAddition、FC ならそのまま
 *
 * 検算（既定パラメータ）:
 *   50坪 FC   → 1,400,000（Excel I15/J15 一致）
 *   50坪 直営 → 1,400,000×0.5+200,000 = 900,000（Excel J15 一致）
 *   76坪 FC   → ROUND(1,660,000,-5) = 1,700,000
 */
export function computeOpeningPackageBreakdown(
  floorAreaTsubo: number,
  royaltyRate: 0 | 10 | 15,
  config: CalcOpeningPackageConfig | undefined,
): OpeningPackageBreakdown | null {
  if (!config) return null

  const tsubo = Math.max(0, Number(floorAreaTsubo) || 0)
  const baseAmount = Number(config.baseAmount) || 0
  const baseTsubo = Math.max(0, Number(config.baseTsubo) || 0)
  const amountPerTsubo = Number(config.amountPerTsubo) || 0
  const roundUnit = Math.max(1, Math.round(Number(config.roundUnit) || 1))

  const rawAmount = baseAmount + (tsubo - baseTsubo) * amountPerTsubo
  // Excel ROUND は算術丸め（0.5切り上げ）。マイナスの取得額はありえないため 0 で下支えする。
  const roundedAmount = Math.max(0, Math.round(rawAmount / roundUnit) * roundUnit)

  const isDirect = royaltyRate === 0
  const directRateFactor = Number(config.directRateFactor)
  const directRateAddition = Number(config.directRateAddition) || 0
  const factor = Number.isFinite(directRateFactor) ? directRateFactor : 1
  const total = isDirect
    ? Math.max(0, Math.round(roundedAmount * factor + directRateAddition))
    : roundedAmount

  return {
    baseAmount,
    baseTsubo,
    amountPerTsubo,
    floorAreaTsubo: tsubo,
    rawAmount,
    roundUnit,
    roundedAmount,
    isDirect,
    directRateFactor: factor,
    directRateAddition,
    total,
  }
}

/** 開業前パッケージ費（投資コスト）の取得額を算出する（入力欄 J15） */
export function computeOpeningPackageCost(
  floorAreaTsubo: number,
  royaltyRate: 0 | 10 | 15,
  config: CalcOpeningPackageConfig | undefined,
): number {
  return computeOpeningPackageBreakdown(floorAreaTsubo, royaltyRate, config)?.total ?? 0
}
