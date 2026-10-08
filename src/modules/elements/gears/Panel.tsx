import { useMemo, useState } from 'react'
import { circularPitch, gearModule, helicalForces } from '@/physics/elements'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { flyTo } from '@/ui/camera'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { A503 } from '../_shared/cites'
import { ModeTabs, Note, PresetGrid, Table, type Preset } from '../_shared/PanelBits'
import { BEVEL, DEFAULTS, SPUR, bevelResult, deg, helicalResult, idlerResult, rad, spurResult, useGears, type GearParams, type Mode } from './model'

const set = (p: Partial<GearParams>) => useGears.getState().set(p)

export const MODE_CAMERA: Record<Mode, { position: [number, number, number]; target: [number, number, number] }> = {
  spur: { position: [0.22, 0.2, 0.56], target: [0, 0, 0] },
  helical: { position: [0.35, 0.22, 0.5], target: [0, 0, 0] },
  bevel: { position: [0.42, 0.3, 0.5], target: [0.03, 0.04, 0] },
  idler: { position: [0.4, 0.32, 1.05], target: [0.02, 0, 0] },
}

export function setMode(mode: Mode) {
  set({ mode })
  flyTo(MODE_CAMERA[mode])
}

export const PRESETS: Preset[] = [
  {
    id: 'spur',
    label: 'Spur · 200 N·m on Ø100',
    note: 'Exam 2019/20 Q3b: F_t = M_t/r = 200/0.05 = 4000 N; F_r = 4000 tan 20° = 1456 N, pointing to the gear centre.',
    apply: () => {
      set({ ...DEFAULTS, mode: 'spur', Mt: 200, D: 0.1, phi: rad(20) })
      flyTo(MODE_CAMERA.spur)
    },
  },
  {
    id: 'helical',
    label: 'Helical · Ø250, 27°/30°',
    note: 'Exams 2016/17 Q3b and 2019/20 Q3c: 200 N·m on a Ø250 helical gear, φ = 27° (plane of rotation), α = 30° → F_t = 1600 N, F_r = 815 N, F_a = 924 N.',
    flag: 'The guides print F_a = 1600 tan 30° = 928 N; tan 30° = 0.5774 gives 924 N.',
    apply: () => {
      set({ ...DEFAULTS, mode: 'helical', Mt: 200, D: 0.25, phi: rad(27), helix: rad(30), plane: 'transverse' })
      flyTo(MODE_CAMERA.helical)
    },
  },
  {
    id: 'bevel',
    label: 'Bevel · 6 kW, ratio 4/3',
    note: 'Exam 2015/16 Q3c: pinion Ø150, face 50 mm, 14.5°, 6 kW at 240 rpm → sin β = 0.6, r_m = 60 mm, M_t = 239 N·m, F_t = 3983 N, F_p = 618 N, F_g = 824 N.',
    apply: () => {
      set({ ...DEFAULTS, mode: 'bevel', P: 6000, bRpm: 240, ratio: 4 / 3, Dp: 0.15, face: 0.05, phiB: rad(14.5) })
      flyTo(MODE_CAMERA.bevel)
    },
  },
  {
    id: 'idler',
    label: 'Idler train A–B–C',
    note: 'Exams 2017/18 and 2021/22 Q2c: module 6, 35/65/45 teeth → Ø210/390/270; 3 kW at 600 rpm → T_A = 47.8 N·m, T_C = 61.4 N·m, N_C = 466.7 rpm; idler shaft load 837 N (guide figure).',
    flag: 'The guides give the tooth load as 434 N; T_A/r_A = 47.75/0.105 = 455 N (F_r = 166 N). The 837 N shaft load depends on the angle ABC in the guide’s figure, which is not reproduced — set it with the slider.',
    apply: () => {
      set({ ...DEFAULTS, mode: 'idler', iP: 3000, iRpm: 600, zA: 35, zB: 65, zC: 45, m: 0.006, phiI: rad(20), psi: Math.PI })
      flyTo(MODE_CAMERA.idler)
    },
  },
]

