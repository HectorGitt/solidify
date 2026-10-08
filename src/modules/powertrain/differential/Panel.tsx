import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { diffSpeeds, turnSpeedRatio, type DiffCase } from '@/physics/drives'
import { spiderSpin } from '@/physics/transmission'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../common/PanelBits'
import { CROWN_RATIO, DIM, halfShaftTorques, live, useDiff } from './model'

const MODE_LABEL: Record<DiffCase, string> = { straight: 'Straight', cornering: 'Cornering', held: 'One held', mud: 'Mud' }

const PRESETS: Preset[] = [
  {
    id: 'held',
    label: 'One wheel held',
    note: 'Left wheel held, cage at 600 × 11/47 = 140 rpm. Expect the right wheel at 2 × 140 = 281 rpm and the planet pinions spinning on the cross-pin.',
    apply: () => useDiff.getState().set({ mode: 'held', locked: false, pinionRpm: 600 }),
  },
  {
    id: 'corner',
    label: 'Cornering',
    note: 'Turning left on a 4 m radius with a 1.5 m track: the outer wheel gains exactly what the inner wheel loses — "faster by the same amount".',
    apply: () => useDiff.getState().set({ mode: 'cornering', locked: false, turnRadius: 4, pinionRpm: 600 }),
  },
  {
    id: 'mud',
    label: 'Wheel in mud',
    note: 'Right wheel on mud that takes only 250 N·m. Open diff: the left wheel gets the same 250 N·m, the tractor sits still and the mud wheel spins at 2× cage speed.',
    apply: () => useDiff.getState().set({ mode: 'mud', locked: false, mudGrip: 250, pinionTorque: 600 }),
  },
  {
    id: 'lock',
    label: 'Mud + diff lock',
    note: 'Same mud, diff lock pressed: both half shafts turn at cage speed and the firm wheel takes the torque the mud cannot.',
    apply: () => useDiff.getState().set({ mode: 'mud', locked: true, mudGrip: 250, pinionTorque: 600 }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.left === b.left && a.right === b.right && a.cage === b.cage && a.lock === b.lock)
  const st = useDiff()
  const T = halfShaftTorques(st)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Pinion" value={fmt(v.pinion, 3)} unit="rpm" />
        <Readout label="Crown / cage" value={fmt(v.cage, 3)} unit="rpm" tone="accent" />
        <Readout label="Planet spin" value={fmt(Math.abs(v.spider), 3)} unit="rpm" tone={Math.abs(v.spider) > 1 ? 'warn' : 'ink'} />
        <Readout label="Left wheel" value={fmt(v.left, 3)} unit="rpm" tone="info" />
        <Readout label="Right wheel" value={fmt(v.right, 3)} unit="rpm" tone="info" />
        <Readout label="Diff lock" value={v.lock > 0.95 ? 'Engaged' : v.lock > 0.05 ? 'Moving' : 'Free'} tone={v.lock > 0.95 ? 'warn' : 'ink'} />
        <Readout label="Cage torque" value={fmt(T.Tc, 4)} unit="N·m" />
        <Readout label="Left torque" value={fmt(T.left, 4)} unit="N·m" />
        <Readout label="Right torque" value={fmt(T.right, 4)} unit="N·m" />
      </div>
      <Note>
        Mean rule: (left + right)/2 = {fmt((v.left + v.right) / 2, 4)} rpm = cage speed. Planet spin is relative to the cage.
      </Note>
    </Section>
  )
}

