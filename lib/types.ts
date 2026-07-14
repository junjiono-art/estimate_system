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

export interface CalcCompetitorImpactConfig {
  upTo2: number
  for3: number
  for4: number
  over4: number
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

export interface CalcParameterConfig {
  id?: string
  updatedAt?: string
  paymentFeeRate: number
  royaltyCapMonthly: number
  appFeeMonthly: number
  competitorImpact: CalcCompetitorImpactConfig
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
  /** 法人税率 入力欄!C92 */
  corporateTaxRate: number
  /** 入金サイクル(月) 入力欄!C79 */
  cashCollectionLagMonths: number
}
