import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useProgress } from '@/study/progress'
import { StudyShell } from '@/study/ui/StudyShell'
import { api, ApiError, download } from '../api'
import { useAuth } from '../auth'
import { assignableChallenges, assignableQuestions, assignableScenes, assignmentRoute, assignmentStatus, type Assignable, type Assignment, type AssignmentKind, type AssignmentResult } from '../assignments'
import { useProfile } from '../profile'
import { ClassReport } from './ClassReport'
import { StudentPapers, TeacherPapers, useClassPapers } from './ClassPapers'
import { SignInFirst } from './ClassesPage'
import { Notice, ghostBtn, inputCls, primaryBtn } from './Modal'

interface ClassInfo {
  id: string
  name: string
  teacherName: string
  code?: string
  isTeacher: boolean
  members?: { uid: string; displayName: string; joinedAt: number }[]
}

interface Dashboard {
  assignments: Assignment[]
  students: { uid: string; displayName: string; completed: number; results: AssignmentResult[] }[]
}

const KIND_LABEL: Record<AssignmentKind, string> = { scene: 'Scene', question: 'Exam question', challenge: 'Challenge' }
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function Due({ due, complete }: { due?: number; complete?: boolean }) {
  if (!due) return null
  const late = !complete && due < Date.now()
  return <span className={`text-[11.5px] ${late ? 'text-warn' : 'text-dim'}`}>{late ? 'Overdue · ' : 'Due '}{fmtDate(due)}</span>
}

