// ============================================================
// 試算アプリ共通の型定義（UIプロトタイプ用モックデータ含む）
// ============================================================

/** 単価マスタ */
export type MasterValueRoyaltyMode = "binary" | "rate"

/**
 * 数量基準（ランニング/投資 共通）。
 * - monthly=単価をそのまま計上（数量なし）
 * - fixed=単価×数量（回数・台数等）
 * - perTsubo=単価×床面積(坪)×数量（試算画面で入力した床面積に連動）
 * - perOccupancy=単価×占有坪数(tsuboPerUnit)×数量（投資コスト専用。マスタ設定の占有坪数に連動）
 */
export type MasterValueQuantityBasis = "monthly" | "fixed" | "perTsubo" | "perOccupancy"

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
  // ── 数量基準（ランニング/投資 共通。元Excel 入力欄: 金額 = 単価 × 数量）──
  /**
   * 数量（回数・台数・坪数など）。
   * ランニング: 月額金額 = 単価(currentAmount) × 実効数量。
   * 投資: 取得額 = 単価 × 数量（fixed） / 単価 × 床面積(坪) × 数量（perTsubo） / 単価 × 占有坪数 × 数量（perOccupancy）。
   * 未設定は1。ゴルフ等の任意設備は0を既定にできる。
   */
  quantity?: number
  /**
   * 数量の基準。
   * monthly/未設定: 単価をそのまま計上（投資は取得額そのまま）。
   * fixed: 単価 × 数量（回数・台数）。
   * perTsubo: 単価 × 床面積(坪) × 数量（試算画面で入力した床面積に連動。例: 水道代 150円/坪 × 坪数）。
   * perOccupancy: 単価 × 占有坪数(tsuboPerUnit) × 数量（投資コスト専用。マスタ設定の占有坪数に連動）。
   */
  quantityBasis?: MasterValueQuantityBasis
  /**
   * 投資コスト専用: 1単位（台）あたりが占有する坪数（坪/単位）。
   * >0 の費目は「有効坪数 = 床面積 − Σ(数量 × tsuboPerUnit)」を通じてフィットネスマシン費の坪数を減らす。
   * perOccupancy の費目では取得額の算出（単価 × 占有坪数 × 数量）の単価係数にもなる。
   * 例: ゴルフ右打席=7坪/台、両打席=9坪/台。
   */
  tsuboPerUnit?: number
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
  /** 都道府県名（試算フォームで明示選択）。フィットネスマシン費・マシンメンテナンス費の単価算出に使用 */
  prefecture?: string
  scenario?: ScenarioType
  createdBy?: string
  floorAreaTsubo?: number
  rentPerTsubo?: number
  royaltyRate?: 0 | 10 | 15
  competitorCount?: number
  locationType?: LocationType
  runningCostTotal?: number
  /**
   * マシンメンテナンス費の手入力値（月額）。入力タブの固定枠で上書きした値。
   * 指定時はこの値を採用し、未指定なら machineMaintenance パラメータから自動算出する。
   * runningCostTotal には含めない（calc-engine 側で別途加算する）。
   */
  machineMaintenanceCost?: number
  /**
   * ランニングコスト内訳（事業計画シートの経費計画行の再現用。坪数換算後の月額）。
   * 合計は runningCostTotal と一致する想定。未指定時は内訳なし（合計1行で表示）。
   */
  runningCostBreakdown?: Array<{ id: string; label: string; monthlyAmount: number }>
  initialInvestmentTotal?: number
  initialInvestmentByRoyaltyRate?: Partial<Record<"0" | "10" | "15", number>>
  franchiseRate?: 0 | 10 | 15
  includeDepreciation?: boolean
  /** 住所から半径別の20〜59歳人口（小地域データを商圏円で按分。入力欄 E56/F56/G56 相当） */
  populationByRadius?: {
    km1Ring: number  // 半径0〜1km圏
    km3Ring: number  // 半径1〜3km圏（リング）
    km5Ring: number  // 半径3〜5km圏（リング）
  }
  /**
   * 商圏人口の年齢別内訳（入力欄 E47:G54）。試算に使うのは populationByRadius だけだが、
   * 結果画面に「年齢×距離」を根拠として表示するため、入力値をそのまま持ち回る。
   * cumulative は内側の圏を含む累計（1km/3km/5km の順）。
   */
  populationByAgeRadius?: Array<{
    from: number
    label: string
    cumulative: [number, number, number]
  }>
  /** 投資コスト内訳（フィールドID → 金額） */
  investmentBreakdown?: Record<string, number>
  /** 投資項目別の耐用年数（フィールドID → 償却年）。マスタ登録値。減価償却の算出に使用 */
  depreciationYearsByField?: Record<string, number>
  /** ALSOK・USEN導入費の内訳（結果画面の初期投資明細で表示。計算には使用しない） */
  securityIntroBreakdown?: SecurityIntroBreakdown
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

