import { useMemo } from 'react'
import { SRC } from '@/content/citations'
import { rpmToRad, syncTime } from '@/physics/gearing'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PowerLegend, Table } from '../common/PanelBits'
import { CROWN, FINAL, ROLLING_R, Z, type Gear, type Range, type Variant } from './dims'
import { PHASE_LABEL, boxRatio, kmh, live, speedTable, useGearbox, type GearboxParams } from './model'

const set = (p: Partial<GearboxParams>) => useGearbox.getState().set(p)

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.top === b.top && a.output === b.output && a.phase === b.phase && a.dw === b.dw)
  return (
    <Section title="Live" right={<Badge tone={v.phase === 'drive' ? 'accent' : 'warn'}>{PHASE_LABEL[v.phase]}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Engaged" value={`${v.gear} · ${v.range}`} tone="accent" />
        <Readout label="Top shaft" value={fmt(v.top, 3)} unit="rpm" />
        <Readout label="Bottom shaft" value={fmt(v.bottom, 3)} unit="rpm" />
        <Readout label="Output" value={fmt(v.output, 3)} unit="rpm" />
        <Readout label="Rear wheel" value={fmt(v.wheel, 3)} unit="rpm" />
        <Readout label="Ground speed" value={fmt(v.kmh, 3)} unit="km/h" tone="info" />
        {v.phase === 'sync' ? <Readout label="Speed difference" value={fmt(v.dw, 3)} unit="rpm" tone="warn" /> : null}
        <Readout label="Last engagement" value={fmt(v.clash, 2)} unit="m/s slip" tone={v.clash > 0.3 ? 'warn' : 'ink'} />
      </div>
    </Section>
  )
}

