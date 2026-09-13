const CLIENT_ID = '73teoks8hhta8om21jr7ld2mbh'
const COGNITO_URL = 'https://cognito-idp.us-east-1.amazonaws.com/'
const API_URL = 'https://api.fluffinator.io'
const STORAGE_KEY = 'fluffinator:auth'

const $ = (id) => document.getElementById(id)

// ---------- Tone settings ----------

const TONES = [
  { key: 'warmth', label: 'Warmth', low: 'Distant', high: 'Cozy' },
  { key: 'enthusiasm', label: 'Enthusiasm', low: 'Calm', high: 'Bubbly' },
  { key: 'encouragement', label: 'Encouragement', low: 'Neutral', high: 'Cheering' },
  { key: 'praise', label: 'Praise', low: 'None', high: 'Generous' },
  { key: 'gratitude', label: 'Gratitude', low: 'None', high: 'Profuse' },
  { key: 'politeness', label: 'Politeness', low: 'Casual', high: 'Formal' },
  { key: 'gentleness', label: 'Gentleness', low: 'Direct', high: 'Delicate' },
]

const SCOPE_LABELS = {
  all: 'All message types',
  email: 'Email',
  text: 'Text',
  grading: 'Grading comment',
}

const TONE_STORAGE_KEY = 'fluffinator:tones'
const DEFAULT_TONES = Object.fromEntries(TONES.map((t) => [t.key, 3]))

let toneSettings = {}
let toneScope = 'all'

async function loadToneSettings() {
  const data = await chrome.storage.local.get(TONE_STORAGE_KEY)
  toneSettings = data[TONE_STORAGE_KEY] ?? {}
}

function currentTones() {
  return { ...DEFAULT_TONES, ...(toneSettings[toneScope] ?? toneSettings.all ?? {}) }
}

function effectiveTones(type, fluffiness) {
  const base = { ...DEFAULT_TONES, ...(toneSettings[type] ?? toneSettings.all ?? {}) }
  const out = {}
  for (const t of TONES) {
    out[t.key] = Math.max(1, Math.min(5, Math.round(base[t.key] + (fluffiness - 3))))
  }
  return out
}

function updateToneHint() {
  const hasOverride = toneScope !== 'all' && toneSettings[toneScope] !== undefined
  const hint = $('toneHint')
  if (toneScope === 'all') {
    hint.textContent = 'These defaults apply to every message type.'
  } else if (hasOverride) {
    hint.innerHTML = ''
    hint.append(
      `Custom ${SCOPE_LABELS[toneScope]} settings — they override the defaults. `,
    )
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'link'
    reset.textContent = 'Reset to defaults'
    reset.addEventListener('click', () => {
      delete toneSettings[toneScope]
      chrome.storage.local.set({ [TONE_STORAGE_KEY]: toneSettings })
      renderTones()
    })
    hint.append(reset)
  } else {
    hint.textContent = `${SCOPE_LABELS[toneScope]} currently uses the “All message types” defaults — move a slider to customize just this type.`
  }
}

function renderTones() {
  updateToneHint()
  const tones = currentTones()
  const container = $('tones')
  container.innerHTML = ''
  for (const t of TONES) {
    const row = document.createElement('div')
    row.className = 'tone'

    const head = document.createElement('div')
    head.className = 'toneHead'
    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = t.label
    const value = document.createElement('span')
    value.className = 'toneValue'
    value.textContent = `${tones[t.key]}/5`
    head.append(label, value)

    const input = document.createElement('input')
    input.type = 'range'
    input.min = '1'
    input.max = '5'
    input.step = '1'
    input.value = String(tones[t.key])
    input.setAttribute('aria-label', t.label)
    input.addEventListener('input', () => {
      const next = { ...toneSettings, [toneScope]: { ...currentTones(), [t.key]: Number(input.value) } }
      toneSettings = next
      chrome.storage.local.set({ [TONE_STORAGE_KEY]: next })
      value.textContent = `${input.value}/5`
      updateToneHint()
    })

    const ends = document.createElement('div')
    ends.className = 'toneEnds'
    const low = document.createElement('span')
    low.textContent = t.low
    const high = document.createElement('span')
    high.textContent = t.high
    ends.append(low, high)

    row.append(head, input, ends)
    container.append(row)
  }
}

// ---------- Cognito ----------

