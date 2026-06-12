/**
 * 既定式セットの等価検証。
 *
 * 式セット駆動の試算（DEFAULT_FORMULA_SET）と、式セット無し（コード側フォールバック＝
 * Excel回帰検証済み）の試算が完全一致することを確認する。
 * 一致すれば、登録する式がExcelと一致している証明になる。
 *
 * 実行: node scripts/run.mjs scripts/verify-formula-set.ts
 */
import { calculateSimulation } from "@/lib/server/calc-engine"
import { DEFAULT_CALC_PARAMS } from "@/lib/default-calc-params"
import { DEFAULT_FORMULA_SET } from "@/lib/formula-default-set"
import type { ScenarioType, SimulationRequestInput } from "@/lib/types"

const BASE_INPUT: SimulationRequestInput = {
  storeName: "verify-base",
  locationType: "suburban",
  floorAreaTsubo: 50,
  rentPerTsubo: 900_000,
  runningCostTotal: 308_000,
  machineMaintenanceCost: 0,
  initialInvestmentTotal: 23_110_000,
  competitorCount: 2,
  royaltyRate: 0,
  franchiseRate: 0,
  populationByRadius: { km1Ring: 11_416, km3Ring: 39_505, km5Ring: 64_764 },
}

// FC率の影響（ロイヤリティ・アプリ料）も確認するため royaltyRate を変えたケースも追加
const VARIANTS: Array<{ name: string; input: SimulationRequestInput }> = [
  { name: "FC直営(0%)", input: { ...BASE_INPUT } },
  { name: "FC10%", input: { ...BASE_INPUT, royaltyRate: 10, franchiseRate: 10 } },
  { name: "FC15%", input: { ...BASE_INPUT, royaltyRate: 15, franchiseRate: 15 } },
  { name: "都市型", input: { ...BASE_INPUT, locationType: "urban" } },
  { name: "田舎型/競合4", input: { ...BASE_INPUT, locationType: "rural", competitorCount: 4 } },
]

const SCENARIOS: ScenarioType[] = ["conservative", "standard", "aggressive"]

let failures = 0
let checks = 0

for (const variant of VARIANTS) {
  for (const scenario of SCENARIOS) {
    const input = { ...variant.input, scenario }

    const withSet = calculateSimulation(input, DEFAULT_CALC_PARAMS, { formulaSet: DEFAULT_FORMULA_SET })
    const withoutSet = calculateSimulation(input, DEFAULT_CALC_PARAMS)

    const a = withSet.monthlyProjection
    const b = withoutSet.monthlyProjection

    if (a.length !== b.length) {
      console.error(`✗ ${variant.name}/${scenario}: 月数不一致 ${a.length} vs ${b.length}`)
      failures++
      continue
    }

    let variantFail = 0
    for (let i = 0; i < a.length; i++) {
      checks++
      for (const key of ["members", "revenue", "cost", "profit"] as const) {
        const av = Number(a[i][key])
        const bv = Number(b[i][key])
        if (Math.abs(av - bv) > 0.5) {
          if (variantFail < 3) {
            console.error(`✗ ${variant.name}/${scenario} m${i + 1} ${key}: set=${av} fallback=${bv}`)
          }
          variantFail++
          failures++
        }
      }
    }

    if (variantFail === 0) {
      console.log(`✓ ${variant.name}/${scenario}: 120ヶ月 members/revenue/cost/profit 完全一致`)
    } else {
      console.error(`✗ ${variant.name}/${scenario}: ${variantFail}件不一致`)
    }
  }
}

console.log(`\n検証件数: ${checks} セル / 不一致: ${failures}`)
if (failures > 0) {
  console.error("❌ 等価検証 失敗 — 式定義がExcel/コードと不一致です")
  process.exit(1)
} else {
  console.log("✅ 等価検証 合格 — 6式すべてコード(=Excel)と完全一致")
}
