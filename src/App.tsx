import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type MessageType = 'email' | 'text' | 'grading'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function pickByLevel<T>(items: T[], level: number) {
  return items[clamp(level, 1, items.length) - 1]
}

function maybeWithEmoji(s: string, addEmojis: boolean, emoji: string) {
  return addEmojis ? `${s} ${emoji}` : s
}

function toTitleCaseName(input: string) {
  const s = input.trim()
  if (!s) return ''

  return s
    .split(/\s+/)
    .map((token) =>
      token
        .split(/([-’'])/)
        .map((part) => {
          if (part === '-' || part === '’' || part === "'") return part
          const letters = part.replace(/[^\p{L}]/gu, '')
          if (!letters) return part
          return part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase()
        })
        .join(''),
    )
    .join(' ')
}

function fluffify({
  shortMessage,
  recipientName,
  type,
  effusiveness,
  addEmojis,
}: {
  shortMessage: string
  recipientName: string
  type: MessageType
  effusiveness: number
  addEmojis: boolean
}) {
  const level = clamp(Math.round(effusiveness), 1, 5)
  const name = toTitleCaseName(recipientName)
  const msg = shortMessage.trim()
  const firstName = name.split(/\s+/)[0] ?? ''
  const addressee = name || 'there'

  const greeting = pickByLevel(
    [
      type === 'text' ? 'Hey' : 'Hi',
      type === 'text' ? 'Hey' : 'Hello',
      'Hello',
      'Hi',
      'Hello',
    ],
    level,
  )

  const opener = pickByLevel(
    [
      '',
      type === 'text' ? '' : 'Hope your day is going smoothly.',
      'Hope your day is going smoothly.',
      'Hope things are going well on your end.',
      'Hope you’re having a great day.',
    ],
    level,
  )

  const softeners = pickByLevel(
    [
      '',
      type === 'text' ? '' : 'Just a quick note:',
      'Just a quick note:',
      'Just wanted to reach out and share:',
      'I wanted to reach out and share a quick update:',
    ],
    level,
  )

  const closing = pickByLevel(
    [
      type === 'text' ? 'Thanks.' : 'Thanks,',
      type === 'text' ? 'Thanks!' : 'Thanks,',
      type === 'text' ? 'Thank you!' : 'Thank you,',
      type === 'text' ? 'Thanks so much!' : 'Thanks so much,',
      type === 'text' ? 'Thanks a ton!' : 'Thanks so much,',
    ],
    level,
  )

  const signoff = pickByLevel(
    [
      '—',
      '—',
      'Best,',
      'Warmly,',
      'With appreciation,',
    ],
    level,
  )

  const emojiGreeting = pickByLevel(['🙂', '👋', '✨', '🌟', '💛'], level)
  const emojiClosing = pickByLevel(['✅', '😊', '🙌', '✨', '🌼'], level)

  const normalizedMsg = msg
    ? msg.endsWith('.') || msg.endsWith('!') || msg.endsWith('?')
      ? msg
      : `${msg}.`
    : ''

  if (!normalizedMsg && !name) return ''

  if (type === 'text') {
    const parts: string[] = []
    const g = `${greeting}${firstName ? ` ${firstName}` : ''}`
    parts.push(maybeWithEmoji(g, addEmojis, emojiGreeting))
    if (opener) parts.push(opener)
    if (softeners) parts.push(softeners)
    if (normalizedMsg) parts.push(normalizedMsg)
    parts.push(maybeWithEmoji(closing, addEmojis, emojiClosing))
    return parts.filter(Boolean).join(' ')
  }

  if (type === 'grading') {
    const tone = pickByLevel(
      [
        'Note:',
        'Quick note:',
        'Feedback:',
        'A bit of feedback:',
        'A few thoughts (you’re doing great):',
      ],
      level,
    )

    const encouragement = pickByLevel(
      ['', 'Nice work overall.', 'Nice work overall.', 'Great effort—keep it up.', 'Really strong effort—keep it up.'],
      level,
    )

    const parts: string[] = []
    const toneWithEmoji = maybeWithEmoji(tone, addEmojis, emojiGreeting)
    parts.push(`${toneWithEmoji}`)
    if (encouragement) parts.push(encouragement)
    if (normalizedMsg) parts.push(normalizedMsg)
    if (addEmojis) parts.push(emojiClosing)
    return parts.filter(Boolean).join(' ')
  }

  const subjectHint = pickByLevel(
    ['', '', 'Re:', 'Re:', 'Re:'],
    level,
  )

  const bodyLines: string[] = []
  const greetingLine = `${maybeWithEmoji(greeting, addEmojis, emojiGreeting)} ${addressee},`
  bodyLines.push(greetingLine)
  if (opener) bodyLines.push(opener)
  if (softeners) bodyLines.push(softeners)
  if (normalizedMsg) bodyLines.push(normalizedMsg)
  bodyLines.push('')
  bodyLines.push(maybeWithEmoji(closing, addEmojis, emojiClosing))
  bodyLines.push(signoff)

  return `${subjectHint ? `${subjectHint} ` : ''}${bodyLines.join('\n')}`.trim()
}

function App() {
  const [shortMessage, setShortMessage] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [type, setType] = useState<MessageType>('email')
  const [addEmojis, setAddEmojis] = useState(false)
  const [effusiveness, setEffusiveness] = useState(3)
  const [useAI, setUseAI] = useState(false)
  const [aiOutput, setAiOutput] = useState<string>('')
  const [aiError, setAiError] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)
  const aiController = useRef<AbortController | null>(null)

  const resetAI = () => {
    aiController.current?.abort()
    setAiOutput('')
  }

  useEffect(() => () => aiController.current?.abort(), [])

  const templateOutput = useMemo(
    () =>
      fluffify({
        shortMessage,
        recipientName,
        type,
        effusiveness,
        addEmojis,
      }),
    [shortMessage, recipientName, type, effusiveness, addEmojis],
  )

  const output = useMemo(() => {
    if (useAI) return aiOutput || templateOutput
    return templateOutput
  }, [useAI, aiOutput, templateOutput])

  const canCopy = Boolean(output)

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Fluffinator</h1>
        <p className="subtitle">Turn a curt message into something kind, clear, and polished.</p>
      </header>

      <main className="content">
        <section className="card">
          <div className="grid">
            <label className="field">
              <span className="label">Message type</span>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as MessageType)
                  resetAI()
                }}
              >
                <option value="email">Email</option>
                <option value="text">Text</option>
                <option value="grading">Grading comment</option>
              </select>
            </label>

            <label className="field">
              <span className="label">Recipient name</span>
              <input
                value={recipientName}
                onChange={(e) => {
                  setRecipientName(e.target.value)
                  resetAI()
                }}
                placeholder="e.g., Alex"
                autoComplete="off"
              />
            </label>

            <label className="field span2">
              <span className="label">Short message</span>
              <textarea
                value={shortMessage}
                onChange={(e) => {
                  setShortMessage(e.target.value)
                  resetAI()
                }}
                placeholder="e.g., Please send the updated file by EOD"
                rows={4}
              />
            </label>

            <label className="field">
              <span className="label">Effusiveness: {Math.round(effusiveness)}/5</span>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={effusiveness}
                onChange={(e) => {
                  setEffusiveness(Number(e.target.value))
                  resetAI()
                }}
              />
            </label>

            <label className="field checkbox">
              <input
                type="checkbox"
                checked={addEmojis}
                onChange={(e) => {
                  setAddEmojis(e.target.checked)
                  resetAI()
                }}
              />
              <span className="label">Add emojis</span>
            </label>

            <label className="field checkbox">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => {
                  setUseAI(e.target.checked)
                  setAiError('')
                }}
              />
              <span className="label">Use AI</span>
            </label>
          </div>

          {useAI ? (
            <div className="aiRow">
              <button
                type="button"
                className="primary"
                disabled={aiLoading || !shortMessage.trim()}
                onClick={async () => {
                  setAiLoading(true)
                  setAiError('')
                  try {
                    const controller = new AbortController()
                    aiController.current = controller
                    const res = await fetch('/api/rewrite', {
                      signal: controller.signal,
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({
                        shortMessage,
                        recipientName,
                        type,
                        effusiveness,
                        addEmojis,
                      }),
                    })

                    const data = (await res.json().catch(() => null)) as
                      | { text?: string; error?: string }
                      | null

                    if (!res.ok) {
                      setAiError(data?.error || `Request failed (${res.status})`)
                      return
                    }

                    const text = data?.text?.trim() ?? ''
                    if (!text) {
                      setAiError('Empty AI response')
                      return
                    }

                    setAiOutput(text)
                  } catch (e) {
                    if (e instanceof DOMException && e.name === 'AbortError') return
                    setAiError(e instanceof Error ? e.message : 'Failed to call AI')
                  } finally {
                    setAiLoading(false)
                    aiController.current = null
                  }
                }}
              >
                {aiLoading ? 'Generating…' : 'Generate with AI'}
              </button>
              {aiError ? <div className="error">{aiError}</div> : null}
            </div>
          ) : null}
        </section>

        <section className="card">
          <div className="outputHeader">
            <h2 className="h2">Fluffy version</h2>
            <button
              type="button"
              className="primary"
              disabled={!canCopy}
              onClick={async () => {
                if (!output) return
                await navigator.clipboard.writeText(output)
              }}
            >
              Copy
            </button>
          </div>
          <textarea className="output" value={output} readOnly rows={10} aria-label="Generated fluffy message" />
        </section>
      </main>
    </div>
  )
}

export default App
