import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Inversions3D, InversionsPanel, useInv } from './Rig'

const INV = (where: string) => cite('MEE305', 'Inversion of Mechanisms.pdf', where)
const view = { position: [0.42, 0.24, 2.1] as [number, number, number], target: [0, -0.02, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'inversions',
  title: 'Inversions',
  summary: 'One chain of four links, four different machines: hold a different link still and an engine becomes a quick-return drive, an oscillating cylinder or a hand pump.',
  Viewport: Inversions3D,
  Panel: InversionsPanel,
  camera: view,
  extent: 1.2,
  floorY: FLOOR,
  hatchScale: 0.008,
  timeScale: 1,
  // through the connecting rod (z 0.039 to 0.061) and the crank; at 0.03 the rod lay wholly in front and vanished
  cutPresets: [{ id: 'mid', label: 'Through the links', planes: [{ normal: [0, 0, 1], pos: 0.05 }], sectionMoving: true }],
  cites: [INV('Inversions of the single and double slider crank chains')],
  reset: () => useInv.getState().reset(),
  applyParams: (p) => useInv.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'One chain',
      body: 'Four links: a **line of stroke**, a **crank**, a **rod** and a **slider**. Fix the line of stroke and you have an engine. This is the first of four inversions of the **single slider crank chain**.',
      camera: view,
      cut: false,
      select: 'guide',
      explode: 0,
      playing: true,
      params: { fixed: 'frame', n: 3 },
      cites: [INV('Single slider crank chain')],
    },
    {
      title: 'Hold the crank',
      body: 'Now the crank stands still, and the cylinder runs right round it. **Rotary aero engines** worked this way, and the **Whitworth quick return** comes from the same inversion.',
      select: 'crank',
      params: { fixed: 'crank' },
      cites: [INV('Second inversion')],
    },
    {
      title: 'Hold the rod',
      body: 'Fix the connecting rod and the cylinder rocks about a pin: an **oscillating cylinder** engine, and the **slotted lever** that gives a shaper its quick return.',
      select: 'rod',
      params: { fixed: 'rod' },
      cites: [INV('Third inversion')],
      check: {
        question: 'Going from one inversion to another, what stays the same?',
        options: ['The absolute motion of each link', 'The relative motion between links', 'Which link is the crank'],
        answer: 1,
        explain: 'The chain itself is unchanged, so its links move **relative to one another** exactly as before. Only what you measure against has changed, so the absolute motions look quite different.',
      },
    },
    {
      title: 'Hold the slider',
      body: 'Fix the piston and the cylinder moves up and down over it: a **hand pump**. Same four links, all four inversions.',
      select: 'slider',
      params: { fixed: 'slider' },
      cites: [INV('Fourth inversion')],
    },
    {
      title: 'Two sliders',
      body: 'Replace two turning pairs with sliders and you get the **double slider chain**. Fix the crossed guides and a point on the bar draws an ellipse: an **elliptical trammel**. Its other inversions are the scotch yoke and the Oldham coupling.',
      select: 'bar',
      params: { fixed: 'trammel' },
      cites: [INV('Double-slider crank chain')],
    },
  ],
}

export default scene
