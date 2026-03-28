export type NeighborhoodData = {
  areaNumber: number
  rent: { avg: number; low: number; high: number } | null
  crime: { total: number; per100k: number | null; year: number } | null
  demographics: { population: number; estimatedMedianIncome: number; households: number } | null
  transit: { ctaStations: number; ctaLines: string[] }
  bus: { busReliability: number | null; busRouteCount: number; busAvgWeekdayRiders: number; busRoutes: string[] }
}

export type AllData = {
  neighborhoods: Record<string, NeighborhoodData>
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}
