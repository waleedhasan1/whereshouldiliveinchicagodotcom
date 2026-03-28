'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { NeighborhoodData, AllData } from '@/lib/types'
import type { SearchMeta } from '@/hooks/useChat'
import { CTA_LINE_ORDERS } from '@/lib/cta-line-orders'

type CTAStation = {
  name: string
  lines: string
  lat: number
  lng: number
}

const CTA_LINE_COLORS: Record<string, string> = {
  Red: '#c60c30',
  Blue: '#00a1de',
  Green: '#009b3a',
  Brown: '#62361b',
  Orange: '#f9461c',
  Pink: '#e27ea6',
  Purple: '#522398',
  Yellow: '#f9e300',
}

const LAYER_CONFIG: Record<string, {
  label: string
  unit: string
  prefix?: string
  getValue: (n: NeighborhoodData) => number | null
  colors: string[]
}> = {
  rent: {
    label: 'Avg Rent',
    unit: '/mo',
    prefix: '$',
    getValue: (n) => n.rent?.avg ?? null,
    colors: ['#0B6E4F', '#21B573', '#F5D547', '#F77F00', '#D62828'],
  },
  crime: {
    label: 'Crime per 100K',
    unit: '',
    getValue: (n) => n.crime?.per100k ?? null,
    colors: ['#0B6E4F', '#21B573', '#F5D547', '#F77F00', '#D62828'],
  },
  income: {
    label: 'Est. Median Income',
    unit: '/yr',
    prefix: '$',
    getValue: (n) => n.demographics?.estimatedMedianIncome ?? null,
    colors: ['#D62828', '#F77F00', '#F5D547', '#21B573', '#0B6E4F'],
  },
  transit: {
    label: 'CTA L Stations',
    unit: '',
    getValue: (n) => n.transit?.ctaStations ?? 0,
    colors: ['#2D004B', '#7B2D8E', '#C77DFF', '#00E5FF', '#00FFAB'],
  },
  bus: {
    label: 'Bus Reliability',
    unit: '%',
    getValue: (n) => n.bus?.busReliability ? Math.round(n.bus.busReliability * 100) : null,
    colors: ['#D62828', '#F77F00', '#F5D547', '#21B573', '#0B6E4F'],
  },
}

function getColorForValue(value: number, min: number, max: number, ramp: string[]): string {
  if (max === min) return ramp[Math.floor(ramp.length / 2)]
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const idx = t * (ramp.length - 1)
  return ramp[Math.min(Math.round(idx), ramp.length - 1)]
}

function formatValue(v: number, cfg: typeof LAYER_CONFIG[string]): string {
  const prefix = cfg.prefix || ''
  return `${prefix}${v.toLocaleString()}${cfg.unit}`
}

type Props = {
  activeLayer: string
  highlightedNeighborhoods?: string[]
  searchMeta?: SearchMeta | null
  showAllTrains?: boolean
  selectedApartment?: { address: string; price: number; beds: number; baths: number; lat?: number; lng?: number } | null
}

