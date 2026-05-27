"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type FormulaNode = {
  key: string
  label: string
  phase: "pre" | "monthly" | "post"
  dependsOn: string[]
  inputVars: string[]
  expression: string
}

type DependencyGraphProps = {
  formulas: FormulaNode[]
  highlightedParamKeys?: string[]
}

const PHASE_ORDER: Array<{ key: "pre" | "monthly" | "post"; label: string }> = [
  { key: "pre", label: "初期計算" },
  { key: "monthly", label: "月次計算" },
  { key: "post", label: "集計" },
]

const CARD_HEIGHT = 56
const CARD_GAP = 12
const COLUMN_WIDTH = 220
const COLUMN_GAP = 80
const COLUMN_HEADER_HEIGHT = 32
const COLUMN_PADDING_TOP = 12

type CardPosition = { x: number; y: number; width: number; height: number }

export function DependencyGraph({ formulas, highlightedParamKeys = [] }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number>(0)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const phaseGroups = useMemo(() => {
    const groups: Record<"pre" | "monthly" | "post", FormulaNode[]> = {
      pre: [],
      monthly: [],
      post: [],
    }
    for (const formula of formulas) {
      groups[formula.phase].push(formula)
    }
    return groups
  }, [formulas])

  const highlightedKeys = useMemo(() => {
    if (highlightedParamKeys.length === 0) return new Set<string>()
    const paramSet = new Set(highlightedParamKeys)
    const directlyAffected = new Set<string>()
    for (const formula of formulas) {
      if (paramSet.has(formula.key)) {
        directlyAffected.add(formula.key)
        continue
      }
      if (formula.inputVars.some((key) => paramSet.has(key))) {
        directlyAffected.add(formula.key)
      }
    }
    const allAffected = new Set(directlyAffected)
    let changed = true
    while (changed) {
      changed = false
      for (const formula of formulas) {
        if (allAffected.has(formula.key)) continue
        if (formula.dependsOn.some((dep) => allAffected.has(dep))) {
          allAffected.add(formula.key)
          changed = true
        }
      }
    }
    return allAffected
  }, [formulas, highlightedParamKeys])

  const layout = useMemo(() => {
    const positions = new Map<string, CardPosition>()
    PHASE_ORDER.forEach((phase, colIndex) => {
      const items = phaseGroups[phase.key]
      const x = colIndex * (COLUMN_WIDTH + COLUMN_GAP)
      items.forEach((formula, rowIndex) => {
        const y = COLUMN_HEADER_HEIGHT + COLUMN_PADDING_TOP + rowIndex * (CARD_HEIGHT + CARD_GAP)
        positions.set(formula.key, { x, y, width: COLUMN_WIDTH, height: CARD_HEIGHT })
      })
    })

    const totalWidth = PHASE_ORDER.length * COLUMN_WIDTH + (PHASE_ORDER.length - 1) * COLUMN_GAP
    const maxRows = Math.max(
      phaseGroups.pre.length,
      phaseGroups.monthly.length,
      phaseGroups.post.length,
      1,
    )
    const totalHeight =
      COLUMN_HEADER_HEIGHT + COLUMN_PADDING_TOP + maxRows * (CARD_HEIGHT + CARD_GAP)

    return { positions, totalWidth, totalHeight }
  }, [phaseGroups])

  const edges = useMemo(() => {
    const result: Array<{ from: string; to: string; highlighted: boolean }> = []
    for (const formula of formulas) {
      for (const depKey of formula.dependsOn) {
        if (!layout.positions.has(depKey)) continue
        const highlighted = highlightedKeys.has(formula.key) && highlightedKeys.has(depKey)
        result.push({ from: depKey, to: formula.key, highlighted })
      }
    }
    return result
  }, [formulas, layout, highlightedKeys])

  if (formulas.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        表示できる式がありません。
      </div>
    )
  }

  const scale = containerWidth > 0 && containerWidth < layout.totalWidth
    ? containerWidth / layout.totalWidth
    : 1
  const displayHeight = layout.totalHeight * scale

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <div
        className="relative"
        style={{
          width: layout.totalWidth,
          height: layout.totalHeight,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          marginBottom: scale < 1 ? displayHeight - layout.totalHeight : 0,
        }}
      >
        {PHASE_ORDER.map((phase, colIndex) => {
          const x = colIndex * (COLUMN_WIDTH + COLUMN_GAP)
          return (
            <div
              key={phase.key}
              className="absolute flex items-center justify-center rounded-md bg-muted/40 text-xs font-medium text-muted-foreground"
              style={{
                left: x,
                top: 0,
                width: COLUMN_WIDTH,
                height: COLUMN_HEADER_HEIGHT,
              }}
            >
              {phase.label}
            </div>
          )
        })}

        <svg
          className="pointer-events-none absolute inset-0"
          width={layout.totalWidth}
          height={layout.totalHeight}
        >
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border" />
            </marker>
            <marker
              id="arrow-highlight"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
            </marker>
          </defs>
          {edges.map((edge, index) => {
            const fromPos = layout.positions.get(edge.from)
            const toPos = layout.positions.get(edge.to)
            if (!fromPos || !toPos) return null
            const x1 = fromPos.x + fromPos.width
            const y1 = fromPos.y + fromPos.height / 2
            const x2 = toPos.x
            const y2 = toPos.y + toPos.height / 2
            const midX = (x1 + x2) / 2
            const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
            return (
              <path
                key={`${edge.from}-${edge.to}-${index}`}
                d={path}
                fill="none"
                strokeWidth={edge.highlighted ? 2 : 1.2}
                className={edge.highlighted ? "stroke-primary" : "stroke-border"}
                markerEnd={edge.highlighted ? "url(#arrow-highlight)" : "url(#arrow-default)"}
              />
            )
          })}
        </svg>

        {formulas.map((formula) => {
          const pos = layout.positions.get(formula.key)
          if (!pos) return null
          const isHighlighted = highlightedKeys.has(formula.key)
          return (
            <div
              key={formula.key}
              className={`absolute flex flex-col justify-center rounded-md border bg-card px-3 py-2 shadow-sm transition-colors ${
                isHighlighted
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border"
              }`}
              style={{
                left: pos.x,
                top: pos.y,
                width: pos.width,
                height: pos.height,
              }}
              title={formula.expression || "式が未定義です"}
            >
              <p className="truncate text-sm font-medium text-foreground">{formula.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {formula.expression || "式未定義"}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
