"use client"

import { useState } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CodeIcon,
  FlaskConicalIcon,
  RotateCcwIcon,
  SaveIcon,
  CheckIcon,
  AlertTriangleIcon,
  InfoIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ─── 型定義 ───────────────────────────────────────────────────────────────────

type FormulaStatus = "saved" | "modified" | "error"

interface FormulaItem {
  id: string
  name: string
  description: string
  variables: string[]
  returns: string
  formula: string
  defaultFormula: string
  status: FormulaStatus
}

interface FormulaGroup {
  id: string
  label: string
  icon: React.ElementType
  items: FormulaItem[]
}

// ─── デフォルト計算式データ ──────────────────────────────────────────────────

const DEFAULT_FORMULAS: FormulaGroup[] = [
  {
    id: "simulation",
    label: "シミュレーション",
    icon: FlaskConicalIcon,
    items: [
      {
        id: "sim_member_interpolation",
        name: "会員数の年内補完",
        description: "年初から年末の会員数を月次で線形補完します。",
        variables: ["start: number（年初会員数）", "end: number（年末会員数）"],
        returns: "number[]（12ヶ月分の月末会員数）",
        defaultFormula: `function buildMemberSeries(start, end) {
  const members = Array.from({ length: 12 }, (_, i) => {
    const progress = (i + 1) / 12;
    return Math.round(start + (end - start) * progress);
  });
  members[11] = end; // 最終月は年末値を確定
  return members;
}`,
        formula: `function buildMemberSeries(start, end) {
  const members = Array.from({ length: 12 }, (_, i) => {
    const progress = (i + 1) / 12;
    return Math.round(start + (end - start) * progress);
  });
  members[11] = end; // 最終月は年末値を確定
  return members;
}`,
        status: "saved",
      },
      {
        id: "sim_competitor_rate",
        name: "競合倍率",
        description: "競合店舗数に応じた需要減衰率を返します。",
        variables: [
          "competitorCount: number（競合店舗数）",
          "params.competitorImpact（upTo2 / for3 / for4 / over4）",
        ],
        returns: "number（減衰率 0.0〜1.0）",
        defaultFormula: `function getCompetitorImpactRate(competitorCount, params) {
  if (competitorCount <= 0) return 0;
  if (competitorCount <= 2) return params.competitorImpact.upTo2;
  if (competitorCount === 3) return params.competitorImpact.for3;
  if (competitorCount === 4) return params.competitorImpact.for4;
  return params.competitorImpact.over4;
}`,
        formula: `function getCompetitorImpactRate(competitorCount, params) {
  if (competitorCount <= 0) return 0;
  if (competitorCount <= 2) return params.competitorImpact.upTo2;
  if (competitorCount === 3) return params.competitorImpact.for3;
  if (competitorCount === 4) return params.competitorImpact.for4;
  return params.competitorImpact.over4;
}`,
        status: "saved",
      },
      {
        id: "sim_demand_multiplier",
        name: "需要倍率",
        description: "立地タイプと競合状況から需要乗数を算出します。",
        variables: [
          "locationType: 'urban' | 'suburban' | 'rural'",
          "competitorCount: number",
          "params: CalcParameterConfig",
        ],
        returns: "number（需要乗数）",
        defaultFormula: `function getDemandMultiplier(locationType, competitorCount, params) {
  const BASE_FIRST_MONTH = 334;
  const POPULATION_FACTOR = 1 - 0.26;

  if (locationType === 'urban') {
    return (137 * POPULATION_FACTOR) / BASE_FIRST_MONTH;
  }
  if (locationType === 'rural') {
    const impact = getCompetitorImpactRate(competitorCount, params);
    return ((137 + 316 + 65) * POPULATION_FACTOR * (1 - impact)) / BASE_FIRST_MONTH;
  }
  // suburban (デフォルト)
  return ((137 + 316) * POPULATION_FACTOR) / BASE_FIRST_MONTH;
}`,
        formula: `function getDemandMultiplier(locationType, competitorCount, params) {
  const BASE_FIRST_MONTH = 334;
  const POPULATION_FACTOR = 1 - 0.26;

  if (locationType === 'urban') {
    return (137 * POPULATION_FACTOR) / BASE_FIRST_MONTH;
  }
  if (locationType === 'rural') {
    const impact = getCompetitorImpactRate(competitorCount, params);
    return ((137 + 316 + 65) * POPULATION_FACTOR * (1 - impact)) / BASE_FIRST_MONTH;
  }
  // suburban (デフォルト)
  return ((137 + 316) * POPULATION_FACTOR) / BASE_FIRST_MONTH;
}`,
        status: "saved",
      },
      {
        id: "sim_payment_fee",
        name: "決済手数料",
        description: "月次売上に対して決済手数料を計算します。",
        variables: [
          "revenue: number（月次売上 円）",
          "params.paymentFeeRate: number（手数料率 例: 0.035）",
        ],
        returns: "number（決済手数料 円）",
        defaultFormula: `function getPaymentFee(revenue, params) {
  return Math.round(revenue * params.paymentFeeRate);
}`,
        formula: `function getPaymentFee(revenue, params) {
  return Math.round(revenue * params.paymentFeeRate);
}`,
        status: "saved",
      },
      {
        id: "sim_ad_cost",
        name: "広告費",
        description: "月番号と年次に基づいて広告費を返します。",
        variables: [
          "month: number（通算月番号 1〜120）",
          "params.adCost（year1Month1 / year1Month2 / year1Month3To4 / year1Month5To12 / year2Monthly / year3PlusMonthly）",
        ],
        returns: "number（広告費 円）",
        defaultFormula: `function getMonthlyAdCost(month, params) {
  const year = Math.ceil(month / 12);
  const monthInYear = ((month - 1) % 12) + 1;

  if (year === 1) {
    if (monthInYear === 1) return params.adCost.year1Month1;
    if (monthInYear === 2) return params.adCost.year1Month2;
    if (monthInYear <= 4)  return params.adCost.year1Month3To4;
    return params.adCost.year1Month5To12;
  }
  if (year === 2) return params.adCost.year2Monthly;
  return params.adCost.year3PlusMonthly;
}`,
        formula: `function getMonthlyAdCost(month, params) {
  const year = Math.ceil(month / 12);
  const monthInYear = ((month - 1) % 12) + 1;

  if (year === 1) {
    if (monthInYear === 1) return params.adCost.year1Month1;
    if (monthInYear === 2) return params.adCost.year1Month2;
    if (monthInYear <= 4)  return params.adCost.year1Month3To4;
    return params.adCost.year1Month5To12;
  }
  if (year === 2) return params.adCost.year2Monthly;
  return params.adCost.year3PlusMonthly;
}`,
        status: "saved",
      },
      {
        id: "sim_joiner_coefficient",
        name: "見込み人数係数",
        description: "20〜59歳人口から見込み人数係数をVLOOKUP的に算出します。",
        variables: ["population: number（20〜59歳人口）"],
        returns: "number（係数 例: -0.16〜-0.88）",
        defaultFormula: `function lookupMemberCoefficient(population) {
  // 5000人ステップで16%から最大88%まで1%ずつ増加（最大72ステップ）
  const steps = Math.min(72, Math.floor(Math.max(0, population) / 5000));
  return -(16 + steps) / 100;
}`,
        formula: `function lookupMemberCoefficient(population) {
  // 5000人ステップで16%から最大88%まで1%ずつ増加（最大72ステップ）
  const steps = Math.min(72, Math.floor(Math.max(0, population) / 5000));
  return -(16 + steps) / 100;
}`,
        status: "saved",
      },
      {
        id: "sim_initial_joiners",
        name: "初月見込み人数",
        description:
          "立地タイプ・半径別人口・競合影響から初月の見込み入会人数を計算します。",
        variables: [
          "input.locationType: 'urban' | 'suburban' | 'rural'",
          "input.populationByRadius: { km1Ring, km3Ring, km5Ring }",
          "input.competitorCount: number",
          "params: CalcParameterConfig",
        ],
        returns: "number（初月見込み入会人数）",
        defaultFormula: `function resolveInitialJoiners(input, params) {
  const { km1Ring, km3Ring, km5Ring } = input.populationByRadius;
  const locationType = input.locationType ?? 'suburban';
  const competitorCount = Math.max(0, input.competitorCount ?? 0);

  // 各圏の見込み入会人数
  const e60 = km1Ring * 0.012; // 1km圏: 1.20%
  const f60 = km3Ring * 0.008; // 3km圏リング: 0.80%
  const g60 = km5Ring * 0.001; // 5km圏リング: 0.10%

  // VLOOKUPの検索値（立地タイプ別の累計人口）
  const lookupPop =
    locationType === 'urban'   ? km1Ring :
    locationType === 'suburban' ? km1Ring + km3Ring :
                                  km1Ring + km3Ring + km5Ring;

  const e38 = lookupMemberCoefficient(lookupPop);

  // 立地タイプ別の基準見込み数
  let baseJoiners;
  if (locationType === 'urban')    baseJoiners = e60 * (1 + e38);
  else if (locationType === 'suburban') baseJoiners = e60 + f60 * (1 + e38);
  else                              baseJoiners = e60 + f60 + g60 * (1 + e38);

  const impact = getCompetitorImpactRate(competitorCount, params);
  return Math.max(1, Math.round(baseJoiners * (1 - impact)));
}`,
        formula: `function resolveInitialJoiners(input, params) {
  const { km1Ring, km3Ring, km5Ring } = input.populationByRadius;
  const locationType = input.locationType ?? 'suburban';
  const competitorCount = Math.max(0, input.competitorCount ?? 0);

  // 各圏の見込み入会人数
  const e60 = km1Ring * 0.012; // 1km圏: 1.20%
  const f60 = km3Ring * 0.008; // 3km圏リング: 0.80%
  const g60 = km5Ring * 0.001; // 5km圏リング: 0.10%

  // VLOOKUPの検索値（立地タイプ別の累計人口）
  const lookupPop =
    locationType === 'urban'   ? km1Ring :
    locationType === 'suburban' ? km1Ring + km3Ring :
                                  km1Ring + km3Ring + km5Ring;

  const e38 = lookupMemberCoefficient(lookupPop);

  // 立地タイプ別の基準見込み数
  let baseJoiners;
  if (locationType === 'urban')    baseJoiners = e60 * (1 + e38);
  else if (locationType === 'suburban') baseJoiners = e60 + f60 * (1 + e38);
  else                              baseJoiners = e60 + f60 + g60 * (1 + e38);

  const impact = getCompetitorImpactRate(competitorCount, params);
  return Math.max(1, Math.round(baseJoiners * (1 - impact)));
}`,
        status: "saved",
      },
      {
        id: "sim_main_calc",
        name: "試算本計算",
        description:
          "シナリオ別シードに需要乗数・コスト計算を適用して月次行を構築します。",
        variables: [
          "rows: RegressionMonthlyRow[]（シードデータ）",
          "input: SimulateInput",
          "params: CalcParameterConfig",
        ],
        returns: "RegressionMonthlyRow[]（補正済み月次行）",
        defaultFormula: `function applyCalcParams(rows, input, params) {
  const royaltyRate = Math.max(0, resolveFranchiseRate(input)) / 100;
  const initialJoiners = resolveInitialJoiners(input, params);
  const demandMultiplier = Math.max(0.2, initialJoiners / 334);
  const monthlyRent = resolveMonthlyRent(input);
  const monthlyRunning = resolveMonthlyRunning(input);
  const fixedNonAdCost = monthlyRent + monthlyRunning;

  return rows.map((row) => {
    const revenue = Math.max(0, Math.round(row.revenue * demandMultiplier));
    const members = Math.max(0, Math.round(row.members * demandMultiplier));
    const adCost = getMonthlyAdCost(row.month, params);
    const paymentFee = getPaymentFee(revenue, params);
    const royaltyRaw = Math.round(revenue * royaltyRate);
    const royalty = Math.min(royaltyRaw, params.royaltyCapMonthly);
    const appFee = royalty > 0 ? params.appFeeMonthly : 0;
    const cost = fixedNonAdCost + adCost + paymentFee + royalty + appFee;
    return { month: row.month, members, revenue, cost, profit: revenue - cost };
  });
}`,
        formula: `function applyCalcParams(rows, input, params) {
  const royaltyRate = Math.max(0, resolveFranchiseRate(input)) / 100;
  const initialJoiners = resolveInitialJoiners(input, params);
  const demandMultiplier = Math.max(0.2, initialJoiners / 334);
  const monthlyRent = resolveMonthlyRent(input);
  const monthlyRunning = resolveMonthlyRunning(input);
  const fixedNonAdCost = monthlyRent + monthlyRunning;

  return rows.map((row) => {
    const revenue = Math.max(0, Math.round(row.revenue * demandMultiplier));
    const members = Math.max(0, Math.round(row.members * demandMultiplier));
    const adCost = getMonthlyAdCost(row.month, params);
    const paymentFee = getPaymentFee(revenue, params);
    const royaltyRaw = Math.round(revenue * royaltyRate);
    const royalty = Math.min(royaltyRaw, params.royaltyCapMonthly);
    const appFee = royalty > 0 ? params.appFeeMonthly : 0;
    const cost = fixedNonAdCost + adCost + paymentFee + royalty + appFee;
    return { month: row.month, members, revenue, cost, profit: revenue - cost };
  });
}`,
        status: "saved",
      },
      {
        id: "sim_10year_monthly",
        name: "10年分の月次データ構築",
        description:
          "年次シードデータから10年分（最大120ヶ月）の月次データ配列を構築します。",
        variables: [
          "scenario: 'conservative' | 'standard' | 'aggressive'",
          "input: SimulateInput",
          "params: CalcParameterConfig",
        ],
        returns: "RegressionMonthlyRow[]（最大120行）",
        defaultFormula: `function buildRegressionRows(scenario, input, params) {
  const year1 = MONTHLY_SEEDS[scenario].map((row) => ({ ...row }));
  const annualSeeds = ANNUAL_SEEDS[scenario];
  const rows = [...year1];

  let monthCursor = 12;
  let prevYearEndMembers = year1[11]?.members ?? 0;

  for (const year of annualSeeds) {
    if (year.year === 1) {
      prevYearEndMembers = year.yearEndMembers;
      continue;
    }
    const members = buildMemberSeries(prevYearEndMembers, year.yearEndMembers);
    const monthlyRevenue = distributeToMonths(year.annualRevenue);
    const monthlyCost = distributeToMonths(year.annualCost);

    for (let i = 0; i < 12; i++) {
      monthCursor++;
      const revenue = monthlyRevenue[i];
      const cost = monthlyCost[i];
      rows.push({ month: monthCursor, members: members[i], revenue, cost, profit: revenue - cost });
    }
    prevYearEndMembers = year.yearEndMembers;
  }
  return applyCalcParams(rows, input, params);
}`,
        formula: `function buildRegressionRows(scenario, input, params) {
  const year1 = MONTHLY_SEEDS[scenario].map((row) => ({ ...row }));
  const annualSeeds = ANNUAL_SEEDS[scenario];
  const rows = [...year1];

  let monthCursor = 12;
  let prevYearEndMembers = year1[11]?.members ?? 0;

  for (const year of annualSeeds) {
    if (year.year === 1) {
      prevYearEndMembers = year.yearEndMembers;
      continue;
    }
    const members = buildMemberSeries(prevYearEndMembers, year.yearEndMembers);
    const monthlyRevenue = distributeToMonths(year.annualRevenue);
    const monthlyCost = distributeToMonths(year.annualCost);

    for (let i = 0; i < 12; i++) {
      monthCursor++;
      const revenue = monthlyRevenue[i];
      const cost = monthlyCost[i];
      rows.push({ month: monthCursor, members: members[i], revenue, cost, profit: revenue - cost });
    }
    prevYearEndMembers = year.yearEndMembers;
  }
  return applyCalcParams(rows, input, params);
}`,
        status: "saved",
      },
      {
        id: "sim_payback",
        name: "回収月と累積利益",
        description: "初期投資額から回収月と月次累積利益を算出します。",
        variables: [
          "rows: RegressionMonthlyRow[]",
          "initialInvestment: number（初期投資額 円）",
        ],
        returns: "{ paybackMonth: number, monthlyProjection: MonthlyProjection[] }",
        defaultFormula: `function estimatePaybackMonths(rows, initialInvestment) {
  let cumulativeProfit = -initialInvestment;
  for (const row of rows) {
    cumulativeProfit += row.profit;
    if (cumulativeProfit >= 0) return row.month;
  }
  return 999; // 10年以内に回収不可
}

function buildMonthlyProjection(rows, initialInvestment) {
  let cumulativeProfit = -initialInvestment;
  return rows.map((row) => {
    cumulativeProfit += row.profit;
    return {
      month: row.month,
      members: row.members,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
      cumulativeProfit,
    };
  });
}`,
        formula: `function estimatePaybackMonths(rows, initialInvestment) {
  let cumulativeProfit = -initialInvestment;
  for (const row of rows) {
    cumulativeProfit += row.profit;
    if (cumulativeProfit >= 0) return row.month;
  }
  return 999; // 10年以内に回収不可
}

function buildMonthlyProjection(rows, initialInvestment) {
  let cumulativeProfit = -initialInvestment;
  return rows.map((row) => {
    cumulativeProfit += row.profit;
    return {
      month: row.month,
      members: row.members,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
      cumulativeProfit,
    };
  });
}`,
        status: "saved",
      },
    ],
  },
  {
    id: "population",
    label: "人口",
    icon: CodeIcon,
    items: [
      {
        id: "pop_ring_heat",
        name: "リング熱人口",
        description:
          "メッシュ人口データから各リング（1km / 3km / 5km圏）の20〜59歳人口を集計します。",
        variables: [
          "meshData: MeshPopulationRecord[]（メッシュごとの人口レコード）",
          "centerLat: number（店舗緯度）",
          "centerLng: number（店舗経度）",
        ],
        returns: "{ km1Ring: number, km3Ring: number, km5Ring: number }",
        defaultFormula: `function calcRingPopulation(meshData, centerLat, centerLng) {
  let km1 = 0, km3 = 0, km5 = 0;

  for (const mesh of meshData) {
    const dist = haversineDistance(centerLat, centerLng, mesh.lat, mesh.lng);
    const pop = mesh.population_20_59 ?? 0;

    if (dist <= 1.0) {
      km1 += pop;           // 1km圏（内包）
    } else if (dist <= 3.0) {
      km3 += pop;           // 1〜3kmリング
    } else if (dist <= 5.0) {
      km5 += pop;           // 3〜5kmリング
    }
  }

  return { km1Ring: km1, km3Ring: km3, km5Ring: km5 };
}

// ハーバーサイン距離公式（km）
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}`,
        formula: `function calcRingPopulation(meshData, centerLat, centerLng) {
  let km1 = 0, km3 = 0, km5 = 0;

  for (const mesh of meshData) {
    const dist = haversineDistance(centerLat, centerLng, mesh.lat, mesh.lng);
    const pop = mesh.population_20_59 ?? 0;

    if (dist <= 1.0) {
      km1 += pop;           // 1km圏（内包）
    } else if (dist <= 3.0) {
      km3 += pop;           // 1〜3kmリング
    } else if (dist <= 5.0) {
      km5 += pop;           // 3〜5kmリング
    }
  }

  return { km1Ring: km1, km3Ring: km3, km5Ring: km5 };
}

// ハーバーサイン距離公式（km）
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}`,
        status: "saved",
      },
    ],
  },
]

