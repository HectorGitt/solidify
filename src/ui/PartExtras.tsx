import { useMemo, useState } from 'react'
import { faultsFor, type Fault } from '@/content/faults'
import { useParts, type PartMeta } from '@/parts/registry'
import { useProgress } from '@/study/progress'
import { Icon } from './icons'

/** Faults and a quick quiz for the selected part (inside the part card). */

/** small deterministic shuffle so a part always asks its question the same way */
function shuffle<T>(xs: T[], seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    const j = Math.abs(h) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const firstSentence = (s: string) => {
  const m = /^(.{20,}?[.;:])\s/.exec(s)
  return (m ? m[1] : s).replace(/[;:]$/, '.')
}

interface Question {
  ask: string
  options: string[]
  answer: number
  why: string
}

export function buildQuestions(part: PartMeta, all: PartMeta[]): Question[] {
  const qs: Question[] = []
  const others = all.filter((p) => p.id !== part.id)
  // 1. what does it do?
  const role = part.info?.role
  if (role) {
    const right = firstSentence(role)
    const wrong = [...new Set(others.map((p) => p.info?.role).filter((r): r is string => !!r).map(firstSentence))].filter((r) => r !== right)
    const pick = shuffle(wrong, part.id).slice(0, 3)
    if (pick.length >= 2) {
      const options = shuffle([right, ...pick], part.id + 'a')
      qs.push({ ask: `What does the ${part.name.toLowerCase()} do?`, options, answer: options.indexOf(right), why: role })
    }
  }
  // 2. which symptom points to it?
  const mine = faultsFor(part)
  if (mine.length) {
    const f = mine[0]
    const wrong = [...new Set(others.flatMap((p) => faultsFor(p)).map((x) => x.symptom))].filter((s) => !mine.some((m) => m.symptom === s))
    const pick = shuffle(wrong, part.id + 'f').slice(0, 3)
    if (pick.length >= 2) {
      const options = shuffle([f.symptom, ...pick], part.id + 'b')
      qs.push({ ask: `Which symptom points to a problem with the ${part.name.toLowerCase()}?`, options, answer: options.indexOf(f.symptom), why: `${f.fault}: ${f.cause} ${f.fix}` })
    }
  }
  return qs
}

function Faults({ faults }: { faults: Fault[] }) {
  return (
    <ul className="space-y-1.5">
      {faults.map((f) => (
        <li key={f.fault} className="rounded-md border border-warn/25 bg-warn/5 px-2.5 py-1.5">
          <div className="font-medium text-warn">{f.fault}</div>
          <div>
            <span className="text-dim">Symptom: </span>
            {f.symptom}
          </div>
          <div>
            <span className="text-dim">Cause: </span>
            {f.cause}
          </div>
          <div>
            <span className="text-dim">Remedy: </span>
            {f.fix}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Quiz({ part, route, questions }: { part: PartMeta; route: string; questions: Question[] }) {
  const [k, setK] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const record = useProgress((s) => s.recordAnswer)
  const q = questions[k]
  if (!q) return null
  const done = chosen !== null
  return (
    <div className="rounded-md border border-line-2 px-2.5 py-2">
      <div className="mb-1.5 font-medium text-ink">{q.ask}</div>
      <div className="space-y-1">
        {q.options.map((o, i) => {
          const tone = !done ? 'border-line-2 hover:border-accent/50' : i === q.answer ? 'border-accent bg-accent/10' : i === chosen ? 'border-danger/60 bg-danger/10' : 'border-line-2 opacity-60'
          return (
            <button
              key={i}
              disabled={done}
              onClick={() => {
                setChosen(i)
                record(`part:${route}:${part.name}:${k}`, i === q.answer)
              }}
              className={`block w-full rounded-md border px-2 py-1 text-left text-[12px] ${tone}`}
            >
              {o}
            </button>
          )
        })}
      </div>
      {done ? (
        <div className="mt-1.5 text-[11.5px]">
          <span className={chosen === q.answer ? 'text-accent' : 'text-danger'}>{chosen === q.answer ? 'Right. ' : 'Not quite. '}</span>
          <span className="text-mute">{q.why}</span>
          {k + 1 < questions.length ? (
            <button
              className="ml-1 text-accent hover:underline"
              onClick={() => {
                setK(k + 1)
                setChosen(null)
              }}
            >
              Next question →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function PartExtras({ part, route }: { part: PartMeta; route: string }) {
  const [tab, setTab] = useState<'none' | 'faults' | 'quiz'>('none')
  const faults = useMemo(() => faultsFor(part), [part])
  const questions = useMemo(() => (tab === 'quiz' ? buildQuestions(part, Object.values(useParts.getState().parts)) : []), [tab, part])
  const canQuiz = !!part.info?.role || faults.length > 0
  if (!faults.length && !canQuiz) return null
  const btn = (t: 'faults' | 'quiz', label: string) => (
    <button
      onClick={() => setTab(tab === t ? 'none' : t)}
      className={`rounded-full border px-2 py-0.5 text-[11.5px] ${tab === t ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line-2 text-mute hover:text-ink'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {faults.length ? btn('faults', `Common faults (${faults.length})`) : null}
        {canQuiz ? btn('quiz', 'Quiz me') : null}
      </div>
      {tab === 'faults' ? <Faults faults={faults} /> : null}
      {tab === 'quiz' ? (
        questions.length ? (
          <Quiz key={part.id} part={part} route={route} questions={questions} />
        ) : (
          <p className="flex items-center gap-1 text-mute">
            <Icon.close width={12} height={12} /> Not enough other parts here to make a fair question.
          </p>
        )
      ) : null}
    </div>
  )
}
