import { useLocation, useNavigate } from 'react-router-dom'
import { detailLinks } from '@/content/drilldown'
import { useParts } from '@/parts/registry'
import { MATERIALS } from '@/render/materials'
import { useView } from '@/render/view'
import { useAcademic } from './audience'
import { focusPart } from './camera'
import { Badge } from './controls'
import { Icon } from './icons'
import { enterInside, exitInside, useInside } from './inside'
import { goTo } from './navigate'
import { PartExtras } from './PartExtras'

const ROLE_LABEL = { housing: 'Housing', moving: 'Moving part', fluid: 'Fluid', static: 'Stationary part' }

/** Floating information card for the selected part. */
export function PartCard() {
  const selectedId = useView((s) => s.selectedId)
  const part = useParts((s) => (selectedId ? s.parts[selectedId] : undefined))
  const parentName = useParts((s) => (part?.parentId ? s.parts[part.parentId]?.name : undefined))
  const select = useView((s) => s.select)
  const isolatedId = useView((s) => s.isolatedId)
  const isolate = useView((s) => s.isolate)
  const toggleHidden = useView((s) => s.toggleHidden)
  const explodeScope = useView((s) => s.explodeScope)
  const hasChildren = useParts((s) => (selectedId ? Object.values(s.parts).some((x) => x.parentId === selectedId) : false))
  const insideId = useInside((s) => s.id)
  const academic = useAcademic()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const here = pathname.replace(/^\/m\//, '')
  if (!part) return null
  const links = detailLinks(part, here)
  const goDeeper = (route: string) => goTo(navigate, route, { fromPartId: part.id, fromPartName: part.name, carryContext: true })
  const mat = part.material ? MATERIALS[part.material] : undefined
  return (
    <div className="pointer-events-auto w-[min(340px,calc(100vw-1.5rem))] rounded-xl border border-line-2 bg-panel/95 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-start gap-2 border-b border-line px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          {parentName ? <div className="truncate text-[10.5px] uppercase tracking-wide text-dim">{parentName}</div> : null}
          <h2 className="text-[15px] font-semibold leading-tight text-ink">{part.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge>{ROLE_LABEL[part.role]}</Badge>
            {mat ? <Badge>{mat.label}</Badge> : null}
            {academic && part.beyondNotes ? (
              <Badge tone="info" title="Detail added from standard texts, beyond the course notes">
                beyond notes
              </Badge>
            ) : null}
          </div>
        </div>
        <button aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-panel-3 hover:text-ink" onClick={() => select(null)}>
          <Icon.close width={16} height={16} />
        </button>
      </div>
      <div className="max-h-[42vh] space-y-2 overflow-y-auto px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink/85">
        {part.info?.summary ? <p className="text-ink">{part.info.summary}</p> : null}
        {part.info?.role ? (
          <p>
            <span className="font-medium text-accent">Function. </span>
            {part.info.role}
          </p>
        ) : null}
        {part.info?.details ? <p className="text-mute">{part.info.details}</p> : null}
        <PartExtras key={part.id} part={part} route={here} />
      </div>
      {part.info?.inside || insideId === part.id ? (
        <div className="border-t border-line px-3.5 py-2">
          {insideId === part.id ? (
            <button onClick={exitInside} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent/50 bg-accent/10 px-2 py-1.5 text-[12.5px] font-medium text-accent hover:bg-accent/20">
              <Icon.back width={14} height={14} /> Back to the whole machine
            </button>
          ) : (
            <>
              <button onClick={() => enterInside(part)} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:brightness-110">
                <Icon.eye width={14} height={14} /> Look inside — here
              </button>
              <p className="mt-1 text-[11px] leading-snug text-dim">{part.info?.inside}</p>
            </>
          )}
        </div>
      ) : null}
      {links.length ? (
        <div className="border-t border-line px-2 py-1.5">
          <div className="px-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-dim">Go deeper</div>
          {links.map((l) => (
            <button
              key={l.route}
              onClick={() => goDeeper(l.route)}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-accent hover:bg-accent/10"
            >
              <Icon.chevron width={14} height={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
              <span className="truncate">{l.title}</span>
              <span className="ml-auto shrink-0 text-[11px] text-dim">in detail</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex gap-1 border-t border-line px-2 py-1.5">
        <button className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink/85 hover:bg-panel-3" onClick={() => focusPart(part.id)}>
          <Icon.target width={14} height={14} /> Focus
        </button>
        <button
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] hover:bg-panel-3 ${isolatedId === part.id ? 'text-accent' : 'text-ink/85'}`}
          onClick={() => isolate(isolatedId === part.id ? null : part.id)}
        >
          <Icon.isolate width={14} height={14} /> {isolatedId === part.id ? 'Show context' : 'Isolate'}
        </button>
        <button
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink/85 hover:bg-panel-3"
          onClick={() => {
            toggleHidden(part.id)
            select(null)
          }}
        >
          <Icon.eyeOff width={14} height={14} /> Hide
        </button>
        {hasChildren ? (
          <button
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] hover:bg-panel-3 ${explodeScope === part.id ? 'text-accent' : 'text-ink/85'}`}
            onClick={() => {
              const v = useView.getState()
              if (v.explodeScope === part.id) {
                v.setExplodeScope(null)
                v.setExplode(0)
              } else {
                v.setExplodeScope(part.id)
                v.setExplode(1)
              }
            }}
            title="Pull apart just this assembly"
          >
            <Icon.explode width={14} height={14} /> {explodeScope === part.id ? 'Reassemble' : 'Explode this'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
