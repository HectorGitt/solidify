import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ERRATA } from '@/content/errata'
import { findModule } from '@/modules/catalog'
import { useAcademic } from '@/ui/audience'
import { Badge } from '@/ui/controls'
import { Tex } from '@/ui/Tex'
import { FORMULAS, type Formula } from '../formulas'
import { COURSES, type Course } from '../types'
import { CourseLabel, Pills, StudyShell } from './StudyShell'

const norm = (s: string) => s.toLowerCase().replace(/[\\{}^_]/g, ' ')

function FormulaRow({ f }: { f: Formula }) {
  const academic = useAcademic()
  const [m, s] = f.scene.split('/')
  const scene = findModule(m)?.scenes.find((x) => x.id === s)
  const err = f.errata ? ERRATA.find((e) => e.id === f.errata) : undefined
  return (
    <li className="rounded-xl border border-line bg-panel-2/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-medium text-ink">{f.name}</span>
        {f.beyond ? (
          <Badge tone="info" title="Standard engineering result, added beyond the course notes">
            beyond notes
          </Badge>
        ) : null}
        {academic && err ? (
          <Badge tone="warn" title={err.correct}>
            note discrepancy
          </Badge>
        ) : null}
        {scene ? (
          <Link to={`/m/${m}/${s}`} className="ml-auto text-[11.5px] text-accent hover:underline">
            {scene.title} →
          </Link>
        ) : null}
      </div>
      <div className="mt-1 overflow-x-auto text-[14px] text-ink">
        <Tex tex={f.tex} display />
      </div>
      {f.note ? <p className="text-[11.5px] text-mute">{f.note}</p> : null}
      {academic && err ? <p className="mt-1 text-[11.5px] leading-snug text-warn/90">{err.correct}</p> : null}
    </li>
  )
}

export function FormulasPage() {
  const [q, setQ] = useState('')
  const [course, setCourse] = useState<Course | 'all'>('all')

  const groups = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    const hits = FORMULAS.filter((f) => {
      if (course !== 'all' && f.course !== course) return false
      const hay = norm(`${f.name} ${f.topic} ${f.tex} ${f.note ?? ''} ${f.scene}`)
      return words.every((w) => hay.includes(w))
    })
    const out: { course: Course; topics: { topic: string; items: Formula[] }[] }[] = []
    for (const c of COURSES) {
      const inC = hits.filter((f) => f.course === c.id)
      if (!inC.length) continue
      const topics = [...new Set(inC.map((f) => f.topic))].map((topic) => ({ topic, items: inC.filter((f) => f.topic === topic) }))
      out.push({ course: c.id, topics })
    }
    return { out, count: hits.length }
  }, [q, course])

  return (
    <StudyShell title="Formula sheet" lead={`${FORMULAS.length} equations used across the scenes, grouped by course and topic. Each links to the scene where it runs live.`}>
      <div className="mb-5 space-y-2 rounded-3xl border border-line bg-panel-2/50 p-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: bmep, slip, Hooke, transmissibility…"
          aria-label="Search formulas"
          className="w-full rounded-lg border border-line-2 bg-bg px-3 py-2 text-[13.5px] text-ink outline-none placeholder:text-dim focus:border-accent"
        />
        <Pills label="Subject" value={course} onChange={setCourse} options={[{ value: 'all' as const, label: 'All subjects' }, ...COURSES.map((c) => ({ value: c.id, label: <CourseLabel course={c.id} /> }))]} />
        <p className="text-[11.5px] text-dim">{groups.count} shown</p>
      </div>
      {groups.out.map((g) => (
        <section key={g.course} className="mb-8">
          <h2 className="mb-3 text-[17px] font-semibold">
            <CourseLabel course={g.course} />
          </h2>
          {g.topics.map((t) => (
            <div key={t.topic} className="mb-4">
              <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mute">{t.topic}</h3>
              <ul className="grid gap-2 md:grid-cols-2">
                {t.items.map((f) => (
                  <FormulaRow key={f.id} f={f} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {groups.count === 0 ? <p className="text-mute">No formulas match.</p> : null}
    </StudyShell>
  )
}

export default FormulasPage
