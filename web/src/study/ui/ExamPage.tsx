import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ERRATA } from '@/content/errata'
import { findModule } from '@/modules/catalog'
import { useAcademic } from '@/ui/audience'
import { Badge } from '@/ui/controls'
import { Tex } from '@/ui/Tex'
import { Working, n } from '@/ui/Working'
import { queueParams } from '../bridge'
import { useProgress } from '../progress'
import { QUESTIONS, findQuestion } from '../questions'
import { COURSES, courseTitle, parseAnswer, type Course, type Question } from '../types'
import { markAnswers } from '../marking'
import { dueQuestions } from '../review'
import { ExplainMistake } from './ExplainMistake'
import { instantiate, randomSeed, type Seed } from '../variants'
import { RigView } from './RigView'
import { YourQuestions } from './YourQuestions'
import { usePageTourOn } from '@/ui/PageTour'
import { Bar, CourseLabel, Pills, StudyShell } from './StudyShell'

type Inputs = Record<string, string>

const chooser = 'w-full min-w-0 rounded-xl border border-line-2 bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-accent'

function fieldResults(q: Question, inputs: Inputs) {
  const given = Object.fromEntries(q.answers.map((a) => [a.key, parseAnswer(inputs[a.key] ?? '')]))
  return markAnswers(q.answers, q.solve(), given, q.follow).map((m) => ({ a: m.field, computed: m.computed, ok: m.ok, carried: m.carried, diagnosis: m.diagnosis }))
}

/** Fraction of the marks, 0–1 (method-only boxes count ½). */
const scoreOf = (results: { ok: boolean; carried?: boolean }[]) => (results.length ? results.reduce((s, r) => s + (r.ok ? 1 : r.carried ? 0.5 : 0), 0) / results.length : 0)

/** "2½/4 marks": 1 per correct box, ½ for method only (error carried forward). */
function marksLabel(results: { ok: boolean; carried?: boolean }[]) {
  const got = results.reduce((s, r) => s + (r.ok ? 1 : r.carried ? 0.5 : 0), 0)
  const whole = Math.floor(got)
  const text = got % 1 ? `${whole ? whole : ''}½` : `${whole}`
  return results.length === 1 ? (got === 1 ? 'Correct' : got ? 'Method mark' : 'Not yet') : `${text}/${results.length} marks`
}

function useOpenIn3D() {
  const navigate = useNavigate()
  return (q: Question) => {
    queueParams(q.sceneId, q.params)
    navigate(`/m/${q.moduleId}/${q.sceneId}`)
  }
}

function AnswerInputs({ q, inputs, setInputs, results }: { q: Question; inputs: Inputs; setInputs: (i: Inputs) => void; results?: ReturnType<typeof fieldResults> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {q.answers.map((a, i) => {
        const res = results?.[i]
        return (
          <div key={a.key}>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-panel-2/60 px-3 py-2">
            <span className="min-w-[64px] text-[13px] text-ink">
              <Tex tex={a.label} />
            </span>
            <input
              inputMode="decimal"
              value={inputs[a.key] ?? ''}
              onChange={(e) => setInputs({ ...inputs, [a.key]: e.target.value })}
              className={`w-full min-w-0 rounded-md border bg-bg px-2 py-1 font-mono text-[13px] text-ink outline-none focus:border-accent ${
                res ? (res.ok ? 'border-accent/70' : 'border-danger/70') : 'border-line-2'
              }`}
              aria-label={`${a.key} in ${a.unit || 'no unit'}`}
            />
            <span className="shrink-0 text-[12px] text-mute">{a.unit}</span>
            {res ? (
              <span className={`shrink-0 text-[12px] font-semibold ${res.ok ? 'text-accent' : res.carried ? 'text-info' : 'text-danger'}`} title={res.carried ? 'Method mark' : undefined}>
                {res.ok ? '✓' : res.carried ? '½' : '✗'}
              </span>
            ) : null}
          </label>
          {res?.diagnosis ? <p className={`mt-1 px-1 text-[11.5px] leading-snug ${res.carried ? 'text-info' : 'text-warn'}`}>{res.diagnosis.message}</p> : null}
          </div>
        )
      })}
    </div>
  )
}

