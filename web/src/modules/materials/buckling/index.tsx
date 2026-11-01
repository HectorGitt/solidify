import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { Column3D, ColumnPanel, DEFAULTS, FLOOR, useColumn } from './Rig'

const NOTE = (where: string) => cite('CVE202', 'CVE 202 note.pdf', where)
const PQ = (where: string) => cite('CVE202', 'CVE202 PQ.pdf', where)
const view = { position: [1.5, 0.65, 3.8] as [number, number, number], target: [0, 0.06, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'buckling',
  title: 'Column buckling rig',
  summary: 'Press down on a slender column until it bows out and fails. Change its ends and length, and find where buckling gives way to crushing.',
  Viewport: Column3D,
  Panel: ColumnPanel,
  camera: view,
  extent: 2.2,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the column', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [NOTE('buckling'), PQ('2009/10 Q5; 2015/16 Q15')],
  reset: () => useColumn.getState().reset(),
  applyParams: (p) => useColumn.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A different way to fail',
      body: 'A short block fails by **crushing**. A long thin column fails first by **bending sideways**, at far less load. Watch the bow grow faster and faster as the load approaches the critical load.',
      camera: view,
      cut: false,
      select: 'column',
      explode: 0,
      playing: true,
      params: { ...DEFAULTS, loadPct: 0 },
      cites: [NOTE('buckling')],
    },
    {
      title: 'Euler’s load',
      body: '**Pₑ = π²EI / Lₑ²**. Strength in buckling does not depend on the material’s strength at all: only its **stiffness** E, the section’s **I**, and the length. A high-strength steel column buckles at the same load as a mild steel one.',
      cites: [PQ('2009/10 Q5')],
      check: {
        question: 'A column’s length is doubled. What happens to Euler’s load?',
        options: ['It halves', 'It falls to a quarter', 'It falls to an eighth'],
        answer: 1,
        explain: 'Pₑ goes with **1/L²**, so twice the length is a quarter of the load.',
      },
    },
    {
      title: 'How the ends are held',
      body: 'Fixing the ends makes the column bend in a shorter curve, its **effective length**. Fixed at both ends, Lₑ = L/2, which is **four times** as strong as pinned. A flagpole, fixed and free, has Lₑ = 2L, and is a quarter as strong.',
      params: { ends: 'fixed-fixed' },
      select: 'ends',
      cites: [NOTE('effective length')],
    },
    {
      title: 'Where Euler stops',
      body: 'Euler’s formula assumes the column stays elastic. At slenderness below **π√(E/σₚ)** it predicts more than the material can carry. For Ø50 steel with fixed ends and σₚ = 210 MPa, that limit is at **L = 2.42 m and 412 kN**.',
      params: { ends: 'fixed-fixed', L: 2.424, D: 50 },
      cites: [PQ('2009/10 Q5')],
    },
  ],
}

export default scene
