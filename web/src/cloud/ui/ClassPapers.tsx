import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { QUESTIONS } from '@/study/questions'
import { COURSES, courseTitle } from '@/study/types'
import { api, ApiError } from '../api'
import type { Paper } from '../papers'
import { Notice, ghostBtn, inputCls, primaryBtn } from './Modal'

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`)

function useClassPapers(classId: string) {
  const [papers, setPapers] = useState<Paper[] | null>(null)
  const load = useCallback(() => {
    api<{ papers: Paper[] }>(`/v1/classes/${classId}/papers`)
      .then((r) => setPapers(r.papers))
      .catch(() => setPapers([]))
  }, [classId])
  useEffect(load, [load])
  return { papers, reload: load }
}

/* ---------------------------------------------------------------- student */

export function StudentPapers({ classId }: { classId: string }) {
  const { papers } = useClassPapers(classId)
  if (!papers?.length) return null
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-mute">Papers</h2>
      <ul className="space-y-2">
        {papers.map((p) => {
          const a = p.attempt
          const state = a?.submittedAt ? 'done' : a ? 'started' : 'new'
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel-2/50 px-4 py-3">
              <div>
                <div className="text-[14px] font-medium text-ink">{p.title}</div>
                <div className="text-[11.5px] text-dim">
                  {p.questionIds.length} questions · {p.minutes} min{p.due ? ` · due ${fmtDate(p.due)}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {state === 'done' ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11.5px] font-semibold text-accent">{pct(a?.total)}</span> : null}
                <Link to={`/classes/${classId}/papers/${p.id}`} className={state === 'done' ? ghostBtn : primaryBtn}>
                  {state === 'done' ? 'See results' : state === 'started' ? 'Continue' : 'Start'}
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ---------------------------------------------------------------- teacher */

