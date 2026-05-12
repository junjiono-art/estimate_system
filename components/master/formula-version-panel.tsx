"use client"

import { XIcon, HistoryIcon, CheckCircleIcon, RotateCcwIcon, EyeIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── 型定義 ──────────────────────────────────────────────

export interface FormulaVersion {
  version: string
  createdBy: string
  createdAt: string
  comment: string
  status: "draft" | "active" | "archived"
}

// ── モックデータ ────────────────────────────────────────

export const MOCK_VERSIONS: FormulaVersion[] = [
  {
    version: "v0042",
    createdBy: "田中",
    createdAt: "2026-05-10",
    comment: "入会費の月按分ロジックを追加",
    status: "active",
  },
  {
    version: "v0041",
    createdBy: "鈴木",
    createdAt: "2026-04-20",
    comment: "支払手数料率の反映を修正",
    status: "archived",
  },
  {
    version: "v0038",
    createdBy: "田中",
    createdAt: "2026-03-31",
    comment: "競合影響率を乗算方式に変更",
    status: "archived",
  },
  {
    version: "v0021",
    createdBy: "山田",
    createdAt: "2026-02-14",
    comment: "ロイヤリティ上限キャップを追加",
    status: "archived",
  },
  {
    version: "v0001",
    createdBy: "山田",
    createdAt: "2026-03-15",
    comment: "初期バージョン",
    status: "archived",
  },
]

// ── ステータスバッジ ─────────────────────────────────────

function StatusBadge({ status }: { status: FormulaVersion["status"] }) {
  if (status === "active") {
    return (
      <Badge className="h-4 text-[9px] px-1.5 bg-green-100 text-green-700 border-green-200 font-medium">
        active
      </Badge>
    )
  }
  if (status === "draft") {
    return (
      <Badge className="h-4 text-[9px] px-1.5 bg-amber-100 text-amber-700 border-amber-200 font-medium">
        draft
      </Badge>
    )
  }
  return null
}

// ── メインコンポーネント ─────────────────────────────────

interface FormulaVersionPanelProps {
  versions?: FormulaVersion[]
  activeVersion?: string
  onClose?: () => void
  onView?: (version: string) => void
  onRestore?: (version: string) => void
}

export function FormulaVersionPanel({
  versions = MOCK_VERSIONS,
  activeVersion,
  onClose,
  onView,
  onRestore,
}: FormulaVersionPanelProps) {
  const currentActive = activeVersion ?? versions.find((v) => v.status === "active")?.version

  return (
    <div className="flex flex-col h-full">
      {/* パネルヘッダー */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-background shrink-0">
        <div className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">バージョン履歴</span>
          <Badge variant="outline" className="text-[10px]">{versions.length} 件</Badge>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="閉じる"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>

      {/* バージョンリスト */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/60">
        {versions.map((ver) => {
          const isActive = ver.version === currentActive
          return (
            <div
              key={ver.version}
              className={cn(
                "px-5 py-4 transition-colors",
                isActive ? "bg-primary/5" : "hover:bg-muted/30"
              )}
            >
              {/* バージョン番号・ステータス */}
              <div className="flex items-center gap-2 mb-1">
                {isActive ? (
                  <CheckCircleIcon className="size-3.5 text-green-600 shrink-0" />
                ) : (
                  <div className="size-3.5 rounded-full border-2 border-border shrink-0" />
                )}
                <span className={cn(
                  "text-xs font-mono font-semibold",
                  isActive ? "text-green-700" : "text-foreground"
                )}>
                  {ver.version}
                </span>
                <StatusBadge status={ver.status} />
                <span className="ml-auto text-[10px] text-muted-foreground font-mono shrink-0">
                  {ver.createdAt}
                </span>
              </div>

              {/* 編集者・コメント */}
              <div className="ml-5 space-y-1">
                <p className="text-[10px] text-muted-foreground">
                  編集者: <span className="font-medium text-foreground">{ver.createdBy}</span>
                </p>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {ver.comment}
                </p>

                {/* アクションボタン */}
                <div className="flex items-center gap-2 pt-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => onView?.(ver.version)}
                  >
                    <EyeIcon className="size-3" />
                    この版を表示
                  </Button>
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 text-[10px] px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      onClick={() => onRestore?.(ver.version)}
                    >
                      <RotateCcwIcon className="size-3" />
                      この版に戻す
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
