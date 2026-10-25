import { useState, type FormEvent, type ReactNode } from 'react'
import { StudyShell } from '@/study/ui/StudyShell'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Field, Notice, inputCls, primaryBtn } from './Modal'

type Role = 'student' | 'teacher' | 'engineer' | 'other'
type Interest = 'describe' | 'photo' | 'customize' | 'chat' | 'classroom'

const FEATURES: { title: string; body: string }[] = [
  { title: 'Describe it', body: '“A two-stage spur gear reducer, 20 : 1, for a 15 kW motor.” Get a working model built from real parts: gears that mesh, shafts that turn, live speeds and torques.' },
  { title: 'Start from a photo', body: 'Upload a picture of a gearbox, an implement or a part. Solidify proposes a model of the mechanism and its proportions for you to confirm.' },
  { title: 'Customize everything', body: 'Every dimension, tooth count, ratio and material is a control. Cut it, explode it, X-ray it, and watch the calculations follow.' },
  { title: 'Design by chat', body: '“Make the output shaft 40 mm longer.” “Why isn’t this 20 : 1?” A design assistant edits the model and explains what changed.' },
]

const INTERESTS: { value: Interest; label: string }[] = [
  { value: 'describe', label: 'Describing a design' },
  { value: 'photo', label: 'Modelling from a photo' },
  { value: 'customize', label: 'Detailed customization' },
  { value: 'chat', label: 'Designing by chat' },
  { value: 'classroom', label: 'Using it with a class' },
]

function Choice({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors ${checked ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line-2 text-ink/85 hover:border-accent/40'}`}
    >
      {children}
    </button>
  )
}

function WaitlistForm() {
  const user = useAuth((s) => s.user)
  const [email, setEmail] = useState(user?.email ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState<Role>('student')
  const [interest, setInterest] = useState<Interest[]>([])
  const [useCase, setUseCase] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const toggle = (v: Interest) => setInterest((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    setError(null)
    try {
      await api('/v1/waitlist', {
        body: { email, name: name.trim() || undefined, role, interest, useCase: useCase.trim() || undefined, organisation: organisation.trim() || undefined, website: website || undefined },
      })
      setState('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t join just now. Please try again.')
      setState('idle')
    }
  }

  if (state === 'done')
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
        <h2 className="text-[16px] font-semibold text-ink">You’re on the list</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-mute">We’ll email {email} when Create in 3D opens, with early access for the first people on the list.</p>
      </div>
    )

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-1 text-[16px] font-semibold">Join the waiting list</h2>
      <p className="mb-4 text-[12.5px] text-mute">Be first in when it opens. We’ll only email you about Create in 3D.</p>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Field label="Email">
          <input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} />
        </Field>
        <Field label="Name (optional)">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
        </Field>
      </div>
      <div className="mb-3">
        <span className="mb-1.5 block text-[12px] font-medium text-mute">I am a…</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Role">
          {(['student', 'teacher', 'engineer', 'other'] as const).map((r) => (
            <Choice key={r} checked={role === r} onClick={() => setRole(r)}>
              {{ student: 'Student', teacher: 'Teacher / lecturer', engineer: 'Engineer / technician', other: 'Something else' }[r]}
            </Choice>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <span className="mb-1.5 block text-[12px] font-medium text-mute">Most interested in</span>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => (
            <Choice key={i.value} checked={interest.includes(i.value)} onClick={() => toggle(i.value)}>
              {i.label}
            </Choice>
          ))}
        </div>
      </div>
      <Field label="What would you make? (optional)">
        <textarea className={`${inputCls} min-h-[72px] resize-y`} value={useCase} onChange={(e) => setUseCase(e.target.value)} maxLength={1000} placeholder="e.g. a model of our maize sheller drive for my final-year project" />
      </Field>
      <Field label="School or company (optional)">
        <input className={inputCls} value={organisation} onChange={(e) => setOrganisation(e.target.value)} maxLength={120} autoComplete="organization" />
      </Field>
      {/* honeypot: hidden from people, filled in by bots */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
      {error ? <div className="mb-3"><Notice tone="warn">{error}</Notice></div> : null}
      <button type="submit" className={`${primaryBtn} w-full py-2.5`} disabled={state === 'sending'}>
        {state === 'sending' ? 'Joining…' : 'Join the waiting list'}
      </button>
    </form>
  )
}

export default function CreatePage() {
  return (
    <StudyShell
      title="Create in 3D"
      lead="Describe a machine or upload a photo, and get a 3D model you can cut open, take apart, animate and change in every detail, with the engineering calculated live."
      right={<span className="rounded-full border border-warn/50 bg-warn/10 px-3 py-1 text-[12px] font-semibold text-warn">Coming soon</span>}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <section className="grid content-start gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-panel-2/50 p-4">
              <h3 className="mb-1 text-[14px] font-semibold text-ink">{f.title}</h3>
              <p className="text-[12.5px] leading-relaxed text-mute">{f.body}</p>
            </div>
          ))}
          <p className="text-[12px] leading-relaxed text-dim sm:col-span-2">
            Built on the same parts library and tested calculations as every Solidify scene. Create in 3D will be part of Solidify’s paid plans, with a free trial.
          </p>
        </section>
        <aside>
          <WaitlistForm />
        </aside>
      </div>
    </StudyShell>
  )
}