function Levers() {
  const s = useGearbox()
  const btn = (on: boolean) => `rounded-md border px-0 py-1.5 text-[13px] font-medium ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 text-ink/85 hover:border-accent/50'}`
  const gate: (Gear | null)[][] = [
    ['1', '3'],
    ['N', 'N'],
    ['2', 'R'],
  ]
  return (
    <Section title="Levers">
      <div className="flex gap-4">
        <div>
          <div className="mb-1 text-[11px] text-dim">Gear lever</div>
          <div className="grid w-[110px] grid-cols-2 gap-1">
            {gate.flat().map((g, i) =>
              g === 'N' ? (
                i === 2 ? (
                  <button key={i} className={`col-span-2 ${btn(s.gear === 'N')}`} onClick={() => set({ gear: 'N' })}>
                    N
                  </button>
                ) : null
              ) : (
                <button key={i} className={btn(s.gear === g)} onClick={() => set({ gear: g as Gear })}>
                  {g}
                </button>
              ),
            )}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-dim">Range lever</div>
          <div className="grid w-[44px] gap-1">
            {(['H', 'N', 'L'] as Range[]).map((r) => (
              <button key={r} className={btn(s.range === r)} onClick={() => set({ range: r })}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 text-[11px] leading-snug text-mute">
          {s.variant === 'synchro' ? 'Change gear on the move: the synchroniser matches the speeds first.' : 'The tractor is brought to rest before the gears or dogs are engaged — otherwise they clash.'} Range and forward/reverse changes always need a stop.
        </div>
      </div>
      <div className="mt-2">
        <Segmented<Variant>
          value={s.variant}
          onChange={(variant) => set({ variant })}
          options={[
            { value: 'sliding', label: 'Sliding mesh', title: 'Spur gears slid into mesh' },
            { value: 'constant', label: 'Constant mesh', title: 'Dog collars' },
            { value: 'synchro', label: 'Synchromesh', title: 'Cone synchronisers' },
          ]}
        />
      </div>
      <Slider label="Engine speed" value={s.engineRpm} min={800} max={2200} step={10} unit="rpm" onChange={(engineRpm) => set({ engineRpm })} />
      {s.variant === 'synchro' ? (
        <>
          <Slider label="Synchroniser cone torque" value={s.syncTorque} min={5} max={80} step={1} unit="N·m" onChange={(syncTorque) => set({ syncTorque })} />
          <Slider label="Inertia to be matched" value={s.syncJ} min={0.01} max={0.2} step={0.005} unit="kg·m²" onChange={(syncJ) => set({ syncJ })} hint="Top shaft + clutch plate" />
        </>
      ) : null}
      <Toggle label="Colour the power path" checked={s.powerFlow} onChange={(powerFlow) => set({ powerFlow })} />
      {s.powerFlow ? <PowerLegend /> : null}
      <Note>
        {s.variant === 'sliding'
          ? 'Sliding mesh: straight-toothed spur gears moved along the shaft by selector forks — rather noisy.'
          : s.variant === 'constant'
            ? 'Constant mesh: gears always in mesh, groups connected by special couplings (dog collars). Helical gears are quieter and stronger but more expensive.'
            : 'Synchromesh: special couplings bring the pair of gears to the same speed before the teeth engage. Some tractors fit it only to the top gear of each range.'}{' '}
        Gear oil SAE 40 or 50, checked weekly.
      </Note>
    </Section>
  )
}

function SpeedChart() {
  const rpm = useGearbox((s) => s.engineRpm)
  const rows = useMemo(() => speedTable(rpm), [rpm])
  const labels = rows.map((r) => `${r.labels[0]}${r.labels[1]}`)
  const xs = rows.map((_, i) => i + 1)
  const ys = rows.map((r) => r.kmh * Math.sign(r.ratio))
  const cur = useGearbox((s) => `${s.gear}${s.range}`)
  const hi = labels.indexOf(cur)
  return (
    <Section title="Speeds at this engine speed">
      <Chart data={[xs, ys]} series={[{ label: 'km/h', color: '#9bd17a', points: true, width: 1 }]} xLabel="Gear (slowest → fastest; reverse negative)" yLabel="km/h" marker={() => (hi >= 0 ? [hi + 1, ys[hi]] : null)} height={150} />
      <Table
        head={['Gear', 'Box ratio ω_o/ω_i', 'Overall i', 'Wheel rpm', 'km/h']}
        rows={rows.map((r, i) => [labels[i], fmt(r.ratio, 3), fmt(r.reduction, 3), fmt(r.wheelRpm, 3), fmt(r.kmh * Math.sign(r.ratio), 3)])}
        highlight={hi >= 0 ? hi : undefined}
      />
      <Note>
        Crown wheel {Z.crown}:{Z.pinion} = {fmt(CROWN, 3)} and final reduction {FINAL}:1 after the box; rolling radius {ROLLING_R} m (14.9-28 tyre). A tractor box spans less than 1.6 to about 32 km/h with more gears. Tooth numbers are typical values.
      </Note>
    </Section>
  )
}

function GearWorking() {
  const s = useGearbox()
  const r = boxRatio(s.gear, s.range)
  const steps: WorkingStep[] = []
  if (Number.isFinite(r)) {
    const pair = { '1': [Z.t1, Z.b1], '2': [Z.t2, Z.b2], '3': [Z.t3, Z.b3], R: [Z.tr, Z.br] }[s.gear as '1']
    const rng = s.range === 'H' ? [Z.rhb, Z.rho] : [Z.rlb, Z.rlo]
    steps.push({
      label: 'Gear train ratio',
      tex: '\\dfrac{N_{out}}{N_{in}} = \\dfrac{\\prod z_{driver}}{\\prod z_{follower}}',
      sub: s.gear === 'R' ? `= \\dfrac{${pair[0]}\\times${Z.idler}\\times${rng[0]}}{${Z.idler}\\times${pair[1]}\\times${rng[1]}}\\ (\\text{idler cancels})` : `= \\dfrac{${pair[0]}\\times${rng[0]}}{${pair[1]}\\times${rng[1]}}`,
      result: `= ${n(Math.abs(r), 4)}${r < 0 ? '\\ \\text{(reverse)}' : ''}`,
      cite: SRC.top510('p3–4 — D·N = d·n; Π drivers/Π followers'),
    })
    const wheel = (s.engineRpm * Math.abs(r)) / (CROWN * FINAL)
    steps.push({
      label: 'Wheel speed through crown wheel and final drive',
      tex: 'N_{wheel} = \\dfrac{N_e \\,(N_{out}/N_{in})}{i_{cw}\\, i_{fd}}',
      sub: `= \\dfrac{${s.engineRpm}\\times${n(Math.abs(r), 4)}}{${n(CROWN, 4)}\\times${FINAL}}`,
      result: `= ${n(wheel, 4)}\\ \\text{rpm}`,
      cite: SRC.tts510('p1, p10 — three reductions'),
    })
    steps.push({
      label: 'Ground speed',
      tex: 'v = \\dfrac{2\\pi r N}{60}\\times3.6',
      sub: `= \\dfrac{2\\pi(${ROLLING_R})(${n(wheel, 4)})}{60}\\times3.6`,
      result: `= ${n(Math.abs(kmh(s.engineRpm, s.gear, s.range)), 4)}\\ \\text{km/h}`,
      beyond: true,
      cite: SRC.beyond('v = ωr, no slip'),
    })
  } else steps.push({ label: 'Neutral', tex: '\\text{no gear (or no range) engaged — no drive}', cite: SRC.tts510('p4') })
  if (s.variant === 'synchro') {
    const dw = rpmToRad(s.engineRpm) * Math.abs((Z.t3 / Z.b3 - Z.t2 / Z.b2) / (Z.t3 / Z.b3))
    steps.push({
      label: 'Synchronising time (2nd → 3rd at this engine speed)',
      tex: 't = \\dfrac{J\\,\\Delta\\omega}{T_{cone}}',
      sub: `= \\dfrac{${s.syncJ}\\times${n(dw, 4)}}{${s.syncTorque}}`,
      result: `= ${n(syncTime(s.syncJ, dw, s.syncTorque), 3)}\\ \\text{s}`,
      beyond: true,
      cite: SRC.beyond('synchroniser: constant cone torque'),
    })
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function GearboxPanel() {
  return (
    <div>
      <LivePanel />
      <Levers />
      <SpeedChart />
      <GearWorking />
    </div>
  )
}