function LivePanel() {
  const p = useGears()
  if (p.mode === 'bevel') {
    const r = bevelResult(p)
    return (
      <Section title="Forces on the pinion">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Fₜ" value={fmt(r.Ft, 4)} unit="N" tone="warn" />
          <Readout label="Fₚ (pinion)" value={fmt(r.Fp, 4)} unit="N" tone="accent" />
          <Readout label="F_g (gear)" value={fmt(r.Fg, 4)} unit="N" tone="info" />
          <Readout label="β" value={fmt(deg(r.beta), 4)} unit="°" />
          <Readout label="r_m" value={fmt(r.rm * 1000, 4)} unit="mm" />
          <Readout label="M_t" value={fmt(r.Mt, 4)} unit="N·m" />
        </div>
      </Section>
    )
  }
  if (p.mode === 'idler') {
    const r = idlerResult(p)
    return (
      <Section title="Idler train">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="T_A" value={fmt(r.TA, 3)} unit="N·m" />
          <Readout label="T_C" value={fmt(r.TC, 3)} unit="N·m" tone="accent" />
          <Readout label="N_C" value={fmt(r.rpmC, 4)} unit="rpm" />
          <Readout label="Fₜ" value={fmt(r.Ft, 3)} unit="N" tone="warn" />
          <Readout label="Fᵣ" value={fmt(r.Fr, 3)} unit="N" tone="info" />
          <Readout label="Idler shaft" value={fmt(r.load, 3)} unit="N" />
        </div>
      </Section>
    )
  }
  const helical = p.mode === 'helical'
  const f = helical ? helicalResult(p) : spurResult(p)
  return (
    <Section title={helical ? 'Helical gear forces' : 'Spur gear forces'}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Fₜ tangential" value={fmt(f.Ft, 4)} unit="N" tone="warn" />
        <Readout label="Fᵣ separating" value={fmt(f.Fr, 4)} unit="N" tone="info" />
        {helical ? <Readout label="Fₐ thrust" value={fmt((f as ReturnType<typeof helicalResult>).Fa, 4)} unit="N" tone="accent" /> : <Readout label="Resultant" value={fmt(f.F, 4)} unit="N" />}
      </div>
    </Section>
  )
}

