import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, useGreenhouse, type GreenhouseParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [66, 34, 26] as [number, number, number], target: [0, 1.5, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'greenhouse',
  title: 'Greenhouse',
  summary: 'A multi-span greenhouse for high-value crops. In the tropics, ventilation is the most important control to lower temperature, reduce humidity, and resupply CO₂.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 30,
  floorY: 0,
  hatchScale: 0.1,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 10 }] },
    { id: 'cutaway', label: 'Cutaway (sectioned)', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'roof-off', label: 'Roof off', planes: [{ normal: [0, -1, 0], pos: 2.8 }] },
  ],
  defaultPreset: 'none',
  cites: [C.aee505('p28–31 greenhouse, ventilation, errata')],
  reset: () => useGreenhouse.getState().reset(),
  applyParams: (p) => useGreenhouse.getState().set(p as Partial<GreenhouseParams>),
  tour: [
    {
      title: 'Greenhouse structure',
      body: 'Multi-span bays of **3.2 m** are cheapest. In the tropics, run the **ridge north–south** to reduce frame shading. Gutter height is **2.8–3.0 m** for multi-span, so machines can move.',
      camera: overview,
      cut: 'none',
      select: null,
      params: { ...DEFAULTS },
      cites: [C.aee505('p29')],
    },
    {
      title: 'Cladding options',
      body: 'Glass has **90 %** light transmission and is most durable. Polythene is cheap and lighter but degrades in UV. FRP (fibreglass) has **85 %** transmission and needs resealing every 4-5 years.',
      camera: { position: [10, 5, 0], target: [0, 2, 0] },
      select: 'cladding',
      cites: [C.aee505('p30')],
    },
    {
      title: 'Ventilation requirement',
      body: 'Ventilation keeps the temperature rise **< 4 °C**. The rate per m² of floor area is **0.04–0.05 m³/s** for glass, and **0.03–0.04 m³/s** for polythene (which passes long-wave radiation back out).',
      camera: overview,
      select: 'vents',
      params: { cladding: 'glass', qFans: 8 },
      cites: [C.aee505('p30')],
    },
    {
      title: 'Natural ventilation',
      body: 'Large end doors totalling **3–7 % of floor area** often give enough natural ventilation without mechanical fans.',
      camera: { position: [0, 2, 10], target: [0, 2, 0] },
      select: 'doors',
      params: { doorsOpen: true, qFans: 0 },
      cites: [C.aee505('p30')],
    },
    {
      title: 'Cooling and shading',
      body: 'When ventilation is not enough, evaporative cooling (pad and fan) or whitewash on the inside of the roof can provide shading in steady weather. Whitewash is cheap and washes off.',
      camera: { position: [-10, 5, 10], target: [0, 2, 0] },
      select: 'shading',
      params: { whitewash: true },
      cites: [C.aee505('p30-31')],
    },
  ],
}

export default scene
