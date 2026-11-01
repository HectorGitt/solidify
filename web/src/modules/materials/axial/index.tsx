import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Axial3D, AxialPanel, DEFAULTS, FLOOR, useAxial } from './Rig'

const NOTE = (where: string) => cite('CVE202', 'CVE 202 note.pdf', where)
const PQ = (where: string) => cite('CVE202', 'CVE202 PQ.pdf', where)
const view = { position: [1.2, 0.55, 3.6] as [number, number, number], target: [0, -0.15, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'axial',
  title: 'Thermal stress & composite bars',
  summary: 'Crane rails that close their gaps as the day warms, and a steel rod sharing a pull with a brass tube: stress that comes from what stops a bar moving.',
  Viewport: Axial3D,
  Panel: AxialPanel,
  camera: view,
  extent: 2,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Lengthwise', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [NOTE('stresses due to load and temperature'), PQ('2012/13 Q1 and Q2')],
  reset: () => useAxial.getState().reset(),
  applyParams: (p) => useAxial.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Free to grow',
      body: 'These 18 m rails were laid **3.2 mm apart at 15 °C**. As they warm they grow, by **δ = α L ΔT**, and the gap closes. Nothing resists them, so there is **no stress** yet.',
      camera: view,
      cut: false,
      select: 'rail-a',
      explode: 0,
      params: { ...DEFAULTS, T: 25 },
      cites: [PQ('2012/13 Q1')],
      check: {
        question: 'At what temperature do these rails first touch?',
        options: ['About 20 °C', 'About 30 °C', 'About 45 °C'],
        answer: 1,
        explain: 'The gap closes after ΔT = 0.0032 / (11.7×10⁻⁶ × 18) = **15.2 °C**, so at **30.2 °C**.',
      },
    },
    {
      title: 'Held',
      body: 'Once the ends meet, the rest of the growth is **stopped**, and that is what makes stress: **σ = E α ΔT**. At 45 °C it is **35.9 MPa** in compression. Note that the rail’s length and area have no effect on it.',
      params: { T: 45 },
      select: 'bed',
      cites: [PQ('2012/13 Q1(c)')],
    },
    {
      title: 'Two materials, one pull',
      body: 'A steel rod inside a brass tube, joined by rigid plates. The plates force **the same strain** on both. That, with equilibrium, solves it: **ε = P / (A₁E₁ + A₂E₂)**.',
      params: { mode: 'composite' },
      camera: { position: [0.9, 0.6, 2.2], target: [0, 0.02, 0] },
      select: 'core',
      cites: [PQ('2012/13 Q2')],
      check: {
        question: 'Same strain in steel (200 GPa) and brass (97 GPa). Which carries the higher stress?',
        options: ['Steel', 'Brass', 'Equal'],
        answer: 0,
        explain: 'σ = E ε, so the **stiffer steel** carries about twice the stress: 95.1 MPa against 46.1 MPa here.',
      },
    },
  ],
}

export default scene