/** 事業計画シートの月次内訳1ヶ月分（元Excel「事業計画」シートの行構成を再現） */
export interface BusinessPlanMonth {
  /** 1始まりの通し月（最大120） */
  month: number
  /** 会員数（丸め済み。事業計画 R26/R31） */
  members: number
  /** 新規会員数（R32。未丸めの生値） */
  newMembers: number
  /** 継続会員数（R33。未丸めの生値） */
  retainedMembers: number
  /** 店頭看板効果（R35） */
  signageJoiners: number
  /** Web広告獲得（R37） */
  webJoiners: number
  /** SNS広告（R38） */
  snsJoiners: number
  /** 自然検索（R39） */
  organicJoiners: number
  /** 口コミ紹介（R40） */
  referralJoiners: number
  /** 売上（月契約）（R27） */
  revenue: number
  /** 広告費合計（R42） */
  adCost: number
  /** Web広告費（R43） */
  adCostWeb: number
  /** SNS広告費（R44） */
  adCostSns: number
  /** 固定費計（R60 = 家賃＋ランニング費目＋マシンメンテ） */
  fixedCostTotal: number
  /** アプリ利用料（R61） */
  appFee: number
  /** ロイヤリティ（R62） */
  royalty: number
  /** 決済手数料（R63） */
  paymentFee: number
  /** 変動費計（R65 = アプリ＋ロイヤリティ＋決済手数料） */
  variableCostTotal: number
  /** 経費合計（R68。試算上の実際の月次コスト。減価償却を含める設定の場合は含む） */
  totalCost: number
  /** 税引前利益（R69 = 売上 − 経費合計） */
  pretaxProfit: number
}

/** 事業計画シート再現データ（試算結果に付随） */
export interface BusinessPlanData {
  /**
   * 固定費の内訳行（毎月一定）。家賃・マスタ費目・マシンメンテナンス費の順。
   * 内訳合計と試算上の固定費に差がある場合は調整行（runningCostAdjustment）を含む。
   */
  fixedCostItems: Array<{ id: string; label: string; monthlyAmount: number }>
  /** 減価償却費（月額。事業計画 R72） */
  monthlyDepreciation: number
  /** 減価償却費を経費合計（totalCost）に含めているか */
  depreciationIncludedInCost: boolean
  /** 月次内訳（最大120ヶ月） */
  months: BusinessPlanMonth[]
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
  /** ALSOK・USEN導入費の内訳（初期投資明細の表示用。入力時の坪数×パラメータから算出） */
  securityIntroBreakdown?: SecurityIntroBreakdown
  // 月間
  monthlyRevenue: number
  monthlyRent: number
  monthlyRunningCost: number
  /** 月額ランニングコストのうちマシンメンテナンス費（内訳表示用。入力欄 B34） */
  monthlyMachineMaintenance?: number
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
  /** 事業計画シート再現データ（月次の金額内訳。元Excel「事業計画」シート相当） */
  businessPlan?: BusinessPlanData
}

