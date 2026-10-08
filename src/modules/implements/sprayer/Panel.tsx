import { useMemo, useState } from 'react'
import { applicationRate, boomCV, boomDistribution, dropletsPerCm2, nozzleFlowForRate, rateForDropletDensity, tankCoverage, ulvRateKmh, type NozzleKind } from '@/physics/application'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../_appkit/ui'
import { C, DEFAULTS, LAYOUT, live, solveSpray, sprayAngle, startCalibrationRun, useSprayer, type SprayParams } from './model'
import { NOZZLE_SIZES } from './Scene3D'

const apply = (p: Partial<SprayParams>) => useSprayer.getState().set({ ...DEFAULTS, sections: [true, true, true], ...p })

const ULV_ERRATUM =
  'The notes say 100 µm droplets need 1000 L/ha for the same deposit density. Droplet volume goes as d³: at the notes’ 1 L/ha ↔ 70 µm baseline, 100 µm needs only ≈ 2.9 L/ha; 1000 L/ha corresponds to ≈ 700 µm droplets (10 × 70 µm).'

const PRESETS: Preset[] = [
  {
    id: 'mg1819',
    label: '2018/19 Q4(e) · 10 × 200 mm',
    note: 'Ten nozzles at 200 mm: W = 10 × 0.2 = 2 m. Distance for 0.5 ha = 5000 m² / 2 m = 2500 m (marking guide).',
    apply: () => apply({ nozzles: 10, spacing: 0.2, calibArea: 0.5, q3: 0.4, speed: 6 }),
  },
  {
    id: 'speed',
    label: '4 → 8 km/h',
    note: 'Same nozzles and pressure: spraying at 8 km/h instead of 4 km/h halves the application rate. Compare the Live rate with the 4 km/h preset value.',
    apply: () => apply({ speed: 8 }),
  },
  {
    id: 'speed4',
    label: 'Back to 4 km/h',
    note: 'At 4 km/h the same circuit lays down twice the volume per hectare.',
    apply: () => apply({ speed: 4 }),
  },
  {
    id: 'pressure',
    label: '4× pressure',
    note: 'Flow ∝ √pressure: raising the regulator from 1.5 to 6 bar only doubles each nozzle’s flow (and makes finer, driftier droplets). Change nozzle size for big rate changes.',
    apply: () => apply({ pSet: 6 }),
  },
  {
    id: 'cone',
    label: 'Hollow-cone nozzles',
    note: 'Whirl plate without a centre hole: the spray leaves as a ring. Look at the enlarged cutaway and the distribution chart.',
    apply: () => apply({ kind: 'hollow-cone', boomH: 0.6 }),
  },
  {
    id: 'low',
    label: 'Boom too low',
    note: 'At 0.25 m the 110° fans no longer overlap: stripes of under- and over-dosing (see the distribution chart CV).',
    apply: () => apply({ boomH: 0.25 }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 12, (a, b) => a.pressure === b.pressure && a.tank === b.tank && a.runDist === b.runDist && a.flow === b.flow)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Pressure" value={fmt(v.pressure, 3)} unit="bar" tone="accent" />
        <Readout label="Boom flow" value={fmt(v.flow, 3)} unit="L/min" tone="info" />
        <Readout label="Bypass" value={fmt(v.bypass, 3)} unit="L/min" />
        <Readout label="Rate" value={fmt(v.rate, 3)} unit="L/ha" tone="accent" />
        <Readout label="Tank" value={fmt(v.tank, 3)} unit="L" />
        <Readout label="Calib. run" value={`${fmt(v.runDist, 3)} m`} unit={v.runActive ? 'running' : v.runDist > 0 ? 'done' : ''} tone={v.runActive ? 'warn' : 'ink'} />
      </div>
    </Section>
  )
}

