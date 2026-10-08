import type { CameraPose, SceneDef } from '@/modules/types'
import { C, DEFAULTS, resetLive, useRoots, type RootParams } from './model'
import { RootCropsPanel } from './Panel'
import { RootCrops3D, resetScene } from './Scene3D'

const VIEW: CameraPose = { position: [1.5, 3.4, 6.2], target: [-1.6, 0.3, 0] }

const scene: SceneDef = {
  id: 'root-crops',
  title: 'Root-crop harvesters',
  summary:
    'The Farmland tractor drives a mounted digger across deformable soil. Choose the cassava digger-elevator (wedge blade with side discs, rod elevator faster than ground speed, agitators, depth wheels, overload clutch) or the groundnut digger-shaker that leaves the plants inverted in a windrow. Cut the soil to see the roots being lifted.',
  Viewport: RootCrops3D,
  Panel: RootCropsPanel,
  camera: VIEW,
  extent: 12,
  floorY: -0.4,
  hatchScale: 0.06,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'half', label: 'Centre-line section (soil and digger)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'row', label: 'Section beside the row', planes: [{ normal: [0, 0, 1], pos: 0.32 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [C.am('§20 root-crop harvesters, Fig 20.1'), C.am('§20 cassava digger-elevator'), C.am('§20 groundnut digger-shaker')],
  reset: () => {
    useRoots.getState().reset()
    resetLive()
    resetScene()
  },
  applyParams: (p) => useRoots.getState().set(p as Partial<RootParams>),
  tour: [
    {
      title: 'Lifting root crops',
      body: 'Roots grow in the soil, so the harvester must lift the soil with them and then get rid of it. The common parts are a **digging blade**, an inclined **elevator-shaker**, **disc coulters**, **agitators**, **depth wheels** and an **overload clutch**.',
      camera: VIEW,
      cut: 'half',
      select: 'digger',
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.am('§20')],
    },
    {
      title: 'Wedge and side discs',
      body: 'The cassava **wedge** runs under the ridge, to about **300 mm**, while the two **side discs** slice the ridge flanks. The section shows the tubers in the soil ahead of the blade.',
      camera: { position: [0.5, 1.0, 2.6], target: [-1.2, -0.05, 0] },
      select: 'blade',
      cut: 'half',
      cites: [C.am('§20 cassava digger-elevator')],
    },
    {
      title: 'Elevator faster than the ground',
      body: 'The **rod elevator** runs faster than the forward speed, so it pulls the slab apart and the soil falls between the rods; the **agitators** bounce it. Set **Elevator ÷ forward speed** below 1 in **Controls** to see soil carried off the end.',
      camera: { position: [-0.6, 2.0, 2.8], target: [-2.4, 0.3, 0] },
      select: 'elevator',
      cut: false,
      params: { ratio: 1.5, agitators: true },
      cites: [C.am('§20')],
    },
    {
      title: 'Depth wheels and overload clutch',
      body: 'The **depth wheels** run on the surface and hold the blade depth (set by hand or hydraulically). The **overload clutch** on the drive slips if a stone or stump jams the elevator.',
      camera: { position: [0.6, 1.6, 2.2], target: [-1.3, 0.5, 0.5] },
      select: 'depth-wheels',
      cites: [C.am('§20')],
    },
    {
      title: 'Groundnut digger-shaker',
      body: 'For groundnut a blade cuts under the pods; the plants are shaken clean and the **inverter** turns them over, pods up, into a windrow to dry. A cassava digger-elevator recovers about **85 %** of the roots; compare yields in **Controls**.',
      camera: { position: [-0.5, 2.6, 4.0], target: [-2.6, 0.2, 0] },
      select: 'inverter',
      cut: false,
      params: { ...DEFAULTS, machine: 'groundnut', depth: 0.12, yield: 1.5, ratio: 1.4 },
      cites: [C.am('§20 groundnut')],
    },
  ],
}

export default scene
