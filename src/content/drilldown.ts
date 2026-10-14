import { MODULES } from '@/modules/catalog'
import type { PartMeta } from '@/parts/registry'

/**
 * Drill-down: which scene shows a part in more depth. A part can name its own links
 * (PartInfo.detail); otherwise these rules match its id and name. Links only point at scenes
 * that exist, and never back at the scene you are in.
 */

/** scene route "module/scene" */
export type SceneRoute = string

export interface DetailLink {
  route: SceneRoute
  /** button text; defaults to the scene title */
  label?: string
}

/** [pattern on "id name", routes] — first matches win; order from specific to general */
const RULES: [RegExp, SceneRoute[]][] = [
  // tyres, wheels, tracks, ballast
  [/\b(tyre|tire|tread|lug)/i, ['traction/tyre', 'traction/ballast']],
  [/wheel weight|ballast/i, ['traction/ballast', 'traction/traction-lab']],
  [/rear[- ]wheel|driving wheel/i, ['traction/tyre', 'traction/traction-lab']],
  [/front[- ]wheel|knuckle|king ?pin|front axle/i, ['steering/linkage', 'traction/tyre']],
  [/\btrack(s)?\b|crawler|idler|sprocket roller/i, ['traction/tracks']],
  // engine and its systems
  [/crank|piston|connecting rod|con-rod|cylinder head|valve|camshaft|rocker/i, ['engine/four-stroke-diesel', 'engine/multi-cylinder']],
  [/flywheel/i, ['engine/four-stroke-diesel', 'powertrain/clutches']],
  [/injector|injection pump|fuel/i, ['engine/diesel-fuel']],
  [/carburett?or|float chamber|venturi/i, ['engine/carburettor']],
  [/air cleaner|governor|pre-?cleaner/i, ['engine/air-governor']],
  [/sump|oil pump|lubricat|oil filter|gallery/i, ['engine/lubrication']],
  [/radiator|coolant|thermostat|water pump|fan\b/i, ['engine/cooling']],
  [/spark|magneto|ignition|starter|alternator|dynamo|battery/i, ['engine/ignition']],
  [/exhaust|muffler|silencer/i, ['engine/four-stroke-diesel']],
  [/\bengine\b|cylinder block|block\b/i, ['engine/four-stroke-diesel', 'engine/performance']],
  // power train
  [/clutch/i, ['powertrain/clutches', 'elements/clutch-brake']],
  [/crown wheel|differential|diff lock|bevel pinion|centre housing/i, ['powertrain/differential', 'powertrain/final-drives']],
  [/final drive|trumpet|rear axle|half[- ]shaft/i, ['powertrain/final-drives']],
  [/planet|sun gear|ring gear|epicyclic/i, ['powertrain/planetary']],
  [/hydrostatic|swashplate/i, ['powertrain/hydrostatic']],
  [/torque converter|impeller|stator|turbine/i, ['powertrain/torque-converter']],
  [/gearbox|gears? and shafts|layshaft|synchro|selector/i, ['powertrain/gearboxes', 'powertrain/mf-16-speed', 'elements/gears']],
  [/\bgear(s)?\b/i, ['elements/gears']],
  [/brake/i, ['powertrain/brakes', 'elements/clutch-brake']],
  [/line of drive|drive ?line|drivetrain/i, ['powertrain/line-of-drive']],
  // PTO and joints
  [/hooke|universal joint|u-joint|cardan|yoke|cross/i, ['pto/hookes-joint', 'pto/double-cardan']],
  [/constant[- ]velocity|cv joint/i, ['pto/cv-joints']],
  [/pto shaft|telescop|guard cone/i, ['pto/pto-shaft']],
  [/\bpto\b|power take-?off/i, ['pto/pto-types', 'pto/pto-shaft']],
  // hydraulics and linkage
  [/top link|lower link|lift arm|lift rod|rockshaft|three-point|linkage|hitch point/i, ['hydraulics/three-point', 'hydraulics/draft-control']],
  [/lift cover|lift ram|control valve|relief valve/i, ['hydraulics/lift-circuit']],
  [/hydraulic pump|gear pump|vane pump/i, ['hydraulics/pumps']],
  [/cylinder\b|ram\b|piston rod/i, ['hydraulics/cylinder']],
  [/hose|coupler|remote/i, ['hydraulics/lift-circuit']],
  // steering
  [/steering wheel|steering box|worm|sector|recirculating/i, ['steering/boxes', 'steering/hydrostatic-steering']],
  [/drag link|track rod|tie rod|steering arm|steer/i, ['steering/linkage']],
  // chassis, operator
  [/drawbar|hitch/i, ['chassis/hitches', 'chassis/weight-transfer']],
  [/\brops\b|roll-?over|cab\b|operator station|platform/i, ['vibration/cab', 'chassis/stability']],
  [/seat/i, ['vibration/seat']],
  [/gnss|gps|antenna|steering motor|guidance/i, ['precision/autosteer']],
  // machine elements
  [/\bbelt|pulley|sheave/i, ['elements/belts']],
  [/\bchain\b|sprocket/i, ['elements/chains']],
  [/bearing/i, ['elements/bearings']],
  [/spring|weld/i, ['elements/springs-welds']],
  // implements
  [/mouldboard|share|landside|plough/i, ['implements/mouldboard']],
  [/disc (gang|harrow|plough)|gang/i, ['implements/disc-plough']],
  [/tine|cultivator|harrow|rotavator|ridger/i, ['implements/cultivators']],
  [/nozzle|boom|sprayer|spray tank/i, ['implements/sprayer', 'precision/see-and-spray']],
  [/spinning disc|spreader|hopper/i, ['implements/spreaders']],
  [/seed|planter|opener|metering/i, ['implements/planters']],
  [/cutter ?bar|knife|mower|baler|pick-?up|knotter/i, ['implements/mower-baler']],
  [/threshing|concave|header|combine|sieve|straw walker/i, ['implements/combine']],
  [/implement|toolbar/i, ['chassis/hitches']],
]

/** Scene title for a route, if the scene exists (is built). */
export function sceneTitle(route: SceneRoute) {
  const [m, s] = route.split('/')
  const scene = MODULES.find((x) => x.id === m)?.scenes.find((x) => x.id === s)
  return scene?.load ? scene.title : null
}

/** Links to scenes that show this part in more depth (at most `max`). */
export function detailLinks(part: Pick<PartMeta, 'id' | 'name' | 'info'>, current: SceneRoute, max = 3): { route: SceneRoute; title: string }[] {
  const explicit = part.info?.detail
  let routes: SceneRoute[] = explicit ? explicit.map((d) => d.route) : []
  if (!explicit) {
    const text = `${part.id.replace(/-/g, ' ')} ${part.name}`
    for (const [re, rs] of RULES) {
      if (re.test(text)) {
        routes = rs
        break
      }
    }
  }
  const seen = new Set<string>()
  const out: { route: SceneRoute; title: string }[] = []
  for (const r of routes) {
    if (r === current || seen.has(r)) continue
    seen.add(r)
    const label = explicit?.find((d) => d.route === r)?.label
    const title = sceneTitle(r)
    if (title) out.push({ route: r, title: label ?? title })
    if (out.length >= max) break
  }
  return out
}

/** every rule target, for tests */
export const RULE_ROUTES = [...new Set(RULES.flatMap(([, r]) => r))]