async function cognito(target, body) {
  const res = await fetch(COGNITO_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify({ ClientId: CLIENT_ID, ...body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed')
    err.name = (data.__type || '').split('#').pop()
    throw err
  }
  return data
}

// ---------- Token storage ----------

const storeFor = (trusted) => (trusted ? chrome.storage.local : chrome.storage.session)

async function saveTokens(tokens, trusted) {
  await storeFor(trusted).set({
    [STORAGE_KEY]: { ...tokens, trusted, expiresAt: Date.now() + tokens.ExpiresIn * 1000 },
  })
}

async function loadAuth() {
  const session = await chrome.storage.session.get(STORAGE_KEY)
  if (session[STORAGE_KEY]) return session[STORAGE_KEY]
  const local = await chrome.storage.local.get(STORAGE_KEY)
  return local[STORAGE_KEY] ?? null
}

async function clearAuth() {
  await Promise.all([
    chrome.storage.local.remove(STORAGE_KEY),
    chrome.storage.session.remove(STORAGE_KEY),
  ])
}

async function getIdToken() {
  const auth = await loadAuth()
  if (!auth) return null
  if (Date.now() < auth.expiresAt - 60_000) return auth.IdToken
  if (!auth.RefreshToken) return null
  try {
    const data = await cognito('InitiateAuth', {
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: auth.RefreshToken },
    })
    const tokens = data.AuthenticationResult
    await saveTokens({ ...auth, ...tokens }, auth.trusted)
    return tokens.IdToken
  } catch {
    await clearAuth()
    return null
  }
}

// ---------- Auth flow ----------

let session = null
let step = null // 'signin' | 'signup'

async function sendCode(email) {
  try {
    const data = await cognito('InitiateAuth', {
      AuthFlow: 'USER_AUTH',
      AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: 'EMAIL_OTP' },
    })
    session = data.Session
    step = 'signin'
    showCodeEntry(`A code was sent to ${email}.`)
  } catch (err) {
    if (err.name !== 'UserNotFoundException') {
      showError($('signinError'), err.message)
      return
    }
    try {
      const data = await cognito('SignUp', {
        Username: email,
        UserAttributes: [{ Name: 'email', Value: email }],
      })
      session = data.Session ?? null
      step = 'signup'
      showCodeEntry(`Welcome! A confirmation code was sent to ${email}.`)
    } catch (e) {
      showError($('signinError'), e.message)
    }
  }
}

async function verifyCode(email, code, remember) {
  try {
    if (step === 'signin') {
      const data = await cognito('RespondToAuthChallenge', {
        ChallengeName: 'EMAIL_OTP',
        Session: session,
        ChallengeResponses: { USERNAME: email, EMAIL_OTP_CODE: code },
      })
      await saveTokens(data.AuthenticationResult, remember)
      showMain()
      return
    }

    const data = await cognito('ConfirmSignUp', {
      Username: email,
      ConfirmationCode: code,
    })

    if (!data.Session) {
      showError($('signinError'), 'Confirmed — request a new code to sign in.')
      resetSignin()
      return
    }

    const authData = await cognito('InitiateAuth', {
      AuthFlow: 'USER_AUTH',
      Session: data.Session,
      AuthParameters: { USERNAME: email },
    })

    if (authData.AuthenticationResult) {
      await saveTokens(authData.AuthenticationResult, remember)
      showMain()
    } else if (authData.ChallengeName === 'EMAIL_OTP') {
      session = authData.Session
      step = 'signin'
      showCodeEntry('One more step — a sign-in code was sent to your email.')
    } else {
      resetSignin()
    }
  } catch (err) {
    showError($('signinError'), err.message || 'Invalid or expired code')
  }
}

async function resend(email) {
  try {
    if (step === 'signup') {
      await cognito('ResendConfirmationCode', { Username: email })
    } else {
      const data = await cognito('InitiateAuth', {
        AuthFlow: 'USER_AUTH',
        AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: 'EMAIL_OTP' },
      })
      session = data.Session
    }
    $('signinHint').textContent = `A new code was sent to ${email}.`
  } catch (err) {
    showError($('signinError'), err.message)
  }
}

// ---------- UI ----------

function showError(el, message) {
  el.textContent = message || ''
}

