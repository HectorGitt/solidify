import { designSchema, type Design } from './spec'

/**
 * Starting points for Create in 3D. Each one is a real, checked design: it passes checkDesign with
 * no problems, so a person (or the assistant) edits from something that already works.
 */

export interface Template {
  id: string
  title: string
  blurb: string
  design: Design
}

const t = (id: string, title: string, blurb: string, design: unknown): Template => ({ id, title, blurb, design: designSchema.parse(design) })

export const TEMPLATES: Template[] = [
  t('gear-reducer', 'Two-stage gear reducer', '15 kW at 1450 rpm down to 72.5 rpm through two spur stages, 20 : 1.', {
    version: 1,
    name: 'Two-stage gear reducer',
    description: 'A 20 : 1 spur gear reducer: 20/80 teeth at module 3, then 18/90 at module 4.',
    shafts: [
      { id: 'input', name: 'Input shaft', x: 0, y: 0, z0: 0, length: 200, diameter: 30 },
      { id: 'counter', name: 'Countershaft', x: 150, y: 0, z0: 0, length: 300, diameter: 45 },
      { id: 'output', name: 'Output shaft', x: 366, y: 0, z0: 0, length: 400, diameter: 60 },
    ],
    parts: [
      { id: 'motor', name: 'Motor', kind: 'motor', shaft: 'input', at: 20, power: 15, rpm: 1450 },
      { id: 'p1', name: 'First pinion', kind: 'spur', shaft: 'input', at: 150, teeth: 20, module: 3, width: 40 },
      { id: 'g1', name: 'First gear', kind: 'spur', shaft: 'counter', at: 150, teeth: 80, module: 3, width: 40 },
      { id: 'p2', name: 'Second pinion', kind: 'spur', shaft: 'counter', at: 230, teeth: 18, module: 4, width: 50 },
      { id: 'g2', name: 'Output gear', kind: 'spur', shaft: 'output', at: 230, teeth: 90, module: 4, width: 50 },
      { id: 'b-in-1', kind: 'bearing', shaft: 'input', at: 100, type: 'ball' },
      { id: 'b-in-2', kind: 'bearing', shaft: 'input', at: 190, type: 'ball' },
      { id: 'b-ct-1', kind: 'bearing', shaft: 'counter', at: 10, type: 'roller' },
      { id: 'b-ct-2', kind: 'bearing', shaft: 'counter', at: 290, type: 'roller' },
      { id: 'b-out-1', kind: 'bearing', shaft: 'output', at: 180, type: 'taper' },
      { id: 'b-out-2', kind: 'bearing', shaft: 'output', at: 290, type: 'taper' },
    ],
    links: [
      { kind: 'mesh', a: 'p1', b: 'g1' },
      { kind: 'mesh', a: 'p2', b: 'g2' },
    ],
    blocks: [{ id: 'case', name: 'Gearbox case', x: 183, y: 0, z: 150, w: 640, h: 440, d: 300, material: 'castIron', housing: true }],
  }),
  t('belt-drive', 'V-belt drive', 'A 5.5 kW motor driving a machine at 571 rpm through two V-belts.', {
    version: 1,
    name: 'V-belt drive',
    description: 'A 125 mm motor pulley driving a 315 mm pulley, two V-belts, 500 mm centres.',
    shafts: [
      { id: 'motor-shaft', name: 'Motor shaft', x: 0, y: 0, z0: 0, length: 160, diameter: 28 },
      { id: 'driven', name: 'Driven shaft', x: 500, y: 0, z0: 0, length: 240, diameter: 40 },
    ],
    parts: [
      { id: 'motor', name: 'Motor', kind: 'motor', shaft: 'motor-shaft', at: 10, power: 5.5, rpm: 1440 },
      { id: 'small', name: 'Motor pulley', kind: 'pulley', shaft: 'motor-shaft', at: 130, diameter: 125, width: 40, belt: 'v', grooves: 2 },
      { id: 'large', name: 'Driven pulley', kind: 'pulley', shaft: 'driven', at: 130, diameter: 315, width: 40, belt: 'v', grooves: 2 },
      { id: 'b-1', kind: 'bearing', shaft: 'driven', at: 60, type: 'plummer' },
      { id: 'b-2', kind: 'bearing', shaft: 'driven', at: 200, type: 'plummer' },
    ],
    links: [{ kind: 'belt', a: 'small', b: 'large' }],
  }),
  t('chain-drive', 'Roller-chain drive', 'A 3 : 1 reduction with 3/4-inch roller chain, 17 and 51 teeth.', {
    version: 1,
    name: 'Roller-chain drive',
    description: 'A 17-tooth sprocket driving a 51-tooth sprocket on 19.05 mm (3/4 in) chain, about 40 pitches apart.',
    shafts: [
      { id: 'drive', name: 'Drive shaft', x: 0, y: 0, z0: 0, length: 180, diameter: 35 },
      { id: 'driven', name: 'Driven shaft', x: 762, y: 0, z0: 0, length: 240, diameter: 50 },
    ],
    parts: [
      { id: 'motor', name: 'Geared motor', kind: 'motor', shaft: 'drive', at: 10, power: 4, rpm: 300 },
      { id: 'small', name: 'Drive sprocket', kind: 'sprocket', shaft: 'drive', at: 150, teeth: 17, pitch: 19.05, strands: 1 },
      { id: 'large', name: 'Driven sprocket', kind: 'sprocket', shaft: 'driven', at: 150, teeth: 51, pitch: 19.05, strands: 1 },
      { id: 'b-1', kind: 'bearing', shaft: 'driven', at: 60, type: 'plummer' },
      { id: 'b-2', kind: 'bearing', shaft: 'driven', at: 210, type: 'plummer' },
    ],
    links: [{ kind: 'chain', a: 'small', b: 'large' }],
  }),
]

export const template = (id: string) => TEMPLATES.find((x) => x.id === id)
