import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, useBalance } from './model'
import { BalancingPanel, PRESETS } from './Panel'
import { Balancing3D, FLOOR } from './Scene3D'

const NOTE = (where: string) => cite('MEE306', 'Chapter 3 - Balancing Rotors.pdf', where)
const LAB = (where: string) => cite('MEE396', '396.pdf', where)
const view = { position: [1.15, 0.72, 2.75] as [number, number, number], target: [0, -0.06, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'balancing',
  title: 'Static & dynamic balancing rig',
  summary: 'Out-of-balance blocks on a sprung shaft: read the m r polygon, add one balance mass or two, and watch the plate stop shaking and stop rocking.',
  Viewport: Balancing3D,
  Panel: BalancingPanel,
  camera: view,
  extent: 1.6,
  floorY: FLOOR,
  hatchScale: 0.01,
  timeScale: 1 / 4,
  cutPresets: [{ id: 'mid', label: 'Along the shaft', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [NOTE('Examples'), LAB('dynamic balancing apparatus')],
  reset: () => useBalance.getState().reset(),
  applyParams: (p) => {
    const pr = p.preset ? PRESETS.find((x) => x.id === p.preset) : undefined
    if (pr) pr.apply()
    const rest = { ...p }
    delete rest.preset
    if (Object.keys(rest).length) useBalance.getState().set(rest as Partial<typeof DEFAULTS>)
  },
  tour: [
    {
      title: 'Out of balance',
      body: 'Each block has its mass off the axis, so at speed it pulls outward with **F = m r ω²**. Added together they don’t cancel, and the force goes round with the shaft: the plate shakes on its springs.',
      camera: view,
      cut: false,
      select: 'mass-0',
      explode: 0,
      playing: true,
      params: { preset: 'ex1' },
      cites: [NOTE('Analysis of unbalance')],
    },
    {
      title: 'The m r polygon',
      body: 'Draw each block’s **m r** nose to tail. The gap that’s left is the out-of-balance: **0.1266 kg·m at 26°** here. A mass placed **opposite** it closes the polygon: 3.16 kg at 40 mm radius, at 206°.',
      select: 'shaft',
      params: { correction: 'static' },
      cites: [NOTE('Example 1')],
      check: {
        question: 'Doubling the shaft speed multiplies the out-of-balance force by how much?',
        options: ['2 times', '4 times', '8 times'],
        answer: 1,
        explain: 'F = m r ω², so it goes with the **square of the speed**. This is why balance that was good enough at low speed can be dangerous at high speed.',
      },
    },
    {
      title: 'Why one mass is not enough',
      body: 'The force is gone, but the blocks are in different planes, so a **couple** remains and the plate still rocks. Two planes are needed to deal with both: **two-plane correction**.',
      select: 'plate',
      params: { correction: 'dynamic' },
      cites: [NOTE('Masses in different planes')],
      check: {
        question: 'A shaft is statically balanced. Is it then balanced when running?',
        options: ['Always', 'Not necessarily', 'Never'],
        answer: 1,
        explain: 'Static balance only puts the centre of mass on the axis. Equal masses at opposite ends can do that while still making a **couple**. A dynamically balanced shaft, though, is always statically balanced.',
        reveal: { params: { preset: 'crank' } },
      },
    },
    {
      title: 'A crankshaft',
      body: 'Mirror-image throws cancel both the force and the couple with nothing added. This is why a four-cylinder crankshaft is laid out as it is.',
      params: { preset: 'crankshaft' },
      select: null,
      cites: [LAB('crank-shaft model')],
    },
  ],
}

export default scene