/**
 * 競合ジム件数による見込み客の減少率（入力欄 E78）。
 * Excel: =IF(C78="1件",0.05,IF(C78="2件",0.1,IF(C78="3件",0.15,IF(C78="4件",0.2,IF(C78="5件",0.25,)))))
 *
 * `none`/`for1` は後から追加したフィールド（旧レコードには存在しない）。
 * 未設定時は `normalizeCalcParams` が Excel 準拠の既定値（0件=0%、1件=5%）で補完する。
 * `upTo2` は Excel の「2件」に対応する（後方互換のためキー名は据え置き）。
 */
export interface CalcCompetitorImpactConfig {
  /** 0件（競合なし）。Excel は該当分岐が無く 0%。旧レコード互換のため任意 */
  none?: number
  /** 1件。Excel 5%。旧レコード互換のため任意 */
  for1?: number
  /** 2件。Excel 10% */
  upTo2: number
  /** 3件。Excel 15% */
  for3: number
  /** 4件。Excel 20% */
  for4: number
  /** 5件以上。Excel は「5件」で 25%（6件以上は選択肢外） */
  over4: number
}

/**
 * 立地タイプ別の商圏獲得率（入力欄 E59/F59/G59）。
 * 各リング人口（20〜59歳）に掛けて見込み客数 E60/F60/G60 を出す。
 * Excel:
 *   E59 = IF(都市型,0.015, IF(郊外型,0.012, IF(田舎型,0.03)))   ← 1km圏
 *   F59 = IF(都市型,0.008, IF(郊外型,0.008, IF(田舎型,0.015)))  ← 1km超3km以内
 *   G59 = IF(都市型,0.001, IF(郊外型,0.001, IF(田舎型,0.01)))   ← 3km超5km以内
 */
export interface CalcCatchmentRateSet {
  /** 1km圏（E59） */
  km1: number
  /** 1km超3km以内（F59） */
  km3: number
  /** 3km超5km以内（G59） */
  km5: number
}

/** ロイヤリティ率別の月額上限（入力欄 E73 の IF 分岐）。rate10 = FC10%、other = それ以外(0%/15%) */
export interface CalcRoyaltyCapSet {
  rate10: number
  other: number
}

/** 立地タイプ別の獲得単価（入力欄 C64/C65 の IF 分岐） */
export interface CalcSemCpaSet {
  urban: number
  suburban: number
  rural: number
}

export interface CalcCatchmentConfig {
  urban: CalcCatchmentRateSet
  suburban: CalcCatchmentRateSet
  rural: CalcCatchmentRateSet
}

/** レポート出力（PDF/PPTX）の設定。マスタ管理「レポート出力設定」で編集する。 */
export type ReportSectionId =
  | "summary"
  | "investment"
  | "monthlyPL"
  | "breakeven"
  | "annual"
  | "demographics"

export type ReportKpiId =
  | "initialInvestment"
  | "monthlyRevenue"
  | "monthlyProfit"
  | "paybackMonths"
  | "breakevenMembers"
  | "averagePrice"
  | "contributionMargin"
  | "maxMembers"

export interface ReportExportConfig {
  /** 出力するセクション。配列の順序がそのまま出力順になる */
  sections: { id: ReportSectionId; enabled: boolean }[]
  /** サマリに載せるKPI項目 */
  kpiItems: { id: ReportKpiId; enabled: boolean }[]
  /** 表紙設定 */
  cover: {
    title: string
    companyName: string
    /** ロゴ画像（data URL。未設定なら非表示） */
    logoDataUrl?: string
  }
  /** テーマ色（アクセント色。# 無しの16進。例 "2563EB"） */
  theme: { accentColor: string }
  /** 用紙設定 */
  page: { size: "A4" | "Letter"; orientation: "portrait" | "landscape" }
  updatedAt?: string
}

export interface CalcAdCostConfig {
  year1Month1: number
  year1Month2: number
  year1Month3To4: number
  year1Month5To12: number
  year2Monthly: number
  year3PlusMonthly: number
  /**
   * シナリオ別・年別の月額広告費オーバーライド（事業計画 R42）。
   * キー=年(2..10)。Excelは特定年だけ月18万円へスポット増額する計算根拠のない手入力があるため、
   * その年だけ上記の年2/年3以降スケジュールを上書きしてExcelに一致させる。未指定の年はフォールバック。
   */
  scenarioMonthlyOverride?: Partial<Record<ScenarioType, Record<number, number>>>
}

