import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, RIG, useSmd, type SmdParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const home = { position: [0.78, 0.62, 1.18] as [number, number, number], target: [0, 0.33, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'smd',
  title: 'Spring–mass–damper lab',
  summary:
    'A mass on a spring and a viscous dashpot, integrated live with RK4. Change m, k and b to move between undamped, underdamped, critically damped and overdamped motion; apply a step or a sinusoidal force; measure the logarithmic decrement from the decaying peaks.',
  Viewport: Scene3D,
  Panel,
  camera: home,
  extent: 0.8,
  floorY: 0,
  hatchScale: 0.005,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'dashpot', label: 'Dashpot quarter cut', planes: [{ normal: [0, 0, 1], pos: 0 }, { normal: [1, 0, 0], pos: RIG.dashX }], intersection: true },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [C.m12('introduction to machine vibration'), C.ln('second-order systems, log decrement'), C.ms17('step response'), C.mg18()],
  reset: () => useSmd.getState().reset(),
  applyParams: (p) => useSmd.getState().set(p as Partial<SmdParams>),
  tour: [
    {
      title: 'The idealised vibrating system',
      body:
        'Every machine that vibrates can be modelled the same way: a **mass m**, a **spring k** and a **dashpot b**, with an applied force F(t). This rig makes that model real. The mass slides on two guide rods, so it has **one degree of freedom**.',
      camera: home,
      cut: 'half',
      select: null,
      playing: true,
      params: { ...DEFAULTS },
      cites: [C.m12('idealised mass M, spring k, dashpot b')],
    },
    {
      title: 'Spring: force ∝ displacement',
      body: 'The spring pushes back with **kx**. Its own mass is ignored (if not, add M_s/3 to m). With no damping the mass would oscillate for ever at **ω_n = √(k/m)**.',
      camera: { position: [-0.32, 0.38, 0.55], target: [RIG.springX, 0.22, 0] },
      select: 'spring',
      cites: [C.ln('equivalent spring-mass: M_e = M + M_s/3')],
    },
    {
      title: 'Dashpot: force ∝ velocity',
      body:
        'Cut open, the dashpot is a perforated **piston** in a cylinder of **oil**. As the mass moves, oil is forced through the holes and the pressure difference gives a force **bẋ**. This viscous damping turns vibration energy into heat.',
      camera: { position: [0.32, 0.3, 0.42], target: [RIG.dashX, 0.15, 0] },
      select: 'dashpot',
      cut: 'dashpot',
      cites: [C.m12('dashpot b')],
    },
    {
      title: 'Free vibration and the log decrement',
      body:
        'Released from x₀, the underdamped mass rings down. Successive peaks shrink by the same ratio, so **δ = ln(q₀/q₁) = (1/n) ln(q₀/qₙ)**. Here the amplitude falls to a quarter in five cycles: δ = 0.277, ζ = 0.044, b = 12.5 N·s/m. Open the Controls tab to see the chart.',
      camera: home,
      select: 'mass',
      cut: 'half',
      params: { m: 4, k: 5000, c: 12.5, mode: 'free', x0: 0.02 },
      cites: [C.ln('log decrement example')],
    },
    {
      title: 'Step input: overdamped',
      body:
        'The system **θ̈ + 10θ̇ + 16θ = 32u(t)** has ζ = 1.25. Its roots −2 and −8 are real, so the response creeps up to the final value 2 with no overshoot: θ = 2 + (2/3)e^(−8t) − (8/3)e^(−2t).',
      camera: home,
      select: 'exciter',
      params: { m: 1, c: 10, k: 16, mode: 'step', F0: 32 },
      cites: [C.q16(), C.ms17(), C.mg18()],
    },
    {
      title: 'Critical damping',
      body: 'At **b = c_c = 2√(km)** (ζ = 1) the mass returns to rest as fast as possible without overshooting. Less damping overshoots and oscillates; more is sluggish.',
      camera: home,
      select: 'dashpot',
      params: { m: 4, k: 5000, c: 282.8, mode: 'step', F0: 50 },
      cites: [C.ln('critically damped case')],
    },
    {
      title: 'Sinusoidal forcing near resonance',
      body:
        'The machine-on-a-cantilever example: F = 300 sin 8t with ω_n = 9.35 rad/s, so r = 0.86. With no damping the start-up transient never dies and beats with the forced motion. Try the **r** slider: at r = 1 the amplitude grows without limit; well above r = 1 it falls.',
      camera: home,
      select: 'mass',
      params: { m: 94.63, k: 8280, c: 0, mode: 'sine', F0: 300, w: 8 },
      cites: [C.ln('equivalent systems: unbalanced machine on a cantilever')],
    },
  ],
}

export default scene