function Calibration() {
  const st = useSprayer()
  const sol = solveSpray(st)
  const v = useLive(() => ({ d: live.runDist, used: live.runUsed, active: live.runActive }), 10, (a, b) => a.d === b.d && a.active === b.active)
  const done = !v.active && v.d > 0
  return (
    <Section title="Calibration run">
      <Slider label="Required rate" value={st.target} min={50} max={500} step={5} unit="L/ha" onChange={(target) => st.set({ target })} />
      <Segmented<string> value={String(st.calibArea)} onChange={(a) => st.set({ calibArea: parseFloat(a) })} options={[{ value: '0.1', label: 'Test 0.1 ha' }, { value: '0.5', label: 'Test 0.5 ha' }]} />
      <button className="mt-2 w-full rounded-md border border-accent/60 px-2 py-1.5 text-[12px] text-ink hover:bg-accent/10" onClick={startCalibrationRun}>
        Fill to the mark and drive L = {fmt(sol.L, 4)} m
      </button>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Readout label="Travelled" value={fmt(v.d, 4)} unit={`of ${fmt(sol.L, 4)} m`} />
        <Readout label="Refill" value={fmt(v.used, 3)} unit="L" tone="info" />
        <Readout label="Measured rate" value={done ? fmt(v.used / st.calibArea, 3) : '—'} unit="L/ha" tone={done ? (Math.abs(v.used / st.calibArea - st.target) / st.target < 0.05 ? 'accent' : 'warn') : 'ink'} />
      </div>
      <Note>
        Steps: fit nozzles; fill to a marked level; W = nozzles × spacing; L = 1000/W for 0.1 ha; drive L at the working speed; refill to the mark — litres × 10 = L/ha. If it does not tally with the required rate, change nozzle or pressure and repeat. Raise the time scale to 1× to finish the run quickly.
      </Note>
    </Section>
  )
}

function Charts() {
  const st = useSprayer()
  const sol = solveSpray(st)
  const sp = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let S = 2; S <= 14.001; S += 0.25) {
      xs.push(S)
      ys.push(sol.nOpen > 0 ? applicationRate(sol.Q, sol.Wopen, S) : 0)
    }
    return [xs, ys, xs.map(() => st.target)]
  }, [sol.Q, sol.Wopen, sol.nOpen, st.target])
  const dist = useMemo(() => {
    const d = boomDistribution(st.kind, st.nozzles, st.spacing, st.boomH, sprayAngle(st.kind), 301)
    return [d.xs, d.ys]
  }, [st.kind, st.nozzles, st.spacing, st.boomH])
  const cv = boomCV(st.kind, st.nozzles, st.spacing, st.boomH, sprayAngle(st.kind))
  return (
    <Section title="Charts">
      <Chart data={sp} series={[{ label: 'rate', color: '#9bd17a', width: 2 }, { label: 'required', color: '#93a59a', dash: [4, 4] }]} xLabel="Forward speed (km/h)" yLabel="Application rate (L/ha)" marker={() => [useSprayer.getState().speed, live.rate]} height={160} />
      <Note>Rate ∝ 1/speed at a fixed pressure: doubling the speed halves the rate.</Note>
      <div className="h-2" />
      <Chart data={dist} series={[{ label: 'deposit', color: '#6fb3e0', width: 2 }]} xLabel="Across the boom (m)" yLabel="Relative deposit" height={150} yRange={[0, 2]} />
      <Note tone={cv > 0.1 ? 'warn' : 'dim'}>
        Coefficient of variation across the overlapped boom: {fmt(cv * 100, 3)} %. {st.kind === 'flat-fan' ? 'Tapered flat fans need about 100 % overlap.' : 'Hollow cones give a ring, so they need a larger overlap.'} (Distribution shapes are idealised.)
      </Note>
    </Section>
  )
}

