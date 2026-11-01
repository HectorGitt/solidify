import { TestBench } from '@/lab/run'
import { oldhamMaxSliding } from '@/physics/linkages'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n as num } from '@/ui/Working'
import { Note } from '../../elements/_shared/PanelBits'
import { ExamList } from '../_shared/rig'
import { OLDHAM_PROC, deg, live, oldhamRun, useOldham } from './model'

const set = (p: Parameters<ReturnType<typeof useOldham.getState>['set']>[0]) => useOldham.getState().set(p)

/** The bench test: turn the input by hand, reading the output and where the disc's centre has got to. */
function OldhamTest() {
  const rows = oldhamRun((s) => s.rows)
  const status = oldhamRun((s) => s.status)
  const ratio = rows.reduce((a, r) => a + r[1], 0) / Math.max(1e-9, rows.reduce((a, r) => a + r[0], 0))
  const offset = rows.reduce((a, r) => a + Math.hypot(r[2], r[3]), 0) / Math.max(1, rows.length)
  return (
    <TestBench run={oldhamRun} steps={OLDHAM_PROC.steps} title="The test: turn it through a revolution" head={['In (°)', 'Out (°)', 'To shaft A (mm)', 'To shaft B (mm)']} format={(r) => [fmt(r[0], 3), fmt(r[1], 3), fmt(r[2], 3), fmt(r[3], 3)]}>
      {status === 'done' ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Readout label="Speed ratio found" value={fmt(ratio, 3)} tone="accent" />
            <Readout label="Offset found" value={fmt(offset, 3)} unit="mm" tone="info" />
          </div>
          <Note>Those two distances are always at right angles, with the offset as the hypotenuse. So the centre stays on a circle whose diameter is the offset.</Note>
        </>
      ) : null}
    </TestBench>
  )
}

export function OldhamPanel() {
  const p = useOldham()
  const w = (p.rpm * 2 * Math.PI) / 60
  const theta = useLive(() => live.theta, 15)
  // the sliding speed in a groove at this instant
  const slide = Math.abs(w * p.d * Math.sin(theta))
  const peak = oldhamMaxSliding(p.d, w)
  return (
    <div>
      <OldhamTest />
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Shaft angle" value={fmt(((deg(theta) % 360) + 360) % 360, 3)} unit="°" />
          <Readout label="Shaft speed" value={fmt(p.rpm, 3)} unit="rpm" />
          <Readout label="Disc speed" value={fmt(p.rpm, 3)} unit="rpm" tone="accent" />
          <Readout label="Locus diameter" value={fmt(p.d, 3)} unit="mm" tone="warn" />
          <Readout label="Centre circles at" value={fmt(2 * p.rpm, 3)} unit="rpm" tone="info" />
          <Readout label="Groove sliding" value={fmt(slide, 3)} unit="mm/s" />
        </div>
        <Note>Input and output speeds match at every instant: this coupling has a constant velocity ratio of 1.</Note>
      </Section>
      <Section title="The coupling">
        <Slider label="Shaft offset d" value={p.d} min={0} max={60} step={1} unit="mm" onChange={(d) => set({ d })} />
        <Slider label="Shaft speed" value={p.rpm} min={2} max={60} step={1} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Toggle label="Show the disc centre’s path" checked={p.trace} onChange={(trace) => set({ trace })} />
      </Section>
      <Section title="Working">
        <Working
          steps={[
            { label: 'The disc centre lies on both tongues', tex: '\\text{tongues at } 90^\\circ \\Rightarrow \\text{ a right angle at the centre, on diameter } AB', result: '\\text{a circle, diameter } d', errata: 'A worked report calls this path elliptical. It is a circle: the angle in a semicircle is a right angle.' },
            { label: 'How fast it goes round', tex: '\\omega_{\\text{locus}} = 2\\omega', sub: `=2(${num(p.rpm, 3)})`, result: `=${num(2 * p.rpm, 3)}\\ \\text{rpm}` },
            { label: 'Largest sliding speed in a groove', tex: 'v_{\\max} = \\omega d', sub: `=${num(w, 3)}(${num(p.d, 3)})`, result: `=${num(peak, 3)}\\ \\text{mm/s}` },
          ]}
        />
      </Section>
      <Section title="Exam points">
        <ExamList>
          <li>An inversion of the double-slider crank chain, for parallel shafts slightly out of line.</li>
          <li>Disc speed = shaft speed; the centre’s locus is a circle of diameter d, traversed at 2ω.</li>
          <li>Problems: sliding friction and wear at the tongues, backlash once worn, and imbalance from the moving disc at speed.</li>
          <li>Remedies: lubrication, a light low-friction disc, and sprung pre-load to take up backlash.</li>
          <li>Unsuitable where shafts are not parallel, the offset is large, or the speed is high.</li>
        </ExamList>
      </Section>
    </div>
  )
}
