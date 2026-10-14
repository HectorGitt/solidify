import * as THREE from 'three'
import { box, cylinder, extrude, merge, roundedBox, tube } from '@/geometry'
import type { MaterialKey } from '@/render/materials'
import { operatorSeatMerged } from '@/parts/lib/chassis'
import { toLeft, trackLoop, wheel, wheelStations } from '@/parts/lib/wheels'
import { bar } from '../common/wheel'
import type { TypeId } from './model'

/**
 * Simple parametric models of the tractor types (typical proportions, not from the notes).
 * Frame as the shared tractor: +X forward, Y up, +Z left, ground at y = 0.
 */

type G = THREE.BufferGeometry

export interface PartSpec {
  key: string
  name: string
  material: MaterialKey
  role?: 'housing' | 'static' | 'moving'
  geo: G
  summary: string
  fn: string
}

const at = (g: G, x: number, y: number, z: number) => {
  const c = g.clone()
  c.translate(x, y, z)
  return c
}

/** Box between two corners (x0..x1, y0..y1), width w centred on z. Rounded edges r. */
function blk(x0: number, x1: number, y0: number, y1: number, w: number, r = 0.04, z = 0) {
  const g = r > 0 ? roundedBox(x1 - x0, y1 - y0, w, r) : box(x1 - x0, y1 - y0, w)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z)
  return g
}

interface WheelSet {
  x: number
  r: number
  w: number
  track: number
  pattern?: 'R1' | 'F2' | 'smooth'
  duals?: boolean
  zs?: number[]
}

/** Wheel sets from the parts library; rims and hubs on the −Z side face outward. */
function wheels(sets: WheelSet[]) {
  const tyres: G[] = []
  const rims: G[] = []
  const hubs: G[] = []
  for (const s of sets) {
    const spec = { radius: s.r, width: s.w, pattern: s.pattern ?? 'R1' }
    const g = wheel(spec)
    const zs = s.zs ?? wheelStations(s.track, spec, s.duals)
    for (const z of zs) {
      const side = (q: G) => (z < 0 ? toLeft(q) : q)
      tyres.push(at(g.tyre, s.x, s.r, z))
      rims.push(at(side(g.rim), s.x, s.r, z))
      if (g.hub) hubs.push(at(side(g.hub), s.x, s.r, z))
    }
  }
  return { tyres: merge(...tyres), rims: merge(...rims), hubs: hubs.length ? merge(...hubs) : null }
}

/** Two-post ROPS frame at x, top at yTop, posts ±half apart from yBase. */
function rops(x: number, yBase: number, yTop: number, half: number) {
  return merge(bar([x, yBase, half], [x, yTop, half], 0.07), bar([x, yBase, -half], [x, yTop, -half], 0.07), bar([x, yTop, half + 0.035], [x, yTop, -half - 0.035], 0.07))
}

/** Cab: four posts + roof (frame) and glass panels. */
function cab(x0: number, x1: number, y0: number, y1: number, w: number) {
  const h = w / 2
  const posts = [
    [x0, h],
    [x0, -h],
    [x1, h],
    [x1, -h],
  ].map(([x, z]) => bar([x, y0, z], [x, y1, z], 0.06))
  const frame = merge(...posts, blk(x0 - 0.05, x1 + 0.05, y1, y1 + 0.08, w + 0.1, 0.03))
  const glass = merge(blk(x0 + 0.03, x1 - 0.03, y0 + 0.05, y1 - 0.02, 0.02, 0, h), blk(x0 + 0.03, x1 - 0.03, y0 + 0.05, y1 - 0.02, 0.02, 0, -h), blk(x1 - 0.01, x1 + 0.01, y0 + 0.35, y1 - 0.02, w - 0.06, 0), blk(x0 - 0.01, x0 + 0.01, y0 + 0.35, y1 - 0.02, w - 0.06, 0))
  return { frame, glass }
}

function seatAndWheel(sx: number, sy: number, wx: number, wy: number) {
  const seat = at(operatorSeatMerged(), sx, sy, 0)
  const sw = tube(0.19, 0.17, 0.03, 32)
  sw.rotateZ(Math.PI / 2 + 0.6)
  sw.translate(wx, wy, 0)
  const col = bar([wx - 0.02, wy - 0.02, 0], [wx + 0.28, wy - 0.5, 0], 0.04)
  return merge(seat, sw, col)
}

