import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, T, useSeat, type SeatState } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const home = { position: [-1.6, 2.1, 3.6] as [number, number, number], target: [0.3, 1.0, 0] as [number, number, number] }
const seatView = { position: [-0.9, 1.65, 1.5] as [number, number, number], target: [T.seatX, T.platformY + 0.3, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'seat',
  title: 'Tractor seat model',
  summary:
    'A tractor crossing rough ground bounces and pitches on its tyres; a suspended seat (operator m₁ on the cushion, seat m₂ on a spring–damper suspension with stops) filters that floor motion. The two-DOF seat is integrated live and its acceleration is compared band by band with the ISO 2631 boundaries.',
  Viewport: Scene3D,
  Panel,
  camera: home,
  extent: 3.2,
  floorY: -0.2,
  hatchScale: 0.02,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'centre', label: 'Section through the seat', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'centre',
  cites: [C.he('§10.4 vibration, §10.7 operator seating, eq 9–18, Figs 10.6, 10.9, 10.10'), C.ln('vibration isolation')],
  reset: () => useSeat.getState().reset(),
  applyParams: (p) => useSeat.getState().set(p as Partial<SeatState>),
  tour: [
    {
      title: 'Why tractor seats need suspension',
      body:
        'A wheeled tractor has no springs except its tyres. Over rough ground it bounces and pitches at roughly **3–10 Hz** — and people are most sensitive at **4–8 Hz** (the viscera resonate at 4–5 Hz). The seat suspension is the operator’s only protection.',
      camera: home,
      cut: 'centre',
      select: null,
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.he('p10–11 frequency facts')],
    },
    {
      title: 'The input: floor motion',
      body:
        'Front and rear wheels meet the same bumps one wheelbase apart, so the body both **bounces** and **pitches**. The platform under the seat moves by **z_input = z_t + Rθ**: bounce plus pitch times the distance from the centre of gravity.',
      camera: { position: [0.5, 1.4, 3.6], target: [0.6, 0.6, 0] },
      select: 'platform',
      cites: [C.he('eq 11–12')],
    },
    {
      title: 'Two-degree-of-freedom seat',
      body:
        'The **seat m₂** rides on the suspension spring **k₂** and damper **c₂**, guided by a scissor linkage and limited by **stops**. The **operator m₁** sits on the **cushion** (k₁, c₁). The model is integrated live with RK4.',
      camera: seatView,
      select: 'suspension',
      cites: [C.he('Fig 10.9')],
    },
    {
      title: 'Tune the seat below the tractor',
      body:
        'Transmissibility is below 1 only when **ω_t/ω_s > 1.414**. With ω_s = 1.5 Hz the tractor’s ≈3 Hz bounce is at a ratio of about 2, and the operator moves less than the floor. A transmissibility of **0.5–0.65** is considered satisfactory.',
      camera: seatView,
      select: 'seat-spring',
      params: { ...DEFAULTS },
      cites: [C.he('eq 14–17, Fig 10.10')],
    },
    {
      title: 'A seat tuned to the tractor is worse than none',
      body: 'Stiffen the suspension to 3 Hz with little damping and ω_t/ω_s ≈ 1: the seat resonates. Watch the operator — and the ISO chart in the Controls tab — compared with a rigid seat.',
      camera: seatView,
      select: 'operator',
      params: { ...DEFAULTS, fs: 3, zs: 0.1 },
      cites: [C.he('importance of damping near ω_t/ω_s = 1')],
    },
    {
      title: 'Stops and nonlinearity',
      body:
        'Fast over ploughed ground, a soft seat runs out of travel and **hits its stops**, giving sharp jolts. Friction, stops and nonlinear cushions are why real seat transmissibility is measured in the laboratory rather than taken from the linear one-DOF formula.',
      camera: seatView,
      select: 'stops',
      params: { ...DEFAULTS, ground: 'ploughed', V: 15, fs: 1.0, zs: 0.1 },
      cites: [C.he('p20: true transmissibility is more complex')],
    },
    {
      title: 'Against ISO 2631',
      body:
        'The operator’s acceleration in each one-third-octave band is compared with the **fatigue-decreased proficiency** boundary of ISO 2631 for the working day. The panel reports the band that limits exposure and how many hours are allowed.',
      camera: home,
      select: 'operator',
      params: { ...DEFAULTS },
      cites: [C.he('Fig 10.6, eq 18')],
    },
  ],
}

export default scene
