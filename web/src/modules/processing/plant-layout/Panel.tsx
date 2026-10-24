import { useState } from 'react'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import {
  AGE504_LAYOUT_RULES,
  AGE504_PLANNING_STEPS,
  ASME_SYMBOLS,
  C,
  assessLayout,
  usePlantLayout,
  type AsmeSymbol,
  type LayoutPattern,
  type ProcessingLine,
} from './model'

export interface LayoutPreset {
  id: string
  label: string
  note: string
  pattern: LayoutPattern
  line: ProcessingLine
  batchMass: number
  aisleWidth: number
}

const PRESETS: LayoutPreset[] = [
  {
    id: 'optimal-u',
    label: 'Optimal U-Shape Garri Plant',
    note: 'Finished product returns to the intake dock; shared loading yard, zero flow crossings, lowest handling effort (100 %). Recommended in AGE 504.',
    pattern: 'u-shape',
    line: 'garri',
    batchMass: 5.0,
    aisleWidth: 3.0,
  },
  {
    id: 'straight-feed',
    label: 'Linear Feed Mill (Product Layout)',
    note: 'Straight one-way progression from grain intake at west to feed packing at east. Clear flow, zero crossings, but requires loading docks at opposite ends.',
    pattern: 'straight',
    line: 'feed-mill',
    batchMass: 8.0,
    aisleWidth: 3.2,
  },
  {
    id: 'serpentine-garri',
    label: 'Serpentine Compact Garri Line',
    note: 'S-curve zig-zag folding fits an 8-station process inside a compact square building envelope with parallel rows and zero crossings.',
    pattern: 'serpentine',
    line: 'garri',
    batchMass: 5.0,
    aisleWidth: 2.8,
  },
  {
    id: 'odd-angle-bad',
    label: 'Disjointed / Bottleneck Layout',
    note: 'Haphazard machine placement creates 2 flow crossings, backtracking, excessive handling effort (>200 %), and dangerous aisle congestion.',
    pattern: 'odd-angle',
    line: 'garri',
    batchMass: 5.0,
    aisleWidth: 3.0,
  },
  {
    id: 'circular-line',
    label: 'Circular Cell Feed Layout',
    note: 'Arranged in an elliptical loop around a central service and quality control hub. Zero flow crossings with radial maintenance access.',
    pattern: 'circular',
    line: 'feed-mill',
    batchMass: 6.0,
    aisleWidth: 3.0,
  },
]

