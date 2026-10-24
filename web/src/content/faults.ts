/**
 * Common faults by part: what goes wrong, the symptom an operator or mechanic notices, the usual
 * cause and the remedy. Matched on the part's id and name like the drill-down rules.
 * Typical workshop knowledge for farm tractors and machinery.
 */

export interface Fault {
  fault: string
  symptom: string
  cause: string
  fix: string
}

const F = (fault: string, symptom: string, cause: string, fix: string): Fault => ({ fault, symptom, cause, fix })

const RULES: [RegExp, Fault[]][] = [
  [/\b(tyre|tire|tread|lug)|rear[- ]wheel|front[- ]wheel|driving wheel/i, [
    F('Under-inflation', 'Sidewall bulges and cracks; the tractor pulls to one side.', 'Pressure not checked; slow leak at valve or bead.', 'Check cold pressure weekly; repair the leak; never bleed hot tyres.'),
    F('Worn lugs', 'More slip and less pull in the same soil; rounded lug edges.', 'Running on roads, high slip, age.', 'Rotate or replace; reverse-fit is wrong — lugs must point into the direction of travel at the top.'),
    F('Over-inflation', 'Harsh ride, centre of the tread wearing fast, poor grip.', 'Inflated for road work and not reduced for the field.', 'Use field pressure on soft ground; follow the load/pressure table.'),
  ]],
  [/clutch/i, [
    F('Slipping clutch', 'Engine speeds up but the tractor does not; smell of hot lining.', 'Worn or oily plate, no free play at the pedal.', 'Set pedal free play; replace the plate; cure the oil leak.'),
    F('Dragging clutch', 'Gears grind when changing; tractor creeps with the pedal down.', 'Too much free play, warped plate, seized pilot bearing.', 'Adjust the linkage; renew plate or pilot bearing.'),
    F('Glazed lining', 'Judder on take-up.', 'Riding the clutch, overheating.', 'Replace the plate; do not slip the clutch to control speed.'),
  ]],
  [/gearbox|gears? and shafts|layshaft|synchro|\bgear(s)?\b/i, [
    F('Jumping out of gear', 'Lever springs back to neutral under load.', 'Worn dogs or selector detents, weak detent spring.', 'Replace the dog collar / detent spring; check shaft end float.'),
    F('Pitted or chipped teeth', 'Whine or knock that changes with gear and load.', 'Low or contaminated oil, overload, fatigue.', 'Change the oil to the right grade; replace the gear pair.'),
  ]],
  [/crown wheel|differential|diff lock|bevel pinion|centre housing/i, [
    F('Worn crown wheel and pinion', 'Whine on drive or on overrun.', 'Wrong mesh setting, low oil, age.', 'Reset backlash and contact pattern; renew as a matched pair.'),
    F('Diff lock not releasing', 'Tractor scrubs and will not turn.', 'Sticking linkage or return spring.', 'Free and lubricate the linkage; replace the spring.'),
  ]],
  [/final drive|trumpet|rear axle|half[- ]shaft/i, [F('Oil leak at the hub', 'Oil on the inside of the wheel; brakes grab or fade.', 'Worn axle seal.', 'Replace the seal and the wet-brake oil; check the bearing.')]],
  [/brake/i, [
    F('Brake fade', 'Pedal needs more and more force on long descents.', 'Overheated linings or oil.', 'Use a lower gear downhill; check the oil level and grade.'),
    F('Uneven braking', 'Tractor pulls to one side when both pedals are latched.', 'Unequal adjustment or a worn side.', 'Adjust both sides equally; latch the pedals on the road.'),
  ]],
  [/crank|piston|connecting rod|cylinder head|valve|camshaft|rocker|\bengine\b|cylinder block|block\b/i, [
    F('Low compression', 'Hard starting, blue-grey smoke, low power.', 'Worn rings or bores, burnt valve.', 'Compression test; re-ring or reface the valves.'),
    F('Knocking', 'Heavy knock under load.', 'Worn big-end or main bearings; wrong injection timing.', 'Check oil pressure; renew bearings; reset timing.'),
    F('Valve clearance wrong', 'Tapping noise (too large) or burnt valves (too small).', 'Not adjusted at service intervals.', 'Set clearances cold to the handbook.'),
  ]],
  [/flywheel/i, [F('Worn ring gear', 'Starter spins without turning the engine.', 'Starter engaging on the same teeth for years.', 'Turn or replace the ring gear.')]],
  [/injector|injection pump|fuel/i, [
    F('Dribbling injector', 'Black smoke, knocking, high fuel use.', 'Worn or dirty nozzle, low opening pressure.', 'Test and reset the opening pressure; clean or replace the nozzle.'),
    F('Air in the fuel', 'Engine starts then stops, or will not start.', 'Run out of fuel; loose union; blocked filter.', 'Bleed the system from the tank outwards; change the filters.'),
    F('Water in the fuel', 'Misfiring; injector pump wear.', 'Condensation in the tank; poor storage.', 'Drain the sediment bowl daily; keep the tank full overnight.'),
  ]],
  [/air cleaner|pre-?cleaner|governor/i, [
    F('Blocked air cleaner', 'Black smoke and low power, worse in dust.', 'Not serviced; wrong oil level in an oil-bath cleaner.', 'Clean or replace the element; keep oil at the mark.'),
    F('Governor hunting', 'Engine speed surges up and down at steady load.', 'Sticking linkage, worn flyweights, wrong spring.', 'Free the linkage; replace worn parts; set droop.'),
  ]],
  [/sump|oil pump|lubricat|oil filter|gallery/i, [F('Low oil pressure', 'Warning light; knocking.', 'Low level, diluted oil, worn pump or bearings.', 'Stop at once; check level and grade; find the cause before running.')]],
  [/radiator|coolant|thermostat|water pump|fan\b/i, [
    F('Overheating', 'Temperature gauge high; coolant boils over.', 'Blocked fins with chaff, slack fan belt, stuck thermostat, low coolant.', 'Blow the radiator clean daily in harvest; tension the belt; replace the thermostat.'),
    F('Running cold', 'Gauge never reaches normal; sludge, high wear.', 'Thermostat stuck open.', 'Replace the thermostat.'),
  ]],
  [/spark|magneto|ignition|starter|alternator|dynamo|battery/i, [F('Flat battery', 'Starter turns slowly or clicks.', 'Loose or corroded terminals, slipping belt, failed charging.', 'Clean and tighten terminals; check charging voltage; tension the belt.')]],
  [/exhaust|muffler|silencer/i, [F('Excess smoke', 'Black: over-fuelling or blocked air. Blue: burning oil. White: water or cold running.', 'See the colour.', 'Black: air cleaner, injectors, load. Blue: rings and valve guides. White: head gasket or warm-up.')]],
  [/hooke|universal joint|u-joint|cardan|yoke|cross|pto shaft|telescop|\bpto\b|power take-?off/i, [
    F('Worn joint', 'Knocking and vibration at the shaft.', 'No grease; running at too big an angle.', 'Grease every 8 hours; keep joint angles small and equal.'),
    F('Missing guard', 'Exposed spinning shaft.', 'Guard removed or broken.', 'Never run without guards: a 540 rpm shaft wraps clothing in a fraction of a second.'),
    F('Telescoping shaft bottoming', 'Bang on lifting or turning; broken gearbox.', 'Shaft too long for the linkage geometry.', 'Cut the shaft to length with the implement at its closest point.'),
  ]],
  [/hydraulic pump|gear pump|vane pump|lift cover|lift ram|control valve|relief valve|cylinder\b|ram\b|hose|coupler|remote/i, [
    F('Slow or weak lift', 'Implement rises slowly or not with full load.', 'Low oil, worn pump, relief valve set low or leaking.', 'Check level and filter; pressure-test the pump and relief valve.'),
    F('Implement drops (creep)', 'Raised implement sinks while parked.', 'Leaking piston seal or control valve.', 'Replace the seals; never work under a raised implement.'),
    F('Leaking hose', 'Oil mist or drips; jerky motion.', 'Chafed or aged hose, loose fitting.', 'Replace the hose; check for leaks with card, never your hand.'),
  ]],
  [/top link|lower link|lift arm|lift rod|rockshaft|three-point|linkage/i, [F('Worn ball ends', 'Implement sways and hunts in work.', 'No grease, wear.', 'Replace the balls; set check chains or stabilisers.')]],
  [/steering wheel|steering box|worm|sector|drag link|track rod|tie rod|steering arm|steer|king ?pin|knuckle|front axle/i, [
    F('Excess free play', 'Steering wheel turns before the wheels move; wandering.', 'Worn box, ball joints or king pins.', 'Adjust the box; replace worn joints.'),
    F('Wrong toe-in', 'Front tyres wear on their edges; heavy steering.', 'Bent track rod; never set.', 'Set toe-in to the handbook.'),
  ]],
  [/\bbelt|pulley|sheave/i, [F('Belt slip', 'Squeal; driven machine slows under load.', 'Low tension, glazed or oily belt, worn pulley grooves.', 'Tension correctly; replace as a matched set.')]],
  [/\bchain\b|sprocket/i, [F('Chain stretch', 'Chain rides up the teeth; jumps.', 'Wear of pins and bushes; no lubrication.', 'Replace chain and sprockets together once worn past 3 %.')]],
  [/bearing/i, [F('Bearing failure', 'Rumble, heat, play at the shaft.', 'Dirt, no or too much grease, misalignment.', 'Replace; clean grease and seals; align the shaft.')]],
  [/spring/i, [F('Fatigue fracture', 'Sagging; broken coil.', 'Overload and cycling, corrosion pits.', 'Replace; check the load and working stress.')]],
  [/weld/i, [F('Cracked weld', 'Crack from the toe of the weld.', 'Fatigue at a stress raiser, poor fusion.', 'Grind out and re-weld; add a gusset; avoid welds in high-stress zones.')]],
  [/mouldboard|share|landside|plough/i, [F('Worn share', 'Plough will not penetrate; rides up; furrow uneven.', 'Abrasive soil, stones.', 'Replace or hard-face the share point; keep the suction.')]],
  [/disc (gang|harrow|plough)|gang|disc\b/i, [F('Blunt discs', 'Poor penetration and trash cutting.', 'Wear.', 'Sharpen or replace; check bearings.')]],
  [/tine|cultivator|harrow|rotavator|ridger/i, [F('Broken tine or worn point', 'Stripes of uncultivated soil.', 'Stones, overload, wear.', 'Replace the point; spring tines protect against stones.')]],
  [/nozzle|boom|sprayer|spray tank/i, [
    F('Worn nozzle', 'Over-application; streaky pattern.', 'Abrasive formulations, cleaning with wire.', 'Calibrate; replace nozzles that flow 10 % over new.'),
    F('Blocked nozzle', 'Missed strips.', 'Dirty water, no filter.', 'Clean with a soft brush; fit and clean the filters.'),
  ]],
  [/seed|planter|opener|metering/i, [F('Uneven seeding', 'Gaps and doubles in the row.', 'Worn metering parts, wrong speed, blocked tubes.', 'Calibrate; check drive and tubes; slow down.')]],
  [/cutter ?bar|knife|mower|baler|pick-?up|knotter/i, [F('Ragged cut', 'Torn stems, blocked bar.', 'Blunt sections, worn guards, poor registration.', 'Sharpen or replace sections; set registration.')]],
]

/** Common faults for a part (empty if none known). */
export function faultsFor(part: { id: string; name: string }): Fault[] {
  const text = `${part.id.replace(/-/g, ' ')} ${part.name}`
  for (const [re, fs] of RULES) if (re.test(text)) return fs
  return []
}
