import type { SceneDef } from '@/modules/types'
import { C, DEFAULTS, useHouse, type HouseParams } from './model'
import { Panel } from './Panel'
import { Scene3D } from './Scene3D'

const overview = { position: [14, 17, 19] as [number, number, number], target: [0, 0.5, 0] as [number, number, number] }
const plan = { position: [0.5, 24, 6] as [number, number, number], target: [0, 0, 0] as [number, number, number] }

const scene: SceneDef = {
  id: 'farmhouse',
  title: 'Farm dwelling plans',
  summary:
    'The seven farm-dwelling plan types — three traditional (one-room and several-room multi-purpose houses, single-purpose huts) and four contemporary (external-access, courtyard, corridor and central-room) — built as walk-in floor plans. Cut the walls at sill height to read the plan, size the family and check every room against the area rules.',
  Viewport: Scene3D,
  Panel,
  camera: overview,
  extent: 26,
  floorY: 0,
  hatchScale: 0.15,
  timeScale: 1,
  cutPresets: [
    { id: 'none', label: 'Whole house', planes: [{ normal: [0, 1, 0], pos: 30 }] },
    { id: 'sill', label: 'Plan: walls cut at sill height (1.0 m)', planes: [{ normal: [0, 1, 0], pos: 1.0 }] },
    { id: 'roof', label: 'Roof off (2.6 m)', planes: [{ normal: [0, 1, 0], pos: 2.6 }] },
    { id: 'section', label: 'Cross-section', planes: [{ normal: [0, 0, 1], pos: 0 }] },
  ],
  defaultPreset: 'sill',
  cites: [C.ln('p11–20 family dwelling'), C.ass('p3–6 courtyard layout')],
  reset: () => useHouse.getState().reset(),
  applyParams: (p) => useHouse.getState().set(p as Partial<HouseParams>),
  tour: [
    {
      title: 'Designing a farm dwelling',
      body: 'Start from the family: its size, sleeping arrangements, cooking and eating, storage, and space for resting and conversation. A rural house also needs a well-drained site, a view of the access road, a large kitchen with its own rear entrance, a large netted veranda and, on big farms, an office.',
      camera: overview,
      cut: 'none',
      select: null,
      params: { ...DEFAULTS },
      cites: [C.ln('p12–13')],
    },
    {
      title: 'Traditional plans',
      body: 'The **one-room multi-purpose house** uses the least material and one door, but people, cooking and animals share the room. **Several rooms** improve privacy; **single-purpose huts** give the best privacy and health but use the most material.',
      camera: plan,
      cut: 'sill',
      params: { plan: 'sp-huts', family: 6, roof: 'thatch', pitch: 45, wallH: 2.1 },
      cites: [C.ln('p14–15')],
      check: {
        question: 'A family moves its cooking out of the one-room house into a separate kitchen hut. What is the main gain?',
        options: ['Smoke and heat leave the sleeping space', 'Less building material is needed', 'There are fewer doors to secure'],
        answer: 0,
        explain: 'Giving the hearth its own **single-purpose** hut keeps smoke, heat and fire risk away from where people sleep: better health, at the cost of more material and more doors.',
      },
    },
    {
      title: 'Contemporary plans',
      body: '**External-access** rooms each open outside (many doors, no internal links); **corridor** plans are secure but the corridor is dark; in the **central-room** type every room opens off the meeting room, which must be big enough for circulation and furniture.',
      camera: plan,
      cut: 'sill',
      params: { plan: 'central', family: 7, roof: 'corrugated', pitch: 15, wallH: 2.7 },
      cites: [C.ln('p16–17')],
    },
    {
      title: 'The courtyard house',
      body: 'Rooms open onto an enclosed yard: secure, private and shaded. For a family of seven the boys’ room for three needs **max(9, 3 × 3) = 9 m²**, the girls’ room **9 m²**, the living room **12–15 m²**.',
      camera: { position: [6, 20, 14], target: [0, 0, 0] },
      cut: 'sill',
      params: { plan: 'courtyard', family: 7 },
      cites: [C.ln('p17'), C.ass('p3')],
      check: {
        question: 'Using the same rule, how much floor area does a bedroom for four children need?',
        options: ['9 m², the minimum', '12 m²', '16 m²'],
        answer: 1,
        explain: 'The rule allows **3 m² per occupant** with a 9 m² minimum: max(9, 4 × 3) = **12 m²**.',
      },
    },
    {
      title: 'Construction details',
      body: 'Raise the floor **10–15 cm** on a waterproof foundation with cut-off drains. Long axis **east–west** for shading. Corrugated roofs need an insulated ceiling; thatch needs a **45°** slope with eaves at least **2 m** above the ground.',
      camera: overview,
      cut: 'section',
      select: 'roof',
      cites: [C.ln('p12, p19–20')],
      check: {
        question: 'Why lay the house with its long axis east–west in the tropics?',
        options: ['The roof sheds rain more quickly', 'Prevailing winds pass along the house', 'The long walls face away from the low sun'],
        answer: 2,
        explain: 'The low morning and evening sun then strikes only the short **east and west** walls, while the long north and south walls see a high sun that the eaves can shade.',
      },
    },
  ],
}

export default scene
