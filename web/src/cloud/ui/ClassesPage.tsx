import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StudyShell } from '@/study/ui/StudyShell'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { useProfile, type ClassRef } from '../profile'
import { Notice, inputCls, primaryBtn } from './Modal'

export function SignInFirst({ what }: { what: string }) {
  return (
    <div className="rounded-3xl border border-line bg-panel-2/50 px-5 py-8 text-center">
      <p className="mb-3 text-[13.5px] text-mute">Sign in to {what}.</p>
      <button className={primaryBtn} onClick={() => useAuth.getState().openDialog()}>
        Sign in
      </button>
    </div>
  )
}

function JoinForm() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ id: string }>('/v1/classes/join', { body: { code } })
      await useProfile.getState().refresh()
      navigate(`/classes/${res.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t join. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-3xl border border-line bg-panel-2/50 p-4">
      <h2 className="mb-1 text-[14px] font-semibold">Join a class</h2>
      <p className="mb-3 text-[12.5px] text-mute">Enter the 6-character code your teacher gave you.</p>
      <div className="flex gap-2">
        <input
          className={`${inputCls} max-w-[12ch] font-mono uppercase tracking-[0.2em]`}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC234"
          aria-label="Class code"
          autoCapitalize="characters"
        />
        <button className={primaryBtn} disabled={busy || code.length !== 6}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      </div>
      {error ? <div className="mt-3"><Notice tone="warn">{error}</Notice></div> : null}
    </form>
  )
}

function CreateForm() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ id: string }>('/v1/classes', { body: { name } })
      await useProfile.getState().refresh()
      navigate(`/classes/${res.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t create the class.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-3xl border border-line bg-panel-2/50 p-4">
      <h2 className="mb-1 text-[14px] font-semibold">Create a class</h2>
      <p className="mb-3 text-[12.5px] text-mute">You’ll get a join code to share with your students.</p>
      <div className="flex gap-2">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. 500L Farm Power, first semester" aria-label="Class name" />
        <button className={primaryBtn} disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>
      {error ? <div className="mt-3"><Notice tone="warn">{error}</Notice></div> : null}
    </form>
  )
}

function ClassList({ classes }: { classes: ClassRef[] }) {
  if (!classes.length) return <p className="text-[13px] text-mute">You’re not in any classes yet.</p>
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line">
      {classes.map((c) => (
        <li key={c.id}>
          <Link to={`/classes/${c.id}`} className="flex items-center justify-between gap-3 bg-panel-2/40 px-4 py-3 hover:bg-panel-3">
            <span className="text-[13.5px] font-medium text-ink">{c.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.role === 'teacher' ? 'bg-accent/15 text-accent' : 'bg-panel-3 text-mute'}`}>{c.role === 'teacher' ? 'Teaching' : 'Student'}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function ClassesPage() {
  const status = useAuth((s) => s.status)
  const profile = useProfile((s) => s.profile)
  const [classes, setClasses] = useState<ClassRef[] | null>(null)

  useEffect(() => {
    if (status !== 'signed-in') return
    api<{ classes: ClassRef[] }>('/v1/classes')
      .then((r) => setClasses(r.classes))
      .catch(() => setClasses(profile?.classes ?? []))
  }, [status, profile?.classes, profile?.role])

  const isTeacher = profile?.role === 'teacher'
  return (
    <StudyShell title="Classes" lead="Teachers set scenes, exam questions and challenges; students see what’s due and their progress syncs to the teacher automatically.">
      {status === 'loading' ? null : status !== 'signed-in' ? (
        <SignInFirst what="join or create a class" />
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_340px]">
          <section>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">Your classes</h2>
            {classes ? <ClassList classes={classes} /> : <p className="text-[13px] text-mute">Loading…</p>}
          </section>
          <aside className="space-y-4">
            {isTeacher ? <CreateForm /> : null}
            <JoinForm />
            {!isTeacher ? <p className="text-[12px] text-dim">Teaching? Turn on “I’m a teacher” in your account menu to create classes.</p> : null}
          </aside>
        </div>
      )}
    </StudyShell>
  )
}
