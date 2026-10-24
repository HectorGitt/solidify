import { useMemo, useState } from 'react'
import { ERRATA } from '@/content/errata'
import { SUCTION_CM, suctionStatus, ploughDraft } from '@/physics/tillage'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type PresetDef } from '../_tillage/ui'
import { C, DEFAULTS, draftOf, live, useMb, type Board, type Pattern } from './model'

const HP = ERRATA.find((e) => e.id === 'plough-hp')!
const TWO = ERRATA.find((e) => e.id === 'two-bottom')!

const PRESETS: PresetDef[] = [
  {
    id: 'notes',
    label: 'Worked example: 150 × 60 mm',
    note: `One 150 mm × 60 mm furrow in clay (2 N/cm²) at 1 m/s: 90 cm² → 180 N → 180 W ≈ 0.245 hp. The notes print 2.4 hp — ${HP.correct}`,
    apply: () => useMb.getState().set({ bottoms: 1, width: 0.15, depth: 0.06, unitDraft: 2, speed: 3.6 }),
  },
  {
    id: 'exam1819',
    label: '2018/19: two bottoms',
    note: `Two-bottom plough, 150 mm wide, 70 mm deep, 2.8 km/h, 2 N/cm². ${TWO.correct} The marking guide uses one bottom only (105 cm², 210 N).`,
    apply: () => useMb.getState().set({ bottoms: 2, width: 0.15, depth: 0.07, unitDraft: 2, speed: 2.8 }),
  },
  {
    id: 'sand',
    label: 'Sand: 3 × 300 mm',
    note: 'Three 300 mm bottoms 200 mm deep in sand (≈ 1 N/cm²) at 6 km/h: 1800 cm² → 1.8 kN → 3.0 kW.',
    apply: () => useMb.getState().set({ bottoms: 3, width: 0.3, depth: 0.2, unitDraft: 1, speed: 6 }),
  },
  {
    id: 'clay',
    label: 'Clay: 3 × 300 mm',
    note: 'The same plough in clay (≈ 2 N/cm²) at 5 km/h: 3.6 kN → 5.0 kW. Draft doubles with the unit draft.',
    apply: () => useMb.getState().set({ bottoms: 3, width: 0.3, depth: 0.2, unitDraft: 2, speed: 5 }),
  },
]

