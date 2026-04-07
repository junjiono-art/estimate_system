import type {
  RunningCostTemplate,
  FranchiseCost,
  SimulationResult,
  ScenarioType,
  MasterValue,
} from "./types"

// ──────────────────────────────────────────────
// 市区町村別 年齢・性別人口統計データ（モック）
// 実際の実装では e-Stat API 等を利用する
// ──────────────────────────────────────────────
export interface AgeGenderPopulation {
  ageGroup: string // 年齢帯ラベル（例: "20-24歳"）
  male: number     // 男性人口（人）
  female: number   // 女性人口（人）
}

export interface CityDemographics {
  city: string    // 市区町村名
  prefecture: string
  totalPopulation: number
  data: AgeGenderPopulation[]
}

const AGE_GROUPS = [
  "0-4歳", "5-9歳", "10-14歳", "15-19歳",
  "20-24歳", "25-29歳", "30-34歳", "35-39歳",
  "40-44歳", "45-49歳", "50-54歳", "55-59歳",
  "60-64歳", "65-69歳", "70-74歳", "75-79歳",
  "80歳以上",
]

function makeDemographics(
  city: string,
  prefecture: string,
  baseMale: number[],
  baseFemale: number[],
): CityDemographics {
  const data: AgeGenderPopulation[] = AGE_GROUPS.map((ageGroup, i) => ({
    ageGroup,
    male: baseMale[i],
    female: baseFemale[i],
  }))
  const totalPopulation = data.reduce((s, d) => s + d.male + d.female, 0)
  return { city, prefecture, totalPopulation, data }
}

export const cityDemographicsData: CityDemographics[] = [
  makeDemographics("渋谷区", "東京都",
    [3200, 3100, 3300, 5800, 11200, 13500, 12800, 11600, 12100, 11800, 10200, 8900, 7500, 6400, 5800, 4100, 5200],
    [3000, 2950, 3100, 5200, 12800, 14200, 13100, 11900, 12400, 12100, 10600, 9300, 7900, 7200, 7100, 5800, 9500],
  ),
  makeDemographics("新宿区", "東京都",
    [4100, 4000, 4200, 7200, 14800, 16200, 15100, 13800, 14200, 13900, 12100, 10500, 8900, 7600, 6900, 4900, 6200],
    [3900, 3800, 3900, 6600, 15500, 17100, 15800, 14200, 14700, 14400, 12800, 11200, 9600, 9000, 8800, 7200, 12100],
  ),
  makeDemographics("世田谷区", "東京都",
    [15200, 15800, 15300, 13100, 19800, 21500, 22100, 21800, 22500, 21200, 18900, 16500, 14200, 13100, 12400, 8800, 11200],
    [14500, 15100, 14700, 12600, 20500, 22400, 23200, 22800, 23500, 22100, 19800, 17400, 15200, 15000, 15600, 12500, 21800],
  ),
  makeDemographics("中央区", "大阪府",
    [2800, 2700, 2900, 4500, 9800, 12100, 11500, 10800, 11200, 10900, 9500, 8200, 6900, 5800, 5200, 3700, 4700],
    [2600, 2550, 2700, 4100, 10500, 12800, 12100, 11300, 11800, 11500, 10100, 8900, 7500, 6900, 6800, 5500, 9100],
  ),
  makeDemographics("北区", "大阪府",
    [5800, 5700, 5900, 8200, 14500, 16800, 15900, 14600, 15100, 14700, 12800, 11200, 9500, 8200, 7400, 5200, 6700],
    [5500, 5400, 5600, 7600, 15200, 17600, 16700, 15300, 15900, 15500, 13600, 12100, 10400, 9900, 9600, 7800, 13200],
  ),
  makeDemographics("名古屋市中区", "愛知県",
    [2200, 2100, 2300, 3800, 8500, 10200, 9600, 8900, 9200, 8900, 7800, 6700, 5700, 4800, 4300, 3000, 3800],
    [2100, 2000, 2100, 3400, 9100, 10800, 10100, 9400, 9700, 9400, 8300, 7200, 6200, 5900, 5700, 4600, 7600],
  ),
  makeDemographics("博多区", "福岡県",
    [8200, 7900, 8100, 10500, 17800, 20500, 19200, 17800, 18400, 17900, 15600, 13600, 11500, 9900, 8900, 6300, 8100],
    [7800, 7500, 7700, 9800, 18500, 21400, 20100, 18700, 19300, 18800, 16500, 14600, 12500, 12100, 12000, 9800, 16500],
  ),
  makeDemographics("札幌市中央区", "北海道",
    [4500, 4400, 4600, 6500, 11200, 13100, 12400, 11500, 11900, 11600, 10100, 8800, 7500, 6400, 5800, 4100, 5200],
    [4300, 4200, 4400, 6100, 11900, 13900, 13100, 12200, 12600, 12300, 10800, 9500, 8200, 8000, 8100, 6500, 11000],
  ),
]

