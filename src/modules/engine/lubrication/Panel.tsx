import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { LUBE_MODEL, OIL_GRADES, lubePressureCurve, type OilGrade } from '@/physics/engineSystems'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DEFAULTS, gaugeBar, operating, useLube, type LubeMode, type LubeParams } from './model'

interface Preset {
  id: string
  label: string
  note: string
  params: Partial<LubeParams>
}

const PRESETS: Preset[] = [
  { id: 'hot-run', label: 'Hot, working speed', note: 'Oil at 90 °C, 1500 rpm: the relief valve stays shut and every drop of pump output goes through the filter to the bearings.', params: { ...DEFAULTS } },
  { id: 'cold-start', label: 'Cold start', note: 'Oil at 10 °C is many times thicker: pressure shoots up, the relief valve opens and spills the surplus back to the sump.', params: { tempC: 10, rpm: 1800, grade: 'SAE30', filterClog: 1, wear: 1 } },
  { id: 'hot-idle', label: 'Hot idle', note: 'Thin oil and a slow pump: gallery pressure is at its lowest — the usual time for the oil light to flicker.', params: { tempC: 110, rpm: 600, filterClog: 1, wear: 1 } },
  { id: 'clogged', label: 'Clogged filter', note: 'A blocked full-flow filter starves the gallery even though the pump is working hard (the pressure drop is across the element).', params: { tempC: 90, rpm: 1500, filterClog: 5, wear: 1 } },
  { id: 'worn', label: 'Worn bearings', note: 'Larger bearing clearances leak oil freely, so the gallery pressure falls — low oil pressure is a sign of wear.', params: { tempC: 90, rpm: 1500, filterClog: 1, wear: 2.5 } },
  { id: 'splash', label: 'Splash system', note: 'The pump only keeps the troughs full; the dippers on the big ends splash oil over the moving parts.', params: { mode: 'splash', tempC: 90, rpm: 1200 } },
]

function LivePanel() {
  const st = useLube()
  const r = useMemo(() => operating(st), [st])
  const gauge = gaugeBar(st, r)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Oil pressure" value={fmt(gauge, 3)} unit="bar" tone={st.mode === 'force' && gauge < 1 ? 'warn' : 'accent'} />
        <Readout label="Pump output" value={fmt(r.pumpLpm, 3)} unit="L/min" />
        <Readout label="Viscosity" value={fmt(r.nu, 3)} unit="cSt" />
        <Readout label="To bearings" value={fmt(st.mode === 'force' ? r.bearingLpm : 0, 3)} unit="L/min" tone="info" />
        <Readout label="Relief spill" value={fmt(st.mode === 'force' ? r.reliefLpm : 0, 3)} unit="L/min" tone={r.reliefLpm > 0.05 && st.mode === 'force' ? 'warn' : 'ink'} />
        <Readout label="Relief valve" value={st.mode === 'force' ? `${Math.round(r.reliefOpen * 100)} %` : '—'} unit="open" />
      </div>
      {st.mode === 'force' ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-mute">
          Pump outlet {fmt(r.pumpBar, 3)} bar → filter drop {fmt(r.filterDrop / 1e5, 2)} bar → gallery {fmt(r.galleryBar, 3)} bar.
          {r.reliefOpen > 0 ? ' Relief valve lifting: surplus oil returns to the sump.' : ''}
        </p>
      ) : (
        <p className="mt-1.5 text-[11.5px] leading-snug text-mute">Splash system: no pressure gallery — the pump only keeps the troughs topped up.</p>
      )}
    </Section>
  )
}

function PressureChart() {
  const st = useLube()
  const rpms = useMemo(() => Array.from({ length: 49 }, (_, i) => 200 + i * 50), [])
  const base = { tempC: st.tempC, grade: st.grade, reliefBar: st.reliefBar, filterClog: st.filterClog, wear: st.wear }
  const data = useMemo(() => {
    const cur = lubePressureCurve(base, rpms)
    const cold = lubePressureCurve({ ...base, tempC: 10 }, rpms)
    const setting = rpms.map(() => st.reliefBar)
    return [rpms, cur, cold, setting]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.tempC, st.grade, st.reliefBar, st.filterClog, st.wear, rpms])
  return (
    <Section title="Gallery pressure vs engine speed">
      <Chart
        data={data}
        series={[
          { label: `${st.tempC} °C`, color: '#f0a830', width: 2 },
          { label: '10 °C', color: '#6fb3e0', width: 1.5, dash: [4, 3] },
          { label: 'relief setting', color: '#e8794f', width: 1, dash: [2, 3] },
        ]}
        xLabel="Engine speed (rpm)"
        yLabel="Pressure (bar)"
        marker={() => {
          const s = useLube.getState()
          return s.mode === 'force' ? [s.rpm, operating(s).galleryBar] : null
        }}
        height={170}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Solid: current oil temperature. Dashed blue: cold oil (10 °C). Dotted: relief-valve setting. The pressure rises with speed until the relief valve cracks open, then the curve
        flattens — the valve holds the pressure near its setting. Circuit sizes and oil viscosities are typical values.
      </p>
    </Section>
  )
}

