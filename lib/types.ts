// ============================================================
// 試算アプリ共通の型定義（UIプロトタイプ用モックデータ含む）
// ============================================================

/** 単価マスタ */
export type MasterValueRoyaltyMode = "binary" | "rate"

export interface MasterValue {
  id: string
  category: "ランニングコスト" | "投資コスト"
  code: string
  label: string
  unit: string        // 単位ラベル（例: "円/月", "円/台", "円/坪"）
  defaultAmount: number
  currentAmount: number
  royaltyRuleEnabled?: boolean
  royaltyRuleMode?: MasterValueRoyaltyMode
  amountWithoutRoyalty?: number
  amountWithRoyalty?: number
  amountWithRoyalty10?: number
  amountWithRoyalty15?: number
  note: string
}

export type UnitPrice = MasterValue

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

/** 出店済み店舗マスタ */
export interface Store {
  id: string
  name: string       // 店舗名
  address: string    // 住所（都道府県＋市区町村＋番地）
  prefecture: string // 都道府県（検索用）
  city: string       // 市区町村（表示・検索補助）
  latitude: number   // 緯度
  longitude: number  // 経度
  openedAt: string   // 出店日（ISO 8601 date string: "YYYY-MM-DD"）
  note: string       // 備考
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
  memberCapacity: number
  monthlyFee: number       // 月会費
  enrollmentFee: number    // 入会金
  expectedOccupancyRate: number // 稼働率
  interiorCost: number     // 内装費
  otherInitialCost: number // その他初期費用
}

/** シナリオ種別 */
export type ScenarioType = "conservative" | "standard" | "aggressive"

export type LocationType = "urban" | "suburban" | "rural"

export interface SimulationRequestInput {
  storeName: string
  location?: string
  scenario?: ScenarioType
  createdBy?: string
  floorAreaTsubo?: number
  rentPerTsubo?: number
  royaltyRate?: 0 | 10 | 15
  competitorCount?: number
  locationType?: LocationType
  runningCostTotal?: number
  initialInvestmentTotal?: number
  franchiseRate?: 0 | 10 | 15
  includeDepreciation?: boolean
}

export interface AreaDemographics {
  municipality: {
    prefecture: string
    city: string
    areaCode: string
  }
  bySex: {
    male: number
    female: number
    total: number
  }
  byAgeGender: Array<{
    ageGroup: string
    male: number
    female: number
    total: number
  }>
}

/** 試算結果 */
export interface SimulationResult {
  id: string
  storeName: string
  /** 住所（市区町村の人口統計表示に使用） */
  location?: string
  createdAt: string
  createdBy: string
  scenario: ScenarioType
  // FC契約
  franchiseRate?: number
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
  // 損益分岐点
  breakevenMembers?: number
  simpleBreakevenMembers?: number
  // 評価（1〜5、未評価は undefined）
  rating?: number
  // エリア人口統計（試算時に取得できた場合のみ）
  demographics?: AreaDemographics
  // 月次推移（最大120ヶ月 = 10年分）
  monthlyProjection: {
    month: number
    members?: number
    revenue: number
    cost: number
    profit: number
    cumulativeProfit: number
  }[]
}
