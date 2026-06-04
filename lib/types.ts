// ============================================================
// 試算アプリ共通の型定義（UIプロトタイプ用モックデータ含む）
// ============================================================

/** 単価マスタ */
export type MasterValueRoyaltyMode = "binary" | "rate"

/**
 * ランニングコストの数量基準。
 * monthly=単価をそのまま月額計上（数量なし） / fixed=単価×数量（回数・台数等） / perTsubo=単価×坪数×数量（坪連動）
 */
export type MasterValueQuantityBasis = "monthly" | "fixed" | "perTsubo"

export interface MasterValue {
  id: string
  category: "ランニングコスト" | "投資コスト"
  code: string
  label: string
  unit: string        // 単位ラベル（例: "円/月", "円/台", "円/坪", "回"）
  defaultAmount: number
  currentAmount: number
  royaltyRuleEnabled?: boolean
  royaltyRuleMode?: MasterValueRoyaltyMode
  amountWithoutRoyalty?: number
  amountWithRoyalty?: number
  amountWithRoyalty10?: number
  amountWithRoyalty15?: number
  // ── ランニングコスト用（元Excel 入力欄 R20-R35: 金額 = 単価 × 数量）──
  /** 数量（回数・台数・坪数など）。月額金額 = 単価(currentAmount) × 実効数量。未設定は1 */
  quantity?: number
  /** 数量の基準。perTsubo の場合は実効数量 = 坪数 × quantity（例: 水道代 150円/坪 × 坪数） */
  quantityBasis?: MasterValueQuantityBasis
  // ── 投資コスト用（元Excel 入力欄 R5-R17: 減価償却月額 = 金額 / 償却年 / 12）──
  /** 耐用年数（償却年）。未設定/0 は非償却。月次減価償却 = 金額 / 償却年 / 12 */
  depreciationYears?: number
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
  initialInvestmentByRoyaltyRate?: Partial<Record<"0" | "10" | "15", number>>
  franchiseRate?: 0 | 10 | 15
  includeDepreciation?: boolean
  /** 住所から半径別の20〜59歳人口（e-Statメッシュ統計） */
  populationByRadius?: {
    km1Ring: number  // 半径0〜1km圏
    km3Ring: number  // 半径1〜3km圏（リング）
    km5Ring: number  // 半径3〜5km圏（リング）
  }
  /** 投資コスト内訳（フィールドID → 金額） */
  investmentBreakdown?: Record<string, number>
  /** 投資項目別の耐用年数（フィールドID → 償却年）。マスタ登録値。減価償却の算出に使用 */
  depreciationYearsByField?: Record<string, number>
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

/** LTV計算結果（元スプレッドシート「LTV計算」シート相当） */
export interface LtvResult {
  /** 月次の期待会費（C3:C26 / 24ヶ月分） */
  monthlyExpectedFees: number[]
  /** 1年間LTV = SUM(C3:C14) */
  ltv1Year: number
  /** 半年継続率 = PRODUCT(D3:D8) */
  halfYearRetentionRate: number
  /** 半年離脱率 = 1 - 半年継続率 */
  halfYearChurnRate: number
  /** 1年継続率 = PRODUCT(D4:D14) */
  oneYearRetentionRate: number
  /** 1年離脱率 = 1 - 1年継続率 */
  oneYearChurnRate: number
  /** 獲得単価の上限目安（半年で回収）= SUM(C3:C8) */
  acquisitionCostCapHalfYear: number
  /** 理想の獲得単価（年間LTVの30%）= 1年間LTV × 30% */
  idealAcquisitionCost: number
}

/** 試算結果 */
export interface SimulationResult {
  id: string
  formulaSetVersion?: string
  storeName: string
  /** 住所（市区町村の人口統計表示に使用） */
  location?: string
  /** 立地タイプ（再計算の状態一致判定・表示に使用） */
  locationType?: LocationType
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
    /** 投資コスト内訳（フィールドID → 金額）。入力時の値をそのまま保持 */
    investmentBreakdown?: Record<string, number>
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
  /** 損益分岐会員数の4パターン（事業計画 I6-I9）。固定費に広告費/減価償却を加えるかで変動 */
  breakevenVariants?: {
    /** 固定費のみ（メイン。= breakevenMembers） I6/D4 */
    fixedOnly: number
    /** ＋広告費 I7 */
    withAdCost: number
    /** ＋減価償却 I8 */
    withDepreciation: number
    /** ＋広告費＋減価償却 I9 */
    withAdCostAndDepreciation: number
  }
  // 評価（1〜5、未評価は undefined）
  rating?: number
  // LTV（会費・継続率から算出。元スプレッドシート「LTV計算」シート相当）
  ltv?: LtvResult
  /** 平均単価（会費＋オプション。事業計画!C4） */
  averagePrice?: number
  /** 1人あたり変動費（決済手数料＋ロイヤリティ＋アプリ利用料＋サプリ原価。事業計画!L5） */
  variableCostPerMember?: number
  /** 1人あたり限界利益（平均単価 − 変動費。事業計画!L4） */
  contributionMarginPerMember?: number
  /**
   * 最低単価/人（月）。キャパシティ（最大会員数）まで埋めた場合に固定費を回収できる
   * 1人あたり月額売上の下限 = 変動費/人 + 固定費 ÷ 最大会員数。
   */
  minimumUnitPrice?: number
  /** キャパシティ（最大会員数・同時利用人数・駐車場必要台数） */
  capacity?: {
    maxMembers: number
    concurrentUsers: number
    parkingSpaces: number
  }
  /** 年次推移（最大10年。事業計画 R13-R22 相当） */
  annualProjection?: {
    year: number
    yearEndMembers: number
    revenue: number
    cost: number
    pretaxProfit: number
    afterTaxProfit: number
    /** 売上増加率(YoY)。1年目は undefined */
    revenueGrowthRate?: number
    /** 投資回収率 = 税引前利益累計 / 投資額 */
    paybackRatio: number
  }[]
  /** 入金サイクル(月)。資金繰り上の売上計上ラグ */
  cashCollectionLagMonths?: number
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
    /** 入金サイクル反映後の累計キャッシュ */
    cumulativeCash?: number
  }[]
}

