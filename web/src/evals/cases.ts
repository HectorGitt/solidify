/**
 * The nightly test set: requests a student might make, each with what a good build must have. A build is
 * scored by how many of its checks pass (see score.ts); the night's score is the average.
 */
export interface EvalCase {
  id: string
  prompt: string
  /** sensible part counts for this subject */
  parts?: [number, number]
  /** a graph should come with it (beams, shafts, curves) */
  charts?: boolean
  /** loads drawn as arrows attached to parts */
  arrows?: boolean
  /** the subject alone, without test beds, grips or gauges */
  noRig?: boolean
  /** a pasted problem: it must come back solved, step by step, with the asked results marked */
  solve?: boolean
  /** a result with a known answer: a calculation whose label matches, within a relative tolerance */
  answer?: { label: RegExp; value: number; tol: number }
}

export const EVAL_CASES: EvalCase[] = [
  // gears and drives
  { id: 'reducer-3', prompt: 'A single-stage spur gear reducer, 3 : 1, for a 15 kW motor at 1450 rpm', parts: [3, 10], answer: { label: /ratio|reduction/i, value: 3, tol: 0.03 } },
  { id: 'reducer-20', prompt: 'A two-stage spur gear reducer, 20 : 1 overall, in a cast-iron housing', parts: [4, 12], answer: { label: /overall|total|ratio|reduction/i, value: 20, tol: 0.1 } },
  { id: 'planetary', prompt: 'A planetary gear set with a sun gear, three planets, a carrier and a ring gear', parts: [4, 10] },
  { id: 'bevel', prompt: 'A pair of 90 degree bevel gears, 20 and 40 teeth, on their shafts', parts: [3, 8], answer: { label: /ratio/i, value: 2, tol: 0.03 } },
  { id: 'belt', prompt: 'A V-belt drive between a 150 mm and a 400 mm pulley on two shafts', parts: [3, 8], answer: { label: /ratio/i, value: 400 / 150, tol: 0.05 } },
  { id: 'chain', prompt: 'A roller chain drive with a 17-tooth and a 51-tooth sprocket', parts: [3, 8], answer: { label: /ratio/i, value: 3, tol: 0.05 } },
  { id: 'gear-pump', prompt: 'An external gear pump with two spur gears in a housing, 16 cc per revolution at 2000 rpm', parts: [3, 8] },
  // fasteners and components
  { id: 'nut', prompt: 'An M20 hexagon nut', parts: [1, 2] },
  { id: 'bolt', prompt: 'An M16 hexagon head bolt, 80 mm long, with a nut and washer', parts: [2, 4] },
  { id: 'coupling', prompt: 'A flanged shaft coupling with six bolts joining two 40 mm shafts', parts: [3, 10] },
  { id: 'plummer', prompt: 'A plummer block bearing housing on a 50 mm shaft', parts: [2, 6] },
  { id: 'spring', prompt: 'A helical compression spring, 6 mm wire, 50 mm coil diameter, 10 active coils, steel', parts: [1, 3] },
  // strength of materials: the subject, its loads as arrows, and its diagrams
  { id: 'beam-ss', prompt: 'A simply supported beam, 4 m span, with a 10 kN point load at mid-span', parts: [1, 4], charts: true, arrows: true, noRig: true, answer: { label: /moment/i, value: 10, tol: 0.05 } },
  { id: 'beam-cant', prompt: 'A cantilever beam 1.5 m long with a 2 kN point load at the free end', parts: [1, 3], charts: true, arrows: true, noRig: true, answer: { label: /moment/i, value: 3, tol: 0.05 } },
  { id: 'beam-udl', prompt: 'A simply supported beam, 6 m span, with a uniformly distributed load of 5 kN/m', parts: [1, 4], charts: true, arrows: true, noRig: true, answer: { label: /moment/i, value: 22.5, tol: 0.05 } },
  { id: 'tensile', prompt: 'A steel tensile test specimen', parts: [1, 3], arrows: true, noRig: true },
  { id: 'torsion', prompt: 'Torsion of a solid steel shaft, 40 mm diameter, carrying 500 N·m', parts: [1, 3], arrows: true, noRig: true },
  { id: 'column', prompt: 'A pin-ended steel column under an axial load, showing buckling', parts: [1, 3], arrows: true, noRig: true },
  // fluids and power
  { id: 'cylinder', prompt: 'A double-acting hydraulic cylinder, 80 mm bore, 400 mm stroke, at 160 bar', parts: [3, 8], answer: { label: /force|thrust/i, value: 80.4, tol: 0.05 } },
  { id: 'centrifugal', prompt: 'A single-stage centrifugal water pump with a volute casing and closed impeller', parts: [3, 8] },
  { id: 'engine', prompt: 'A single-cylinder four-stroke engine cutaway', parts: [4, 12] },
  { id: 'flywheel', prompt: 'A cast-iron flywheel on a shaft storing energy at 300 rpm', parts: [2, 5], charts: false },
  { id: 'brake', prompt: 'A disc brake with a caliper and two pads on a rotor', parts: [3, 8] },
  { id: 'clutch', prompt: 'A single-plate friction clutch with pressure plate and springs', parts: [3, 10] },
  // mechanisms and machines
  { id: 'slider-crank', prompt: 'A slider-crank mechanism with a 50 mm crank and a 200 mm connecting rod', parts: [3, 6] },
  { id: 'cam', prompt: 'A cam and roller follower on a shaft', parts: [2, 6] },
  // a pasted exam problem: built as its setup and solved step by step
  {
    id: 'solve-beam',
    prompt: 'Solve this problem in 3D, step by step:\n\nA simply supported beam of span 6 m carries a point load of 20 kN at 2 m from A and a uniformly distributed load of 5 kN/m over its whole length. Determine the reactions at A and B and the maximum bending moment.',
    parts: [1, 5],
    charts: true,
    arrows: true,
    noRig: true,
    solve: true,
    answer: { label: /reaction at b|R_?B/i, value: 21.67, tol: 0.02 },
  },
  // mechanisms whose motion must come from their mounts (the "mechanism moves right" check)
  { id: 'compound-train', prompt: 'A three-shaft compound gear train, 4 : 1 then 3 : 1, 12 : 1 overall', parts: [5, 10], answer: { label: /overall|total|ratio/i, value: 12, tol: 0.05 } },
  { id: 'rack-pinion', prompt: 'A rack and pinion, module 3 mm, 20-tooth pinion turned by a handwheel', parts: [3, 7] },
  { id: 'quick-return', prompt: 'A crank and slotted-lever quick-return mechanism for a shaping machine', parts: [4, 9] },
  { id: 'scotch-yoke', prompt: 'A scotch yoke mechanism with a 40 mm crank', parts: [3, 6] },
  { id: 'hooke', prompt: 'A universal (Hooke’s) joint joining two shafts at 30 degrees', parts: [3, 7] },
  { id: 'screw-jack', prompt: 'A 5-tonne screw jack with an Acme thread, nut, handle and base', parts: [3, 8] },
  { id: 'vice', prompt: 'A cast-iron workshop bench vice with a sliding jaw and lead screw', parts: [3, 8] },
  { id: 'auger', prompt: 'A helical grain screw auger conveyor with a feed hopper', parts: [3, 8] },
  { id: 'turbine', prompt: 'A three-blade horizontal-axis wind turbine on a tubular tower', parts: [3, 8] },
]
