import { useMemo, useState } from 'react'
import { ERRATA } from '@/content/errata'
import type { SceneDef } from '@/modules/types'
import { Badge } from '@/ui/controls'
import { Tex } from '@/ui/Tex'
import { Working, n } from '@/ui/Working'
import { useProgress } from '../progress'
import { QUESTIONS } from '../questions'
import { parseAnswer, type Question } from '../types'
import { markAnswers, scoreMarks } from '../marking'
import { instantiate, randomSeed, type Seed } from '../variants'
import { CourseLabel } from './StudyShell'

export function questionsForScene(moduleId: string, sceneId: string): Question[] {
  return QUESTIONS.filter((q) => q.moduleId === moduleId && q.sceneId === sceneId)
}

export function InSceneExam({ moduleId, sceneId, scene }: { moduleId: string; sceneId: string; scene: SceneDef }) {
  const list = useMemo(() => questionsForScene(moduleId, sceneId), [moduleId, sceneId])
  const [idx, setIdx] = useState(0)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [showWorking, setShowWorking] = useState(false)
  const recordAnswer = useProgress((s) => s.recordAnswer)
  const [seed, setSeed] = useState<Seed>('original')

  if (!list.length) {
    return (
      <div className="p-4 text-[12.5px] text-mute">
        No practice problems are linked to this scene yet. Browse every question in Exam practice.
      </div>
    )
  }

  const q = instantiate(list[Math.min(idx, list.length - 1)], seed)
  const solved = q.solve()
  const results = checked
    ? markAnswers(q.answers, solved, Object.fromEntries(q.answers.map((a) => [a.key, parseAnswer(inputs[a.key] ?? '')])), q.follow).map((m) => ({ a: m.field, computed: m.computed, ok: m.ok, carried: m.carried, diagnosis: m.diagnosis }))
    : undefined

  // errata describe the past-paper numbers only
  const erratum = q.errata && q.variant === 'original' ? ERRATA.find((e) => e.id === q.errata) : undefined

  const sync3D = () => {
    if (q.params) scene.applyParams?.(q.params)
  }

  const onCheck = () => {
    const marks = markAnswers(q.answers, solved, Object.fromEntries(q.answers.map((a) => [a.key, parseAnswer(inputs[a.key] ?? '')])), q.follow)
    setChecked(true)
    const { got, of } = scoreMarks(marks)
    recordAnswer(q.id, got === of, of ? got / of : 0)
  }

  return (
    <div className="space-y-3.5 p-4 text-[13px]">
      {list.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-2.5">
          {list.map((item, i) => (
            <button
              key={item.id}
              onClick={() => {
                setIdx(i)
                setSeed('original')
                setInputs({})
                setChecked(false)
                setShowWorking(false)
              }}
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                i === idx ? 'bg-accent text-accent-ink' : 'border border-line-2 bg-panel-2 text-mute hover:text-ink'
              }`}
            >
              Problem {i + 1}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <Badge tone="info">
          <CourseLabel course={q.course} />
        </Badge>
        <Badge>{q.topic}</Badge>
        {q.variant !== 'original' ? <Badge tone="accent">new numbers</Badge> : null}
        {erratum ? <Badge tone="warn">Published answer differs</Badge> : null}
      </div>

      <div>
        <h3 className="text-[14.5px] font-semibold text-ink">{q.title}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink/85">{q.statement}</p>
      </div>

      {q.vary ? (
        <div className="flex items-center gap-3 text-[12px]">
          <button
            onClick={() => {
              setSeed(randomSeed())
              setInputs({})
              setChecked(false)
              setShowWorking(false)
            }}
            className="rounded-lg border border-line-2 bg-panel-2 px-2.5 py-1 font-medium text-ink hover:border-accent/40"
            title="The same problem with different numbers"
          >
            New numbers
          </button>
          {q.variant !== 'original' ? (
            <button onClick={() => (setSeed('original'), setInputs({}), setChecked(false))} className="text-mute hover:text-ink">
              Past-paper numbers
            </button>
          ) : null}
        </div>
      ) : null}

      {q.params ? (
        <button
          onClick={sync3D}
          className="w-full rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-[12px] font-semibold text-accent hover:bg-accent/20 transition-colors"
        >
          ↻ Load Question Parameters into Live 3D Model
        </button>
      ) : null}

      <div className="space-y-2">
        {q.answers.map((a, i) => {
          const res = results?.[i]
          return (
            <div key={a.key} className="space-y-1">
            <label className="flex items-center gap-2 rounded-xl border border-line bg-panel-2/70 px-3 py-2">
              <span className="min-w-[56px] text-[12.5px] text-ink">
                <Tex tex={a.label} />
              </span>
              <input
                inputMode="decimal"
                placeholder="Enter value…"
                value={inputs[a.key] ?? ''}
                onChange={(e) => {
                  setInputs({ ...inputs, [a.key]: e.target.value })
                  setChecked(false)
                }}
                className={`w-full min-w-0 rounded-md border bg-bg px-2 py-1 font-mono text-[12.5px] text-ink outline-none focus:border-accent ${
                  res ? (res.ok ? 'border-accent/70' : 'border-danger/70') : 'border-line-2'
                }`}
              />
              <span className="shrink-0 font-mono text-[11.5px] text-mute">{a.unit}</span>
              {res ? (
                <span className={`shrink-0 font-mono text-[12px] font-bold ${res.ok ? 'text-accent' : res.carried ? 'text-info' : 'text-danger'}`}>
                  {res.ok ? '✓' : res.carried ? '½' : `✗ (${n(res.computed)})`}
                </span>
              ) : null}
            </label>
            {res?.diagnosis ? <p className={`px-1 text-[11.5px] leading-snug ${res.carried ? 'text-info' : 'text-warn'}`}>{res.diagnosis.message}</p> : null}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCheck}
          className="flex-1 rounded-xl bg-accent px-3 py-2 text-[12.5px] font-semibold text-accent-ink shadow-sm hover:brightness-110 transition-all"
        >
          Check Answer
        </button>
        <button
          onClick={() => setShowWorking((w) => !w)}
          className="rounded-xl border border-line-2 bg-panel-2 px-3 py-2 text-[12px] font-medium text-ink hover:bg-panel-3 transition-colors"
        >
          {showWorking ? 'Hide Working' : 'Show Working'}
        </button>
      </div>

      {erratum && (checked || showWorking) ? (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-[12px] leading-relaxed text-ink">
          <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-warn">
            The published answer differs
          </div>
          <p className="mt-1 text-ink/90">
            <b>Published answer:</b> {erratum.says}
          </p>
          <p className="mt-0.5 text-accent">
            <b>Verified calculation:</b> {erratum.correct}
          </p>
        </div>
      ) : null}

      {showWorking ? (
        <div className="rounded-xl border border-line bg-panel-2/40 p-2.5">
          <Working steps={q.working(solved)} />
        </div>
      ) : null}
    </div>
  )
}
