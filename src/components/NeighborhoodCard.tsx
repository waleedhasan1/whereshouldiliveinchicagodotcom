'use client'

import type { NeighborhoodData } from '@/lib/types'
import type { ApartmentListing } from '@/hooks/useChat'

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

type Props = {
  name: string
  data: NeighborhoodData
  rank: number
  apartments?: ApartmentListing[]
  selectedAddress?: string | null
  onSelectApartment?: (apt: { address: string; price: number; beds: number; baths: number; lat?: number; lng?: number }) => void
}

export default function NeighborhoodCard({ name, data, rank, apartments, selectedAddress, onSelectApartment }: Props) {
  const safetyLabel = data.crime?.per100k != null
    ? data.crime.per100k < 4000 ? 'Low' : data.crime.per100k < 8000 ? 'Moderate' : 'High'
    : null
  const safetyColor = safetyLabel === 'Low' ? '#21B573' : safetyLabel === 'Moderate' ? '#F5D547' : '#D62828'

  return (
    <div
      style={{
        background: '#1a1a2e',
        border: '2px solid',
        borderImage: 'linear-gradient(to bottom, #6A0DAD, #008B8B) 1',
        marginBottom: 6,
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(to right, #6A0DAD, #008B8B)',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          fontFamily: "'VT323', monospace",
          fontSize: 20,
          color: '#FFD700',
          fontWeight: 'bold',
          lineHeight: 1,
        }}>
          #{rank}
        </span>
        <span style={{
          fontFamily: "'VT323', monospace",
          fontSize: 16,
          color: '#fff',
          textShadow: '1px 1px 0 #000',
          letterSpacing: 1,
          flex: 1,
        }}>
          {name}
        </span>
        {data.transit.ctaLines.slice(0, 3).map(line => (
          <span
            key={line}
            style={{
              padding: '0 4px',
              fontSize: 8,
              fontWeight: 'bold',
              background: CTA_LINE_COLORS[line] || '#666',
              color: line === 'Yellow' ? '#000' : '#fff',
              borderRadius: 2,
            }}
          >
            {line}
          </span>
        ))}
      </div>

      {/* Quick stats row */}
      <div style={{
        display: 'flex',
        gap: 0,
        fontSize: 10,
        fontFamily: "'Tahoma', sans-serif",
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {data.rent && (
          <div style={{ flex: 1, padding: '4px 6px', borderRight: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <div style={{ color: '#666', fontSize: 8 }}>RENT</div>
            <div style={{ color: '#00CED1', fontWeight: 'bold', fontSize: 12 }}>${data.rent.avg.toLocaleString()}</div>
          </div>
        )}
        {data.crime?.per100k != null && (
          <div style={{ flex: 1, padding: '4px 6px', borderRight: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <div style={{ color: '#666', fontSize: 8 }}>SAFETY</div>
            <div style={{ color: safetyColor, fontWeight: 'bold', fontSize: 12 }}>{safetyLabel}</div>
          </div>
        )}
        <div style={{ flex: 1, padding: '4px 6px', textAlign: 'center' }}>
          <div style={{ color: '#666', fontSize: 8 }}>TRANSIT</div>
          <div style={{ color: '#ccc', fontWeight: 'bold', fontSize: 12 }}>{data.transit.ctaStations} stn{data.transit.ctaStations !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Apartment listings */}
      {apartments && apartments.length > 0 ? (
        <div style={{ padding: '4px 6px' }}>
          <div style={{ color: '#FFD700', fontSize: 9, fontFamily: "'VT323', monospace", letterSpacing: 1, marginBottom: 3 }}>
            AVAILABLE APARTMENTS
          </div>
          {apartments.map((apt, i) => {
            const isSelected = selectedAddress === apt.address
            return (
              <div
                key={i}
                className="apartment-listing"
                onClick={() => onSelectApartment?.({ address: apt.address, price: apt.price, beds: apt.beds, baths: apt.baths, lat: apt.lat, lng: apt.lng })}
                style={{
                  background: isSelected ? 'rgba(0,206,209,0.15)' : 'rgba(255,255,255,0.05)',
                  padding: '4px 6px',
                  marginBottom: 3,
                  borderLeft: isSelected ? '3px solid #FFD700' : '2px solid #008B8B',
                  fontSize: 10,
                  fontFamily: "'Tahoma', sans-serif",
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ color: isSelected ? '#FFD700' : '#eee', fontWeight: 'bold', fontSize: 11, marginBottom: 1 }}>
                  {apt.address}
                </div>
                <div style={{ display: 'flex', gap: 8, color: '#aaa' }}>
                  <span style={{ color: '#00CED1', fontWeight: 'bold' }}>${apt.price.toLocaleString()}/mo</span>
                  <span>{apt.beds}BD/{apt.baths}BA</span>
                  <span>{apt.sqft.toLocaleString()} sqft</span>
                </div>
                {apt.highlight && (
                  <div style={{ color: '#888', fontSize: 9, fontStyle: 'italic', marginTop: 1 }}>
                    {apt.highlight}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : apartments === undefined ? null : (
        <div style={{ padding: '6px', textAlign: 'center' }}>
          <span className="typing-indicator" style={{ color: '#666', fontSize: 10 }}>loading listings...</span>
        </div>
      )}
    </div>
  )
}
