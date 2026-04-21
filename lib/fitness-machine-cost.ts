const FITNESS_MACHINE_BASE_COST = 3_750_000

const PREFECTURE_MACHINE_UNIT_PRICE: Record<string, number> = {
  北海道: 70_000,
  青森: 125_000,
  岩手: 115_000,
  宮城: 95_000,
  秋田: 105_000,
  山形: 95_000,
  福島: 95_000,
  茨城: 75_000,
  栃木: 75_000,
  群馬: 65_000,
  埼玉: 65_000,
  千葉: 65_000,
  東京: 65_000,
  神奈川: 65_000,
  新潟: 85_000,
  富山: 65_000,
  石川: 65_000,
  福井: 65_000,
  山梨: 65_000,
  長野: 65_000,
  岐阜: 55_000,
  静岡: 65_000,
  愛知: 55_000,
  三重: 55_000,
  滋賀: 60_000,
  京都: 70_000,
  大阪: 70_000,
  兵庫: 70_000,
  奈良: 70_000,
  和歌山: 70_000,
  鳥取: 75_000,
  島根: 85_000,
  岡山: 75_000,
  広島: 95_000,
  山口: 105_000,
  徳島: 75_000,
  香川: 75_000,
  愛媛: 95_000,
  高知: 85_000,
  福岡: 65_000,
  佐賀: 70_000,
  長崎: 70_000,
  熊本: 80_000,
  大分: 70_000,
  宮崎: 90_000,
  鹿児島: 90_000,
  沖縄: 90_000,
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