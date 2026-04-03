import type {
  MachineType,
  AreaRent,
  RunningCostTemplate,
  FranchiseCost,
  SimulationResult,
  ScenarioType,
} from "./types"

// ──────────────────────────────────────────────
// マシン種類マスタ
// ──────────────────────────────────────────────
export const machineTypes: MachineType[] = [
  { id: "m1", name: "トレッドミル", category: "有酸素", unitPrice: 800000, monthlyMaintenance: 5000 },
  { id: "m2", name: "エアロバイク", category: "有酸素", unitPrice: 400000, monthlyMaintenance: 3000 },
  { id: "m3", name: "エリプティカル", category: "有酸素", unitPrice: 600000, monthlyMaintenance: 4000 },
  { id: "m4", name: "チェストプレス", category: "筋トレ", unitPrice: 500000, monthlyMaintenance: 3500 },
  { id: "m5", name: "レッグプレス", category: "筋トレ", unitPrice: 550000, monthlyMaintenance: 3500 },
  { id: "m6", name: "ラットプルダウン", category: "筋トレ", unitPrice: 480000, monthlyMaintenance: 3000 },
  { id: "m7", name: "スミスマシン", category: "筋トレ", unitPrice: 700000, monthlyMaintenance: 4500 },
  { id: "m8", name: "ケーブルマシン", category: "筋トレ", unitPrice: 650000, monthlyMaintenance: 4000 },
  { id: "m9", name: "ストレッチポール台", category: "ストレッチ", unitPrice: 150000, monthlyMaintenance: 1000 },
  { id: "m10", name: "フリーウェイトセット", category: "その他", unitPrice: 300000, monthlyMaintenance: 2000 },
]

// ──────────────────────────────────────────────
// エリア賃料相場マスタ
// ──────────────────────────────────────────────
export const areaRents: AreaRent[] = [
  { id: "a1", prefecture: "東京都", city: "渋谷区", averageRentPerTsubo: 35000 },
  { id: "a2", prefecture: "東京都", city: "新宿区", averageRentPerTsubo: 32000 },
  { id: "a3", prefecture: "東京都", city: "世田谷区", averageRentPerTsubo: 22000 },
  { id: "a4", prefecture: "大阪府", city: "中央区", averageRentPerTsubo: 25000 },
  { id: "a5", prefecture: "大阪府", city: "北区", averageRentPerTsubo: 23000 },
  { id: "a6", prefecture: "愛知県", city: "名古屋市中区", averageRentPerTsubo: 20000 },
  { id: "a7", prefecture: "福岡県", city: "博多区", averageRentPerTsubo: 18000 },
  { id: "a8", prefecture: "北海道", city: "札幌市中央区", averageRentPerTsubo: 15000 },
]

// ──────────────────────────────────────────────
// ランニングコスト デフォルト値（入力フォーム初期値として使用）
// ──────────────────────────────────────────────
export const defaultRunningCosts: RunningCostTemplate[] = [
  { id: "r1", label: "水道光熱費", monthlyAmount: 150000, note: "目安：50坪あたり" },
  { id: "r2", label: "人件費（スタッフ）", monthlyAmount: 400000, note: "常勤2名想定" },
  { id: "r3", label: "清掃費", monthlyAmount: 80000, note: "業者委託" },
  { id: "r4", label: "通信費", monthlyAmount: 30000, note: "Wi-Fi・システム利用料" },
  { id: "r5", label: "消耗品費", monthlyAmount: 50000, note: "タオル・洗剤等" },
  { id: "r6", label: "保険料", monthlyAmount: 25000, note: "施設賠償責任保険等" },
  { id: "r7", label: "広告宣伝費", monthlyAmount: 100000, note: "SNS・チラシ" },
]

// ──────────────────────────────────────────────
// FC費用マスタ
// ──────────────────────────────────────────────
export const franchiseCosts: FranchiseCost[] = [
  { id: "f1", label: "加盟金", amount: 3000000, type: "初期", note: "契約時一括" },
  { id: "f2", label: "保証金", amount: 1000000, type: "初期", note: "契約時一括" },
  { id: "f3", label: "研修費", amount: 500000, type: "初期", note: "開業前研修" },
  { id: "f4", label: "ロイヤリティ", amount: 150000, type: "月額", note: "売上の一定割合 or 固定" },
  { id: "f5", label: "システム利用料", amount: 50000, type: "月額", note: "予約・会員管理" },
]

// ──────────────────────────────────────────────
// シナリオ別係数
// ──────────────────────────────────────────────
const SCENARIO_FACTORS: Record<ScenarioType, { revenueMultiplier: number; growthSpeed: number }> = {
  conservative: { revenueMultiplier: 0.8, growthSpeed: 0.03 },
  standard: { revenueMultiplier: 1.0, growthSpeed: 0.05 },
  aggressive: { revenueMultiplier: 1.25, growthSpeed: 0.07 },
}

export const SCENARIO_LABELS: Record<ScenarioType, string> = {
  conservative: "保守",
  standard: "スタンダード",
  aggressive: "アグレッシブ",
}

