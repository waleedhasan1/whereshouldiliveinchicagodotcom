'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export default function ChicagoMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [hoveredArea, setHoveredArea] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-light': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO',
          },
        },
        layers: [
          {
            id: 'carto-light-layer',
            type: 'raster',
            source: 'carto-light',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [-87.6298, 41.8781],
      zoom: 10.5,
      maxBounds: [
        [-88.5, 41.5],
        [-86.8, 42.3],
      ],
    })

    map.current.on('load', () => {
      const m = map.current!

      m.addSource('communities', {
        type: 'geojson',
        data: '/boundaries_communities.geojson',
        promoteId: 'area_numbe',
      })

      // Fill layer
      m.addLayer({
        id: 'communities-fill',
        type: 'fill',
        source: 'communities',
        paint: {
          'fill-color': '#0054E3',
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.35,
            0.1,
          ],
        },
      })

      // Border layer
      m.addLayer({
        id: 'communities-border',
        type: 'line',
        source: 'communities',
        paint: {
          'line-color': '#0831D9',
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,
            1,
          ],
          'line-opacity': 0.6,
        },
      })

      // Label layer
      m.addLayer({
        id: 'communities-label',
        type: 'symbol',
        source: 'communities',
        layout: {
          'text-field': ['get', 'community'],
          'text-size': 10,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.05,
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#1a1a1a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
          'text-opacity': 0.8,
        },
      })

      // Hover interaction
      let hoveredId: string | number | null = null

      m.on('mousemove', 'communities-fill', (e) => {
        if (e.features && e.features.length > 0) {
          if (hoveredId !== null) {
            m.setFeatureState({ source: 'communities', id: hoveredId }, { hover: false })
          }
          hoveredId = e.features[0].id ?? null
          if (hoveredId !== null) {
            m.setFeatureState({ source: 'communities', id: hoveredId }, { hover: true })
          }
          const name = e.features[0].properties?.community
          setHoveredArea(name || null)
          m.getCanvas().style.cursor = 'pointer'
        }
      })

      m.on('mouseleave', 'communities-fill', () => {
        if (hoveredId !== null) {
          m.setFeatureState({ source: 'communities', id: hoveredId }, { hover: false })
        }
        hoveredId = null
        setHoveredArea(null)
        m.getCanvas().style.cursor = ''
      })
    })

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {hoveredArea && (
        <div className="absolute top-2 left-2 window px-3 py-1">
          <span className="text-xs font-bold">{hoveredArea}</span>
        </div>
      )}
    </div>
  )
}
