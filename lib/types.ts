// ============================================================
// 試算アプリ共通の型定義（UIプロトタイプ用モックデータ含む）
// ============================================================

/** マシン種類マスタ */
export interface MachineType {
  id: string
  name: string
  category: "有酸素" | "筋トレ" | "ストレッチ" | "その他"
  unitPrice: number // 1台あたりの購入価格
  monthlyMaintenance: number // 月間メンテナンス費
}

/** エリア賃料相場マスタ */
export interface AreaRent {
  id: string
  prefecture: string
  city: string
  averageRentPerTsubo: number // 坪単価
}

/** ランニングコストマスタ */
export interface RunningCostTemplate {
  id: string
  label: string
  monthlyAmount: number
  note: string
}

/** FC費用マスタ */
export interface FranchiseCost {
  id: string
  label: string
  amount: number
  type: "初期" | "月額"
  note: string
}

/** 店舗入力データ */
export interface StoreInput {
  storeName: string
  location: string
  prefecture: string
  city: string
  isFranchise: boolean
  floorAreaTsubo: number
  rentPerTsubo: number
  machines: {
    machineTypeId: string
    machineTypeName: string
    quantity: number
    unitPrice: number
  }[]
  memberCapacity: number
  monthlyFee: number       // 月会費
  enrollmentFee: number    // 入会金
  expectedOccupancyRate: number // 稼働率
  interiorCost: number     // 内装費
  otherInitialCost: number // その他初期費用
}

/** シナリオ種別 */
export type ScenarioType = "conservative" | "standard" | "aggressive"

/** 試算結果 */
export interface SimulationResult {
  id: string
  storeName: string
  createdAt: string
  createdBy: string
  scenario: ScenarioType
  // 初期投資
  totalInitialInvestment: number
  machinesCost: number
  interiorCost: number
  franchiseInitialCost: number
  otherInitialCost: number
  // 月間
  monthlyRevenue: number
  monthlyRent: number
  monthlyRunningCost: number
  monthlyFranchiseCost: number
  monthlyProfit: number
  // 回収
  paybackMonths: number
  // 評価（1〜5、未評価は undefined）
  rating?: number
  // 月次推移（最大120ヶ月 = 10年分）
  monthlyProjection: {
    month: number
    revenue: number
    cost: number
    profit: number
    cumulativeProfit: number
  }[]
}
