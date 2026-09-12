export type MessageType = 'email' | 'text' | 'grading'

export interface ToneDef {
  key: string
  label: string
  low: string
  high: string
}

export const TONES: ToneDef[] = [
  { key: 'warmth', label: 'Warmth', low: 'Distant', high: 'Cozy' },
  { key: 'enthusiasm', label: 'Enthusiasm', low: 'Calm', high: 'Bubbly' },
  { key: 'encouragement', label: 'Encouragement', low: 'Neutral', high: 'Cheering' },
  { key: 'praise', label: 'Praise', low: 'None', high: 'Generous' },
  { key: 'gratitude', label: 'Gratitude', low: 'None', high: 'Profuse' },
  { key: 'politeness', label: 'Politeness', low: 'Casual', high: 'Formal' },
  { key: 'gentleness', label: 'Gentleness', low: 'Direct', high: 'Delicate' },
]

export type ToneValues = Record<string, number>
export type SettingsScope = 'all' | MessageType
export type ToneSettings = Partial<Record<SettingsScope, ToneValues>>

const DEFAULT_TONES: ToneValues = Object.fromEntries(TONES.map((t) => [t.key, 3]))
const STORAGE_KEY = 'fluffinator:tones'

export function loadToneSettings(): ToneSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ToneSettings) : {}
  } catch {
    return {}
  }
}

export function saveToneSettings(settings: ToneSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function effectiveTones(
  settings: ToneSettings,
  type: MessageType,
  fluffiness: number,
): ToneValues {
  const base = { ...DEFAULT_TONES, ...(settings[type] ?? settings.all ?? {}) }
  const out: ToneValues = {}
  for (const t of TONES) {
    out[t.key] = Math.max(1, Math.min(5, Math.round((base[t.key] ?? 3) + (fluffiness - 3))))
  }
  return out
}
