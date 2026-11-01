import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Vessel3D, VesselPanel, useVessel } from './Rig'

const M7 = (where: string) => cite('MSE305', 'Module 7 - Pressure Vessels.pdf', where)
const view = { position: [1.1, 0.75, 2.5] as [number, number, number], target: [0, -0.05, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'pressure-vessel',
  title: 'Thin-walled pressure vessel',
  summary: 'Pressurise a thin cylinder and read its hoop and axial stresses, its strains and its change in volume, and see where thin-wall theory stops being true.',
  Viewport: Vessel3D,
  Panel: VesselPanel,
  camera: view,
  extent: 1.8,
  floorY: FLOOR,
  hatchScale: 0.012,
  timeScale: 1,
  defaultPreset: 'half',
  cutPresets: [
    { id: 'half', label: 'Lengthwise', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'across', label: 'Across', planes: [{ normal: [1, 0, 0], pos: 0 }] },
  ],
  cites: [M7('thin-walled vessels: Eqns 1–7')],
  reset: () => useVessel.getState().reset(),
  applyParams: (p) => useVessel.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Two directions of stress',
      body: 'Pressure pushes the wall outward, stretching it around the circumference, and pushes the ends apart, stretching it along its length. These are the **hoop** and **axial** stresses, and they are the principal stresses in the wall.',
      camera: view,
      cut: 'half',
      select: 'shell',
      explode: 0,
      params: { ...DEFAULTS },
      cites: [M7('Eqns 1–2')],
    },
    {
      title: 'Hoop is twice axial',
      body: 'Cut it lengthwise and two strips of wall hold the pressure on a rectangle: **σh = pr/t**. Cut it across and the whole ring holds the pressure on a circle: **σa = pr/2t**. So a pressure vessel, or a sausage, splits along its length.',
      cites: [M7('Eqns 1–2')],
      check: {
        question: 'A thin cylinder has a 100 MPa hoop stress. What is its axial stress?',
        options: ['25 MPa', '50 MPa', '100 MPa'],
        answer: 1,
        explain: 'σa = pr/2t is exactly **half** of σh = pr/t.',
      },
    },
    {
      title: 'When is thin thin?',
      body: 'These equations assume the stress is even through the wall, which is close enough while **r/t ≥ 10**. Below that, the inner surface takes noticeably more, and thick-wall analysis is needed.',
      params: { p: 40, r: 100, t: 20 },
      cites: [M7('thin-wall limit')],
    },
  ],
}

export default scene