function TurnChart() {
  const R = useDiff((s) => s.turnRadius)
  const mode = useDiff((s) => s.mode)
  const nc = useDiff((s) => s.pinionRpm) / CROWN_RATIO
  const data = useMemo(() => {
    const xs: number[] = []
    const inner: number[] = []
    const outer: number[] = []
    const cage: number[] = []
    for (let r = 1; r <= 20.0001; r += 0.25) {
      const s = diffSpeeds(nc, 'cornering', false, r, DIM.track)
      xs.push(r)
      inner.push(s.left)
      outer.push(s.right)
      cage.push(nc)
    }
    return [xs, inner, outer, cage]
  }, [nc])
  return (
    <Section title="Wheel speeds on a turn">
      <Chart
        data={data}
        series={[
          { label: 'inner (left)', color: '#6fb3e0', width: 2 },
          { label: 'outer (right)', color: '#e8794f', width: 2 },
          { label: 'cage', color: '#93a59a', dash: [4, 4] },
        ]}
        xLabel="Turn radius to the centre line (m)"
        yLabel="Half-shaft speed (rpm)"
        marker={() => (mode === 'cornering' ? [R, diffSpeeds(nc, 'cornering', false, R, DIM.track).right] : null)}
        height={170}
      />
      <Note>
        Blue: inner wheel, orange: outer wheel, dashed: cage. Each wheel's speed is proportional to the radius of its path; the cage always sits halfway. Track {DIM.track} m (typical range 1.42–2.13 m).
      </Note>
    </Section>
  )
}

