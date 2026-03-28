import OpenAI from 'openai'
import { findRelevantNeighborhoods } from '@/lib/neighborhoods'
import type { ChatMessage } from '@/lib/types'

const client = new OpenAI()

function buildSystemPrompt(neighborhoodNames: string[], dataBlock: string): string {
  return `You are a concise Chicago neighborhood expert. You help people find where to live based on real data.

RESPONSE STYLE:
- Write a brief 2-3 sentence overview summarizing what you found.
- Do NOT list individual neighborhoods with bullet points — the app displays detailed neighborhood cards separately.
- Instead, mention general themes: which areas are the best value, which are safest, any trade-offs to watch out for.
- Be conversational and helpful, not robotic.
- Keep it SHORT — 3-4 sentences max. The detailed data is shown in cards next to your message.

DATA FIELDS:
- rent: avg/low/high monthly rent
- crime: per100k = incidents per 100K residents (lower = safer)
- transit: ctaStations = number of L stations, ctaLines = which lines
- bus: busReliability (0-1), busRouteCount

The neighborhoods below have ALREADY been filtered to match the user's criteria (budget, transit line, etc). Detailed cards are shown in the UI — your job is just to give a helpful summary.

CRITICAL: At the very end of your response, you MUST include this exact tag listing ALL neighborhood names from the data below:
[[NEIGHBORHOODS: ${neighborhoodNames.join(', ')}]]
This tag highlights matching areas on the map. Never mention this tag to the user. Never omit it.

NEIGHBORHOOD DATA:
${dataBlock}`
}

export async function POST(request: Request) {
  const body = await request.json()
  const messages: ChatMessage[] = body.messages
  const query: string = body.query

  if (!messages || messages.length === 0) {
    return new Response('Missing messages', { status: 400 })
  }

  const result = findRelevantNeighborhoods(query)

  const dataBlock = JSON.stringify(
    result.neighborhoods.reduce((acc, { name, data }) => {
      acc[name] = data
      return acc
    }, {} as Record<string, unknown>),
    null,
    2
  )

  const neighborhoodNames = result.neighborhoods.map(n => n.name)
  const systemPrompt = buildSystemPrompt(neighborhoodNames, dataBlock)

  // Build top picks with full data for the sidebar cards
  const topPicksData = result.topPicks.map(name => {
    const nd = result.neighborhoods.find(n => n.name === name)
    return nd ? { name, data: nd.data } : null
  }).filter(Boolean)

  // Metadata line sent before the stream so the client can set up the map immediately
  const metadata = JSON.stringify({
    transitLines: result.transitLines,
    topPicks: result.topPicks,
    topPicksData,
    allMatches: neighborhoodNames,
    specificNeighborhoods: result.specificNeighborhoods,
    rentBudget: result.rentBudget,
  })

  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      // Send metadata as first line, delimited by newline
      controller.enqueue(encoder.encode(`__META__${metadata}__META__\n`))

      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) {
            controller.enqueue(encoder.encode(text))
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream error'
        controller.enqueue(encoder.encode(`\n\n[Error: ${message}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
