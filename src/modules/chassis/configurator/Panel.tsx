import { useMemo, useState } from 'react'
import { Note, PresetGrid, type Preset } from '@/modules/powertrain/common/PanelBits'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { Icon } from '@/ui/icons'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DEFAULTS, ENGINES, SOILS, TRANSMISSIONS, build, envelope, test, useConfig, verdicts, type ConfigParams, type Drive, type EngineSize, type Soil, type Transmission, type TyreType, type TyreWidth } from './model'

const set = (p: Partial<ConfigParams>) => useConfig.getState().set(p)

const PRESETS: Preset[] = [
  { id: 'plough', label: 'Ploughing, tilled', note: 'A 4-furrow plough: about 18 kN at 7 km/h on tilled soil. The starting build nearly manages — can you get every check green?', apply: () => set({ ...DEFAULTS }) },
  { id: 'soft', label: 'Wet, soft field', note: 'Same job on soft ground. Grip collapses: slip shoots up and the ruts deepen. Radial tyres, wider tyres, front-wheel assist or ballast — which helps most?', apply: () => set({ ...DEFAULTS, soil: 'soft' }) },
  { id: 'heavy', label: 'Heavy cultivator', note: '35 kN at 6 km/h. A 75 kW 2WD tractor spins its wheels: this is a job for more weight, more driven wheels — or a bigger tractor.', apply: () => set({ ...DEFAULTS, pull: 35, target: 6 }) },
  { id: 'over', label: 'Over-ballasted', note: '2 t of rear ballast: slip is low, but the front is light and the soil is crushed. Weight helps traction only up to a point.', apply: () => set({ ...DEFAULTS, rear: 2000 }) },
]

function Pick<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-[11.5px] text-mute">{label}</div>
      <Segmented<T> value={value} onChange={onChange} size="sm" options={options} />
    </div>
  )
}

