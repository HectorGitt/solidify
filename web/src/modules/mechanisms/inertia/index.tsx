import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { useInertia, type InertiaParams } from './model'
import { InertiaPanel } from './Panel'
import { FLOOR, Inertia3D } from './Scene3D'

const LAB = (where: string) => cite('MEE396', '396.pdf', where)
const view = { position: [1.25, 0.6, 4.7] as [number, number, number], target: [0, -0.08, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'inertia',
  title: 'Moment of inertia by oscillation',
  summary: 'Compound pendulum, bifilar and trifilar suspensions: time the swing, work out the inertia, and compare it with the geometry.',
  Viewport: Inertia3D,
  Panel: InertiaPanel,
  camera: view,
  extent: 2,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  cutPresets: [{ id: 'mid', label: 'Through the frame', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [LAB('pendulum, bifilar and trifilar experiments')],
  reset: () => useInertia.getState().reset(),
  applyParams: (p) => useInertia.getState().set(p as Partial<InertiaParams>),
  tour: [
    {
      title: 'Why swing it?',
      body: 'A body’s inertia decides how it resists speeding up. A complicated shape is hard to calculate, but **easy to time**. Hang it off-centre, give it a small swing, and the period gives the inertia: **I = m g h (T/2π)²**.',
      camera: view,
      cut: false,
      select: 'pendulum',
      explode: 0,
      playing: true,
      params: { mode: 'pendulum', mBar: 4, h: 0.62 },
      cites: [LAB('pendulum method')],
    },
    {
      title: 'Timing it properly',
      body: 'Time **20 swings**, five times over, and take the mean. Timing one swing would make your reaction time a large share of the reading; over 20 it hardly matters. Keep the angle small, so the swing stays simple harmonic.',
      select: 'knife',
      cites: [LAB('procedure')],
      check: {
        question: 'Moving the pivot nearer the centre of gravity, right up close, does what to the period?',
        options: ['It keeps shortening', 'It reaches a minimum, then lengthens', 'It does not change'],
        answer: 1,
        explain: 'T = 2π√((k² + h²)/(g h)) is least at **h = k**, one radius of gyration from G. Nearer than that, the restoring moment falls away faster than the inertia, and it **swings slower**.',
      },
    },
    {
      title: 'Bodies that cannot be swung',
      body: 'A casting with no pivot hole goes on a **platform hung from wires**. Twist it slightly and let go: the leaning wires lift it, and gravity brings it back. **I = m g r² T² / (4π² L)**, the same for two wires or three.',
      select: 'platform',
      params: { mode: 'bifilar', block: true },
      cites: [LAB('bifilar suspension')],
    },
    {
      title: 'Three wires for a disc',
      body: 'Three wires hold a flat platform steady. Time it **empty**, then with the body on: the body’s inertia is the difference. Its centre of mass must sit exactly on the axis.',
      select: 'block',
      params: { mode: 'trifilar', L: 0.65, r: 0.175, mPlatform: 2, mBlock: 6 },
      cites: [LAB('trifilar suspension')],
      check: {
        question: 'Lengthening the wires, with everything else the same, does what to the period?',
        options: ['Makes it longer', 'Makes it shorter', 'Leaves it alone'],
        answer: 0,
        explain: 'T = 2π√(I L / (m g r²)), so T grows with the **square root of L**. Longer wires lean less for the same twist, so the restoring torque is smaller.',
      },
    },
  ],
}

export default scene
