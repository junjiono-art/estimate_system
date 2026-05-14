import type { SimulationRequestInput } from "@/lib/types"

// Preview API and editor UI share the same baseline input to keep results comparable.
export const PREVIEW_SIMULATION_INPUT_DEFAULTS: Partial<SimulationRequestInput> = {
  storeName: "preview-store",
  scenario: "standard",
  floorAreaTsubo: 60,
  rentPerTsubo: 920000,
  royaltyRate: 10,
  franchiseRate: 10,
  competitorCount: 2,
  locationType: "suburban",
  runningCostTotal: 420000,
  initialInvestmentTotal: 26000000,
  includeDepreciation: true,
  populationByRadius: {
    km1Ring: 42000,
    km3Ring: 138000,
    km5Ring: 182000,
  },
}

// Derived values represent a realistic month snapshot for formula preview.
export const PREVIEW_CONTEXT_OVERRIDES_DEFAULTS: Record<string, number> = {
  month: 12,
  members: 620,
  monthlyRevenue: 1850000,
  monthlyRent: 920000,
  monthlyRunningCost: 420000,
  adCostMonthly: 180000,
  paymentFee: 55000,
  monthlyRoyalty: 185000,
}
