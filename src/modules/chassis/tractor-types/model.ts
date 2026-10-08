import { create } from 'zustand'

/**
 * The twelve tractor types of "Tractor as a versatile equipment" (AEE502) and the AEE502
 * marking guides, with key features and the evolution notes. Dimensions of the 3D models are
 * typical values (not from the notes) chosen to show each type's proportions.
 */

export type TypeId =
  | 'standard'
  | 'rowcrop'
  | 'highClearance'
  | 'utility'
  | 'orchard'
  | 'lawn'
  | 'tiller'
  | 'crawler'
  | 'skidSteer'
  | 'skidder'
  | 'mfwd'
  | 'articulated'

export interface TypeInfo {
  id: TypeId
  name: string
  short: string
  /** typical power range (from the notes where given) */
  power?: string
  features: string[]
  /** true where the feature list goes beyond the notes */
  beyond?: boolean
}

export const TYPES: TypeInfo[] = [
  {
    id: 'standard',
    name: 'Standard (2WD)',
    short: 'Standard',
    features: [
      'Fixed tread, low and stable; rear-wheel drive with larger rear tyres.',
      'CG about one-third of the wheelbase ahead of the rear axle (Farmland: 0.54 of 1.88 m).',
      'General drawbar and PTO work: ploughing, harrowing, haulage.',
    ],
  },
  {
    id: 'rowcrop',
    name: 'Row-crop',
    short: 'Row-crop',
    features: [
      'Narrow (tricycle or adjustable) front and adjustable rear track to straddle crop rows.',
      'High clearance under the axles for cultivating growing crops.',
      'Row-crop track widths 1.32–1.93 m.',
    ],
  },
  {
    id: 'highClearance',
    name: 'High-clearance (cane)',
    short: 'High-clearance',
    features: ['Very tall clearance from drop housings at the wheels, for tall crops such as sugar cane.', 'Narrow wheels running between the rows; a high, less stable CG.'],
  },
  {
    id: 'utility',
    name: 'Utility with front loader',
    short: 'Utility',
    features: ['Compact, low tractor for general farm jobs: loading, haulage, light tillage.', 'Front-end loader on the hydraulics; three-point linkage and PTO at the rear.'],
  },
  {
    id: 'orchard',
    name: 'Orchard',
    short: 'Orchard',
    features: ['Low overall height with smooth, swept fenders so branches slide over.', 'Low seat; built lower and often without a ROPS so it can pass under trees.'],
  },
  {
    id: 'lawn',
    name: 'Lawn and garden',
    short: 'Lawn & garden',
    power: '< 15 kW',
    features: ['Small riding tractor, under 15 kW.', 'Mid-mounted mower deck; also small blades, carts and snow throwers.'],
  },
  {
    id: 'tiller',
    name: 'Power tiller (two-wheel walking tractor)',
    short: 'Power tiller',
    power: '5–12 kW',
    features: ['Single axle, steered and balanced by the operator at the handles.', 'Single-cylinder engine, 5–12 kW, usually driving a rotary tiller.', 'Handle force U from moments about the axle; balance needs xr = ψ′·y′.'],
  },
  {
    id: 'crawler',
    name: 'Crawler (track-type)',
    short: 'Crawler',
    features: ['Tracks spread the weight: low ground pressure and high traction on soft ground.', 'Steel tracks from the 1930s; rubber-belt tracks (Caterpillar Challenger) from the 1990s.', 'Steered by braking or slowing one track.'],
  },
  {
    id: 'skidSteer',
    name: 'Skid-steer loader',
    short: 'Skid-steer',
    features: ['Four equal wheels on fixed axles, chain-driven per side.', 'Steers by driving the two sides at different speeds so the tyres skid — turns in its own length.', 'Loader arms and bucket; very manoeuvrable in yards and buildings.'],
  },
  {
    id: 'skidder',
    name: 'Tree skidder',
    short: 'Skidder',
    features: ['Articulated 4WD forestry tractor with large equal wheels (often chained).', 'Drags felled logs with a rear grapple or winch arch; front blade for clearing.'],
  },
  {
    id: 'mfwd',
    name: '4WD with smaller front wheels (MFWD)',
    short: '4WD small front',
    features: ['Front-wheel assist: driven front axle with smaller tyres, steered by knuckles.', 'Puts more of the weight to work for traction.'],
  },
  {
    id: 'articulated',
    name: '4WD articulated, equal wheels',
    short: '4WD articulated',
    power: '100–300+ kW',
    features: ['Equal-size wheels (often duals) on two frames joined by a steering hinge.', 'Large tractors, 100–300+ kW, for heavy tillage on big farms.', 'Steered by hydraulic rams that fold the frames about the hinge.'],
  },
]

export const TYPE_BY_ID = Object.fromEntries(TYPES.map((t) => [t.id, t])) as Record<TypeId, TypeInfo>

export interface TypesParams {
  type: TypeId
  spin: boolean
}

export const DEFAULTS: TypesParams = { type: 'standard', spin: true }

interface Store extends TypesParams {
  set: (p: Partial<TypesParams>) => void
  reset: () => void
}

export const useTypes = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Evolution notes (AEE502 versatile-equipment notes, TESTS p2, HE/HFS). */
export const HISTORY: { year: string; text: string; beyond?: boolean }[] = [
  { year: '1900', text: 'California steam “giant”: 5 m wide with 3 m diameter wheels, 36 t — weight was the only way to get traction.' },
  { year: '1908–12', text: 'Winnipeg tractor trials: the first public comparative tests of tractors.' },
  { year: '1919', text: 'Nebraska Tractor Test Law: a tractor sold in Nebraska must be tested and meet its claims.' },
  { year: '1930s', text: 'Steel crawler tracks spread; pneumatic rubber tyres replace steel wheels (rubber tyres: early 1930s).', beyond: true },
  { year: '1959', text: 'ASAE/SAE Tractor Test Code; Nebraska drops “rated” and “corrected” horsepower.' },
  { year: '1971', text: 'Nebraska adds the sound level dB(A) at the operator’s ear.' },
  { year: '1976', text: 'ROPS required on tractors over 20 hp used by hired operators (from 1 Sept 1976); Nebraska tests move to SI units (Test No. 1218).' },
  { year: '1990s', text: 'Rubber-belt tracks (Caterpillar Challenger).' },
  { year: 'Modern', text: 'Power steering, epicyclic front hubs, wet disc brakes, power-shift transmissions, ROPS cabs.' },
]