/** 市区町村名から人口統計データを検索（部分一致対応） */
export function findCityDemographics(cityName: string): CityDemographics | null {
  if (!cityName) return null
  const normalized = cityName.trim()
  // 完全一致を優先
  const exact = cityDemographicsData.find((d) => d.city === normalized)
  if (exact) return exact
  // 部分一致
  const partial = cityDemographicsData.find(
    (d) => normalized.includes(d.city) || d.city.includes(normalized),
  )
  return partial ?? null
}

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
// 単価マスタ
// ──────────────────────────────────────────────
export const masterValues: MasterValue[] = [
  // ランニングコスト
  { id: "up-r1", category: "ランニングコスト", label: "水道光熱費",   unit: "円/月", defaultAmount: 150000, currentAmount: 150000, note: "50坪あたりの目安" },
  { id: "up-r2", category: "ランニングコスト", label: "水道代",       unit: "円/月", defaultAmount:  30000, currentAmount:  30000, note: "水道代込みの場合は0円に" },
  { id: "up-r3", category: "ランニングコスト", label: "人件費",       unit: "円/月", defaultAmount: 500000, currentAmount: 500000, note: "常勤2名想定" },
  { id: "up-r4", category: "ランニングコスト", label: "清掃費",       unit: "円/月", defaultAmount:  50000, currentAmount:  50000, note: "業者委託" },
  { id: "up-r5", category: "ランニングコスト", label: "通信費",       unit: "円/月", defaultAmount:  20000, currentAmount:  20000, note: "Wi-Fi・システム利用料" },
  { id: "up-r6", category: "ランニングコスト", label: "消耗品費",     unit: "円/月", defaultAmount:  30000, currentAmount:  30000, note: "タオル・洗剤等" },
  { id: "up-r7", category: "ランニングコスト", label: "保険料",       unit: "円/月", defaultAmount:  15000, currentAmount:  15000, note: "施設賠償責任保険等" },
  { id: "up-r8", category: "ランニングコスト", label: "広告宣伝費",   unit: "円/月", defaultAmount: 100000, currentAmount: 100000, note: "SNS・チラシ等" },
  { id: "up-r9", category: "ランニングコスト", label: "その他",       unit: "円/月", defaultAmount:  50000, currentAmount:  50000, note: "雑費など" },
  // 投資コスト
  { id: "up-i1",  category: "投資コスト", label: "フィットネスマシン費",    unit: "円",   defaultAmount: 12000000, currentAmount: 12000000, note: "台数×単価の目安" },
  { id: "up-i2",  category: "投資コスト", label: "内装工事費",              unit: "円/坪", defaultAmount:  160000, currentAmount:  160000,  note: "坪単価目安" },
  { id: "up-i3",  category: "投資コスト", label: "フラッパーゲート",        unit: "円",   defaultAmount:  1500000, currentAmount:  1500000, note: "1台あたり" },
  { id: "up-i4",  category: "投資コスト", label: "体組成計",                unit: "円/台", defaultAmount:  100000, currentAmount:  100000,  note: "1台あたり" },
  { id: "up-i5",  category: "投資コスト", label: "ウォーターサーバー",      unit: "円/台", defaultAmount:   50000, currentAmount:   50000,  note: "1台あたり" },
  { id: "up-i6",  category: "投資コスト", label: "フランチャイズ加盟費用",  unit: "円",   defaultAmount:  4500000, currentAmount:  4500000, note: "本部規定に準じる" },
  { id: "up-i7",  category: "投資コスト", label: "システム導入費",          unit: "円",   defaultAmount:   800000, currentAmount:   800000, note: "会員管理・予約システム" },
  { id: "up-i8",  category: "投資コスト", label: "開業準備費",              unit: "円",   defaultAmount:   300000, currentAmount:   300000, note: "各種申請・備品等" },
  { id: "up-i9",  category: "投資コスト", label: "開業前パッケージ費",      unit: "円",   defaultAmount:   600000, currentAmount:   600000, note: "研修・サポート費用含む" },
  { id: "up-i10", category: "投資コスト", label: "ALSOK/USEN導入費",        unit: "円",   defaultAmount:   200000, currentAmount:   200000, note: "セキュリティ・BGM" },
  { id: "up-i11", category: "投資コスト", label: "その他",                  unit: "円",   defaultAmount:   500000, currentAmount:   500000, note: "予備費" },
]

// ──────────────────────────────────────────────
// 出店済み店舗マスタ
// ──────────────────────────────────────────────
export const stores: Store[] = [
  { id: "s1", name: "FitGym 渋谷店",     address: "東京都渋谷区渋谷1-1-1 ○○ビル3F",       openedAt: "2022-04-01", note: "フラッグシップ店舗" },
  { id: "s2", name: "FitGym 新宿店",     address: "東京都新宿区新宿3-2-1 ○○タワー5F",      openedAt: "2022-10-15", note: "" },
  { id: "s3", name: "FitGym 世田谷店",   address: "東京都世田谷区三軒茶屋1-5-2 ○○ビル2F", openedAt: "2023-03-01", note: "独立経営" },
  { id: "s4", name: "FitGym 梅田店",     address: "大阪府大阪市北区梅田2-4-9 ○○ビル4F",   openedAt: "2023-07-20", note: "FC契約" },
  { id: "s5", name: "FitGym 名古屋栄店", address: "愛知県名古屋市中区栄3-15-1 ○○センター2F", openedAt: "2024-01-10", note: "" },
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
  location?: string
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
    storeName: "FitGym 渋��店",
    location: "東京都渋谷区渋谷1-1-1 ○○ビル3F",
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
    location: "東京都新宿区新宿3-2-1 ○○タワー5F",
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
    location: "東京都世田谷区三軒茶屋1-5-2 ○○ビル2F",
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
    location: base.location,
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
