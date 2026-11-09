import { useMemo } from 'react'
import { buildPartGeometry } from '@/note3d/builder'
import { fmtNum } from '@/note3d/ChartView'
import { buildKinematics } from '@/note3d/kinematics'
import { MATERIAL_PROPS, meshVolume, partParameters, relatedCalculations, SHAPE_NAMES, shapeSizes } from '@/note3d/partInfo'
import { ALLOWED_MATERIALS, type EvaluatedCalculation, type NotePartSpec, type NoteSceneSpec } from '@/note3d/schema'
import { MATERIALS, type MaterialKey } from '@/render/materials'
import { useView } from '@/render/view'
import { Icon } from '@/ui/icons'
import { Tex } from '@/ui/Tex'

const ROLE: Record<string, string> = { housing: 'Housing', moving: 'Moving part', fluid: 'Fluid', static: 'Fixed part' }
const AXIS: Record<string, string> = { x: 'X', y: 'Y', z: 'Z' }
const fmtVal = (v: number, unit?: string) => (unit === 'm' ? `${(v * 1000).toFixed(1)} mm` : `${Number(v.toPrecision(4))}${unit ? ` ${unit}` : ''}`)

/**
 * Everything about one part: what it is and does, its real sizes, material and mass, the sizes that drive
 * it (as sliders), the calculations it takes part in, and what can be done with it.
 */
