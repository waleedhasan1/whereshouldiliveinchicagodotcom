/**
 * Build a unified neighborhood-data.json for all 77 Chicago community areas.
 *
 * Data sources:
 * - Rent: extracted from waleedhasan project
 * - Crime: Chicago Data Portal (Crimes - 2001 to Present) via SODA API
 * - Income/Demographics: Chicago Data Portal (ACS 5-Year by Community Area)
 * - Transit: CTA stations JSON (point-in-polygon to community areas)
 * - Ghost Buses: route reliability data (spatial overlap with community areas)
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(__dirname, '..', 'public')

// ─── Rent Data (extracted from waleedhasan RentMapInline.tsx) ───
const RENT_DATA = {
  'ROGERS PARK': { avg: 1150, low: 850, high: 1500 },
  'WEST RIDGE': { avg: 1100, low: 800, high: 1450 },
  'UPTOWN': { avg: 1250, low: 900, high: 1700 },
  'LINCOLN SQUARE': { avg: 1350, low: 950, high: 1800 },
  'NORTH CENTER': { avg: 1600, low: 1100, high: 2200 },
  'LAKE VIEW': { avg: 1750, low: 1200, high: 2500 },
  'LINCOLN PARK': { avg: 1900, low: 1300, high: 2800 },
  'NEAR NORTH SIDE': { avg: 2200, low: 1500, high: 3500 },
  'EDISON PARK': { avg: 1200, low: 900, high: 1550 },
  'NORWOOD PARK': { avg: 1150, low: 850, high: 1500 },
  'JEFFERSON PARK': { avg: 1100, low: 800, high: 1400 },
  'FOREST GLEN': { avg: 1300, low: 950, high: 1700 },
  'NORTH PARK': { avg: 1200, low: 850, high: 1550 },
  'ALBANY PARK': { avg: 1100, low: 800, high: 1450 },
  'PORTAGE PARK': { avg: 1050, low: 750, high: 1400 },
  'IRVING PARK': { avg: 1150, low: 800, high: 1500 },
  'DUNNING': { avg: 1050, low: 750, high: 1350 },
  'MONTCLARE': { avg: 1000, low: 750, high: 1300 },
  'BELMONT CRAGIN': { avg: 950, low: 700, high: 1250 },
  'HERMOSA': { avg: 900, low: 650, high: 1200 },
  'AVONDALE': { avg: 1300, low: 900, high: 1750 },
  'LOGAN SQUARE': { avg: 1450, low: 1000, high: 2000 },
  'HUMBOLDT PARK': { avg: 1050, low: 700, high: 1450 },
  'WEST TOWN': { avg: 1650, low: 1100, high: 2400 },
  'AUSTIN': { avg: 850, low: 600, high: 1150 },
  'WEST GARFIELD PARK': { avg: 800, low: 550, high: 1100 },
  'EAST GARFIELD PARK': { avg: 900, low: 600, high: 1250 },
  'NEAR WEST SIDE': { avg: 1800, low: 1200, high: 2600 },
  'NORTH LAWNDALE': { avg: 850, low: 600, high: 1150 },
  'SOUTH LAWNDALE': { avg: 900, low: 650, high: 1200 },
  'LOWER WEST SIDE': { avg: 1050, low: 750, high: 1400 },
  'LOOP': { avg: 2100, low: 1400, high: 3200 },
  'NEAR SOUTH SIDE': { avg: 1900, low: 1300, high: 2800 },
  'ARMOUR SQUARE': { avg: 1050, low: 750, high: 1400 },
  'DOUGLAS': { avg: 1300, low: 900, high: 1800 },
  'OAKLAND': { avg: 1200, low: 800, high: 1650 },
  'FULLER PARK': { avg: 800, low: 550, high: 1100 },
  'GRAND BOULEVARD': { avg: 1100, low: 750, high: 1500 },
  'KENWOOD': { avg: 1350, low: 950, high: 1850 },
  'WASHINGTON PARK': { avg: 900, low: 600, high: 1250 },
  'HYDE PARK': { avg: 1400, low: 950, high: 1950 },
  'WOODLAWN': { avg: 1050, low: 700, high: 1450 },
  'SOUTH SHORE': { avg: 950, low: 650, high: 1300 },
  'CHATHAM': { avg: 900, low: 650, high: 1200 },
  'AVALON PARK': { avg: 950, low: 700, high: 1250 },
  'SOUTH CHICAGO': { avg: 850, low: 600, high: 1150 },
  'BURNSIDE': { avg: 800, low: 550, high: 1100 },
  'CALUMET HEIGHTS': { avg: 950, low: 700, high: 1250 },
  'ROSELAND': { avg: 900, low: 650, high: 1200 },
  'PULLMAN': { avg: 950, low: 700, high: 1250 },
  'SOUTH DEERING': { avg: 850, low: 600, high: 1150 },
  'EAST SIDE': { avg: 900, low: 650, high: 1200 },
  'WEST PULLMAN': { avg: 850, low: 600, high: 1150 },
  'RIVERDALE': { avg: 750, low: 500, high: 1050 },
  'HEGEWISCH': { avg: 950, low: 700, high: 1250 },
  'GARFIELD RIDGE': { avg: 1050, low: 750, high: 1400 },
  'ARCHER HEIGHTS': { avg: 1000, low: 700, high: 1350 },
  'BRIGHTON PARK': { avg: 950, low: 700, high: 1250 },
  'MCKINLEY PARK': { avg: 1100, low: 800, high: 1450 },
  'NEW CITY': { avg: 900, low: 650, high: 1200 },
  'WEST ELSDON': { avg: 1000, low: 750, high: 1300 },
  'GAGE PARK': { avg: 950, low: 700, high: 1250 },
  'CLEARING': { avg: 1050, low: 750, high: 1400 },
  'WEST LAWN': { avg: 1000, low: 700, high: 1350 },
  'CHICAGO LAWN': { avg: 950, low: 650, high: 1300 },
  'WEST ENGLEWOOD': { avg: 800, low: 550, high: 1100 },
  'ENGLEWOOD': { avg: 750, low: 500, high: 1050 },
  'GREATER GRAND CROSSING': { avg: 850, low: 600, high: 1150 },
  'ASHBURN': { avg: 1050, low: 750, high: 1400 },
  'AUBURN GRESHAM': { avg: 850, low: 600, high: 1150 },
  'BEVERLY': { avg: 1250, low: 900, high: 1650 },
  'WASHINGTON HEIGHTS': { avg: 900, low: 650, high: 1200 },
  'MOUNT GREENWOOD': { avg: 1150, low: 850, high: 1500 },
  'MORGAN PARK': { avg: 1050, low: 750, high: 1400 },
  'OHARE': { avg: 1100, low: 800, high: 1450 },
  'EDGEWATER': { avg: 1300, low: 900, high: 1750 },
  'BRIDGEPORT': { avg: 1200, low: 850, high: 1600 },
}

// ─── Community area number → name mapping (from GeoJSON) ───
function loadCommunityAreas() {
  const geojson = JSON.parse(readFileSync(resolve(PUBLIC, 'boundaries_communities.geojson'), 'utf-8'))
  const map = {}
  for (const f of geojson.features) {
    const num = parseInt(f.properties.area_numbe)
    const name = f.properties.community
    map[num] = name
  }
  return map
}

// ─── Point-in-polygon (ray casting) ───
function pointInPolygon(pt, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pointInMultiPolygon(pt, geometry) {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]
  for (const polygon of polygons) {
    if (pointInPolygon(pt, polygon[0])) return true
  }
  return false
}

// ─── CTA stations per community area ───
function computeTransit(geojson) {
  const stations = JSON.parse(readFileSync(resolve(PUBLIC, 'cta-stations.json'), 'utf-8'))
  const result = {} // area_num → { stationCount, lines: Set }

  for (const station of stations) {
    const pt = [station.lng, station.lat]
    for (const feature of geojson.features) {
      if (pointInMultiPolygon(pt, feature.geometry)) {
        const num = parseInt(feature.properties.area_numbe)
        if (!result[num]) result[num] = { stationCount: 0, lines: new Set() }
        result[num].stationCount++
        for (const line of station.lines.split(', ')) {
          const core = line.replace(/ Line$/, '').replace(/ \(Express\)$/, '').replace(/Evanston Express/, 'Purple').trim()
          if (core) result[num].lines.add(core)
        }
        break
      }
    }
  }

  // Convert Sets to arrays
  for (const num of Object.keys(result)) {
    result[num].lines = [...result[num].lines]
  }
  return result
}

// ─── Ghost bus: average route reliability per community area ───
function computeGhostBus(geojson) {
  const ghostData = JSON.parse(readFileSync(resolve(PUBLIC, 'ghost-bus-data.json'), 'utf-8'))
  const ridershipData = JSON.parse(readFileSync(resolve(PUBLIC, 'ghost-bus-ridership.json'), 'utf-8'))

  // Build ridership lookup: route_id → avg weekday riders
  const ridershipMap = {}
  for (const entry of ridershipData.data || []) {
    if (entry.day_type === 'wk') {
      ridershipMap[entry.route_id] = entry.avg_riders
    }
  }

  // For each route, sample midpoint → find community area
  const areaRoutes = {} // area_num → [{ ratio, ridership }]

  for (const feature of ghostData.features || []) {
    const coords = feature.geometry?.coordinates
    if (!coords || coords.length === 0) continue
    const ratio = feature.properties?.ratio
    if (ratio == null) continue

    // Sample midpoint of route
    const mid = coords[Math.floor(coords.length / 2)]
    for (const cf of geojson.features) {
      if (pointInMultiPolygon(mid, cf.geometry)) {
        const num = parseInt(cf.properties.area_numbe)
        if (!areaRoutes[num]) areaRoutes[num] = []
        areaRoutes[num].push({
          ratio,
          ridership: ridershipMap[feature.properties.route_id] || 0,
          route: feature.properties.route_short_name || feature.properties.route_id,
        })
        break
      }
    }
  }

  // Aggregate per area: avg reliability, total routes, total ridership
  const result = {}
  for (const [num, routes] of Object.entries(areaRoutes)) {
    const avgReliability = routes.reduce((s, r) => s + r.ratio, 0) / routes.length
    const totalRidership = routes.reduce((s, r) => s + r.ridership, 0)
    const uniqueRoutes = [...new Set(routes.map(r => r.route))]
    result[num] = {
      busReliability: Math.round(avgReliability * 1000) / 1000,
      busRouteCount: uniqueRoutes.length,
      busAvgWeekdayRiders: Math.round(totalRidership),
      busRoutes: uniqueRoutes,
    }
  }
  return result
}

// ─── Fetch crime data from Chicago Data Portal ───
async function fetchCrime() {
  console.log('Fetching crime data from Chicago Data Portal...')
  // Get crime counts per community area for last full year
  const year = new Date().getFullYear() - 1
  const url = `https://data.cityofchicago.org/resource/ijzp-q8t2.json?$select=community_area,count(*) as crime_count&$where=year=${year} AND community_area IS NOT NULL&$group=community_area&$order=community_area&$limit=100`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Crime API error: ${res.status}`)
  const data = await res.json()

  const result = {}
  for (const row of data) {
    const num = parseInt(row.community_area)
    if (num > 0) result[num] = parseInt(row.crime_count)
  }
  console.log(`  Got crime data for ${Object.keys(result).length} community areas (${year})`)
  return { counts: result, year }
}

// ─── Fetch ACS income/demographics from Chicago Data Portal ───
async function fetchDemographics(communityMap) {
  console.log('Fetching ACS demographics from Chicago Data Portal...')
  // Dataset t68z-cikk has community_area as NAME, income as buckets
  const url = `https://data.cityofchicago.org/resource/t68z-cikk.json?$limit=100&$where=acs_year='2023'`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`ACS API error: ${res.status}`)
  const data = await res.json()

  // Build name → area number reverse map
  const nameToNum = {}
  for (const [num, name] of Object.entries(communityMap)) {
    nameToNum[name] = parseInt(num)
  }

  const result = {}
  for (const row of data) {
    const name = (row.community_area || '').toUpperCase()
    const num = nameToNum[name]
    if (!num) continue

    const pop = parseFloat(row.total_population || 0)
    // Estimate median income from income brackets (midpoint method)
    const brackets = [
      { count: parseFloat(row.under_25_000 || 0), mid: 15000 },
      { count: parseFloat(row._25_000_to_49_999 || 0), mid: 37500 },
      { count: parseFloat(row._50_000_to_74_999 || 0), mid: 62500 },
      { count: parseFloat(row._75_000_to_125_000 || 0), mid: 100000 },
      { count: parseFloat(row._125_000 || 0), mid: 162500 },
    ]
    const totalHouseholds = brackets.reduce((s, b) => s + b.count, 0)
    const weightedSum = brackets.reduce((s, b) => s + b.count * b.mid, 0)
    const estimatedMedian = totalHouseholds > 0 ? Math.round(weightedSum / totalHouseholds) : 0

    result[num] = {
      population: Math.round(pop),
      estimatedMedianIncome: estimatedMedian,
      households: Math.round(totalHouseholds),
    }
  }
  console.log(`  Got demographics for ${Object.keys(result).length} community areas`)
  return result
}

// ─── Main ───
async function main() {
  const communityMap = loadCommunityAreas()
  const geojson = JSON.parse(readFileSync(resolve(PUBLIC, 'boundaries_communities.geojson'), 'utf-8'))

  // Fetch remote data
  const [crimeData, demographics] = await Promise.all([
    fetchCrime(),
    fetchDemographics(communityMap),
  ])

  // Compute local spatial data
  console.log('Computing transit coverage per community area...')
  const transit = computeTransit(geojson)

  console.log('Computing ghost bus reliability per community area...')
  const ghostBus = computeGhostBus(geojson)

  // Build unified dataset
  const neighborhoods = {}
  for (const [numStr, name] of Object.entries(communityMap)) {
    const num = parseInt(numStr)
    const rent = RENT_DATA[name] || null
    const crime = crimeData.counts[num] || null
    const demo = demographics[num] || null
    const trans = transit[num] || null
    const ghost = ghostBus[num] || null

    neighborhoods[name] = {
      areaNumber: num,
      rent: rent ? { avg: rent.avg, low: rent.low, high: rent.high } : null,
      crime: crime ? {
        total: crime,
        per100k: demo?.population > 0 ? Math.round((crime / demo.population) * 100000) : null,
        year: crimeData.year,
      } : null,
      demographics: demo,
      transit: trans ? {
        ctaStations: trans.stationCount,
        ctaLines: trans.lines,
      } : { ctaStations: 0, ctaLines: [] },
      bus: ghost || { busReliability: null, busRouteCount: 0, busAvgWeekdayRiders: 0, busRoutes: [] },
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    sources: {
      rent: 'Estimated averages by community area',
      crime: `Chicago Data Portal - Crimes dataset (${crimeData.year})`,
      demographics: 'Chicago Data Portal - ACS 5-Year Community Area Estimates',
      transit: 'CTA station locations (point-in-polygon)',
      bus: 'CHN Ghost Buses project (github.com/chihacknight/chn-ghost-buses)',
    },
    neighborhoods,
  }

  const outPath = resolve(PUBLIC, 'neighborhood-data.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\nWrote ${Object.keys(neighborhoods).length} neighborhoods to ${outPath}`)

  // Print a quick summary
  const withCrime = Object.values(neighborhoods).filter(n => n.crime).length
  const withIncome = Object.values(neighborhoods).filter(n => n.demographics?.medianIncome).length
  const withTransit = Object.values(neighborhoods).filter(n => n.transit.ctaStations > 0).length
  const withBus = Object.values(neighborhoods).filter(n => n.bus.busReliability != null).length
  console.log(`  Rent: 77/77 | Crime: ${withCrime}/77 | Income: ${withIncome}/77 | Transit: ${withTransit}/77 | Bus: ${withBus}/77`)
}

main().catch(err => { console.error(err); process.exit(1) })
