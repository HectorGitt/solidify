import type { SceneDef } from '@/modules/types'
import { prepareBoxesGeometry } from './geometry'
import { BALL, DEFAULTS, ST, WORM, useBoxes } from './model'
import { BoxesPanel } from './Panel'
import { Boxes3D } from './Scene3D'

const home = { position: [0.42, 0.36, 0.6] as [number, number, number], target: [0.07, -0.02, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'boxes',
  title: 'Steering boxes',
  summary:
    'Two steering boxes side by side and cut open: a recirculating-ball box (thread, ball nut, recirculating balls, peg and rocker arm) and a worm-and-peg box. One steering-wheel angle drives both; the drop arms swing about ±30°.',
  Viewport: Boxes3D,
  Panel: BoxesPanel,
  camera: home,
  extent: 0.7,
  floorY: -0.26,
  hatchScale: 0.003,
  timeScale: 1,
  cutPresets: [
    { id: 'both', label: 'Both boxes halved', planes: [{ normal: [0, 0, 1], pos: BALL.z }, { normal: [0, 0, -1], pos: -WORM.z }] },
    { id: 'ball', label: 'Ball box halved', planes: [{ normal: [0, 0, 1], pos: BALL.z }] },
    { id: 'peg', label: 'Worm box halved', planes: [{ normal: [0, 0, -1], pos: -WORM.z }] },
    { id: 'top', label: 'Plan section through the axes', planes: [{ normal: [0, 1, 0], pos: 0.0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: BALL.z }], sectionMoving: true },
  ],
  defaultPreset: 'both',
  cites: [ST('p3–4 (book pp92–93), Fig 46'), ST('p4 maintenance')],
  reset: () => useBoxes.getState().reset(),
  prepare: prepareBoxesGeometry,
  applyParams: (p) => useBoxes.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Two steering boxes',
      body:
        'The steering box turns the rotation of the steering column into a short swing of the **drop arm**, which pulls or pushes the drag link. Most tractors have a **recirculating-ball** box (front); some have a **worm-and-peg** box (behind). One steering-wheel angle drives both here.',
      camera: home,
      cut: 'both',
      select: null,
      explode: 0,
      playing: true,
      params: { sweep: true },
      cites: [ST('p3 (book p92)')],
    },
    {
      title: 'Thread (A) and nut (B)',
      body: 'The end of the steering column has a **thread (A)**. A **nut (B)** moves along the thread when the wheel turns; it cannot rotate because its peg sits in the rocker arm.',
      camera: { position: [0.12, 0.12, 0.34], target: [0, 0, BALL.z] },
      select: 'nut',
      cites: [ST('p3, Fig 46')],
    },
    {
      title: 'Recirculating balls',
      body:
        'Steel **balls** run in the grooves formed by the threads on the shaft and in the nut, so the nut rolls rather than slides — smooth, light steering. At the end of the nut the balls are picked up and returned through the **transfer tube**.',
      camera: { position: [0.06, 0.1, 0.27], target: [0, 0.005, BALL.z] },
      select: 'balls',
      cites: [ST('p3')],
    },
    {
      title: 'Peg (F), rocker arm (D) and shaft (E)',
      body: 'The nut is connected to the **rocker arm (D)** by the **peg (F)**. As the nut moves along the thread the rocker arm and **shaft (E)** rotate — about **30° backwards or forwards** — and the **drop arm** fixed to E pushes or pulls the drag link.',
      camera: { position: [0.18, -0.05, 0.38], target: [0, -0.06, BALL.z] },
      select: 'ball-rocker',
      cites: [ST('p3')],
    },
    {
      title: 'Worm and peg',
      body:
        'The worm-and-peg box works on a similar principle: the **shaft (A)** has a **thread (B)** and a **peg (C)** on the **rocker arm (D)** runs in it. Turning the wheel moves the peg along the thread and rotates the rocker shaft (E).',
      camera: { position: [0.22, 0.2, -0.5], target: [0, 0.02, WORM.z] },
      select: 'peg-c',
      cut: 'peg',
      cites: [ST('p3–4 (book pp92–93)')],
    },
    {
      title: 'Maintenance',
      body: 'Some steering boxes have a **level plug**: remove it every **200 hours** to check the oil — **SAE 90** is commonly used. Grease the steering linkage every **10 h** and the front-wheel bearings every **50 h**.',
      camera: { position: [0.25, 0.25, 0.4], target: [0.03, 0, BALL.z] },
      select: 'ball-oil',
      cut: 'ball',
      cites: [ST('p4 (book p93)')],
    },
    {
      title: 'Ratio',
      body: 'Open **Controls** to turn the wheel by hand and read the drop-arm angle and the steering ratio of each box. The drop arm swings about ±30°; the wheel turns and thread leads used here are typical values.',
      camera: home,
      select: null,
      params: { sweep: false, wheel: 360 },
    },
  ],
}

export default scene
