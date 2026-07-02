import type {
  CalcAcquisitionConfig,
  CalcRetentionConfig,
  CalcSignageScenarioConfig,
} from "@/lib/types"

export interface MemberGrowthMonth {
  /** 1始まりの通し月（全年連続） */
  month: number
  /** 新規会員数 事業計画!R32 = SUM(媒体別獲得) */
  newMembers: number
  /** 継続会員数 事業計画!R33/R74（コホート継続） */
  retainedMembers: number
  /** 会員数 事業計画!R31 = MIN(新規+継続, キャパ上限)。未丸めの生値 */
  members: number
  /** 媒体別獲得の内訳 */
  signageJoiners: number
  webJoiners: number
  snsJoiners: number
  organicJoiners: number
  referralJoiners: number
}

export interface MemberGrowthParams {
  /** 初月見込み客 入力欄!G38 */
  initialJoiners: number
  /** キャパ上限（最大会員数） E4 */
  maxMembers: number
  /** 通常 120（10年） */
  months: number
  retention: CalcRetentionConfig
  acquisition: CalcAcquisitionConfig
  /** シナリオ別の店頭看板スケジュール */
  signage: CalcSignageScenarioConfig
}

// 店頭看板の月次系列（事業計画 R35）。
// 年1: 月1=基準, 月2/3/4=基準×係数, 月5以降=前月×逓減率。
// 年2以降: 年1の最終月(12月)の値で横ばい固定（Excel R87=$O$35）。
function buildSignageSeries(base: number, cfg: CalcSignageScenarioConfig, months: number): number[] {
  const series: number[] = []
  const totalMonths = Math.max(months, 12)
  for (let m = 1; m <= totalMonths; m += 1) {
    let value: number
    if (m > 12) {
      value = series[11] // 年1の12月値で固定
    } else if (m === 1) {
      value = base
    } else if (m === 2) {
      value = base * cfg.month2Factor
    } else if (m === 3) {
      value = base * cfg.month3Factor
    } else if (m === 4) {
      value = base * cfg.month4Factor
    } else {
      value = series[m - 2] * cfg.monthlyDecay
    }
    series[m - 1] = value
  }
  return series.slice(0, months)
}

// 年2以降のWeb/SNS広告効果係数（事業計画 D89/D299 等の ×N）。年1は係数なし。
function adEffectiveness(month: number, signage: CalcSignageScenarioConfig): number {
  const year = Math.ceil(month / 12)
  if (year <= 1) return 1
  if (year <= 5) return signage.adEffectivenessYear2to5
  return signage.adEffectivenessYear6Plus
}

// Web広告獲得（事業計画 R37/R89/R141）。月1は初月見込み客の媒体配分、月2以降は 月予算/CPA×広告効果係数。
// 元シートは全年とも SEM CPA(1〜2年目)=C64 を参照（D141=$C$76/$C$64）。3年目以降CPA(C65)は獲得計算では未使用。
function webJoinersForMonth(month: number, initialJoiners: number, acq: CalcAcquisitionConfig, signage: CalcSignageScenarioConfig): number {
  if (month === 1) return initialJoiners * acq.channelSplit.web
  const base = acq.semCpaY1Y2 > 0 ? acq.webBudgetMonthly / acq.semCpaY1Y2 : 0
  return base * adEffectiveness(month, signage)
}

// SNS広告獲得（事業計画 R38）。月1は初月見込み客の媒体配分＋固定上乗せ、月2以降は 月予算/単価×広告効果係数。
function snsJoinersForMonth(month: number, initialJoiners: number, acq: CalcAcquisitionConfig, signage: CalcSignageScenarioConfig): number {
  if (month === 1) return initialJoiners * acq.channelSplit.sns + acq.snsInitialBonus
  const base = acq.snsAdUnitCost > 0 ? acq.snsBudgetMonthly / acq.snsAdUnitCost : 0
  return base * adEffectiveness(month, signage)
}

// 会員数の月次シミュレーション（事業計画 R31-R40, R73/R74 の移植）。
//
// 各月: 会員数 = MIN(新規 + 継続, キャパ上限)
//   新規 = 店頭看板 + Web + SNS + 自然検索 + 口コミ
//   自然検索 = 前月会員 × 自然検索率 × (キャパ - 前月会員)/キャパ（ロジスティック）
//   口コミ   = 口コミ率 × 前月会員 × (キャパ - 前月会員)/キャパ
//   継続(m)  = 新規(m-1) × 初月継続率 + 継続(m-1) × 2か月目継続率（コホート、キャップ前の生値で累積）
//
// 年境界の基準会員数（Excel忠実移植）:
//   Excelは年ごとに別ブロックを持ち、各年1月の自然検索/口コミの基準には
//   前年12月の「キャップ前合計 = 新規+継続」を使う（例 事業計画 C83=SUM(C125:C126)=O73+O74）。
//   一方、年内の他の月は MIN 後の確定会員数(R31)を基準にする。
//   会員数がキャパ到達済みだと前者は上限超（例 759.94>725）となり、自然検索/口コミが
//   わずかに負値になる。売上は MIN で一致するが、内訳表示をExcelと一致させるため再現する。
export function simulateMemberGrowth(params: MemberGrowthParams): MemberGrowthMonth[] {
  const { initialJoiners, maxMembers, months, retention, acquisition, signage } = params
  const cap = maxMembers

  const signageBaseRaw = initialJoiners * acquisition.channelSplit.signage * signage.baseFactor
  const signageBase = signage.roundDownBase ? Math.floor(signageBaseRaw) : signageBaseRaw
  const signageSeries = buildSignageSeries(signageBase, signage, months)

  const result: MemberGrowthMonth[] = []
  const newSeries: number[] = []
  const retainSeries: number[] = []
  const uncappedSeries: number[] = []

  for (let m = 1; m <= months; m += 1) {
    // 年境界(各年1月, m=13,25,…)のみ前月のキャップ前合計を基準にする。他の月は確定会員数。
    const isYearBoundary = m > 1 && (m - 1) % 12 === 0
    const prevMembers =
      m === 1 ? 0 : isYearBoundary ? uncappedSeries[m - 2] : result[m - 2].members

    let organic = 0
    let referral = 0
    if (m >= 2 && cap > 0) {
      const headroomRatio = (cap - prevMembers) / cap
      organic = prevMembers * acquisition.organicSearchRate * headroomRatio
      referral = acquisition.referralRate * prevMembers * headroomRatio
    }

    const web = webJoinersForMonth(m, initialJoiners, acquisition, signage)
    const sns = snsJoinersForMonth(m, initialJoiners, acquisition, signage)
    const signageJoiners = signageSeries[m - 1]
    const newMembers = signageJoiners + web + sns + organic + referral

    const retainedMembers =
      m === 1 ? 0 : newSeries[m - 2] * retention.firstMonth + retainSeries[m - 2] * retention.subsequent

    newSeries[m - 1] = newMembers
    retainSeries[m - 1] = retainedMembers

    const uncapped = newMembers + retainedMembers
    uncappedSeries[m - 1] = uncapped
    const members = cap > 0 ? Math.min(uncapped, cap) : uncapped

    result.push({
      month: m,
      newMembers,
      retainedMembers,
      members,
      signageJoiners,
      webJoiners: web,
      snsJoiners: sns,
      organicJoiners: organic,
      referralJoiners: referral,
    })
  }

  return result
}
