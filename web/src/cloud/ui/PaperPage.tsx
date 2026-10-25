import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { markAnswers, scoreMarks, type FieldMark } from '@/study/marking'
import { useProgress } from '@/study/progress'
import { findQuestion } from '@/study/questions'
import { parseAnswer, type Question } from '@/study/types'
import { StudyShell } from '@/study/ui/StudyShell'
import { instantiate } from '@/study/variants'
import { Tex } from '@/ui/Tex'
import { Working, n } from '@/ui/Working'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { paperSeed, slipsOf, type Paper, type PaperAttempt } from '../papers'
import { SignInFirst } from './ClassesPage'
import { Notice, ghostBtn, primaryBtn } from './Modal'

type Answers = Record<string, Record<string, string>>

/** One paper as a member sees it: the teacher previews; a student sees their own attempt. */
type PaperView = Omit<Paper, 'attempt'> & { isTeacher: boolean; attempt: PaperAttempt | null }

const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const draftKey = (pid: string) => `solidify.paper.${pid}`
const loadDraft = (pid: string): Answers => {
  try {
    return JSON.parse(localStorage.getItem(draftKey(pid)) ?? '{}') as Answers
  } catch {
    return {}
  }
}
const saveDraft = (pid: string, a: Answers) => {
  try {
    localStorage.setItem(draftKey(pid), JSON.stringify(a))
  } catch {
    /* storage unavailable */
  }
}

function markQuestion(q: Question, given: Record<string, string>) {
  const values = Object.fromEntries(q.answers.map((a) => [a.key, parseAnswer(given[a.key] ?? '')]))
  const marks = markAnswers(q.answers, q.solve(), values, q.follow)
  const { got, of } = scoreMarks(marks)
  return { marks, score: of ? got / of : 0 }
}

