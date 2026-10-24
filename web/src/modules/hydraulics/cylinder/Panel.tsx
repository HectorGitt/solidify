import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { cylinder } from '@/physics/hydraulics'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DIM, MG1617, compute, live, useCyl, type Acting, type Motion } from './model'

const PHASE = { extending: 'Extending', retracting: 'Retracting', holding: 'Holding', stalled: 'Relief blowing' } as const
const TONE = { extending: 'accent', retracting: 'info', holding: 'ink', stalled: 'warn' } as const

const PRESETS = [
  {
    id: 'guide',
    label: '2016/17 guide · cylinder',
    note: '7.62 cm bore, 2.5 cm rod, 17.2 MPa, 68.13 L/min. Expect 78.4 kN / 70.0 kN, 0.249 / 0.279 m/s, return flow 76.3 L/min.',
    apply: () => useCyl.getState().set({ bore: 0.0762, rod: 0.025, p: 17.2, Q: 68.13, load: 20 }),
  },
  {
    id: 'culpin',
    label: 'Ram sizing · 50 mm bore',
    note: '200 mm stroke, 50 mm bore, 20 kN in 2 s. Expect 0.393 L, 0.197 L/s, 102 bar; working 160 bar, relief 275 bar.',
    apply: () => useCyl.getState().set({ bore: 0.05, rod: 0.025, p: 27.5, Q: 11.78, load: 20, stroke: 0.2, time: 2 }),
  },
  {
    id: 'overload',
    label: 'Overload → relief',
    note: 'The same 50 mm ram with a 60 kN load needs 306 bar — more than the 275 bar relief setting, so the ram stalls and the pump flow goes over the relief valve.',
    apply: () => useCyl.getState().set({ bore: 0.05, rod: 0.025, p: 27.5, Q: 11.78, load: 60, stroke: 0.2, time: 2 }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.x === b.x && a.phase === b.phase && a.valve === b.valve)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="State" value={PHASE[v.phase]} tone={TONE[v.phase]} />
        <Readout label="Rod out" value={fmt(v.x * 1000, 3)} unit="mm" />
        <Readout label="Speed" value={fmt(Math.abs(v.v), 3)} unit="m/s" />
        <Readout label="Cap-end p" value={fmt(v.pCap, 3)} unit="MPa" tone={v.pCap > 0.05 ? 'accent' : 'ink'} />
        <Readout label="Rod-end p" value={fmt(v.pRod, 3)} unit="MPa" tone={v.pRod > 0.05 ? 'accent' : 'ink'} />
        <Readout label="Flow in / out" value={`${fmt(v.qIn, 3)} / ${fmt(v.qOut, 3)}`} unit="L/min" />
        <Readout label="Valve spool" value={v.valve > 0 ? 'P→A, B→T' : v.valve < 0 ? 'P→B, A→T' : 'centre (closed)'} />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-dim">
        Drawn stroke is {DIM.stroke * 1000} mm. Red oil is at pump pressure; amber oil is being pushed back to the tank. Flow out ≠ flow in because the rod takes up part of
        one chamber.
      </p>
    </Section>
  )
}

function Charts() {
  const bore = useCyl((s) => s.bore)
  const rod = useCyl((s) => s.rod)
  const p = useCyl((s) => s.p)
  const Q = useCyl((s) => s.Q)
  const data = useMemo(() => {
    const xs: number[] = []
    const fe: number[] = []
    const fr: number[] = []
    const ve: number[] = []
    const vr: number[] = []
    for (let i = 0; i <= 40; i++) {
      const ratio = (i / 40) * 0.85
      const c = cylinder(bore, ratio * bore, p * 1e6, Q)
      xs.push(ratio)
      fe.push(c.forceExtend / 1000)
      fr.push(c.forceRetract / 1000)
      ve.push(c.speedExtend)
      vr.push(c.speedRetract)
    }
    return { xs, fe, fr, ve, vr }
  }, [bore, p, Q])
  const c = cylinder(bore, rod, p * 1e6, Q)
  const ratio = rod / bore
  return (
    <Section title="Effect of rod size">
      <Chart
        data={[data.xs, data.fe, data.fr]}
        series={[
          { label: 'Extend force', color: '#e8794f', width: 2 },
          { label: 'Retract force', color: '#6fb3e0', width: 2 },
        ]}
        xLabel="Rod / bore diameter ratio"
        yLabel="Force (kN)"
        marker={() => [ratio, c.forceRetract / 1000]}
        height={150}
      />
      <div className="h-2" />
      <Chart
        data={[data.xs, data.ve, data.vr]}
        series={[
          { label: 'Extend speed', color: '#e8794f', width: 2 },
          { label: 'Retract speed', color: '#6fb3e0', width: 2 },
        ]}
        xLabel="Rod / bore diameter ratio"
        yLabel="Speed (m/s)"
        marker={() => [ratio, c.speedRetract]}
        height={150}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">A thicker rod shrinks the annulus: retracting gets faster and weaker; extending is unchanged.</p>
    </Section>
  )
}

