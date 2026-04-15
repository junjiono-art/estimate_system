import { promises as fs } from "node:fs"
import path from "node:path"
import { buildRegressionRows } from "@/lib/server/calc-engine"
import type { ScenarioType } from "@/lib/types"

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

type ExpectedAnnualRow = {
  year: number
  yearEndMembers: number
  annualRevenue: number
  annualCost: number
  pretaxProfit: number
}

type AnnualDiffRow = {
  year: number
  field: keyof ExpectedAnnualRow
  expected: number
  actual: number
}

type CheckResult<TDiff> = {
  pass: boolean
  expectedRows: number
  actualRows: number
  diffs: TDiff[]
}

export type ScenarioRegressionResult = {
  scenario: ScenarioType
  pass: boolean
  monthly: CheckResult<DiffRow>
  annual: CheckResult<AnnualDiffRow>
  diffCount: number
}

const MONTHLY_FILE_BY_SCENARIO: Record<ScenarioType, string> = {
  conservative: "expected-conservative-monthly-y1.csv",
  standard: "expected-standard-monthly-y1.csv",
  aggressive: "expected-aggressive-monthly-y1.csv",
}

const ANNUAL_FILE_BY_SCENARIO: Record<ScenarioType, string> = {
  conservative: "expected-conservative-annual.csv",
  standard: "expected-standard-annual.csv",
  aggressive: "expected-aggressive-annual.csv",
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

function parseExpectedAnnualCsv(csvText: string): ExpectedAnnualRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))

  if (lines.length <= 1) return []

  const rows: ExpectedAnnualRow[] = []
  for (const line of lines.slice(1)) {
    const cols = line.split(",")
    if (cols.length < 6) continue

    rows.push({
      year: parseNumber(cols[0]),
      yearEndMembers: parseNumber(cols[1]),
      annualRevenue: parseNumber(cols[2]),
      annualCost: parseNumber(cols[4]),
      pretaxProfit: parseNumber(cols[5]),
    })
  }

  return rows
}

function buildActualAnnualRows(scenario: ScenarioType): ExpectedAnnualRow[] {
  const rows = buildRegressionRows(scenario)
  const annual: ExpectedAnnualRow[] = []

  for (let year = 1; year <= 10; year += 1) {
    const start = (year - 1) * 12
    const slice = rows.slice(start, start + 12)
    if (slice.length === 0) break

    const annualRevenue = slice.reduce((sum, row) => sum + row.revenue, 0)
    const annualCost = slice.reduce((sum, row) => sum + row.cost, 0)
    annual.push({
      year,
      yearEndMembers: slice[slice.length - 1].members,
      annualRevenue,
      annualCost,
      pretaxProfit: annualRevenue - annualCost,
    })
  }

  return annual
}

function compareMonthly(expected: ExpectedRow[], actual: ExpectedRow[]): CheckResult<DiffRow> {
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

function compareAnnual(expected: ExpectedAnnualRow[], actual: ExpectedAnnualRow[]): CheckResult<AnnualDiffRow> {
  const diffs: AnnualDiffRow[] = []

  for (let i = 0; i < Math.min(expected.length, actual.length); i += 1) {
    const e = expected[i]
    const a = actual[i]

    if (e.year !== a.year) {
      diffs.push({ year: e.year, field: "year", expected: e.year, actual: a.year })
    }
    if (e.yearEndMembers !== a.yearEndMembers) {
      diffs.push({ year: e.year, field: "yearEndMembers", expected: e.yearEndMembers, actual: a.yearEndMembers })
    }
    if (e.annualRevenue !== a.annualRevenue) {
      diffs.push({ year: e.year, field: "annualRevenue", expected: e.annualRevenue, actual: a.annualRevenue })
    }
    if (e.annualCost !== a.annualCost) {
      diffs.push({ year: e.year, field: "annualCost", expected: e.annualCost, actual: a.annualCost })
    }
    if (e.pretaxProfit !== a.pretaxProfit) {
      diffs.push({ year: e.year, field: "pretaxProfit", expected: e.pretaxProfit, actual: a.pretaxProfit })
    }
  }

  return {
    pass: diffs.length === 0 && expected.length === actual.length,
    expectedRows: expected.length,
    actualRows: actual.length,
    diffs,
  }
}

export async function validateScenarioRegression(scenario: ScenarioType): Promise<ScenarioRegressionResult> {
  const monthlyPath = path.join(process.cwd(), "data", "regression", MONTHLY_FILE_BY_SCENARIO[scenario])
  const annualPath = path.join(process.cwd(), "data", "regression", ANNUAL_FILE_BY_SCENARIO[scenario])

  const [monthlyCsv, annualCsv] = await Promise.all([
    fs.readFile(monthlyPath, "utf-8"),
    fs.readFile(annualPath, "utf-8"),
  ])

  const expectedMonthly = parseExpectedCsv(monthlyCsv)
  const actualMonthly = buildRegressionRows(scenario).slice(0, 12)
  const monthly = compareMonthly(expectedMonthly, actualMonthly)

  const expectedAnnual = parseExpectedAnnualCsv(annualCsv)
  const actualAnnual = buildActualAnnualRows(scenario)
  const annual = compareAnnual(expectedAnnual, actualAnnual)

  const diffCount = monthly.diffs.length + annual.diffs.length
  return {
    scenario,
    pass: monthly.pass && annual.pass,
    monthly,
    annual,
    diffCount,
  }
}

export async function validateStandardRegression() {
  return validateScenarioRegression("standard")
}

export async function validateAllRegression() {
  const scenarios: ScenarioType[] = ["conservative", "standard", "aggressive"]
  const results = await Promise.all(scenarios.map((scenario) => validateScenarioRegression(scenario)))
  const totalDiffs = results.reduce((sum, result) => sum + result.diffCount, 0)
  const failedScenarios = results.filter((result) => !result.pass).map((result) => result.scenario)

  return {
    pass: failedScenarios.length === 0,
    totalDiffs,
    failedScenarios,
    scenarios: results,
  }
}
