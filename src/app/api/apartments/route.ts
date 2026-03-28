export type ApartmentListing = {
  address: string
  price: number
  beds: number
  baths: number
  sqft: number
  highlight: string
  photo?: string
  listingUrl?: string
  lat?: number
  lng?: number
}

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || ''
const RAPIDAPI_HOST = 'realtor-search.p.rapidapi.com'

type RealtorResult = {
  location?: {
    address?: {
      line?: string
      city?: string
      state_code?: string
      postal_code?: string
      coordinate?: { lat?: number; lon?: number }
    }
  }
  list_price?: number
  list_price_max?: number
  list_price_min?: number
  description?: {
    beds?: number
    baths?: number
    sqft?: number
    type?: string
  }
  primary_photo?: { href?: string }
  href?: string
}

// Map neighborhood names to zip codes for location-specific search
const NEIGHBORHOOD_ZIPS: Record<string, string> = {
  'LOOP': '60601', 'NEAR NORTH SIDE': '60610', 'NEAR SOUTH SIDE': '60616',
  'NEAR WEST SIDE': '60607', 'LINCOLN PARK': '60614', 'LAKE VIEW': '60657',
  'LOGAN SQUARE': '60647', 'WEST TOWN': '60622', 'UPTOWN': '60640',
  'ROGERS PARK': '60626', 'EDGEWATER': '60660', 'AVONDALE': '60618',
  'IRVING PARK': '60641', 'ALBANY PARK': '60625', 'LINCOLN SQUARE': '60625',
  'NORTH CENTER': '60613', 'HUMBOLDT PARK': '60651', 'AUSTIN': '60644',
  'HYDE PARK': '60615', 'SOUTH SHORE': '60649', 'WOODLAWN': '60637',
  'LOWER WEST SIDE': '60608', 'BRIDGEPORT': '60609', 'JEFFERSON PARK': '60630',
  'NORWOOD PARK': '60631', 'PORTAGE PARK': '60634', 'BELMONT CRAGIN': '60639',
  'KENWOOD': '60615', 'CHATHAM': '60619', 'BEVERLY': '60643',
  'WEST RIDGE': '60645', 'NORTH PARK': '60625', 'PILSEN': '60608',
}

async function fetchFromRealtor(priceMax: number, zipCode?: string): Promise<ApartmentListing[]> {
  if (!RAPIDAPI_KEY) return []

  try {
    let location = 'city:il_chicago'
    if (zipCode) location = `zip:${zipCode}`
    const url = `https://${RAPIDAPI_HOST}/properties/search-rent?location=${location}&limit=10&sort=newest&price_max=${priceMax}`

    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    })

    if (!res.ok) {
      console.error(`Realtor API error: ${res.status}`)
      return []
    }

    const data = await res.json()
    const results: RealtorResult[] = data?.data?.results ?? []

    return results.map((r) => {
      const addr = r.location?.address
      const desc = r.description
      const price = r.list_price_min ?? r.list_price ?? r.list_price_max ?? 0
      const line = addr?.line ?? ''
      const city = addr?.city ?? 'Chicago'
      const state = addr?.state_code ?? 'IL'
      const zip = addr?.postal_code ?? ''

      return {
        address: line ? `${line}, ${city}, ${state}${zip ? ' ' + zip : ''}` : `${city}, ${state}`,
        price,
        beds: desc?.beds ?? 0,
        baths: desc?.baths ?? 0,
        sqft: desc?.sqft ?? 0,
        highlight: desc?.type ? desc.type.charAt(0).toUpperCase() + desc.type.slice(1).replace('_', ' ') : '',
        photo: r.primary_photo?.href || undefined,
        listingUrl: r.href || undefined,
        lat: addr?.coordinate?.lat,
        lng: addr?.coordinate?.lon,
      }
    }).filter((l) => l.price > 0 && l.price <= priceMax && l.address.length > 10 && l.lat && l.lng)
  } catch (err) {
    console.error('Realtor API error:', err)
    return []
  }
}

export async function POST(request: Request) {
  const { priceMax, neighborhoods } = await request.json() as {
    priceMax: number
    neighborhoods?: string[] // specific neighborhood names to search within
  }

  if (!priceMax) {
    return Response.json({ apartments: [] })
  }

  // If specific neighborhoods mentioned, search each by zip code
  if (neighborhoods && neighborhoods.length > 0) {
    const allApts: ApartmentListing[] = []
    const perNeighborhood = Math.ceil(10 / neighborhoods.length)

    for (const name of neighborhoods) {
      const zip = NEIGHBORHOOD_ZIPS[name]
      const results = await fetchFromRealtor(priceMax, zip)
      allApts.push(...results.slice(0, perNeighborhood))
    }

    // Dedupe by address
    const seen = new Set<string>()
    const deduped = allApts.filter(a => {
      if (seen.has(a.address)) return false
      seen.add(a.address)
      return true
    })

    return Response.json({ apartments: deduped.slice(0, 10) })
  }

  // Otherwise search all of Chicago
  const apartments = await fetchFromRealtor(priceMax)
  return Response.json({ apartments: apartments.slice(0, 10) })
}
