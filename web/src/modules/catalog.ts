import type { ModuleDef, SceneDef } from './types'

/**
 * Scenes register themselves by folder: src/modules/<moduleId>/<scene folder>/index.tsx
 * (folder defaults to the scene id). Anything without a folder is shown as "coming soon".
 */
const SCENE_FILES = import.meta.glob<{ default: SceneDef }>('./*/*/index.tsx')

/**
 * The full syllabus map (see docs/PLAN.md §4). Scenes without `load` are planned and shown
 * as "coming soon" so the catalogue doubles as the roadmap.
 */
export const MODULES: ModuleDef[] = [
  {
    id: 'engine',
    code: 'M1',
    title: 'Engine',
    courses: ['AEE509'],
    blurb: 'Four- and two-stroke cycles, the parts inside a tractor diesel, and the systems that feed, cool, lubricate and govern it.',
    scenes: [
      {
        id: 'four-stroke-diesel',
        title: 'Four-stroke diesel cutaway',
        summary: 'Piston, crank, valve train and injector through 720°, with live P–V and T–s diagrams for the Otto, Diesel and Dual cycles.',
        exam: true,
        folder: 'four-stroke',
      },
      { id: 'two-stroke', title: 'Two-stroke petrol engine', summary: 'Ports, deflector piston, crankcase compression and petroil lubrication.', exam: true },
      { id: 'multi-cylinder', title: 'Crankshafts & firing order', summary: '2-, 3-, 4-, 6- and 8-cylinder crank layouts with a live firing chart.', exam: true },
      { id: 'diesel-fuel', title: 'Diesel fuel system & injector', summary: 'Tank to injector: lift pump, filters, helix-metered injection pump and needle-valve injector.' },
      { id: 'carburettor', title: 'Carburettor (SI fuel system)', summary: 'Float chamber, venturi, choke and throttle; sediment bowl and diaphragm lift pump.' },
      { id: 'air-governor', title: 'Air cleaner & governor', summary: 'Oil-bath air cleaner airflow and the flyweight governor with regulation and hunting.' },
      { id: 'lubrication', title: 'Lubrication system', summary: 'Force-feed vs splash lubrication, relief valve, filter and oil galleries.', exam: true },
      { id: 'cooling', title: 'Cooling system', summary: 'Thermosiphon vs forced circulation, thermostat, radiator and pressure cap; air cooling.', exam: true },
      { id: 'ignition', title: 'Ignition, starting & charging', summary: 'Coil and magneto ignition, starter motor engagement, dynamo and alternator.' },
      { id: 'performance', title: 'Engine performance calculator', summary: 'PD, CR, IP/BP/FP, bmep, efficiencies and the heat balance.', exam: true },
    ],
  },
  {
    id: 'powertrain',
    code: 'M2',
    title: 'Power train',
    courses: ['AEE510', 'AEE503'],
    blurb: 'From flywheel to wheel: clutches, gearboxes, planetary and hydrostatic drives, torque converters, the differential, final drives and brakes.',
    scenes: [
      { id: 'line-of-drive', title: 'Line of drive (1/2/4WD)', summary: 'The whole power train with live power flow and the three speed reductions.', exam: true },
      { id: 'clutches', title: 'Clutches', summary: 'Single dry plate, dual clutch for live PTO, wet multi-plate IPTO clutch.', exam: true },
      { id: 'gearboxes', title: 'Sliding, constant-mesh & synchromesh gearboxes', summary: 'Selector forks, dog collars and cone synchronisers.' },
      { id: 'mf-16-speed', title: '16F/12R tractor gearbox', summary: 'Speed-shift epicyclic, shuttle, synchro and range gears, PTO through the layshaft.' },
      { id: 'planetary', title: 'Planetary gear set', summary: 'Lock or brake any member and watch the ratio change.', exam: true },
      { id: 'powershift', title: 'Hydraulic-assist (powershift)', summary: 'Clutch packs, countershaft ranges and the shift-oil circuit.', exam: true },
      { id: 'hydrostatic', title: 'Hydrostatic drive', summary: 'Variable swashplate pump driving a fixed motor; the four pump/motor combinations.', exam: true },
      { id: 'cvt', title: 'Power-split CVT', summary: 'Planetary set plus variable pump and motor: stepless speed from active standstill to pure gear drive.' },
      { id: 'torque-converter', title: 'Torque converter', summary: 'Impeller, turbine and stator; vortex vs rotary flow.', exam: true },
      { id: 'differential', title: 'Crown wheel, differential & diff lock', summary: 'Straight running vs cornering, one wheel held, diff lock.', exam: true },
      { id: 'final-drives', title: 'Final drives & rear axle', summary: 'Spur and epicyclic reductions, wet brakes in the trumpet housing.' },
      { id: 'brakes', title: 'Tractor brakes', summary: 'Expanding shoe, ball-ramp dry disc and wet multi-plate brakes.' },
    ],
  },
  {
    id: 'pto',
    code: 'M3',
    title: 'PTO & driveline',
    courses: ['AEE502', 'AEE510'],
    blurb: "Power take-off types and standards, Hooke's joints, double cardans and CV joints.",
    scenes: [
      { id: 'hookes-joint', title: "Hooke's joint", summary: 'Live ω₂/ω₁ and acceleration as the shaft angle changes.', exam: true },
      { id: 'double-cardan', title: 'Double joints & phasing', summary: 'In-phase vs out-of-phase yokes; equal and unequal angles in turns.', exam: true },
      { id: 'pto-types', title: 'PTO types & standards', summary: 'Transmission, live, independent and ground-speed PTO; 540 and 1000 rpm shafts.' },
      { id: 'pto-shaft', title: 'Telescopic PTO shaft & guards', summary: 'Tractor-to-implement driveline with guards, turning and lifting.' },
      { id: 'cv-joints', title: 'Constant-velocity joints', summary: 'Rzeppa, Weiss, Tracta and tripode joints.' },
    ],
  },
  {
    id: 'hydraulics',
    code: 'M4',
    title: 'Hydraulics & three-point hitch',
    courses: ['AEE502', 'AEE510'],
    blurb: 'Pumps, valves and rams; draft and position control; the three-point linkage and its virtual hitch point.',
    scenes: [
      { id: 'lift-circuit', title: 'Hydraulic lift circuit', summary: 'Lift, hold, lower and relief — with oil flow.', exam: true },
      { id: 'pumps', title: 'Gear & vane pumps', summary: 'Pump internals and the pump/motor efficiency calculations.', exam: true },
      { id: 'cylinder', title: 'Double-acting cylinder', summary: 'Extend/retract forces and speeds.', exam: true },
      { id: 'draft-control', title: 'Draft vs position control', summary: 'Top-link sensing keeps ploughing draft constant.' },
      { id: 'three-point', title: 'Three-point linkage & virtual hitch', summary: 'Four-bar linkage geometry and implement penetration.', exam: true },
    ],
  },
  {
    id: 'steering',
    code: 'M5',
    title: 'Steering',
    courses: ['AEE510'],
    blurb: 'Manual linkages, steering boxes, power-assisted and hydrostatic steering, toe-in.',
    scenes: [
      { id: 'linkage', title: 'Manual steering linkage', summary: 'Wheel, box, drop arm, drag link and track rod.' },
      { id: 'boxes', title: 'Steering boxes', summary: 'Recirculating-ball and worm-and-peg cutaways.' },
      { id: 'hydrostatic-steering', title: 'Power & hydrostatic steering', summary: 'Pump, column valve and steering cylinder.' },
    ],
  },
  {
    id: 'traction',
    code: 'M6',
    title: 'Tyres, tracks & traction',
    courses: ['AEE510', 'AEE502'],
    blurb: 'Tyre construction, inflation and ballast, crawler undercarriages, and the traction mechanics of wheel slip.',
    scenes: [
      { id: 'tyre', title: 'Tyre construction', summary: 'Bias, belted and radial plies; size codes and tread classes.' },
      { id: 'ballast', title: 'Inflation & ballast', summary: 'Liquid ballast, wheel weights and the slip test.' },
      { id: 'tracks', title: 'Crawler undercarriage', summary: 'Sprocket, idler, rollers, recoil spring and track tension.' },
      { id: 'traction-lab', title: 'Traction lab', summary: 'Slip, tractive efficiency, the Brixius equations and the speed–pull chart.', exam: true },
    ],
  },
  {
    id: 'chassis',
    code: 'M7',
    title: 'Chassis, hitching & stability',
    courses: ['AEE502', 'AEE510'],
    blurb: 'Centre of gravity, weight transfer, trailed vs mounted hitches, slopes and overturning.',
    scenes: [
      { id: 'weight-transfer', title: 'Weight transfer', summary: 'Dynamic wheel loads with pull, slope and drawbar height.', exam: true },
      { id: 'hitches', title: 'Trailed vs semi-mounted vs mounted', summary: 'Which axle gains weight under the same soil force.', exam: true },
      { id: 'stability', title: 'Slopes & overturning', summary: 'Slope limits, rear overturn and ROPS.' },
      { id: 'tractor-types', title: 'Tractor types', summary: 'The twelve tractor types and how they evolved.', exam: true },
      { id: 'configurator', title: 'Tractor configurator', summary: 'Build a tractor and test it on a job: speed, slip, efficiency, fuel, ground pressure and ruts.' },
    ],
  },
  {
    id: 'implements',
    code: 'M8',
    title: 'Implements & attachments',
    courses: ['AEE502', 'AEE501'],
    blurb: 'Land clearing, tillage, planting, fertilising, spraying, mowing, baling, harvesting and root-crop lifting.',
    scenes: [
      { id: 'mouldboard', title: 'Mouldboard plough', summary: 'Share, mouldboard, landside and frog cutting and inverting the furrow slice.', exam: true },
      { id: 'disc-plough', title: 'Disc plough & disc harrow', summary: 'Disc and tilt angles; gang angles.', exam: true },
      { id: 'cultivators', title: 'Cultivators, harrows, rotavator & ridger', summary: 'Secondary tillage tools.' },
      { id: 'planters', title: 'Seed drill & planter', summary: 'Fluted-roller and plate metering; calibration.', exam: true },
      { id: 'sprayer', title: 'Boom sprayer & nozzles', summary: 'Pump, relief valve, boom and nozzle cutaways; calibration.' },
      { id: 'spreaders', title: 'Fertilizer & manure spreaders', summary: 'Spinning disc broadcaster and apron-and-beater spreader.' },
      { id: 'mower-baler', title: 'Mower & baler', summary: 'Crank-and-pitman cutter bar; pick-up, plunger and knotter.' },
      { id: 'combine', title: 'Combine harvester', summary: 'Crop flow through cutting, threshing, separating and cleaning.', exam: true },
      { id: 'root-crops', title: 'Root-crop harvesters', summary: 'Groundnut digger-shaker and cassava digger-elevator.', exam: true },
      { id: 'land-clearing', title: 'Land clearing', summary: 'Bulldozer, tree pusher, chaining, root plough and the clearing sequence.', exam: true },
    ],
  },
  {
    id: 'elements',
    code: 'M9',
    title: 'Machine elements lab',
    courses: ['AEE503'],
    blurb: 'Belts, chains, gears, bearings, clutches, brakes, springs, welds and ropes — the parts every machine is made from.',
    scenes: [
      { id: 'belts', title: 'Belt drives', summary: 'Open and crossed belts, wrap angle, tension ratio and selection.', exam: true },
      { id: 'chains', title: 'Chain drives', summary: 'Roller chain anatomy and selection.' },
      { id: 'gears', title: 'Gears & gear forces', summary: 'Spur nomenclature; helical and bevel force components.', exam: true },
      { id: 'bearings', title: 'Bearings', summary: 'Rolling-element types, journal bearings and load capacity.', exam: true },
      { id: 'clutch-brake', title: 'Clutch & brake design', summary: 'Multi-disc and cone clutches; shoe and band brakes.', exam: true },
      { id: 'springs-welds', title: 'Springs & welded joints', summary: 'Helical and leaf springs; fillet weld throats.' },
    ],
  },
  {
    id: 'testing',
    code: 'M10',
    title: 'Testing & management',
    courses: ['AEE502', 'AEE501'],
    blurb: 'Dynamometers and tractor tests, field capacity and machinery costs.',
    scenes: [
      { id: 'dynamometers', title: 'Dynamometers', summary: 'Prony brake, hydraulic, eddy-current, DC and PTO dynamometers.', exam: true },
      { id: 'drawbar-test', title: 'Drawbar & chassis testing', summary: 'Test car, load cells and the chassis dynamometer.' },
      { id: 'costs', title: 'Field capacity & machinery costs', summary: 'Capacity, ownership and operating costs per hectare.', exam: true },
    ],
  },
  {
    id: 'vibration',
    code: 'M11',
    title: 'Vibration & the operator',
    courses: ['AEE518', 'AEE510'],
    blurb: 'Spring–mass–damper systems, isolation, the tractor seat, cab ergonomics and maintenance.',
    scenes: [
      { id: 'smd', title: 'Spring–mass–damper lab', summary: 'Damping cases, step and sine response, log decrement.', exam: true },
      { id: 'isolation', title: 'Transmissibility & isolation', summary: 'Resonance, isolation efficiency, the hopper shaker.', exam: true },
      { id: 'seat', title: 'Tractor seat model', summary: 'Two-DOF seat over rough ground against ISO 2631 limits.' },
      { id: 'cab', title: 'Cab, controls & maintenance', summary: 'Controls layout, noise, ROPS and service intervals.' },
    ],
  },
  {
    id: 'field',
    code: 'M12',
    title: 'Field',
    courses: ['All'],
    blurb: 'Drive the assembled tractor with any implement and watch every system work at once.',
    scenes: [{ id: 'field', title: 'Field operations', summary: 'Live dashboard, deformable soil and an X-ray view of the drivetrain at work.' }],
  },
  {
    id: 'processing',
    code: 'M13',
    title: 'Crop processing & preservation',
    courses: ['AEE504', 'AEE536'],
    blurb: 'Handling and conveying, size reduction, cleaning and separation, processing lines for garri, rice and palm oil, and food preservation.',
    scenes: [
      { id: 'conveyors', title: 'Conveyors & handling', summary: 'Belt, chain, screw, bucket and pneumatic conveyors with capacity and power.', exam: true },
      { id: 'size-reduction', title: 'Size reduction: hammer, burr & roller mills', summary: 'Mills at work with Rittinger, Kick and Bond energy laws and fineness modulus.', exam: true },
      { id: 'separation', title: 'Cleaning & separation', summary: 'Sieve shaker, screens, aspirator and cyclone; screen effectiveness and Stokes settling.', exam: true },
      { id: 'plant-layout', title: 'Processing plant layout', summary: 'Planning a factory: flow, handling routes and equipment placement.' },
      { id: 'cassava-garri', title: 'Cassava to garri line', summary: 'Peeling, grating, pressing, fermenting, sieving and frying, with mass balance.', exam: true },
      { id: 'rice-processing', title: 'Rice processing line', summary: 'Cleaning, parboiling, drying, hulling and polishing with yields.' },
      { id: 'palm-oil', title: 'Palm oil mill', summary: 'Sterilising, threshing, digesting, pressing and clarifying.' },
      { id: 'preservation', title: 'Preservation & storage', summary: 'Blancher, retort (D and z values), cold store load and freezing time; yam barn and silo.', exam: true },
    ],
  },
  {
    id: 'water',
    code: 'M14',
    title: 'Water & irrigation',
    courses: ['AEE507'],
    blurb: 'Irrigation methods and water requirements, wells and farm ponds, water and wind erosion, and conservation structures.',
    scenes: [
      { id: 'irrigation-methods', title: 'Irrigation methods', summary: 'Surface (basin, border, furrow), sprinkler, drip and sub-irrigation working on a field.', exam: true },
      { id: 'water-requirement', title: 'Crop water requirement & efficiencies', summary: 'Blaney–Criddle and Jensen–Haise ET, leaching requirement and the six irrigation efficiencies.', exam: true },
      { id: 'wells-ponds', title: 'Wells, aquifers & farm ponds', summary: 'Confined and unconfined wells with Dupuit–Thiem drawdown, and farm-pond storage.', exam: true },
      { id: 'water-erosion', title: 'Water erosion & terraces', summary: 'Splash, sheet, rill and gully erosion; USLE soil loss; diversion terrace design.', exam: true },
      { id: 'waterways', title: 'Grassed waterways', summary: 'Channel shapes, Manning velocity and capacity, and waterway design.', exam: true },
      { id: 'wind-erosion', title: 'Wind erosion & windbreaks', summary: 'Saltation, suspension and creep; windbreak protection and control practices.' },
    ],
  },
  {
    id: 'structures',
    code: 'M15',
    title: 'Farm structures',
    courses: ['AEE505'],
    blurb: 'Farmstead planning and layout, farm buildings, machinery storage and greenhouse environmental control.',
    scenes: [
      { id: 'farmstead', title: 'Farmstead planning & zones', summary: 'Site selection, zone rings, wind direction, drives and services laid out in 3D.', exam: true },
      { id: 'farmhouse', title: 'Farm dwelling plans', summary: 'The seven plan types with room-size rules, walk-through in 3D.' },
      { id: 'machinery-storage', title: 'Workshop & machinery storage', summary: 'Machinery shed and workshop sizing, drives, parking and the hazard-separation rule.' },
      { id: 'greenhouse', title: 'Greenhouse design & ventilation', summary: 'Glass vs polythene houses with live ventilation-rate and temperature-rise calculation.', exam: true },
    ],
  },
  {
    id: 'precision',
    code: 'M16',
    title: 'Precision farming',
    courses: [],
    blurb: 'Satellite guidance, sensors and variable-rate control: putting every pass, seed and drop of spray exactly where it is needed.',
    scenes: [
      { id: 'autosteer', title: 'GNSS auto-steer', summary: 'Driver, GNSS, SBAS or RTK: watch cross-track error turn into overlaps and missed strips on the coverage map.' },
      { id: 'see-and-spray', title: 'See-and-spray weed targeting', summary: 'Cameras on the boom find weeds and fire single nozzles; chemical saved vs blanket spraying.' },
      { id: 'variable-rate', title: 'Variable-rate application', summary: 'Prescription maps, section control and rate controllers on a spreader and a drill.' },
      { id: 'yield-map', title: 'Yield mapping', summary: 'Combine yield monitor: mass-flow sensor, moisture and GNSS turned into a yield map.' },
      { id: 'drone-scan', title: 'Drone field scan', summary: 'Flight planning, image overlap and NDVI from a multispectral camera.' },
    ],
  },
  {
    id: 'mechanisms',
    code: 'M17',
    title: 'Mechanisms & machine dynamics lab',
    courses: [],
    blurb: 'The bench experiments of a mechanics of machines lab: linkages, cams, balancing, governors and flywheels you can reconfigure and measure.',
    scenes: [
      { id: 'four-bar', title: 'Four-bar linkage rig', summary: 'Change the links, fix a different one: Grashof’s law, transmission angle, mechanical advantage and coupler curves.', exam: true },
      { id: 'slider-crank', title: 'Slider-crank & scotch yoke', summary: 'Displacement every 15° against a true sine; rod length and an offset line of stroke.', exam: true },
      { id: 'geneva', title: 'Geneva wheel', summary: 'Steady rotation in, stop-start motion out: steps, dwell, output speed and acceleration.' },
      { id: 'oldham', title: 'Oldham coupling', summary: 'Parallel shafts out of line: tongues, grooves and the disc centre’s circle.' },
      { id: 'inertia', title: 'Moment of inertia by oscillation', summary: 'Compound pendulum, bifilar and trifilar suspensions: time the swing, work out the inertia.', exam: true },
      { id: 'balancing', title: 'Static & dynamic balancing rig', summary: 'The m r polygon, one balance mass or two, and a sprung plate that shows what is left.', exam: true },
      { id: 'governors', title: 'Watt, Porter & Hartnell governors', summary: 'Sleeve lift, speed range, controlling force and stability.', exam: true },
      { id: 'flywheel', title: 'Flywheel & turning moment', summary: 'The turning moment diagram, the energy to store, and the speed left fluctuating.', exam: true },
      { id: 'reciprocating', title: 'Reciprocating balance', summary: 'Primary and secondary shaking forces, counterweights and multi-cylinder engines.', exam: true },
      { id: 'cam', title: 'Cam profile & follower', summary: 'Lay out a lift diagram, draw the cam it needs, and read the follower’s velocity and acceleration.', exam: true },
      { id: 'velocity-diagram', title: 'Velocity & acceleration diagrams', summary: 'Polygons that close live on a running four-bar, with its instantaneous centre.', exam: true },
      { id: 'inversions', title: 'Inversions', summary: 'Hold a different link of one chain still and get a different machine.', exam: true },
    ],
  },
  {
    id: 'materials',
    code: 'M18',
    title: 'Strength of materials lab',
    courses: [],
    blurb: 'Test pieces and rigs that load, bend and break: stress, strain, beams, torsion and buckling you can see and measure.',
    scenes: [
      { id: 'beam', title: 'Beam bending rig', summary: 'Supports, loads and sections: shear force, bending moment, stress through the depth and deflection.', exam: true },
      { id: 'tensile', title: 'Tensile testing machine', summary: 'Pull a specimen to failure while the stress–strain curve draws itself; ductile against brittle.', exam: true },
      { id: 'axial', title: 'Thermal stress & composite bars', summary: 'Rails that close their gaps as they warm, and a rod and tube sharing one pull.', exam: true },
      { id: 'torsion', title: 'Torsion rig', summary: 'Twist a solid or hollow shaft and read the angle and the shear stress.', exam: true },
      { id: 'buckling', title: 'Column buckling rig', summary: 'End conditions, slenderness, and where buckling gives way to crushing.', exam: true },
    ],
  },
]

for (const m of MODULES) {
  for (const s of m.scenes) {
    const key = `./${m.id}/${s.folder ?? s.id}/index.tsx`
    if (!s.load && SCENE_FILES[key]) s.load = SCENE_FILES[key]
  }
}

export function findModule(id: string) {
  return MODULES.find((m) => m.id === id)
}

export function countScenes() {
  const all = MODULES.flatMap((m) => m.scenes)
  return { total: all.length, ready: all.filter((s) => s.load).length }
}
