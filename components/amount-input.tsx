"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { formatThousands, toDigits } from "@/lib/number-format"

type AmountInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  /** カンマ無しの数字文字列（状態側はこの生の値で保持する） */
  value: string | number
  /** 入力からカンマ等を除去した半角数字のみの文字列を返す */
  onValueChange: (rawDigits: string) => void
}

/**
 * 金額入力欄。表示は3桁区切り（例: 300,000）、状態へはカンマ無しの数字文字列を渡す。
 * type=number ではカンマを表示できないため type=text + inputMode=numeric で実装する。
 */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput({ value, onValueChange, ...props }, ref) {
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={formatThousands(value)}
        onChange={(e) => onValueChange(toDigits(e.target.value))}
        {...props}
      />
    )
  },
)
