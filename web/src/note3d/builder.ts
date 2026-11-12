import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  box,
  csg,
  cylinder,
  extrude,
  finalize,
  gear,
  helixSpring,
  lathe,
  mat4,
  merge,
  tube,
  xform,
  type CsgOp,
  type V2,
} from '@/geometry'
import { hexBolt } from '@/geometry/parts'
import { ballBearing, hexNut, needleBearing, rollerBearing, taperBearing, thrustBearing } from '@/parts/lib/elements'
import { evalDim, evalVec3, type NoteShapeSpec } from './schema'


/*
 * Every round shape turns about its local Y axis: the cylinders, tubes and pulleys are made that way, and the
 * prompt, the assembly and the motion all count on it. The gear generator and three.js's torus make theirs about
 * Z, so they are stood up onto Y here. (Before this, every generated gear sat 90 degrees off: turned edge-on to
 * its shaft and spinning about the wrong line.)
 */
const STAND_UP = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
const standUp = (g: THREE.BufferGeometry) => xform(g, STAND_UP)

function buildSingleShapeGeometry(
  spec: NoteShapeSpec,
  params: Record<string, number>,
  /** round a box's edges (only in a part with no cuts: a rounded box does not combine reliably) */
  roundBoxes = false,
): THREE.BufferGeometry {
  switch (spec.kind) {
    case 'box': {
      const sx = Math.max(0.002, evalDim(spec.sx, params, 0.08))
      const sy = Math.max(0.002, evalDim(spec.sy, params, 0.08))
      const sz = Math.max(0.002, evalDim(spec.sz, params, 0.08))
      // edges rounded a little, as the lab rigs' castings and plates are: a sharp-edged slab catches no light on
      // its edges and reads as flat cardboard
      const r = Math.min(0.003, 0.08 * Math.min(sx, sy, sz))
      if (!roundBoxes || r < 0.0004) return box(sx, sy, sz)
      const g = new RoundedBoxGeometry(sx, sy, sz, 2, r)
      g.deleteAttribute('uv')
      const out = g.index ? g.toNonIndexed() : g
      out.computeBoundingBox()
      return out
    }
    case 'cylinder': {
      const rTop = evalDim(spec.rTop ?? spec.r, params, 0.04)
      const rBot = evalDim(spec.rBot ?? spec.r, params, rTop)
      const h = Math.max(0.002, evalDim(spec.h, params, 0.1))
      if (Math.abs(rTop - rBot) < 1e-6) {
        return cylinder(Math.max(0.001, rTop), h, 40)
      }
      return finalize(new THREE.CylinderGeometry(Math.max(0.001, rTop), Math.max(0.001, rBot), h, 40, 1, false), Math.PI / 4)
    }
    case 'cone': {
      const rBot = Math.max(0.002, evalDim(spec.rBot ?? spec.r, params, 0.05))
      const rTop = Math.max(0.0005, evalDim(spec.rTop, params, 0.001))
      const h = Math.max(0.002, evalDim(spec.h, params, 0.1))
      return finalize(new THREE.CylinderGeometry(rTop, rBot, h, 40, 1, false), Math.PI / 4)
    }
    case 'tube': {
      const rOuter = Math.max(0.003, evalDim(spec.rOuter ?? spec.r, params, 0.05))
      const rInner = Math.max(0.001, Math.min(rOuter - 0.001, evalDim(spec.rInner, params, rOuter * 0.6)))
      const h = Math.max(0.002, evalDim(spec.h, params, 0.1))
      return tube(rOuter, rInner, h, 44)
    }
    case 'sphere': {
      const r = Math.max(0.002, evalDim(spec.r, params, 0.04))
      return finalize(new THREE.SphereGeometry(r, 32, 24), Math.PI / 3)
    }
    case 'torus': {
      const r = Math.max(0.004, evalDim(spec.r ?? spec.rOuter, params, 0.05))
      const tr = Math.max(0.001, evalDim(spec.tubeRadius ?? spec.rInner, params, 0.01))
      return finalize(standUp(new THREE.TorusGeometry(r, tr, 20, 44)), Math.PI / 3)
    }
    case 'lathe': {
      const raw = spec.profile ?? [
        [0, -0.05],
        [0.04, -0.05],
        [0.04, 0.05],
        [0, 0.05],
      ]
      const pts: V2[] = raw.map(([rExpr, yExpr]) => [
        Math.max(0, evalDim(rExpr, params, 0.02)),
        evalDim(yExpr, params, 0),
      ])
      return lathe(pts, 44)
    }
    case 'extrude': {
      const raw = spec.polygon ?? [
        [-0.04, -0.04],
        [0.04, -0.04],
        [0.04, 0.04],
        [-0.04, 0.04],
      ]
      const shape = new THREE.Shape()
      raw.forEach(([xExpr, yExpr], idx) => {
        const x = evalDim(xExpr, params, 0)
        const y = evalDim(yExpr, params, 0)
        if (idx === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
      })
      shape.closePath()
      const depth = Math.max(0.002, evalDim(spec.depth ?? spec.h, params, 0.04))
      return extrude(shape, depth)
    }
    case 'gear':
    case 'bevelGear': {
      const teeth = Math.max(6, Math.min(120, Math.round(evalDim(spec.teeth, params, 20))))
      const m = Math.max(0.001, evalDim(spec.module, params, 0.004))
      const width = Math.max(0.003, evalDim(spec.h ?? spec.depth, params, 0.024))
      const bore = Math.max(0, evalDim(spec.rInner, params, (teeth * m) / 6))
      return standUp(gear({
        teeth,
        module: m,
        width,
        bore,
        // angles may be expressions of the model's values; anything that isn't a sensible number falls back,
        // never reaching the geometry as NaN (which blanks the whole gear)
        pressureAngleDeg: angleIn(evalDim(spec.pressureAngle, params, 20), 14.5, 30, 20),
        helixDeg: angleIn(evalDim(spec.helixAngle, params, 0), -45, 45, 0),
      }))
    }
    case 'sprocket': {
      const teeth = Math.max(8, Math.min(80, Math.round(evalDim(spec.teeth, params, 16))))
      const m = Math.max(0.0015, evalDim(spec.module, params, 0.004))
      const width = Math.max(0.003, evalDim(spec.h ?? spec.depth, params, 0.01))
      const bore = Math.max(0, evalDim(spec.rInner, params, (teeth * m) / 5))
      return standUp(
        gear({
          teeth,
          module: m,
          width,
          bore,
          pressureAngleDeg: 28,
        }),
      )
    }
    case 'pulley': {
      const rOuter = Math.max(0.015, evalDim(spec.rOuter ?? spec.r, params, 0.06))
      const rInner = Math.max(0.003, Math.min(rOuter * 0.45, evalDim(spec.rInner, params, 0.012)))
      const h = Math.max(0.008, evalDim(spec.h, params, 0.028))
      const hw = h / 2
      const grooveDepth = Math.min(rOuter * 0.18, hw * 0.75)
      return lathe(
        [
          [rInner, -hw],
          [rOuter, -hw],
          [rOuter, -hw * 0.45],
          [rOuter - grooveDepth, 0],
          [rOuter, hw * 0.45],
          [rOuter, hw],
          [rInner, hw],
        ],
        48,
      )
    }
    case 'rack': {
      const sx = Math.max(0.02, evalDim(spec.sx, params, 0.24))
      const sy = Math.max(0.008, evalDim(spec.sy, params, 0.024))
      const sz = Math.max(0.008, evalDim(spec.sz ?? spec.depth, params, 0.024))
      // a real rack: straight-sided teeth (20° flanks) along +Y, pitch π·module, tips at the top face, so it
      // reads as a rack and its teeth sit in the pinion's (it was drawn as a plain bar)
      const m = rackModule(spec, params)
      const pitch = Math.PI * m
      const n = Math.floor(sx / pitch)
      if (n < 2 || n > 400 || sy < 2.6 * m) return box(sx, sy, sz)
      const top = sy / 2
      const root = top - 2.25 * m
      const tan = Math.tan((20 * Math.PI) / 180)
      const tip = pitch / 4 - m * tan
      const foot = pitch / 4 + 1.25 * m * tan
      const shape = new THREE.Shape()
      shape.moveTo(-sx / 2, -sy / 2)
      shape.lineTo(sx / 2, -sy / 2)
      shape.lineTo(sx / 2, root)
      // teeth centred on multiples of the pitch from the rack's middle, right to left
      for (let i = Math.floor(n / 2); i >= -Math.floor(n / 2); i--) {
        const c = i * pitch
        if (c + foot > sx / 2 || c - foot < -sx / 2) continue
        shape.lineTo(c + foot, root)
        shape.lineTo(c + tip, top)
        shape.lineTo(c - tip, top)
        shape.lineTo(c - foot, root)
      }
      shape.lineTo(-sx / 2, root)
      shape.closePath()
      return extrude(shape, sz)
    }
    case 'spring': {
      const r = Math.max(0.005, evalDim(spec.r ?? spec.rOuter, params, 0.025))
      const wr = Math.max(0.001, evalDim(spec.wireRadius ?? spec.tubeRadius, params, 0.0035))
      const h = Math.max(0.01, evalDim(spec.h, params, 0.1))
      const turns = Math.max(2, Math.min(40, Math.round(evalDim(spec.turns, params, 6))))
      const g = helixSpring(r, wr, h, turns, true)
      return xform(g, mat4.t(0, -h / 2, 0))
    }
    case 'hexNut': {
      const d = Math.max(0.002, evalDim(spec.d ?? spec.rInner, params, 0.02))
      const h = Math.max(0.001, evalDim(spec.h, params, 0.8 * d))
      // the library nut stands on y = 0 at its standard height (0.8 d); scale it to h and centre it like the other shapes
      return xform(hexNut(d), mat4.c(mat4.t(0, -h / 2, 0), new THREE.Matrix4().makeScale(1, h / (0.8 * d), 1)))
    }
    case 'bearing': {
      // a standard rolling bearing, drawn from the lab rigs' own bearings (races, cage and rolling elements) and
      // scaled to its bore `d` (the shaft it sits on) and width `h`; its axis is Y, centred
      const kinds = { ball: ballBearing, roller: rollerBearing, taper: taperBearing, needle: needleBearing, thrust: thrustBearing }
      const ref = (kinds[spec.bearing ?? 'ball'] ?? ballBearing)()
      const bore = Math.max(0.004, evalDim(spec.d ?? (spec.rInner !== undefined ? `2 * (${spec.rInner})` : undefined), params, 0.04))
      const s = bore / 0.04
      const w = evalDim(spec.h, params, NaN)
      const sy = Number.isFinite(w) && w > 0 ? w / (ref.width * 0.001) : s
      const parts = [ref.inner, ref.outer, ref.cage].filter((g): g is THREE.BufferGeometry => !!g)
      if (ref.element) for (const m of ref.placements) parts.push(ref.element.clone().applyMatrix4(m))
      return xform(merge(...parts), new THREE.Matrix4().makeScale(s, sy, s))
    }
    case 'hexBolt': {
      const d = Math.max(0.002, evalDim(spec.d ?? spec.r, params, 0.016))
      const length = Math.max(d, evalDim(spec.h, params, 5 * d))
      return hexBolt(d, length)
    }
    default:
      // a shape this builder does not know (from an older or unexpected model) shows as a small block, never a crash
      return box(0.04, 0.04, 0.04)
  }
}

function shapeMatrix(
  pos: [number, number, number],
  rot: [number, number, number],
): THREE.Matrix4 {
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ'))
  m.compose(new THREE.Vector3(pos[0], pos[1], pos[2]), q, new THREE.Vector3(1, 1, 1))
  return m
}

/**
 * Compiles a list of `NoteShapeSpec` primitives and CSG boolean operations (`add`, `subtract`, `intersect`)
 * into a single watertight `THREE.BufferGeometry`.
 */

/** a finite angle within its range, or the fallback */
const angleIn = (v: number, min: number, max: number, fallback: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback)

/** a rack's module: as written, else from its height (the prompt's racks are about 3.5 modules tall) */
export function rackModule(spec: NoteShapeSpec, params: Record<string, number>) {
  const sy = Math.max(0.008, evalDim(spec.sy, params, 0.024))
  return Math.max(0.0005, evalDim(spec.module, params, sy / 3.5))
}

export function buildPartGeometry(
  shapes: NoteShapeSpec[],
  params: Record<string, number>,
): THREE.BufferGeometry {
  if (!Array.isArray(shapes) || !shapes.length) return box(0.05, 0.05, 0.05)

  const expanded: { op: 'add' | 'subtract' | 'intersect'; geom: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = []
  const uncut = shapes.every((s) => !s || typeof s !== 'object' || (s.op ?? 'add') === 'add')

  for (const s of shapes) {
    if (!s || typeof s !== 'object') continue
    const baseGeom = buildSingleShapeGeometry(s, params, uncut)
    const pos = evalVec3(s.position, params, [0, 0, 0])
    const rot = evalVec3(s.rotation, params, [0, 0, 0])
    const op = s.op ?? 'add'
    const count = Math.max(1, Math.min(32, Math.round(evalDim(s.radialCount, params, 1))))
    const pcdRadius = evalDim(s.radialRadius, params, 0)

    if (count > 1 && pcdRadius > 0) {
      for (let i = 0; i < count; i++) {
        const ang = (2 * Math.PI * i) / count
        const px = pos[0] + pcdRadius * Math.cos(ang)
        const pz = pos[2] + pcdRadius * Math.sin(ang)
        expanded.push({
          op,
          geom: baseGeom,
          matrix: shapeMatrix([px, pos[1], pz], rot),
        })
      }
    } else {
      expanded.push({
        op,
        geom: baseGeom,
        matrix: shapeMatrix(pos, rot),
      })
    }
  }

  const hasBoolean = expanded.some((e, i) => i > 0 && (e.op === 'subtract' || e.op === 'intersect'))

  if (!hasBoolean) {
    // Fast path: merge all transformed solids directly
    const transformed = expanded.map((e) => xform(e.geom, e.matrix))
    return transformed.length === 1 ? transformed[0] : merge(...transformed)
  }

  // CSG boolean evaluation path
  const first = xform(expanded[0].geom, expanded[0].matrix)
  const ops: CsgOp[] = expanded.slice(1).map((e) => ({
    op: e.op === 'subtract' ? 'sub' : e.op === 'intersect' ? 'and' : 'add',
    geometry: e.geom,
    matrix: e.matrix,
  }))

  try {
    return csg(first, ops)
  } catch {
    // Fallback if CSG encounters degenerate coplanar triangles
    const positives = expanded.filter((e) => e.op === 'add').map((e) => xform(e.geom, e.matrix))
    return positives.length ? merge(...positives) : first
  }
}
