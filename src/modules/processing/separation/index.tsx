import type { SceneDef } from '@/modules/types'
import { P504 } from './cites'
import { DEFAULTS, useSeparation } from './model'
import { EXAM, SeparationPanel } from './Panel'
import { Separation3D } from './Scene3D'

const scene: SceneDef = {
  id: 'separation',
  title: 'Cleaning & separation',
  summary:
    'An oscillating screen cleaner, an aspirator (winnower) column, a cyclone with its double vortex and a sieve shaker — with screen effectiveness, Stokes and iterated terminal velocities, the cyclone separation factor and fineness modulus live.',
  Viewport: Separation3D,
  Panel: SeparationPanel,
  camera: { position: [1.6, 1.4, 2.4], target: [0, 0.6, 0] },
  extent: 3,
  floorY: 0,
  hatchScale: 0.02,
  timeScale: 1 / 4,
  cutPresets: [
    { id: 'half', label: 'Half section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
    { id: 'side', label: 'Side section', planes: [{ normal: [1, 0, 0], pos: 0 }] },
    { id: 'all', label: 'Section everything', planes: [{ normal: [0, 0, 1], pos: 0 }], sectionMoving: true },
  ],
  defaultPreset: 'half',
  cites: [P504.sep('Note 1 Separation'), P504.red('sieve analysis')],
  reset: () => useSeparation.getState().reset(),
  applyParams: (p) => {
    const pr = EXAM.find((x) => x.id === p.preset)
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useSeparation.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'Cleaning, sorting and grading',
      body: '**Cleaning** removes contaminants; **sorting** separates by one measurable property (size, shape, density, colour); **grading** judges overall quality. Dry methods: screening, aspiration, abrasion, magnets.',
      camera: { position: [2.5, 2.0, 4.0], target: [0.3, 0.6, 0] },
      cut: false,
      select: null,
      explode: 0,
      playing: true,
      params: { kind: 'all' },
      cites: [P504.sep('Definitions; Dry cleaning methods')],
    },
    {
      title: 'Screen cleaner',
      body: 'A perforated deck oscillates on leaf springs. Oversize rides over (**overflow A**), undersize falls through (**underflow B**). E = E_A·E_B compares what each stream should have got with what it did.',
      camera: { position: [1.4, 1.3, 2.0], target: [0, 0.6, 0] },
      cut: 'half',
      select: 'scalp-screen',
      params: { preset: 'q3b-is30' },
      cites: [P504.sep('The Screening Operation; eqs 1–9'), P504.pq('p3 Q3b')],
    },
    {
      title: 'Aspirator',
      body: 'Feed falls into a rising air stream. Set the air speed **between the terminal velocities** of chaff and grain: chaff and husks float off, grain falls, stones drop out.',
      camera: { position: [1.3, 1.4, 1.8], target: [0, 0.8, 0] },
      cut: 'half',
      select: 'aspirator-column',
      params: { kind: 'aspirator' },
      cites: [P504.sep('Air classifiers; Aerodynamics eqs 1–12')],
    },
    {
      title: 'Cyclone',
      body: 'Air and dust enter **tangentially** and spiral down the outer vortex; solids are flung to the wall (S = V²/gR) and leave at the cone; clean air rises up the inner vortex and out of the **vortex finder**.',
      camera: { position: [1.2, 1.4, 1.6], target: [0, 0.8, 0] },
      cut: 'half',
      select: 'vortex-finder',
      params: { kind: 'cyclone' },
      cites: [P504.sep('Cyclone separator eqs 13–17')],
    },
    {
      title: 'Sieve shaker',
      body: 'A 250 g sample shaken ≈ 5 min through IS sieves 100…15 and a pan. The masses retained give the **fineness modulus**, the average size D = 0.135(1.366)^FM mm and the **uniformity index**.',
      camera: { position: [0.8, 0.8, 1.1], target: [0, 0.4, 0] },
      cut: 'half',
      select: 'sieve-shaker',
      params: { preset: 'red-sieve' },
      cites: [P504.red('Methods of measuring size characteristics')],
    },
  ],
}

export default scene
