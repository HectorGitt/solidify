import { useState } from 'react'
import { SRC } from '@/content/citations'
import { MEMBERS, describeRatio, planetaryRatio, planetSpeed, type Member } from '@/physics/gearing'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PowerLegend, PresetGrid, Table, type Preset } from '../common/PanelBits'
import { DEFAULTS, MEMBER_LABEL, PG, isLocked, live, overallRatio, simpleRatio, simpleTorques, stageRatio, usePlanetary, type Mode2, type PlanetaryParams } from './model'

const set = (p: Partial<PlanetaryParams>) => usePlanetary.getState().set(p)
const fresh = (p: Partial<PlanetaryParams>) => usePlanetary.setState({ ...DEFAULTS, lock: [], ...p })

const PRESETS: Preset[] = [
  {
    id: 'pt-low',
    label: 'Low speed',
    note: 'Sun = input, carrier = output, ring held by the underdrive brake. The planets walk round the ring and the carrier turns the same way as the sun, slower. Ratio 30/108 = 0.278.',
    apply: () => fresh({ input: 'sun', output: 'carrier', held: 'ring' }),
  },
  {
    id: 'pt-high',
    label: 'High speed (direct)',
    note: 'The direct-drive clutch locks two members: the whole set turns as a unit, 1 : 1.',
    apply: () => fresh({ input: 'sun', output: 'carrier', held: 'none', lock: ['sun', 'carrier'] }),
  },
  {
    id: 'pt-neutral',
    label: 'Neutral',
    note: 'Clutch and brake both released: the ring simply spins backwards and the output shaft stops turning.',
    apply: () => fresh({ input: 'sun', output: 'carrier', held: 'none' }),
  },
  {
    id: 'reverse',
    label: 'Reverse',
    note: 'Carrier held: the planets become idlers and the ring turns backwards, ω_r/ω_s = −z_s/z_r = −0.385. A planetary set can serve as a reversing gear.',
    apply: () => fresh({ input: 'sun', output: 'ring', held: 'carrier' }),
  },
  {
    id: 'culpin',
    label: 'Overdrive (carrier driven)',
    note: 'Casing C (ring) held by the stop E, driver A on the carrier, follower B on the sun → the follower is speeded up, (z_s + z_r)/z_s = 3.6. For the gear to rotate solid the casing must be locked to another member — with nothing held or locked the set is in neutral.',
    apply: () => fresh({ input: 'carrier', output: 'sun', held: 'ring' }),
  },
  {
    id: 'compound',
    label: 'Compound: low × reverse',
    note: 'Two simple sets in series: set 1 underdrive (0.278) feeding set 2 as a reverser (−0.385) gives −0.107 — a large reduction in reverse.',
    apply: () => fresh({ compound: true, mode1: 'under', mode2: 'reverse' }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.sun === b.sun && a.ring === b.ring && a.carrier === b.carrier && a.out === b.out)
  const s = usePlanetary()
  const r = overallRatio(s)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Sun" value={fmt(v.sun, 3)} unit="rpm" tone={s.input === 'sun' ? 'accent' : 'ink'} />
        <Readout label="Carrier" value={fmt(v.carrier, 3)} unit="rpm" tone={s.input === 'carrier' ? 'accent' : 'ink'} />
        <Readout label="Ring" value={fmt(v.ring, 3)} unit="rpm" tone={s.input === 'ring' ? 'accent' : 'ink'} />
        <Readout label="Planet spin" value={fmt(v.planetRel, 3)} unit="rpm on pin" />
        <Readout label="Output" value={fmt(v.out, 3)} unit="rpm" tone="info" />
        <Readout label="ω_out/ω_in" value={Number.isFinite(r) ? fmt(r, 3) : '—'} tone="warn" />
      </div>
      <p className="mt-1.5 text-[11.5px] text-mute">{s.output === 'none' && !s.compound ? 'No output member chosen.' : describeRatio(r)}</p>
    </Section>
  )
}

