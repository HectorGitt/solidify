import { forwardRef, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { Badge, fmt } from '@/ui/controls'

/** Shared panel bits for the vibration and testing scenes (M10, M11). */

export interface Preset {
  id: string
  label: string
  /** what the notes / marking guide expect */
  note: string
  apply: () => void
  /** a discrepancy between the notes and the computed value */
  flag?: string
}

export function PresetGrid({ presets, active, onPick }: { presets: Preset[]; active: string | null; onPick: (id: string) => void }) {
  const cur = presets.find((p) => p.id === active)
  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              p.apply()
              onPick(p.id)
            }}
            className={`rounded-md border px-2 py-1.5 text-left text-[12px] leading-tight ${active === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
          >
            {p.label}
            {p.flag ? (
              <span className="ml-1 align-middle">
                <Badge tone="warn">!</Badge>
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {cur ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{cur.note}</p> : null}
      {cur?.flag ? (
        <div className="mt-1.5 rounded-md border border-warn/40 bg-warn/5 px-2 py-1.5 text-[11px] leading-snug text-warn/90">
          <Badge tone="warn">note discrepancy</Badge> {cur.flag}
        </div>
      ) : null}
    </>
  )
}

export function Note({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'warn' | 'mute' | 'info' }) {
  const cls = { dim: 'text-dim', warn: 'text-warn', mute: 'text-mute', info: 'text-info' }[tone]
  return <p className={`mt-1 text-[11px] leading-snug ${cls}`}>{children}</p>
}

/** Slider on a logarithmic scale (for m, k, c that span decades). Same look as ui/controls Slider. */
export function LogSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  digits = 3,
  hint,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  unit?: string
  onChange: (v: number) => void
  digits?: number
  hint?: string
}) {
  const lo = Math.log10(min)
  const hi = Math.log10(max)
  const pos = Math.log10(Math.max(min, Math.min(max, value)))
  const fill = ((pos - lo) / (hi - lo)) * 100
  return (
    <label className="mb-2.5 block" title={hint}>
      <div className="mb-0.5 flex items-baseline justify-between text-[12.5px]">
        <span className="text-ink/90">{label}</span>
        <span className="font-mono text-[12px] text-accent">
          {fmt(value, digits)}
          {unit ? <span className="ml-0.5 text-mute">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        className="slider"
        min={lo}
        max={hi}
        step={(hi - lo) / 400}
        value={pos}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => {
          const v = Math.pow(10, parseFloat(e.target.value))
          // round to 3 significant figures so presets and typed values read cleanly
          onChange(Number(v.toPrecision(3)))
        }}
      />
    </label>
  )
}

/** A small labelled number input. */
export function NumberField({ label, value, onChange, step = 1, unit, hint }: { label: ReactNode; value: number; onChange: (v: number) => void; step?: number; unit?: string; hint?: string }) {
  return (
    <label className="mb-1.5 flex items-center justify-between gap-2 text-[12px]" title={hint}>
      <span className="text-ink/90">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v)) onChange(v)
          }}
          className="w-24 rounded border border-line-2 bg-panel-2 px-1.5 py-0.5 text-right font-mono text-[12px] text-accent"
        />
        {unit ? <span className="w-10 text-[11px] text-mute">{unit}</span> : null}
      </span>
    </label>
  )
}

/** Compact table. */
export function Table({ head, rows, highlight }: { head: ReactNode[]; rows: ReactNode[][]; highlight?: number }) {
  return (
    <table className="w-full border-collapse font-mono text-[11.5px]">
      <thead>
        <tr className="text-left text-dim">
          {head.map((h, i) => (
            <th key={i} className="border-b border-line px-1 py-0.5 font-normal">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i === highlight ? 'bg-accent/10 text-ink' : 'text-ink/80'}>
            {r.map((c, j) => (
              <td key={j} className="border-b border-line/50 px-1 py-0.5">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ------------------------------ 3D helpers ------------------------------ */

/** Unit force arrow along +Y (shaft 0…0.78, head to 1). Scale the group's y to set its length. */
export function useArrowGeometry(radius = 0.006) {
  return useMemo(() => {
    const shaft = new THREE.CylinderGeometry(radius, radius, 0.78, 12)
    shaft.translate(0, 0.39, 0)
    const head = new THREE.ConeGeometry(radius * 2.6, 0.22, 16)
    head.translate(0, 0.89, 0)
    return { shaft, head }
  }, [radius])
}

/** Force arrow helper: not a Part (not selectable), coloured, drawn over the model. */
export const Arrow = forwardRef<THREE.Group, { color: string; radius?: number; position?: [number, number, number]; rotation?: [number, number, number] }>(function Arrow(
  { color, radius = 0.006, position, rotation },
  ref,
) {
  const g = useArrowGeometry(radius)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.5 }), [color])
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <mesh geometry={g.shaft} material={mat} />
      <mesh geometry={g.head} material={mat} />
    </group>
  )
})

/** Point an arrow group (built along +Y) from a base along a direction with a length. 0 hides it. */
export function setArrow(g: THREE.Group | null, base: THREE.Vector3, dir: THREE.Vector3, length: number) {
  if (!g) return
  if (Math.abs(length) < 1e-5) {
    g.visible = false
    return
  }
  g.visible = true
  g.position.copy(base)
  const d = dir.clone().normalize()
  if (length < 0) d.negate()
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)
  g.scale.set(1, Math.abs(length), 1)
}
