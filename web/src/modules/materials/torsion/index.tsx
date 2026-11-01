import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Torsion3D, TorsionPanel, useTorsion } from './Rig'

const NOTE = (where: string) => cite('CVE202', 'CVE 202 note.pdf', where)
const PQ = (where: string) => cite('CVE202', 'CVE202 PQ.pdf', where)
const view = { position: [1.15, 0.62, 3.5] as [number, number, number], target: [0, -0.08, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'torsion',
  title: 'Torsion rig',
  summary: 'Twist a solid or hollow shaft: see a straight line become a helix, read the twist and shear stress, and find out why hollow shafts save so much weight.',
  Viewport: Torsion3D,
  Panel: TorsionPanel,
  camera: view,
  extent: 2.2,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Along the shaft', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [NOTE('torsion of shaft'), PQ('hollow shaft Q14; shaft design Q13')],
  reset: () => useTorsion.getState().reset(),
  applyParams: (p) => useTorsion.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A straight line becomes a helix',
      body: 'One end is held, and the arm twists the other. The straight orange line along the shaft becomes a **helix**: each section turns slightly further than the last, and that sliding between sections is **shear**.',
      camera: view,
      cut: false,
      select: 'arm',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [NOTE('torsion of shaft')],
    },
    {
      title: 'One equation',
      body: '**T/J = τ/r = Gθ/L**. The hollow shaft here, Ø146/125 and 3 m long under 25 kN·m, twists **2.45°** with 88 MPa at its outer surface. Double the length and the twist doubles; the stress does not change.',
      select: 'shaft',
      cites: [PQ('Q14')],
      check: {
        question: 'A shaft’s diameter is doubled. By how much does its twist fall, for the same torque?',
        options: ['2 times', '8 times', '16 times'],
        answer: 2,
        explain: 'J goes with **D⁴**, and θ = TL/GJ. Doubling the diameter makes it 16 times stiffer in torsion.',
      },
    },
    {
      title: 'Why hollow',
      body: 'Stress grows from zero at the centre, so the metal near the middle hardly works. Removing it costs little: this tube takes about **a third of the steel** of a solid shaft with the same torque and stress.',
      params: { d: 125 },
      select: 'shaft',
      cites: [NOTE('torsion of shaft')],
    },
    {
      title: 'Designing a shaft',
      body: 'To carry **80 kW at 3 rev/s**, T = P/2πN = 4.24 kN·m. With peak torque 4 % higher and τ limited to 70 MPa, d = ∛(16T/πτ) = **68.5 mm**. Then check the twist as well, and take whichever needs the larger shaft.',
      params: { T: 4.414, L: 1, D: 68.5, hollow: false, G: 90 },
      cites: [PQ('Q13')],
    },
  ],
}

export default scene