/** One crawler track side from the parts library (links, shoes, sprocket, idler, rollers), centred on z. */
function crawlerTrack(cx: number, span: number, z: number) {
  const t = trackLoop({ xs: cx - span / 2, xi: cx + span / 2, rollers: 5 })
  const m = (g: G) => at(g, 0, 0, z)
  return { chain: m(t.chain), shoes: m(t.shoes), wheels: m(merge(t.sprocket, t.idler, t.rollers)) }
}

/** Loader bucket: back, bottom and sides, opening forward, lip at (x, 0). */
function bucket(x: number, y: number, w: number, depth = 0.55, h = 0.5) {
  return merge(blk(x - depth, x - depth + 0.04, y, y + h, w, 0), blk(x - depth, x, y, y + 0.04, w, 0), blk(x - depth, x - 0.1, y, y + h * 0.8, 0.04, 0, w / 2), blk(x - depth, x - 0.1, y, y + h * 0.8, 0.04, 0, -w / 2))
}

const P = (key: string, name: string, material: MaterialKey, geo: G, summary: string, fn: string, role: PartSpec['role'] = 'housing'): PartSpec => ({ key, name, material, geo, summary, fn, role })

function common(w: { tyres: G; rims: G; hubs: G | null }, tyreNote: string): PartSpec[] {
  const parts = [P('tyres', 'Tyres', 'rubber', w.tyres, 'Tyres.', tyreNote, 'moving'), P('rims', 'Wheel rims', 'paintYellow', w.rims, 'Wheel rims.', 'Carry the tyres on the hubs.', 'moving')]
  if (w.hubs) parts.push(P('hubs', 'Wheel nuts and hub caps', 'steelDark', w.hubs, 'Wheel nuts and hub caps.', 'Clamp each wheel disc to its axle hub.', 'moving'))
  return parts
}