function CylWorking() {
  const st = useCyl()
  const r = compute(st)
  const { c } = r
  const D = st.bore * 100
  const d = st.rod * 100
  const steps: WorkingStep[] = [
    {
      label: 'Piston (full-bore) area',
      tex: 'A = \\tfrac{\\pi}{4}D^2',
      sub: `= \\tfrac{\\pi}{4}(${n(D, 4)}\\,\\text{cm})^2`,
      result: `= ${n(c.areaCap * 1e4, 4)}\\ \\text{cm}^2`,
      cite: MG1617('Q(d)'),
    },
    {
      label: 'Rod area and annulus (effective retract) area',
      tex: 'a = \\tfrac{\\pi}{4}d^2,\\quad A_{ann} = A - a',
      sub: `a = \\tfrac{\\pi}{4}(${n(d, 3)})^2 = ${n(c.areaRod * 1e4, 4)},\\quad A_{ann} = ${n(c.areaCap * 1e4, 4)} - ${n(c.areaRod * 1e4, 4)}`,
      result: `A_{ann} = ${n(c.areaAnnulus * 1e4, 4)}\\ \\text{cm}^2`,
      cite: MG1617('Q(d)'),
    },
    {
      label: 'Forces: extending (P on A) and retracting (P on A − a)',
      tex: 'F_{ext} = pA,\\quad F_{ret} = p(A-a)',
      sub: `= ${n(st.p, 3)}\\,\\text{MPa}\\times${n(c.areaCap * 1e4, 4)}\\,\\text{cm}^2,\\quad ${n(st.p, 3)}\\times${n(c.areaAnnulus * 1e4, 4)}`,
      result: `F_{ext} = ${n(c.forceExtend / 1000, 4)}\\ \\text{kN},\\quad F_{ret} = ${n(c.forceRetract / 1000, 4)}\\ \\text{kN}`,
      cite: MG1617('Q(d)'),
    },
    {
      label: 'Speeds: the same flow fills a smaller volume on the rod side',
      tex: 'v_{ext} = \\dfrac{Q}{A},\\quad v_{ret} = \\dfrac{Q}{A-a}',
      sub: `= \\dfrac{${n(st.Q, 4)}/60\\,000}{${n(c.areaCap, 4)}},\\quad \\dfrac{${n(st.Q, 4)}/60\\,000}{${n(c.areaAnnulus, 4)}}`,
      result: `v_{ext} = ${n(c.speedExtend, 3)},\\quad v_{ret} = ${n(c.speedRetract, 3)}\\ \\text{m/s}`,
      cite: MG1617('Q(d)'),
    },
    {
      label: 'Oil returned to the reservoir while retracting',
      tex: 'Q_{ret} = A\\,v_{ret}',
      sub: `= ${n(c.areaCap, 4)}\\times${n(c.speedRetract, 3)}\\times60\\,000`,
      result: `= ${n(c.returnFlowRetract, 4)}\\ \\text{L/min}\\;(> Q\\text{ by the ratio } A/A_{ann} = ${n(r.ratio, 3)})`,
      cite: MG1617('Q(d)'),
    },
    {
      label: 'Pressure the load needs, compared with the relief setting',
      tex: 'p_{load} = \\dfrac{W}{A}',
      sub: `= \\dfrac{${n(r.loadN, 4)}\\,\\text{N}}{${n(c.areaCap, 4)}\\,\\text{m}^2}`,
      result: `= ${n(r.pExtend / 1e5, 4)}\\ \\text{bar}\\ ${r.stallExtend ? '> ' : '\\le '}${n(st.p * 10, 4)}\\ \\text{bar}${r.stallExtend ? '\\Rightarrow\\text{relief opens, ram stalls}' : ''}`,
      cite: SRC.top510('p11'),
    },
    {
      label: st.acting === 'single' ? 'Single-acting: only the extend stroke is powered' : 'Single-acting alternative (for comparison)',
      tex: 'F_{out} = pA,\quad F_{in} = 0\ \text{(returned by the load } W\text{)},\quad v_{in} = \dfrac{Q_{valve}}{A}',
      sub: `F_{out} = ${n(c.forceExtend / 1000, 4)}\ \text{kN},\quad W = ${n(st.load, 3)}\ \text{kN}`,
      result: st.load > 0 ? `\text{lowers at } ${n(c.speedExtend, 3)}\ \text{m/s if the valve passes } ${n(st.Q, 4)}\ \text{L/min}` : '\text{no load} \Rightarrow \text{it will not retract}',
      cite: SRC.hy510('p1–2: on lower, the implement drops under its own weight and pushes oil back to the reservoir'),
    },
    {
      label: 'Ram sizing: oil volume for one stroke',
      tex: 'V = A\\,L',
      sub: `= ${n(c.areaCap * 1e6, 4)}\\,\\text{mm}^2\\times${n(st.stroke * 1000, 4)}\\,\\text{mm}`,
      result: `= ${n(r.ram.volumeL, 4)}\\ \\text{L}`,
      cite: SRC.top510('p11 — 200 mm × Ø50 → 0.393 L'),
    },
    {
      label: 'Flow to make the stroke in the given time',
      tex: 'Q = V/t',
      sub: `= ${n(r.ram.volumeL, 4)}/${n(st.time, 3)}`,
      result: `= ${n(r.ram.flowLps, 4)}\\ \\text{L/s} = ${n(r.ram.flowLps * 60, 4)}\\ \\text{L/min}`,
      cite: SRC.top510('p11 — 0.197 L/s'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function CylinderPanel() {
  const st = useCyl()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Parameters<typeof st.set>[0]) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Control valve">
        <Segmented<Motion>
          value={st.motion}
          onChange={(motion) => st.set({ motion })}
          options={[
            { value: 'cycle', label: 'Cycle', title: 'Extend, pause, retract, repeat' },
            { value: 'extend', label: 'Extend', title: 'Pump to the cap-end port' },
            { value: 'hold', label: 'Hold', title: 'Both ports blocked — oil trapped' },
            { value: 'retract', label: 'Retract', title: 'Pump to the rod-end port' },
          ]}
        />
        <Segmented<Acting>
          size="sm"
          value={st.acting}
          onChange={(acting) => st.set({ acting })}
          options={[
            { value: 'double', label: 'Double-acting', title: 'Oil to either port: powered out and powered in' },
            { value: 'single', label: 'Single-acting', title: 'Oil to the cap end only; the load pushes it back in' },
          ]}
        />
        <Toggle label="Show oil flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <p className="text-[11px] leading-snug text-dim">
          Spool: {st.motion === 'hold' ? 'centre — A and B blocked, oil trapped' : 'shifts to P→A, B→T to extend and P→B, A→T to retract'}.{' '}
          {st.acting === 'single'
            ? 'Single-acting: only the cap end is fed; to lower, the valve opens it to the tank and the load pushes the oil out — like the tractor lift ram, where the implement drops under its own weight. With no load it will not retract.'
            : 'Double-acting: oil can be pumped into either end, so it is powered both out and in.'}
        </p>
      </Section>
      <Section title="Cylinder & supply">
        <Slider label="Bore D" value={st.bore * 1000} min={40} max={120} step={0.1} unit="mm" onChange={(v) => set({ bore: v / 1000 })} hint="The model rescales" />
        <Slider label="Rod d" value={st.rod * 1000} min={15} max={Math.round(st.bore * 850)} step={0.5} unit="mm" onChange={(v) => set({ rod: v / 1000 })} />
        <Slider label="Pressure (relief setting)" value={st.p} min={5} max={30} step={0.1} unit="MPa" onChange={(p) => set({ p })} />
        <Slider label="Pump flow Q" value={st.Q} min={5} max={120} step={0.01} unit="L/min" onChange={(Q) => set({ Q })} />
        <Slider label="Load resisting extension" value={st.load} min={0} max={120} step={0.5} unit="kN" onChange={(load) => set({ load })} />
        <Slider label="Stroke (ram sizing)" value={st.stroke * 1000} min={50} max={600} step={5} unit="mm" onChange={(v) => set({ stroke: v / 1000 })} />
        <Slider label="Time for the stroke" value={st.time} min={0.5} max={10} step={0.1} unit="s" onChange={(time) => set({ time })} />
      </Section>
      <Section title="Exam presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                p.apply()
                setPreset(p.id)
              }}
              className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${preset === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{PRESETS.find((p) => p.id === preset)?.note}</p> : null}
      </Section>
      <Charts />
      <CylWorking />
    </div>
  )
}
