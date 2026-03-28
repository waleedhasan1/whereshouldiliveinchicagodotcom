'use client'

// Simple markdown-like formatter for chat messages
// Handles: **bold**, bullet lists, newlines
export default function FormattedMessage({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Empty line = paragraph break
    if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 6 }} />)
      continue
    }

    // Bullet points
    if (/^\s*[-*•]\s/.test(line)) {
      const text = line.replace(/^\s*[-*•]\s+/, '')
      elements.push(
        <div key={i} style={{ paddingLeft: 12, position: 'relative', marginBottom: 2 }}>
          <span style={{ position: 'absolute', left: 0 }}>•</span>
          {formatInline(text)}
        </div>
      )
      continue
    }

    // Numbered list
    if (/^\s*\d+[.)]\s/.test(line)) {
      const match = line.match(/^\s*(\d+)[.)]\s+(.*)/)
      if (match) {
        elements.push(
          <div key={i} style={{ paddingLeft: 16, position: 'relative', marginBottom: 2 }}>
            <span style={{ position: 'absolute', left: 0, fontWeight: 'bold', color: '#FFD700' }}>{match[1]}.</span>
            {formatInline(match[2])}
          </div>
        )
        continue
      }
    }

    // Regular text
    elements.push(<div key={i} style={{ marginBottom: 2 }}>{formatInline(line)}</div>)
  }

  return <>{elements}</>
}

function formatInline(text: string): React.ReactNode {
  // Split on **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <b key={i} style={{ color: '#FFD700' }}>{part.slice(2, -2)}</b>
    }
    return <span key={i}>{part}</span>
  })
}
