import type { SceneDef } from '@/modules/types'
import { ft } from '@/physics/structures'
import { C, DEFAULTS, useStorage, type StorageParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [-14, 20, 34] as [number, number, number], target: [6, 0, 6] as [number, number, number] }

const scene: SceneDef = {
  id: 'machinery-storage',
  title: 'Workshop & machinery storage',
  summary:
    'A combined building — workshop at one end, open-fronted machinery shed in the rest — sized around the tractor and its implements, with door clearances, workbench, lifting gear and fire kit, the drive, turning circle and parking in front, and a separate fuel store with its 15 m separation radius.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 60,
  floorY: 0,
  hatchScale: 0.3,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 30 }] },
    { id: 'roof', label: 'Roof off', planes: [{ normal: [0, 1, 0], pos: 3 }] },
    { id: 'plan', label: 'Plan at 1.5 m', planes: [{ normal: [0, 1, 0], pos: 1.5 }] },
    { id: 'long', label: 'Long section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  defaultPreset: 'none',
  cites: [C.ln('p21–27 drives, workshop, machinery and hazardous stores')],
  reset: () => useStorage.getState().reset(),
  applyParams: (p) => useStorage.getState().set(p as Partial<StorageParams>),
  tour: [
    {
      title: 'Workshop and shed together',
      body: 'A combined building: the **workshop** at one end, **machinery storage** in the rest. Pole frame, earth or gravel floor, sheet-metal walls, timber trusses and metal roofing keep it fire-resistant.',
      camera: overview,
      cut: 'none',
      select: null,
      params: { ...DEFAULTS },
      cites: [C.ln('p25–26')],
    },
    {
      title: 'Sized for the largest machine',
      body: 'The workshop holds the largest machine plus working space, behind a door wide and high enough for it, with a **second door** for fire escape. Watch the tractor drive in.',
      camera: { position: [-8, 6, 14], target: [-6, 1, 0] },
      select: 'workshop',
      cut: 'roof',
      cites: [C.ln('p24 i–ii')],
    },
    {
      title: 'Inside the workshop',
      body: 'A bench **1 m high, ≤ 800 mm deep, ≥ 3 m long** with a vice under the windows; lifting gear (timber beam up to **3 m** span, else a truss or hoist); lockable tool cabinets; an extinguisher or **2–3 buckets of sand**; the welder by the main door.',
      camera: { position: [-6, 7, 6], target: [-6, 1, -1] },
      select: 'bench',
      cut: 'roof',
      cites: [C.ln('p24–25')],
    },
    {
      title: 'The machinery shed',
      body: 'A narrow open-sided shed as high as the tallest machine. Sketch machine outlines and **mark the posts** so every machine can leave without moving another.',
      camera: { position: [6, 9, 14], target: [4, 1, 0] },
      select: 'shed',
      cut: 'roof',
      params: { drive: false },
      cites: [C.ln('p26')],
    },
    {
      title: 'Drives and the fuel store',
      body: 'A two-way drive of **16–20 ft**, a **40–50 ft** turning radius and **12 × 60 ft** stalls. More than **50 L diesel** or **10 L petrol** goes in a separate, bunded, vented store at least **15 m** from any other building.',
      camera: { position: [10, 30, 40], target: [14, 0, 8] },
      select: 'fuel-store',
      cut: 'none',
      params: { drive: true, driveW: ft(18), turnR: ft(45) },
      cites: [C.ln('p21–22, p27')],
    },
  ],
}

export default scene
