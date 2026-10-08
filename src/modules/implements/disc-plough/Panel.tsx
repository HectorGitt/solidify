import { useMemo, useState } from 'react'
import { DISC_ANGLES, discCutWidth, discHalfChord, toRad } from '@/physics/tillage'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type PresetDef } from '../_tillage/ui'
import { C, DEFAULTS, HARROW, discOf, useDisc, type Implement, type Mode } from './model'

const PRESETS: PresetDef[] = [
  { id: 'lo', label: 'Low range: 42° disc, 15° tilt', note: 'Lower ends of the usual working ranges (disc angle 42–45°, tilt 15–25°).', apply: () => useDisc.getState().set({ implement: 'plough', discAngle: 42, tilt: 15 }) },
  { id: 'hi', label: 'High range: 45° disc, 25° tilt', note: 'Upper ends of the ranges: a wider cut per disc at the same depth.', apply: () => useDisc.getState().set({ implement: 'plough', discAngle: 45, tilt: 25 }) },
  { id: 'clay', label: '3 × 660 mm in clay', note: 'Three 26-in discs 180 mm deep in clay (2 N/cm²) at 5 km/h. Draft = unit draft × furrow area, as for the mouldboard.', apply: () => useDisc.getState().set({ ...DEFAULTS }) },
  { id: 'harrow', label: 'Tandem harrow, 18° gangs', note: 'Mounted tandem disc harrow 80 mm deep: front gangs throw soil out, rear gangs throw it back.', apply: () => useDisc.getState().set({ implement: 'harrow', gangAngle: 18, harrowDepth: 0.08 }) },
]

