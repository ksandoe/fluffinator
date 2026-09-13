import { useEffect, useRef, useState } from 'react'
import {
  currentUser,
  getIdToken,
  resendCode,
  sendCode,
  setTokenStorage,
  signOut,
  verifyCode,
  type AuthStep,
} from './auth'
import { SettingsModal } from './SettingsModal'
import { TosModal } from './TosModal'
import {
  effectiveTones,
  loadToneSettings,
  type MessageType,
  type ToneSettings,
} from './tones'
import './App.css'

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

  return <FluffinatorApp onSignOut={() => setUser(null)} />
}

function SignInForm({ onSignIn }: { onSignIn: (user: string | null) => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<AuthStep | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remember, setRemember] = useState(true)
  const [tosOpen, setTosOpen] = useState(false)

  const start = async () => {
    setLoading(true)
    setError('')
    const { step: s, error: e } = await sendCode(email)
    setLoading(false)
    if (e) {
      setError(e)
      setStep(null)
    } else {
      setStep(s)
    }
  }

  const verify = async () => {
    setLoading(true)
    setError('')
    setTokenStorage(remember)
    const { success, error: e } = await verifyCode(email, code, step as AuthStep)
    setLoading(false)
    if (e) {
      setError(e)
      return
    }
    if (success) {
      const u = await currentUser()
      onSignIn(u)
    } else {
      setError('Verification failed')
    }
  }

  const resend = async () => {
    setLoading(true)
    setError('')
    const { error: e } = await resendCode(email, step as AuthStep)
    setLoading(false)
    if (e) {
      setError(e)
    }
  }

  return (
    <main className="signin">
      <h1 className="title">Fluffinator</h1>
      <p className="subtitle">Turn a curt message into something kind, clear, and polished.</p>
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault()
          if (step && step !== 'EMAIL') {
            await verify()
          } else {
            await start()
          }
        }}
      >
        <p className="hint">Enter your email and we’ll send you a one-time code.</p>
        <label className="field">
          <span className="label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setStep(null)
              setCode('')
              setError('')
            }}
            placeholder="you@example.com"
            autoComplete="off"
            required
            disabled={loading}
          />
        </label>

        {!step ? (
          <button type="submit" className="primary" disabled={loading || !email.trim()}>
            {loading ? 'Sending…' : 'Send code'}
          </button>
        ) : (
          <>
            <p className="hint">A code was sent to {email}.</p>
            <label className="field">
              <span className="label">One-time code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                required
                disabled={loading}
              />
            </label>

            <label className="field checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
              />
              <span className="label">Trust this device</span>
            </label>

            <button type="submit" className="primary" disabled={loading || !code.trim()}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <div className="actions">
              <button type="button" className="link" onClick={resend} disabled={loading}>
                Resend code
              </button>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setStep(null)
                  setCode('')
                  setError('')
                }}
                disabled={loading}
              >
                Use a different email
              </button>
            </div>
          </>
        )}

        {error ? <div className="error">{error}</div> : null}

        <p className="hint">
          By continuing, you agree to the{' '}
          <button type="button" className="link" onClick={() => setTosOpen(true)}>
            Terms of Service
          </button>
          .
        </p>
      </form>

      {tosOpen ? <TosModal onClose={() => setTosOpen(false)} /> : null}
    </main>
  )
}

function FluffinatorApp({ onSignOut }: { onSignOut: () => void }) {
  const [shortMessage, setShortMessage] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [type, setType] = useState<MessageType>('email')
  const [addEmojis, setAddEmojis] = useState(false)
  const [fluffiness, setFluffiness] = useState(3)
  const [toneSettings, setToneSettings] = useState<ToneSettings>(loadToneSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
          <button
            type="button"
            className="primary"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
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
              <span className="label">Fluffiness: {Math.round(fluffiness)}/5</span>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={fluffiness}
                onChange={(e) => {
                  setFluffiness(Number(e.target.value))
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
                      fluffiness,
                      addEmojis,
                      tones: effectiveTones(toneSettings, type, fluffiness),
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
              {loading ? 'Fluffifying…' : 'Fluffify'}
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

      {settingsOpen ? (
        <SettingsModal
          settings={toneSettings}
          currentType={type}
          onChange={setToneSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}

export default App