function QuestionHead({ q, index, total }: { q: Question; index?: number; total?: number }) {
  const academic = useAcademic()
  usePageTourOn('exam', [
    { target: 'exam-mode', title: 'Four ways to practise', text: 'Practice one question at a time, Review the ones due again, sit a timed Mock exam, or go back to the questions you pasted yourself.' },
    { target: 'exam-filter', title: 'Pick a subject and topic', text: 'Narrow the questions down; the bar shows how many you have solved.' },
    { target: 'rig-view', title: 'The question in 3D', text: 'Each question comes with its rig, set to the numbers in the question. Turn it, cut it open, watch it move.' },
    { target: 'exam-check', title: 'Answer, then check', text: 'Type your answers and check them; they are accepted within about 1 %. Show working reveals every step.' },
  ])
  const scene = findModule(q.moduleId)?.scenes.find((s) => s.id === q.sceneId)
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
        {index !== undefined ? <span className="font-mono text-dim">Q{index + 1}{total ? `/${total}` : ''}</span> : null}
        <Badge tone="info">
          <CourseLabel course={q.course} />
        </Badge>
        <Badge>{q.topic}</Badge>
        {scene ? <span className="text-dim">· {scene.title}</span> : null}
        {q.variant !== undefined && q.variant !== 'original' ? (
          <Badge tone="accent" title="The same problem with new numbers; marked by the same calculations">
            new numbers
          </Badge>
        ) : null}
        {academic && q.errata && (q.variant ?? 'original') === 'original' ? (
          <Badge tone="warn" title={ERRATA.find((e) => e.id === q.errata)?.correct}>
            note discrepancy
          </Badge>
        ) : null}
      </div>
      <h2 className="text-[17px] font-semibold text-ink">{q.title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/85">{q.statement}</p>
    </>
  )
}

