"use client"

import { useState } from "react"
import { StarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  value?: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: "sm" | "md"
}

export function StarRating({ value, onChange, readonly = false, size = "md" }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const starSize = size === "sm" ? "size-3.5" : "size-5"
  const display = hovered ?? value ?? 0

  return (
    <div
      className="flex items-center gap-0.5"
      role={readonly ? "img" : "radiogroup"}
      aria-label={`評価: ${value ?? "未評価"} / 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          aria-label={`${star}点`}
          className={cn(
            "transition-transform focus-visible:outline-none",
            !readonly && "cursor-pointer hover:scale-110",
            readonly && "cursor-default",
          )}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(null)}
        >
          <StarIcon
            className={cn(
              starSize,
              "transition-colors",
              star <= display
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/30",
            )}
          />
        </button>
      ))}
    </div>
  )
}