export function Panel() {
  const st = useDisc()
  const [active, setActive] = useState<string | null>(null)
  const r = discOf(st)
  const out = st.discAngle < DISC_ANGLES.disc[0] || st.discAngle > DISC_ANGLES.disc[1] || st.tilt < DISC_ANGLES.tilt[0] || st.tilt > DISC_ANGLES.tilt[1]
  const chart = useMemo(() => {
    const xs: number[] = []
    const ys = [15, 20, 25].map(() => [] as number[])
    for (let a = 30; a <= 55; a += 1) {
      xs.push(a)
      ;[15, 20, 25].forEach((t, i) => ys[i].push(discCutWidth(st.D / 2, st.depth, toRad(a), toRad(t)) * 1000))
    }
    return [xs, ...ys]
  }, [st.D, st.depth])
  const plough = st.implement === 'plough'
  const steps: WorkingStep[] = plough
    ? [
        { label: 'Depth measured in the disc face', tex: "d' = d/\\cos\\beta", sub: `d' = ${n(st.depth)}/\\cos ${st.tilt}^\\circ`, result: `= ${n(st.depth / Math.cos(r.b))}\\,\\text{m}`, beyond: true },
        { label: 'Half-chord in the soil', tex: "c = \\sqrt{R^2-(R-d')^2}", sub: `R = ${n(r.R)}\\,\\text{m}`, result: `c = ${n(discHalfChord(r.R, st.depth, r.b))}\\,\\text{m}`, beyond: true },
        { label: 'Width of cut per disc', tex: 'w = 2c\\sin\\alpha + d\\tan\\beta', sub: `\\alpha = ${st.discAngle}^\\circ,\\ \\beta = ${st.tilt}^\\circ`, result: `w = ${n(r.w)}\\,\\text{m}`, beyond: true },
        { label: 'Draft', tex: 'D = (\\text{unit draft})\\times n\\,w\\,d', sub: `D = ${n(st.unitDraft)} \\times ${n(r.A)}\\,\\text{cm}^2`, result: `= ${n(r.D)}\\,\\text{N}`, cite: C.am('§12 plough draft') },
        { label: 'Power', tex: 'P = D\\,v', sub: `P = ${n(r.D)} \\times ${n(r.v)}`, result: `= ${n(r.P)}\\,\\text{W} = ${n(r.hp)}\\,\\text{hp}`, cite: C.am('§12 power = draft × speed') },
        { label: 'Field capacity', tex: 'C = W S\\,FE/10', sub: `C = ${n(r.W)} \\times ${n(st.speed)} \\times ${n(st.FE)}/10`, result: `= ${n(r.C)}\\,\\text{ha/h}`, cite: C.mgmt('p8') },
      ]
    : [
        { label: 'Width of one gang', tex: 'w_g = N s\\cos\\gamma', sub: `w_g = ${HARROW.n} \\times ${n(HARROW.spacing)} \\times \\cos ${st.gangAngle}^\\circ`, result: `= ${n(r.harrowW / 2)}\\,\\text{m}`, beyond: true },
        { label: 'Field capacity', tex: 'C = W S\\,FE/10', sub: `C = ${n(r.harrowW)} \\times ${n(st.speed)} \\times ${n(st.FE)}/10`, result: `= ${n(r.harrowC)}\\,\\text{ha/h}`, cite: C.mgmt('p8') },
      ]
  return (
    <>
      <Section title="Live" right={plough ? <Badge tone={out ? 'warn' : 'accent'}>{out ? 'outside the notes’ ranges' : 'within the notes’ ranges'}</Badge> : undefined}>
        <div className="grid grid-cols-3 gap-1.5">
          {plough ? (
            <>
              <Readout label="Cut per disc w" value={fmt(r.w * 1000, 3)} unit="mm" tone="accent" />
              <Readout label="Total width" value={fmt(r.W, 3)} unit="m" />
              <Readout label="Draft" value={fmt(r.D, 4)} unit="N" tone="accent" />
              <Readout label="Power" value={fmt(r.P / 1000, 3)} unit="kW" />
              <Readout label="Disc speed" value={fmt(r.spin, 3)} unit="rpm" />
              <Readout label="Capacity" value={fmt(r.C, 3)} unit="ha/h" tone="info" />
            </>
          ) : (
            <>
              <Readout label="Working width" value={fmt(r.harrowW, 3)} unit="m" tone="accent" />
              <Readout label="Gang angle" value={fmt(st.gangAngle, 3)} unit="°" />
              <Readout label="Capacity" value={fmt(r.harrowC, 3)} unit="ha/h" tone="info" />
            </>
          )}
        </div>
      </Section>
      <Section title="Implement">
        <Segmented<Implement>
          value={st.implement}
          onChange={(implement) => st.set({ implement })}
          options={[
            { value: 'plough', label: 'Disc plough' },
            { value: 'harrow', label: 'Tandem disc harrow' },
          ]}
          size="sm"
        />
        {plough ? (
          <>
            <Segmented<Mode>
              value={st.mode}
              onChange={(mode) => st.set({ mode })}
              options={[
                { value: 'field', label: 'Tractor in the field' },
                { value: 'disc', label: 'One disc, angles' },
              ]}
              size="sm"
            />
            <Slider label="Disc angle α (face to travel)" value={st.discAngle} min={30} max={55} step={0.5} unit="°" onChange={(discAngle) => st.set({ discAngle })} />
            <Slider label="Tilt angle β (face to vertical)" value={st.tilt} min={5} max={35} step={0.5} unit="°" onChange={(tilt) => st.set({ tilt })} />
            <Slider label="Disc diameter" value={st.D * 1000} min={510} max={810} step={10} unit="mm" onChange={(D) => st.set({ D: D / 1000 })} />
            <Segmented value={String(st.discs)} onChange={(d) => st.set({ discs: Number(d) })} label="Discs" options={['2', '3', '4'].map((v) => ({ value: v, label: v }))} size="sm" />
            <Slider label="Depth" value={st.depth * 1000} min={80} max={300} step={5} unit="mm" onChange={(d) => st.set({ depth: d / 1000 })} />
            <Slider label="Unit draft" value={st.unitDraft} min={0.5} max={3} step={0.1} unit="N/cm²" onChange={(unitDraft) => st.set({ unitDraft })} />
          </>
        ) : (
          <>
            <Slider label="Gang angle γ" value={st.gangAngle} min={5} max={30} step={0.5} unit="°" onChange={(gangAngle) => st.set({ gangAngle })} />
            <Slider label="Depth" value={st.harrowDepth * 1000} min={30} max={150} step={5} unit="mm" onChange={(d) => st.set({ harrowDepth: d / 1000 })} />
          </>
        )}
        <Slider label="Speed" value={st.speed} min={2} max={10} step={0.1} unit="km/h" onChange={(speed) => st.set({ speed })} />
        <Slider label="Field efficiency" value={st.FE * 100} min={50} max={100} step={1} unit="%" onChange={(v) => st.set({ FE: v / 100 })} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={active} onPick={setActive} />
      </Section>
      {plough ? (
        <Section title="Width of cut vs disc angle">
          <Chart
            data={chart}
            series={[
              { label: 'tilt 15°', color: '#7ab8f5' },
              { label: 'tilt 20°', color: '#9bd17a' },
              { label: 'tilt 25°', color: '#f08a3c' },
            ]}
            xLabel="disc angle α (°)"
            yLabel="cut per disc (mm)"
            marker={() => [useDisc.getState().discAngle, discOf(useDisc.getState()).w * 1000]}
          />
          <Note>Geometric width of the disc chord in the soil. Usual working ranges: disc angle 42–45°, tilt angle 15–25°.</Note>
        </Section>
      ) : null}
      <Section title="Working">
        <Working steps={steps} />
      </Section>
      <Section title="Why a disc plough?">
        <Note>
          The disc plough is preferred for hard, dry or sticky soils. The disc rolls instead of sliding, so it rides over stones and roots and wears less; sticky soil that will not scour off a
          mouldboard is cleaned off by the scrapers; and it penetrates by its own weight (a heavy frame, added weights) rather than by suction. It turns the slice less completely and leaves a rougher
          surface. A tandem disc harrow (secondary tillage) uses gangs of smaller discs at a gang angle: the front gangs throw soil out and the rear gangs throw it back, leaving the surface level.
        </Note>
      </Section>
    </>
  )
}
