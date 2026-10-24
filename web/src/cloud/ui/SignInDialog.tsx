import { useState, type FormEvent } from 'react'
import { authMessage, useAuth } from '../auth'
import { Field, Modal, Notice, ghostBtn, inputCls, primaryBtn } from './Modal'

type Mode = 'sign-in' | 'sign-up' | 'reset'

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Sign in / create account / reset password. Opened with useAuth.getState().openDialog(). */
export function SignInDialog() {
  const open = useAuth((s) => s.dialog)
  const close = () => useAuth.getState().openDialog(false)
  const [mode, setMode] = useState<Mode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await f()
    } catch (e) {
      setError(authMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const a = useAuth.getState()
    if (mode === 'sign-in') void run(() => a.signInEmail(email, password))
    else if (mode === 'sign-up') void run(() => a.signUpEmail(name, email, password))
    else
      void run(async () => {
        await a.resetPassword(email)
        setSent(true)
      })
  }

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setSent(false)
  }

  const title = mode === 'sign-up' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Sign in to Solidify'

  return (
    <Modal open={open} onClose={close} title={title} width={400}>
      {mode !== 'reset' ? (
        <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-mute">Keep your progress on every device, join a class, and ask the tutor about what you’re looking at.</p>
          <button className={`${ghostBtn} w-full py-2.5`} disabled={busy} onClick={() => void run(() => useAuth.getState().signInGoogle())}>
            <GoogleMark /> Continue with Google
          </button>
          <div className="my-3.5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-dim">
            <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : (
        <p className="mb-3 text-[12.5px] leading-relaxed text-mute">Enter your account’s email and we’ll send you a link to choose a new password.</p>
      )}

      <form onSubmit={submit}>
        {mode === 'sign-up' ? (
          <Field label="Your name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="As your teacher knows you" />
          </Field>
        ) : null}
        <Field label="Email">
          <input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        {mode !== 'reset' ? (
          <Field label="Password">
            <input
              className={inputCls}
              type="password"
              required
              minLength={mode === 'sign-up' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              placeholder={mode === 'sign-up' ? 'At least 8 characters' : undefined}
            />
          </Field>
        ) : null}

        {error ? <div className="mb-3"><Notice tone="warn">{error}</Notice></div> : null}
        {sent ? <div className="mb-3"><Notice tone="ok">If an account uses {email}, a reset link is on its way. Check your spam folder too.</Notice></div> : null}

        <button type="submit" className={`${primaryBtn} w-full py-2.5`} disabled={busy || (mode === 'reset' && sent)}>
          {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
        </button>
      </form>

      <div className="mt-3.5 flex flex-wrap justify-between gap-2 text-[12.5px]">
        {mode === 'sign-in' ? (
          <>
            <button className="text-accent hover:underline" onClick={() => switchTo('sign-up')}>
              Create an account
            </button>
            <button className="text-mute hover:text-ink" onClick={() => switchTo('reset')}>
              Forgot password?
            </button>
          </>
        ) : (
          <button className="text-accent hover:underline" onClick={() => switchTo('sign-in')}>
            {mode === 'sign-up' ? 'I already have an account' : 'Back to sign in'}
          </button>
        )}
      </div>
    </Modal>
  )
}
