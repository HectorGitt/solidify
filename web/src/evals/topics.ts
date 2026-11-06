/**
 * What the nightly run drafts for the model library, a few each night, in turn. A draft that scores well
 * goes to the review queue; nothing reaches students until an admin approves it.
 */
export interface DraftTopic {
  topic: string
  prompt: string
}

const t = (topic: string, prompts: string[]): DraftTopic[] => prompts.map((prompt) => ({ topic, prompt }))

export const DRAFT_TOPICS: DraftTopic[] = [
  ...t('Gears and drives', [
    'A worm and worm wheel reducer, 30 : 1, with the worm on a steel shaft',
    'A rack and pinion with a 20-tooth pinion, module 3',
    'A three-shaft compound gear train, 4 : 1 then 3 : 1',
    'A timing belt drive between a 20-tooth and a 60-tooth pulley',
    'A differential with a ring gear, two spider gears and two side gears',
    'A helical gear pair on parallel shafts, 25 and 50 teeth',
    'A spur gear meshing with an idler and a third gear, showing the direction each turns',
  ]),
  ...t('Shafts and bearings', [
    'A stepped transmission shaft with two bearings, a gear and a keyway',
    'A deep-groove ball bearing, 6205, shown cut through',
    'A tapered roller bearing pair on a wheel hub',
    'A rigid sleeve coupling with a key joining two 30 mm shafts',
    'A universal joint between two shafts at 30 degrees',
    'A journal bearing with a bronze bush and an oil groove',
  ]),
  ...t('Fasteners and joints', [
    'A single-riveted lap joint between two 10 mm steel plates',
    'A bolted bracket with four M12 bolts carrying an eccentric load',
    'A fillet-welded T-joint, 8 mm leg, under a shear load',
    'A knuckle joint with its pin, eye and fork',
    'A cotter joint joining two rods in tension',
  ]),
  ...t('Strength of materials', [
    'A simply supported beam, 5 m span, with two 8 kN point loads at the third points',
    'A propped cantilever, 3 m long, with a uniformly distributed load of 4 kN/m',
    'A thin-walled pressure vessel, 1 m diameter, 10 mm wall, at 2 MPa',
    'A hollow steel shaft, 60 mm outside and 40 mm inside, under 1.5 kN·m of torque',
    'A short concrete column with an eccentric axial load',
    'A steel I-beam cantilever, 2 m long, with a 5 kN load at the end',
    'A thick-walled cylinder under internal pressure, showing hoop stress through the wall',
  ]),
  ...t('Fluids and power', [
    'A Pelton wheel with its buckets and a single jet',
    'A reciprocating single-acting water pump with a crank, piston and valves',
    'A venturi meter in a 100 mm pipe with a 50 mm throat',
    'A Francis turbine runner in its spiral casing',
    'A two-stage reciprocating air compressor with an intercooler',
    'A shell-and-tube heat exchanger with one shell pass and two tube passes',
  ]),
  ...t('Mechanisms', [
    'A four-bar linkage with a 40 mm crank, 120 mm coupler and 100 mm rocker',
    'A Scotch yoke mechanism with a 60 mm crank',
    'A Geneva drive with a four-slot wheel',
    'A quick-return mechanism for a shaping machine',
    'A ratchet and pawl on a winch drum',
    'A toggle clamp holding a workpiece',
  ]),
  ...t('Machines', [
    'A hand-operated winch with a drum, gears and a band brake',
    'A single-cylinder disc plough with its frame and hitch',
    'A hammer mill with a rotor, swinging hammers and a screen',
    'A pedal-powered maize sheller',
    'A screw press for oil extraction with its cage and worm',
    'A centrifugal fan with backward-curved blades in a scroll casing',
    'A hydraulic bottle jack, 10 tonnes',
  ]),
]

/** tonight's topics: the next `n` in turn, so the whole list comes round every few weeks */
export function topicsFor(dayNumber: number, n: number): DraftTopic[] {
  if (!n) return []
  return Array.from({ length: Math.min(n, DRAFT_TOPICS.length) }, (_, i) => DRAFT_TOPICS[(dayNumber * n + i) % DRAFT_TOPICS.length])
}
