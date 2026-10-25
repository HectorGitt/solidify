import { SRC } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, HFS, useStab } from './model'
import { StabPanel } from './Panel'
import { Scene3D } from './Scene3D'

const side = { position: [-0.6, 1.9, 7.2] as [number, number, number], target: [-0.6, 0.9, 0] as [number, number, number] }
const rearView = { position: [6.0, 2.2, -0.6] as [number, number, number], target: [0.6, 0.9, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'stability',
  title: 'Slopes & overturning',
  summary:
    'How steep a slope the Farmland tractor can climb or descend, and when it rears over backwards: ψ′ = tan α + (tan αs − tan α)/h, with the drawbar hitched too high or a chain on the top-link pin. Side-slope rollover and ROPS facts for context.',
  Viewport: Scene3D,
  Panel: StabPanel,
  camera: side,
  extent: 8,
  floorY: -0.06,
  hatchScale: 0.05,
  timeScale: 1 / 2,
  cutPresets: [{ id: 'side', label: 'Side section (centre line)', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [SRC.mac502('Ch 6, eqs 6.9–6.10, 6.35; Figs 6.8–6.9; Problem 6.16'), SRC.he510('p20–21 overturns, ROPS'), HFS('p49–52')],
  reset: () => useStab.getState().reset(),
  applyParams: (p) => useStab.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'Pulling a stuck load',
      body:
        'The tractor is chained to a stump from its normal drawbar (y′ = 0.45 m). The pull rises until something gives. Here the **tyres slip** first: the front never comes close to lifting.',
      camera: side,
      select: 'stump',
      cut: false,
      playing: true,
      params: { ...DEFAULTS, mode: 'rear', hitchPoint: 'drawbar' },
      cites: [SRC.mac502('eq 6.35')],
    },
    {
      title: 'The overturn condition',
      body:
        'The front lifts when the tyres develop **ψ′ = tan α + (tan αs − tan α)/h**, with tan αs = xr/(r + yg) = 0.71 and h = y′/(r + yg). For the normal drawbar h = 0.59 and ψ′ must reach 1.2 on level ground — more than any field soil gives.',
      cites: [SRC.mac502('eq 6.35; h 0.6 typical, 0.7–0.8 dangerous')],
      check: {
        question: 'Pulling uphill from the same drawbar, how does the ψ′ needed to lift the front change?',
        options: ['It rises, so rearing gets harder', 'It falls, so rearing gets easier', 'It stays at 1.2'],
        answer: 1,
        explain: 'With h = 0.59 the term (tan αs − tan α)/h falls faster than tan α rises, so the **ψ′** needed drops: about 1.08 on a 10° slope instead of 1.2. Pulling uphill brings rearing closer.',
        reveal: { params: { alpha: 10 } },
      },
    },
    {
      title: 'Hitched too high',
      body:
        'On a soil with c = 2 kPa and φ = 32° the tyres give ψ′ ≈ 0.63. The drawbar height that tips the tractor before the soil shears is y′ = W·xr/(Ac + W tan φ) = **0.85 m**. Just above it, the front lifts and the tractor **rears over**.',
      camera: { position: [0.8, 1.8, 6.6], target: [0, 1.0, 0] },
      select: 'drawbar',
      params: { mode: 'rear', hitchPoint: 'custom', yd: 0.87, alpha: 0 },
      cites: [SRC.mac502('Problem 6.16')],
      check: {
        question: 'On the same soil, what happens if the drawbar is lowered from 0.87 m to 0.6 m?',
        options: ['The front lifts at a smaller pull', 'The tyres slip before the front lifts', 'The front lifts at the same pull'],
        answer: 1,
        explain: 'Lowering y′ cuts h, so the front would need **ψ′** ≈ 0.9 to lift, more than the 0.63 this soil can give: the tyres shear the soil and slip first.',
        reveal: { params: { mode: 'rear', hitchPoint: 'custom', yd: 0.6, alpha: 0 } },
      },
    },
    {
      title: 'Never tow from the top link',
      body:
        'A chain on the top-link pin pulls from about 0.9 m: h ≈ 1.2 and the front lifts at a pull the tyres easily give. The rotation is fast — the driver has about a second. The **ROPS** frame and seat belt are the last defence.',
      select: 'tractor-top-link',
      params: { mode: 'rear', hitchPoint: 'toplink' },
      cites: [SRC.mac502('eq 6.35'), SRC.he510('p20–21 ROPS')],
      check: {
        question: 'Chained to the top-link pin instead of the drawbar, on the same soil, the tractor will…',
        options: ['Slip its tyres at a lower pull', 'Rear over before the tyres slip', 'Behave the same; only the pull matters'],
        answer: 1,
        explain: 'With h ≈ 1.2 the front lifts once the tyres develop **ψ′** = 0.71/1.18 ≈ 0.60, less than the 0.63 the soil can give, so the tractor rears before the tyres slip.',
      },
    },
    {
      title: 'Slope limits',
      body:
        'Climbing, the rear wheels must supply W sin α plus rolling resistance while weight shifts onto them: tan αu = (ψ′xf − ρx)/(x − ψ′(r + yg)). Past that slope the tyres spin; the static overturn slope αs ≈ 35° is much steeper.',
      camera: { position: [1.0, 2.6, 7.4], target: [0.2, 1.2, 0] },
      select: null,
      params: { mode: 'slope', alpha: 15 },
      cites: [SRC.mac502('eqs 6.9–6.10, Figs 6.8–6.9')],
    },
    {
      title: 'Side slopes and ROPS',
      body:
        'Overturns cause about **53 %** of tractor fatalities. ROPS (ASAE S383, S310.2) became compulsory on tractors over 20 hp with hired operators from 1976. Side tipping here is a static, rigid-axle estimate; a pivoting front axle and any motion make the real limit lower.',
      camera: rearView,
      select: 'tractor-rops',
      params: { mode: 'side', beta: 20 },
      cites: [SRC.he510('p20–21'), HFS('p49, p52')],
    },
    {
      title: 'Try it',
      body: 'Open **Controls**: move the hitch height, slope and the ψ′ the soil can give, and watch the overturn chart decide between slipping and rearing.',
      camera: side,
      select: null,
      params: { ...DEFAULTS },
    },
  ],
}

export default scene