function MemberGrid() {
  const s = usePlanetary()
  const cell = (on: boolean, disabled: boolean) =>
    `rounded px-1.5 py-0.5 text-[11.5px] ${disabled ? 'opacity-30' : ''} ${on ? 'bg-accent text-accent-ink' : 'border border-line-2 text-ink/80 hover:border-accent/50'}`
  const toggleLock = (m: Member) => set({ lock: s.lock.includes(m) ? s.lock.filter((x) => x !== m) : [...s.lock, m] })
  return (
    <Section title="Members">
      <div className="grid grid-cols-[64px_repeat(4,1fr)] items-center gap-1 text-[11px]">
        <span />
        <span className="text-center text-dim">Input</span>
        <span className="text-center text-dim">Output</span>
        <span className="text-center text-dim">Brake</span>
        <span className="text-center text-dim">Lock</span>
        {MEMBERS.map((m) => (
          <div key={m} className="contents">
            <span className="text-[12px] text-ink/90">{MEMBER_LABEL[m]}</span>
            <button className={cell(s.input === m, false)} onClick={() => set({ input: m })}>
              in
            </button>
            <button className={cell(s.output === m, s.input === m)} disabled={s.input === m} onClick={() => set({ output: s.output === m ? 'none' : m })}>
              out
            </button>
            <button className={cell(s.held === m, s.input === m)} disabled={s.input === m} onClick={() => set({ held: s.held === m ? 'none' : m })}>
              hold
            </button>
            <button className={cell(s.lock.includes(m), false)} onClick={() => toggleLock(m)}>
              lock
            </button>
          </div>
        ))}
      </div>
      <Note>
        Lock any two members and the set turns as one. The input is never braked, and brake and lock-up clutch are not applied together — that would lock the input solid.
        {s.lock.length === 1 ? ' Pick a second member to lock.' : ''}
      </Note>
      <div className="mt-2">
        <Toggle label="Compound train (two sets in series)" checked={s.compound} onChange={(compound) => set({ compound })} />
        {s.compound ? (
          <>
            <Segmented<'direct' | 'under'>
              label="Set 1 (sun in, carrier out)"
              size="sm"
              value={s.mode1}
              onChange={(mode1) => set({ mode1 })}
              options={[
                { value: 'direct', label: 'Direct (locked)' },
                { value: 'under', label: 'Underdrive (ring held)' },
              ]}
            />
            <Segmented<Mode2>
              label="Set 2 (sun driven by set 1 carrier)"
              size="sm"
              value={s.mode2}
              onChange={(mode2) => set({ mode2 })}
              options={[
                { value: 'direct', label: 'Direct' },
                { value: 'under', label: 'Underdrive' },
                { value: 'reverse', label: 'Reverse' },
              ]}
            />
          </>
        ) : null}
      </div>
      <Slider label="Input speed" value={s.rpm} min={0} max={600} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
      <Slider label="Input torque" value={s.torque} min={10} max={500} step={10} unit="N·m" onChange={(torque) => set({ torque })} />
      <Toggle label="Colour the power path" checked={s.powerFlow} onChange={(powerFlow) => set({ powerFlow })} />
      {s.powerFlow ? (
        <>
          <PowerLegend />
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-mute">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: '#a3271f' }} />
            held (reaction) member is drawn red
          </div>
        </>
      ) : null}
    </Section>
  )
}

function RatioTable() {
  const s = usePlanetary()
  const rows: { label: string; r: number; current: boolean }[] = []
  for (const held of MEMBERS) {
    for (const input of MEMBERS) {
      if (input === held) continue
      const output = MEMBERS.find((m) => m !== held && m !== input)!
      rows.push({
        label: `${MEMBER_LABEL[input]} → ${MEMBER_LABEL[output]}, ${MEMBER_LABEL[held].toLowerCase()} held`,
        r: planetaryRatio(PG.zs, PG.zr, input, output, 'held'),
        current: !s.compound && !isLocked(s) && s.held === held && s.input === input && s.output === output,
      })
    }
  }
  rows.push({ label: 'Any two locked', r: 1, current: !s.compound && isLocked(s) && s.output !== 'none' })
  rows.push({ label: 'Nothing held or locked', r: NaN, current: !s.compound && !isLocked(s) && s.held === 'none' })
  const hi = rows.findIndex((r) => r.current)
  return (
    <Section title="All the ratios of one set">
      <Table
        head={['Drive', 'ω_out/ω_in', 'Kind']}
        rows={rows.map((r) => [r.label, Number.isFinite(r.r) ? fmt(r.r, 3) : '—', describeRatio(r.r)])}
        highlight={hi >= 0 ? hi : undefined}
      />
      <Note>z_s = {PG.zs}, z_p = {PG.zp}, z_r = {PG.zr}. Six ways to drive a set: two reductions, two overdrives and two reverses, plus direct drive and neutral.</Note>
    </Section>
  )
}