// ──────────────────────────────────────────────
// 月次推移生成（最大120ヶ月 = 10年分）
// ──────────────────────────────────────────────
function generateMonthlyProjection(
  baseRevenue: number,
  baseCost: number,
  initialInvestment: number,
  scenario: ScenarioType = "standard",
  months: number = 120,
) {
  const factor = SCENARIO_FACTORS[scenario]
  const projection = []
  let cumulative = -initialInvestment
  for (let m = 1; m <= months; m++) {
    const growthFactor = Math.min(1, 0.5 + m * factor.growthSpeed)
    const revenue = Math.round(baseRevenue * factor.revenueMultiplier * growthFactor)
    const cost = baseCost
    const profit = revenue - cost
    cumulative += profit
    projection.push({ month: m, revenue, cost, profit, cumulativeProfit: cumulative })
  }
  return projection
}

// ──────────────────────────────────────────────
// デモ用試算結果（3シナリオ x 3店舗 = 9件）
// ──────────────────────────────────────────────
interface DemoBase {
  id: string
  storeName: string
  createdAt: string
  createdBy: string
  machinesCost: number
  interiorCost: number
  franchiseInitialCost: number
  otherInitialCost: number
  baseRevenue: number
  baseCost: number
  monthlyRent: number
  monthlyRunningCost: number
  monthlyFranchiseCost: number
  rating?: number
}

const demoBases: DemoBase[] = [
  {
    id: "sim-1",
    storeName: "FitGym 渋谷店",
    createdAt: "2026-02-28T10:00:00Z",
    createdBy: "田中太郎",
    machinesCost: 12000000,
    interiorCost: 8000000,
    franchiseInitialCost: 4500000,
    otherInitialCost: 4000000,
    baseRevenue: 3200000,
    baseCost: 2785000,
    monthlyRent: 1750000,
    monthlyRunningCost: 835000,
    monthlyFranchiseCost: 200000,
    rating: 4,
  },
  {
    id: "sim-2",
    storeName: "FitGym 新宿店",
    createdAt: "2026-02-20T14:30:00Z",
    createdBy: "鈴木花子",
    machinesCost: 10000000,
    interiorCost: 7000000,
    franchiseInitialCost: 4500000,
    otherInitialCost: 3500000,
    baseRevenue: 2800000,
    baseCost: 2580000,
    monthlyRent: 1600000,
    monthlyRunningCost: 780000,
    monthlyFranchiseCost: 200000,
    rating: 3,
  },
  {
    id: "sim-3",
    storeName: "FitGym 世田谷店",
    createdAt: "2026-01-15T09:00:00Z",
    createdBy: "田中太郎",
    machinesCost: 8000000,
    interiorCost: 5000000,
    franchiseInitialCost: 0,
    otherInitialCost: 5000000,
    baseRevenue: 2200000,
    baseCost: 1600000,
    monthlyRent: 880000,
    monthlyRunningCost: 720000,
    monthlyFranchiseCost: 0,
    rating: 5,
  },
]

function buildResult(base: DemoBase, scenario: ScenarioType): SimulationResult {
  const totalInitial = base.machinesCost + base.interiorCost + base.franchiseInitialCost + base.otherInitialCost
  const factor = SCENARIO_FACTORS[scenario]
  const monthlyRevenue = Math.round(base.baseRevenue * factor.revenueMultiplier)
  const monthlyProfit = monthlyRevenue - base.baseCost
  const paybackMonths = monthlyProfit > 0 ? Math.ceil(totalInitial / monthlyProfit) : 999
  return {
    id: `${base.id}-${scenario}`,
    storeName: base.storeName,
    createdAt: base.createdAt,
    createdBy: base.createdBy,
    scenario,
    totalInitialInvestment: totalInitial,
    machinesCost: base.machinesCost,
    interiorCost: base.interiorCost,
    franchiseInitialCost: base.franchiseInitialCost,
    otherInitialCost: base.otherInitialCost,
    monthlyRevenue,
    monthlyRent: base.monthlyRent,
    monthlyRunningCost: base.monthlyRunningCost,
    monthlyFranchiseCost: base.monthlyFranchiseCost,
    monthlyProfit,
    paybackMonths,
    monthlyProjection: generateMonthlyProjection(base.baseRevenue, base.baseCost, totalInitial, scenario),
    rating: base.rating,
  }
}

// デフォルトは standard
export const demoSimulationResults: SimulationResult[] = demoBases.map((b) => buildResult(b, "standard"))

// シナリオ別の全結果
export const allDemoResults: SimulationResult[] = demoBases.flatMap((b) =>
  (["conservative", "standard", "aggressive"] as const).map((s) => buildResult(b, s)),
)

// 特定の試算IDからシナリオ別結果を取得
export function getResultsByBaseId(baseId: string): Record<ScenarioType, SimulationResult> {
  const results = allDemoResults.filter((r) => r.id.startsWith(baseId))
  return {
    conservative: results.find((r) => r.scenario === "conservative")!,
    standard: results.find((r) => r.scenario === "standard")!,
    aggressive: results.find((r) => r.scenario === "aggressive")!,
  }
}
