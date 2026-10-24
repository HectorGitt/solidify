import { useMemo, useState } from 'react'
import { SRC, cite } from '@/content/citations'
import { FARMLAND_GEARS, idealGearCurve, powerEnvelopeSpeed, maxPower } from '@/physics/tractor'
import { shaftPower } from '@/physics/transmission'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../common/PanelBits'
import { CROWN_RATIO, D, FINAL_RATIO, PTO_RATIO, gearboxRatio, live, solve, stages, useDrive, type Drive, type Gear } from './model'

/** The 2022/23 AEE510 final paper (photographed). */
const EXAM2223 = (where: string) => cite('AEE510', 'WhatsApp Image 2025-07-24 at 11.15.32 (2022/23 final exam)', where)

const PRESETS: Preset[] = [
  {
    id: 'g3',
    label: 'Gear 3, 12 kN',
    note: 'Farmland tractor in gear 3 (q = 139.5) pulling 12 kN with 1.2 kN rolling resistance and 12 % slip.',
    apply: () => useDrive.getState().set({ gear: '3', pull: 12, rolling: 1.2, slip: 0.12 }),
  },
  {
    id: 'g7',
    label: 'Gear 7, light pull',
    note: 'Gear 7 (q = 47.3): high speed, low pull — high pull at low speed or low pull at high speed.',
    apply: () => useDrive.getState().set({ gear: '7', pull: 4, rolling: 1.2, slip: 0.05 }),
  },
  {
    id: 'bottom',
    label: 'Bottom gear',
    note: 'Bottom gear at light load: the engine runs above 2000 rpm and the rear wheels at only ≈ 17 rpm — a reduction of more than 100 : 1 in three stages.',
    apply: () => useDrive.getState().set({ gear: '3', pull: 2, rolling: 1.2, slip: 0.04 }),
  },
  {
    id: 'stall',
    label: 'Overload (stall)',
    note: 'Ask for more pull than the engine can give in this gear: the engine is pulled down past its torque peak and stalls.',
    apply: () => useDrive.getState().set({ gear: '3', pull: 40, rolling: 1.5, slip: 0.2 }),
  },
]

const DRIVE_LABEL: Record<Drive, string> = { '1wd': '1-wheel', '2wd': '2-wheel', '4wd': '4-wheel' }