function Controls() {
  const p = useGears()
  return (
    <Section title="Gear set">
      <ModeTabs<Mode>
        value={p.mode}
        onChange={setMode}
        options={[
          { value: 'spur', label: 'Spur' },
          { value: 'helical', label: 'Helical' },
          { value: 'bevel', label: 'Bevel' },
          { value: 'idler', label: 'Idler train' },
        ]}
      />
      <div className="h-2" />
      {p.mode === 'spur' || p.mode === 'helical' ? (
        <>
          <Slider label="Torque Mₜ" value={p.Mt} min={10} max={500} step={5} unit="N·m" onChange={(Mt) => set({ Mt })} />
          <Segmented<'pinion' | 'gear'>
            label="Torque applied to"
            value={Math.abs(p.D - SPUR.m * SPUR.z2) < 1e-6 ? 'gear' : 'pinion'}
            onChange={(v) => set({ D: v === 'gear' ? SPUR.m * SPUR.z2 : SPUR.m * SPUR.z1 })}
            options={[
              { value: 'pinion', label: `Pinion Ø${SPUR.m * SPUR.z1 * 1000}` },
              { value: 'gear', label: `Gear Ø${SPUR.m * SPUR.z2 * 1000}` },
            ]}
          />
          <Slider label="Pressure angle φ" value={deg(p.phi)} min={14.5} max={30} step={0.5} unit="°" onChange={(v) => set({ phi: rad(v) })} />
          {p.mode === 'helical' ? (
            <>
              <Slider label="Helix angle α" value={deg(p.helix)} min={5} max={45} step={1} unit="°" onChange={(v) => set({ helix: rad(v) })} />
              <Segmented<'transverse' | 'normal'>
                label="φ measured in"
                value={p.plane}
                onChange={(plane) => set({ plane })}
                options={[
                  { value: 'transverse', label: 'Plane of rotation' },
                  { value: 'normal', label: 'Normal to tooth (φₙ)' },
                ]}
              />
            </>
          ) : null}
        </>
      ) : null}
      {p.mode === 'bevel' ? (
        <>
          <Slider label="Power" value={p.P / 1000} min={0.5} max={20} step={0.5} unit="kW" onChange={(v) => set({ P: v * 1000 })} />
          <Slider label="Pinion speed" value={p.bRpm} min={50} max={1500} step={10} unit="rpm" onChange={(bRpm) => set({ bRpm })} />
          <Slider label="Velocity ratio" value={p.ratio} min={1} max={4} step={0.01} onChange={(ratio) => set({ ratio })} />
          <Slider label="Pressure angle φ" value={deg(p.phiB)} min={14.5} max={25} step={0.5} unit="°" onChange={(v) => set({ phiB: rad(v) })} />
          <Note>The drawn pair keeps the 30/40-tooth (4 : 3) proportions; the forces follow the sliders.</Note>
        </>
      ) : null}
      {p.mode === 'idler' ? (
        <>
          <Slider label="Power" value={p.iP / 1000} min={0.5} max={10} step={0.5} unit="kW" onChange={(v) => set({ iP: v * 1000 })} />
          <Slider label="Speed of A" value={p.iRpm} min={100} max={1500} step={10} unit="rpm" onChange={(iRpm) => set({ iRpm })} />
          <Slider label="Teeth A" value={p.zA} min={15} max={60} step={1} onChange={(zA) => set({ zA })} />
          <Slider label="Teeth B (idler)" value={p.zB} min={15} max={80} step={1} onChange={(zB) => set({ zB })} />
          <Slider label="Teeth C" value={p.zC} min={15} max={60} step={1} onChange={(zC) => set({ zC })} />
          <Slider label="Angle ABC at the idler" value={deg(p.psi)} min={60} max={180} step={1} unit="°" onChange={(v) => set({ psi: rad(v) })} hint="Shaft load = vector sum of the two tooth forces on B" />
        </>
      ) : null}
      <Slider label="Animation speed (pinion)" value={p.rpm} min={0} max={120} step={1} unit="rpm" onChange={(rpm) => set({ rpm })} />
    </Section>
  )
}

function Nomenclature() {
  const p = useGears()
  const c = spurResult(p).circles
  const m = SPUR.m
  return (
    <Section title="Spur nomenclature (pinion)">
      <Table
        head={['Term', 'Value', 'Meaning']}
        rows={[
          ['Pitch circle', `Ø${fmt(c.pitch * 2000, 4)} mm`, 'imaginary rolling circle'],
          ['Module m = D/N', `${fmt(gearModule(SPUR.z1 * m, SPUR.z1) * 1000, 3)} mm`, 'size of tooth'],
          ['Circular pitch πD/N', `${fmt(circularPitch(SPUR.z1 * m, SPUR.z1) * 1000, 4)} mm`, 'P_c/m = π'],
          ['Addendum circle', `Ø${fmt(c.addendum * 2000, 4)} mm`, 'tips of teeth (+m)'],
          ['Dedendum circle', `Ø${fmt(c.dedendum * 2000, 4)} mm`, 'bottom land (−1.25m)'],
          ['Tooth thickness', `${fmt(c.toothThickness * 1000, 4)} mm`, 'arc on pitch circle'],
          ['Pressure angle φ', `${fmt(deg(p.phi), 3)}°`, 'line of action ∠ tangent'],
        ]}
      />
      <Note>Top land is the tooth tip face, bottom land the floor between teeth; the face is the flank above the pitch circle, the flank below it; face width is the length along the axis. The 1.25m dedendum is standard practice.</Note>
    </Section>
  )
}

