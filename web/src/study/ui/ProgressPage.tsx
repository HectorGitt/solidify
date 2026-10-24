import { Link } from 'react-router-dom'
import { MODULES } from '@/modules/catalog'
import { useProgress, summarise } from '../progress'
import { QUESTIONS } from '../questions'
import { COURSES } from '../types'
import { SceneMark } from './badges'
import { Bar, CourseLabel, StudyShell } from './StudyShell'

const liveScenes = (moduleIds?: string[]) =>
  MODULES.filter((m) => !moduleIds || moduleIds.includes(m.id)).flatMap((m) => m.scenes.filter((s) => s.load).map((s) => ({ m, s })))

function Stat({ label, value, total, tone }: { label: string; value: number; total: number; tone?: 'accent' | 'info' | 'warn' }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex justify-between text-[11.5px] text-mute">
        <span>{label}</span>
        <span className="font-mono text-ink/80">
          {value}/{total}
        </span>
      </div>
      <Bar value={value} total={total} tone={tone} />
    </div>
  )
}

export function ProgressPage() {
  const p = useProgress()
  const allScenes = liveScenes()
  const all = summarise(p, allScenes.map((x) => x.s.id), QUESTIONS.map((q) => q.id))

  return (
    <StudyShell
      title="Your progress"
      lead="Scenes you have opened, guided tours you have finished and exam questions you have answered. Stored only in this browser."
      right={
        <button
          onClick={() => {
            if (window.confirm('Clear all study progress on this device?')) p.reset()
          }}
          className="rounded-lg border border-danger/50 px-3 py-1.5 text-[12.5px] text-danger hover:bg-danger/10"
        >
          Reset progress
        </button>
      }
    >
      <section className="mb-6 flex flex-wrap gap-4 rounded-2xl border border-line bg-panel p-4">
        <Stat label="Scenes opened" value={all.opened} total={all.scenes} />
        <Stat label="Tours finished" value={all.toured} total={all.scenes} tone="info" />
        <Stat label="Questions solved" value={all.solved} total={all.questions} tone="warn" />
      </section>

      <h2 className="mb-2 text-[15px] font-semibold">By course</h2>
      <section className="mb-8 grid gap-3 sm:grid-cols-2">
        {COURSES.map((c) => {
          const mods = MODULES.filter((m) => m.courses.includes(c.id)).map((m) => m.id)
          const qs = QUESTIONS.filter((q) => q.course === c.id)
          const sc = liveScenes(mods)
          const s = summarise(p, sc.map((x) => x.s.id), qs.map((q) => q.id))
          return (
            <div key={c.id} className="rounded-2xl border border-line bg-panel-2/60 p-4">
              <div className="mb-3 text-[14px] font-semibold">
                <CourseLabel course={c.id} />
              </div>
              <div className="space-y-2.5">
                <Stat label="Scenes opened" value={s.opened} total={s.scenes} />
                <Stat label="Tours finished" value={s.toured} total={s.scenes} tone="info" />
                <Stat label={`Questions solved (${s.attempted} attempted)`} value={s.solved} total={s.questions} tone="warn" />
              </div>
            </div>
          )
        })}
      </section>

      <h2 className="mb-2 text-[15px] font-semibold">By system</h2>
      <section className="space-y-3">
        {MODULES.map((m) => {
          const scenes = m.scenes.filter((s) => s.load)
          if (!scenes.length) return null
          const qs = QUESTIONS.filter((q) => q.moduleId === m.id)
          const s = summarise(p, scenes.map((x) => x.id), qs.map((q) => q.id))
          return (
            <details key={m.id} className="rounded-2xl border border-line bg-panel p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-4">
                <span className="w-48 text-[14px] font-semibold">{m.title}</span>
                <Stat label="Opened" value={s.opened} total={s.scenes} />
                <Stat label="Tours" value={s.toured} total={s.scenes} tone="info" />
                {s.questions ? <Stat label="Questions" value={s.solved} total={s.questions} tone="warn" /> : <div className="flex-1" />}
              </summary>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                {scenes.map((sc) => {
                  const r = p.scenes[sc.id]
                  const sq = qs.filter((q) => q.sceneId === sc.id)
                  const solved = sq.filter((q) => (p.questions[q.id]?.correct ?? 0) > 0).length
                  return (
                    <li key={sc.id}>
                      <Link to={`/m/${m.id}/${sc.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-panel-2">
                        <SceneMark sceneId={sc.id} />
                        <span className="truncate text-ink/85">{sc.title}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-dim">
                          {r?.tour ? 'tour ✓' : ''}
                          {sq.length ? ` · ${solved}/${sq.length} Q` : ''}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </details>
          )
        })}
      </section>
    </StudyShell>
  )
}

export default ProgressPage
