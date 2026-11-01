import { cite } from '@/content/citations'
import type { SceneDef } from '@/modules/types'
import { DEFAULTS, FLOOR, Recip3D, RecipPanel, useRecip } from './Rig'

const NOTE = (where: string) => cite('MEE306', 'Chapter 4 - Balancing Reciprocating Masses.pdf', where)
const EQ = (where: string) => cite('MEE306', 'Chapter 2 - Dynamic Equivalence.pdf', where)
const view = { position: [1.25, 0.6, 2.05] as [number, number, number], target: [0, 0.08, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'reciprocating',
  title: 'Reciprocating balance',
  summary: 'Pistons shake an engine with primary and secondary forces. Trade them with a counterweight, or cancel them with more cylinders, on a rubber-mounted engine you can watch.',
  Viewport: Recip3D,
  Panel: RecipPanel,
  camera: view,
  extent: 1.2,
  floorY: FLOOR,
  hatchScale: 0.008,
  timeScale: 1 / 50,
  cutPresets: [{ id: 'mid', label: 'Across the cylinders', planes: [{ normal: [0, 0, 1], pos: 0 }] }],
  cites: [NOTE('4.1–4.4'), EQ('Summary and Example')],
  reset: () => useRecip.getState().reset(),
  applyParams: (p) => useRecip.getState().set(p as Partial<typeof DEFAULTS>),
  tour: [
    {
      title: 'A piston shakes its engine',
      body: 'A piston stops and starts twice each turn. Pulling it around takes a force, and the engine feels the reaction: **F = m ω² r (cos θ + cos 2θ / n)**. The first term is the **primary** force, at crank speed; the second is the **secondary**, at twice it. Slowed to 1/50 here, and the shake is exaggerated.',
      camera: view,
      cut: false,
      select: 'piston-0',
      explode: 0,
      playing: true,
      params: { layout: 'one', c: 0 },
      cites: [NOTE('4.1')],
    },
    {
      title: 'The counterweight trade',
      body: 'A mass on the crank opposite the throw cancels part of the primary force along the stroke. But it also swings **sideways**, adding a force that was not there before. A single cylinder can never be balanced completely.',
      select: 'crank',
      params: { c: 0.5 },
      cites: [NOTE('4.2')],
      check: {
        question: 'Can a counterweight on the crank cancel the secondary force?',
        options: ['Yes, if heavy enough', 'No: it runs at twice crank speed', 'Yes, but only at low speed'],
        answer: 1,
        explain: 'A mass on the crank turns at **crank speed**, so it can only act against the primary. The secondary runs at 2ω, and needs a shaft running at 2ω: **Lanchester’s balancer**.',
      },
    },
    {
      title: 'Let the cylinders cancel',
      body: 'A twin at 180° cancels the primary, but its secondaries add. A flat four does the same, four times over, which is why fours buzz at high revs. A **straight six** cancels both, with six evenly spaced throws in mirror image.',
      select: 'crank',
      params: { layout: 'four', c: 0 },
      cites: [NOTE('4.4')],
      check: {
        question: 'In a flat four, what do the secondary forces do?',
        options: ['Cancel', 'Add up', 'Halve'],
        answer: 1,
        explain: 'Each cos 2θ is the same at 0° and 180° (2θ = 0° and 360°), so all four **add**. The primary cos θ terms, by contrast, are opposite and cancel.',
        reveal: { params: { layout: 'six' } },
      },
    },
    {
      title: 'The rod in two parts',
      body: 'A rod both swings and slides. Replace it with **two point masses** having the same total mass, centre of gravity and inertia, so **ab = k²**. The worked rod of 16 kg with a = 200 mm gives b = 100 mm, and 5.33 kg and 10.67 kg.',
      select: 'rod-0',
      params: { layout: 'one' },
      cites: [EQ('Example')],
    },
  ],
}

export default scene
