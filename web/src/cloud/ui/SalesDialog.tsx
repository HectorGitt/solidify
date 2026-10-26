import { useState, type FormEvent } from 'react'
import { create } from 'zustand'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { SUPPORT_EMAIL } from '../config'
import { Field, Modal, Notice, inputCls, primaryBtn } from './Modal'

type Seats = '1-10' | '11-50' | '51-200' | '200+'

export const useSales = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))

const SEATS: Seats[] = ['1-10', '11-50', '51-200', '200+']

/** "Schools & companies": a sales enquiry, stored with the feedback queue for the team to answer. */
export function SalesDialog() {
  const open = useSales((s) => s.open)
  const user = useAuth((s) => s.user)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [seats, setSeats] = useState<Seats | null>(null)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    useSales.getState().hide()
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
          kind: 'sales',
          message,
          contact: (email || user?.email || '').trim(),
          name: name.trim() || user?.name || undefined,
          organisation: organisation.trim() || undefined,
          seats: seats ?? undefined,
          route: window.location.hash.replace(/^#/, '').split('?')[0].slice(0, 200) || '/',
        },
      })
      setState('sent')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t send. Please try again.')
      setState('idle')
    }
  }

  return (
    <Modal open={open} onClose={close} title="Solidify for schools & companies" width={500}>
      {state === 'sent' ? (
        <div className="space-y-3">
          <Notice tone="ok">Thanks, we’ve got your message and will reply by email.</Notice>
          <button className={`${primaryBtn} w-full`} onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          <p className="mb-4 text-[13px] leading-relaxed text-mute">Licences for a department or a team, classes for your students, Create in 3D for your engineers. Tell us what you need and we’ll put a plan together.</p>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Name">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} placeholder={user?.name ?? undefined} />
            </Field>
            <Field label="Work email">
              <input className={inputCls} type="email" required={!user?.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} placeholder={user?.email ?? undefined} />
            </Field>
          </div>
          <Field label="School or company">
            <input className={inputCls} value={organisation} onChange={(e) => setOrganisation(e.target.value)} autoComplete="organization" maxLength={160} />
          </Field>
          <div className="mb-3">
            <span className="mb-1.5 block text-[12px] font-medium text-mute">How many people would use it?</span>
            <div role="radiogroup" aria-label="Number of users" className="flex flex-wrap gap-1.5">
              {SEATS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={seats === s}
                  onClick={() => setSeats(seats === s ? null : s)}
                  className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${seats === s ? 'border-ink bg-ink text-bg' : 'border-line-2 text-mute hover:text-ink'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Field label="What are you looking for?">
            <textarea className={`${inputCls} min-h-[88px] resize-y`} required minLength={3} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Access for our 400-level farm power class, with papers and the weak-spot report" />
          </Field>
          {error ? (
            <div className="mb-3">
              <Notice tone="warn">{error}</Notice>
            </div>
          ) : null}
          <button type="submit" className={`${primaryBtn} w-full`} disabled={state === 'sending' || message.trim().length < 3}>
            {state === 'sending' ? 'Sending…' : 'Send enquiry'}
          </button>
          <p className="mt-3 text-center text-[11.5px] text-dim">
            Or email{' '}
            <a className="text-accent hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </form>
      )}
    </Modal>
  )
}
