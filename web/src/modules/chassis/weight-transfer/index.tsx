import { SRC, cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, useWT } from './model'
import { WTPanel } from './Panel'
import { Scene3D } from './Scene3D'

const side = { position: [0.2, 1.5, 6.4] as [number, number, number], target: [-0.3, 0.7, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'weight-transfer',
  title: 'Weight transfer',
  summary:
    'The Farmland tractor pulling through its drawbar on a slope: live front and rear wheel loads, the pull that lifts the front, the tractive coefficient the tyres must develop, and the “raise the front” method for finding the CG height.',
  Viewport: Scene3D,
  Panel: WTPanel,
  camera: side,
  extent: 6.5,
  floorY: -0.06,
  hatchScale: 0.04,
  timeScale: 1 / 2,
  cutPresets: [
    { id: 'side', label: 'Side section (centre line)', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'plan', label: 'Plan at axle height', planes: [{ normal: [0, 1, 0], pos: 0.64 }] },
  ],
  cites: [SRC.mac502('Ch 6, eqs 6.1–6.8; App. II'), SRC.hitch502('weight transfer'), SRC.l27('p22 RWD = RWS + P·Dh/Wb')],
  reset: () => useWT.getState().reset(),
  applyParams: (p) => useWT.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Where the weight sits',
      body:
        'Standing still on level ground the Farmland tractor carries **8.0 kN** on the front axle and **19.9 kN** on the rear: the CG (yellow ball) is 0.54 m ahead of the rear axle, about 30 % of the 1.88 m wheelbase. The thin grey arrows mark these static loads.',
      camera: side,
      select: 'cg',
      cut: false,
      playing: true,
      params: { ...DEFAULTS, pull: 0 },
      cites: [SRC.mac502('App. II; eq 6.1')],
    },
    {
      title: 'Pulling moves weight back',
      body:
        'The pull **P** acts at the drawbar pin, y′ = 0.45 m up and x′ = 0.60 m behind the rear contact. Its moment about the rear contact lifts weight off the front and puts it on the rear: **Vf** (blue) shrinks and **Vr** (green) grows.',
      camera: { position: [-1.5, 1.2, 5.0], target: [-0.2, 0.5, 0] },
      select: 'drawbar',
      params: { pull: 14, theta: 5 },
      cites: [SRC.mac502('eqs 6.4–6.5')],
    },
    {
      title: 'The short form',
      body:
        'With a horizontal pull on level ground the transfer is simply **ΔW = P·h/L**. For example, 12 kN at 580 mm on a 2083 mm wheelbase moves **3.34 kN**, leaving 5.66 kN on the front and 22.84 kN on the rear.',
      camera: side,
      select: null,
      params: { chassis: 'exam', pull: 12, theta: 0, alpha: 0, yd: 0.58 },
      cites: [cite('AEE510', 'WhatsApp Image 2025-07-24 at 11.15.32 (2022/23 final exam)', 'Q2c')],
    },
    {
      title: 'Slopes add to it',
      body:
        'Up a slope the weight component W sin α acts at the CG height r + yg and moves still more weight to the rear. Standing on a 10° slope with no pull, the front carries only **5.92 kN**. The purple arrow is the gross traction H the rear tyres must supply.',
      camera: { position: [1.0, 1.8, 6.6], target: [0, 0.8, 0] },
      params: { chassis: 'farmland', alpha: 10, pull: 6, theta: 5, yd: 0.45 },
      cites: [SRC.mac502('eqs 6.4, 6.8; Problem 6.6')],
    },
    {
      title: 'Front lift — instability',
      body:
        'Raise the drawbar and pull hard and **Vf reaches zero**: the front lifts, steering is lost and the tractor starts to rear over the rear axle. Here y′ = 0.85 m: the front lifts at about 17.8 kN on level ground.',
      camera: { position: [0.8, 1.4, 5.6], target: [0.2, 0.8, 0] },
      params: { alpha: 0, yd: 0.85, pull: 19, theta: 0 },
      cites: [SRC.mac502('eq 6.4, instability at Vf = 0')],
    },
    {
      title: 'Finding the CG height',
      body:
        'Weighing level gives only **xr**. Raise the front onto a platform and weigh again: the front reading **W′f** falls because the CG is above the axle line. The two readings and the tilt β then give **yg**.',
      camera: { position: [2.6, 1.6, 5.4], target: [0.6, 0.8, 0] },
      select: 'scale',
      params: { mode: 'cg', lift: 1.3, yd: 0.45 },
      cites: [SRC.mac502('eqs 6.1–6.3')],
    },
    {
      title: 'Try it',
      body: 'Open **Controls**: change the slope, pull, pull angle and drawbar position, or switch the mode to find the CG. The Working section shows every equation with your numbers.',
      camera: side,
      select: null,
      params: { ...DEFAULTS },
    },
  ],
}

export default scene
