'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const ChicagoMap = dynamic(() => import('../components/ChicagoMap'), { ssr: false })

export default function Home() {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: send to RAG backend
    console.log('Query:', query)
    setQuery('')
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Main window */}
      <div className="flex-1 flex flex-col m-2 window">
        <div className="title-bar">
          <span className="flex-1">Where Should I Live in Chicago?</span>
          <div className="flex gap-[2px]">
            <button className="title-bar-button">_</button>
            <button className="title-bar-button">[ ]</button>
            <button className="title-bar-button">X</button>
          </div>
        </div>

        <div className="flex-1 flex p-[3px] gap-[3px] min-h-0">
          {/* Map panel */}
          <div className="flex-1 inset min-h-0">
            <ChicagoMap />
          </div>

          {/* Chat panel */}
          <div className="w-[340px] flex flex-col inset">
            <div className="p-2 bg-[#c0c0c0] border-b border-[#808080] text-xs font-bold">
              Ask me anything about Chicago neighborhoods
            </div>
            <div className="flex-1 p-3 overflow-y-auto text-sm">
              <div className="text-[#808080] italic text-xs">
                Try: &quot;I want a walkable neighborhood near the L with rent under $1500 and low crime&quot;
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-1 bg-[#c0c0c0] flex gap-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Where should I live..."
                className="win-input flex-1"
              />
              <button type="submit" className="win-button">
                Ask
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Taskbar */}
      <div className="taskbar">
        <button className="start-button">Start</button>
        <div className="ml-2 text-white text-xs opacity-70">
          whereshouldiliveinchicago.com
        </div>
      </div>
    </div>
  )
}