function StatusPill({ r }: { r: AssignmentResult }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${r.complete ? 'bg-accent/15 text-accent' : r.label === 'Not started' ? 'bg-panel-3 text-dim' : 'bg-info/15 text-info'}`}>{r.label}</span>
}

function Leaderboard({ classId, a }: { classId: string; a: Assignment }) {
  const [rows, setRows] = useState<{ rank: number; displayName: string; best: number; you: boolean }[] | null>(null)
  useEffect(() => {
    api<{ entries: { rank: number; displayName: string; best: number; you: boolean }[] }>(`/v1/classes/${classId}/leaderboard?challenge=${encodeURIComponent(a.ref)}${a.better ? `&better=${a.better}` : ''}`)
      .then((r) => setRows(r.entries))
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

function StudentView({ info, assignments }: { info: ClassInfo; assignments: Assignment[] }) {
  const navigate = useNavigate()
  const progress = useProgress()
  const [open, setOpen] = useState<string | null>(null)
  const leave = async () => {
    if (!window.confirm(`Leave ${info.name}?`)) return
    const uid = useAuth.getState().user?.uid
    await api(`/v1/classes/${info.id}/members/${uid}`, { method: 'DELETE' })
    await useProfile.getState().refresh()
    navigate('/classes')
  }
  const done = assignments.filter((a) => assignmentStatus(a, progress).complete).length
  return (
    <>
      <p className="mb-4 text-[13px] text-mute">
        Teacher: <span className="text-ink">{info.teacherName}</span> · {done}/{assignments.length} done
      </p>
      <StudentPapers classId={info.id} />
      {assignments.length ? <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">Assignments</h2> : null}
      {!assignments.length ? (
        <Notice>Nothing set yet. Assignments from your teacher will appear here.</Notice>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => {
            const r = assignmentStatus(a, progress)
            const route = assignmentRoute(a)
            return (
              <li key={a.id} className="rounded-xl border border-line bg-panel-2/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-dim">{KIND_LABEL[a.kind]}</div>
                    <div className="text-[14px] font-medium text-ink">{a.title}</div>
                    <Due due={a.due} complete={r.complete} />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill r={r} />
                    {route ? (
                      <Link to={route} className={ghostBtn}>
                        {r.complete ? 'Open' : 'Start'}
                      </Link>
                    ) : null}
                    {a.kind === 'challenge' ? (
                      <button className="text-[12px] text-accent hover:underline" onClick={() => setOpen(open === a.id ? null : a.id)}>
                        {open === a.id ? 'Hide' : 'Leaderboard'}
                      </button>
                    ) : null}
                  </div>
                </div>
                {open === a.id ? <Leaderboard classId={info.id} a={a} /> : null}
              </li>
            )
          })}
        </ul>
      )}
      <button onClick={() => void leave()} className="mt-6 text-[12px] text-dim hover:text-warn">
        Leave this class
      </button>
    </>
  )
}

/* ---------------------------------------------------------------- teacher view */

function AssignForm({ classId, onAdded }: { classId: string; onAdded: () => void }) {
  const [kind, setKind] = useState<AssignmentKind>('scene')
  const [challenges, setChallenges] = useState<Assignable[]>([])
  const [query, setQuery] = useState('')
  const [pick, setPick] = useState<Assignable | null>(null)
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void assignableChallenges().then(setChallenges)
  }, [])
  const options = useMemo(() => (kind === 'scene' ? assignableScenes() : kind === 'question' ? assignableQuestions() : challenges), [kind, challenges])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? options.filter((o) => `${o.title} ${o.group}`.toLowerCase().includes(q)) : options).slice(0, 60)
  }, [options, query])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!pick) return
    setBusy(true)
    setError(null)
    try {
      const dueMs = due ? new Date(`${due}T23:59:00`).getTime() : undefined
      await api(`/v1/classes/${classId}/assignments`, { body: { kind: pick.kind, ref: pick.ref, title: pick.title, due: dueMs, better: pick.better } })
      setPick(null)
      setQuery('')
      setDue('')
      onAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t add the assignment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-3xl border border-line bg-panel-2/50 p-4">
      <h3 className="mb-2 text-[13.5px] font-semibold">Set work</h3>
      <div role="radiogroup" aria-label="Kind" className="mb-2 flex gap-1">
        {(['scene', 'question', 'challenge'] as const).map((k) => (
          <button
            type="button"
            key={k}
            role="radio"
            aria-checked={kind === k}
            onClick={() => (setKind(k), setPick(null))}
            className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium ${kind === k ? 'bg-accent/15 text-accent' : 'text-mute hover:bg-panel-3 hover:text-ink'}`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${options.length} ${kind === 'question' ? 'questions' : `${kind}s`}…`} aria-label="Search" />
      <ul className="mt-2 max-h-56 overflow-y-auto rounded-md border border-line">
        {shown.map((o) => (
          <li key={o.ref}>
            <button
              type="button"
              onClick={() => setPick(o)}
              className={`block w-full px-3 py-1.5 text-left text-[12.5px] ${pick?.ref === o.ref ? 'bg-accent/15 text-accent' : 'text-ink/90 hover:bg-panel-3'}`}
            >
              {o.title}
              <span className="ml-1.5 text-[11px] text-dim">{o.group}</span>
            </button>
          </li>
        ))}
        {!shown.length ? <li className="px-3 py-2 text-[12px] text-dim">No matches</li> : null}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[12.5px] text-mute">
          Due
          <input type="date" className={`${inputCls} w-auto py-1`} value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <button className={`${primaryBtn} ml-auto`} disabled={!pick || busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error ? <div className="mt-2"><Notice tone="warn">{error}</Notice></div> : null}
    </form>
  )
}

function TeacherView({ info, assignments, reload }: { info: ClassInfo; assignments: Assignment[]; reload: () => void }) {
  const { papers } = useClassPapers(info.id)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [copied, setCopied] = useState(false)
  const loadDash = useCallback(() => {
    api<Dashboard>(`/v1/classes/${info.id}/dashboard`)
      .then(setDash)
      .catch(() => setDash(null))
  }, [info.id])
  useEffect(loadDash, [loadDash, assignments.length])

  const remove = async (a: Assignment) => {
    if (!window.confirm(`Remove “${a.title}” from the class?`)) return
    await api(`/v1/classes/${info.id}/assignments/${a.id}`, { method: 'DELETE' })
    reload()
  }
  const removeStudent = async (uid: string, name: string) => {
    if (!window.confirm(`Remove ${name} from the class?`)) return
    await api(`/v1/classes/${info.id}/members/${uid}`, { method: 'DELETE' })
    reload()
  }
  const copyCode = () => {
    void navigator.clipboard?.writeText(info.code ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-dim">Join code</div>
          <div className="font-mono text-[26px] font-semibold tracking-[0.25em] text-accent">{info.code}</div>
        </div>
        <p className="max-w-sm text-[12.5px] text-mute">Students sign in, open Classes and enter this code.</p>
        <button onClick={copyCode} className={`${ghostBtn} ml-auto`}>
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">Class report</h2>
        <ClassReport classId={info.id} papers={papers} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">Results</h2>
            {dash && dash.students.length ? (
              <button className="text-[12.5px] text-accent hover:underline" onClick={() => void download(`/v1/classes/${info.id}/dashboard.csv`, `${info.name}.csv`)}>
                Download CSV
              </button>
            ) : null}
          </div>
          {!dash ? (
            <p className="text-[13px] text-mute">Loading…</p>
          ) : !dash.students.length ? (
            <Notice>No students yet. Share the join code above.</Notice>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-panel-2 text-left text-mute">
                  <tr>
                    <th className="px-3 py-2 font-medium">Student</th>
                    <th className="px-3 py-2 font-medium">Done</th>
                    {dash.assignments.map((a) => (
                      <th key={a.id} className="max-w-[16ch] truncate px-3 py-2 font-medium" title={a.title}>
                        {a.title}
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dash.students.map((s) => (
                    <tr key={s.uid}>
                      <td className="whitespace-nowrap px-3 py-2 text-ink">{s.displayName}</td>
                      <td className="px-3 py-2 font-mono text-ink/85">
                        {s.completed}/{dash.assignments.length}
                      </td>
                      {s.results.map((r, i) => (
                        <td key={i} className="px-3 py-2">
                          <StatusPill r={r} />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => void removeStudent(s.uid, s.displayName)} className="text-[11.5px] text-dim hover:text-warn">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">Assignments</h2>
          {!assignments.length ? (
            <p className="text-[13px] text-mute">None yet. Use “Set work” to add scenes, exam questions or challenges.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 bg-panel-2/40 px-4 py-2.5">
                  <div>
                    <span className="mr-2 text-[11px] font-medium uppercase tracking-wider text-dim">{KIND_LABEL[a.kind]}</span>
                    <span className="text-[13px] text-ink">{a.title}</span>
                    <div>
                      <Due due={a.due} complete />
                    </div>
                  </div>
                  <button onClick={() => void remove(a)} className="text-[12px] text-dim hover:text-warn">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside>
          <AssignForm classId={info.id} onAdded={reload} />
        </aside>
      </div>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">Papers</h2>
        <TeacherPapers classId={info.id} />
      </section>
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
        setInfo(i)
        setAssignments(a.assignments)
        setError(null)
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t load this class.'))
  }, [classId, status])
  useEffect(load, [load])

  return (
    <StudyShell title={info?.name ?? 'Class'} right={<Link to="/classes" className="text-[12.5px] text-accent hover:underline">All classes</Link>}>
      {status === 'loading' ? null : status !== 'signed-in' ? (
        <SignInFirst what="see this class" />
      ) : error ? (
        <Notice tone="warn">{error}</Notice>
      ) : !info ? (
        <p className="text-[13px] text-mute">Loading…</p>
      ) : info.isTeacher ? (
        <TeacherView info={info} assignments={assignments} reload={load} />
      ) : (
        <StudentView info={info} assignments={assignments} />
      )}
    </StudyShell>
  )
}
