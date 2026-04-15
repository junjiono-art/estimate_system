import { promises as fs } from "node:fs"
import path from "node:path"
import { buildRegressionRows } from "@/lib/server/calc-engine"

type ExpectedRow = {
  month: number
  members: number
  revenue: number
  cost: number
  profit: number
}

type DiffRow = {
  month: number
  field: keyof ExpectedRow
  expected: number
  actual: number
}

function parseNumber(value: string): number {
  return Number(value.trim())
}

function parseExpectedCsv(csvText: string): ExpectedRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))

  if (lines.length <= 1) return []

  const rows: ExpectedRow[] = []
  for (const line of lines.slice(1)) {
    const cols = line.split(",")
    if (cols.length < 18) continue

    rows.push({
      month: parseNumber(cols[0]),
      members: parseNumber(cols[1]),
      revenue: parseNumber(cols[9]),
      cost: parseNumber(cols[15]),
      profit: parseNumber(cols[16]),
    })
  }

  return rows
}

export async function validateStandardRegression() {
  const filePath = path.join(process.cwd(), "data", "regression", "expected-standard-monthly-y1.csv")
  const csvText = await fs.readFile(filePath, "utf-8")

  const expected = parseExpectedCsv(csvText)
  const actual = buildRegressionRows("standard").slice(0, 12)

  const diffs: DiffRow[] = []

  for (let i = 0; i < Math.min(expected.length, actual.length); i += 1) {
    const e = expected[i]
    const a = actual[i]

    if (e.month !== a.month) {
      diffs.push({ month: e.month, field: "month", expected: e.month, actual: a.month })
    }
    if (e.members !== a.members) {
      diffs.push({ month: e.month, field: "members", expected: e.members, actual: a.members })
    }
    if (e.revenue !== a.revenue) {
      diffs.push({ month: e.month, field: "revenue", expected: e.revenue, actual: a.revenue })
    }
    if (e.cost !== a.cost) {
      diffs.push({ month: e.month, field: "cost", expected: e.cost, actual: a.cost })
    }
    if (e.profit !== a.profit) {
      diffs.push({ month: e.month, field: "profit", expected: e.profit, actual: a.profit })
    }
  }

  return {
    pass: diffs.length === 0 && expected.length === actual.length,
    expectedRows: expected.length,
    actualRows: actual.length,
    diffs,
  }
}
