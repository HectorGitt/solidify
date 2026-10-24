import { useMemo, useState } from 'react'
import { ERRATA } from '@/content/errata'
import { formatCitation } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Badge } from '@/ui/controls'
import { Tex } from '@/ui/Tex'
import { Working, n } from '@/ui/Working'
import { useProgress } from '../progress'
import { QUESTIONS } from '../questions'
import { checkAnswer, parseAnswer, type Question } from '../types'
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

  if (!list.length) {
    return (
      <div className="p-4 text-[12.5px] text-mute">
        No past-question problems are directly bound to this scene yet. Browse all course questions in the Exam Bank.
      </div>
    )
  }

  const q = list[Math.min(idx, list.length - 1)]
  const solved = q.solve()
  const results = checked
    ? q.answers.map((a) => ({
        a,
        computed: solved[a.key],
        ok: checkAnswer(a, solved[a.key], parseAnswer(inputs[a.key] ?? '')),
      }))
    : undefined

  const erratum = q.errata ? ERRATA.find((e) => e.id === q.errata) : undefined

  const sync3D = () => {
    if (q.params) scene.applyParams?.(q.params)
  }

  const onCheck = () => {
    const res = q.answers.map((a) => checkAnswer(a, solved[a.key], parseAnswer(inputs[a.key] ?? '')))
    setChecked(true)
    recordAnswer(q.id, res.every(Boolean))
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
        {erratum ? <Badge tone="warn">Note Errata Flagged</Badge> : null}
      </div>

      <div>
        <h3 className="text-[14.5px] font-semibold text-ink">{q.title}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink/85">{q.statement}</p>
      </div>

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
            <label key={a.key} className="flex items-center gap-2 rounded-xl border border-line bg-panel-2/70 px-3 py-2">
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
                <span className={`shrink-0 font-mono text-[12px] font-bold ${res.ok ? 'text-accent' : 'text-danger'}`}>
                  {res.ok ? '✓' : `✗ (${n(res.computed)})`}
                </span>
              ) : null}
            </label>
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
            Note / Marking Guide Discrepancy ({formatCitation(q.cite)})
          </div>
          <p className="mt-1 text-ink/90">
            <b>Notes state:</b> {erratum.says}
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