export function buildType(id: TypeId): PartSpec[] {
  switch (id) {
    case 'standard':
      return [] // drawn with the shared <Tractor/>
    case 'rowcrop': {
      const w = wheels([
        { x: 0, r: 0.85, w: 0.47, track: 1.9 },
        { x: 2.6, r: 0.38, w: 0.17, track: 0.36, pattern: 'F2' },
      ])
      const c = cab(-0.75, 0.35, 1.35, 2.85, 1.25)
      return [
        ...common(w, 'Large rear tyres (≈ 18.4-38) on an adjustable track to straddle the rows; close-set twin front wheels run between them.'),
        P('body', 'Engine and transmission', 'paintGreen', merge(blk(0.25, 2.8, 1.0, 1.6, 0.62, 0.08), blk(-0.4, 0.4, 0.55, 1.35, 0.8, 0.05), blk(2.45, 2.75, 0.35, 1.1, 0.22, 0.03)), 'Engine, gearbox and front pedestal.', 'The narrow front pedestal carries the tricycle wheels so the tractor can run along a single row.'),
        P('cab', 'Cab (ROPS)', 'paintBlack', c.frame, 'ROPS cab.', 'Protects the operator in an overturn and from noise and dust.', 'static'),
        P('glass', 'Cab glass', 'glass', c.glass, 'Glazing.', 'All-round view of the rows.', 'static'),
        P('axle', 'Rear axle housings', 'castIron', blk(-0.12, 0.12, 0.72, 0.98, 1.6, 0.03), 'Long rear axle.', 'Lets the wheels slide along the axle to set the track (1.32–1.93 m for row-crop tractors).', 'static'),
      ]
    }
    case 'highClearance': {
      const w = wheels([
        { x: 0, r: 0.8, w: 0.3, track: 2.0 },
        { x: 2.7, r: 0.45, w: 0.2, track: 2.0, pattern: 'F2' },
      ])
      const legs = merge(...[1, -1].flatMap((s) => [blk(-0.15, 0.15, 0.8, 2.0, 0.18, 0.03, s * 0.78), blk(2.6, 2.8, 0.45, 2.0, 0.14, 0.03, s * 0.86)]))
      return [
        ...common(w, 'Narrow tyres that run between tall crop rows.'),
        P('legs', 'Drop housings', 'castIron', legs, 'Drop (portal) housings.', 'Carry the drive down from the high axle to the wheel hubs, giving 1.5 m or more of crop clearance.', 'static'),
        P('body', 'Raised chassis and engine', 'paintRed', merge(blk(-0.5, 3.0, 1.95, 2.35, 1.0, 0.06), blk(1.0, 3.0, 2.35, 2.85, 0.7, 0.08)), 'Raised chassis.', 'The whole tractor sits high above the crop; the CG is high, so it is less stable on slopes.'),
        P('rops', 'ROPS and seat', 'paintBlack', merge(rops(-0.45, 2.35, 3.6, 0.5), seatAndWheel(0.0, 2.4, 0.45, 3.0)), 'ROPS frame and operator station.', 'Protects the operator; important with the high CG.', 'static'),
      ]
    }
    case 'utility': {
      const w = wheels([
        { x: 0, r: 0.62, w: 0.34, track: 1.4 },
        { x: 1.95, r: 0.38, w: 0.2, track: 1.3, pattern: 'F2' },
      ])
      const arms = merge(...[1, -1].flatMap((s) => [blk(0.5, 0.75, 0.55, 1.55, 0.1, 0.02, s * 0.58), bar([0.62, 1.5, s * 0.58], [2.55, 0.95, s * 0.58], 0.09), bar([2.55, 0.95, s * 0.58], [2.95, 0.3, s * 0.58], 0.09)]))
      const rams = merge(bar([0.7, 0.75, 0.66], [1.6, 1.22, 0.66], 0.06), bar([0.7, 0.75, -0.66], [1.6, 1.22, -0.66], 0.06))
      return [
        ...common(w, 'General-purpose tyres; loaders often run with filled rear tyres or a counterweight.'),
        P('body', 'Engine and transmission', 'paintBlue', merge(blk(0.3, 2.2, 0.75, 1.25, 0.6, 0.06), blk(-0.35, 0.4, 0.45, 1.05, 0.75, 0.05)), 'Compact engine and transmission.', 'Low, compact power unit for general farm work.'),
        P('rops', 'ROPS and seat', 'paintBlack', merge(rops(-0.5, 0.95, 2.25, 0.55), seatAndWheel(-0.1, 1.05, 0.3, 1.5)), 'ROPS frame and seat.', 'Two-post ROPS; essential with a raised loader.', 'static'),
        P('loader', 'Front-end loader', 'paintYellow', merge(arms, bucket(3.15, 0.05, 1.7)), 'Front-end loader.', 'Arms on towers either side of the engine raise and tilt the bucket by hydraulic rams: loading manure, soil, bales.', 'static'),
        P('rams', 'Loader rams', 'chrome', rams, 'Lift rams.', 'Double-acting hydraulic rams fed from the tractor’s hydraulic system.', 'moving'),
      ]
    }
    case 'orchard': {
      const w = wheels([
        { x: 0, r: 0.55, w: 0.4, track: 1.3 },
        { x: 1.85, r: 0.33, w: 0.18, track: 1.15, pattern: 'F2' },
      ])
      const fender = (s: number) => {
        const sh = new THREE.Shape()
        sh.absarc(0, 0, 0.66, 0, Math.PI, false)
        sh.lineTo(-0.6, 0)
        sh.absarc(0, 0, 0.6, Math.PI, 0, true)
        sh.lineTo(0.66, 0)
        const g = extrude(sh, 0.5)
        g.translate(0, 0.55, s * 0.68)
        return g
      }
      return [
        ...common(w, 'Smaller tyres keep the tractor low.'),
        P('body', 'Low engine hood', 'paintOrange', merge(blk(0.2, 2.1, 0.45, 0.95, 0.62, 0.15), blk(-0.4, 0.3, 0.35, 0.85, 0.75, 0.05)), 'Low, rounded hood.', 'Smooth and low so branches slide over without damage to tree or tractor.'),
        P('fenders', 'Full fenders', 'paintOrange', merge(fender(1), fender(-1), blk(-0.6, 0.6, 0.85, 0.9, 0.9, 0.02)), 'Swept full fenders.', 'Cover the rear wheels so branches and fruit are not drawn in.'),
        P('seat', 'Low seat and controls', 'paintBlack', seatAndWheel(-0.15, 0.95, 0.25, 1.3), 'Low operator station.', 'The seat is low; orchard tractors are built lower and often have no ROPS (or a folding one).', 'static'),
      ]
    }
    case 'lawn': {
      const w = wheels([
        { x: 0, r: 0.3, w: 0.22, track: 0.85, pattern: 'smooth' },
        { x: 1.2, r: 0.2, w: 0.13, track: 0.8, pattern: 'smooth' },
      ])
      return [
        ...common(w, 'Turf tyres that do not mark lawns.'),
        P('body', 'Body and engine', 'paintGreen', merge(blk(-0.25, 1.45, 0.28, 0.58, 0.72, 0.08), blk(0.8, 1.45, 0.45, 0.78, 0.55, 0.12)), 'Small body and engine (< 15 kW).', 'A small petrol or diesel engine under the front hood.'),
        P('deck', 'Mower deck', 'paintGrey', blk(0.2, 1.0, 0.06, 0.18, 1.15, 0.05), 'Mid-mounted mower deck.', 'Rotary blades driven by belt from the engine.', 'static'),
        P('seat', 'Seat and steering', 'paintBlack', seatAndWheel(0.0, 0.62, 0.45, 0.95), 'Operator seat.', 'Ride-on control for lawns and gardens.', 'static'),
      ]
    }
    case 'tiller': {
      const w = wheels([{ x: 0, r: 0.32, w: 0.15, track: 0.62 }])
      const handles = merge(bar([-0.05, 0.75, 0.22], [-1.3, 1.0, 0.32], 0.035), bar([-0.05, 0.75, -0.22], [-1.3, 1.0, -0.32], 0.035), bar([-1.0, 0.94, 0.3], [-1.0, 0.94, -0.3], 0.03))
      const hood = (() => {
        const sh = new THREE.Shape()
        sh.absarc(0, 0, 0.3, 0, Math.PI, false)
        sh.lineTo(-0.27, 0)
        sh.absarc(0, 0, 0.27, Math.PI, 0, true)
        sh.lineTo(0.3, 0)
        const g = extrude(sh, 0.62)
        g.translate(-0.75, 0.2, 0)
        return g
      })()
      const blades: G[] = []
      for (let k = 0; k < 6; k++) for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2 + k * 0.5
        blades.push(bar([-0.75, 0.2, -0.27 + k * 0.108], [-0.75 + 0.2 * Math.cos(a), 0.2 + 0.2 * Math.sin(a), -0.27 + k * 0.108], 0.025))
      }
      return [
        ...common(w, 'Pneumatic lugged tyres (or steel cage wheels in wet paddy).'),
        P('engine', 'Single-cylinder engine', 'paintRed', merge(blk(0.1, 0.65, 0.45, 0.85, 0.42, 0.05), blk(0.15, 0.55, 0.85, 1.0, 0.3, 0.05)), 'Single-cylinder engine with fuel tank, 5–12 kW.', 'Its weight ahead of the axle is balanced by the operator at the handles (handle force U).'),
        P('gearcase', 'Gear and chain case', 'castIron', blk(-0.18, 0.1, 0.2, 0.75, 0.3, 0.04), 'Gearbox and chain case.', 'Reduces engine speed to the axle and drives the rotary tiller.', 'static'),
        P('handles', 'Handlebars', 'steelDark', handles, 'Handlebars with clutch levers.', 'The operator walks behind, steering and holding the machine level against the tiller’s reaction.', 'static'),
        P('rotor', 'Rotary tiller', 'paintRed', merge(hood, ...blades), 'Rotary tiller.', 'L-blades on a PTO-driven rotor chop and mix the soil; the forward thrust of the blades helps drive the machine.', 'moving'),
      ]
    }
    case 'crawler': {
      const tl = crawlerTrack(0.9, 1.75, 0.8)
      const tr = crawlerTrack(0.9, 1.75, -0.8)
      const c = cab(-0.3, 0.8, 1.45, 2.85, 1.2)
      const blade = merge(blk(2.55, 2.68, 0.02, 1.0, 2.6, 0.02), bar([1.6, 0.5, 0.8], [2.55, 0.35, 0.8], 0.1), bar([1.6, 0.5, -0.8], [2.55, 0.35, -0.8], 0.1))
      return [
        P('tracks', 'Tracks', 'steelDark', merge(tl.shoes, tr.shoes), 'Steel track shoes with grousers.', 'Spread the weight over a long contact patch: low ground pressure and high traction in soft soil. Steel tracks from the 1930s; rubber belts (Challenger) from the 1990s.', 'moving'),
        P('track-chain', 'Track chain', 'forged', merge(tl.chain, tr.chain), 'Track chain: links, pins and bushings.', 'An endless roller chain under the shoes; the sprocket teeth drive on its bushings.', 'moving'),
        P('rollers', 'Sprocket, idler and rollers', 'steel', merge(tl.wheels, tr.wheels), 'Drive sprocket, idler and track rollers.', 'The sprocket drives the track; the rollers carry the weight onto it. Steering is by slowing or braking one track.', 'moving'),
        P('body', 'Engine and hull', 'paintYellow', merge(blk(-0.3, 2.3, 0.6, 1.45, 1.05, 0.06), blk(0.9, 2.3, 1.45, 1.75, 0.8, 0.06)), 'Engine and hull.', 'Low-mounted, heavy body between the track frames.'),
        P('cab', 'ROPS cab', 'paintBlack', c.frame, 'ROPS cab.', 'Rollover and falling-object protection.', 'static'),
        P('glass', 'Cab glass', 'glass', c.glass, 'Glazing.', 'Operator view.', 'static'),
        P('blade', 'Dozer blade', 'paintYellow', blade, 'Front blade.', 'Land clearing and earth moving; push arms carry the thrust to the track frames.', 'static'),
      ]
    }
    case 'skidSteer': {
      const w = wheels([
        { x: 0, r: 0.38, w: 0.27, track: 1.32, pattern: 'R1' },
        { x: 1.05, r: 0.38, w: 0.27, track: 1.32, pattern: 'R1' },
      ])
      const arms = merge(...[1, -1].flatMap((s) => [bar([-0.35, 1.75, s * 0.62], [1.35, 1.0, s * 0.62], 0.11), bar([1.35, 1.0, s * 0.62], [1.75, 0.3, s * 0.62], 0.11)]))
      return [
        ...common(w, 'Four equal tyres on fixed axles.'),
        P('body', 'Body and engine', 'paintOrange', merge(blk(-0.45, 1.45, 0.3, 1.1, 1.0, 0.06), blk(-0.45, -0.2, 1.1, 1.8, 1.0, 0.04)), 'Body, engine at the rear.', 'Chain cases each side drive both wheels on that side together.'),
        P('cage', 'ROPS cage', 'paintBlack', cab(0.0, 1.1, 1.1, 2.0, 0.85).frame, 'Operator cage (ROPS/FOPS).', 'The operator sits between the loader arms.', 'static'),
        P('loader', 'Loader arms and bucket', 'paintOrange', merge(arms, bucket(2.1, 0.03, 1.6, 0.6, 0.55)), 'Loader arms and bucket.', 'Skid steering: both sides driven at different speeds so the tyres skid — it turns in its own length.', 'static'),
      ]
    }
    case 'skidder': {
      const w = wheels([
        { x: -0.6, r: 0.78, w: 0.6, track: 2.0 },
        { x: 2.2, r: 0.78, w: 0.6, track: 2.0 },
      ])
      const c = cab(1.0, 2.0, 1.3, 2.8, 1.15)
      const arch = merge(bar([-1.25, 1.2, 0.55], [-1.6, 2.4, 0.3], 0.12), bar([-1.25, 1.2, -0.55], [-1.6, 2.4, -0.3], 0.12), bar([-1.6, 2.4, 0.35], [-1.6, 2.4, -0.35], 0.12), bar([-1.6, 2.35, 0], [-2.2, 1.4, 0], 0.09), bar([-2.2, 1.4, 0], [-2.35, 0.5, 0.25], 0.06), bar([-2.2, 1.4, 0], [-2.35, 0.5, -0.25], 0.06))
      const log = cylinder(0.25, 3, 20)
      log.rotateZ(Math.PI / 2 - 0.2)
      log.translate(-3.6, 0.55, 0)
      return [
        ...common(w, 'Large equal tyres, often with chains, for forest floors.'),
        P('frames', 'Front and rear frames', 'paintYellow', merge(blk(0.95, 3.2, 0.6, 1.3, 1.0, 0.06), blk(-1.4, 0.5, 0.6, 1.3, 1.0, 0.06), blk(2.0, 3.2, 1.3, 1.7, 0.85, 0.06)), 'Articulated frames.', 'Two frames joined by a vertical hinge; steering rams fold them, so the rear wheels follow the front.'),
        P('hinge', 'Articulation hinge', 'steelDark', blk(0.5, 0.95, 0.75, 1.15, 0.5, 0.02), 'Articulation joint.', 'The steering pivot between the frames.', 'moving'),
        P('cab', 'ROPS/FOPS cab', 'paintBlack', c.frame, 'Protected cab.', 'Protection against rollover and falling branches.', 'static'),
        P('glass', 'Cab screens', 'glass', c.glass, 'Screens.', 'Operator view.', 'static'),
        P('blade', 'Front blade', 'paintYellow', blk(3.3, 3.42, 0.05, 0.8, 2.3, 0.02), 'Front blade.', 'Clears a path and stacks logs.', 'static'),
        P('arch', 'Grapple arch', 'paintYellow', arch, 'Rear arch and grapple.', 'Lifts the log ends off the ground and drags them out of the forest.', 'moving'),
        P('log', 'Log', 'wood', log, 'Log being skidded.', 'The load, dragged with its front end raised.', 'static'),
      ]
    }
    case 'mfwd': {
      const w = wheels([
        { x: 0, r: 0.85, w: 0.47, track: 1.9 },
        { x: 2.85, r: 0.62, w: 0.38, track: 1.85 },
      ])
      const c = cab(-0.65, 0.55, 1.35, 2.95, 1.3)
      return [
        ...common(w, 'Driven front tyres, smaller than the rears, steered by knuckles with epicyclic hubs.'),
        P('body', 'Engine and transmission', 'paintGreen', merge(blk(0.45, 3.4, 1.0, 1.75, 0.75, 0.08), blk(-0.4, 0.5, 0.55, 1.35, 0.85, 0.05)), 'Engine and power-shift transmission.', 'A transfer drive sends part of the power forward through a propeller shaft to the front axle.'),
        P('frontAxle', 'Driven front axle', 'castIron', blk(2.72, 2.98, 0.5, 0.75, 1.55, 0.04), 'Front drive axle.', 'Differential and epicyclic hubs; pivots in the middle to follow the ground.', 'static'),
        P('cab', 'Cab (ROPS)', 'paintBlack', c.frame, 'ROPS cab.', 'Modern tractors carry a ROPS cab with air-conditioning.', 'static'),
        P('glass', 'Cab glass', 'glass', c.glass, 'Glazing.', 'Operator view.', 'static'),
      ]
    }
    case 'articulated': {
      const w = wheels([
        { x: 0, r: 0.95, w: 0.6, track: 2.3, duals: true },
        { x: 3.2, r: 0.95, w: 0.6, track: 2.3, duals: true },
      ])
      const c = cab(0.25, 1.45, 1.9, 3.45, 1.4)
      return [
        ...common(w, 'Equal-size tyres, here in duals, to put 100–300+ kW to the ground.'),
        P('front', 'Front frame and engine', 'paintRed', merge(blk(1.85, 4.3, 1.0, 2.15, 1.05, 0.1), blk(1.85, 4.3, 0.7, 1.0, 0.8, 0.03)), 'Front frame with the engine.', 'Carries the engine over the front axle; the weight split is nearly equal front and rear.'),
        P('rear', 'Rear frame', 'paintRed', merge(blk(-0.8, 1.55, 0.7, 1.9, 1.05, 0.08)), 'Rear frame.', 'Carries the cab, rear axle, three-point linkage and drawbar.'),
        P('hinge', 'Articulation hinge and steering rams', 'steelDark', merge(blk(1.55, 1.85, 0.75, 1.65, 0.55, 0.02), bar([1.35, 1.2, 0.5], [2.1, 1.2, 0.45], 0.08), bar([1.35, 1.2, -0.5], [2.1, 1.2, -0.45], 0.08)), 'Articulation hinge.', 'Two hydraulic rams fold the frames about the hinge to steer.', 'moving'),
        P('cab', 'Cab (ROPS)', 'paintBlack', c.frame, 'ROPS cab.', 'Operator protection and comfort.', 'static'),
        P('glass', 'Cab glass', 'glass', c.glass, 'Glazing.', 'Operator view.', 'static'),
      ]
    }
  }
}

/** Rough model length (m) for camera framing. */
export const SPAN: Record<TypeId, [number, number]> = {
  standard: [-1.2, 2.4],
  rowcrop: [-1.0, 3.0],
  highClearance: [-0.9, 3.2],
  utility: [-0.8, 3.2],
  orchard: [-0.7, 2.2],
  lawn: [-0.4, 1.5],
  tiller: [-1.4, 0.7],
  crawler: [-0.4, 2.7],
  skidSteer: [-0.5, 2.1],
  skidder: [-3.0, 3.4],
  mfwd: [-1.0, 3.5],
  articulated: [-1.0, 4.3],
}