/** Block diagram of the power train for 1-, 2- and 4-wheel drive (exam 2022/23 Q1; TTS Fig 30). */
function PowerTrainDiagram({ drive }: { drive: Drive }) {
  const box = (x: number, y: number, w: number, label: string, on = true) => (
    <g key={label + x + y}>
      <rect x={x} y={y} width={w} height={20} rx={3} fill={on ? '#2a3a30' : '#1a221e'} stroke={on ? '#d0631c' : '#34433b'} />
      <text x={x + w / 2} y={y + 13.5} fontSize={8.5} fill={on ? '#e8efe9' : '#5d6b62'} textAnchor="middle" fontFamily="Inter, sans-serif">
        {label}
      </text>
    </g>
  )
  const line = (x1: number, y1: number, x2: number, y2: number, on = true) => <line key={`${x1}${y1}${x2}${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? '#f5b942' : '#34433b'} strokeWidth={2} />
  const four = drive === '4wd'
  const one = drive === '1wd'
  return (
    <svg viewBox="0 0 320 200" className="w-full" role="img" aria-label={`Power train diagram, ${DRIVE_LABEL[drive]} drive`}>
      {/* main line: engine → clutch → gearbox → diff */}
      {box(4, 90, 46, 'Engine')}
      {line(50, 100, 58, 100)}
      {box(58, 90, 40, 'Clutch')}
      {line(98, 100, 106, 100)}
      {box(106, 90, 50, 'Gearbox')}
      {line(156, 100, 166, 100)}
      {one ? (
        <>
          {box(166, 90, 56, 'Final drive')}
          {line(222, 100, 232, 100)}
          {box(232, 90, 50, 'Wheel')}
          <text x={160} y={140} fontSize={8} fill="#93a59a" textAnchor="middle" fontFamily="Inter, sans-serif">
            One driven wheel (e.g. chain to a land wheel): no differential needed.
          </text>
          <text x={160} y={152} fontSize={8} fill="#93a59a" textAnchor="middle" fontFamily="Inter, sans-serif">
            The other wheels only roll and steer.
          </text>
        </>
      ) : (
        <>
          {box(166, 90, 64, 'Crown wh. & diff')}
          {line(198, 90, 198, 66)}
          {line(198, 110, 198, 134)}
          {box(172, 46, 52, 'Final drive')}
          {box(172, 134, 52, 'Final drive')}
          {line(224, 56, 240, 56)}
          {line(224, 144, 240, 144)}
          {box(240, 46, 54, 'Rear wheel L')}
          {box(240, 134, 54, 'Rear wheel R')}
        </>
      )}
      {/* PTO from the gearbox */}
      {line(131, 110, 131, 128)}
      {box(108, 128, 46, 'PTO')}
      {four ? (
        <>
          {line(131, 90, 131, 30)}
          {box(102, 10, 58, 'Transfer box')}
          {line(160, 20, 176, 20)}
          {box(176, 10, 58, 'Front diff')}
          {line(234, 20, 244, 20)}
          {box(244, 2, 62, 'Front wheel L')}
          {box(244, 22, 62, 'Front wheel R')}
        </>
      ) : null}
    </svg>
  )
}

function LivePanel() {
  const v = useLive(() => ({ ...live }), 12, (a, b) => a.rpm === b.rpm && a.V === b.V)
  const st = useDrive()
  const s = solve(st)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Engine" value={s.stalled ? 'stalled' : fmt(v.rpm, 4)} unit={s.stalled ? undefined : 'rpm'} tone={s.stalled ? 'warn' : 'accent'} />
        <Readout label="Engine torque" value={fmt(s.Te, 3)} unit="N·m" />
        <Readout label="Engine power" value={fmt(s.Qe / 1000, 3)} unit="kW" />
        <Readout label="Wheel speed" value={fmt(s.Nw * 60, 3)} unit="rpm" tone="info" />
        <Readout label="Wheel torque" value={fmt(s.Tw / 1000, 3)} unit="kN·m" />
        <Readout label="Overall ratio q" value={fmt(s.q, 4)} unit=": 1" />
        <Readout label="Speed V₀ / V" value={`${fmt(v.V0 * 3.6, 3)} / ${fmt(v.V * 3.6, 3)}`} unit="km/h" />
        <Readout label="Drawbar power" value={fmt(s.Qd / 1000, 3)} unit="kW" tone="accent" />
        <Readout label="PTO" value={fmt(v.rpm / PTO_RATIO, 3)} unit="rpm" />
      </div>
      {s.stalled ? <Note tone="warn">The pull needs more engine torque than the curve can give in this gear (peak 173 N·m): change down or reduce the load.</Note> : null}
    </Section>
  )
}

function ReductionTable() {
  const st = useDrive()
  const s = solve(st)
  const rows = stages(s.q, s.stalled ? 0 : s.rpm, s.Te)
  return (
    <Section title="Three speed reductions">
      <Table
        head={['Stage', 'i', 'rpm after', 'torque N·m']}
        rows={[
          ['Engine', '—', fmt(s.stalled ? 0 : s.rpm, 4), fmt(s.Te, 3)],
          ...rows.map((r) => [r.name, fmt(r.ratio, 3), fmt(r.rpm, 3), fmt(r.torque, 4)]),
        ]}
      />
      <Note>
        Speed falls and torque rises at three points: the gearbox, the crown wheel & pinion and the final reduction. Overall {fmt(rows[2].overall, 4)} : 1 at
        η = 0.98⁵ = {fmt(rows[2].eta, 3)}. The split of q into stages uses the tractor's 37 : 9 crown wheel and a 15/57 epicyclic final drive (typical values).
      </Note>
    </Section>
  )
}

function SpeedPullChart() {
  const gear = useDrive((s) => s.gear)
  const pull = useDrive((s) => s.pull)
  const data = useMemo(() => {
    const curves = (['3', '5', '7'] as Gear[]).map((g) => idealGearCurve(FARMLAND_GEARS[Number(g)]))
    const xs: number[] = []
    for (let p = 1; p <= 40; p += 0.5) xs.push(p)
    const interp = (c: ReturnType<typeof idealGearCurve>, P: number) => {
      // speed for a pull on the ideal gear curve (pull rises as rpm falls)
      const pts = c.slice().sort((a, b) => a.pullkN - b.pullkN)
      if (P > pts[pts.length - 1].pullkN) return null
      for (let k = 1; k < pts.length; k++) if (P <= pts[k].pullkN) {
        const a = pts[k - 1]
        const b = pts[k]
        return a.speedKmh + ((P - a.pullkN) / (b.pullkN - a.pullkN)) * (b.speedKmh - a.speedKmh)
      }
      return null
    }
    const env = maxPower()
    return [xs, ...curves.map((c) => xs.map((P) => interp(c, P))), xs.map((P) => powerEnvelopeSpeed(P, env))]
  }, [])
  const s = solve(useDrive.getState())
  return (
    <Section title="Ideal speed–pull chart">
      <Chart
        data={data}
        series={[
          { label: 'gear 3', color: '#e8794f', width: 2 },
          { label: 'gear 5', color: '#f5b942', width: 2 },
          { label: 'gear 7', color: '#9bd17a', width: 2 },
          { label: 'max power', color: '#93a59a', dash: [4, 4] },
        ]}
        xLabel="Pull H (kN)"
        yLabel="Speed V₀ (km/h)"
        yRange={[0, 14]}
        marker={() => (s.stalled ? null : [pull + useDrive.getState().rolling, s.V0 * 3.6])}
        height={170}
      />
      <Note>
        Gear {gear}. Each gear can only work along its own curve; the dashed line is the constant-power envelope a stepless (e.g. hydrostatic) drive could follow.
      </Note>
    </Section>
  )
}

function DriveWorking() {
  const st = useDrive()
  const s = solve(st)
  const steps: WorkingStep[] = [
    {
      label: 'Wheel torque and engine torque needed',
      tex: 'H = P + R,\\quad T_w = \\dfrac{H D}{2},\\quad T_e = \\dfrac{T_w}{q\\,\\eta_r}',
      sub: `H = ${n(st.pull, 3)} + ${n(st.rolling, 3)}\\ \\text{kN},\\ T_w = \\dfrac{${n(s.H, 4)}\\times${D}}{2},\\ T_e = \\dfrac{${n(s.Tw, 4)}}{${n(s.q, 4)}\\times${n(st.etaR, 3)}}`,
      result: `T_w = ${n(s.Tw, 4)}\\ \\text{N·m},\\quad T_e = ${n(s.Te, 4)}\\ \\text{N·m}`,
      cite: SRC.mech502('eqs 2.2, 2.7, 2.12'),
    },
    {
      label: 'Engine speed from the governed torque curve',
      tex: 'T(N_e) = T_e',
      result: s.stalled ? '\\text{stalled — demand above the torque peak}' : `N_e = ${n(s.rpm, 4)}\\ \\text{rpm}`,
      cite: SRC.mech502('p4 Fig 2.2'),
    },
    {
      label: 'Travel speed, theoretical and with slip',
      tex: 'V_0 = \\dfrac{\\pi D N_e}{q},\\quad V = V_0(1-i)',
      sub: `V_0 = \\dfrac{\\pi\\times${D}\\times${n(s.Ne, 4)}}{${n(s.q, 4)}},\\ V = V_0(1-${n(st.slip, 3)})`,
      result: `V_0 = ${n(s.V0 * 3.6, 4)},\\ V = ${n(s.V * 3.6, 4)}\\ \\text{km/h}`,
      cite: SRC.mech502('eqs 2.1, 2.5–2.6'),
    },
    {
      label: 'Engine power and drawbar power',
      tex: 'Q_e = 2\\pi T_e N_e,\\quad Q_d = P\\,V',
      sub: `Q_e = 2\\pi\\times${n(s.Te, 4)}\\times${n(s.Ne, 4)},\\ Q_d = ${n(st.pull * 1000, 4)}\\times${n(s.V, 4)}`,
      result: `Q_e = ${n(s.Qe / 1000, 4)}\\ \\text{kW},\\ Q_d = ${n(s.Qd / 1000, 4)}\\ \\text{kW},\\ \\eta_t = ${n(s.etaT, 3)}`,
      cite: SRC.mech502('eqs 2.3, 2.9–2.10'),
    },
    {
      label: 'Overall ratio as three reductions',
      tex: 'q = i_{gearbox}\\times i_{crown}\\times i_{final}',
      sub: `${n(s.q, 4)} = ${n(gearboxRatio(s.q), 4)}\\times${n(CROWN_RATIO, 4)}\\times${n(FINAL_RATIO, 3)}`,
      result: `N_w = N_e/q = ${n(s.Nw * 60, 4)}\\ \\text{rpm}`,
      cite: SRC.tts510('p1, p10 — gearbox, crown wheel & pinion, final reduction'),
    },
    {
      label: 'Worked example: shaft power at 2000 rpm, 65 N·m',
      tex: 'P = \\dfrac{2\\pi N T}{60}',
      sub: '= \\dfrac{2\\pi\\times2000\\times65}{60}',
      result: `= ${n(shaftPower(2000, 65) / 1000, 3)}\\ \\text{kW}`,
      cite: EXAM2223('Q3c — formula not in the PT notes'),
    },
    {
      label: 'Worked example: drawbar pull = μW',
      tex: 'P = \\mu W,\\qquad W_{needed} = \\dfrac{P_{req}}{\\mu}',
      sub: '0.85\\times25\\ \\text{kN};\\quad 30/0.85 = 35.29\\ \\text{kN}',
      result: '= 21.25\\ \\text{kN};\\ \\text{add}\\ 35.29 - 25 = 10.29\\ \\text{kN}',
      cite: EXAM2223('Q3c'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function DrivePanel() {
  const st = useDrive()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Parameters<typeof st.set>[0]) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Power train">
        <Segmented<Drive> label="Driven wheels" value={st.drive} onChange={(drive) => st.set({ drive })} options={(['1wd', '2wd', '4wd'] as Drive[]).map((d) => ({ value: d, label: DRIVE_LABEL[d] }))} />
        <PowerTrainDiagram drive={st.drive} />
        <Note>
          {st.drive === '4wd'
            ? 'Front-wheel assist: a transfer drive sends part of the power through a propeller shaft to a front differential. More weight is used for traction.'
            : st.drive === '1wd'
              ? 'Shown on the tractor for comparison: only one wheel is driven, so no differential is needed.'
              : 'Standard 2WD tractor: engine → clutch → gearbox → crown wheel & pinion with differential → half shafts → final reductions → rear wheels. The PTO and hydraulic pump are driven from the gearbox.'}
        </Note>
      </Section>
      <Section title="Load">
        <Segmented<Gear> label="Gear" value={st.gear} onChange={(gear) => set({ gear })} options={(['3', '5', '7'] as Gear[]).map((g) => ({ value: g, label: `${g} · q ${FARMLAND_GEARS[Number(g)]}` }))} />
        <Slider label="Drawbar pull P" value={st.pull} min={0} max={40} step={0.5} unit="kN" onChange={(pull) => set({ pull })} />
        <Slider label="Rolling resistance R" value={st.rolling} min={0} max={4} step={0.1} unit="kN" onChange={(rolling) => set({ rolling })} />
        <Slider label="Wheelslip i" value={st.slip} min={0} max={0.4} step={0.01} onChange={(slip) => set({ slip })} />
        <Toggle label="Show power flow" checked={st.flow} onChange={(flow) => st.set({ flow })} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <ReductionTable />
      <SpeedPullChart />
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">
          <li>Jobs of the transmission: select speed ratios, reverse the travel, and power the PTO.</li>
          <li>Engine power becomes useful work three ways: drawbar, PTO and hydraulics — the drawbar is the least efficient, because of traction losses.</li>
          <li>Components of a complete power train: clutch, gearbox, crown wheel & pinion, differential, half shafts, final drives, wheels (+ PTO).</li>
          <li>Engine &gt; 2000 rpm, rear wheels ≈ 20 rpm in bottom gear.</li>
        </ul>
      </Section>
      <DriveWorking />
    </div>
  )
}
