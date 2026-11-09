import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useProgress } from '@/study/progress'
import { COURSES, courseTitle } from '@/study/types'
import { StudyShell } from '@/study/ui/StudyShell'
import { CardGridSkeleton, ListSkeleton } from '@/ui/Skeleton'
import { toast } from '@/ui/toast'
import { api, ApiError, download } from '../api'
import { useAuth } from '../auth'
import {
  KIND_LABEL,
  assignableChallenges,
  assignableModels,
  assignableQuestions,
  assignableScenes,
  assignmentRoute,
  assignmentStatus,
  isResource,
  type Assignable,
  type Assignment,
  type AssignmentKind,
  type AssignmentResult,
} from '../assignments'
import { useProfile } from '../profile'
import { ClassReport } from './ClassReport'
import { StudentPapers, TeacherPapers, useClassPapers } from './ClassPapers'
import { SignInFirst } from './ClassesPage'
import { Field, Modal, Notice, ghostBtn, inputCls, primaryBtn } from './Modal'

interface ClassInfo {
  id: string
  name: string
  teacherName: string
  about?: string
  subjects: string[]
  code?: string
  isTeacher: boolean
  members?: { uid: string; displayName: string; joinedAt: number }[]
}

interface Dashboard {
  assignments: Assignment[]
  students: { uid: string; displayName: string; completed: number; results: AssignmentResult[] }[]
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
/** a date input's value, as the end of that day */
const endOfDay = (v: string) => (v ? new Date(`${v}T23:59:00`).getTime() : undefined)
const dateValue = (t?: number) => {
  if (!t) return ''
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const errText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback)
const smallBtn = 'rounded-full px-3 py-1.5 text-[12.5px] font-medium'

function Due({ due, complete }: { due?: number; complete?: boolean }) {
  if (!due) return null
  const late = !complete && due < Date.now()
  return (
    <span className={`text-[11.5px] ${late ? 'font-medium text-warn' : 'text-dim'}`}>
      {late ? 'Overdue · ' : 'Due '}
      {fmtDate(due)}
    </span>
  )
}

function StatusPill({ r }: { r: AssignmentResult }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${r.complete ? 'bg-accent/15 text-accent' : r.label === 'Not started' ? 'bg-panel-3 text-dim' : 'bg-info/15 text-info'}`}>{r.label}</span>
}

function KindChip({ kind }: { kind: AssignmentKind }) {
  return <span className="text-[10.5px] font-semibold uppercase tracking-wider text-dim">{KIND_LABEL[kind]}</span>
}

function Bar({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** A yes/no dialog for things that can't be undone. */
function Confirm({ open, title, body, action, danger, onClose, onConfirm }: { open: boolean; title: string; body: ReactNode; action: string; danger?: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title} width={420}>
      <div className="text-[13px] leading-relaxed text-mute">{body}</div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className={ghostBtn}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void onConfirm().finally(() => setBusy(false))
          }}
          className={`${primaryBtn} ${danger ? 'bg-warn! text-white!' : ''}`}
        >
          {busy ? 'Working…' : action}
        </button>
      </div>
    </Modal>
  )
}

function Leaderboard({ classId, a }: { classId: string; a: Assignment }) {
  const [rows, setRows] = useState<{ rank: number; displayName: string; best: number; you: boolean }[] | null>(null)
  useEffect(() => {
    api<{ entries: { rank: number; displayName: string; best: number; you: boolean }[] }>(`/v1/classes/${classId}/leaderboard?challenge=${encodeURIComponent(a.ref)}${a.better ? `&better=${a.better}` : ''}`)
      .then((r) => setRows(Array.isArray(r?.entries) ? r.entries : []))
      .catch(() => setRows([]))
  }, [classId, a.ref, a.better])
  if (!rows) return null
  if (!rows.length) return <p className="mt-2 text-[12px] text-dim">No scores yet. Be the first.</p>
  return (
    <ol className="mt-2 space-y-0.5 text-[12.5px]">
      {rows.slice(0, 10).map((r) => (
        <li key={r.rank} className={`flex justify-between rounded px-2 py-0.5 ${r.you ? 'bg-accent/10 text-accent' : 'text-ink/85'}`}>
          <span>
            {r.rank}. {r.displayName}
            {r.you ? ' (you)' : ''}
          </span>
          <span className="font-mono">{Number(r.best.toPrecision(4))}</span>
        </li>
      ))}
    </ol>
  )
}

/* ---------------------------------------------------------------- student view */

function WorkCard({ info, a, r, onDone }: { info: ClassInfo; a: Assignment; r: AssignmentResult; onDone: (a: Assignment, done: boolean) => Promise<void> }) {
  const [board, setBoard] = useState(false)
  const [busy, setBusy] = useState(false)
  const route = assignmentRoute(a)
  const outside = a.kind === 'link'
  const toggle = async () => {
    setBusy(true)
    await onDone(a, !a.doneAt).finally(() => setBusy(false))
  }
  return (
    <li className={`rounded-2xl border px-4 py-3 ${r.complete ? 'border-line bg-panel-2/30' : 'border-line-2 bg-panel'}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <KindChip kind={a.kind} />
          <div className={`text-[14px] font-medium ${r.complete ? 'text-ink/70' : 'text-ink'}`}>{a.title}</div>
          <Due due={a.due} complete={r.complete} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isResource(a.kind) ? null : <StatusPill r={r} />}
          {route ? (
            outside ? (
              <a href={route} target="_blank" rel="noopener noreferrer" className={`${smallBtn} border border-line-2 text-ink hover:border-ink/40`}>
                Open link ↗
              </a>
            ) : (
              <Link to={route} className={`${smallBtn} ${r.complete ? 'border border-line-2 text-ink hover:border-ink/40' : 'bg-accent text-accent-ink hover:opacity-90'}`}>
                {r.complete ? 'Open' : 'Start'}
              </Link>
            )
          ) : null}
          {isResource(a.kind) ? (
            <button type="button" disabled={busy} onClick={() => void toggle()} aria-pressed={!!a.doneAt} className={`${smallBtn} ${a.doneAt ? 'bg-accent/15 text-accent' : 'border border-line-2 text-ink hover:border-ink/40'}`}>
              {a.doneAt ? '✓ Done' : 'Mark done'}
            </button>
          ) : null}
          {a.kind === 'challenge' ? (
            <button type="button" className="text-[12px] text-accent hover:underline" onClick={() => setBoard((b) => !b)}>
              {board ? 'Hide scores' : 'Class scores'}
            </button>
          ) : null}
        </div>
      </div>
      {a.note ? <p className={`mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed ${a.kind === 'note' ? 'text-ink/85' : 'text-mute'}`}>{a.note}</p> : null}
      {board ? <Leaderboard classId={info.id} a={a} /> : null}
    </li>
  )
}

