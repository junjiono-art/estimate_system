import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 住所文字列から市区町村名を抽出する
 * 例: "東京都渋谷区渋谷1-1-1" → "渋谷区"
 *     "大阪府大阪市北区梅田1-1" → "大阪市北区"
 */
export function extractCity(address: string): string {
  if (!address) return ""

  // 政令指定都市の「○○市○○区」パターン（例: 大阪市北区、名古屋市中区、札幌市中央区）
  const seirei = address.match(/[都道府県].+?([^\s都道府県]+市[^\s市]+区)/)
  if (seirei) return seirei[1]

  // 一般市区町村（例: 渋谷区、豊中市、春日部市、那覇市）
  const general = address.match(/[都道府県](.+?[市区町村](?:合併市|合併町|合併村)?(?:[^市区町村\s\d０-９一二三四五六七八九十百千万]+[市区町村])?)/)
  if (general) {
    // 都道府県名の直後から最初の市区町村までを返す
    const cityMatch = address.match(/[都道府県]([^都道府県]+?[市区町村])/)
    if (cityMatch) return cityMatch[1]
  }

  // フォールバック: 都道府県を除いた先頭部分
  const fallback = address.replace(/^.+?[都道府県]/, "")
  return fallback.substring(0, 6) || address
}
