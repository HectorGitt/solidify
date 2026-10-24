import { useMemo } from 'react'
import { SRC } from '@/content/citations'
import { groundSpeedKmh } from '@/physics/gearing'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Toggle, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PowerLegend, Table } from '../common/PanelBits'
import { CROWN, FINAL, FIXED, FORWARD_SPEEDS, ROLLING_R, SS, Z, boxRatio, forwardTable, gearRatio, rangeRatio, shuttleRatio, ssRatio, type GearNo, type RangeSel, type Shuttle, type SpeedShift } from './dims'
import { PHASE_LABEL, live, useMF, type MFParams } from './model'

const set = (p: Partial<MFParams>) => useMF.getState().set(p)

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.output === b.output && a.phase === b.phase && a.input === b.input && a.pto === b.pto && a.front === b.front)
  const rpm = useMF((s) => s.engineRpm)
  const rows = useMemo(() => forwardTable(rpm), [rpm])
  const key = v.engaged.slice(0, 3)
  const idx = rows.findIndex((r) => r.key === key) + 1
  const name = v.engaged[3] === 'N' || idx === 0 ? 'Neutral' : `${v.engaged[3] === 'R' ? 'R' : 'F'}${idx}`
  return (
    <Section title="Live" right={<Badge tone={v.phase === 'drive' ? 'accent' : 'warn'}>{PHASE_LABEL[v.phase]}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Speed" value={name} tone="accent" />
        <Readout label="Ground speed" value={fmt(v.kmh, 3)} unit="km/h" tone="info" />
        <Readout label="Box ratio" value={Number.isFinite(v.ratio) ? fmt(v.ratio, 3) : '—'} unit="ω_out/ω_in" />
        <Readout label="Input (sun)" value={fmt(v.input, 4)} unit="rpm" />
        <Readout label="Carrier" value={fmt(v.carrier, 4)} unit="rpm" />
        <Readout label="Mainshaft" value={fmt(v.main, 4)} unit="rpm" />
        <Readout label="Layshaft" value={fmt(v.lay, 4)} unit="rpm" />
        <Readout label="Output" value={fmt(v.output, 4)} unit="rpm" />
        <Readout label="Rear wheel" value={fmt(v.wheel, 3)} unit="rpm" />
        <Readout label="PTO shaft" value={fmt(v.pto, 4)} unit="rpm" />
        <Readout label="Front drive" value={fmt(v.front, 4)} unit="rpm" />
        <Readout label="Planet spin" value={fmt(v.planet, 3)} unit="rpm" />
      </div>
    </Section>
  )
}