export function PartInspector({
  spec,
  part,
  scope,
  calcResults,
  editable,
  onParam,
  onMaterial,
  onRemove,
  onAsk,
}: {
  spec: NoteSceneSpec
  part: NotePartSpec
  scope: Record<string, number>
  calcResults: EvaluatedCalculation[]
  editable: boolean
  onParam: (id: string, v: number) => void
  onMaterial: (mat: MaterialKey) => void
  onRemove: () => void
  onAsk: (question: string) => void
}) {
  const isolatedId = useView((s) => s.isolatedId)
  const hidden = useView((s) => s.hidden)
  const mat: MaterialKey = part.material && part.material in MATERIALS ? part.material : 'steel'
  const props = MATERIAL_PROPS[mat]

  // the solid as built, for its volume (and so its mass)
  const volume = useMemo(() => {
    try {
      return meshVolume(buildPartGeometry(part.shapes, scope))
    } catch {
      return 0
    }
  }, [part.shapes, scope])
  const mass = props && volume > 0 ? volume * props.density : null

  const paramIds = useMemo(() => partParameters(part, spec.parameters.map((p) => p.id)), [part, spec.parameters])
  const drivers = spec.parameters.filter((p) => paramIds.includes(p.id))
  const related = useMemo(() => {
    const ids = new Set(relatedCalculations(spec.calculations, paramIds).map((c) => c.id))
    return calcResults.filter((r) => ids.has(r.spec.id))
  }, [spec.calculations, paramIds, calcResults])

  // how it moves in the 3D view: worked out from its mounts when it is part of a mechanism
  const kinText = useMemo(() => {
    try {
      const kin = buildKinematics(spec, scope)
      if (!kin.derived.has(part.id)) return null
      kin.update(0)
      const a = kin.move(part.id)
      kin.update(1)
      const b = kin.move(part.id)
      const w = (b?.spin ?? 0) - (a?.spin ?? 0)
      const rpm = fmtNum((Math.abs(w) * 60) / (2 * Math.PI))
      const via = spec.parts.find((p) => p.id === part.mount?.target)?.name
      if (kin.drivers.has(part.id)) return `Drives the mechanism, ${rpm} rev/min in the animation`
      if (Math.abs(w) > 1e-9) return `Turns at ${rpm} rev/min in the animation${via ? `, driven through the ${via}` : ''}`
      return via ? `Moves with the ${via}` : 'Moves with the mechanism'
    } catch {
      return null
    }
  }, [spec, scope, part.id, part.mount?.target])
  const speed = part.motion ? Number(scope[String(part.motion.speed)] ?? part.motion.speed) : 0
  const motionText = kinText ?? (part.motion
    ? part.motion.kind === 'rotate'
      ? `Turns about the ${AXIS[part.motion.axis]} axis${Number.isFinite(speed) && speed ? `, ${fmtNum(Math.abs(speed) * 60 / (2 * Math.PI))} rev/min in the animation` : ''}`
      : part.motion.kind === 'translate'
        ? `Slides along the ${AXIS[part.motion.axis]} axis`
        : `Rocks about the ${AXIS[part.motion.axis]} axis`
    : 'Does not move')

  const isIsolated = isolatedId === part.id
  const isHidden = hidden.includes(part.id)

  return (
    <div className="space-y-4">
      {/* what it is */}
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">{part.role === 'moving' && !part.motion ? 'Part' : ROLE[part.role ?? 'static'] ?? 'Part'}</span>
          <span className="rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-mute">{motionText}</span>
        </div>
        <h3 className="mt-2 text-[17px] font-semibold text-ink">{part.name}</h3>
        {part.info?.summary ? <p className="mt-1 text-[13px] leading-relaxed text-mute">{part.info.summary}</p> : null}
        {part.info?.role && !/^(moving|static|housing|fluid|fixed)$/i.test(part.info.role.trim()) ? <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{part.info.role}</p> : null}
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => useView.getState().isolate(isIsolated ? null : part.id)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${isIsolated ? 'border-ink bg-ink text-bg' : 'border-line-2 text-mute hover:text-ink'}`}>
          <Icon.isolate width={13} height={13} /> {isIsolated ? 'Show all' : 'Isolate'}
        </button>
        <button type="button" onClick={() => useView.getState().toggleHidden(part.id)} className="inline-flex items-center gap-1 rounded-full border border-line-2 px-2.5 py-1 text-[12px] font-medium text-mute transition-colors hover:text-ink">
          {isHidden ? <Icon.eye width={13} height={13} /> : <Icon.eyeOff width={13} height={13} />} {isHidden ? 'Show' : 'Hide'}
        </button>
        <button type="button" disabled={!editable} onClick={() => onAsk(`What does the ${part.name.toLowerCase()} do in this machine, and why is it sized and made the way it is?`)} className="inline-flex items-center gap-1 rounded-full border border-line-2 px-2.5 py-1 text-[12px] font-medium text-mute transition-colors hover:text-ink disabled:opacity-50">
          <Icon.tour width={13} height={13} /> Ask about it
        </button>
        {editable && spec.parts.length > 1 ? (
          <button type="button" onClick={onRemove} className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] text-dim transition-colors hover:text-danger">
            <Icon.close width={12} height={12} /> Remove
          </button>
        ) : null}
      </div>

      {/* its sizes */}
      <section>
        <h4 className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-dim">Size</h4>
        <div className="space-y-2">
          {part.shapes.map((sh, i) => {
            const rows = shapeSizes(sh, scope)
            if (!rows.length) return null
            return (
              <div key={i} className="rounded-2xl border border-line-2 p-3">
                <p className="mb-1.5 text-[12px] font-medium text-ink">{sh.op === 'subtract' ? `Cut: ${SHAPE_NAMES[sh.kind] ?? sh.kind}` : SHAPE_NAMES[sh.kind] ?? sh.kind}</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  {rows.map((r) => (
                    <div key={r.label} className="contents">
                      <dt className="text-mute">{r.label}</dt>
                      <dd className="text-right font-mono text-ink">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </div>
      </section>

      {/* material and mass */}
      <section>
        <h4 className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-dim">Material</h4>
        <div className="space-y-2 rounded-2xl border border-line-2 p-3">
          <select aria-label={`Material of ${part.name}`} disabled={!editable} value={mat} onChange={(e) => onMaterial(e.target.value as MaterialKey)} className="w-full rounded-lg border border-line-2 bg-bg px-2 py-1.5 text-[12.5px] text-ink focus:border-accent focus:outline-none">
            {ALLOWED_MATERIALS.slice(0, 26).map((mk) => (
              <option key={mk} value={mk}>
                {MATERIALS[mk].label}
              </option>
            ))}
          </select>
          {props ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              <dt className="text-mute">Density</dt>
              <dd className="text-right font-mono text-ink">{fmtNum(props.density)} kg/m³</dd>
              {props.E !== undefined ? (
                <>
                  <dt className="text-mute">Young’s modulus E</dt>
                  <dd className="text-right font-mono text-ink">{fmtNum(props.E)} GPa</dd>
                </>
              ) : null}
              {props.yield !== undefined ? (
                <>
                  <dt className="text-mute">Yield strength</dt>
                  <dd className="text-right font-mono text-ink">{fmtNum(props.yield)} MPa</dd>
                </>
              ) : null}
              {mass !== null ? (
                <>
                  <dt className="text-mute">Mass (estimated)</dt>
                  <dd className="text-right font-mono text-ink">{mass >= 1 ? `${fmtNum(mass)} kg` : `${fmtNum(mass * 1000)} g`}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {props?.note ? <p className="text-[11px] text-dim">Typical values for {props.note}.</p> : props ? <p className="text-[11px] text-dim">Typical values; mass from the part’s modelled volume.</p> : null}
        </div>
      </section>

      {/* what drives it */}
      {drivers.length ? (
        <section>
          <h4 className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-dim">Driven by</h4>
          <div className="space-y-3 rounded-2xl border border-line-2 p-3">
            {drivers.map((p) => {
              const v = scope[p.id] ?? p.value
              return (
                <label key={p.id} className="block">
                  <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-ink">{p.label}</span>
                    <span className="font-mono text-mute">{fmtVal(v, p.unit)}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={v} disabled={!editable} onChange={(e) => onParam(p.id, parseFloat(e.target.value))} className="slider w-full" />
                </label>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* the engineering it takes part in */}
      {related.length ? (
        <section>
          <h4 className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-dim">Equations</h4>
          <div className="space-y-2">
            {related.map(({ spec: c, formatted, status }) => (
              <div key={c.id} className={`rounded-2xl border p-3 ${status === 'warn' ? 'border-warn/50 bg-warn/5' : 'border-line-2'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-mute">{c.label}</span>
                  <span className="font-mono text-[15px] font-semibold text-ink">
                    {formatted} <span className="text-[11.5px] font-normal text-mute">{c.unit}</span>
                  </span>
                </div>
                {c.latex ? (
                  <div className="mt-1 overflow-x-auto overflow-y-hidden py-0.5 text-[11.5px] text-mute">
                    <Tex tex={c.latex} />
                  </div>
                ) : null}
                {status === 'warn' && c.limit ? <p className="mt-1 text-[11.5px] text-warn">Over the limit: {c.limit.label ?? 'check this value'}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
