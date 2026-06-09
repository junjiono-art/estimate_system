/**
 * 金額表示のための数値フォーマットユーティリティ。
 * 入力欄はカンマ無しの数字文字列で保持し、表示時のみ3桁区切りに整形する。
 */

/** 全角数字を半角化し、数字以外を除去した半角数字のみの文字列を返す。 */
export function toDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return ""
  const halfWidth = String(input).replace(/[０-９]/g, (d) => "０１２３４５６７８９".indexOf(d).toString())
  return halfWidth.replace(/[^\d]/g, "")
}

/** 整数金額を3桁区切りで表示する（空文字・非数は空文字を返す）。 */
export function formatThousands(input: string | number | null | undefined): string {
  const digits = toDigits(input)
  if (digits === "") return ""
  return Number(digits).toLocaleString("ja-JP")
}
