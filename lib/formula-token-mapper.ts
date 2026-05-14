import type { FormulaToken as RuntimeFormulaToken } from "@/lib/formula-types"

// UI token shape used by formula editor components.
export type EditorFormulaToken = {
  id: string
  type: "var" | "const" | "op" | "fn" | "paren"
  key?: string
  value?: string | number
  name?: string
  label?: string
}

export function toEditorToken(token: RuntimeFormulaToken, index: number): EditorFormulaToken {
  // namedConst is represented as variable chip in UI to avoid adding a separate palette type.
  if (token.type === "var") return { id: `t-${index}`, type: "var", key: token.varKey, label: token.label }
  if (token.type === "namedConst") return { id: `t-${index}`, type: "var", key: token.namedConstKey, label: token.label }
  if (token.type === "const") return { id: `t-${index}`, type: "const", value: Number(token.value ?? 0) }
  if (token.type === "op") return { id: `t-${index}`, type: "op", value: token.op || String(token.value ?? ""), label: token.label }
  if (token.type === "fn") return { id: `t-${index}`, type: "fn", name: token.fnName, label: token.label }
  return { id: `t-${index}`, type: "paren", value: token.paren, label: token.label }
}

export function toRuntimeToken(token: EditorFormulaToken): RuntimeFormulaToken {
  // UI uses a compact token shape; this mapper normalizes into persisted runtime tokens.
  if (token.type === "var") return { type: "var", varKey: token.key, label: token.label }
  if (token.type === "const") return { type: "const", value: Number(token.value ?? 0) }
  if (token.type === "op") return { type: "op", op: String(token.value ?? ""), label: token.label }
  if (token.type === "fn") return { type: "fn", fnName: token.name, label: token.label }
  return { type: "paren", paren: token.value === ")" ? ")" : "(", label: token.label }
}
