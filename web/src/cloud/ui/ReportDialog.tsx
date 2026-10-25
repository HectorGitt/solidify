import { useState, type FormEvent } from 'react'
import { create } from 'zustand'
import { useParts } from '@/parts/registry'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { SUPPORT_EMAIL } from '../config'
import { Field, Modal, Notice, inputCls, primaryBtn } from './Modal'

type Kind = 'error' | 'bug' | 'idea'

interface ReportTarget {
  /** the part being reported, if any */
  partId?: string
}

export const useReport = create<{ target: ReportTarget | null; open: (t: ReportTarget) => void; close: () => void }>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}))

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: 'error', label: 'Wrong value or explanation', hint: 'A number, formula or description that looks incorrect' },
  { value: 'bug', label: 'Something broken', hint: 'A part in the wrong place, a control that doesn’t work, an error' },
  { value: 'idea', label: 'Suggestion', hint: 'Something you’d like to see' },
]

/** "Report a problem": anyone can send one; signed-in reports are linked to the account. */
export function ReportDialog() {
  const target = useReport((s) => s.target)
  const signedIn = useAuth((s) => s.status === 'signed-in')
  const partName = useParts((s) => (target?.partId ? s.parts[target.partId]?.name : undefined))
  const [kind, setKind] = useState<Kind>('error')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    useReport.getState().close()
    setTimeout(() => {
      setState('idle')
      setMessage('')
      setError(null)
    }, 200)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    setError(null)
    try {
      await api('/v1/feedback', {
        body: {
          kind,
          message,
          route: window.location.hash.replace(/^#/, '').split('?')[0].slice(0, 200) || '/',
          partId: target?.partId,
          contact: !signedIn && contact.trim() ? contact.trim() : undefined,
        },
      })
      setState('sent')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t send. Please try again.')
      setState('idle')
    }
  }

  return (
    <Modal open={!!target} onClose={close} title={partName ? `Report a problem: ${partName}` : 'Report a problem'} width={460}>
      {state === 'sent' ? (
        <div className="space-y-3">
          <Notice tone="ok">Thanks, your report has been sent. Reports like this are how Solidify gets more accurate.</Notice>
          <button className={`${primaryBtn} w-full`} onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          <div role="radiogroup" aria-label="Kind of problem" className="mb-3 grid gap-1.5">
            {KINDS.map((k) => (
              <button
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                key={k.value}
                onClick={() => setKind(k.value)}
                className={`rounded-md border px-3 py-2 text-left transition-colors ${kind === k.value ? 'border-accent/60 bg-accent/10' : 'border-line-2 hover:border-line'}`}
              >
                <span className="block text-[13px] font-medium text-ink">{k.label}</span>
                <span className="block text-[11.5px] text-mute">{k.hint}</span>
              </button>
            ))}
          </div>
          <Field label="What did you notice?">
            <textarea className={`${inputCls} min-h-[96px] resize-y`} required minLength={3} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={kind === 'error' ? 'e.g. The clutch torque shows 15.2 N·m but my working gives 16 N·m' : undefined} />
          </Field>
          {!signedIn ? (
            <Field label="Email, if you’d like a reply (optional)">
              <input className={inputCls} type="email" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" />
            </Field>
          ) : null}
          <p className="mb-3 text-[11.5px] text-dim">
            The page you’re on{partName ? ' and the selected part are' : ' is'} included automatically. Prefer email? Write to{' '}
            <a className="text-accent hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          {error ? <div className="mb-3"><Notice tone="warn">{error}</Notice></div> : null}
          <button type="submit" className={`${primaryBtn} w-full`} disabled={state === 'sending' || message.trim().length < 3}>
            {state === 'sending' ? 'Sending…' : 'Send report'}
          </button>
        </form>
      )}
    </Modal>
  )
}