function PlanetWorking() {
  const s = usePlanetary()
  const steps: WorkingStep[] = []
  const { zs, zp, zr } = PG
  steps.push({
    label: 'Ring teeth for sun and planets of one module',
    tex: 'z_r = z_s + 2z_p',
    sub: `= ${zs} + 2(${zp})`,
    result: `= ${zr},\\quad \\tfrac{z_s+z_r}{n} = \\tfrac{${zs + zr}}{${PG.n}} = ${(zs + zr) / PG.n}\\ \\text{(whole: planets fit)}`,
    beyond: true,
    cite: SRC.beyond('planetary assembly condition'),
  })
  steps.push({
    label: 'Willis equation (speeds relative to the carrier)',
    tex: '\\dfrac{\\omega_s-\\omega_c}{\\omega_r-\\omega_c} = -\\dfrac{z_r}{z_s}\\;\\Leftrightarrow\\; z_s\\omega_s + z_r\\omega_r = (z_s+z_r)\\,\\omega_c',
    beyond: true,
    cite: SRC.beyond('Willis equation — TOP p4: epicyclic ratios "not discussed here"'),
  })
  if (s.compound) {
    const r1 = stageRatio(s.mode1)
    const r2 = stageRatio(s.mode2)
    steps.push({
      label: 'Compound train: ratios multiply',
      tex: '\\dfrac{\\omega_{out}}{\\omega_{in}} = i_1\\,i_2',
      sub: `= (${n(r1, 4)})(${n(r2, 4)})`,
      result: `= ${n(r1 * r2, 4)}`,
      cite: SRC.pt510('p6 — compound planetary'),
    })
  } else if (isLocked(s)) {
    steps.push({
      label: 'Two members locked together',
      tex: '\\omega_s = \\omega_c = \\omega_r \\Rightarrow \\dfrac{\\omega_{out}}{\\omega_{in}} = 1',
      result: `= 1\\quad(\\text{direct drive})`,
      cite: SRC.pt510('p6'),
    })
  } else if (s.held !== 'none' && s.output !== 'none' && s.output !== s.held) {
    const r = simpleRatio(s)
    const w: Record<Member, string> = { sun: '\\omega_s', carrier: '\\omega_c', ring: '\\omega_r' }
    steps.push({
      label: `${MEMBER_LABEL[s.held]} held: put ${w[s.held]} = 0`,
      tex: `${z(s.input)}\\,${w[s.input]} \\ \\text{and}\\ ${z(s.output)}\\,${w[s.output]}\\ \\text{in}\\ z_s\\omega_s + z_r\\omega_r = (z_s+z_r)\\omega_c`,
      sub: `\\dfrac{${w[s.output]}}{${w[s.input]}} = ${ratioTex(s.input, s.output, s.held)}`,
      result: `= ${n(r, 4)}\\quad(${describeRatio(r).replace(/,/g, '{,}')})`,
      beyond: true,
      cite: SRC.pt510('p6 — ring held: carrier same direction, slower'),
    })
    const t = simpleTorques(s)
    steps.push({
      label: 'Torques (loss-free): T_s : T_r : T_c = z_s : z_r : −(z_s + z_r)',
      tex: '|T_{out}| = T_{in}\\dfrac{z_{out}}{z_{in}},\\quad |T_{held}| = T_{in}\\dfrac{z_{held}}{z_{in}}',
      sub: `T_{in} = ${s.torque}\\ \\text{N·m}`,
      result: `|T_{out}| = ${n(t.out, 4)}\\ \\text{N·m},\\quad |T_{brake}| = ${n(t.held, 4)}\\ \\text{N·m}`,
      beyond: true,
      cite: SRC.beyond('torque balance of a planetary set'),
    })
  } else {
    steps.push({ label: 'Neutral', tex: '\\text{no member held or locked} \\Rightarrow \\text{no drive}', cite: SRC.pt510('p6 — neutral') })
  }
  const ws = live.sun
  const wc = live.carrier
  steps.push({
    label: 'Planet speed on its pin (relative to the carrier)',
    tex: '\\omega_p - \\omega_c = -\\dfrac{z_s}{z_p}(\\omega_s - \\omega_c)',
    sub: `= -\\dfrac{${zs}}{${zp}}(${n(ws, 4)} - ${n(wc, 4)})`,
    result: `= ${n(planetSpeed(ws, wc, zs, zp) - wc, 4)}\\ \\text{rpm}`,
    beyond: true,
    cite: SRC.beyond('planet spin'),
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

const z = (m: Member) => (m === 'sun' ? 'z_s' : m === 'ring' ? 'z_r' : '(z_s+z_r)')
function ratioTex(input: Member, output: Member, held: Member) {
  void held
  const zz = (m: Member) => (m === 'sun' ? PG.zs : m === 'ring' ? PG.zr : PG.zs + PG.zr)
  // carrier held: ω_r/ω_s = −z_s/z_r ; otherwise ω_out/ω_in = z_in/z_out with the carrier as (z_s+z_r)
  if (input !== 'carrier' && output !== 'carrier') return `-\\dfrac{${zz(input)}}{${zz(output)}}`
  return `\\dfrac{${zz(input)}}{${zz(output)}}`
}

export function PlanetaryPanel() {
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <MemberGrid />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
        <Note>
          Exam (2022/23 Q3, Q4): the basic parts are the sun gear (centre), the planet pinions and their carrier (rotate round the sun) and the ring gear (surrounds the others). It works by
          holding or locking members with hydraulic clutches and brakes.
        </Note>
      </Section>
      <RatioTable />
      <PlanetWorking />
    </div>
  )
}