// ─── ステータスバッジ ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FormulaStatus }) {
  if (status === "saved") {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
        <CheckIcon className="size-2.5" />
        保存済み
      </Badge>
    )
  }
  if (status === "error") {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] border-destructive/30 text-destructive bg-destructive/5">
        <AlertTriangleIcon className="size-2.5" />
        エラー
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5">
      未保存
    </Badge>
  )
}

// ─── 計算式エディタ行 ─────────────────────────────────────────────────────────

function FormulaRow({ item, onUpdate }: { item: FormulaItem; onUpdate: (id: string, formula: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const isModified = item.formula !== item.defaultFormula

  function handleReset() {
    onUpdate(item.id, item.defaultFormula)
    toast.info(`「${item.name}」をデフォルトに戻しました。`)
  }

  return (
    <div className={cn(
      "rounded-md border border-border bg-card transition-colors",
      item.status === "error" && "border-destructive/40",
      isModified && item.status !== "error" && "border-amber-500/30",
    )}>
      {/* ヘッダー行 */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-md"
      >
        <span className="text-muted-foreground transition-transform duration-200" style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
          <ChevronDownIcon className="size-3.5" />
        </span>
        <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>
        <StatusBadge status={isModified ? (item.status === "error" ? "error" : "modified") : item.status} />
      </button>

      {/* 展開コンテンツ */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {/* 説明 */}
          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>

          {/* 引数 / 戻り値 */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">引数</p>
              {item.variables.map((v) => (
                <p key={v} className="font-mono text-[11px] text-foreground/80 leading-relaxed">{v}</p>
              ))}
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">戻り値</p>
              <p className="font-mono text-[11px] text-foreground/80 leading-relaxed">{item.returns}</p>
            </div>
          </div>

          {/* コードエディタ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">計算式</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RotateCcwIcon className="size-3" />
                      デフォルトに戻す
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    デフォルトの計算式に戻します（保存はされません）
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              value={item.formula}
              onChange={(e) => onUpdate(item.id, e.target.value)}
              className="font-mono text-xs leading-relaxed min-h-[200px] resize-y bg-background border-border"
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── グループセクション ───────────────────────────────────────────────────────

function FormulaGroupSection({
  group,
  onUpdate,
}: {
  group: FormulaGroup
  onUpdate: (id: string, formula: string) => void
}) {
  const [open, setOpen] = useState(true)
  const modifiedCount = group.items.filter((item) => item.formula !== item.defaultFormula).length

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      {/* グループヘッダー */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <group.icon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-semibold text-foreground">{group.label}</span>
        {modifiedCount > 0 && (
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5">
            {modifiedCount}件 未保存
          </Badge>
        )}
        <span className="text-muted-foreground">
          {open ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
        </span>
      </button>

      {/* 計算式リスト */}
      {open && (
        <div className="p-4 space-y-2">
          {group.items.map((item) => (
            <FormulaRow key={item.id} item={item} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export function FormulaEditor() {
  const [groups, setGroups] = useState<FormulaGroup[]>(DEFAULT_FORMULAS)
  const [isSaving, setIsSaving] = useState(false)

  const totalModified = groups.reduce(
    (acc, g) => acc + g.items.filter((item) => item.formula !== item.defaultFormula).length,
    0,
  )

  function handleUpdate(id: string, formula: string) {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) =>
          item.id === id ? { ...item, formula, status: "modified" } : item,
        ),
      })),
    )
  }

  async function handleSave() {
    setIsSaving(true)
    // NOTE: 実際の保存APIが実装されるまでの仮処理
    await new Promise((resolve) => setTimeout(resolve, 800))
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) => ({
          ...item,
          defaultFormula: item.formula,
          status: "saved" as FormulaStatus,
        })),
      })),
    )
    setIsSaving(false)
    toast.success("計算式を保存しました。次回の試算から反映されます。")
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-7 space-y-6">
      {/* 注意バナー */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <InfoIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-amber-700">計算式の編集について</p>
          <p className="text-xs text-amber-600/80 leading-relaxed">
            ここで編集した計算式はGUI上の表示のみに使用されます。実際のエンジンロジックへの反映は開発者による手動対応が必要です。構文エラーが含まれる場合、試算結果に影響が出ることがあります。
          </p>
        </div>
      </div>

      {/* 計算式グループ */}
      {groups.map((group) => (
        <FormulaGroupSection key={group.id} group={group} onUpdate={handleUpdate} />
      ))}

      {/* 保存フッター */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {totalModified > 0 ? (
            <span className="text-amber-600">{totalModified}件の計算式に未保存の変更があります</span>
          ) : (
            "すべての計算式は保存済みです"
          )}
        </p>
        <Button onClick={handleSave} disabled={isSaving || totalModified === 0}>
          <SaveIcon className="size-4" />
          {isSaving ? "保存中..." : "保存する"}
        </Button>
      </div>
    </div>
  )
}