export function ConfiguratorPanel() {
  const st = useConfig()
  const [preset, setPreset] = useState<string | null>(null)
  const change = (p: Partial<ConfigParams>) => {
    setPreset(null)
    st.set(p)
  }
  const r = useMemo(() => test(st), [st])
  const b = useMemo(() => build(st), [st])
  const vs = verdicts(st, r)
  const passed = vs.filter((v) => v.pass).length
  const env = useMemo(() => envelope(st), [st])

  const steps: WorkingStep[] = [
    {
      label: 'Weight transfer from the pull',
      tex: 'V_f = W_f - \\dfrac{P\\,y_d}{x},\\quad V_r = W_r + \\dfrac{P\\,y_d}{x}',
      sub: `P = ${n(st.pull, 3)}\\ \\text{kN},\\ y_d = ${n(b.chassis.yd, 3)}\\ \\text{m},\\ x = ${n(b.chassis.x, 3)}\\ \\text{m}`,
      result: `\\text{front share} = ${n(r.frontShare * 100, 3)}\\,\\%`,
    },
    {
      label: 'Mobility number of the rear tyres',
      tex: 'B_n = \\dfrac{CI\\,b\\,d}{W}\\cdot\\dfrac{1 + 5\\delta/h}{1 + 3b/d}',
      sub: `CI = ${n(SOILS[st.soil].CI / 1000, 4)}\\ \\text{kPa},\\ b = ${n(b.rearTyre.b, 3)},\\ d = ${n(b.rearTyre.d, 3)}\\ \\text{m}`,
      result: `B_n = ${n(r.BnR, 3)}`,
    },
    {
      label: 'Slip that gives the pull (Brixius)',
      tex: 'NTR(s) = GTR(s) - MRR(s) = \\dfrac{P + R_f}{V_r}',
      sub: st.drive === 'mfwd' ? '\\text{front and rear axles pull together}' : '\\text{rear axle pulls; the front only rolls}',
      result: r.spin ? '\\text{no slip is enough: the wheels spin}' : `s = ${n(r.slip * 100, 3)}\\,\\%`,
    },
    {
      label: 'Tractive and overall efficiency',
      tex: '\\eta_T = \\dfrac{P\\,V}{\\text{axle power}},\\quad \\eta = \\dfrac{P\\,V}{\\text{engine power}}',
      sub: `P V = ${n(r.Pdb, 3)}\\ \\text{kW},\\ \\text{engine } ${n(r.Peng, 3)}\\ \\text{kW}`,
      result: `\\eta_T = ${n(r.TE * 100, 3)}\\,\\%,\\ \\eta = ${n(r.overall * 100, 3)}\\,\\%`,
    },
  ]

  return (
    <div>
      <Section title="Result" right={<Badge tone={passed === vs.length ? 'accent' : passed >= 3 ? 'info' : 'warn'}>{`${passed}/${vs.length} checks`}</Badge>}>
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Speed" value={fmt(r.speed, 3)} unit="km/h" tone="accent" />
          <Readout label="Slip" value={r.spin ? 'spin' : fmt(r.slip * 100, 3)} unit={r.spin ? '' : '%'} tone={r.slip > 0.15 ? 'warn' : 'ink'} />
          <Readout label="Gear / drive" value={r.gear} />
          <Readout label="Engine" value={`${fmt(r.rpm, 4)}`} unit="rpm" />
          <Readout label="Engine load" value={fmt(r.load * 100, 3)} unit="%" tone={r.load > 0.95 ? 'warn' : 'ink'} />
          <Readout label="Fuel" value={fmt(r.fuel, 3)} unit="L/h" />
          <Readout label="Drawbar power" value={fmt(r.Pdb, 3)} unit="kW" tone="info" />
          <Readout label="Tractive eff." value={fmt(r.TE * 100, 3)} unit="%" />
          <Readout label="Overall eff." value={fmt(r.overall * 100, 3)} unit="%" />
          <Readout label="Front axle" value={fmt(r.frontShare * 100, 3)} unit="% of weight" />
          <Readout label="Ground pressure" value={fmt(r.pressure, 3)} unit="kPa" tone={r.pressure > 110 ? 'warn' : 'ink'} />
          <Readout label="Rut depth" value={fmt(r.rut * 1000, 3)} unit="mm" />
        </div>
        <ul className="mt-2 space-y-1">
          {vs.map((v) => (
            <li key={v.label} className="flex items-start gap-2 text-[12px]" title={v.why}>
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${v.pass ? 'bg-accent text-accent-ink' : 'border border-warn/60 text-warn'}`}>{v.pass ? <Icon.check width={11} height={11} /> : '!'}</span>
              <span className={v.pass ? 'text-ink' : 'text-ink/80'}>{v.label}</span>
              <span className={`ml-auto font-mono text-[11.5px] ${v.pass ? 'text-accent' : 'text-warn'}`}>{v.value}</span>
            </li>
          ))}
        </ul>
        <Note>Hover a check for why it matters. Mass {fmt(b.mass / 1000, 3)} t, {ENGINES[st.engine].label} engine.</Note>
      </Section>

      <Section title="Build">
        <Pick<EngineSize> label="Engine" value={st.engine} onChange={(engine) => change({ engine })} options={(Object.keys(ENGINES) as EngineSize[]).map((k) => ({ value: k, label: ENGINES[k].label }))} />
        <Pick<Transmission> label="Transmission" value={st.trans} onChange={(trans) => change({ trans })} options={(Object.keys(TRANSMISSIONS) as Transmission[]).map((k) => ({ value: k, label: TRANSMISSIONS[k].label }))} />
        <Pick<Drive> label="Drive" value={st.drive} onChange={(drive) => change({ drive })} options={[{ value: '2wd', label: '2WD' }, { value: 'mfwd', label: 'Front-wheel assist' }]} />
        <Pick<TyreType> label="Tyres" value={st.tyre} onChange={(tyre) => change({ tyre })} options={[{ value: 'bias', label: 'Bias-ply' }, { value: 'radial', label: 'Radial' }]} />
        <Pick<TyreWidth> label="Tyre width" value={st.width} onChange={(width) => change({ width })} options={[{ value: 'narrow', label: 'Narrow' }, { value: 'standard', label: 'Standard' }, { value: 'wide', label: 'Wide' }]} />
        <Slider label="Front ballast" value={st.front} min={0} max={1500} step={25} unit="kg" onChange={(front) => change({ front })} />
        <Slider label="Rear wheel weights" value={st.rear} min={0} max={2500} step={25} unit="kg" onChange={(rear) => change({ rear })} />
      </Section>

      <Section title="Job">
        <Slider label="Drawbar pull" value={st.pull} min={2} max={60} step={0.5} unit="kN" onChange={(pull) => change({ pull })} />
        <Slider label="Target speed" value={st.target} min={2} max={20} step={0.5} unit="km/h" onChange={(target) => change({ target })} />
        <Pick<Soil> label="Soil" value={st.soil} onChange={(soil) => change({ soil })} options={(Object.keys(SOILS) as Soil[]).map((k) => ({ value: k, label: SOILS[k].label }))} />
      </Section>

      <Section title="Try">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>

      <Section title="Speed and slip against pull">
        <Chart
          data={[env.xs, env.v, env.slip]}
          series={[
            { label: 'top speed km/h', color: '#35c48a', width: 2 },
            { label: 'slip %', color: '#f5b942', width: 1.5 },
          ]}
          xLabel="Drawbar pull (kN)"
          yLabel="km/h · %"
          marker={() => [st.pull, r.speed]}
          height={170}
        />
        <Note>At light pulls the gearbox or engine power sets the speed; as the pull grows, slip rises until the wheels can grip no more.</Note>
      </Section>

      <Section title="Working">
        <Working steps={steps} />
      </Section>
    </div>
  )
}