function Controls() {
  const s = useMF()
  return (
    <Section title="Controls">
      <Segmented<SpeedShift>
        label="Speed-shift (on the move, no clutch)"
        value={s.speedShift}
        onChange={(speedShift) => set({ speedShift })}
        options={[
          { value: 'L', label: 'Low (ring held)' },
          { value: 'H', label: 'High (locked 1 : 1)' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <Segmented<Shuttle>
          label="Shuttle"
          size="sm"
          value={s.shuttle}
          onChange={(shuttle) => set({ shuttle })}
          options={[
            { value: 'F', label: 'F' },
            { value: 'N', label: 'N' },
            { value: 'R', label: 'R' },
          ]}
        />
        <Segmented<RangeSel>
          label="Range"
          size="sm"
          value={s.range}
          onChange={(range) => set({ range })}
          options={[
            { value: 'L', label: 'Low' },
            { value: 'N', label: 'N' },
            { value: 'H', label: 'High' },
          ]}
        />
      </div>
      <Segmented<string>
        label="Gear lever (synchromesh)"
        value={String(s.gear)}
        onChange={(v) => set({ gear: Number(v) as GearNo })}
        options={[
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
          { value: '0', label: 'N' },
        ]}
      />
      {s.warning ? <Note tone="warn">{s.warning}</Note> : null}
      <Toggle label="Four-wheel-drive clutch" checked={s.fourWD} onChange={(fourWD) => set({ fourWD })} />
      <Toggle label="PTO engaged" checked={s.pto} onChange={(pto) => set({ pto })} />
      <Toggle label="Parking brake" checked={s.parkingBrake} onChange={(parkingBrake) => set({ parkingBrake })} />
      <Slider label="Engine speed" value={s.engineRpm} min={800} max={2200} step={10} unit="rpm" onChange={(engineRpm) => set({ engineRpm })} />
      <Toggle label="Colour the power path" checked={s.powerFlow} onChange={(powerFlow) => set({ powerFlow })} />
      {s.powerFlow ? <PowerLegend /> : null}
      <Note>Gear lever and shuttle change through the clutch on the move (synchromesh and coupler); the range gear is not synchronised, so the tractor stops first. The speed-shift changes instantly.</Note>
    </Section>
  )
}

function SpeedChart() {
  const rpm = useMF((s) => s.engineRpm)
  const rows = useMemo(() => forwardTable(rpm), [rpm])
  const revFactor = Math.abs(shuttleRatio('R') / shuttleRatio('F'))
  const xs = rows.map((_, i) => i + 1)
  const fwd = rows.map((r) => r.kmh)
  const rev = rows.map((r, i) => (i < 12 ? -r.kmh * revFactor : null))
  const s = useMF()
  const cur = rows.findIndex((r) => r.key === `${s.range}${s.gear}${s.speedShift}`)
  return (
    <Section title="16 forward / 12 reverse speeds">
      <Chart
        data={[xs, fwd, rev]}
        series={[
          { label: 'forward', color: '#9bd17a', points: true, width: 1.25 },
          { label: 'reverse', color: '#e8794f', points: true, width: 1.25 },
        ]}
        xLabel="Speed number (slowest → fastest)"
        yLabel="km/h (reverse negative)"
        marker={() => (cur >= 0 && s.shuttle !== 'N' ? [cur + 1, s.shuttle === 'R' ? -rows[cur].kmh * revFactor : rows[cur].kmh] : null)}
        height={170}
      />
      <Table
        head={['#', 'Range·gear·shift', 'ω_o/ω_i', 'Overall', 'Fwd km/h', 'Rev km/h']}
        rows={rows.map((r, i) => [i + 1, `${r.labels[0]} ${r.labels[1]} ${r.labels[2]}`, fmt(Math.abs(r.ratio), 3), fmt(r.reduction, 3), fmt(r.kmh, 3), i < 12 ? fmt(r.kmh * revFactor, 3) : '—'])}
        highlight={cur >= 0 ? cur : undefined}
      />
      <Note>
        At {rpm} rpm with {ROLLING_R} m rolling radius: {fmt(rows[0].kmh, 3)}–{fmt(rows[15].kmh, 3)} km/h (typical: 1.6–32 km/h). Reverse is blocked in speeds 13–16: shuttle reverse in 12 speeds only.
      </Note>
    </Section>
  )
}

function MFWorking() {
  const s = useMF()
  const steps: WorkingStep[] = []
  steps.push({ label: 'Number of forward speeds', tex: 'n = 4\\ \\text{gears} \\times 2\\ \\text{ranges} \\times 2\\ \\text{speed-shift}', result: `= ${FORWARD_SPEEDS}`, cite: SRC.top510('p3 — 4 × 2 gearbox gears, speed-shift in each') })
  steps.push({
    label: 'Speed-shift low: ring held, sun in, carrier out',
    tex: '\\dfrac{\\omega_c}{\\omega_s} = \\dfrac{z_s}{z_s+z_r}',
    sub: `= \\dfrac{${SS.zs}}{${SS.zs}+${SS.zr}}`,
    result: `= ${n(ssRatio('L'), 4)}\\quad(\\text{high: locked} = 1)`,
    beyond: true,
    cite: SRC.beyond('Willis equation; PT p6 gives the rule ring held → slower, same direction'),
  })
  const r = boxRatio(s.speedShift, s.shuttle, s.gear, s.range)
  if (Number.isFinite(r) && s.shuttle !== 'N' && s.gear !== 0 && s.range !== 'N') {
    const g = s.gear as 1 | 2 | 3 | 4
    const sh = s.shuttle === 'F' ? `\\dfrac{${Z.fwd}}{${Z.cm}}` : `\\dfrac{${Z.rev}}{${Z.idler}}\\cdot\\dfrac{${Z.idler}}{${Z.cm}}`
    const rg = s.range === 'H' ? `\\dfrac{${Z.lh}}{${Z.oh}}` : `\\dfrac{${Z.ll}}{${Z.ol}}`
    steps.push({
      label: 'Gear train ratio = Π driver teeth / Π follower teeth',
      tex: '\\dfrac{N_{out}}{N_{in}} = i_{ss}\\cdot\\dfrac{z_{shuttle}}{z_{cm}}\\cdot\\dfrac{z_{main}}{z_{lay}}\\cdot\\dfrac{z_{lay,range}}{z_{out}}',
      sub: `= ${n(ssRatio(s.speedShift), 4)}\\cdot${sh}\\cdot\\dfrac{${Z.m[g - 1]}}{${Z.l[g - 1]}}\\cdot${rg}`,
      result: `= ${n(Math.abs(ssRatio(s.speedShift) * shuttleRatio(s.shuttle) * gearRatio(g) * rangeRatio(s.range)), 4)}${s.shuttle === 'R' ? '\\ (\\text{reversed})' : ''}`,
      cite: SRC.top510('p4 — Π drivers / Π followers'),
    })
    const wheel = (s.engineRpm * Math.abs(r)) / FIXED
    steps.push({
      label: 'Wheel speed after crown wheel and final drive',
      tex: 'N_w = \\dfrac{N_e\\,(N_{out}/N_{in})}{i_{cw}\\,i_{fd}}',
      sub: `= \\dfrac{${s.engineRpm}\\times${n(Math.abs(r), 4)}}{${n(CROWN, 4)}\\times${FINAL}}`,
      result: `= ${n(wheel, 4)}\\ \\text{rpm}`,
      cite: SRC.tts510('p1, p10 — gearbox, crown wheel, final reduction'),
    })
    steps.push({
      label: 'Ground speed',
      tex: 'v = \\dfrac{2\\pi r N_w}{60}\\times3.6',
      sub: `= \\dfrac{2\\pi(${ROLLING_R})(${n(wheel, 4)})}{60}\\times3.6`,
      result: `= ${n(groundSpeedKmh(wheel, 1, ROLLING_R), 4)}\\ \\text{km/h}`,
      beyond: true,
      cite: SRC.beyond('v = ωr, no wheel slip'),
    })
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function MF16Panel() {
  return (
    <div>
      <LivePanel />
      <Controls />
      <SpeedChart />
      <MFWorking />
    </div>
  )
}
