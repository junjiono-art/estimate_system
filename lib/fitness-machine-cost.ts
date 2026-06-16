const FITNESS_MACHINE_BASE_COST = 3_750_000

const PREFECTURE_MACHINE_UNIT_PRICE: Record<string, number> = {
  北海道: 220_000,
  青森: 200_000,
  岩手: 200_000,
  宮城: 200_000,
  秋田: 200_000,
  山形: 200_000,
  福島: 200_000,
  茨城: 180_000,
  群馬: 180_000,
  埼玉: 180_000,
  栃木: 180_000,
  千葉: 180_000,
  東京: 180_000,
  神奈川: 180_000,
  新潟: 200_000,
  富山: 180_000,
  石川: 180_000,
  福井: 180_000,
  山梨: 180_000,
  長野: 180_000,
  岐阜: 160_000,
  静岡: 170_000,
  愛知: 150_000,
  三重: 160_000,
  滋賀: 170_000,
  京都: 170_000,
  大阪: 170_000,
  兵庫: 170_000,
  奈良: 170_000,
  和歌山: 180_000,
  鳥取: 180_000,
  島根: 180_000,
  岡山: 180_000,
  広島: 180_000,
  山口: 180_000,
  徳島: 200_000,
  香川: 200_000,
  愛媛: 200_000,
  高知: 200_000,
  福岡: 200_000,
  佐賀: 200_000,
  長崎: 200_000,
  熊本: 200_000,
  大分: 200_000,
  宮崎: 200_000,
  鹿児島: 200_000,
  沖縄: 220_000,
}

/** 47都道府県の正式名称（都道府県セレクト・住所判定の共通ソース） */
export const PREFECTURE_FULL_NAMES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const

/**
 * 正式名称 → 料金表/設定のキー。
 * 北海道のみ「道」を残し、他は末尾の 都/府/県 を除去する（料金表のキーに一致させる）。
 */
export function toPrefectureKey(fullName: string): string {
  const s = fullName.replace(/[\s　]/g, "")
  if (s === "北海道") return "北海道"
  return s.replace(/(都|府|県)$/u, "")
}

/**
 * 住所または都道府県名から、料金表キー（例: 東京都→東京、神奈川県→神奈川、北海道→北海道）を返す。
 * 既知の47都道府県名に前方一致させるため、3文字県名（神奈川/和歌山/鹿児島）や北海道も正しく判定できる。
 */
export function extractPrefectureFromAddress(address?: string): string | null {
  if (!address) return null

  const normalized = address.replace(/[\s　]/g, "")
  const matched = PREFECTURE_FULL_NAMES.find((name) => normalized.startsWith(name))
  return matched ? toPrefectureKey(matched) : null
}

export function getFitnessMachineUnitPriceByAddress(address?: string, fallbackUnitPrice?: number): number {
  const fallback = Math.max(0, Number(fallbackUnitPrice) || 0)
  const prefecture = extractPrefectureFromAddress(address)
  if (!prefecture) return fallback
  return PREFECTURE_MACHINE_UNIT_PRICE[prefecture] ?? fallback
}

export function getFitnessMachineSurchargeByAddress(address?: string): number {
  const unitPrice = getFitnessMachineUnitPriceByAddress(address, 0)
  return unitPrice
}

export function resolveFitnessMachineCostByAddress(address?: string, baseCost?: number): number {
  const base = Math.max(0, Number(baseCost) || FITNESS_MACHINE_BASE_COST)
  return base + getFitnessMachineSurchargeByAddress(address)
}

// ── フィットネスマシン費（投資コスト）の費目メタ情報 ──
// 投資コストはマスタ(DB)駆動だが、マスタに費目が無くてもアプリ側で常に項目を供給するための定数。
export const FITNESS_MACHINE_CODE = "investment_fitness_machine"
export const FITNESS_MACHINE_FIELD_ID = "fitnessMachineCost"
export const FITNESS_MACHINE_LABEL = "フィットネスマシン費"
export const FITNESS_MACHINE_UNIT = "円"
/** 償却年（元Excel 入力欄 D8） */
export const FITNESS_MACHINE_DEPRECIATION_YEARS = 6
/** 住所から都道府県が取れない場合の坪あたり単価（FC満額ベース。料金表の中央水準） */
export const FITNESS_MACHINE_FALLBACK_UNIT_PRICE = 150_000

/**
 * フィットネスマシン費の坪あたり単価を返す（doc/計算系統・定数込み.md「フィットネスマシン費用」）。
 *   単価 = 都道府県別料金表の参照値
 *     ・直営（ロイヤリティ無し）：参照値を半額にする
 *     ・FC（ロイヤリティ有り）  ：参照値そのまま
 * royaltyRatePercent は 0 / 10 / 15（%）を想定し、>0 を FC とみなす。
 */
export function getFitnessMachineUnitPriceByAddressAndRoyalty(
  address: string | undefined,
  royaltyRatePercent: number,
  fallbackUnitPrice: number = FITNESS_MACHINE_FALLBACK_UNIT_PRICE,
): number {
  const referenceUnitPrice = getFitnessMachineUnitPriceByAddress(address, fallbackUnitPrice)
  const isFranchise = Number(royaltyRatePercent) > 0
  // 直営は半額（元Excel 50坪の表示値 ¥3,750,000 ＝ 愛知150,000 ÷2 ×50 と一致）
  return Math.round(isFranchise ? referenceUnitPrice : referenceUnitPrice / 2)
}

export { FITNESS_MACHINE_BASE_COST }