export default function ChicagoMap({ activeLayer, highlightedNeighborhoods = [], searchMeta, showAllTrains = false, selectedApartment }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapReady = useRef(false)
  const [hoveredArea, setHoveredArea] = useState<string | null>(null)
  const [hoveredData, setHoveredData] = useState<NeighborhoodData | null>(null)
  const dataRef = useRef<AllData | null>(null)
  const stationsRef = useRef<CTAStation[]>([])
  const markersRef = useRef<maplibregl.Marker[]>([])
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [legendRange, setLegendRange] = useState<{ min: number; max: number } | null>(null)

  const inResultsMode = highlightedNeighborhoods.length > 0

  // Load data once
  useEffect(() => {
    Promise.all([
      fetch('/neighborhood-data.json').then(r => r.json()),
      fetch('/cta-stations.json').then(r => r.json()),
    ]).then(([nd, stations]) => {
      dataRef.current = nd
      stationsRef.current = stations
      setDataLoaded(true)
    }).catch(err => console.error('[Data] Failed to load:', err))
  }, [])

  // Apply colors when layer changes, data loads, or results mode changes
  useEffect(() => {
    const m = mapRef.current
    const d = dataRef.current
    if (!m || !d || !mapReady.current) return

    const cfg = LAYER_CONFIG[activeLayer]
    if (!cfg) return

    if (inResultsMode) {
      // RESULTS MODE: highlighted neighborhoods get data color, rest are dimmed
      const highlightSet = new Set(highlightedNeighborhoods)
      const values: Record<string, number> = {}
      let min = Infinity, max = -Infinity

      for (const name of highlightedNeighborhoods) {
        const nd = d.neighborhoods[name]
        if (!nd) continue
        const v = cfg.getValue(nd)
        if (v != null) {
          values[name] = v
          if (v < min) min = v
          if (v > max) max = v
        }
      }

      setLegendRange(Object.keys(values).length > 0 ? { min, max } : null)

      const matchArgs: unknown[] = []
      for (const [name, v] of Object.entries(values)) {
        matchArgs.push(name)
        matchArgs.push(getColorForValue(v, min, max, cfg.colors))
      }

      m.setPaintProperty('communities-fill', 'fill-color',
        matchArgs.length > 0
          ? ['case', ['boolean', ['feature-state', 'hover'], false], '#FFD700',
              ['match', ['get', 'community'], ...matchArgs, 'rgba(30,30,30,0.6)']]
          : ['case', ['boolean', ['feature-state', 'hover'], false], '#FFD700', 'rgba(30,30,30,0.6)']
      )
      m.setPaintProperty('communities-fill', 'fill-opacity', 0.8)

      // Dim labels for non-matching neighborhoods
      const allNames = Object.keys(d.neighborhoods)
      const labelMatchArgs: unknown[] = []
      for (const name of allNames) {
        labelMatchArgs.push(name)
        labelMatchArgs.push(highlightSet.has(name) ? 1.0 : 0.15)
      }
      m.setPaintProperty('communities-label', 'text-opacity',
        labelMatchArgs.length > 0
          ? ['match', ['get', 'community'], ...labelMatchArgs, 0.15]
          : 0.15
      )

      // Borders
      const borderMatchArgs: unknown[] = []
      for (const name of allNames) {
        borderMatchArgs.push(name)
        borderMatchArgs.push(highlightSet.has(name) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.05)')
      }
      m.setPaintProperty('communities-border', 'line-color', [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#FFD700',
        borderMatchArgs.length > 0
          ? ['match', ['get', 'community'], ...borderMatchArgs, 'rgba(255,255,255,0.05)']
          : 'rgba(255,255,255,0.05)',
      ])
      m.setPaintProperty('communities-border', 'line-width', [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3,
        1,
      ])

    } else {
      // NORMAL MODE: standard choropleth
      const values: Record<string, number> = {}
      let min = Infinity, max = -Infinity
      for (const [name, nd] of Object.entries(d.neighborhoods)) {
        const v = cfg.getValue(nd)
        if (v != null) {
          values[name] = v
          if (v < min) min = v
          if (v > max) max = v
        }
      }

      setLegendRange({ min, max })

      const matchArgs: unknown[] = []
      for (const [name, v] of Object.entries(values)) {
        matchArgs.push(name)
        matchArgs.push(getColorForValue(v, min, max, cfg.colors))
      }

      if (matchArgs.length === 0) return

      m.setPaintProperty('communities-fill', 'fill-color', [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#FFD700',
        ['match', ['get', 'community'], ...matchArgs, '#333'],
      ])
      m.setPaintProperty('communities-fill', 'fill-opacity', 0.7)

      // Restore normal label opacity
      m.setPaintProperty('communities-label', 'text-opacity', 0.8)

      // Normal borders
      m.setPaintProperty('communities-border', 'line-color', [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#FFD700',
        'rgba(255,255,255,0.4)',
      ])
      m.setPaintProperty('communities-border', 'line-width', [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3,
        1,
      ])
    }
  }, [activeLayer, dataLoaded, inResultsMode, highlightedNeighborhoods])

  // Draw CTA lines (from search or "show all trains" toggle)
  useEffect(() => {
    const m = mapRef.current
    if (!m || !mapReady.current) return

    // Remove existing CTA line layers/sources
    const existingLineLayers = ['cta-line-layer', 'cta-stations-layer']
    for (const id of existingLineLayers) {
      if (m.getLayer(id)) m.removeLayer(id)
    }
    if (m.getSource('cta-line')) m.removeSource('cta-line')
    if (m.getSource('cta-line-stations')) m.removeSource('cta-line-stations')

    // Determine which lines to draw
    const ALL_LINES = ['Red', 'Blue', 'Green', 'Brown', 'Orange', 'Pink', 'Purple', 'Yellow']
    const lines = showAllTrains ? ALL_LINES : (searchMeta?.transitLines ?? [])
    if (lines.length === 0 || stationsRef.current.length === 0) return

    // Build a lookup from station name → coords
    const stationLookup: Record<string, [number, number]> = {}
    for (const s of stationsRef.current) {
      stationLookup[s.name] = [s.lng, s.lat]
    }

    const features: GeoJSON.Feature[] = []
    const stationFeatures: GeoJSON.Feature[] = []
    const addedStations = new Set<string>()

    for (const lineName of lines) {
      const color = CTA_LINE_COLORS[lineName] || '#fff'

      // Get ordered station names for this line
      const orderedNames = CTA_LINE_ORDERS[lineName]
      if (!orderedNames) continue

      // Also draw secondary branches (e.g., Green_south)
      const branches = [orderedNames]
      const branchKey = `${lineName}_south`
      if (CTA_LINE_ORDERS[branchKey]) branches.push(CTA_LINE_ORDERS[branchKey])

      for (const branch of branches) {
        const coords: [number, number][] = []
        for (const name of branch) {
          const pos = stationLookup[name]
          if (pos) {
            coords.push(pos)
            if (!addedStations.has(`${lineName}-${name}`)) {
              addedStations.add(`${lineName}-${name}`)
              stationFeatures.push({
                type: 'Feature',
                properties: { name, color },
                geometry: { type: 'Point', coordinates: pos },
              })
            }
          }
        }

        if (coords.length >= 2) {
          features.push({
            type: 'Feature',
            properties: { color },
            geometry: { type: 'LineString', coordinates: coords },
          })
        }
      }
    }

    if (features.length === 0) return

    m.addSource('cta-line', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    })
    m.addLayer({
      id: 'cta-line-layer',
      type: 'line',
      source: 'cta-line',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 4,
        'line-opacity': 0.9,
      },
    })

    m.addSource('cta-line-stations', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: stationFeatures },
    })
    m.addLayer({
      id: 'cta-stations-layer',
      type: 'circle',
      source: 'cta-line-stations',
      paint: {
        'circle-radius': 4,
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
      },
    })
  }, [searchMeta, showAllTrains])

  // Place small markers for all apartment listings
  useEffect(() => {
    for (const marker of markersRef.current) marker.remove()
    markersRef.current = []

    const m = mapRef.current
    if (!m || !mapReady.current) return

    const apartments = searchMeta?.apartments ?? []
    if (apartments.length === 0) return

    for (const apt of apartments) {
      if (!apt.lat || !apt.lng) continue

      const el = document.createElement('div')
      el.innerHTML = '🏠'
      el.style.fontSize = '18px'
      el.style.cursor = 'pointer'
      el.style.filter = 'drop-shadow(0 0 3px rgba(0,0,0,0.8))'
      el.style.transition = 'transform 0.15s'
      el.title = `${apt.address} — $${apt.price.toLocaleString()}/mo`

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([apt.lng, apt.lat])
        .addTo(m)

      markersRef.current.push(marker)
    }
  }, [searchMeta?.apartments])

  // Highlight selected apartment — fly to it and show big pulsing marker
  useEffect(() => {
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove()
      selectedMarkerRef.current = null
    }

    const m = mapRef.current
    if (!m || !mapReady.current || !selectedApartment) return
    if (!selectedApartment.lat || !selectedApartment.lng) return

    const location: [number, number] = [selectedApartment.lng, selectedApartment.lat]

    m.flyTo({ center: location, zoom: 15, duration: 800 })

    const el = document.createElement('div')
    el.innerHTML = '🏠'
    el.style.fontSize = '36px'
    el.style.cursor = 'pointer'
    el.style.filter = 'drop-shadow(0 0 8px rgba(255,215,0,0.8))'
    el.style.animation = 'apartmentPulse 1s infinite'

    const popup = new maplibregl.Popup({ offset: [0, -20], className: 'apartment-popup', closeOnClick: false })
      .setHTML(`
        <div style="font-family:Tahoma,sans-serif;font-size:12px;min-width:180px;">
          <div style="font-weight:bold;font-size:13px;color:#FFD700;margin-bottom:4px;">${selectedApartment.address}</div>
          <div style="font-size:15px;font-weight:bold;color:#00CED1;">$${selectedApartment.price.toLocaleString()}/mo</div>
          ${selectedApartment.beds > 0 ? `<div style="color:#aaa;margin-top:2px;">${selectedApartment.beds}BD / ${selectedApartment.baths}BA</div>` : ''}
        </div>
      `)

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(location)
      .setPopup(popup)
      .addTo(m)

    setTimeout(() => {
      try { marker.togglePopup() } catch { /* marker may have been removed */ }
    }, 900)
    selectedMarkerRef.current = marker
  }, [selectedApartment])

  // Init map (once)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO',
          },
        },
        layers: [{
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 20,
        }],
      },
      center: [-87.6298, 41.8781],
      zoom: 10.5,
      maxBounds: [[-88.5, 41.5], [-86.8, 42.3]],
    })

    mapRef.current = m

    m.on('load', () => {
      m.addSource('communities', {
        type: 'geojson',
        data: '/boundaries_communities.geojson',
        promoteId: 'area_numbe',
      })

      m.addLayer({
        id: 'communities-fill',
        type: 'fill',
        source: 'communities',
        paint: {
          'fill-color': '#008B8B',
          'fill-opacity': 0.7,
        },
      })

      // Neighborhood borders (flat, on top)
      m.addLayer({
        id: 'communities-border',
        type: 'line',
        source: 'communities',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#FFD700',
            'rgba(255,255,255,0.4)',
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            3,
            1,
          ],
        },
      })

      // Labels
      m.addLayer({
        id: 'communities-label',
        type: 'symbol',
        source: 'communities',
        layout: {
          'text-field': ['get', 'community'],
          'text-size': 9,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.05,
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#fff',
          'text-halo-color': 'rgba(0,0,0,0.9)',
          'text-halo-width': 1.5,
          'text-opacity': 0.8,
        },
      })


      // Hover
      let hoveredId: string | number | null = null

      m.on('mousemove', 'communities-fill', (e) => {
        if (!e.features || e.features.length === 0) return

        if (hoveredId !== null) {
          m.setFeatureState({ source: 'communities', id: hoveredId }, { hover: false })
        }
        hoveredId = e.features[0].id ?? null
        if (hoveredId !== null) {
          m.setFeatureState({ source: 'communities', id: hoveredId }, { hover: true })
        }

        const name = e.features[0].properties?.community
        setHoveredArea(name || null)
        const nd = dataRef.current?.neighborhoods[name]
        setHoveredData(nd || null)
        m.getCanvas().style.cursor = 'pointer'
      })

      m.on('mouseleave', 'communities-fill', () => {
        if (hoveredId !== null) {
          m.setFeatureState({ source: 'communities', id: hoveredId }, { hover: false })
        }
        hoveredId = null
        setHoveredArea(null)
        setHoveredData(null)
        m.getCanvas().style.cursor = ''
      })

      mapReady.current = true
      if (dataRef.current) {
        setDataLoaded(prev => !prev)
      }
    })

    return () => {
      mapReady.current = false
      m.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cfg = LAYER_CONFIG[activeLayer]

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Results mode indicator */}
      {inResultsMode && (
        <div
          className="absolute top-3 right-3"
          style={{
            background: 'rgba(0,0,0,0.85)',
            border: '2px solid #FFD700',
            padding: '6px 10px',
            fontFamily: "'VT323', monospace",
            fontSize: 14,
            color: '#FFD700',
            letterSpacing: 1,
          }}
        >
          {highlightedNeighborhoods.length} MATCHES
          {searchMeta?.transitLines?.map(line => (
            <span
              key={line}
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                background: CTA_LINE_COLORS[line] || '#666',
                color: line === 'Yellow' ? '#000' : '#fff',
                fontSize: 11,
                fontFamily: "'Tahoma', sans-serif",
                fontWeight: 'bold',
              }}
            >
              {line}
            </span>
          ))}
        </div>
      )}

      {/* Legend */}
      {cfg && legendRange && (
        <div
          className="absolute top-3 left-3"
          style={{
            background: 'rgba(0,0,0,0.85)',
            border: '2px solid rgba(255,255,255,0.2)',
            padding: '8px 12px',
            minWidth: 160,
          }}
        >
          <div style={{
            fontFamily: "'VT323', monospace",
            fontSize: 15,
            color: '#FFD700',
            marginBottom: 6,
            letterSpacing: 1,
          }}>
            {inResultsMode ? `${cfg.label} (filtered)` : cfg.label}
          </div>
          <div style={{ display: 'flex', height: 14, borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
            {cfg.colors.map((color, i) => (
              <div key={i} style={{ flex: 1, background: color }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ccc', fontFamily: "'Tahoma', sans-serif" }}>
            <span>{formatValue(legendRange.min, cfg)}</span>
            <span>{formatValue(legendRange.max, cfg)}</span>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredArea && hoveredData && (
        <div
          className="absolute bottom-3 left-3"
          style={{
            background: 'rgba(0,0,0,0.9)',
            border: '2px solid',
            borderImage: 'linear-gradient(to right, #6A0DAD, #008B8B) 1',
            minWidth: 240,
            maxWidth: 300,
          }}
        >
          <div style={{
            background: 'linear-gradient(to right, #6A0DAD, #008B8B)',
            padding: '4px 10px',
            fontFamily: "'VT323', monospace",
            fontSize: 20,
            color: '#FFD700',
            textShadow: '1px 1px 0 #000',
            letterSpacing: 1,
          }}>
            {hoveredArea}
          </div>

          <div style={{ padding: '8px 10px', fontSize: 12, color: '#eee', lineHeight: 1.9, fontFamily: "'Tahoma', sans-serif" }}>
            {hoveredData.rent && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#aaa' }}>🏠 Rent</span>
                <span><b>${hoveredData.rent.avg.toLocaleString()}</b>/mo <span style={{ color: '#888', fontSize: 10 }}>(${hoveredData.rent.low}–${hoveredData.rent.high})</span></span>
              </div>
            )}
            {hoveredData.crime && hoveredData.crime.per100k != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#aaa' }}>🚨 Crime</span>
                <span><b>{Number(hoveredData.crime.per100k).toLocaleString()}</b> per 100K</span>
              </div>
            )}
            {hoveredData.demographics && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#aaa' }}>💰 Income</span>
                  <span><b>${hoveredData.demographics.estimatedMedianIncome.toLocaleString()}</b>/yr</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#aaa' }}>👥 Pop.</span>
                  <span>{hoveredData.demographics.population.toLocaleString()}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#aaa' }}>🚇 CTA</span>
              <span>
                {hoveredData.transit.ctaStations} station{hoveredData.transit.ctaStations !== 1 ? 's' : ''}
                {hoveredData.transit.ctaLines.length > 0 && (
                  <span style={{ color: '#888', fontSize: 10 }}> ({hoveredData.transit.ctaLines.join(', ')})</span>
                )}
              </span>
            </div>
            {hoveredData.bus.busReliability != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#aaa' }}>🚌 Bus</span>
                <span><b>{Math.round(hoveredData.bus.busReliability * 100)}%</b> reliable <span style={{ color: '#888', fontSize: 10 }}>({hoveredData.bus.busRouteCount} routes)</span></span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