function LivePanel() {
  const st = useMb()
  const v = useLive(() => ({ lowered: live.lowered, area: live.area, passes: live.passes }), 8, (a, b) => a.lowered === b.lowered && a.area === b.area)
  const r = draftOf(st)
  return (
    <Section title="Live" right={<Badge tone={v.lowered > 0.9 ? 'accent' : 'warn'}>{v.lowered > 0.9 ? 'ploughing' : v.lowered > 0.05 ? 'entering / lifting' : 'raised'}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Furrow area" value={fmt(r.A, 4)} unit="cm²" />
        <Readout label="Draft D" value={fmt(r.D, 4)} unit="N" tone="accent" />
        <Readout label="Power D·v" value={fmt(r.P / 1000, 3)} unit="kW" tone="accent" />
        <Readout label="Power" value={fmt(r.hp, 3)} unit="hp" />
        <Readout label="Capacity C" value={fmt(r.C, 3)} unit="ha/h" tone="info" />
        <Readout label="Ploughed (pass)" value={fmt(v.area, 3)} unit="m²" />
      </div>
    </Section>
  )
}

function Controls() {
  const st = useMb()
  const vs = suctionStatus(st.vSuction)
  const hs = suctionStatus(st.hSuction)
  return (
    <Section title="Plough">
      <Segmented
        value={st.mode}
        onChange={(mode) => st.set({ mode })}
        options={[
          { value: 'field', label: 'Tractor in the field' },
          { value: 'bottom', label: 'One bottom close up' },
        ]}
        size="sm"
      />
      <Segmented value={String(st.bottoms)} onChange={(b) => st.set({ bottoms: Number(b) })} label="Bottoms" options={['1', '2', '3'].map((v) => ({ value: v, label: v }))} size="sm" />
      <Slider label="Width of cut per bottom w" value={st.width * 1000} min={150} max={400} step={5} unit="mm" onChange={(w) => st.set({ width: w / 1000 })} />
      <Slider label="Depth d" value={st.depth * 1000} min={50} max={300} step={5} unit="mm" onChange={(d) => st.set({ depth: d / 1000 })} />
      <Segmented<Board>
        value={st.board}
        onChange={(board) => st.set({ board })}
        label="Mouldboard"
        options={[
          { value: 'general', label: 'General purpose' },
          { value: 'stubble', label: 'Stubble' },
          { value: 'slatted', label: 'Slatted' },
        ]}
        size="sm"
      />
      <Slider label="Unit draft (sand ≈ 1, clay ≈ 2)" value={st.unitDraft} min={0.5} max={3} step={0.1} unit="N/cm²" onChange={(unitDraft) => st.set({ unitDraft })} />
      <Slider label="Speed" value={st.speed} min={1} max={10} step={0.1} unit="km/h" onChange={(speed) => st.set({ speed })} />
      <Slider label="Field efficiency" value={st.FE * 100} min={50} max={100} step={1} unit="%" onChange={(v) => st.set({ FE: v / 100 })} />
      <Slider label="Vertical suction" value={st.vSuction} min={0.2} max={2} step={0.02} unit="cm" onChange={(vSuction) => st.set({ vSuction })} />
      <Slider label="Horizontal suction" value={st.hSuction} min={0.2} max={2} step={0.02} unit="cm" onChange={(hSuction) => st.set({ hSuction })} />
      {vs !== 'ok' || hs !== 'ok' ? (
        <Note tone="warn">
          Suction outside {SUCTION_CM.min}–{SUCTION_CM.max} cm: {vs === 'low' || hs === 'low' ? 'too little — the bottom will not stay in the ground' : 'too much — the bottom runs heavy and dives'}.
        </Note>
      ) : null}
      <Toggle label="Draw suction 6× larger" checked={st.exaggerate} onChange={(exaggerate) => st.set({ exaggerate })} />
      <Toggle label="Show centre of draft / power, line of draft" checked={st.showDraft} onChange={(showDraft) => st.set({ showDraft })} />
    </Section>
  )
}

function DraftChart() {
  const st = useMb()
  const data = useMemo(() => {
    const xs: number[] = []
    const sand: number[] = []
    const clay: number[] = []
    const cur: number[] = []
    for (let d = 50; d <= 300; d += 10) {
      xs.push(d)
      sand.push(ploughDraft(1, st.width, d / 1000, st.bottoms) / 1000)
      clay.push(ploughDraft(2, st.width, d / 1000, st.bottoms) / 1000)
      cur.push(ploughDraft(st.unitDraft, st.width, d / 1000, st.bottoms) / 1000)
    }
    return [xs, sand, clay, cur]
  }, [st.width, st.bottoms, st.unitDraft])
  return (
    <Section title="Draft vs depth">
      <Chart
        data={data}
        series={[
          { label: 'sand 1 N/cm²', color: '#e8d06a' },
          { label: 'clay 2 N/cm²', color: '#c77b4a' },
          { label: 'this soil', color: '#9bd17a', dash: [4, 3] },
        ]}
        xLabel="depth d (mm)"
        yLabel="draft (kN)"
        marker={() => [useMb.getState().depth * 1000, draftOf(useMb.getState()).D / 1000]}
      />
    </Section>
  )
}

function PloughWorking() {
  const st = useMb()
  const r = draftOf(st)
  const steps: WorkingStep[] = [
    { label: 'Furrow cross-section', tex: 'A = n\\,w\\,d', sub: `A = ${st.bottoms} \\times ${n(st.width * 100)}\\,\\text{cm} \\times ${n(st.depth * 100)}\\,\\text{cm}`, result: `= ${n(r.A)}\\,\\text{cm}^2`, cite: C.am('§12 plough draft'), errata: TWO.says + ' ' + TWO.correct },
    { label: 'Draft', tex: 'D = (\\text{unit draft})\\times A', sub: `D = ${n(st.unitDraft)} \\times ${n(r.A)}`, result: `= ${n(r.D)}\\,\\text{N}`, cite: C.am('§12 unit draft: sand ≈ 1, clay ≈ 2 N/cm²') },
    { label: 'Speed', tex: 'v = S/3.6', sub: `v = ${n(st.speed)}/3.6`, result: `= ${n(r.v)}\\,\\text{m/s}` },
    { label: 'Drawbar power', tex: 'P = D\\,v', sub: `P = ${n(r.D)} \\times ${n(r.v)}`, result: `= ${n(r.P)}\\,\\text{W} = ${n(r.hp)}\\,\\text{hp (metric, 735.5 W)}`, cite: C.am('§12 power = draft × speed'), errata: HP.says + ' ' + HP.correct },
    { label: 'Field capacity', tex: 'C = \\dfrac{W\\,S\\,FE}{10}', sub: `C = \\dfrac{${n(r.W)} \\times ${n(st.speed)} \\times ${n(st.FE)}}{10}`, result: `= ${n(r.C)}\\,\\text{ha/h}`, cite: C.mgmt('p8 field capacity') },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

/** Top-down sketch of the three ploughing patterns (schematic, 8 passes). */
function Patterns() {
  const st = useMb()
  const W = 240
  const H = 150
  const m = 14
  const lines: { pts: [number, number][]; c: string }[] = []
  const N = 8
  const pw = (W - 2 * m) / N
  if (st.pattern === 'lands') {
    // two lands, each ploughed by gathering about its centre (back furrow), dead furrow between them
    for (const land of [0, 1]) {
      const cx = m + (land + 0.5) * ((W - 2 * m) / 2)
      for (let k = 0; k < N / 2; k++) {
        const off = (k + 0.5) * (pw / 2)
        lines.push({ pts: [[cx - off, H - m], [cx - off, m], [cx + off, m], [cx + off, H - m]], c: `hsl(${120 - k * 20} 60% 55%)` })
      }
    }
  } else if (st.pattern === 'round') {
    for (let k = 0; k < 5; k++) {
      const o = m + k * 11
      lines.push({ pts: [[o, H - o], [o, o], [W - o, o], [W - o, H - o], [o + 11, H - o]], c: `hsl(${120 - k * 22} 60% 55%)` })
    }
  } else {
    for (let k = 0; k < N; k++) {
      const x = m + (k + 0.5) * pw
      lines.push({ pts: k % 2 ? [[x, m], [x, H - m]] : [[x, H - m], [x, m]], c: `hsl(${120 - k * 12} 60% 55%)` })
    }
  }
  return (
    <Section title="Ploughing patterns (plan)">
      <Segmented<Pattern>
        value={st.pattern}
        onChange={(pattern) => st.set({ pattern })}
        options={[
          { value: 'lands', label: 'In lands' },
          { value: 'round', label: 'Round & round' },
          { value: 'oneway', label: 'One-way' },
        ]}
        size="sm"
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border border-line bg-panel-2">
        <rect x={m - 6} y={m - 6} width={W - 2 * m + 12} height={H - 2 * m + 12} fill="none" stroke="#93a59a" strokeDasharray="3 3" />
        {lines.map((l, i) => (
          <polyline key={i} points={l.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={l.c} strokeWidth={2.2} markerEnd="url(#arr)" />
        ))}
        {st.pattern === 'lands' ? <line x1={W / 2} y1={m - 6} x2={W / 2} y2={H - m + 6} stroke="#c77b4a" strokeWidth={1.5} strokeDasharray="5 3" /> : null}
        <defs>
          <marker id="arr" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#e6efe9" />
          </marker>
        </defs>
      </svg>
      <Note>
        {st.pattern === 'lands'
          ? 'Mark out a headland, then plough the field in strips (lands). Each land is begun at its centre and gathered round it (turning right, slices thrown inward), leaving a back furrow ridge in the middle and a dead furrow (dashed) between lands. Headlands are ploughed last.'
          : st.pattern === 'round'
            ? 'Round-and-round: start at the boundary and work inward (or outward) round the field. No dead furrows in the middle, but the corners need extra turns and are often left for the end.'
            : 'One-way with a reversible (two-way) plough: left- and right-hand bottoms are mounted one above the other and turned over at each headland by a trip lever or hydraulics, so every slice is thrown the same way. Adjacent passes, no back or dead furrows.'}
      </Note>
    </Section>
  )
}

export function Panel() {
  const [active, setActive] = useState<string | null>(null)
  return (
    <>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={active} onPick={setActive} />
        <button className="mt-2 text-[11.5px] text-mute underline" onClick={() => (useMb.getState().set({ ...DEFAULTS }), setActive(null))}>
          reset
        </button>
      </Section>
      <DraftChart />
      <PloughWorking />
      <Section title="Centre of draft and line of draft">
        <Note>
          The centre of draft (resistance) of a bottom is about 5 cm in from the landside at the top of the share; the centre of power of the tractor is midway along the drawbar. The line of draft
          joins them and should be straight and parallel to the direction of travel; an offset centre of draft pulls the tractor sideways (side draft), which the landsides resist.
        </Note>
      </Section>
      <Patterns />
    </>
  )
}