/** 広告費のうちWeb広告費の月次スケジュール（事業計画 R43）。SNS広告費 = 広告費合計 − Web広告費 */
export interface CalcAdCostWebConfig {
  year1Month1: number
  year1Month2: number
  /** 1年目3ヶ月目以降・2年目以降共通の月額 */
  monthly: number
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
  /**
   * SEM獲得単価(1〜2年目) 入力欄!C64。
   * Excelは立地タイプ別の分岐（都市型3000/郊外型4000/田舎型5000）。
   * semCpaY1Y2 は旧レコード互換のための郊外型フォールバック。
   */
  semCpaY1Y2: number
  semCpaY1Y2ByLocation?: CalcSemCpaSet
  /**
   * SEM獲得単価(3年目以降) 入力欄!C65（都市型5000/郊外型6000/田舎型8000）。
   * 元Excelでは3年目以降も獲得数の算出に C64 を使っており C65 は参照されていないが、
   * 定義はマスタとして保持する。
   */
  semCpaY3Plus: number
  semCpaY3PlusByLocation?: CalcSemCpaSet
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

/** マシンメンテナンスの坪数帯→作業人数・日数（入力欄 N19/P19） */
export interface CalcMachineMaintenanceTsuboTier {
  /** この坪数以上で適用。該当する最大の minTsubo の行を採用 */
  minTsubo: number
  /** 作業人数（入力欄 N19） */
  workers: number
  /** 作業日数（入力欄 P19） */
  days: number
}

/**
 * マシンメンテナンス費（入力欄 B34）。
 * 1回費用 = 都道府県別単価(K23) × 作業人数(N19) × 作業日数(P19)。
 * 月額 = 1回費用 ÷ 実施間隔(ヶ月)。Excel C34=IF(C73=0,0,…) を踏襲しFC時のみ計上可。
 *
 * 都道府県別単価(Q列)は元Excelでは「拠点(愛知)からの距離(L列)」連動で算出する:
 *   M = ROUNDDOWN(L, -2)      … 距離を distanceStepKm 単位に切り捨て
 *   N = M / distanceStepKm
 *   O = N × distanceStepCost  … 距離加算（distanceStepKm ごとに加算）
 *   P = baseUnitPrice + O     … 基本料 + 距離加算（入力欄 P=$L$47+O）
 *   Q = P / unitPriceDivisor  … メンテ単価（入力欄 Q=P/2）
 * ただしExcelのQ列は一部が式ではなく手入力の固定値で上書きされており、その県は
 * unitPriceByPrefecture（固定値）を優先採用して計算値ではなくその値を再現する。
 */
export interface CalcMachineMaintenanceConfig {
  /** ロイヤリティ>0（FC）のときのみ計上。Excel の C73=0→0 を踏襲 */
  applyOnlyWhenFranchise: boolean
  /** 実施間隔(ヶ月)。月額 = 1回費用 ÷ この値（Excel「2〜3ヶ月に1回」を月割り） */
  intervalMonths: number
  /** 基本料金（入力欄 $L$47）。距離0（拠点=愛知）時の P 値 */
  baseUnitPrice: number
  /** 距離の丸め単位km（入力欄 M=ROUNDDOWN(L,-2) の -2 → 100km） */
  distanceStepKm: number
  /** 丸め単位ごとの距離加算額（入力欄 O=N×20000） */
  distanceStepCost: number
  /** メンテ単価への割り戻し係数（入力欄 Q=P/2 の 2） */
  unitPriceDivisor: number
  /** 都道府県別 拠点(愛知)からの距離km（入力欄 L列）。愛知=0（基準額アンカーのため距離0扱い） */
  distanceByPrefecture: Record<string, number>
  /**
   * Q列が式ではなく手入力の固定値で上書きされている県の単価。
   * 存在する県は距離計算値ではなくこの固定値を採用する（Excel の手修正を再現）。
   */
  unitPriceByPrefecture: Record<string, number>
  /** 住所から都道府県が取れない場合の単価 */
  fallbackUnitPrice: number
  /** 坪数帯→作業人数・日数（入力欄 N19/P19） */
  tsuboTiers: CalcMachineMaintenanceTsuboTier[]
}

/**
 * フィットネスマシン費（投資コスト。入力欄 J8 = 坪単価 × 有効坪数）。
 * 坪単価は都道府県別料金表（入力欄 料金表の最右列）を参照し、
 * 直営（ロイヤリティ=0）は参照値を directDivisor で割り戻す（既定: 半額）。FCは満額。
 * 有効坪数 = 床面積 − ゴルフ打席の占有坪（右7坪/台・両9坪/台。投資マスタ tsuboPerUnit）。
 */
export interface CalcFitnessMachineConfig {
  /** 都道府県別の坪あたり単価（FC満額。円/坪） */
  unitPriceByPrefecture: Record<string, number>
  /** 直営（ロイヤリティ=0）時の割り戻し係数。直営単価 = 満額 ÷ この値（半額=2） */
  directDivisor: number
  /** 住所から都道府県が特定できない場合の坪単価（FC満額ベース） */
  fallbackUnitPrice: number
}

/** 機器台数の階段式（Excel ROUNDUP(基準台数 + (坪数 − 基準坪数) ÷ 坪刻み, 0)） */
export interface CalcDeviceCountRule {
  /** 基準坪数のときの台数 */
  baseCount: number
  /** 基準坪数 */
  baseTsubo: number
  /** 何坪ごとに1台追加するか（切り上げのため1坪でも超えると+1台） */
  tsuboPerUnit: number
}

/**
 * ALSOK・USEN導入費（投資コスト。入力欄 B16/J16）。
 *   取得額 = ROUNDUP( 固定額合計 + カメラ単価×カメラ台数 + サイネージ単価×サイネージ台数, 丸め単位 )
 *   カメラ台数     = ROUNDUP(5 + (坪数−50)÷17, 0)（入力欄 D26）
 *   サイネージ台数 = ROUNDUP(2 + 坪数÷40, 0)（入力欄 D28）
 * D26/D28 はランニングコスト行（防犯カメラ(USEN)・モニター(USEN) の月額台数）と共有のセル。
 * ロイヤリティ非連動・非償却。光回線 21,000（M12）は Excel の SUM 範囲外のため既定では含めない。
 */
export interface CalcSecurityConfig {
  /** 固定額の内訳（Wifi・スピーカー・ALSOK 等。入力欄 M13/M14/M16） */
  fixedItems: Array<{ label: string; amount: number }>
  /** カメラの導入単価（入力欄 M15 の 110,000円/台） */
  cameraUnitPrice: number
  /** カメラ台数式（入力欄 D26） */
  cameraCountRule: CalcDeviceCountRule
  /** サイネージ（モニター）の導入単価（入力欄 M17 の 170,000円/台） */
  monitorUnitPrice: number
  /** サイネージ台数式（入力欄 D28） */
  monitorCountRule: CalcDeviceCountRule
  /** 合計の切り上げ単位（Excel ROUNDUP(M18,-4) → 10,000円） */
  roundUpUnit: number
}

/**
 * ALSOK・USEN導入費の内訳（試算結果画面の初期投資明細で表示する。入力欄 L13:M17 相当）。
 * 試算実行時点の坪数×計算パラメータから算出した明細を保持する。
 */
export interface SecurityIntroBreakdown {
  /** 固定額の内訳（Wifi・スピーカー・ALSOK 等） */
  fixedItems: Array<{ label: string; amount: number }>
  /** カメラ（台数×導入単価） */
  camera: { count: number; unitPrice: number; amount: number }
  /** サイネージ/モニター（台数×導入単価） */
  monitor: { count: number; unitPrice: number; amount: number }
  /** 切り上げ前の合算額（入力欄 M18） */
  subtotal: number
  /** 切り上げ単位（10,000円 = 万円切り上げ） */
  roundUpUnit: number
  /** 切り上げ後の取得額（入力欄 J16） */
  total: number
}

/**
 * 開業前パッケージ費（投資コスト。入力欄 B15/I15/J15）。
 * I15 = ROUND(baseAmount + (坪数 − baseTsubo) × amountPerTsubo, 丸め単位)
 * J15 = IF(直営, I15 × directRateFactor + directRateAddition, I15)
 * マスタ管理＞ロジック可視化から編集できる。
 */
export interface CalcOpeningPackageConfig {
  /** 基準坪数（baseTsubo）時の金額。入力欄 I15 の 1,400,000 */
  baseAmount: number
  /** 基準坪数。入力欄 I15 の 50 */
  baseTsubo: number
  /** 基準坪からの増減1坪あたりの金額。入力欄 I15 の 10,000 */
  amountPerTsubo: number
  /** 丸め単位（円）。入力欄 I15 の ROUND(...,-5) = 100,000円単位 */
  roundUnit: number
  /** 直営（ロイヤリティ0%）時の係数。入力欄 J15 の 0.5 */
  directRateFactor: number
  /** 直営時の加算額。入力欄 J15 の 200,000 */
  directRateAddition: number
}

/**
 * 開業前パッケージ費の算出内訳（試算結果画面の初期投資明細・ロジック可視化のプレビューで表示）。
 */
export interface OpeningPackageBreakdown {
  baseAmount: number
  baseTsubo: number
  amountPerTsubo: number
  /** 算出に使った坪数 */
  floorAreaTsubo: number
  /** 丸め前の金額 */
  rawAmount: number
  roundUnit: number
  /** 丸め後の金額（入力欄 I15） */
  roundedAmount: number
  /** 直営（ロイヤリティ0%）か */
  isDirect: boolean
  directRateFactor: number
  directRateAddition: number
  /** 最終取得額（入力欄 J15） */
  total: number
}

export interface CalcParameterConfig {
  id?: string
  updatedAt?: string
  paymentFeeRate: number
  /**
   * ロイヤリティ月額上限（入力欄 E73 = IF($C$73=10%, 300000, 5000000)）。
   * Excelはロイヤリティ率で上限が変わる。royaltyCapMonthly は旧レコード互換のフラット値。
   */
  royaltyCapMonthly: number
  royaltyCapByRate?: CalcRoyaltyCapSet
  /**
   * アプリ利用料（入力欄 C74 = IF(ロイヤリティ=0, 0, 50)）。
   * Excelは事業計画 R61 = 会員数 × 単価 の「1人あたり」。
   * appFeeMonthly は月額固定として扱っていた旧実装の残骸で、現在は使用しない。
   */
  appFeeMonthly: number
  appFeePerMember?: number
  competitorImpact: CalcCompetitorImpactConfig
  /** 立地タイプ別の商圏獲得率（入力欄 E59/F59/G59）。未設定時は既定値で補完 */
  catchment?: CalcCatchmentConfig
  adCost: CalcAdCostConfig
  /** Web広告費スケジュール（事業計画 R43）。未設定時は既定値（80,000/80,000/120,000） */
  adCostWeb?: CalcAdCostWebConfig
  // ── Excel計算モデル移植で追加 ──
  pricing: CalcPricingConfig
  retention: CalcRetentionConfig
  acquisition: CalcAcquisitionConfig
  signage: CalcSignageConfig
  capacity: CalcCapacityConfig
  depreciation: CalcDepreciationConfig
  /** マシンメンテナンス費（入力欄 B34） */
  machineMaintenance: CalcMachineMaintenanceConfig
  /** フィットネスマシン費（投資コスト。入力欄 J8） */
  fitnessMachine: CalcFitnessMachineConfig
  /** ALSOK・USEN導入費（投資コスト。入力欄 B16/J16） */
  security: CalcSecurityConfig
  /** 開業前パッケージ費（投資コスト。入力欄 B15/I15/J15） */
  openingPackage: CalcOpeningPackageConfig
  /** 法人税率 入力欄!C92 */
  corporateTaxRate: number
  /** 入金サイクル(月) 入力欄!C79 */
  cashCollectionLagMonths: number
}
