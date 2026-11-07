import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useProfile } from '../profile'
import { syncNow, useSync } from '../sync'
import { useReport } from './ReportDialog'

function ago(t: number) {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return `${Math.round(s / 3600)} h ago`
}

function SyncLine() {
  const { status, last, error } = useSync()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])
  if (status === 'syncing') return <span className="text-mute">Saving progress…</span>
  if (status === 'error')
    return (
      <span className="text-warn" title={error ?? undefined}>
        Couldn’t save progress.{' '}
        <button className="underline" onClick={() => void syncNow()}>
          Retry
        </button>
      </span>
    )
  if (status === 'synced' && last) return <span className="text-mute">Progress saved {ago(last)}</span>
  return null
}

/** Header control: "Sign in", or the account menu once signed in. */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  const profile = useProfile((s) => s.profile)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  if (status === 'loading') return <span className="h-7 w-7 animate-pulse rounded-full bg-panel-3" aria-hidden />
  if (status !== 'signed-in' || !user)
    return (
      <button onClick={() => useAuth.getState().openDialog()} className="shrink-0 whitespace-nowrap rounded-full border border-line-2 bg-panel-2 px-3 py-1 text-[12.5px] font-medium text-ink/90 transition-colors hover:border-accent/40 hover:text-accent">
        Sign in
      </button>
    )

  const name = profile?.displayName ?? user.name ?? user.email?.split('@')[0] ?? 'You'
  const isTeacher = profile?.role === 'teacher'
  const setRole = async (role: 'student' | 'teacher') => {
    setBusy(true)
    try {
      useProfile.getState().set(await api('/v1/me', { method: 'PATCH', body: { role } }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-1.5 rounded-full p-0.5 hover:ring-2 hover:ring-accent/30" title={name}>
        {user.photo ? (
          <img src={user.photo} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/20 text-[12px] font-semibold text-accent">{name.slice(0, 1).toUpperCase()}</span>
        )}
        {compact ? null : <span className="hidden max-w-[10ch] truncate text-[12.5px] text-ink/90 lg:inline">{name}</span>}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-[90] w-64 overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl">
          <div className="border-b border-line px-3.5 py-3">
            <div className="truncate text-[13px] font-semibold text-ink">{name}</div>
            <div className="truncate text-[12px] text-mute">{user.email}</div>
            <div className="mt-1.5 text-[11.5px]">
              <SyncLine />
            </div>
          </div>
          <div className="py-1 text-[13px]">
            <Link to="/create/lab" onClick={() => setOpen(false)} className="block px-3.5 py-2 text-ink/90 hover:bg-panel-3">
              My models
            </Link>
            <Link to="/classes" onClick={() => setOpen(false)} className="block px-3.5 py-2 text-ink/90 hover:bg-panel-3">
              {isTeacher ? 'My classes' : 'Classes'}
            </Link>
            {profile?.isAdmin ? (
              <Link to="/admin" onClick={() => setOpen(false)} className="block px-3.5 py-2 text-ink/90 hover:bg-panel-3">
                Admin
              </Link>
            ) : null}
            <button
              onClick={() => {
                setOpen(false)
                useReport.getState().open({})
              }}
              className="block w-full px-3.5 py-2 text-left text-ink/90 hover:bg-panel-3"
            >
              Report a problem
            </button>
          </div>
          <div className="border-t border-line px-3.5 py-2.5">
            <label className="flex items-center justify-between gap-3 text-[12.5px] text-ink/90">
              <span>
                I’m a teacher
                <span className="block text-[11px] text-dim">Create classes and set work</span>
              </span>
              <button
                role="switch"
                aria-checked={isTeacher}
                disabled={busy || !profile}
                onClick={() => void setRole(isTeacher ? 'student' : 'teacher')}
                className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors disabled:opacity-50 ${isTeacher ? 'bg-accent' : 'bg-line-2'}`}
              >
                <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-ink transition-all ${isTeacher ? 'left-[16px]' : 'left-[2px]'}`} />
              </button>
            </label>
          </div>
          <button
            onClick={() => {
              setOpen(false)
              void useAuth.getState().signOut()
            }}
            className="block w-full border-t border-line px-3.5 py-2.5 text-left text-[13px] text-mute hover:bg-panel-3 hover:text-ink"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
