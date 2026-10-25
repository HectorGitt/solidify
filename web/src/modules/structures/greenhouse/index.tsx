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
      check: {
        question: 'This glass house has 413 m² of floor and needs 0.045 m³/s per m². With fans of 2.5 m³/s each, how many fans are needed?',
        options: ['6 fans', '8 fans', '19 fans'],
        answer: 1,
        explain: 'Q = 0.045 × 413 ≈ **18.6 m³/s**, and 18.6/2.5 = 7.4, which rounds **up** to 8 fans.',
      },
    },
    {
      title: 'Natural ventilation',
      body: 'Large end doors totalling **3–7 % of floor area** often give enough natural ventilation without mechanical fans.',
      camera: { position: [0, 2, 10], target: [0, 2, 0] },
      select: 'doors',
      params: { doorsOpen: true, qFans: 0 },
      cites: [C.aee505('p30')],
      check: {
        question: 'To ventilate this 413 m² house naturally, about how much total door opening is needed?',
        options: ['About 1–3 m²', 'About 40–60 m²', 'About 12–29 m²'],
        answer: 2,
        explain: 'Doors of **3–7 % of floor area**: 0.03 × 413 ≈ 12 m² to 0.07 × 413 ≈ 29 m².',
      },
    },
    {
      title: 'Cooling and shading',
      body: 'When ventilation is not enough, evaporative cooling (pad and fan) or whitewash on the inside of the roof can provide shading in steady weather. Whitewash is cheap and washes off.',
      camera: { position: [-10, 5, 10], target: [0, 2, 0] },
      select: 'shading',
      params: { whitewash: true },
      cites: [C.aee505('p30-31')],
      check: {
        question: 'In which weather does pad-and-fan evaporative cooling work best?',
        options: ['Hot and dry', 'Hot and humid', 'Cool and overcast'],
        answer: 0,
        explain: 'Evaporation cools the air only as far as there is room for more moisture: **dry air** can take up a lot of water and cool well, while humid air is already near saturation.',
      },
    },
  ],
}

export default scene
