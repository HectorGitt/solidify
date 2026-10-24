import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, resetLive, useCombine, type CombineParams } from './model'
import { CombinePanel, PRESETS } from './Panel'
import { Combine3D } from './Scene3D'

const cam = { position: [2.6, 4.2, 10.8] as [number, number, number], target: [0.7, 1.35, 0] as [number, number, number] }
const preset = (id: string) => PRESETS.find((p) => p.id === id)!.params

const scene: SceneDef = {
  id: 'combine',
  title: 'Combine harvester',
  summary:
    'A self-propelled combine cut open along its centre line. Follow the crop through the header (reel, cutter bar, auger), the feeder, the threshing cylinder and concave, the straw walkers and the cleaning shoe, and the clean grain up into the tank. Set the cylinder speed, concave clearance and fan, and work out the machine’s capacity.',
  Viewport: Combine3D,
  Panel: CombinePanel,
  camera: cam,
  extent: 10,
  floorY: 0,
  hatchScale: 0.06,
  timeScale: 1 / 6,
  cutPresets: [
    { id: 'half', label: 'Centre-line section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'panel', label: 'Near side sheet removed', planes: [{ normal: [0, 0, 1], pos: 0.7 }] },
    { id: 'plan', label: 'Plan section above the walkers', planes: [{ normal: [0, 1, 0], pos: 2.0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [C.am('§19 Combined harvester-thresher, Figs 19.1–19.3, Table 19.1'), C.am('§18.4–18.5 threshing'), C.exam1920('capacity question'), C.exam5('capacity question'), C.mgmt('p7–8 field capacity')],
  reset: () => {
    useCombine.getState().reset()
    resetLive()
  },
  applyParams: (p) => useCombine.getState().set(p as Partial<CombineParams>),
  tour: [
    {
      title: 'Four machines in one',
      body: 'A **combine** (combined harvester-thresher) does in one pass what a reaper, a thresher and a winnower do separately. It has four units: **cutting and conveying**, **threshing**, **separating and cleaning**, and **grain delivery**.\n\nThe output of each unit must match the input of the next, or the machine chokes.',
      camera: cam,
      cut: 'half',
      select: null,
      explode: 0,
      playing: true,
      timeScale: 1 / 6,
      params: { ...DEFAULTS },
      cites: [C.am('§19.1–19.2, Fig 19.1')],
    },
    {
      title: 'Cutting: reel, knife and cutter bar',
      body: 'The **reel** holds the standing crop against the **knife**, which shears it on the **cutter bar** like a mower. A combine’s size is its cutter-bar width — this one has a **6 m header**. Too high a knife speed, or crop that is too dry, shatters grain at the header.',
      camera: { position: [7.4, 2.0, 4.0], target: [4.4, 0.5, 0.5] },
      select: 'reel',
      cites: [C.am('§19.2–19.4')],
    },
    {
      title: 'Header auger and feeder',
      body: 'The **header auger**’s opposite-hand flights draw the cut crop in from both ends to the centre, where fingers push it into the **feeder house**. A **chain-and-slat elevator** drags it up the feeder floor to the cylinder, ear-head first. Some headers use a belt conveyor instead.',
      camera: { position: [5.6, 2.4, 3.6], target: [3.3, 0.7, 0] },
      select: 'header-auger',
      cites: [C.am('§19.2, Fig 19.2')],
    },
    {
      title: 'Threshing: cylinder and concave',
      body: 'The rasp-bar **cylinder** beats and rubs the crop against the slotted **concave**. Grain and chaff fall through the slots; the straw is thrown back by the **beater**. Watch the concave move when you change the clearance in the Controls tab.',
      camera: { position: [2.6, 1.7, 2.3], target: [1.9, 1.25, 0] },
      select: 'cylinder',
      explode: 0,
      cites: [C.am('§18.4, §19.2')],
    },
    {
      title: 'Separating: straw walkers',
      body: 'The **straw walkers** ride on two crankshafts, each walker out of phase with its neighbour. The straw is tossed and carried to the rear and out of the machine; loose grain falls through to the **return pan**.',
      camera: { position: [-0.4, 2.6, 4.2], target: [-0.8, 1.4, 0] },
      select: 'walkers',
      cut: 'panel',
      cites: [C.am('§19.2')],
    },
    {
      title: 'Cleaning: sieves and fan',
      body: 'The grain and return pans shake everything onto the **chaffer**. The sieves reciprocate, and the **fan** blows through them: the light chaff is blown out at the back, the heavier grain falls through the **lower sieve** to the clean-grain auger.',
      camera: { position: [1.4, 1.2, 3.0], target: [0.4, 0.75, 0] },
      select: 'shoe',
      cut: 'half',
      cites: [C.am('§18.4, §19.2')],
    },
    {
      title: 'Grain delivery and tailings',
      body: 'The **clean-grain auger** and elevator lift the grain into the **tank**; the **unloading auger** swings out to empty it. Unthreshed heads that drop off the end of the sieves go to the **tailings auger** and back to the cylinder for a second threshing.',
      camera: { position: [3.5, 4.6, -6.5], target: [0.2, 1.8, -0.8] },
      select: 'tail-auger',
      cut: false,
      cites: [C.am('§19.2, Fig 19.3')],
    },
    {
      title: 'Setting up: cylinder, concave and fan',
      body: 'Overall performance depends on adjusting each unit. Here the cylinder is **too fast** and the concave **too close**: grain is **cracked**. Too slow or too wide leaves **unthreshed heads**; too little air leaves **unclean grain**. Try the cylinder speed, concave clearance and fan sliders in **Controls**.',
      camera: { position: [2.6, 1.7, 2.3], target: [1.9, 1.25, 0] },
      select: 'concave',
      cut: 'half',
      params: preset('cracked'),
      cites: [C.am('§18.5, §19.3, Table 19.1')],
    },
    {
      title: 'Capacity of the combine',
      body: 'Open **Controls**. **Area capacity** is land per hour (ha/h); **commodity throughput** is the product per hour; **total throughput** is all the material through the machine. For the SANDEL example: 7500 t ÷ 510 h = **14.7 t/h** of maize, 10,000 t ÷ 510 h = **19.6 t/h** in total, and 500 ha ÷ 510 h = **0.98 ha/h** (1.01 ha/h on the full 6 m).',
      camera: cam,
      select: null,
      params: preset('sandel'),
      cites: [C.exam1920('capacity question'), C.mgmt('p7–8')],
    },
  ],
}

export default scene