function PaperForm({ classId, onAdded }: { classId: string; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [due, setDue] = useState('')
  const [subject, setSubject] = useState<string>('all')
  const [topic, setTopic] = useState('all')
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bySubject = useMemo(() => QUESTIONS.filter((q) => subject === 'all' || q.course === subject), [subject])
  const topics = useMemo(() => [...new Set(bySubject.map((q) => q.topic))], [bySubject])
  const shown = bySubject.filter((q) => topic === 'all' || q.topic === topic)
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api(`/v1/classes/${classId}/papers`, { body: { title, questionIds: picked, minutes, due: due ? new Date(`${due}T23:59:00`).getTime() : undefined } })
      setTitle('')
      setPicked([])
      setDue('')
      onAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t create the paper.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-3xl border border-line bg-panel-2/50 p-4">
      <h3 className="mb-1 text-[13.5px] font-semibold">Set a paper</h3>
      <p className="mb-2 text-[11.5px] text-dim">A timed test. Every student gets the same questions with their own numbers, marked automatically.</p>
      <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Title, e.g. Week 6 test: hydraulics" aria-label="Paper title" />
      <div className="mt-2 flex flex-wrap gap-2">
        <select aria-label="Subject" value={subject} onChange={(e) => (setSubject(e.target.value), setTopic('all'))} className={`${inputCls} w-auto py-1`}>
          <option value="all">All subjects</option>
          {COURSES.map((c) => (
            <option key={c.id} value={c.id}>
              {courseTitle(c.id)}
            </option>
          ))}
        </select>
        <select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={`${inputCls} w-auto py-1`}>
          <option value="all">All topics</option>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <ul className="mt-2 max-h-56 overflow-y-auto rounded-md border border-line">
        {shown.map((q) => (
          <li key={q.id}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-panel-3">
              <input type="checkbox" checked={picked.includes(q.id)} onChange={() => toggle(q.id)} />
              <span className="text-ink/90">{q.title}</span>
              <span className="ml-auto shrink-0 text-[11px] text-dim">{q.topic}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-mute">
        <label className="flex items-center gap-1.5">
          Minutes
          <input type="number" min={5} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${inputCls} w-20 py-1`} />
        </label>
        <label className="flex items-center gap-1.5">
          Due
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${inputCls} w-auto py-1`} />
        </label>
        <button className={`${primaryBtn} ml-auto`} disabled={busy || !title.trim() || !picked.length || minutes < 5}>
          {busy ? 'Setting…' : `Set paper (${picked.length})`}
        </button>
      </div>
      {error ? <div className="mt-2"><Notice tone="warn">{error}</Notice></div> : null}
    </form>
  )
}

interface PaperResults {
  paper: Paper
  students: { uid: string; displayName: string; startedAt: number | null; submittedAt: number | null; late: boolean; total: number | null; results: Record<string, { score: number; slips: string[] }> | null }[]
}

function ResultsTable({ classId, paper }: { classId: string; paper: Paper }) {
  const [r, setR] = useState<PaperResults | null>(null)
  useEffect(() => {
    api<PaperResults>(`/v1/classes/${classId}/papers/${paper.id}/results`)
      .then(setR)
      .catch(() => setR(null))
  }, [classId, paper.id])
  if (!r) return <p className="mt-2 text-[12px] text-mute">Loading results…</p>
  const qs = paper.questionIds.map((id) => QUESTIONS.find((q) => q.id === id))
  const handed = r.students.filter((s) => s.submittedAt)
  const avg = (qid: string) => (handed.length ? handed.reduce((s, x) => s + (x.results?.[qid]?.score ?? 0), 0) / handed.length : null)
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-[12.5px]">
        <thead className="bg-panel-2 text-left text-mute">
          <tr>
            <th className="px-3 py-2 font-medium">Student</th>
            <th className="px-3 py-2 font-medium">Total</th>
            {qs.map((q, i) => (
              <th key={i} className="px-2 py-2 font-medium" title={q?.title}>
                Q{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {r.students.map((s) => (
            <tr key={s.uid}>
              <td className="whitespace-nowrap px-3 py-2 text-ink">
                {s.displayName}
                {s.late ? <span className="ml-1.5 text-[10.5px] text-warn">late</span> : null}
              </td>
              <td className="px-3 py-2 font-mono">{s.submittedAt ? pct(s.total) : s.startedAt ? <span className="text-dim">in progress</span> : <span className="text-dim">not started</span>}</td>
              {paper.questionIds.map((qid) => {
                const sc = s.results?.[qid]?.score
                return (
                  <td key={qid} className={`px-2 py-2 font-mono ${sc === undefined ? 'text-dim' : sc >= 1 ? 'text-accent' : sc > 0 ? 'text-info' : 'text-danger'}`}>
                    {sc === undefined ? '·' : pct(sc)}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="bg-panel-2/60">
            <td className="px-3 py-2 text-mute">Class average</td>
            <td className="px-3 py-2 font-mono text-mute">{handed.length ? pct(handed.reduce((s, x) => s + (x.total ?? 0), 0) / handed.length) : '—'}</td>
            {paper.questionIds.map((qid) => (
              <td key={qid} className="px-2 py-2 font-mono text-mute">
                {pct(avg(qid))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function TeacherPapers({ classId }: { classId: string }) {
  const { papers, reload } = useClassPapers(classId)
  const [open, setOpen] = useState<string | null>(null)
  const remove = async (p: Paper) => {
    if (!window.confirm(`Delete the paper “${p.title}”? Students' results on it will no longer be shown.`)) return
    await api(`/v1/classes/${classId}/papers/${p.id}`, { method: 'DELETE' })
    reload()
  }
  return (
    <div className="space-y-3">
      <PaperForm classId={classId} onAdded={reload} />
      {papers?.length ? (
        <ul className="space-y-2">
          {papers.map((p) => (
            <li key={p.id} className="rounded-xl border border-line bg-panel-2/40 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[13.5px] font-medium text-ink">{p.title}</div>
                  <div className="text-[11.5px] text-dim">
                    {p.questionIds.length} questions · {p.minutes} min{p.due ? ` · due ${fmtDate(p.due)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  <Link to={`/classes/${classId}/papers/${p.id}`} className="text-accent hover:underline">
                    Preview
                  </Link>
                  <button className="text-accent hover:underline" onClick={() => setOpen(open === p.id ? null : p.id)}>
                    {open === p.id ? 'Hide results' : 'Results'}
                  </button>
                  <button className="text-dim hover:text-warn" onClick={() => void remove(p)}>
                    Delete
                  </button>
                </div>
              </div>
              {open === p.id ? <ResultsTable classId={classId} paper={p} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export { useClassPapers }