function showCodeEntry(hint) {
  $('signinHint').textContent = hint
  $('codeSection').classList.remove('hidden')
  $('codeActions').classList.remove('hidden')
  $('signinBtn').textContent = 'Verify'
  $('code').focus()
}

function resetSignin() {
  session = null
  step = null
  $('code').value = ''
  $('codeSection').classList.add('hidden')
  $('codeActions').classList.add('hidden')
  $('signinBtn').textContent = 'Send code'
  $('signinHint').textContent = 'Enter your email and we’ll send you a one-time code.'
  showError($('signinError'), '')
}

function showSignin() {
  $('mainView').classList.add('hidden')
  $('signinView').classList.remove('hidden')
}

function showMain() {
  $('signinView').classList.add('hidden')
  $('mainView').classList.remove('hidden')
}

function setBusy(btn, busy, label, busyLabel) {
  btn.disabled = busy
  btn.textContent = busy ? busyLabel : label
}

// ---------- Wiring ----------

$('signinForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = $('email').value.trim()
  if (!email) return
  const btn = $('signinBtn')
  if (!step) {
    setBusy(btn, true, 'Send code', 'Sending…')
    await sendCode(email)
    setBusy(btn, false, step ? 'Verify' : 'Send code', '')
  } else {
    const code = $('code').value.trim()
    if (!code) return
    setBusy(btn, true, 'Verify', 'Verifying…')
    await verifyCode(email, code, $('remember').checked)
    setBusy(btn, false, step ? 'Verify' : 'Send code', '')
  }
})

$('email').addEventListener('input', () => {
  if (step) resetSignin()
})

$('resendBtn').addEventListener('click', () => resend($('email').value.trim()))
$('differentEmailBtn').addEventListener('click', resetSignin)

$('settingsBtn').addEventListener('click', async () => {
  await loadToneSettings()
  toneScope = $('type').value
  $('toneScope').value = toneScope
  renderTones()
  $('mainView').classList.add('hidden')
  $('settingsView').classList.remove('hidden')
})

$('settingsBackBtn').addEventListener('click', () => {
  $('settingsView').classList.add('hidden')
  $('mainView').classList.remove('hidden')
})

$('toneScope').addEventListener('change', () => {
  toneScope = $('toneScope').value
  renderTones()
})

$('signOutBtn').addEventListener('click', async () => {
  const auth = await loadAuth()
  if (auth?.RefreshToken) {
    cognito('RevokeToken', { Token: auth.RefreshToken }).catch(() => {})
  }
  await clearAuth()
  resetSignin()
  showSignin()
})

$('fluffiness').addEventListener('input', () => {
  $('fluffVal').textContent = $('fluffiness').value
})

$('message').addEventListener('input', () => {
  $('fluffifyBtn').disabled = !$('message').value.trim()
  $('output').value = ''
  $('copyBtn').disabled = true
  showError($('mainError'), '')
})

$('fluffifyBtn').addEventListener('click', async () => {
  const btn = $('fluffifyBtn')
  setBusy(btn, true, 'Fluffify', 'Fluffifying…')
  showError($('mainError'), '')
  try {
    const token = await getIdToken()
    if (!token) {
      showSignin()
      return
    }
    const res = await fetch(`${API_URL}/api/rewrite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({
        shortMessage: $('message').value,
        recipientName: $('recipient').value,
        type: $('type').value,
        fluffiness: Number($('fluffiness').value),
        addEmojis: $('emojis').checked,
        tones: effectiveTones($('type').value, Number($('fluffiness').value)),
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.status === 401) {
      await clearAuth()
      showSignin()
      return
    }
    if (!res.ok) {
      showError($('mainError'), data?.error || `Request failed (${res.status})`)
      return
    }
    const text = data?.text?.trim() ?? ''
    if (!text) {
      showError($('mainError'), 'Empty AI response')
      return
    }
    $('output').value = text
    $('copyBtn').disabled = false
  } catch (err) {
    showError($('mainError'), err.message || 'Failed to call API')
  } finally {
    setBusy(btn, false, 'Fluffify', 'Fluffifying…')
    $('fluffifyBtn').disabled = !$('message').value.trim()
  }
})

$('copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText($('output').value)
})

// ---------- Init ----------

Promise.all([getIdToken(), loadToneSettings()]).then(([token]) =>
  token ? showMain() : showSignin(),
)