function DiffWorking() {
  const st = useDiff()
  const nc = st.pinionRpm / CROWN_RATIO
  const sp = diffSpeeds(nc, st.mode, st.locked, st.turnRadius, DIM.track)
  const T = halfShaftTorques(st)
  const steps: WorkingStep[] = [
    {
      label: 'Crown wheel & pinion reduction',
      tex: 'i = \\dfrac{z_{crown}}{z_{pinion}},\\qquad N_{cage} = \\dfrac{N_{pinion}}{i}',
      sub: `i = \\dfrac{${DIM.zCrown}}{${DIM.zPinion}},\\quad N_{cage} = \\dfrac{${n(st.pinionRpm, 4)}}{${n(CROWN_RATIO, 4)}}`,
      result: `i = ${n(CROWN_RATIO, 4)},\\quad N_{cage} = ${n(nc, 4)}\\ \\text{rpm}`,
      cite: SRC.tts510('p7; gear rule D·N = d·n, TOP p3'),
    },
    {
      label: 'The cage turns at the mean of the two wheel speeds',
      tex: 'N_{cage} = \\dfrac{N_L + N_R}{2}',
      sub: `\\dfrac{${n(sp.left, 4)} + ${n(sp.right, 4)}}{2}`,
      result: `= ${n((sp.left + sp.right) / 2, 4)}\\ \\text{rpm}`,
      cite: SRC.tts510('p8; PT p11 "faster by the same amount"'),
    },
  ]
  if (st.locked) {
    steps.push({
      label: 'Diff lock engaged',
      tex: 'N_L = N_R = N_{cage}',
      result: `= ${n(nc, 4)}\\ \\text{rpm (no turning possible)}`,
      cite: SRC.tts510('p8 diff lock'),
    })
  } else if (st.mode === 'held' || st.mode === 'mud') {
    steps.push({
      label: st.mode === 'held' ? 'One wheel held' : 'Firm wheel stands still, mud wheel spins',
      tex: 'N_L = 0\\;\\Rightarrow\\; N_R = 2N_{cage}',
      sub: `2 \\times ${n(nc, 4)}`,
      result: `N_R = ${n(2 * nc, 4)}\\ \\text{rpm}`,
      cite: SRC.tts510('p8'),
    })
  } else if (st.mode === 'cornering') {
    const R = st.turnRadius
    const t = DIM.track
    steps.push({
      label: 'Cornering: speed in proportion to path radius',
      tex: 'N_{in} = N_{cage}\\dfrac{R - t/2}{R},\\quad N_{out} = N_{cage}\\dfrac{R + t/2}{R}',
      sub: `R = ${n(R, 3)}\\ \\text{m},\\ t = ${t}\\ \\text{m},\\quad N_{in}/N_{out} = ${n(turnSpeedRatio(R, t), 4)}`,
      result: `N_{in} = ${n(sp.left, 4)},\\ N_{out} = ${n(sp.right, 4)}\\ \\text{rpm}\\ (\\pm${n(sp.right - nc, 3)})`,
      cite: SRC.pt510('p11'),
      beyond: true,
    })
  }
  const spin = spiderSpin(sp.left, sp.right, DIM.zSide, DIM.zSpider)
  steps.push({
    label: 'Planet pinion spin on the cross-pin (relative to the cage)',
    tex: 'n_p = \\dfrac{N_L - N_R}{2}\\cdot\\dfrac{z_{side}}{z_{planet}}',
    sub: `\\dfrac{${n(sp.left, 4)} - ${n(sp.right, 4)}}{2}\\cdot\\dfrac{${DIM.zSide}}{${DIM.zSpider}}`,
    result: `= ${n(Math.abs(spin), 4)}\\ \\text{rpm}${Math.abs(spin) < 1e-6 ? '\\ \\text{(pinions still)}' : ''}`,
    cite: SRC.tts510('p8 — pinions spin only when the wheel speeds differ'),
    beyond: true,
  })
  steps.push({
    label: 'Torque: equal split in an open diff, limited by the weaker wheel',
    tex: 'T_{cage} = T_p\\,i\\,\\eta,\\quad T_L = T_R = \\min\\!\\left(\\tfrac{T_{cage}}{2},\\,T_{grip}\\right)',
    sub: `T_{cage} = ${n(st.pinionTorque, 4)}\\times${n(CROWN_RATIO, 4)}\\times0.98`,
    result: `T_{cage} = ${n(T.Tc, 4)},\\ T_L = ${n(T.left, 4)},\\ T_R = ${n(T.right, 4)}\\ \\text{N·m}`,
    cite: SRC.mech502('p8, 98 % per gear pair'),
    beyond: true,
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function DiffPanel() {
  const st = useDiff()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Parameters<typeof st.set>[0]) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Running condition">
        <Segmented<DiffCase>
          value={st.mode}
          onChange={(mode) => set({ mode })}
          options={(Object.keys(MODE_LABEL) as DiffCase[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        />
        <Toggle label="Diff lock (pedal)" checked={st.locked} onChange={(locked) => set({ locked })} hint="Slides the dog collar into the cage: half shaft and cage locked together" />
        <Slider label="Pinion speed (from gearbox)" value={st.pinionRpm} min={0} max={1200} step={10} unit="rpm" onChange={(pinionRpm) => set({ pinionRpm })} />
        <Slider label="Pinion torque" value={st.pinionTorque} min={50} max={1500} step={10} unit="N·m" onChange={(pinionTorque) => set({ pinionTorque })} />
        {st.mode === 'cornering' ? <Slider label="Turn radius (left turn)" value={st.turnRadius} min={1} max={20} step={0.1} unit="m" onChange={(turnRadius) => set({ turnRadius })} /> : null}
        {st.mode === 'mud' ? <Slider label="Torque the mud can take" value={st.mudGrip} min={0} max={1500} step={10} unit="N·m" onChange={(mudGrip) => set({ mudGrip })} /> : null}
        <Segmented<'2' | '4'> label="Planet pinions" size="sm" value={String(st.spiders) as '2' | '4'} onChange={(v) => set({ spiders: Number(v) as 2 | 4 })} options={[{ value: '2', label: '2 pinions' }, { value: '4', label: '4 pinions' }]} />
        {st.locked && st.mode === 'cornering' ? <Note tone="warn">With the diff lock in, the tractor cannot turn: both wheels are forced to the same speed. Release it before a corner.</Note> : null}
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <TurnChart />
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">
          <li>Crown wheel & pinion: turns the drive through 90° and gives a big reduction (small pinion, large crown wheel); most tractors use helical teeth.</li>
          <li>Straight: the whole unit turns as one and the pinions do not spin.</li>
          <li>Cornering: the pinions spin and walk round the slower side gear; one wheel faster by the amount the other is slower.</li>
          <li>One wheel held → the other at twice case speed.</li>
          <li>Diff lock: pedal-operated; mechanical, electrical, hydraulic or automatic. Locks the half shafts so one wheel cannot spin; no cornering while engaged.</li>
        </ul>
      </Section>
      <DiffWorking />
    </div>
  )
}