function HelixChart() {
  const p = useGears()
  const data = useMemo(() => {
    const xs: number[] = []
    const fa: number[] = []
    const fr: number[] = []
    for (let a = 0; a <= 45; a += 1) {
      const f = helicalForces(p.Mt, p.D / 2, p.phi, rad(a), p.plane)
      xs.push(a)
      fa.push(f.Fa)
      fr.push(f.Fr)
    }
    return [xs, fa, fr]
  }, [p.Mt, p.D, p.phi, p.plane])
  if (p.mode !== 'helical') return null
  return (
    <Section title="Thrust grows with helix angle">
      <Chart data={data} series={[{ label: 'Fₐ', color: '#9bd17a', width: 2 }, { label: 'Fᵣ', color: '#6fb3e0', width: 1.5 }]} xLabel="Helix angle α (°)" yLabel="Force (N)" marker={() => [deg(p.helix), helicalResult(p).Fa]} height={150} />
      <Note>Green F_a = F_t tan α, blue F_r. The thrust must be taken by a thrust or taper bearing — or cancelled with a double-helical (herringbone) gear.</Note>
    </Section>
  )
}

function GearWorking() {
  const p = useGears()
  const steps: WorkingStep[] = []
  const m5 = A503.m(5, 'Gear forces')
  if (p.mode === 'spur' || p.mode === 'helical') {
    const r = p.D / 2
    steps.push({ label: 'Tangential force at the pitch radius', tex: 'F_t=\\dfrac{M_t}{r}', sub: `=\\dfrac{${n(p.Mt, 4)}}{${n(r, 4)}}`, result: `=${n(p.Mt / r, 4)}\\ \\text{N}`, cite: m5 })
    if (p.mode === 'spur') {
      steps.push({ label: 'Separating (radial) force', tex: 'F_r=F_t\\tan\\phi', sub: `=${n(p.Mt / r, 4)}\\tan ${n(deg(p.phi), 3)}^\\circ`, result: `=${n(spurResult(p).Fr, 4)}\\ \\text{N}`, cite: m5 })
    } else {
      const f = helicalResult(p)
      steps.push(
        p.plane === 'transverse'
          ? { label: 'Separating force (φ in the plane of rotation)', tex: 'F_r=F_t\\tan\\phi', sub: `=${n(f.Ft, 4)}\\tan ${n(deg(p.phi), 3)}^\\circ`, result: `=${n(f.Fr, 4)}\\ \\text{N}`, cite: A503.m(5, 'slide 10') }
          : { label: 'Separating force (φₙ normal to the tooth)', tex: 'F_r=\\dfrac{F_t\\tan\\phi_n}{\\cos\\alpha}', sub: `=\\dfrac{${n(f.Ft, 4)}\\tan ${n(deg(p.phi), 3)}^\\circ}{\\cos ${n(deg(p.helix), 3)}^\\circ}`, result: `=${n(f.Fr, 4)}\\ \\text{N}`, cite: A503.m(5, 'slide 12') },
      )
      steps.push({ label: 'Axial thrust', tex: 'F_a=F_t\\tan\\alpha', sub: `=${n(f.Ft, 4)}\\tan ${n(deg(p.helix), 3)}^\\circ`, result: `=${n(f.Fa, 4)}\\ \\text{N}`, cite: A503.mg19('Q3c'), errata: Math.abs(deg(p.helix) - 30) < 0.01 && Math.abs(p.Mt - 200) < 0.01 && Math.abs(p.D - 0.25) < 1e-6 ? 'The guides print 928 N; 1600 × tan 30° = 924 N.' : undefined })
    }
  } else if (p.mode === 'bevel') {
    const r = bevelResult(p)
    const R = p.Dp / 2
    steps.push({ label: 'Pitch-cone angle of the pinion', tex: '\\tan\\beta=\\dfrac{r_p}{r_g}', sub: `=\\dfrac{${n(R * 1000, 4)}}{${n(R * p.ratio * 1000, 4)}}`, result: `\\beta=${n(deg(r.beta), 4)}^\\circ,\\ \\sin\\beta=${n(Math.sin(r.beta), 3)}`, cite: A503.mg15('Q3c') })
    steps.push({ label: 'Mean pitch radius', tex: 'r_m=R-\\tfrac{b}{2}\\sin\\beta', sub: `=${n(R * 1000, 4)}-\\tfrac{${n(p.face * 1000, 3)}}{2}(${n(Math.sin(r.beta), 3)})`, result: `=${n(r.rm * 1000, 4)}\\ \\text{mm}`, cite: A503.mg15('Q3c') })
    steps.push({ label: 'Pinion torque', tex: 'M_t=\\dfrac{60P}{2\\pi N}', sub: `=\\dfrac{60(${n(p.P, 4)})}{2\\pi(${p.bRpm})}`, result: `=${n(r.Mt, 4)}\\ \\text{N·m}`, cite: A503.mg15('Q3c') })
    steps.push({ label: 'Tangential force at r_m', tex: 'F_t=M_t/r_m', sub: `=${n(r.Mt, 4)}/${n(r.rm, 4)}`, result: `=${n(r.Ft, 4)}\\ \\text{N}`, cite: A503.m(5, 'slide 15') })
    steps.push({ label: 'Pinion and gear thrusts', tex: 'F_p=F_t\\tan\\phi\\sin\\beta,\\quad F_g=F_t\\tan\\phi\\cos\\beta', sub: `\\phi=${n(deg(p.phiB), 3)}^\\circ`, result: `F_p=${n(r.Fp, 4)}\\ \\text{N},\\ F_g=${n(r.Fg, 4)}\\ \\text{N}`, cite: A503.m(5, 'slide 15') })
  } else {
    const r = idlerResult(p)
    steps.push({ label: 'Diameters D = mN', tex: 'D_A,D_B,D_C=m\\,z', sub: `=${p.m * 1000}\\times(${p.zA},${p.zB},${p.zC})`, result: `=${r.D.map((d) => n(d * 1000, 4)).join(',\\ ')}\\ \\text{mm}`, cite: A503.mg17('Q2c') })
    steps.push({ label: 'Torque on A', tex: 'T_A=\\dfrac{P}{\\omega}=\\dfrac{60P}{2\\pi N_A}', sub: `=\\dfrac{60(${p.iP})}{2\\pi(${p.iRpm})}`, result: `=${n(r.TA, 4)}\\ \\text{N·m}`, cite: A503.mg21('Q2c') })
    steps.push({ label: 'Idler passes the tooth force on; C sees the same Fₜ', tex: 'T_C=T_A\\dfrac{z_C}{z_A},\\quad N_C=N_A\\dfrac{z_A}{z_C}', sub: `=${n(r.TA, 4)}\\dfrac{${p.zC}}{${p.zA}},\\ ${p.iRpm}\\dfrac{${p.zA}}{${p.zC}}`, result: `T_C=${n(r.TC, 4)}\\ \\text{N·m},\\ N_C=${n(r.rpmC, 4)}\\ \\text{rpm}`, cite: A503.mg21('Q2c') })
    steps.push({ label: 'Tooth loads', tex: 'F_t=T_A/r_A,\\quad F_r=F_t\\tan\\phi', sub: `=${n(r.TA, 4)}/${n(r.rA, 4)}`, result: `F_t=${n(r.Ft, 4)}\\ \\text{N},\\ F_r=${n(r.Fr, 4)}\\ \\text{N}`, cite: A503.mg17('Q2c'), errata: 'The guides give 434 N for the tooth load; 47.75 N·m / 0.105 m = 455 N.' })
    steps.push({ label: 'Idler shaft load', tex: '\\vec F_B=\\vec F_{AB}+\\vec F_{CB}', sub: `\\angle ABC=${n(deg(p.psi), 4)}^\\circ`, result: `|F_B|=${n(r.load, 4)}\\ \\text{N}`, cite: A503.mg17('Q2c: 837 N for the figure') })
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function GearsPanel() {
  const [preset, setPreset] = useState<string | null>('spur')
  const mode = useGears((s) => s.mode)
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      {mode === 'spur' ? <Nomenclature /> : null}
      <HelixChart />
      <GearWorking />
      <Section title="Drawn pairs">
        <Note>
          Spur/helical: module {SPUR.m * 1000} mm, {SPUR.z1}/{SPUR.z2} teeth (Ø{SPUR.m * SPUR.z1 * 1000}/Ø{SPUR.m * SPUR.z2 * 1000}). Bevel: {BEVEL.z1}/{BEVEL.z2} teeth, module {BEVEL.m * 1000} mm at the large end (Ø150/Ø200), face {BEVEL.face * 1000} mm.
        </Note>
      </Section>
    </div>
  )
}