function LubeWorking() {
  const st = useLube()
  const r = useMemo(() => operating(st), [st])
  const M = LUBE_MODEL
  const steps: WorkingStep[] = [
    {
      label: 'Oil viscosity at the running temperature',
      tex: '\\log\\log(\\nu+0.7) = A - B\\log T',
      sub: `${OIL_GRADES[st.grade].label}:\\ \\nu_{40}=${OIL_GRADES[st.grade].nu40},\\ \\nu_{100}=${OIL_GRADES[st.grade].nu100}\\ \\text{cSt},\\ t=${st.tempC}\\,^\\circ\\text{C}`,
      result: `\\nu = ${n(r.nu, 3)}\\ \\text{cSt}\\ (${n(r.rel, 3)}\\times\\ \\text{hot SAE 30})`,
      cite: SRC.supp509('SAE grades'),
      beyond: true,
    },
    {
      label: 'Gear-pump delivery (pump driven by the camshaft, ½ engine speed)',
      tex: 'Q = \\eta_v\\, V_p\\, \\dfrac{N}{2}',
      sub: `= ${n(r.pumpEff, 3)}\\times${n(M.pumpDisp * 1e6, 3)}\\,\\text{cm}^3\\times\\dfrac{${st.rpm}}{2}\\ \\text{per min}`,
      result: `= ${n(r.pumpLpm, 3)}\\ \\text{L/min}`,
      cite: SRC.tb509('Fig 6.2 — pump driven by the camshaft'),
      beyond: true,
    },
    {
      label: 'Flow balance at the relief valve',
      tex: 'Q = Q_{bearings}(p) + Q_{relief}(p),\\quad Q_{relief}=K\\,(p-p_{set})\\ \\text{if}\\ p>p_{set}',
      sub: `p_{set} = ${n(st.reliefBar, 3)}\\ \\text{bar}`,
      result: `p_{pump} = ${n(r.pumpBar, 3)}\\ \\text{bar},\\ Q_{relief} = ${n(r.reliefLpm, 3)}\\ \\text{L/min}`,
      cite: SRC.tb509('Fig 6.2 — relief valve returns excess to the sump'),
      beyond: true,
    },
    {
      label: 'Filter and bearings in series',
      tex: 'p_{gallery} = p_{pump} - Q_b R_f,\\qquad Q_b = G\\,p_{gallery}',
      sub: `R_f \\times ${n(st.filterClog, 2)}\\ (\\text{clogging}),\\ G \\times ${n(st.wear, 2)}\\ (\\text{wear}) \\div ${n(r.rel, 3)}\\ (\\text{viscosity})`,
      result: `p_{gallery} = ${n(r.galleryBar, 3)}\\ \\text{bar},\\ Q_b = ${n(r.bearingLpm, 3)}\\ \\text{L/min}`,
      cite: SRC.tb509('Fig 6.2 — filter → main gallery → bearings'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

const GRADES: OilGrade[] = ['SAE10', 'SAE20', 'SAE30', 'SAE40', 'SAE50', '10W30', '20W50']

export function LubePanel() {
  const st = useLube()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<LubeParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="System">
        <Segmented<LubeMode>
          value={st.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'force', label: 'Force-feed', title: 'Pump → relief valve → filter → gallery → bearings' },
            { value: 'splash', label: 'Circulating splash', title: 'Pump fills troughs; dippers splash' },
          ]}
        />
        <Slider label="Engine speed" value={st.rpm} min={0} max={2600} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Slider label="Oil temperature" value={st.tempC} min={0} max={130} step={1} unit="°C" onChange={(tempC) => set({ tempC })} />
        <Slider label="Relief-valve setting" value={st.reliefBar} min={1.5} max={6} step={0.1} unit="bar" onChange={(reliefBar) => set({ reliefBar })} hint="Spring preload on the relief plunger" />
        <Segmented<OilGrade> size="sm" label="Oil grade" value={st.grade} onChange={(grade) => set({ grade })} options={GRADES.map((g) => ({ value: g, label: OIL_GRADES[g].label.replace('SAE ', '') }))} />
        <Slider label="Filter clogging" value={st.filterClog} min={1} max={6} step={0.1} unit="×" onChange={(filterClog) => set({ filterClog })} />
        <Slider label="Bearing wear" value={st.wear} min={0.6} max={3} step={0.05} unit="× leakage" onChange={(wear) => set({ wear })} />
        <Toggle label="Show oil flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
      </Section>
      <Section title="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set({ mode: 'force', ...p.params })
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
      <PressureChart />
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[12px] leading-snug text-ink/85">
          <li>
            <b>Functions of oil:</b> reduce friction and wear, cool, seal (rings), clean (carry dirt to the filter).
          </li>
          <li>
            <b>Parts needing oil:</b> cylinder walls and pistons, gudgeon pins, main and big-end bearings, camshaft bearings, valve gear, fan, water pump, ignition mechanism.
          </li>
          <li>
            <b>Systems:</b> force-feed (pump, relief valve, filter, gallery, gauge), circulating splash (pump fills troughs, dipper on the rod), oil-mist / petroil for two-strokes.
          </li>
          <li>
            <b>Oils:</b> SAE 10–50 for engines, 80–140 for gear oils; multigrades such as 20W/50 stay thin enough when cold and thick enough when hot; detergent “HD” oils keep dirt in suspension.
          </li>
          <li>
            <b>Breather:</b> vents blow-by gas from the crankcase through a filter.
          </li>
        </ul>
      </Section>
      {st.mode === 'force' ? <LubeWorking /> : null}
    </div>
  )
}