export interface CalcCompetitorImpactConfig {
  upTo2: number
  for3: number
  for4: number
  over4: number
}

export interface CalcAdCostConfig {
  year1Month1: number
  year1Month2: number
  year1Month3To4: number
  year1Month5To12: number
  year2Monthly: number
  year3PlusMonthly: number
}

/** 平均単価の構成（入力欄!C81 = SUMPRODUCT(オプション単価×構成比)+会費） */
export interface CalcPricingOption {
  label: string
  /** 単価（円） 入力欄!C85:C90 */
  price: number
  /** 加入構成比 0〜1 入力欄!E85:E90 */
  ratio: number
}

export interface CalcPricingConfig {
  /** 会費（税抜） 入力欄!C72 */
  memberFeeExTax: number
  /** オプション料金表 入力欄!C85:E90 */
  options: CalcPricingOption[]
}

/** 継続率（LTV計算・事業計画 共通） */
export interface CalcRetentionConfig {
  /** 初月継続率 入力欄!C68 */
  firstMonth: number
  /** 2か月目以降継続率 入力欄!C69 */
  subsequent: number
}

/** 会員獲得モデルのパラメータ（事業計画 R35-R40） */
export interface CalcAcquisitionConfig {
  /** 自然検索率 入力欄!C71 */
  organicSearchRate: number
  /** 口コミ紹介率 入力欄!C70 */
  referralRate: number
  /** 初月見込み客の媒体配分 入力欄!D41/D42/D43 */
  channelSplit: { signage: number; web: number; sns: number }
  /** SEM獲得単価(1〜2年目) 入力欄!C64 */
  semCpaY1Y2: number
  /** SEM獲得単価(3年目以降) 入力欄!C65 */
  semCpaY3Plus: number
  /** SNS広告単価 入力欄!C66 */
  snsAdUnitCost: number
  /** Web広告月予算（獲得計算用） 入力欄!C76 */
  webBudgetMonthly: number
  /** SNS広告月予算（獲得計算用） 入力欄!C77 */
  snsBudgetMonthly: number
  /** SNS初月の固定上乗せ 事業計画!D38(+40) */
  snsInitialBonus: number
}

/** シナリオ別 店頭看板獲得スケジュール（事業計画 R35） */
export interface CalcSignageScenarioConfig {
  /** 初月基準値 = 初月見込み客×channelSplit.signage×baseFactor（アグレ1.0/標準0.7/保守0.3） */
  baseFactor: number
  /** 初月基準値を整数へ切り捨て（保守のみ true: ROUNDDOWN） */
  roundDownBase: boolean
  /** 2か月目係数（基準×factor） */
  month2Factor: number
  /** 3か月目係数 */
  month3Factor: number
  /** 4か月目係数 */
  month4Factor: number
  /** 5か月目以降の月次逓減率 */
  monthlyDecay: number
  /** 年2〜5のWeb/SNS広告効果係数（事業計画 D89/D141 等の ×N） */
  adEffectivenessYear2to5: number
  /** 年6〜10のWeb/SNS広告効果係数（事業計画 D299 等の ×N） */
  adEffectivenessYear6Plus: number
}

export interface CalcSignageConfig {
  conservative: CalcSignageScenarioConfig
  standard: CalcSignageScenarioConfig
  aggressive: CalcSignageScenarioConfig
}

/** キャパシティ計算のパラメータ（キャパシティ計算シート） */
export interface CalcCapacityConfig {
  /** 1人あたり利用回数(回/週) D9 */
  visitsPerWeek: number
  /** 平均滞在時間(時間) D10 */
  avgStayHours: number
  /** 1人当たり必要面積(坪) D12 */
  areaPerMemberTsubo: number
  /** 営業時間(時間/日) D14 */
  businessHours: number
  /** 平均稼働率 D17(=H34) */
  avgUtilization: number
  /** 田舎型の最大会員数係数 D18 */
  ruralFactor: number
  /** 駐車場利用率 D22 */
  parkingUtilization: number
}

/** 減価償却（投資項目別の耐用年数。入力欄 D5:D16） */
export interface CalcDepreciationConfig {
  /** 投資コストのフィールドID → 耐用年数(年)。未掲載の項目は非償却 */
  usefulLifeYears: Record<string, number>
}

export interface CalcParameterConfig {
  id?: string
  updatedAt?: string
  paymentFeeRate: number
  royaltyCapMonthly: number
  appFeeMonthly: number
  competitorImpact: CalcCompetitorImpactConfig
  adCost: CalcAdCostConfig
  // ── Excel計算モデル移植で追加 ──
  pricing: CalcPricingConfig
  retention: CalcRetentionConfig
  acquisition: CalcAcquisitionConfig
  signage: CalcSignageConfig
  capacity: CalcCapacityConfig
  depreciation: CalcDepreciationConfig
  /** 法人税率 入力欄!C92 */
  corporateTaxRate: number
  /** 入金サイクル(月) 入力欄!C79 */
  cashCollectionLagMonths: number
}
