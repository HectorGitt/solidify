import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MODULES } from '@/modules/catalog'
import type { ModuleDef } from '@/modules/types'
import { ModuleProgress } from '@/study/ui/badges'
import { RigEquations, RigReadings, rigFacts } from './rigFacts'
import { useTheme } from './theme'

/* the labs catalogue: shared by the home page and the Labs page */

export const MEDIA = './media'

export const ALL_ORDER = [
  'engine',
  'mechanisms',
  'powertrain',
  'materials',
  'hydraulics',
  'thermal',
  'traction',
  'elements',
  'pto',
  'vibration',
  'steering',
  'drawing',
  'chassis',
  'implements',
  'testing',
  'field',
]

export const DISCIPLINES: { id: string; label: string; modules: string[] }[] = [
  { id: 'all', label: 'All systems', modules: ALL_ORDER },
  { id: 'labs', label: 'Engineering labs', modules: ['mechanisms', 'materials', 'thermal', 'drawing'] },
  { id: 'power', label: 'Power & drivetrain', modules: ['engine', 'powertrain', 'pto', 'hydraulics', 'elements', 'vibration'] },
  { id: 'field', label: 'Traction & implements', modules: ['traction', 'steering', 'chassis', 'implements', 'testing', 'field'] },
]

/** Systems still being finished: listed as coming soon on the home page, not shown as tiles. */
export const SOON = new Set(['processing', 'water', 'structures', 'precision'])
export const READY = MODULES.filter((m) => !SOON.has(m.id))

/** Scene shown on each module card / opened by it. */
export const FEATURED: Record<string, string> = {
  engine: 'cooling',
  powertrain: 'differential',
  pto: 'pto-shaft',
  hydraulics: 'draft-control',
  steering: 'boxes',
  traction: 'tracks',
  chassis: 'stability',
  implements: 'combine',
  elements: 'chains',
  testing: 'dynamometers',
  vibration: 'seat',
  field: 'field',
  processing: 'palm-oil',
  water: 'irrigation-methods',
  structures: 'farmstead',
  precision: 'see-and-spray',
  mechanisms: 'four-bar',
  materials: 'tensile',
  thermal: 'steam-plant',
  drawing: 'interpenetration',
}

/**
 * A scene render for the current theme (`<name>-light.webp` / `<name>-dark.webp`, made by
 * scripts/capture-tiles.mjs), quietly falling back to a hatched placeholder if it's missing.
 */
export function Media({ name, alt, className }: { name: string; alt: string; className?: string }) {
  const theme = useTheme((s) => s.theme)
  const src = `${MEDIA}/${name}-${theme}.webp`
  const [failed, setFailed] = useState<string | null>(null)
  if (failed === src)
    return (
      <div
        className={`${className ?? ''} bg-[var(--color-stage)]`}
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent) 0 2px, transparent 2px 16px)' }}
        aria-label={alt}
      />
    )
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} onError={() => setFailed(src)} />
}