export function Panel() {
  const params = usePlantLayout()
  const a = assessLayout(params)
  const [activePreset, setActivePreset] = useState<string>('optimal-u')

  const applyPreset = (pr: LayoutPreset) => {
    params.set({
      pattern: pr.pattern,
      line: pr.line,
      batchMass: pr.batchMass,
      aisleWidth: pr.aisleWidth,
    })
    setActivePreset(pr.id)
  }

  // Working mathematical derivation steps
  const workingRaw = [
    {
      title: 'Total Material Handling Distance',
      math: `L = \\sum_{i=1}^{n-1} \\sqrt{(x_{i+1} - x_i)^2 + (z_{i+1} - z_i)^2} = ${n(a.totalLength, 1)}\\text{ m}`,
      notes: [
        'Calculated by summing Euclidean polyline lengths between successive processing stations.',
        `Station count $n = ${a.stations.length}$, total inter-station transport legs $= ${a.stations.length - 1}$.`,
      ],
      cite: C.hand('Note 4 route length'),
    },
    {
      title: 'Total Handling Effort per Batch (AGE 504 Note 4)',
      math: `E = \\sum_{j=1}^{m} M_j \\cdot d_j = ${n(a.totalEffort, 1)}\\text{ t}\\cdot\\text{m/batch}`,
      notes: [
        `Computed for batch input mass $M_0 = ${params.batchMass}\\text{ t}$, tracking actual mass fractions after peeling, dewatering, and frying/drying.`,
        `Baseline optimal U-shape effort $= ${n(a.baseEffort, 1)}\\text{ t}\\cdot\\text{m}$.`,
      ],
      cite: C.hand('Note 4 handling effort equation'),
    },
    {
      title: 'Relative Handling Efficiency Index',
      math: `\\eta = \\frac{E}{E_{\\text{optimal}}} \\times 100\\% = \\frac{${n(a.totalEffort, 1)}}{${n(a.baseEffort, 1)}} \\times 100\\% = ${n(a.relativeHandlingEffort, 1)}\\%`,
      notes: [
        a.relativeHandlingEffort <= 115
          ? 'Near-optimal material handling path: minimum transport waste and energy expenditure.'
          : 'High handling penalty: excessive travel distance and redundant material moves.',
      ],
      cite: C.hand('Note 4 good layout rules'),
    },
    {
      title: 'Flow Crossing Non-Interference Check',
      math: `N_{\\text{crossings}} = ${a.crossings} \\quad (${a.crossings === 0 ? '\\text{PASSED}' : '\\text{VIOLATION: PATH INTERSECTION DETECTED}'})`,
      notes: [
        'Rule 2 of AGE 504 Good-Layout Rules: "Continuous flow that does not cross itself".',
        a.crossings === 0
          ? 'Zero intersections: no cross-traffic congestion or collision hazard.'
          : `${a.crossings} path crossings: severe collision risk for conveyors and mobile handling traffic!`,
      ],
      cite: C.hand('Note 4 rule 2'),
    },
    {
      title: 'Aisle Clearance Verification',
      math: `w_{\\text{min}} = ${n(a.minClearance, 2)}\\text{ m} \\quad (\\text{Required } w_{\\text{req}} = ${params.aisleWidth}\\text{ m})`,
      notes: [
        `Rule 4: "Keep aisles clear" (≥ 2.5 m for powered forklifts, ≥ 1.5 m for hand push trucks).`,
        a.aisleOk ? 'Adequate clearance maintained along all machinery service lanes.' : 'Aisle width below safety threshold: risk of equipment pinch points and blocked emergency egress.',
      ],
      cite: C.hand('Note 4 rule 4'),
    },
  ]

  const toggleChecklist = (id: number) => {
    params.set({
      checklist: {
        ...params.checklist,
        [id]: !params.checklist[id],
      },
    })
  }

  return (
    <div>
      {/* 1. Live Layout Performance Readouts */}
      <Section title="Live Layout Metrics">
        <div className="grid grid-cols-2 gap-2">
          <Readout label="Layout Pattern" value={params.pattern.toUpperCase()} tone="accent" />
          <Readout
            label="Flow Crossings"
            value={a.crossings === 0 ? '0 (Clean Flow)' : `${a.crossings} (Interference!)`}
            tone={a.crossings === 0 ? 'accent' : 'warn'}
          />
          <Readout label="Total Route Distance" value={fmt(a.totalLength, 1)} unit="m" />
          <Readout label="Handling Effort" value={fmt(a.totalEffort, 1)} unit="t·m/batch" tone={a.relativeHandlingEffort > 120 ? 'warn' : 'accent'} />
          <Readout
            label="Handling Index"
            value={`${fmt(a.relativeHandlingEffort, 1)}%`}
            tone={a.relativeHandlingEffort <= 110 ? 'accent' : a.relativeHandlingEffort < 140 ? 'ink' : 'warn'}
          />
          <Readout label="Min Aisle Clearance" value={fmt(a.minClearance, 2)} unit="m" tone={a.aisleOk ? 'accent' : 'warn'} />
        </div>

        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-line bg-panel-2 px-3 py-1.5 text-[11.5px]">
          <span className="text-mute">AGE 504 Rules Compliance</span>
          <Badge tone={a.rulesPassed >= 5 ? 'accent' : a.rulesPassed >= 3 ? 'warn' : 'danger'}>{`${a.rulesPassed} / 6 Criteria Met`}</Badge>
        </div>
      </Section>

      {/* 2. Layout Controls */}
      <Section title="Layout Configuration">
        <Segmented<LayoutPattern>
          label="Layout Pattern"
          value={params.pattern}
          onChange={(pattern) => {
            params.set({ pattern })
            setActivePreset('')
          }}
          options={[
            { value: 'u-shape', label: 'U-Shape' },
            { value: 'straight', label: 'Straight' },
            { value: 'serpentine', label: 'Serpentine' },
            { value: 'circular', label: 'Circular' },
            { value: 'odd-angle', label: 'Odd-Angle' },
          ]}
        />

        <Segmented<ProcessingLine>
          label="Processing Line"
          value={params.line}
          onChange={(line) => {
            params.set({ line })
            setActivePreset('')
          }}
          options={[
            { value: 'garri', label: 'Garri Processing Line' },
            { value: 'feed-mill', label: 'Animal Feed Mill' },
          ]}
        />

        <Slider
          label="Batch Input Mass"
          value={params.batchMass}
          min={1.0}
          max={20.0}
          step={0.5}
          unit="tonnes"
          digits={2}
          onChange={(batchMass) => params.set({ batchMass })}
          hint="Input mass of fresh cassava roots or raw grain per production batch."
        />

        <Slider
          label="Required Aisle Width"
          value={params.aisleWidth}
          min={1.8}
          max={4.5}
          step={0.1}
          unit="m"
          digits={2}
          onChange={(aisleWidth) => params.set({ aisleWidth })}
          hint="Clear transport aisle required for forklifts (≥ 2.5 m) and manual hand trolleys (≥ 1.5 m)."
        />

        <div className="mt-3 border-t border-line/60 pt-2 space-y-1">
          <Toggle label="Material Flow Animation" checked={params.showFlow} onChange={(showFlow) => params.set({ showFlow })} />
          <Toggle label="ASME 3D Process Symbols" checked={params.showAsme} onChange={(showAsme) => params.set({ showAsme })} />
          <Toggle label="Aisle & Safety Demarcation" checked={params.showAisles} onChange={(showAisles) => params.set({ showAisles })} />
          <Toggle label="Environmental Hazard Badges" checked={params.showHazards} onChange={(showHazards) => params.set({ showHazards })} />
          <Toggle label="Forklift Handling Transit" checked={params.showHandling} onChange={(showHandling) => params.set({ showHandling })} />
        </div>
      </Section>

      {/* 3. Industry Presets */}
      <Section title="Factory Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((pr) => (
            <button
              key={pr.id}
              onClick={() => applyPreset(pr)}
              className={`rounded-md border px-2 py-1.5 text-left text-[11.5px] leading-tight transition-colors ${
                activePreset === pr.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'
              }`}
            >
              <div className="font-medium">{pr.label}</div>
            </button>
          ))}
        </div>
        {activePreset ? (
          <p className="mt-2 text-[11.5px] leading-snug text-mute">
            {PRESETS.find((p) => p.id === activePreset)?.note}
          </p>
        ) : null}
      </Section>

      {/* 4. ASME Process Chart Analysis */}
      <Section title="ASME Process Chart Summary">
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {(['operation', 'transport', 'inspection', 'storage', 'delay'] as AsmeSymbol[]).map((sym) => {
            const def = ASME_SYMBOLS[sym]
            return (
              <span
                key={sym}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-panel-2 px-2 py-0.5 text-[11px]"
                title={def.desc}
              >
                <span className="font-bold" style={{ color: def.color }}>
                  {def.glyph}
                </span>
                <span className="text-dim">{def.name}:</span>
                <span className="font-mono font-semibold text-ink">{a.asmeCounts[sym]}</span>
              </span>
            )
          })}
        </div>

        <div className="max-h-60 overflow-y-auto rounded border border-line bg-panel-2/60">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="border-b border-line bg-panel-3/40 text-left text-dim">
                <th className="px-2 py-1">#</th>
                <th className="px-2 py-1">Stage</th>
                <th className="px-2 py-1">ASME</th>
                <th className="px-2 py-1">Mass</th>
                <th className="px-2 py-1">Mode</th>
              </tr>
            </thead>
            <tbody>
              {a.stations.map((s, i) => (
                <tr key={s.id} className="border-b border-line/40 hover:bg-white/[0.02]">
                  <td className="px-2 py-1 text-dim">{i + 1}</td>
                  <td className="px-2 py-1 font-sans text-ink">{s.short}</td>
                  <td className="px-2 py-1">
                    <span className="font-bold mr-1" style={{ color: ASME_SYMBOLS[s.asme].color }}>
                      {ASME_SYMBOLS[s.asme].glyph}
                    </span>
                    <span className="text-dim text-[10px]">{s.asme}</span>
                  </td>
                  <td className="px-2 py-1 text-accent">{fmt(params.batchMass * s.massFraction, 2)} t</td>
                  <td className="px-2 py-1 text-mute text-[10px] uppercase">{s.conveyorToNext}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 5. AGE 504 8 Planning Steps Checklist */}
      <Section title="Factory Planning Checklist (AGE 504)">
        <p className="mb-2 text-[11.5px] text-mute">
          Follow the 8 sequential steps defined in AGE 504 Note 4 to establish a complete processing plant:
        </p>
        <div className="space-y-1.5">
          {AGE504_PLANNING_STEPS.map((st) => {
            const checked = Boolean(params.checklist[st.id])
            return (
              <label
                key={st.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg border border-line-2 bg-panel-2/50 p-2 text-[11.5px] hover:bg-panel-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleChecklist(st.id)}
                  className="mt-0.5 rounded border-line"
                />
                <div>
                  <div className={`font-medium ${checked ? 'text-accent line-through opacity-80' : 'text-ink'}`}>
                    Step {st.id}: {st.step}
                  </div>
                  <div className="text-[10.5px] text-mute leading-tight">{st.desc}</div>
                </div>
              </label>
            )
          })}
        </div>
      </Section>

      {/* 6. Mathematical Derivations */}
      <Section title="Engineering Calculations">
        <Working steps={workingRaw.map((s): WorkingStep => ({ label: s.title, tex: s.math, cite: s.cite }))} />
      </Section>

      {/* 7. Exam Drills & Good Layout Rules (Academic Mode) */}
      <Section title="Exam: Layout Rules & Past Questions">
        <div className="space-y-2 text-[11.5px]">
          <div className="rounded-lg border border-line bg-panel-2 p-2.5">
            <div className="font-semibold text-accent mb-1">AGE 504 Good-Layout Rules (HAND Note 4)</div>
            <ul className="list-disc pl-4 space-y-1 text-ink/80 text-[11px]">
              {AGE504_LAYOUT_RULES.map((r) => (
                <li key={r.id}>
                  <strong>{r.title}:</strong> {r.desc}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-line bg-panel-2 p-2.5">
            <div className="font-semibold text-ink mb-1">Past Question Drill (PQ 504)</div>
            <p className="text-dim text-[11px] mb-1.5">
              <strong>Question:</strong> "In the animal feed mill process flow diagram, why is the hammer mill equipped with a cyclone pneumatic separator, and where should raw grain intake be situated relative to the boiler and generator?"
            </p>
            <p className="text-accent text-[11px] leading-snug">
              <strong>Marking Guide Answer:</strong> The hammer mill causes severe dust and high noise; the cyclone pneumatic system collects fine ground meal and vents clean air (Step 2: flow chart hazards). Grain intake is positioned near the front approach road (Rule 5 & Step 7) separated from the generator bay (Rule 6: downwind sound isolation) and boiler house (heat/steam isolation).
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}
