import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, NeighborhoodData } from '@/lib/types'

const NEIGHBORHOOD_TAG_RE = /\[\[NEIGHBORHOODS:\s*([^\]]+)\]\]/
const META_RE = /__META__(.+?)__META__\n?/

export type TopPickData = {
  name: string
  data: NeighborhoodData
}

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

export type SearchMeta = {
  transitLines: string[]
  topPicks: string[]
  topPicksData: TopPickData[]
  allMatches: string[]
  apartments: ApartmentListing[]
}

async function fetchApartments(priceMax: number, neighborhoods?: string[]): Promise<ApartmentListing[]> {
  try {
    const body: Record<string, unknown> = { priceMax }
    if (neighborhoods && neighborhoods.length > 0) body.neighborhoods = neighborhoods
    const res = await fetch('/api/apartments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.apartments ?? []
  } catch {
    return []
  }
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedNeighborhoods, setHighlightedNeighborhoods] = useState<string[]>([])
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (query: string) => {
    const userMessage: ChatMessage = { role: 'user', content: query }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsLoading(true)

    try {
      abortRef.current = new AbortController()

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, query }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const errText = await res.text()
        setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${errText}` }])
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let accumulated = ''
      let metaParsed = false

      // Add placeholder assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        accumulated += decoder.decode(value, { stream: true })

        // Parse metadata from first chunk
        if (!metaParsed) {
          const metaMatch = accumulated.match(META_RE)
          if (metaMatch) {
            try {
              const meta = JSON.parse(metaMatch[1])
              const searchMetaInit: SearchMeta = { ...meta, apartments: [] }
              setSearchMeta(searchMetaInit)
              setHighlightedNeighborhoods(meta.allMatches)

              // Determine max price and specific neighborhoods
              const maxRent = meta.rentBudget || meta.topPicksData?.reduce((max: number, p: TopPickData) => {
                return Math.max(max, p.data.rent?.high ?? 2000)
              }, 0) || 2000

              const specificNeighborhoods: string[] = meta.specificNeighborhoods ?? []

              // Fetch apartments in background, filtered to specific neighborhoods if mentioned
              fetchApartments(maxRent, specificNeighborhoods.length > 0 ? specificNeighborhoods : undefined).then(apartments => {
                setSearchMeta(prev => prev ? { ...prev, apartments } : prev)
              })
            } catch { /* ignore parse error */ }
            accumulated = accumulated.replace(META_RE, '')
            metaParsed = true
          }
        }

        // Update the last message with accumulated text (strip neighborhood tag for display)
        const display = accumulated.replace(NEIGHBORHOOD_TAG_RE, '').trimEnd()
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: display }
          return copy
        })
      }

      // Final extraction of neighborhoods from LLM response (as backup)
      const match = accumulated.match(NEIGHBORHOOD_TAG_RE)
      if (match) {
        const names = match[1].split(',').map(s => s.trim()).filter(Boolean)
        setHighlightedNeighborhoods(names)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [messages])

  const clearResults = useCallback(() => {
    setHighlightedNeighborhoods([])
    setSearchMeta(null)
  }, [])

  return { messages, isLoading, highlightedNeighborhoods, searchMeta, sendMessage, clearResults }
}