function StudentView({ info, assignments, setAssignments }: { info: ClassInfo; assignments: Assignment[]; setAssignments: (a: Assignment[]) => void }) {
  const navigate = useNavigate()
  const progress = useProgress()
  const [showDone, setShowDone] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const rows = assignments.map((a) => ({ a, r: assignmentStatus(a, progress) }))
  const todo = rows.filter((x) => !x.r.complete).sort((x, y) => (x.a.due ?? Infinity) - (y.a.due ?? Infinity))
  const done = rows.filter((x) => x.r.complete)
  const overdue = todo.filter((x) => x.a.due && x.a.due < Date.now()).length
  const next = todo.find((x) => x.a.due && x.a.due >= Date.now())

  const markDone = async (a: Assignment, on: boolean) => {
    try {
      const r = await api<{ at: number | null }>(`/v1/classes/${info.id}/assignments/${a.id}/done`, { method: 'PUT', body: { done: on } })
      setAssignments(assignments.map((x) => (x.id === a.id ? { ...x, doneAt: r.at ?? undefined } : x)))
    } catch (e) {
      toast(errText(e, 'Couldn’t save that. Check your connection.'), { tone: 'warn' })
    }
  }
  const leave = async () => {
    const uid = useAuth.getState().user?.uid
    await api(`/v1/classes/${info.id}/members/${uid}`, { method: 'DELETE' })
    await useProfile.getState().refresh()
    navigate('/classes')
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl border border-line bg-panel p-3 sm:p-4">
          <div className="text-[11.5px] font-medium text-mute">Done</div>
          <div className="mt-0.5 text-[20px] font-semibold text-ink sm:text-[24px]">
            {done.length}
            <span className="text-[13px] font-medium text-mute sm:text-[15px]"> of {rows.length}</span>
          </div>
          <div className="mt-2">
            <Bar value={done.length} total={rows.length} />
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-panel p-3 sm:p-4">
          <div className="text-[11.5px] font-medium text-mute">Next due</div>
          {next ? (
            <>
              <div className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-ink sm:text-[14px]">{next.a.title}</div>
              <div className="text-[12px] text-mute">{fmtDate(next.a.due!)}</div>
            </>
          ) : (
            <div className="mt-1 text-[12.5px] text-dim">Nothing dated</div>
          )}
        </div>
        <div className={`rounded-2xl border p-3 sm:p-4 ${overdue ? 'border-warn/40 bg-warn/10' : 'border-line bg-panel'}`}>
          <div className="text-[11.5px] font-medium text-mute">Overdue</div>
          <div className={`mt-0.5 text-[20px] font-semibold sm:text-[24px] ${overdue ? 'text-warn' : 'text-ink'}`}>{overdue}</div>
        </div>
      </div>

      <StudentPapers classId={info.id} />

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">To do</h2>
        {!rows.length ? (
          <Notice>Nothing set yet. Work from {info.teacherName} will appear here.</Notice>
        ) : !todo.length ? (
          <Notice tone="ok">All done. Well done.</Notice>
        ) : (
          <ul className="space-y-2">
            {todo.map(({ a, r }) => (
              <WorkCard key={a.id} info={info} a={a} r={r} onDone={markDone} />
            ))}
          </ul>
        )}
      </section>

      {done.length ? (
        <section>
          <button type="button" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone} className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute hover:text-ink">
            Done ({done.length}) {showDone ? '▴' : '▾'}
          </button>
          {showDone ? (
            <ul className="space-y-2">
              {done.map(({ a, r }) => (
                <WorkCard key={a.id} info={info} a={a} r={r} onDone={markDone} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <button type="button" onClick={() => setLeaving(true)} className="text-[12px] text-dim hover:text-warn">
        Leave this class
      </button>
      <Confirm open={leaving} title="Leave this class?" body={`You stop seeing ${info.name}’s work. Your own progress stays yours; you can join again with the code.`} action="Leave" danger onClose={() => setLeaving(false)} onConfirm={leave} />
    </div>
  )
}

/* ---------------------------------------------------------------- teacher: setting work */

type Source = 'scene' | 'question' | 'challenge' | 'model' | 'link' | 'note'
const SOURCES: { id: Source; label: string }[] = [
  { id: 'scene', label: 'Lab rigs' },
  { id: 'question', label: 'Exam questions' },
  { id: 'challenge', label: 'Challenges' },
  { id: 'model', label: 'Library models' },
  { id: 'link', label: 'A link' },
  { id: 'note', label: 'A note' },
]

interface Pick {
  key: string
  kind: AssignmentKind
  ref: string
  title: string
  better?: 'higher' | 'lower'
  note?: string
}

/**
 * Set work: tick any number of rigs, questions, challenges and library models (narrowed to the class's
 * subjects), add links and notes, then give them all one due date and instructions.
 */
function SetWorkDialog({ info, open, onClose, onSet }: { info: ClassInfo; open: boolean; onClose: () => void; onSet: () => void }) {
  const [source, setSource] = useState<Source>('scene')
  const [subject, setSubject] = useState<string>(info.subjects.length ? 'class' : 'all')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Pick[]>([])
  const [challenges, setChallenges] = useState<Assignable[] | null>(null)
  const [models, setModels] = useState<Assignable[] | null>(null)
  const [due, setDue] = useState('')
  const [instructions, setInstructions] = useState('')
  const [link, setLink] = useState({ url: '', title: '' })
  const [note, setNote] = useState({ title: '', text: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (source === 'challenge' && !challenges) void assignableChallenges().then(setChallenges)
    if (source === 'model' && !models) void assignableModels().then(setModels).catch(() => setModels([]))
  }, [open, source, challenges, models])

  const options = useMemo<Assignable[] | null>(() => {
    if (source === 'scene') return assignableScenes()
    if (source === 'question') return assignableQuestions()
    if (source === 'challenge') return challenges
    if (source === 'model') return models
    return []
  }, [source, challenges, models])

  const shown = useMemo(() => {
    if (!options) return null
    const q = query.trim().toLowerCase()
    const subj = subject === 'class' ? info.subjects : subject === 'all' ? null : [subject]
    return options.filter((o) => (!subj || !o.subjects.length || o.subjects.some((s) => subj.includes(s))) && (!q || `${o.title} ${o.group}`.toLowerCase().includes(q)))
  }, [options, query, subject, info.subjects])
  const groups = useMemo(() => {
    const m = new Map<string, Assignable[]>()
    for (const o of (shown ?? []).slice(0, 200)) m.set(o.group, [...(m.get(o.group) ?? []), o])
    return [...m]
  }, [shown])

  const keyOf = (o: { kind: string; ref: string }) => `${o.kind}:${o.ref}`
  const isPicked = (o: Assignable) => picked.some((p) => p.key === keyOf(o))
  const toggle = (o: Assignable) => setPicked((ps) => (ps.some((p) => p.key === keyOf(o)) ? ps.filter((p) => p.key !== keyOf(o)) : [...ps, { key: keyOf(o), kind: o.kind, ref: o.ref, title: o.title, better: o.better }]))
  const allShownPicked = !!shown?.length && shown.slice(0, 200).every(isPicked)
  const pickAllShown = () => {
    const list = (shown ?? []).slice(0, 200)
    if (allShownPicked) setPicked((ps) => ps.filter((p) => !list.some((o) => keyOf(o) === p.key)))
    else setPicked((ps) => [...ps, ...list.filter((o) => !ps.some((p) => p.key === keyOf(o))).map((o) => ({ key: keyOf(o), kind: o.kind, ref: o.ref, title: o.title, better: o.better }))])
  }

  const linkOk = /^https?:\/\/\S+\.\S+/i.test(link.url.trim())
  const addLink = () => {
    const url = link.url.trim()
    let title = link.title.trim()
    if (!title) {
      try {
        title = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        title = url
      }
    }
    setPicked((ps) => [...ps, { key: `link:${url}:${Date.now()}`, kind: 'link', ref: url, title: title.slice(0, 160) }])
    setLink({ url: '', title: '' })
  }
  const addNote = () => {
    setPicked((ps) => [...ps, { key: `note:${Date.now()}`, kind: 'note', ref: 'note', title: note.title.trim().slice(0, 160), note: note.text.trim() }])
    setNote({ title: '', text: '' })
  }

  const reset = () => {
    setPicked([])
    setDue('')
    setInstructions('')
    setQuery('')
    setError(null)
  }
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const dueMs = endOfDay(due)
      const extra = instructions.trim()
      await api(`/v1/classes/${info.id}/assignments/batch`, {
        body: {
          items: picked.map((p) => ({
            kind: p.kind,
            ref: p.ref,
            title: p.title,
            ...(dueMs ? { due: dueMs } : {}),
            ...(p.better ? { better: p.better } : {}),
            // a note keeps its own text; anything else carries the shared instructions
            ...(p.kind === 'note' ? { note: [p.note, extra].filter(Boolean).join('\n\n') } : extra ? { note: extra } : {}),
          })),
        },
      })
      toast(`${picked.length} piece${picked.length === 1 ? '' : 's'} of work set.`)
      reset()
      onSet()
      onClose()
    } catch (e) {
      setError(errText(e, 'Couldn’t set the work.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Set work" width={720}>
      <div role="tablist" aria-label="What to set" className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-none">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={source === s.id}
            onClick={() => {
              setSource(s.id)
              setQuery('')
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium ${source === s.id ? 'bg-ink text-bg' : 'border border-line-2 text-mute hover:text-ink'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {source === 'link' ? (
        <div className="space-y-2 rounded-2xl border border-line p-3">
          <p className="text-[12.5px] text-mute">A reading, a video or a handout anywhere on the web. Students open it and mark it done.</p>
          <input className={inputCls} value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://…" aria-label="Address" inputMode="url" />
          <input className={inputCls} value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} maxLength={160} placeholder="What it is, e.g. Chapter 4: belt drives (PDF)" aria-label="Title" />
          <div className="flex justify-end">
            <button type="button" disabled={!linkOk} onClick={addLink} className={`${ghostBtn} px-4 py-2 text-[12.5px]`}>
              Add to the list
            </button>
          </div>
        </div>
      ) : source === 'note' ? (
        <div className="space-y-2 rounded-2xl border border-line p-3">
          <p className="text-[12.5px] text-mute">A message or a task in words: what to read, what to bring, what to prepare. Students mark it done.</p>
          <input className={inputCls} value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} maxLength={160} placeholder="Title, e.g. Prepare for Thursday’s practical" aria-label="Title" />
          <textarea className={`${inputCls} min-h-24`} value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} maxLength={2000} placeholder="What to do" aria-label="Text" />
          <div className="flex justify-end">
            <button type="button" disabled={!note.title.trim() || !note.text.trim()} onClick={addNote} className={`${ghostBtn} px-4 py-2 text-[12.5px]`}>
              Add to the list
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={`${inputCls} flex-1`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search" />
            {source !== 'model' ? (
              <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" className={`${inputCls} sm:w-56`}>
                {info.subjects.length ? <option value="class">This class’s subjects</option> : null}
                <option value="all">All subjects</option>
                {COURSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between px-1 text-[12px] text-mute">
            <span>{shown ? `${shown.length} to choose from` : 'Loading…'}</span>
            {shown?.length ? (
              <button type="button" onClick={pickAllShown} className="font-medium text-accent hover:underline">
                {allShownPicked ? 'Untick these' : `Tick all ${Math.min(shown.length, 200)}`}
              </button>
            ) : null}
          </div>
          <div className="mt-1 max-h-[42vh] overflow-y-auto rounded-2xl border border-line">
            {!shown ? (
              <div className="p-3">
                <ListSkeleton rows={4} />
              </div>
            ) : !shown.length ? (
              <p className="px-3 py-4 text-[12.5px] text-dim">Nothing matches. Try All subjects, or another search.</p>
            ) : (
              groups.map(([g, list]) => (
                <div key={g}>
                  <div className="sticky top-0 z-[1] border-b border-line bg-panel-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-dim">{g}</div>
                  {list.map((o) => (
                    <label key={o.ref} className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] ${isPicked(o) ? 'bg-accent/10 text-ink' : 'text-ink/90 hover:bg-panel-2'}`}>
                      <input type="checkbox" checked={isPicked(o)} onChange={() => toggle(o)} className="h-4 w-4 shrink-0 accent-[var(--color-accent)]" />
                      {o.thumbnail ? <img src={o.thumbnail} alt="" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain" /> : null}
                      <span className="min-w-0 flex-1">{o.title}</span>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* everything chosen so far, from every tab */}
      <div className="mt-4 rounded-2xl border border-line-2 bg-panel-2/50 p-3">
        <div className="mb-2 text-[12.5px] font-semibold text-ink">{picked.length ? `${picked.length} chosen` : 'Nothing chosen yet'}</div>
        {picked.length ? (
          <ul className="mb-3 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {picked.map((p) => (
              <li key={p.key} className="flex items-center gap-1 rounded-full border border-line-2 bg-panel py-0.5 pl-2.5 pr-1 text-[12px] text-ink">
                <span className="max-w-[16rem] truncate">{p.title}</span>
                <button type="button" aria-label={`Remove ${p.title}`} onClick={() => setPicked((ps) => ps.filter((x) => x.key !== p.key))} className="grid h-5 w-5 place-items-center rounded-full text-mute hover:bg-panel-3 hover:text-ink">
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <Field label="Due (optional)">
            <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Instructions for all of it (optional)">
            <input className={inputCls} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={600} placeholder="e.g. Run each rig's test and note the readings" />
          </Field>
        </div>
        {error ? <Notice tone="warn">{error}</Notice> : null}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" disabled={busy || !picked.length} onClick={() => void submit()} className={primaryBtn}>
            {busy ? 'Setting…' : picked.length > 1 ? `Set ${picked.length} pieces of work` : 'Set work'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function EditWorkDialog({ info, a, onClose, onSaved }: { info: ClassInfo; a: Assignment | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!a) return
    setTitle(a.title)
    setDue(dateValue(a.due))
    setNote(a.note ?? '')
  }, [a])
  const save = async () => {
    if (!a) return
    setBusy(true)
    try {
      await api(`/v1/classes/${info.id}/assignments/${a.id}`, { method: 'PATCH', body: { title: title.trim(), due: endOfDay(due) ?? null, note: note.trim() } })
      onSaved()
      onClose()
    } catch (e) {
      toast(errText(e, 'Couldn’t save the change.'), { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={!!a} onClose={() => !busy && onClose()} title="Edit work" width={480}>
      <Field label="Title">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
      </Field>
      <Field label="Due">
        <div className="flex gap-2">
          <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
          {due ? (
            <button type="button" onClick={() => setDue('')} className={`${ghostBtn} px-3`}>
              No date
            </button>
          ) : null}
        </div>
      </Field>
      <Field label={a?.kind === 'note' ? 'Text' : 'Instructions'}>
        <textarea className={`${inputCls} min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className={ghostBtn}>
          Cancel
        </button>
        <button type="button" disabled={busy || !title.trim() || (a?.kind === 'note' && !note.trim())} onClick={() => void save()} className={primaryBtn}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- teacher tabs */

function WorkTab({ info, assignments, dash, reload }: { info: ClassInfo; assignments: Assignment[]; dash: Dashboard | null; reload: () => void }) {
  const [setting, setSetting] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [removing, setRemoving] = useState<Assignment | null>(null)
  const students = dash?.students.length ?? 0
  const doneCount = (a: Assignment) => {
    const i = dash?.assignments.findIndex((x) => x.id === a.id) ?? -1
    return i < 0 ? 0 : (dash?.students ?? []).filter((s) => s.results[i]?.complete).length
  }
  const now = Date.now()
  const groups: [string, Assignment[]][] = [
    ['Overdue', assignments.filter((a) => a.due && a.due < now)],
    ['Coming up', assignments.filter((a) => a.due && a.due >= now)],
    ['No due date', assignments.filter((a) => !a.due)],
  ]
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-mute">{assignments.length ? `${assignments.length} piece${assignments.length === 1 ? '' : 's'} of work set` : 'Nothing set yet.'}</p>
        <button type="button" onClick={() => setSetting(true)} className={primaryBtn}>
          + Set work
        </button>
      </div>
      {!assignments.length ? (
        <div className="rounded-3xl border border-dashed border-line-2 p-6 text-center text-[13px] text-mute">
          Set lab rigs, exam questions, challenges, library models, links or notes: tick as many as you like and give them one due date.
        </div>
      ) : (
        groups
          .filter(([, list]) => list.length)
          .map(([label, list]) => (
            <section key={label}>
              <h3 className={`mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] ${label === 'Overdue' ? 'text-warn' : 'text-mute'}`}>{label}</h3>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {list.map((a) => {
                  const n = doneCount(a)
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-panel px-4 py-3">
                      <div className="min-w-0 flex-1 basis-56">
                        <KindChip kind={a.kind} />
                        <div className="truncate text-[13.5px] font-medium text-ink">{a.title}</div>
                        <div className="flex flex-wrap gap-x-2">
                          <Due due={a.due} complete />
                          {a.note ? <span className="max-w-[28rem] truncate text-[11.5px] text-dim">{a.due ? '· ' : ''}{a.note}</span> : null}
                        </div>
                      </div>
                      <div className="w-36">
                        <div className="mb-1 text-[11.5px] text-mute">{dash ? `${n} of ${students} done` : '…'}</div>
                        <Bar value={n} total={students} />
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setEditing(a)} className={`${smallBtn} text-mute hover:bg-panel-2 hover:text-ink`}>
                          Edit
                        </button>
                        <button type="button" onClick={() => setRemoving(a)} className={`${smallBtn} text-mute hover:bg-warn/10 hover:text-warn`}>
                          Remove
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
      )}

      <section>
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">Papers</h3>
        <TeacherPapers classId={info.id} />
      </section>

      <SetWorkDialog info={info} open={setting} onClose={() => setSetting(false)} onSet={reload} />
      <EditWorkDialog info={info} a={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <Confirm
        open={!!removing}
        title="Remove this work?"
        body={`“${removing?.title}” leaves every student’s list. What they have already done stays in their own progress.`}
        action="Remove"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          await api(`/v1/classes/${info.id}/assignments/${removing!.id}`, { method: 'DELETE' })
          setRemoving(null)
          reload()
        }}
      />
    </div>
  )
}

function JoinPanel({ info, onCode }: { info: ClassInfo; onCode: (code: string) => void }) {
  const [copied, setCopied] = useState<'code' | 'invite' | null>(null)
  const [renewing, setRenewing] = useState(false)
  const copy = (what: 'code' | 'invite') => {
    const text = what === 'code' ? (info.code ?? '') : `Join my class “${info.name}” on Solidify: sign in at ${location.origin}/#/classes and enter the code ${info.code}.`
    void navigator.clipboard?.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(null), 1500)
  }
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-dim">Join code</div>
        <div className="font-mono text-[26px] font-semibold tracking-[0.25em] text-accent">{info.code}</div>
      </div>
      <p className="min-w-0 flex-1 basis-48 text-[12.5px] text-mute">Students sign in, open Classes and enter this code.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy('code')} className={`${ghostBtn} px-4 py-2 text-[12.5px]`}>
          {copied === 'code' ? 'Copied' : 'Copy code'}
        </button>
        <button type="button" onClick={() => copy('invite')} className={`${ghostBtn} px-4 py-2 text-[12.5px]`}>
          {copied === 'invite' ? 'Copied' : 'Copy invitation'}
        </button>
        <button type="button" onClick={() => setRenewing(true)} className={`${smallBtn} text-mute hover:text-ink`}>
          New code
        </button>
      </div>
      <Confirm
        open={renewing}
        title="Give the class a new code?"
        body="The old code stops working at once (useful if it was shared too widely). Students already in the class stay in."
        action="New code"
        onClose={() => setRenewing(false)}
        onConfirm={async () => {
          try {
            const r = await api<{ code: string }>(`/v1/classes/${info.id}/code`, { method: 'POST', body: {} })
            onCode(r.code)
            setRenewing(false)
          } catch (e) {
            toast(errText(e, 'Couldn’t make a new code.'), { tone: 'warn' })
          }
        }}
      />
    </div>
  )
}

function StudentsTab({ info, dash, reload, onCode }: { info: ClassInfo; dash: Dashboard | null; reload: () => void; onCode: (code: string) => void }) {
  const [removing, setRemoving] = useState<{ uid: string; name: string } | null>(null)
  const [matrix, setMatrix] = useState(false)
  const joined = new Map((info.members ?? []).map((m) => [m.uid, m.joinedAt]))
  const total = dash?.assignments.length ?? 0
  const students = [...(dash?.students ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName))
  return (
    <div className="space-y-6">
      <JoinPanel info={info} onCode={onCode} />
      {!dash ? (
        <ListSkeleton rows={5} />
      ) : !students.length ? (
        <Notice>No students yet. Share the join code or the invitation above.</Notice>
      ) : (
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">{students.length} student{students.length === 1 ? '' : 's'}</h3>
            <div className="flex gap-3 text-[12.5px]">
              {total ? (
                <button type="button" onClick={() => setMatrix((m) => !m)} className="font-medium text-accent hover:underline">
                  {matrix ? 'Show the list' : 'Every piece of work'}
                </button>
              ) : null}
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => void download(`/v1/classes/${info.id}/dashboard.csv`, `${info.name}.csv`)}>
                Download CSV
              </button>
            </div>
          </div>
          {matrix ? (
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-panel-2 text-left text-mute">
                  <tr>
                    <th className="sticky left-0 bg-panel-2 px-3 py-2 font-medium">Student</th>
                    {dash.assignments.map((a) => (
                      <th key={a.id} className="max-w-[16ch] truncate px-3 py-2 font-medium" title={a.title}>
                        {a.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {students.map((s) => (
                    <tr key={s.uid}>
                      <td className="sticky left-0 whitespace-nowrap bg-panel px-3 py-2 text-ink">{s.displayName}</td>
                      {s.results.map((r, i) => (
                        <td key={i} className="px-3 py-2">
                          <StatusPill r={r} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {students.map((s) => (
                <li key={s.uid} className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-panel px-4 py-3">
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="truncate text-[13.5px] font-medium text-ink">{s.displayName}</div>
                    {joined.get(s.uid) ? <div className="text-[11.5px] text-dim">Joined {fmtDate(joined.get(s.uid)!)}</div> : null}
                  </div>
                  <div className="w-40">
                    <div className="mb-1 text-[11.5px] text-mute">
                      {s.completed} of {total} done
                    </div>
                    <Bar value={s.completed} total={total} />
                  </div>
                  <button type="button" onClick={() => setRemoving({ uid: s.uid, name: s.displayName })} className={`${smallBtn} text-mute hover:bg-warn/10 hover:text-warn`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <Confirm
        open={!!removing}
        title={`Remove ${removing?.name}?`}
        body="They leave the class and stop seeing its work. Their own progress stays theirs; they can join again with the code."
        action="Remove"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          await api(`/v1/classes/${info.id}/members/${removing!.uid}`, { method: 'DELETE' })
          setRemoving(null)
          reload()
        }}
      />
    </div>
  )
}

function SettingsTab({ info, onSaved }: { info: ClassInfo; onSaved: (patch: Partial<ClassInfo>) => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState(info.name)
  const [about, setAbout] = useState(info.about ?? '')
  const [subjects, setSubjects] = useState<string[]>(info.subjects)
  const [busy, setBusy] = useState(false)
  const [closing, setClosing] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const changed = name.trim() !== info.name || about.trim() !== (info.about ?? '') || subjects.join() !== info.subjects.join()
  const save = async () => {
    setBusy(true)
    try {
      const r = await api<{ name: string; about?: string; subjects: string[] }>(`/v1/classes/${info.id}`, { method: 'PUT', body: { name: name.trim(), about: about.trim(), subjects } })
      onSaved(r)
      await useProfile.getState().refresh()
      toast('Saved.')
    } catch (e) {
      toast(errText(e, 'Couldn’t save.'), { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-1">
        <Field label="Class name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="About (students see this)">
          <textarea className={`${inputCls} min-h-20`} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={400} placeholder="e.g. Farm Power, first semester. Lectures Tuesdays 10am, practicals Thursdays." />
        </Field>
        <div className="mb-3">
          <span className="mb-1 block text-[12px] font-medium text-mute">Subjects (narrow the lists when you set work)</span>
          <div className="flex flex-wrap gap-1.5">
            {COURSES.map((c) => {
              const on = subjects.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSubjects((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] ${on ? 'border-accent bg-accent/10 font-medium text-ink' : 'border-line-2 text-mute hover:text-ink'}`}
                >
                  {on ? '✓ ' : ''}
                  {c.title}
                </button>
              )
            })}
          </div>
        </div>
        <button type="button" disabled={busy || !changed || !name.trim()} onClick={() => void save()} className={primaryBtn}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </section>

      <section className="rounded-2xl border border-warn/40 p-4">
        <h3 className="text-[13.5px] font-semibold text-ink">Close this class</h3>
        <p className="mt-1 text-[12.5px] text-mute">It disappears for you and every student, with its work and papers. Students keep their own progress. This can’t be undone.</p>
        <button type="button" onClick={() => setClosing(true)} className={`${ghostBtn} mt-3 border-warn/50 text-warn`}>
          Close the class…
        </button>
      </section>
      <Confirm
        open={closing}
        title="Close this class for good?"
        body={
          <>
            <p>Type the class name to confirm: <span className="font-medium text-ink">{info.name}</span></p>
            <input className={`${inputCls} mt-2`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} aria-label="Class name" />
          </>
        }
        action="Close the class"
        danger
        onClose={() => setClosing(false)}
        onConfirm={async () => {
          if (confirmName.trim() !== info.name) {
            toast('The name doesn’t match.', { tone: 'warn' })
            return
          }
          await api(`/v1/classes/${info.id}`, { method: 'DELETE' })
          await useProfile.getState().refresh()
          navigate('/classes')
        }}
      />
    </div>
  )
}

const TABS = [
  { id: 'work', label: 'Work' },
  { id: 'students', label: 'Students' },
  { id: 'report', label: 'Report' },
  { id: 'settings', label: 'Settings' },
] as const
type Tab = (typeof TABS)[number]['id']

function TeacherView({ info, setInfo, assignments, reload }: { info: ClassInfo; setInfo: (i: ClassInfo) => void; assignments: Assignment[]; reload: () => void }) {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'work') as Tab
  const { papers } = useClassPapers(info.id)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const loadDash = useCallback(() => {
    api<Dashboard>(`/v1/classes/${info.id}/dashboard`)
      .then((d) => setDash({ assignments: Array.isArray(d?.assignments) ? d.assignments : [], students: Array.isArray(d?.students) ? d.students : [] }))
      .catch(() => setDash({ assignments: [], students: [] }))
  }, [info.id])
  useEffect(loadDash, [loadDash, assignments])
  const students = dash?.students.length ?? info.members?.length ?? 0

  return (
    <div>
      <div role="tablist" aria-label="Class" className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 scrollbar-none sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'work' ? {} : { tab: t.id }, { replace: true })}
            className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[13.5px] font-medium ${tab === t.id ? 'border-accent text-ink' : 'border-transparent text-mute hover:text-ink'}`}
          >
            {t.label}
            {t.id === 'work' && assignments.length ? <span className="ml-1.5 text-[11.5px] text-dim">{assignments.length}</span> : null}
            {t.id === 'students' && students ? <span className="ml-1.5 text-[11.5px] text-dim">{students}</span> : null}
          </button>
        ))}
      </div>
      {tab === 'work' ? (
        <WorkTab info={info} assignments={assignments} dash={dash} reload={reload} />
      ) : tab === 'students' ? (
        <StudentsTab
          info={info}
          dash={dash}
          reload={() => {
            reload()
            loadDash()
          }}
          onCode={(code) => setInfo({ ...info, code })}
        />
      ) : tab === 'report' ? (
        <ClassReport classId={info.id} papers={papers} />
      ) : (
        <SettingsTab info={info} onSaved={(p) => setInfo({ ...info, ...p })} />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- page */

export default function ClassPage() {
  const { classId = '' } = useParams()
  const status = useAuth((s) => s.status)
  const [info, setInfo] = useState<ClassInfo | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (status !== 'signed-in') return
    Promise.all([api<ClassInfo>(`/v1/classes/${classId}`), api<{ assignments: Assignment[] }>(`/v1/classes/${classId}/assignments`)])
      .then(([i, a]) => {
        setInfo({ ...i, subjects: Array.isArray(i.subjects) ? i.subjects : [] })
        setAssignments(Array.isArray(a?.assignments) ? a.assignments : [])
        setError(null)
      })
      .catch((e) => setError(errText(e, 'Couldn’t load this class.')))
  }, [classId, status])
  useEffect(load, [load])

  const lead = info ? [info.isTeacher ? null : `Teacher: ${info.teacherName}`, info.about, info.subjects.length ? info.subjects.map(courseTitle).join(' · ') : null].filter(Boolean).join('  ·  ') : undefined
  return (
    <StudyShell
      title={info?.name ?? 'Class'}
      lead={lead}
      right={
        <Link to="/classes" className="text-[12.5px] text-accent hover:underline">
          All classes
        </Link>
      }
    >
      {status === 'loading' ? null : status !== 'signed-in' ? (
        <SignInFirst what="see this class" />
      ) : error ? (
        <Notice tone="warn">{error}</Notice>
      ) : !info ? (
        <CardGridSkeleton cards={4} />
      ) : info.isTeacher ? (
        <TeacherView info={info} setInfo={setInfo} assignments={assignments} reload={load} />
      ) : (
        <StudentView info={info} assignments={assignments} setAssignments={setAssignments} />
      )}
    </StudyShell>
  )
}
