import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, useBeam } from './model'
import { BeamPanel, PRESETS } from './Panel'
import { Beam3D, FLOOR } from './Scene3D'

const NOTE = (where: string) => cite('CVE202', 'CVE 202 note.pdf', where)
const PQ = (where: string) => cite('CVE202', 'CVE202 PQ.pdf', where)
const view = { position: [0.85, 0.5, 3.0] as [number, number, number], target: [0, -0.03, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'beam',
  title: 'Beam bending rig',
  summary:
    'A loaded beam on the bench that visibly bends: change the supports, loads and cross-section, and read the shear force, bending moment, stresses through the depth and deflection.',
  Viewport: Beam3D,
  Panel: BeamPanel,
  camera: view,
  extent: 2,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [
    { id: 'cross', label: 'Cross-section at mid-span', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'mid', label: 'Along the beam', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  cites: [NOTE('course outline'), PQ('2010/11 test Fig 1; 2012/13 Q3')],
  reset: () => useBeam.getState().reset(),
  applyParams: (p) => {
    const pr = p.preset ? PRESETS.find((x) => x.id === p.preset) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useBeam.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'A beam under load',
      body: 'Two weights hang from a beam on a **pin** and a **roller**. Taking moments about A gives R_B, and the vertical forces then give R_A: **26.67 kN and 33.33 kN**. The heavier load sits nearer B, so B carries more.',
      camera: view,
      cut: false,
      select: 'supports',
      explode: 0,
      params: { preset: 'third' },
      cites: [PQ('2010/11 test Fig 1')],
    },
    {
      title: 'Shear force',
      body: 'Cut the beam anywhere: the **shear force** is the net vertical force on one side. Between loads it is constant, and it steps down by the load at each weight: +26.67, +6.67, then −33.33 kN.',
      select: 'load-1',
      params: { diagrams: true },
      cites: [NOTE('shearing force and bending moments')],
      check: {
        question: 'Where along this beam is the bending moment largest?',
        options: ['At the supports', 'Where the shear force crosses zero', 'Where the shear force is largest'],
        answer: 1,
        explain: 'The slope of the moment diagram is the shear force, so the moment peaks where the **shear changes sign**: under the 40 kN load here, at **66.67 kN·m**.',
      },
    },
    {
      title: 'Tension and compression',
      body: 'A sagging beam **shortens along the top and stretches along the bottom**. The stress grows straight from zero at the **neutral axis** to its largest at the far fibre: **σ = M y / I**. That is why the steel of an I beam sits in the flanges, as far out as it can.',
      select: 'beam',
      params: { stress: true, section: 'eye' },
      cites: [NOTE('bending stresses in beams')],
    },
    {
      title: 'Shear through the depth',
      body: 'Shear stress is the opposite way round: zero at the top and bottom faces, largest at the neutral axis, **τ = V Q / (I b)**. On a T section it jumps where the width changes. Here the web’s 3 MPa limit sets the load: **w = 2.79 kN/m**, with **29.5 MPa** of bending stress at the bottom of the web.',
      params: { preset: 'tee' },
      cites: [PQ('T-section, Fig Q7')],
      check: {
        question: 'A rectangular section carries shear force V. How does the largest shear stress compare with V/A?',
        options: ['It equals V/A', 'It is 1.5 V/A', 'It is 2 V/A'],
        answer: 1,
        explain: 'The stress varies as a parabola across the depth, zero at the faces, and its peak at the neutral axis is **1.5 times** the average V/A.',
      },
    },
    {
      title: 'Cantilevers',
      body: 'Build one end in and the wall supplies a force and a **moment**. The moment is largest at the wall, −P L, and hogging, so the tension moves to the top. The free end drops by **P L³ / 3 E I**.',
      params: { preset: 'cantilever' },
      select: 'wall',
      cites: [NOTE('deflection of beams')],
    },
    {
      title: 'Stiffness and the section',
      body: 'Deflection falls with **E I**, and I grows with the **cube of the depth**. Double the depth and the beam is eight times stiffer: try the web depth slider and watch the reading drop.',
      params: { preset: 'third' },
      select: null,
      cites: [NOTE('properties of beam sections')],
    },
  ],
}

export default scene
