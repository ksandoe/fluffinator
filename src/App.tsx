import { useEffect, useRef, useState } from 'react'
import { currentUser, getIdToken, signIn, signOut } from './auth'
import './App.css'

type MessageType = 'email' | 'text' | 'grading'

function App() {
  const [user, setUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    currentUser().then((u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="app loading" />

  if (!user) {
    return (
      <div className="app">
        <SignInForm onSignIn={setUser} />
      </div>
    )
  }

  return <FluffinatorApp user={user} onSignOut={() => setUser(null)} />
}

function SignInForm({ onSignIn }: { onSignIn: (user: string | null) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  return (
    <main className="signin">
      <h1 className="title">Fluffinator</h1>
      <p className="subtitle">Sign in to generate friendly, polished messages.</p>
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          try {
            const ok = await signIn(email, password)
            if (!ok) {
              setError('Sign in failed')
              return
            }
            const u = await currentUser()
            onSignIn(u)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign in failed')
          }
        }}
      >
        <label className="field">
          <span className="label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="off"
            required
          />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
        </label>
        {error ? <div className="error">{error}</div> : null}
        <button type="submit" className="primary">
          Sign in
        </button>
      </form>
    </main>
  )
}

function FluffinatorApp({ user, onSignOut }: { user: string; onSignOut: () => void }) {
  const [shortMessage, setShortMessage] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [type, setType] = useState<MessageType>('email')
  const [addEmojis, setAddEmojis] = useState(false)
  const [effusiveness, setEffusiveness] = useState(3)
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const aiController = useRef<AbortController | null>(null)

  useEffect(() => () => aiController.current?.abort(), [])

  const reset = () => {
    aiController.current?.abort()
    setOutput('')
    setError('')
  }

  const canCopy = Boolean(output)

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">Fluffinator</h1>
          <p className="subtitle">Turn a curt message into something kind, clear, and polished.</p>
        </div>
        <div className="user">
          <span className="label">{user}</span>
          <button
            type="button"
            className="primary"
            onClick={async () => {
              await signOut()
              onSignOut()
            }}
          >
            Sign out
          </button>
        </div>
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
                  reset()
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
                  reset()
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
                  reset()
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
                  reset()
                }}
              />
            </label>

            <label className="field checkbox">
              <input
                type="checkbox"
                checked={addEmojis}
                onChange={(e) => {
                  setAddEmojis(e.target.checked)
                  reset()
                }}
              />
              <span className="label">Add emojis</span>
            </label>
          </div>

          <div className="aiRow">
            <button
              type="button"
              className="primary"
              disabled={loading || !shortMessage.trim()}
              onClick={async () => {
                setLoading(true)
                setError('')
                try {
                  const controller = new AbortController()
                  aiController.current = controller
                  const apiUrl = import.meta.env.VITE_API_URL ?? ''
                  const token = await getIdToken()
                  const headers: Record<string, string> = { 'content-type': 'application/json' }
                  if (token) headers['authorization'] = token
                  const res = await fetch(`${apiUrl}/api/rewrite`, {
                    signal: controller.signal,
                    method: 'POST',
                    headers,
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
                    setError(data?.error || `Request failed (${res.status})`)
                    return
                  }

                  const text = data?.text?.trim() ?? ''
                  if (!text) {
                    setError('Empty AI response')
                    return
                  }

                  setOutput(text)
                } catch (e) {
                  if (e instanceof DOMException && e.name === 'AbortError') return
                  setError(e instanceof Error ? e.message : 'Failed to call AI')
                } finally {
                  setLoading(false)
                  aiController.current = null
                }
              }}
            >
              {loading ? 'Generating…' : 'Generate'}
            </button>
            {error ? <div className="error">{error}</div> : null}
          </div>
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
