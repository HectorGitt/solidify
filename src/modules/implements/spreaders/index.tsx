import type { CameraPose, SceneDef } from '@/modules/types'
import { C, DEFAULTS, resetLive, useSpreader, type SpreaderParams } from './model'
import { PRESETS, SpreadersPanel } from './Panel'
import { Spreaders3D, resetScene } from './Scene3D'

const BC_VIEW: CameraPose = { position: [-5.2, 3.6, 6.4], target: [-1.6, 0.7, 0] }
const MS_VIEW: CameraPose = { position: [-6.4, 3.4, 5.8], target: [-3.2, 0.8, 0] }
void PRESETS

const scene: SceneDef = {
  id: 'spreaders',
  title: 'Fertilizer & manure spreaders',
  summary:
    'The Farmland tractor with a three-point spinning-disc broadcaster (hopper, agitator, feed gate and PTO-driven disc throwing a 6–9 m band) or a trailed apron-and-beater manure spreader (chain-and-slat apron driven by ratchet and pawl, beaters and spiral auger). Set the gate, speed and disc speed and see the rate per hectare change; work through a spinner calibration.',
  Viewport: Spreaders3D,
  Panel: SpreadersPanel,
  camera: BC_VIEW,
  follow: 'tractor',
  extent: 10,
  floorY: 0,
  hatchScale: 0.05,
  timeScale: 1 / 3,
  cutPresets: [
    { id: 'half', label: 'Centre-line section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'near', label: 'Near side removed', planes: [{ normal: [0, 0, 1], pos: 0.35 }] },
    { id: 'plan', label: 'Plan section through the hopper / box', planes: [{ normal: [0, 1, 0], pos: 1.2 }] },
  ],
  defaultPreset: 'half',
  cites: [C.am('§14.3.1 manure spreader, Fig 14.2'), C.am('§14.4.1 spinning-disc broadcaster'), C.am('§14.7 calibration of spinner')],
  reset: () => {
    useSpreader.getState().reset()
    resetLive()
    resetScene()
  },
  applyParams: (p) => useSpreader.getState().set(p as Partial<SpreaderParams>),
  tour: [
    {
      title: 'The spinning-disc broadcaster',
      body: 'A **cone hopper** sits over a **disc** driven from the PTO. Fertilizer runs through an adjustable **feed gate** onto the disc, and the vanes throw it out in a band about **6–9 m** wide.',
      camera: BC_VIEW,
      cut: 'half',
      select: 'broadcaster',
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.am('§14.4.1')],
    },
    {
      title: 'Hopper, agitator and gate',
      body: 'The hopper is plastic or fibreglass because fertilizer is corrosive. An **agitator** turns in the outlet so the material does not bridge; the **shutter** under it sets the flow. Open the gate in **Controls** and watch the rate rise.',
      camera: { position: [-2.4, 1.6, 1.6], target: [-1.55, 0.9, 0] },
      select: 'gate',
      cut: 'half',
      params: { gate: 0.6 },
      cites: [C.am('§14.4.1')],
    },
    {
      title: 'Disc speed sets the width',
      body: 'Granules land near the disc centre, slide out along the vanes and leave at about **√2 × tip speed**. A slower disc throws them a shorter distance — the band narrows and the yellow bout lines show where strips would be missed.',
      camera: { position: [-4.0, 5.5, 0.01], target: [-4.0, 0, 0] },
      select: 'disc',
      cut: false,
      params: { discRpm: 250, gate: 0.4 },
      cites: [C.am('§14.4.1 — rate depends on disc speed')],
    },
    {
      title: 'The manure spreader',
      body: 'A trailed box whose floor is an endless **chain-and-slat apron**. It carries the load slowly back into the **lower and upper beaters**, which shred it; the **spiral auger** throws it sideways. The lower beater turns opposite to the wheels at **6–7 × wheel speed**.',
      camera: MS_VIEW,
      select: 'manure-spreader',
      cut: 'near',
      params: { ...DEFAULTS, machine: 'manure' },
      cites: [C.am('§14.3.1, Fig 14.2')],
    },
    {
      title: 'Ratchet and pawl: rate control',
      body: 'An eccentric on the wheel hub rocks the **pawl**, which advances the **ratchet** a few teeth each turn. The apron speed sets the volume spread — more teeth per stroke, more manure per hectare. With ground drive the rate stays the same at any forward speed.',
      camera: { position: [-3.0, 1.4, 2.6], target: [-4.1, 0.6, 0.7] },
      select: 'ratchet',
      cut: false,
      params: { machine: 'manure', teeth: 3 },
      cites: [C.am('§14.3.1')],
    },
  ],
}

export default scene
