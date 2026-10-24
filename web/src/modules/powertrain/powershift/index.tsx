import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { CS_Y, IDLER, ST } from './dims'
import { CIRCUIT, PACKS, preparePSGeometry } from './geometry'
import { DEFAULTS, idealOverlap, resetShift, usePS, type PSParams } from './model'
import { PowershiftPanel } from './Panel'
import { PowershiftScene3D } from './Scene3D'

type V3 = [number, number, number]
const home = { position: [0.95, 0.32, 0.85] as V3, target: [0.06, -0.07, 0.22] as V3 }
const at = (z: number, y = 0, d = 0.42) => ({ position: [d, y + 0.12, z + d * 0.55] as V3, target: [0, y, z] as V3 })

const scene: SceneDef = {
  id: 'powershift',
  title: 'Hydraulic-assist (powershift)',
  summary:
    'A high-low-reverse countershaft unit with three hydraulic clutch packs. The gears stay in constant mesh; the shift valve sends oil to the clutch that is wanted, and High ↔ Low changes on the go without interrupting the power. The open-centre oil circuit — screen, pump, filter and relief valve, pressure regulator, lubrication and control routes — runs with live oil flow.',
  Viewport: PowershiftScene3D,
  Panel: PowershiftPanel,
  camera: home,
  extent: 0.85,
  floorY: -0.28,
  hatchScale: 0.0055,
  timeScale: 1 / 20,
  cutPresets: [
    { id: 'side', label: 'Through the shafts', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'plan', label: 'Plan, above the countershaft', planes: [{ normal: [1, 0, 0], pos: 0 }, { normal: [0, 1, 0], pos: CS_Y + 0.03 }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [1, 0, 0], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'side',
  cites: [SRC.pt510('p4–6 — hydraulic-assist transmission, clutch packs, shift-oil circuit'), SRC.tts510('p5 — change on the move'), SRC.m503(8, 'clutch capacity')],
  reset: () => {
    usePS.getState().reset()
    resetShift()
  },
  prepare: preparePSGeometry,
  applyParams: (p) => usePS.getState().set(p as Partial<PSParams>),
  tour: [
    {
      title: 'Shifting without letting go',
      body:
        'In a **hydraulic-assist** (powershift) transmission the gears are kept in **constant mesh**. Hydraulic **clutch packs** route the power to the gears that are wanted, so the operator can change speed **on the go without interrupting the flow of power**. Parts carrying power are drawn orange.',
      camera: home,
      cut: 'side',
      select: null,
      explode: 0,
      playing: true,
      params: { ...DEFAULTS },
      cites: [SRC.pt510('p4')],
    },
    {
      title: 'A clutch pack',
      body:
        'Alternating **friction disks** and steel **plates**: here the disks are splined to the **drum** and the plates to the **hub**. Pressure oil pushes the **piston** against the pack and clamps disks and plates together, locking drum to hub. Release the pressure and the return spring frees them.',
      camera: at(PACKS.L.z0 + 0.03, -0.05, 0.32),
      select: 'pack-L',
      cut: 'all',
      cites: [SRC.pt510('p4 — clutch pack')],
    },
    {
      title: 'High: the direct clutch',
      body: 'With the **direct-drive clutch** applied, input and output shafts are locked together and turn at the same speed: high, 1 : 1. The countershaft idles along in mesh.',
      camera: at(PACKS.H.z0 + 0.02, 0, 0.36),
      select: 'pack-H',
      cut: 'side',
      params: { sel: 'H' },
      cites: [SRC.pt510('p4 — high-low countershaft, direct drive')],
    },
    {
      title: 'Low: through the countershaft',
      body:
        'Apply the **underdrive clutch** (and release the direct one): power goes from the input gear down to the **countershaft** and back up to the low gear, which the clutch locks to the output. Two meshes — same direction, slower. Watch the oil fill one pack as the other drains.',
      camera: at(ST.d, CS_Y / 2, 0.5),
      select: 'countershaft',
      params: { sel: 'L' },
      cites: [SRC.pt510('p4 — underdrive clutch')],
    },
    {
      title: 'Reverse: one more mesh',
      body: 'The **reverse clutch** takes power through the countershaft and a **reverse idler**, so the output turns the opposite way to the input. The tractor is brought to rest before it reverses. High-low-reverse needs **three clutches**.',
      camera: { position: [IDLER.x + 0.35, IDLER.y + 0.15, ST.f + 0.3], target: [IDLER.x / 2, IDLER.y / 2, ST.f] },
      select: 'reverse-countershaft',
      params: { sel: 'R' },
      cites: [SRC.pt510('p4 — reverse unit, high-low-reverse')],
    },
    {
      title: 'The shift-oil circuit',
      body:
        'Oil is drawn from the transmission case through a **screen** by the **pump**, through a **filter** guarded by a **relief valve**, to a **pressure-regulator valve** (the pump is open-centre). From there oil flows two ways: a **lubrication route** and a **control route** to the **shift valve**, which sends it to the selected clutch.',
      camera: { position: [0.75, 0.05, 0.55], target: [CIRCUIT.filter.x - 0.05, -0.03, 0.15] },
      select: 'oil-circuit',
      params: { sel: 'H', flows: true },
      cites: [SRC.pt510('p6 — hydraulic shift controls')],
    },
    {
      title: 'Overlap: timing the hand-over',
      body:
        'Open **Controls** and flip **High ↔ Low**. The on-coming clutch fills while the off-going one still holds; when the new clutch can carry the engine torque the old one lets go. Release **too early** and the power drops out while the engine flares; **too late** and the clutches fight. The chart shows the output torque through the shift.',
      camera: home,
      select: null,
      params: { sel: 'L', overlap: idealOverlap(DEFAULTS.fill, DEFAULTS.torque) },
      cites: [SRC.pt510('p4'), SRC.beyond('overlapping-clutch shift dynamics')],
    },
  ],
}

export default scene