/** a system as a big picture tile, opening its featured rig */
export function ModuleTile({ m, academic, big }: { m: ModuleDef; academic: boolean; big: boolean }) {
  const live = m.scenes.filter((s) => s.load)
  const featured = FEATURED[m.id] ?? live[0]?.id
  const exam = m.scenes.filter((s) => s.exam).length
  // on hover, the rigs inside replace the blurb (their pictures and names, each opening its rig)
  const strip = [...live.filter((s) => s.id === featured), ...live.filter((s) => s.id !== featured)].slice(0, big ? 4 : 3)
  // the rig whose figures show: the featured one, or the one under the pointer in the strip
  const [focusId, setFocusId] = useState(featured)
  const focus = live.find((s) => s.id === focusId) ?? live.find((s) => s.id === featured)
  const facts = focus ? rigFacts(m.id, focus.id) : null
  return (
    <div className={`group relative overflow-hidden rounded-3xl border border-line bg-[var(--color-stage)] ${big ? 'h-[380px] lg:col-span-6' : 'h-[300px] lg:col-span-4'} sm:col-span-1`}>
      <Link to={`/m/${m.id}/${featured}`} aria-label={`${m.title}: open`} className="absolute inset-0">
        <Media name={`modules/${m.id}`} alt={`${m.title}: interactive 3D cutaway`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      </Link>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--color-stage)] via-[color-mix(in_srgb,var(--color-stage)_80%,transparent)] to-transparent p-6 pt-24">
        <div className="flex items-center gap-2 text-[12px] font-medium text-accent">
          {live.length} rigs
          {academic && exam > 0 ? <span className="text-warn">· {exam} often examined</span> : null}
        </div>
        <h3 className={`mt-1.5 font-semibold tracking-[-0.02em] text-ink ${big ? 'text-[28px]' : 'text-[21px]'}`}>{m.title}</h3>
        {/* at rest: the blurb and the featured rig's figures; on hover (pointer devices) they fold away and the
            rigs inside slide up, one after another; touch screens keep the rest view, the Labs page lists the rigs */}
        <div className="grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:grid-rows-[0fr] [@media(hover:hover)]:group-hover:opacity-0 [@media(hover:hover)]:group-focus-within:grid-rows-[0fr] [@media(hover:hover)]:group-focus-within:opacity-0">
          <div className="min-h-0 overflow-hidden">
            <p className={`mt-1 text-[13.5px] leading-relaxed text-mute ${big ? 'line-clamp-2 max-w-[480px]' : 'line-clamp-1'}`}>{m.blurb}</p>
            {facts?.readings.length ? (
              <div className="mt-3">
                <RigReadings readings={facts.readings} max={big ? 3 : 2} />
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:grid-rows-[1fr] [@media(hover:hover)]:group-focus-within:grid-rows-[1fr]">
          <div className="pointer-events-auto min-h-0 overflow-hidden">
            {focus ? (
              <div className="mt-2 translate-y-2 opacity-0 transition duration-300 motion-reduce:transition-none [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100">
                <div className="truncate text-[12px] text-mute">
                  <span className="font-medium text-ink">{focus.title}</span>
                  {facts?.readings.length ? ` · ${facts.readings.slice(0, 2).map((r) => `${r.label} ${r.value}${r.unit ? ` ${r.unit}` : ''}`).join(' · ')}` : ` · ${focus.summary}`}
                </div>
                {big && facts?.equations[0] ? (
                  <div className="mt-1">
                    <RigEquations equations={facts.equations} max={1} />
                  </div>
                ) : null}
              </div>
            ) : null}
            <ul className="mt-2 flex gap-2 pb-0.5">
              {strip.map((s, i) => (
                <li
                  key={s.id}
                  // each card rises a beat after the one before it
                  style={{ transitionDelay: `${90 + i * 70}ms` }}
                  className="min-w-0 flex-1 translate-y-4 opacity-0 transition duration-500 ease-out motion-reduce:translate-y-0 motion-reduce:transition-none [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100"
                >
                  <Link to={`/m/${m.id}/${s.id}`} title={s.summary} onMouseEnter={() => setFocusId(s.id)} onFocus={() => setFocusId(s.id)} className="block rounded-xl border border-line-2 bg-[var(--color-scrim)] p-1.5 backdrop-blur-md transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/60">
                    <span className="relative block aspect-[16/10] overflow-hidden rounded-lg bg-[var(--color-stage)]">
                      <Media name={`scenes/${m.id}--${s.id}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    </span>
                    <span className="mt-1 block truncate px-0.5 text-[11.5px] font-medium text-ink">{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {academic ? (
          <div className="mt-3 max-w-[260px]">
            <ModuleProgress moduleId={m.id} />
          </div>
        ) : null}
      </div>
      <Link to="/labs" className="absolute right-5 top-5 rounded-full bg-[var(--color-scrim)] px-3 py-1.5 text-[11.5px] font-medium text-ink opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 focus:opacity-100">
        All {live.length} rigs
      </Link>
    </div>
  )
}
