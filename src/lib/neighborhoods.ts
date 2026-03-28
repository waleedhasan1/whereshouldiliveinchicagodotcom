import fs from 'fs'
import path from 'path'
import type { AllData, NeighborhoodData } from './types'

let cached: AllData | null = null

export function loadNeighborhoods(): AllData {
  if (cached) return cached
  const filePath = path.join(process.cwd(), 'public', 'neighborhood-data.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  cached = JSON.parse(raw)
  return cached!
}

type ParsedCriteria = {
  rentBudget: number | null
  wantSafe: boolean
  wantTransit: boolean
  transitLines: string[]
  wantBus: boolean
  specificNeighborhoods: string[]
}

const CTA_LINES = ['red', 'blue', 'green', 'brown', 'orange', 'pink', 'purple', 'yellow']

export function parseQuery(query: string): ParsedCriteria {
  const q = query.toLowerCase()

  // Rent budget: "$1500", "under 1500", "1500/mo", "budget 1500", "2k", "$2k"
  let rentBudget: number | null = null
  const rentMatchK = q.match(/\$?\s*(\d+)\s*k/)
  if (rentMatchK) rentBudget = parseInt(rentMatchK[1]) * 1000
  if (!rentBudget) {
    const rentMatch = q.match(/\$?\s*(\d{3,5})\s*(?:\/mo|a month|per month|rent|monthly|budget)?/)
    if (rentMatch) rentBudget = parseInt(rentMatch[1])
  }
  if (!rentBudget && /cheap|affordable|budget|low.?rent|inexpensive/.test(q)) rentBudget = 1200

  // Safety
  const wantSafe = /safe|low.?crime|quiet|peaceful|family.?friendly|secure/.test(q)

  // Transit — detect specific lines even without the word "line"
  const wantTransit = /transit|train|cta|\bl\b|commut|metro|subway/.test(q)
  const transitLines: string[] = []
  for (const line of CTA_LINES) {
    if (q.includes(line + ' line') || q.includes(line + 'line') || new RegExp(`\\b${line}\\s+line\\b`).test(q)) {
      transitLines.push(line.charAt(0).toUpperCase() + line.slice(1))
    }
    // Also match "on the blue", "near the red", "the brown line"
    if (new RegExp(`(?:on|near|the)\\s+${line}\\b`).test(q)) {
      const capitalized = line.charAt(0).toUpperCase() + line.slice(1)
      if (!transitLines.includes(capitalized)) transitLines.push(capitalized)
    }
  }

  // Bus
  const wantBus = /\bbus\b|reliable bus/.test(q)

  // Specific neighborhoods
  const data = loadNeighborhoods()
  const specificNeighborhoods: string[] = []
  for (const name of Object.keys(data.neighborhoods)) {
    if (q.includes(name.toLowerCase())) {
      specificNeighborhoods.push(name)
    }
  }

  return { rentBudget, wantSafe, wantTransit, transitLines, wantBus, specificNeighborhoods }
}

function passesHardFilters(nd: NeighborhoodData, criteria: ParsedCriteria): boolean {
  // Must be at or under rent budget (with 10% tolerance)
  if (criteria.rentBudget && nd.rent) {
    if (nd.rent.avg > criteria.rentBudget * 1.1) return false
  }

  // Must have the requested CTA line
  if (criteria.transitLines.length > 0) {
    const hasLine = criteria.transitLines.some(line =>
      nd.transit.ctaLines.some(l => l.toLowerCase().includes(line.toLowerCase()))
    )
    if (!hasLine) return false
  }

  return true
}

export type SearchResult = {
  neighborhoods: { name: string; data: NeighborhoodData }[]
  transitLines: string[]
  topPicks: string[]
  specificNeighborhoods: string[] // neighborhoods explicitly mentioned by the user
  rentBudget: number | null
}

export function findRelevantNeighborhoods(query: string): SearchResult {
  const data = loadNeighborhoods()
  const criteria = parseQuery(query)

  // If asking about specific neighborhoods, return those
  if (criteria.specificNeighborhoods.length > 0) {
    const neighborhoods = criteria.specificNeighborhoods.map(name => ({ name, data: data.neighborhoods[name] }))
    return {
      neighborhoods,
      transitLines: criteria.transitLines,
      topPicks: neighborhoods.slice(0, 5).map(n => n.name),
      specificNeighborhoods: criteria.specificNeighborhoods,
      rentBudget: criteria.rentBudget,
    }
  }

  const hasCriteria = criteria.rentBudget || criteria.wantSafe || criteria.wantTransit || criteria.wantBus || criteria.transitLines.length > 0

  // If no specific criteria, return all neighborhoods
  if (!hasCriteria) {
    const all = Object.entries(data.neighborhoods).map(([name, d]) => ({ name, data: d }))
    return { neighborhoods: all, transitLines: [], topPicks: [], specificNeighborhoods: [], rentBudget: null }
  }

  // First: hard filter to only neighborhoods that meet requirements
  const passing: { name: string; data: NeighborhoodData; score: number }[] = []

  for (const [name, nd] of Object.entries(data.neighborhoods)) {
    if (!passesHardFilters(nd, criteria)) continue

    // Score remaining neighborhoods for ranking
    let score = 0

    if (criteria.rentBudget && nd.rent) {
      // Closer to budget = higher score
      score += Math.max(0, 1 - (criteria.rentBudget - nd.rent.avg) / criteria.rentBudget) * 3
    }

    if (criteria.wantSafe && nd.crime?.per100k != null) {
      const crimePct = nd.crime.per100k / 15000
      score += (1 - crimePct) * 3
    }

    if (criteria.transitLines.length > 0) {
      score += nd.transit.ctaStations * 0.5
    } else if (criteria.wantTransit) {
      score += Math.min(nd.transit.ctaStations, 5) * 0.6
    }

    if (criteria.wantBus && nd.bus.busReliability != null) {
      score += nd.bus.busReliability * 3
    }

    passing.push({ name, data: nd, score })
  }

  passing.sort((a, b) => b.score - a.score)

  const results = passing.slice(0, 20)
  return {
    neighborhoods: results.map(({ name, data: d }) => ({ name, data: d })),
    transitLines: criteria.transitLines,
    topPicks: results.slice(0, 5).map(r => r.name),
    specificNeighborhoods: criteria.specificNeighborhoods,
    rentBudget: criteria.rentBudget,
  }
}
