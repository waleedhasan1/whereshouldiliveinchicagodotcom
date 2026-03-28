'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import { useChat } from '@/hooks/useChat'
import FormattedMessage from '@/components/FormattedMessage'
import type { ApartmentListing } from '@/hooks/useChat'

const ChicagoMap = dynamic(() => import('../components/ChicagoMap'), { ssr: false })

const LAYERS = [
  { id: 'rent', label: 'Rent', icon: '🏠' },
  { id: 'crime', label: 'Crime', icon: '🚨' },
  { id: 'income', label: 'Income', icon: '💰' },
  { id: 'transit', label: 'Transit', icon: '🚇' },
  { id: 'bus', label: 'Bus', icon: '🚌' },
]

export default function Home() {
  const [query, setQuery] = useState('')
  const [booted, setBooted] = useState(false)
  const [clock, setClock] = useState('')
  const [activeLayer, setActiveLayer] = useState('rent')
  const [showTrains, setShowTrains] = useState(false)
  const [selectedApartment, setSelectedApartment] = useState<ApartmentListing | null>(null)
  const { messages, isLoading, highlightedNeighborhoods, searchMeta, sendMessage } = useChat()
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }))
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isLoading) return
    sendMessage(query)
    setQuery('')
  }

  return (
    <>
      {!booted && (
        <div className="loading-screen">
          <div className="loading-text">whereshouldiliveinchicago.com</div>
          <div className="loading-bar-track">
            <div className="loading-bar-fill" />
          </div>
        </div>
      )}

      <div className="h-screen flex flex-col">
        {/* Main window */}
        <div className="flex-1 flex flex-col m-2 window min-h-0">
          <div className="title-bar">
            <span style={{ fontFamily: "'VT323', monospace", fontSize: 16, letterSpacing: 1 }}>
              📍 Where Should I Live in Chicago?
            </span>
            <div className="flex gap-[2px] ml-auto">
              <button className="title-bar-button">_</button>
              <button className="title-bar-button">□</button>
              <button className="title-bar-button">✕</button>
            </div>
          </div>

          <div className="flex-1 flex p-[3px] gap-[3px] min-h-0">
            {/* LEFT: Layer selector strip */}
            <div className="flex flex-col gap-[2px]" style={{ background: '#c0c0c0', padding: 3, width: 80 }}>
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: 13,
                  color: '#333',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  padding: '4px 0 2px',
                  borderBottom: '1px solid #808080',
                  marginBottom: 2,
                }}
              >
                LAYERS
              </div>
              {LAYERS.map(layer => (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  style={{
                    padding: '6px 4px',
                    fontSize: 10,
                    fontWeight: activeLayer === layer.id ? 'bold' : 'normal',
                    fontFamily: "'Tahoma', sans-serif",
                    cursor: 'pointer',
                    background: activeLayer === layer.id
                      ? 'linear-gradient(to bottom, #00CED1, #008B8B)'
                      : '#c0c0c0',
                    color: activeLayer === layer.id ? '#fff' : '#000',
                    border: '2px solid',
                    borderColor: activeLayer === layer.id
                      ? '#00CED1 #006666 #006666 #00CED1'
                      : '#dfdfdf #808080 #808080 #dfdfdf',
                    textShadow: activeLayer === layer.id ? '1px 1px 0 rgba(0,0,0,0.3)' : 'none',
                    display: 'flex',
                    flexDirection: 'column' as const,
                    alignItems: 'center',
                    gap: 2,
                    lineHeight: 1.2,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{layer.icon}</span>
                  {layer.label}
                </button>
              ))}
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: 13,
                  color: '#333',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  padding: '6px 0 2px',
                  borderTop: '1px solid #808080',
                  marginTop: 4,
                  borderBottom: '1px solid #808080',
                  marginBottom: 2,
                }}
              >
                OVERLAY
              </div>
              <button
                onClick={() => setShowTrains(prev => !prev)}
                style={{
                  padding: '6px 4px',
                  fontSize: 10,
                  fontWeight: showTrains ? 'bold' : 'normal',
                  fontFamily: "'Tahoma', sans-serif",
                  cursor: 'pointer',
                  background: showTrains
                    ? 'linear-gradient(to bottom, #6A0DAD, #522398)'
                    : '#c0c0c0',
                  color: showTrains ? '#fff' : '#000',
                  border: '2px solid',
                  borderColor: showTrains
                    ? '#9B59B6 #3a1066 #3a1066 #9B59B6'
                    : '#dfdfdf #808080 #808080 #dfdfdf',
                  textShadow: showTrains ? '1px 1px 0 rgba(0,0,0,0.3)' : 'none',
                  display: 'flex',
                  flexDirection: 'column' as const,
                  alignItems: 'center',
                  gap: 2,
                  lineHeight: 1.2,
                }}
              >
                <span style={{ fontSize: 18 }}>🚇</span>
                Trains
              </button>
            </div>

            {/* CENTER: Map */}
            <div className="flex-1 inset min-h-0">
              <ChicagoMap activeLayer={activeLayer} highlightedNeighborhoods={highlightedNeighborhoods} searchMeta={searchMeta} showAllTrains={showTrains} selectedApartment={selectedApartment} />
            </div>

            {/* Apartments panel — slides in when there are results */}
            {searchMeta && !isLoading && (
              <div className="w-[280px] flex flex-col inset" style={{ background: '#111' }}>
                <div
                  className="p-2 text-center"
                  style={{
                    background: 'linear-gradient(to right, #6A0DAD, #008B8B)',
                    color: '#FFD700',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 7,
                    letterSpacing: 1,
                    textShadow: '1px 1px 0 #000',
                  }}
                >
                  APARTMENTS
                  <span style={{ fontSize: 7, opacity: 0.7, marginLeft: 6 }}>
                    {searchMeta.allMatches.length} neighborhoods matched
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2" style={{ background: '#0a0a1a' }}>
                  {searchMeta.apartments.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                      <span className="typing-indicator" style={{ color: '#666', fontSize: 11 }}>loading real listings...</span>
                    </div>
                  )}
                  {searchMeta.apartments.map((apt, i) => {
                    const isSelected = selectedApartment?.address === apt.address
                    return (
                      <div
                        key={i}
                        className="apartment-listing"
                        onClick={() => setSelectedApartment(apt)}
                        style={{
                          background: isSelected ? 'rgba(0,206,209,0.15)' : 'rgba(255,255,255,0.05)',
                          padding: '8px',
                          marginBottom: 6,
                          borderLeft: isSelected ? '3px solid #FFD700' : '2px solid #008B8B',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          borderRadius: 2,
                        }}
                      >
                        <div style={{
                          fontFamily: "'Tahoma', sans-serif",
                          fontSize: 12,
                          color: isSelected ? '#FFD700' : '#eee',
                          fontWeight: 'bold',
                          marginBottom: 3,
                          lineHeight: 1.3,
                        }}>
                          {apt.address}
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: "'Tahoma', sans-serif", alignItems: 'center' }}>
                          <span style={{ color: '#00CED1', fontWeight: 'bold', fontSize: 13 }}>
                            ${apt.price.toLocaleString()}/mo
                          </span>
                          {apt.beds > 0 && <span style={{ color: '#aaa' }}>{apt.beds}BD</span>}
                          {apt.baths > 0 && <span style={{ color: '#aaa' }}>{apt.baths}BA</span>}
                          {apt.sqft > 0 && <span style={{ color: '#888', fontSize: 10 }}>{apt.sqft.toLocaleString()} sqft</span>}
                        </div>
                        {apt.highlight && (
                          <div style={{ color: '#888', fontSize: 10, fontStyle: 'italic', marginTop: 2, fontFamily: "'Tahoma', sans-serif" }}>
                            {apt.highlight}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* RIGHT: Chat panel */}
            <div className="w-[280px] flex flex-col inset">
              <div
                className="p-2 text-center"
                style={{
                  background: 'linear-gradient(to right, #6A0DAD, #008B8B)',
                  color: '#FFD700',
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 8,
                  letterSpacing: 1,
                  textShadow: '1px 1px 0 #000',
                }}
              >
                NEIGHBORHOOD FINDER
              </div>

              <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2" style={{ background: '#f0f8f8' }}>
                <div className="chat-bubble-bot">
                  Hey! Tell me what you&apos;re looking for in a Chicago neighborhood and I&apos;ll help you find the right spot.
                </div>
                {messages.length === 0 && (
                  <div style={{ color: '#808080', fontSize: 11, textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>
                    Try: &quot;walkable, near the L, under $1500 rent, low crime&quot;
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}>
                    {msg.role === 'assistant' ? <FormattedMessage content={msg.content} /> : msg.content}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.content === '' && (
                  <div className="chat-bubble-bot" style={{ opacity: 0.7 }}>
                    <span className="typing-indicator">thinking...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSubmit} className="p-1 flex gap-1" style={{ background: '#c0c0c0' }}>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Where should I live..."
                  className="win-input flex-1"
                />
                <button type="submit" className="win-button-primary" disabled={isLoading}>
                  {isLoading ? '...' : 'Ask'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Taskbar */}
        <div className="taskbar">
          <button className="start-button">
            <span style={{ fontSize: 14 }}>🪟</span>
            Start
          </button>
          <div
            style={{
              height: 24,
              padding: '0 8px',
              background: '#c0c0c0',
              border: '2px solid',
              borderColor: '#808080 #dfdfdf #dfdfdf #808080',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 'bold',
            }}
          >
            <span style={{ fontSize: 13 }}>📍</span>
            Chicago Neighborhood Finder
          </div>
          <div className="taskbar-clock">{clock}</div>
        </div>
      </div>
    </>
  )
}