function SprayWorking() {
  const st = useSprayer()
  const s = solveSpray(st)
  const Vrun = s.rate * st.calibArea
  const qNeed = nozzleFlowForRate(st.target, st.speed, st.spacing)
  const pNeed = 3 * (qNeed / st.q3) ** 2
  const cov = tankCoverage(LAYOUT.tank.capacity, Math.max(1, s.rate), s.W)
  const steps: WorkingStep[] = [
    { label: 'Effective sprayer width', tex: 'W = n\\times s', sub: `= ${st.nozzles}\\times${n(st.spacing, 3)}\\ \\text{m}`, result: `= ${n(s.W, 4)}\\ \\text{m}`, cite: C.calib('step 3') },
    { label: `Distance to cover ${st.calibArea} ha`, tex: 'L = \\dfrac{10\\,000\\,A}{W}', sub: `= \\dfrac{10\\,000\\times${st.calibArea}}{${n(s.W, 4)}}`, result: `= ${n(s.L, 4)}\\ \\text{m}`, cite: st.calibArea === 0.5 ? C.guide1819('Q4(e)') : C.calib('step 4, L = 1000/W for 0.1 ha') },
    { label: 'Pump delivery (positive displacement)', tex: 'Q_p = z\\,\\tfrac{\\pi}{4}d^2\\,s\\,N\\,\\eta_v', sub: `= 2\\times\\tfrac{\\pi}{4}(0.042)^2(0.024)(${st.ptoRpm})(0.9)`, result: `= ${n(s.pump, 3)}\\ \\text{L/min}`, cite: C.pump('piston pump'), beyond: true },
    { label: 'Nozzle flow at the working pressure (flow ∝ √p)', tex: 'q = q_3\\sqrt{p/3},\\quad p = \\min\\!\\left(p_{set},\\,\\left(\\tfrac{Q_p}{nK}\\right)^2\\right)', sub: `q_3 = ${n(st.q3, 3)}\\ \\text{L/min},\\; p = ${n(s.p, 3)}\\ \\text{bar}`, result: `q = ${n(s.q, 4)}\\ \\text{L/min per nozzle}`, cite: C.nozzle('flow ∝ √pressure') },
    { label: 'Relief-valve bypass back to the tank', tex: 'Q_b = Q_p - n_{open}\\,q', sub: `= ${n(s.pump, 3)} - ${s.nOpen}\\times${n(s.q, 3)}`, result: `= ${n(s.bypass, 3)}\\ \\text{L/min}`, cite: C.sprayer('relief valve') },
    { label: 'Application rate', tex: '\\text{rate} = \\dfrac{600\\,Q}{W\\,S}', sub: `= \\dfrac{600\\times${n(s.Q, 4)}}{${n(s.Wopen, 4)}\\times${n(st.speed, 3)}}`, result: `= ${n(s.rate, 4)}\\ \\text{L/ha}`, cite: C.perf('ground speed affects the application rate'), beyond: true },
    { label: 'Liquid used on the run, and back to L/ha', tex: 'V = \\text{rate}\\times A,\\quad \\text{rate} = V/A\\;(\\times10 \\text{ for } 0.1\\ \\text{ha})', sub: `V = ${n(s.rate, 4)}\\times${st.calibArea}`, result: `= ${n(Vrun, 4)}\\ \\text{L}`, cite: C.calib('step 6, ×10') },
    { label: `Nozzle and pressure for the required ${st.target} L/ha`, tex: 'q = \\dfrac{\\text{rate}\\,S\\,s}{600},\\quad p = 3\\left(\\dfrac{q}{q_3}\\right)^2', sub: `q = \\dfrac{${st.target}\\times${n(st.speed, 3)}\\times${n(st.spacing, 3)}}{600}`, result: `q = ${n(qNeed, 4)}\\ \\text{L/min},\\; p = ${n(pNeed, 3)}\\ \\text{bar}${pNeed > 6 || pNeed < 1 ? '\\ \\text{— change nozzle size}' : ''}`, cite: C.calib('step 7: change the nozzle or the pressure'), beyond: true },
    { label: 'One tankful', tex: '\\text{area} = V_{tank}/\\text{rate},\\quad \\text{distance} = 10\\,000\\,\\text{area}/W', sub: `= ${LAYOUT.tank.capacity}/${n(Math.max(1, s.rate), 4)}`, result: `= ${n(cov.ha, 3)}\\ \\text{ha},\\; ${n(cov.distance / 1000, 3)}\\ \\text{km}`, beyond: true },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

function UlvAside() {
  const N70 = dropletsPerCm2(1, 70e-6)
  const steps: WorkingStep[] = [
    { label: 'ULV work rate (15 m swath at 3.6 km/h)', tex: '\\text{ha/h} = \\dfrac{S\\,W}{10}', sub: '= \\dfrac{3.6\\times15}{10}', result: `= ${n(ulvRateKmh(3.6, 15), 3)}\\ \\text{ha/h}\\quad(10\\ \\text{m}: ${n(ulvRateKmh(3.6, 10), 3)})`, cite: C.ulv('1 m/s × 10 m ≈ 3.6 ha/h; end-of-chapter question') },
    { label: 'Deposit density, 1 L/ha as 70 µm droplets', tex: 'N = \\dfrac{V/A}{\\tfrac{\\pi}{6}d^3}', sub: '= \\dfrac{10^{-3}/10^{8}}{\\tfrac{\\pi}{6}(70\\times10^{-6})^3}', result: `= ${n(N70, 3)}\\ \\text{per cm}^2\\;(\\text{commonly quoted: }50)`, cite: C.ulv('70 µm, 1 L/ha ↔ 50 droplets/cm²') },
    { label: 'Same density with 100 µm droplets', tex: 'V/A = N\\,\\tfrac{\\pi}{6}d^3', sub: `= ${n(N70, 3)}\\times\\tfrac{\\pi}{6}(100\\times10^{-6})^3`, result: `= ${n(rateForDropletDensity(N70, 100e-6), 3)}\\ \\text{L/ha}`, cite: C.ulv('100 µm needs 1000 L/ha'), errata: ULV_ERRATUM },
  ]
  return (
    <Section title="Aside: ULV / CDA sprayers">
      <Working steps={steps} />
    </Section>
  )
}

export function SprayerPanel() {
  const st = useSprayer()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<SprayParams>) => {
    setPreset(null)
    st.set(p)
  }
  const toggleSection = (k: number) => {
    const s = [...st.sections] as [boolean, boolean, boolean]
    s[k] = !s[k]
    set({ sections: s })
  }
  return (
    <div>
      <LivePanel />
      <Section title="Sprayer">
        <Segmented<NozzleKind>
          value={st.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'flat-fan', label: 'Flat fan', title: 'No whirl plate — weed sprayers' },
            { value: 'hollow-cone', label: 'Hollow cone', title: 'Whirl plate without a centre hole' },
          ]}
        />
        <div className="mt-2 mb-1 text-[12px] text-ink/90">Nozzle size (flow at 3 bar)</div>
        <div className="mb-2 flex flex-wrap gap-1">
          {NOZZLE_SIZES.map((z) => (
            <button key={z.iso} onClick={() => set({ q3: z.q3 })} className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${Math.abs(st.q3 - z.q3) < 1e-6 ? 'border-accent text-accent' : 'border-line-2 text-ink/80'}`}>
              {z.iso} · {z.q3}
            </button>
          ))}
        </div>
        <Slider label="Relief-valve setting" value={st.pSet} min={1} max={6} step={0.1} unit="bar" onChange={(pSet) => set({ pSet })} />
        <Slider label="Forward speed" value={st.speed} min={2} max={14} step={0.1} unit="km/h" onChange={(speed) => set({ speed })} />
        <Slider label="Number of nozzles" value={st.nozzles} min={6} max={24} step={1} onChange={(nozzles) => set({ nozzles })} />
        <Slider label="Nozzle spacing" value={st.spacing} min={0.2} max={0.75} step={0.05} unit="m" onChange={(spacing) => set({ spacing })} />
        <Slider label="Boom height" value={st.boomH} min={0.2} max={1} step={0.01} unit="m" onChange={(boomH) => set({ boomH })} />
        <Slider label="PTO speed" value={st.ptoRpm} min={300} max={600} step={10} unit="rpm" onChange={(ptoRpm) => set({ ptoRpm })} />
        <div className="mb-2 grid grid-cols-3 gap-1">
          {['Right', 'Centre', 'Left'].map((lab, k) => (
            <button key={lab} onClick={() => toggleSection(k)} className={`rounded border px-1.5 py-1 text-[11.5px] ${st.sections[k] ? 'border-accent text-accent' : 'border-line-2 text-mute'}`}>
              {lab} {st.sections[k] ? 'on' : 'off'}
            </button>
          ))}
        </div>
        <Toggle label="Spraying (main cut-off open)" checked={st.spraying} onChange={(spraying) => set({ spraying })} />
        <Toggle label="Show liquid flow and spray" checked={st.flows} onChange={(flows) => st.set({ flows })} />
      </Section>
      <Calibration />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <SprayWorking />
      <UlvAside />
    </div>
  )
}