function Solution({ q }: { q: Question }) {
  const academic = useAcademic()
  const r = q.solve()
  const err = q.errata && (q.variant ?? 'original') === 'original' ? ERRATA.find((e) => e.id === q.errata) : undefined
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2 text-[12.5px]">
        {q.answers.map((a) => (
          <span key={a.key} className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">
            <Tex tex={`${a.label} = ${n(r[a.key])}`} /> {a.unit}
          </span>
        ))}
      </div>
      <Working steps={q.working(r)} />
      {academic && err ? (
        <p className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-[12px] leading-snug text-warn">
          <strong>A published answer gives:</strong> {err.says} <strong>Correct:</strong> {err.correct}
        </p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ practice */

/** `fresh`: start every question with new numbers (review sessions). */
function Practice({ list, start, fresh = false }: { list: Question[]; start?: string; fresh?: boolean }) {
  const [i, setI] = useState(() => Math.max(0, start ? list.findIndex((x) => x.id === start) : 0))
  const [inputs, setInputs] = useState<Inputs>({})
  const [results, setResults] = useState<ReturnType<typeof fieldResults> | undefined>()
  const [reveal, setReveal] = useState(false)
  const record = useProgress((s) => s.recordAnswer)
  const qp = useProgress((s) => s.questions)
  const open3d = useOpenIn3D()
  const base = list[Math.min(i, list.length - 1)]
  const [seed, setSeed] = useState<Seed>(() => (fresh ? randomSeed() : 'original'))
  const q = useMemo(() => (base ? instantiate(base, seed) : base), [base, seed])

  useEffect(() => {
    setInputs({})
    setResults(undefined)
    setReveal(false)
  }, [q?.id, q?.variant])
  useEffect(() => setSeed(fresh ? randomSeed() : 'original'), [base?.id, fresh])
  useEffect(() => setI(Math.max(0, start ? list.findIndex((x) => x.id === start) : 0)), [list, start])

  if (!q) return <p className="text-mute">No questions match these filters.</p>
  const check = () => {
    const res = fieldResults(q, inputs)
    setResults(res)
    record(q.id, res.every((x) => x.ok), scoreOf(res))
  }
  const stat = qp[q.id]
  return (
    // the problem beside its rig, live in 3D with the problem's numbers (new numbers move the rig too)
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
    {/* a new rig is a new view: loading one rig into the view of another left a 3D label to be removed twice */}
    <RigView key={`${q.moduleId}/${q.sceneId}`} moduleId={q.moduleId} sceneId={q.sceneId} params={q.params} className="h-[300px] sm:h-[420px] lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)] lg:min-h-[480px]" />
    <div className="min-w-0 rounded-3xl border border-line bg-panel p-5">
      <QuestionHead q={q} index={i} total={list.length} />
      <div className="mt-4">
        <AnswerInputs q={q} inputs={inputs} setInputs={setInputs} results={results} />
        <p className="mt-1.5 text-[11px] text-dim">Answers are accepted within about 1 % of the computed value.</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button data-tour="exam-check" onClick={check} className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink hover:brightness-110">
          Check
        </button>
        <button onClick={() => setReveal((v) => !v)} className="rounded-lg border border-line-2 px-3 py-1.5 text-[13px] text-ink hover:border-accent/40">
          {reveal ? 'Hide working' : 'Show working'}
        </button>
        <button onClick={() => open3d(q)} className="rounded-lg border border-accent/50 px-3 py-1.5 text-[13px] text-accent hover:bg-accent/10">
          Open the full rig{q.params ? ' with this data' : ''}
        </button>
        {q.vary ? (
          <button
            onClick={() => setSeed(randomSeed())}
            className="rounded-lg border border-line-2 px-3 py-1.5 text-[13px] text-ink hover:border-accent/40"
            title="The same problem with different numbers"
          >
            New numbers
          </button>
        ) : null}
        {q.vary && seed !== 'original' ? (
          <button onClick={() => setSeed('original')} className="text-[12.5px] text-mute hover:text-ink">
            Past-paper numbers
          </button>
        ) : null}
        {results ? (
          <span className={`text-[12.5px] font-medium ${results.every((x) => x.ok) ? 'text-accent' : 'text-warn'}`}>
            {marksLabel(results)}
          </span>
        ) : null}
        {stat ? <span className="text-[11.5px] text-dim">· {stat.correct}/{stat.attempts} attempts correct</span> : null}
        <div className="ml-auto flex gap-1">
          <button disabled={i === 0} onClick={() => setI(i - 1)} className="rounded-md px-2.5 py-1 text-[12.5px] text-ink/85 hover:bg-panel-3 disabled:opacity-40">
            Back
          </button>
          <button onClick={() => setI(Math.floor(Math.random() * list.length))} className="rounded-md px-2.5 py-1 text-[12.5px] text-ink/85 hover:bg-panel-3">
            Random
          </button>
          <button disabled={i >= list.length - 1} onClick={() => setI(i + 1)} className="rounded-md bg-panel-3 px-2.5 py-1 text-[12.5px] text-ink hover:brightness-125 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
      {results ? <ExplainMistake q={q} results={results} inputs={inputs} /> : null}
      {reveal ? <Solution q={q} /> : null}
    </div>
    </div>
  )
}

/* ------------------------------------------------------------------ mock exam */

function shuffle<T>(xs: T[]) {
  const a = [...xs]
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1))
    ;[a[k], a[j]] = [a[j], a[k]]
  }
  return a
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function Mock({ pool }: { pool: Question[] }) {
  const [count, setCount] = useState<'5' | '10' | '15'>('5')
  const [minutes, setMinutes] = useState<'10' | '20' | '30'>('20')
  const [fresh, setFresh] = useState<'new' | 'paper'>('new')
  const [paper, setPaper] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, Inputs>>({})
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(0)
  const [done, setDone] = useState(false)
  const record = useProgress((s) => s.recordAnswer)

  useEffect(() => {
    if (!paper || done) return
    const t = window.setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000)
    return () => window.clearInterval(t)
  }, [paper, done])

  const finish = () => {
    if (!paper || done) return
    for (const q of paper) {
      const res = fieldResults(q, answers[q.id] ?? {})
      record(q.id, res.every((x) => x.ok), scoreOf(res))
    }
    setDone(true)
  }
  useEffect(() => {
    if (paper && !done && left === 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  const scores = useMemo(() => (paper && done ? paper.map((q) => fieldResults(q, answers[q.id] ?? {})) : []), [paper, done, answers])

  if (!paper) {
    return (
      <div className="rounded-3xl border border-line bg-panel p-5">
        <h2 className="text-[16px] font-semibold">Timed mock exam</h2>
        <p className="mt-1 text-[13px] text-mute">Random questions from the current filter ({pool.length} available). No working is shown until you submit.</p>
        <div className="mt-4 space-y-3 text-[12.5px]">
          <div className="flex items-center gap-3">
            <span className="w-24 text-mute">Questions</span>
            <Pills label="Questions" value={count} onChange={setCount} options={['5', '10', '15'].map((v) => ({ value: v as typeof count, label: v }))} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 text-mute">Time</span>
            <Pills label="Minutes" value={minutes} onChange={setMinutes} options={['10', '20', '30'].map((v) => ({ value: v as typeof minutes, label: `${v} min` }))} />
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 text-mute">Numbers</span>
            <Pills
              label="Numbers"
              value={fresh}
              onChange={setFresh}
              options={[
                { value: 'new' as const, label: 'New for every question' },
                { value: 'paper' as const, label: 'Past-paper' },
              ]}
            />
          </div>
        </div>
        <button
          disabled={pool.length === 0}
          onClick={() => {
            setPaper(shuffle(pool).slice(0, Number(count)).map((q) => (fresh === 'new' ? instantiate(q, randomSeed()) : q)))
            setAnswers({})
            setI(0)
            setDone(false)
            setLeft(Number(minutes) * 60)
          }}
          className="mt-5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
        >
          Start mock exam
        </button>
      </div>
    )
  }

  if (done) {
    const correctQs = scores.filter((s) => s.every((x) => x.ok)).length
    const fields = scores.flat()
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-accent/40 bg-panel p-5">
          <h2 className="text-[16px] font-semibold">Result</h2>
          <p className="mt-1 font-mono text-[28px] font-semibold text-accent">
            {correctQs}/{paper.length}
          </p>
          <p className="text-[12.5px] text-mute">
            questions fully correct · {fields.filter((x) => x.ok).length}/{fields.length} answer boxes
          </p>
          <button onClick={() => setPaper(null)} className="mt-3 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] hover:border-accent/40">
            New mock exam
          </button>
        </div>
        {paper.map((q, k) => (
          <details key={q.id} className="rounded-3xl border border-line bg-panel p-4">
            <summary className="cursor-pointer text-[13.5px]">
              <span className={scores[k].every((x) => x.ok) ? 'text-accent' : 'text-danger'}>{scores[k].every((x) => x.ok) ? '✓' : '✗'}</span> Q{k + 1}. {q.title}
            </summary>
            <div className="mt-3">
              <QuestionHead q={q} />
              <div className="mt-3">
                <AnswerInputs q={q} inputs={answers[q.id] ?? {}} setInputs={() => {}} results={scores[k]} />
              </div>
              <Solution q={q} />
            </div>
          </details>
        ))}
      </div>
    )
  }

  const q = paper[i]
  return (
    <div className="rounded-3xl border border-line bg-panel p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className={`font-mono text-[15px] font-semibold ${left < 60 ? 'text-danger' : 'text-ink'}`}>{fmtTime(left)}</span>
        <div className="flex-1">
          <Bar value={paper.filter((x) => Object.values(answers[x.id] ?? {}).some((v) => v.trim())).length} total={paper.length} />
        </div>
        <button onClick={finish} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:brightness-110">
          Submit
        </button>
      </div>
      <QuestionHead q={q} index={i} total={paper.length} />
      <div className="mt-4">
        <AnswerInputs q={q} inputs={answers[q.id] ?? {}} setInputs={(v) => setAnswers({ ...answers, [q.id]: v })} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1">
        {paper.map((x, k) => (
          <button
            key={x.id}
            onClick={() => setI(k)}
            className={`h-7 w-7 rounded-md text-[12px] ${k === i ? 'bg-accent text-accent-ink' : Object.values(answers[x.id] ?? {}).some((v) => v.trim()) ? 'bg-panel-3 text-ink' : 'border border-line-2 text-mute'}`}
          >
            {k + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export function ExamPage() {
  // /exam?q=<question id> opens that question (used by class assignments)
  const [params] = useSearchParams()
  const start = useMemo(() => findQuestion(params.get('q') ?? ''), [params])
  const qp = useProgress((s) => s.questions)
  const [mode, setMode] = useState<'practice' | 'mock' | 'review' | 'mine'>(() => (params.get('mode') === 'mine' ? 'mine' : 'practice'))
  // reviews due now, across every subject; frozen when a review session starts
  const dueNow = useMemo(() => dueQuestions(qp, QUESTIONS.map((q) => q.id), Date.now()), [qp])
  const [reviewList, setReviewList] = useState<Question[]>([])
  const startMode = (m: typeof mode) => {
    if (m === 'review') setReviewList(dueNow.map((id) => findQuestion(id)!).filter(Boolean))
    setMode(m)
  }
  const [course, setCourse] = useState<Course | 'all'>(start?.course ?? 'all')
  const [topic, setTopic] = useState(start?.topic ?? 'all')
  // /exam?mode=review opens a review session (from the progress page)
  const wantReview = params.get('mode') === 'review'
  useEffect(() => {
    if (wantReview) startMode('review')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantReview])
  // following another question link while already on this page: show that question
  useEffect(() => {
    if (!start) return
    setMode('practice')
    setCourse(start.course)
    setTopic(start.topic)
  }, [start])
  const academic = useAcademic()

  const byCourse = useMemo(() => QUESTIONS.filter((q) => course === 'all' || q.course === course), [course])
  const topics = useMemo(() => [...new Set(byCourse.map((q) => q.topic))], [byCourse])
  const list = useMemo(() => byCourse.filter((q) => topic === 'all' || q.topic === topic), [byCourse, topic])
  const solved = list.filter((q) => (qp[q.id]?.correct ?? 0) > 0).length

  return (
    <StudyShell
      title="Exam practice"
      lead={`${QUESTIONS.length} worked problems${academic ? ' from past papers, marking guides and worked examples' : ''}. Every answer is computed by the same tested calculations that drive the 3D scenes.`}
      right={
        <div data-tour="exam-mode">
        <Pills
          label="Mode"
          value={mode}
          onChange={startMode}
          options={[
            { value: 'practice', label: 'Practice' },
            { value: 'review', label: dueNow.length ? `Review · ${dueNow.length} due` : 'Review' },
            { value: 'mock', label: 'Mock exam' },
            { value: 'mine', label: 'Your questions' },
          ]}
        />
        </div>
      }
    >
      {mode !== 'review' && mode !== 'mine' ? (
      <div data-tour="exam-filter" className="mb-4 grid items-end gap-3 rounded-3xl border border-line bg-panel-2/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        {/* two choosers, not walls of buttons: ten subjects and forty-odd topics read better as lists */}
        <label className="block min-w-0">
          <span className="mb-1 block px-1 text-[11.5px] font-medium text-mute">Subject</span>
          <select
            value={course}
            onChange={(e) => {
              setCourse(e.target.value as Course | 'all')
              setTopic('all')
            }}
            className={chooser}
          >
            <option value="all">All subjects ({QUESTIONS.length})</option>
            {COURSES.map((c) => {
              const qs = QUESTIONS.filter((q) => q.course === c.id)
              if (!qs.length) return null
              const done = qs.filter((q) => (qp[q.id]?.correct ?? 0) > 0).length
              return (
                <option key={c.id} value={c.id}>
                  {courseTitle(c.id)} ({done ? `${done}/` : ''}{qs.length})
                </option>
              )
            })}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block px-1 text-[11.5px] font-medium text-mute">Topic</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className={chooser}>
            <option value="all">All topics ({byCourse.length})</option>
            {topics.map((t) => {
              const qs = byCourse.filter((q) => q.topic === t)
              const done = qs.filter((q) => (qp[q.id]?.correct ?? 0) > 0).length
              return (
                <option key={t} value={t}>
                  {t} ({done ? `${done}/` : ''}{qs.length})
                </option>
              )
            })}
          </select>
        </label>
        <div className="min-w-0 px-1 pb-2 text-[12px] text-mute">
          <div className="mb-1.5">
            <span className="font-semibold text-ink">{solved}</span> of {list.length} solved
          </div>
          <Bar value={solved} total={list.length} />
        </div>
      </div>
      ) : null}
      {mode === 'mine' ? (
        <YourQuestions />
      ) : mode === 'review' ? (
        reviewList.length ? (
          <>
            <p className="mb-3 text-[12.5px] text-mute">
              {reviewList.length} question{reviewList.length === 1 ? '' : 's'} due for review, each with new numbers. Get one fully right and it comes back later; miss it and it returns tomorrow.
            </p>
            <Practice list={reviewList} fresh />
          </>
        ) : (
          <div className="rounded-3xl border border-line bg-panel p-5 text-[13px] text-mute">
            Nothing is due for review. Questions you answer come back here on a schedule: tomorrow if you missed them, then after 3, 7 and 21 days as you keep getting them right.
          </div>
        )
      ) : mode === 'practice' ? (
        <Practice list={list} start={start?.id} />
      ) : (
        <Mock pool={list} />
      )}
    </StudyShell>
  )
}

export default ExamPage
