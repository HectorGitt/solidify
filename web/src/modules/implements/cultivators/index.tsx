import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, TOOLS, useCult, type CultParams } from './model'
import { Panel } from './Panel'
import { HOLD_X, Scene3D } from './Scene3D'

const field = { position: [-1, 4.5, 6.5] as [number, number, number], target: [-1.5, 0, -0.3] as [number, number, number] }
const close = { position: [HOLD_X - 0.2, 1.4, 2.6] as [number, number, number], target: [HOLD_X - 2, 0, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'cultivators',
  title: 'Cultivators, harrows, rotavator & ridger',
  summary:
    'Secondary-tillage and conservation tools on the shared tractor: rigid- and spring-tine cultivators, spike-tooth and chain harrows, a PTO-driven rotavator (bite length from rotor and forward speed), a ridger, a chisel plough and a subsoiler — each leaving its own mark in the soil.',
  Viewport: Scene3D,
  Panel,
  camera: field,
  follow: 'tractor',
  extent: 14,
  floorY: -0.6,
  hatchScale: 0.05,
  timeScale: 0.5,
  cutPresets: [
    { id: 'none', label: 'No section', planes: [{ normal: [0, 1, 0], pos: 50 }] },
    { id: 'across', label: 'Across the worked strip (x = −2 m)', planes: [{ normal: [1, 0, 0], pos: -2 }] },
  ],
  defaultPreset: 'none',
  cites: [C.am('§12 secondary tillage'), C.bush('p4–7 tillage types and implements'), C.guide1819('ridger sketch')],
  reset: () => useCult.getState().reset(),
  applyParams: (p) => useCult.getState().set(p as Partial<CultParams>),
  tour: [
    { title: 'Tine cultivator', body: 'A **rigid-tine cultivator** stirs the ploughed soil with shovels on stiff tines, staggered in two rows so trash flows between them.', camera: field, cut: 'none', select: 'tools', playing: true, params: { ...DEFAULTS }, cites: [C.am('§12 cultivators')] },
    { title: 'Spring tines', body: '**Spring tines** vibrate and yield over stones; they work shallower than rigid tines.', camera: close, select: 'tools', params: { tool: 'spring', depth: TOOLS.spring.depth[2], hold: true }, cites: [C.am('§12 spring tine')], check: { question: 'A spring tine meets a buried stone. What does it do?', options: ['It bends for good and must be replaced', 'It flexes over the stone and springs back', 'It holds its line and lifts the stone out'], answer: 1, explain: 'The **spring** lets the tine yield and ride over the obstruction, then return to work. The same flexing makes it vibrate, which helps break up the soil.' } },
    { title: 'Rotavator', body: 'The **rotavator** is driven from the PTO. Its L-blades take bites of length **l = 60v/(nZ)**; a slower tractor or faster rotor gives a finer tilth.', camera: close, select: 'rotor', params: { tool: 'rotavator', depth: 0.12, hold: true }, cites: [C.bush('p5 rotary cultivators')], check: { question: 'With the rotor speed unchanged, the tractor drives faster. What happens to the bite length and the tilth?', options: ['Shorter bites and a finer tilth', 'The same bites; only the depth changes', 'Longer bites and a coarser tilth'], answer: 2, explain: 'Bite length **l = 60v/(nZ)** grows with forward speed v: at the same rotor speed each blade takes a longer slice, so the clods are bigger.', reveal: { params: { tool: 'rotavator', speed: 10 } } } },
    { title: 'Ridger', body: 'Double mouldboard bodies throw soil both ways, building **ridges** — the last step of conventional tillage, and the basis of ridge-till.', camera: field, select: 'tools', params: { tool: 'ridger', depth: 0.15, hold: false }, cites: [C.guide1819('ridger sketch'), C.bush('p4–7 ridge-till')] },
    { title: 'Chisel and subsoiler', body: 'Deep narrow tines loosen without turning the soil: the **chisel plough** for conservation tillage, the **subsoiler** to break a hard pan below plough depth.', camera: field, select: 'tools', params: { tool: 'subsoiler', depth: 0.45 }, cites: [C.bush('p5 chisel plough, subsoilers')], check: { question: 'A hard pan lies about 40 cm down, below plough depth. Which tool breaks it without turning the soil over?', options: ['The subsoiler', 'The chisel plough', 'The rigid-tine cultivator'], answer: 0, explain: 'The **subsoiler** works at about 30–60 cm, deep enough to shatter a pan below plough depth. The chisel plough stops at about 35 cm and the cultivator at 20 cm.' } },
    { title: 'Harrows', body: '**Spike-tooth** and **chain harrows** break clods and level the surface after ploughing.', camera: field, select: 'tools', params: { tool: 'spike', depth: 0.05 }, cites: [C.am('§12.7.2 harrows')] },
  ],
}

export default scene
