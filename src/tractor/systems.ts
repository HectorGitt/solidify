import type { PartInfo } from '@/parts/registry'

/**
 * The tractor's systems as the whole-tractor view shows them: colour, where each goes in the
 * exploded layout, and its label. Kept free of 3D code so the UI can read it cheaply.
 * Frame as the tractor: +X forward, Y up, +Z right.
 */
export interface SystemDef {
  key: string
  name: string
  color: string
  /** where the system goes in the exploded layout (offset from its place) */
  explode: [number, number, number]
  /** label position in the tractor frame (moves with the system) */
  label: [number, number, number]
  info: PartInfo
}

export const SYSTEMS: SystemDef[] = [
  {
    key: 'engine',
    name: 'Engine',
    color: '#e8794f',
    explode: [0.35, 1.0, 0],
    label: [1.1, 1.3, 0],
    info: { summary: 'Four-cylinder, four-stroke direct-injection diesel, 100 × 124 mm.', role: 'Turns the chemical energy of the fuel into torque at the crankshaft; everything else on the tractor is driven from it.' },
  },
  {
    key: 'driveline',
    name: 'Clutch, gearbox & differential',
    color: '#5aa9e6',
    explode: [0, -0.15, 0],
    label: [0.45, 0.95, 0],
    info: { summary: 'Clutch, change-speed gearbox, crown wheel and pinion, and differential.', role: 'Carries the engine torque to the rear axle at the ratio chosen, turns it through 90° and shares it between the wheels.' },
  },
  {
    key: 'final',
    name: 'Final drives & brakes',
    color: '#818cf8',
    explode: [-0.3, -0.85, 0],
    label: [0, 0.85, 0.55],
    info: { summary: 'Half shafts, wet disc brakes, epicyclic final reductions and axles.', role: 'The last speed reduction (4.8 : 1) between the differential and the wheels, with the brakes on the fast half shafts where little torque is needed to stop them.' },
  },
  {
    key: 'pto',
    name: 'PTO drive',
    color: '#f472b6',
    explode: [-0.95, -0.5, 0],
    label: [-0.05, 0.62, -0.1],
    info: { summary: 'Transmission PTO: drive off the layshaft, two-step reduction, output shaft to the 540 rpm stub.', role: 'Drives implements through the PTO shaft. It turns whenever the clutch is engaged, in any gear, at a fixed ratio to engine speed.' },
  },
  {
    key: 'hydraulics',
    name: 'Hydraulic lift',
    color: '#facc15',
    explode: [-0.8, 0.95, 0],
    label: [0.0, 1.12, 0.12],
    info: { summary: 'Gear pump, filter, relief valve, spool control valve and lift ram, working the three-point linkage through the rockshaft.', role: 'Lifts and lowers the implement on the three-point linkage, using the transmission oil as its reservoir.' },
  },
  {
    key: 'steering',
    name: 'Steering',
    color: '#c084fc',
    explode: [0, 1.6, 0],
    label: [0.3, 1.75, 0],
    info: { summary: 'Steering wheel and column, recirculating-ball box, drop arm, drag link, steering arms and track rod.', role: 'Turns the driver’s hand movement into a large, controlled swing of the front wheels about their kingpins, with Ackermann geometry so both wheels follow their own circles.' },
  },
  {
    key: 'cooling',
    name: 'Cooling',
    color: '#22d3ee',
    explode: [1.0, 0.55, 0],
    label: [1.9, 1.45, 0],
    info: { summary: 'Radiator, pressure cap, fan and water pump, fan belt, thermostat and hoses.', role: 'Carries heat from the engine’s water jacket to the air, holding the engine near its working temperature.' },
  },
  {
    key: 'fuel',
    name: 'Fuel system',
    color: '#fb7185',
    explode: [0.7, -0.75, -0.3],
    label: [0.95, 1.05, -0.3],
    info: { summary: 'Tank, sediment bowl, lift pump, filters, in-line injection pump, high-pressure pipes and returns.', role: 'Delivers clean fuel to each cylinder in firing order, metered and at injection pressure.' },
  },
  {
    key: 'electrical',
    name: 'Electrical',
    color: '#a3e635',
    explode: [1.2, -0.5, 0.3],
    label: [0.97, 1.32, 0.2],
    info: { summary: 'Battery, starter motor, alternator and its belt, and the heavy cables.', role: 'Starts the engine and keeps the battery charged for lights and instruments.' },
  },
]
