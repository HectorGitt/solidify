import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ERRATA } from '@/content/errata'
import { findModule } from '@/modules/catalog'
import { useAcademic } from '@/ui/audience'
import { Badge } from '@/ui/controls'
import { Media } from '@/ui/labsCatalog'
import { Tex } from '@/ui/Tex'
import { FORMULAS, type Formula } from '../formulas'
import { COURSES, type Course } from '../types'
import { CourseLabel, Pills, StudyShell } from './StudyShell'

const norm = (s: string) => s.toLowerCase().replace(/[\\{}^_]/g, ' ')

/** the rig a formula runs in: its picture (light or dark, from the real 3D scene) and its title */
const rigOf = (key: string) => {
  const [m, s] = key.split('/')
  const scene = findModule(m)?.scenes.find((x) => x.id === s)
  return scene ? { m, s, title: scene.title } : null
}

/** a topic's rig, large, at the head of its formulas: the machine or test the equations describe, opening it live */
function RigPicture({ sceneKey }: { sceneKey: string }) {
  const rig = rigOf(sceneKey)
  if (!rig) return null
  return (
    <Link to={`/m/${rig.m}/${rig.s}`} className="group relative block aspect-[16/9] overflow-hidden rounded-xl border border-line bg-[var(--color-stage)] lg:aspect-[4/3]" title={`Open ${rig.title} in 3D`}>
      <Media name={`scenes/${rig.m}--${rig.s}`} alt={`${rig.title}, in 3D`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[12px] font-medium text-white">
        {rig.title} <span className="opacity-80">· open in 3D →</span>
      </span>
    </Link>
  )
}

/** ownPicture: from a different rig than its topic's (a small picture of its own); link: name its rig (the topic shows no picture of it) */
function FormulaRow({ f, ownPicture, link }: { f: Formula; ownPicture: boolean; link: boolean }) {
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
        {scene && (ownPicture || link) ? (
          <Link to={`/m/${m}/${s}`} className="ml-auto flex items-center gap-2 text-[11.5px] text-accent hover:underline" title={`Open ${scene.title} in 3D`}>
            {/* from another rig than the rest of its topic: its own picture */}
            {ownPicture ? (
              <span className="relative block h-9 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-[var(--color-stage)]">
                <Media name={`scenes/${m}--${s}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </span>
            ) : null}
            {scene.title} →
          </Link>
        ) : null}
      </div>
      <div className="mt-1 overflow-x-auto overflow-y-hidden py-0.5 text-[14px] text-ink">
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
    const out: { course: Course; topics: { topic: string; items: Formula[]; main: string | null; picture: boolean }[] }[] = []
    for (const c of COURSES) {
      const inC = hits.filter((f) => f.course === c.id)
      if (!inC.length) continue
      const topics = [...new Set(inC.map((f) => f.topic))].map((topic): { topic: string; items: Formula[]; main: string | null; picture: boolean } => {
        const items = inC.filter((f) => f.topic === topic)
        // the rig most of the topic's formulas run in: its picture heads the topic
        const counts = new Map<string, number>()
        for (const f of items) if (rigOf(f.scene)) counts.set(f.scene, (counts.get(f.scene) ?? 0) + 1)
        const main: string | null = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        return { topic, items, main, picture: !!main }
      })
      // a rig's picture once per subject: a later topic on the same rig links to it in each row instead
      const shown = new Set<string>()
      for (const t of topics) {
        if (t.main && shown.has(t.main)) t.picture = false
        else if (t.main) shown.add(t.main)
      }
      out.push({ course: c.id, topics })
    }
    return { out, count: hits.length }
  }, [q, course])

  return (
    <StudyShell title="Formula sheet" lead={`${FORMULAS.length} equations used across the scenes, grouped by course and topic. Each shows the rig it runs in; open one to try it live.`}>
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
              <div className={t.picture ? 'grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]' : ''}>
                {t.main && t.picture ? (
                  <div className="max-w-[420px] lg:max-w-none">
                    <RigPicture sceneKey={t.main} />
                  </div>
                ) : null}
                <ul className="grid content-start gap-2 md:grid-cols-2">
                  {t.items.map((f) => (
                    <FormulaRow key={f.id} f={f} ownPicture={!!t.main && f.scene !== t.main} link={!t.picture} />
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </section>
      ))}
      {groups.count === 0 ? <p className="text-mute">No formulas match.</p> : null}
    </StudyShell>
  )
}

export default FormulasPage