function QuestionBlock({ q, index, answers, onChange, marks, showWorking }: { q: Question; index: number; answers: Record<string, string>; onChange?: (key: string, v: string) => void; marks?: FieldMark[]; showWorking?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="rounded-3xl border border-line bg-panel p-5">
      <div className="mb-1 text-[11.5px] font-mono text-dim">Q{index + 1}</div>
      <h2 className="text-[15.5px] font-semibold text-ink">{q.title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/85">{q.statement}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {q.answers.map((a, i) => {
          const m = marks?.[i]
          return (
            <div key={a.key}>
              <label className="flex items-center gap-2 rounded-lg border border-line bg-panel-2/60 px-3 py-2">
                <span className="min-w-[56px] text-[13px] text-ink">
                  <Tex tex={a.label} />
                </span>
                <input
                  inputMode="decimal"
                  value={answers[a.key] ?? ''}
                  readOnly={!onChange}
                  onChange={(e) => onChange?.(a.key, e.target.value)}
                  className={`w-full min-w-0 rounded-md border bg-bg px-2 py-1 font-mono text-[13px] text-ink outline-none focus:border-accent ${m ? (m.ok ? 'border-accent/70' : m.carried ? 'border-info/60' : 'border-danger/70') : 'border-line-2'}`}
                  aria-label={`${a.key} in ${a.unit || 'no unit'}`}
                />
                <span className="shrink-0 text-[12px] text-mute">{a.unit}</span>
                {m ? <span className={`shrink-0 text-[12px] font-semibold ${m.ok ? 'text-accent' : m.carried ? 'text-info' : 'text-danger'}`}>{m.ok ? '✓' : m.carried ? '½' : '✗'}</span> : null}
              </label>
              {m && !m.ok ? (
                <p className={`mt-1 px-1 text-[11.5px] leading-snug ${m.carried ? 'text-info' : 'text-warn'}`}>
                  {m.diagnosis ? `${m.diagnosis.message} ` : ''}
                  <span className="text-mute">
                    Answer: <Tex tex={`${n(m.computed)}`} /> {a.unit}
                  </span>
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      {showWorking ? (
        <div className="mt-3">
          <button className="text-[12.5px] text-accent hover:underline" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide working' : 'Show working'}
          </button>
          {open ? (
            <div className="mt-2">
              <Working steps={q.working(q.solve())} />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export default function PaperPage() {
  const { classId = '', paperId = '' } = useParams()
  const status = useAuth((s) => s.status)
  const uid = useAuth((s) => s.user?.uid ?? '')
  const record = useProgress((s) => s.recordAnswer)
  const [paper, setPaper] = useState<(PaperView) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [answers, setAnswers] = useState<Answers>(() => loadDraft(paperId))
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const submitted = useRef(false)

  useEffect(() => {
    if (status !== 'signed-in') return
    api<PaperView>(`/v1/classes/${classId}/papers/${paperId}`)
      .then((p) => {
        setPaper(p)
        if (p.attempt && !p.attempt.submittedAt) setEndsAt(p.attempt.startedAt + p.minutes * 60_000)
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t load this paper.'))
  }, [classId, paperId, status])

  // each student's own numbers (teachers preview the past-paper versions)
  const questions = useMemo(() => {
    if (!paper) return []
    return paper.questionIds
      .map((id) => findQuestion(id))
      .filter((q): q is Question => !!q)
      .map((q) => (paper.isTeacher ? q : instantiate(q, paperSeed(uid, paper.id, q.id))))
  }, [paper, uid])

  const done = !!paper?.attempt?.submittedAt
  const running = !!endsAt && !done

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [running])

  const setAnswer = (qid: string, key: string, v: string) =>
    setAnswers((a) => {
      const next = { ...a, [qid]: { ...a[qid], [key]: v } }
      saveDraft(paperId, next)
      return next
    })

  const handIn = useCallback(async () => {
    if (!paper || submitted.current) return
    submitted.current = true
    setBusy(true)
    const results: Record<string, { score: number; slips: string[] }> = {}
    for (const q of questions) {
      const { marks, score } = markQuestion(q, answers[q.id] ?? {})
      results[q.id] = { score, slips: slipsOf(marks).slice(0, 10) }
      record(q.id, score >= 1, score)
    }
    try {
      await api(`/v1/classes/${classId}/papers/${paperId}/submit`, { body: { answers, results } })
      setPaper({ ...paper, attempt: { ...(paper.attempt ?? { startedAt: Date.now() }), submittedAt: Date.now(), answers, results, total: Object.values(results).reduce((s, r) => s + r.score, 0) / Math.max(1, questions.length) } })
      try {
        localStorage.removeItem(draftKey(paperId))
      } catch {
        /* ignore */
      }
    } catch (e) {
      submitted.current = false
      setError(e instanceof ApiError ? e.message : 'Couldn’t hand in. Check your connection and try again; your answers are saved.')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }, [paper, questions, answers, classId, paperId, record])

  // time's up: hand in automatically
  useEffect(() => {
    if (running && endsAt && now >= endsAt) void handIn()
  }, [running, endsAt, now, handIn])

  const start = async () => {
    setBusy(true)
    try {
      const r = await api<{ startedAt: number; endsAt: number }>(`/v1/classes/${classId}/papers/${paperId}/start`, { body: {} })
      setPaper((p) => (p ? { ...p, attempt: { startedAt: r.startedAt } } : p))
      setEndsAt(r.endsAt)
      setNow(Date.now())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t start the paper.')
    } finally {
      setBusy(false)
    }
  }

  const back = <Link to={`/classes/${classId}`} className="text-[12.5px] text-accent hover:underline">Back to the class</Link>

  if (status === 'loading') return null
  if (status !== 'signed-in')
    return (
      <StudyShell title="Paper">
        <SignInFirst what="sit this paper" />
      </StudyShell>
    )

  return (
    <StudyShell title={paper?.title ?? 'Paper'} right={back}>
      {error ? <div className="mb-4"><Notice tone="warn">{error}</Notice></div> : null}
      {!paper ? (
        !error ? <p className="text-[13px] text-mute">Loading…</p> : null
      ) : paper.isTeacher ? (
        <>
          <Notice>Preview with the past-paper numbers. Each student sees the same questions with their own numbers.</Notice>
          <div className="mt-4 space-y-3">
            {questions.map((q, i) => (
              <QuestionBlock key={q.id} q={q} index={i} answers={{}} showWorking />
            ))}
          </div>
        </>
      ) : done ? (
        <>
          <div className="mb-4 rounded-2xl border border-accent/40 bg-panel p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Your result</div>
            <div className="mt-1 font-mono text-[28px] font-semibold text-accent">{Math.round((paper.attempt?.total ?? 0) * 100)}%</div>
            {paper.attempt?.late ? <p className="text-[12px] text-warn">Handed in after the time limit.</p> : null}
            <p className="mt-1 text-[12.5px] text-mute">Questions you didn’t get fully right will come back in your reviews, with new numbers.</p>
          </div>
          <div className="space-y-3">
            {questions.map((q, i) => {
              const given = paper.attempt?.answers?.[q.id] ?? answers[q.id] ?? {}
              return <QuestionBlock key={q.id} q={q} index={i} answers={given} marks={markQuestion(q, given).marks} showWorking />
            })}
          </div>
        </>
      ) : !running ? (
        <div className="rounded-3xl border border-line bg-panel p-5">
          <h2 className="text-[16px] font-semibold">
            {questions.length} question{questions.length === 1 ? '' : 's'} · {paper.minutes} minutes
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-mute">
            The clock starts when you press Start and keeps running if you leave the page. Your numbers are your own: classmates get the same questions with different values. You can hand in once.
          </p>
          <button className={`${primaryBtn} mt-4`} disabled={busy} onClick={() => void start()}>
            {busy ? 'Starting…' : 'Start paper'}
          </button>
        </div>
      ) : (
        <>
          <div className="sticky top-14 z-30 mb-4 flex items-center gap-3 rounded-3xl border border-line bg-panel/95 px-4 py-2.5 backdrop-blur">
            <span className={`font-mono text-[18px] font-semibold ${endsAt! - now < 60_000 ? 'text-danger' : 'text-ink'}`}>{clock(endsAt! - now)}</span>
            <span className="text-[12px] text-mute">
              {questions.filter((q) => Object.values(answers[q.id] ?? {}).some((v) => v.trim())).length}/{questions.length} answered · saved as you type
            </span>
            <div className="ml-auto flex items-center gap-2">
              {confirming ? (
                <>
                  <span className="text-[12.5px] text-ink">Hand in now?</span>
                  <button className={ghostBtn} onClick={() => setConfirming(false)}>
                    Keep going
                  </button>
                  <button className={primaryBtn} disabled={busy} onClick={() => void handIn()}>
                    {busy ? 'Handing in…' : 'Hand in'}
                  </button>
                </>
              ) : (
                <button className={primaryBtn} onClick={() => setConfirming(true)}>
                  Hand in
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionBlock key={q.id} q={q} index={i} answers={answers[q.id] ?? {}} onChange={(k, v) => setAnswer(q.id, k, v)} />
            ))}
          </div>
        </>
      )}
    </StudyShell>
  )
}
