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
  徳島: 180_000,
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

function normalizePrefectureName(raw: string): string {
  return raw.replace(/[\s　]/g, "").replace(/(都|道|府|県)$/u, "")
}

export function extractPrefectureFromAddress(address?: string): string | null {
  if (!address) return null

  const normalized = address.replace(/[\s　]/g, "")
  const prefMatch = normalized.match(/(東京都|北海道|(?:京都|大阪)府|..県)/u)
  if (!prefMatch) return null

  return normalizePrefectureName(prefMatch[1])
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

export { FITNESS_MACHINE_BASE_COST }