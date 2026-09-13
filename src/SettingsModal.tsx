import { useState } from 'react'
import {
  TONES,
  saveToneSettings,
  type MessageType,
  type SettingsScope,
  type ToneSettings,
} from './tones'

const DEFAULT_TONES = Object.fromEntries(TONES.map((t) => [t.key, 3]))

const SCOPE_LABELS: Record<SettingsScope, string> = {
  all: 'All message types',
  email: 'Email',
  text: 'Text',
  grading: 'Grading comment',
}

export function SettingsModal({
  settings,
  currentType,
  onChange,
  onClose,
}: {
  settings: ToneSettings
  currentType: MessageType
  onChange: (settings: ToneSettings) => void
  onClose: () => void
}) {
  const [scope, setScope] = useState<SettingsScope>(currentType)
  const tones = { ...DEFAULT_TONES, ...(settings[scope] ?? settings.all ?? {}) }
  const hasOverride = scope !== 'all' && settings[scope] !== undefined

  const update = (key: string, value: number) => {
    const next = { ...settings, [scope]: { ...tones, [key]: value } }
    onChange(next)
    saveToneSettings(next)
  }

  const clearOverride = () => {
    const next = { ...settings }
    delete next[scope]
    onChange(next)
    saveToneSettings(next)
  }

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tone settings"
      >
        <div className="outputHeader">
          <h2 className="h2">Tone settings</h2>
          <button type="button" className="link" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="field">
          <span className="label">Edit settings for</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as SettingsScope)}>
            <option value="all">All message types</option>
            <option value="email">Email</option>
            <option value="text">Text</option>
            <option value="grading">Grading comment</option>
          </select>
        </label>

        {scope === 'all' ? (
          <p className="hint">These defaults apply to every message type.</p>
        ) : hasOverride ? (
          <p className="hint">
            Custom {SCOPE_LABELS[scope]} settings — they override the “All message types”
            defaults.{' '}
            <button type="button" className="link" onClick={clearOverride}>
              Reset to defaults
            </button>
          </p>
        ) : (
          <p className="hint">
            {SCOPE_LABELS[scope]} currently uses the “All message types” defaults — move a
            slider to customize just this type.
          </p>
        )}

        <p className="hint">Changes save automatically.</p>

        <div className="tones">
          {TONES.map((t) => (
            <div className="tone" key={t.key}>
              <div className="toneHead">
                <span className="label">{t.label}</span>
                <span className="toneValue">{tones[t.key]}/5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={tones[t.key]}
                onChange={(e) => update(t.key, Number(e.target.value))}
                aria-label={t.label}
              />
              <div className="toneEnds">
                <span>{t.low}</span>
                <span>{t.high}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
