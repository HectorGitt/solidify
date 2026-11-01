import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Tensile3D, TensilePanel, useTensile } from './Rig'

const NOTE = (where: string) => cite('CVE202', 'CVE 202 note.pdf', where)
const PQ = (where: string) => cite('CVE202', 'CVE202 PQ.pdf', where)
const view = { position: [1.35, 0.55, 3.5] as [number, number, number], target: [0, -0.02, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'tensile',
  title: 'Tensile testing machine',
  summary: 'Pull a specimen to failure: watch it stretch, neck and break while the stress–strain curve draws itself, and compare ductile metals with brittle ones.',
  Viewport: Tensile3D,
  Panel: TensilePanel,
  camera: view,
  extent: 1.8,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the specimen', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [NOTE('direct stresses; loading test of ductile and brittle materials'), PQ('stress–strain diagram')],
  reset: () => useTensile.getState().reset(),
  applyParams: (p) => useTensile.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Pulling a bar apart',
      body: 'The crosshead moves up at a steady rate and the machine reads the force. Dividing by the **original area** gives stress; dividing the extension by the **gauge length** gives strain. Plotting one against the other describes the material, whatever the specimen’s size.',
      camera: view,
      cut: false,
      select: 'specimen',
      explode: 0,
      playing: true,
      params: { material: 'mild' },
      cites: [NOTE('direct stresses')],
    },
    {
      title: 'The straight part',
      body: 'At first stress and strain rise together, and the bar springs back if unloaded. Its slope is **Young’s modulus**. Mild steel then **yields**: it stretches with no more force, and it will not spring back fully from here on.',
      select: 'crosshead',
      cites: [NOTE('loading test of ductile materials')],
      check: {
        question: 'A mild steel rod has a 4 cm² area and carries 10 kN, with E = 200 GPa. What is its strain?',
        options: ['1.25 × 10⁻⁴', '2.5 × 10⁻⁴', '2 × 10⁻⁵'],
        answer: 0,
        explain: 'σ = 10 000 N / 400 mm² = **25 MPa**, and ε = σ/E = 25 / 200 000 = **1.25 × 10⁻⁴**.',
      },
    },
    {
      title: 'Necking',
      body: 'Past the **ultimate stress** the bar thins in one place: it **necks**. The force falls, because the area is shrinking, and then it breaks. Cup and cone fracture surfaces are the sign of a ductile break.',
      select: 'specimen',
      cites: [NOTE('percent elongation and reduction in area')],
    },
    {
      title: 'Brittle materials',
      body: 'Cast iron and concrete give almost no warning. There is little stretch, no neck, and a sudden break. The small area under the curve means they absorb **little energy**, which is why they are kept in compression.',
      params: { material: 'cast' },
      select: 'specimen',
      cites: [NOTE('loading test of brittle materials')],
      check: {
        question: 'What does the area under a stress–strain curve represent?',
        options: ['The stiffness', 'The energy absorbed per unit volume', 'The yield stress'],
        answer: 1,
        explain: 'Stress times strain is force times distance per unit volume: the **energy absorbed**. That is why ductile metals are so much tougher than brittle ones of the same strength.',
      },
    },
  ],
}

export default scene
