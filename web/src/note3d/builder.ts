import * as THREE from 'three'
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
import { evalDim, evalVec3, type NoteShapeSpec } from './schema'

function buildSingleShapeGeometry(
  spec: NoteShapeSpec,
  params: Record<string, number>,
): THREE.BufferGeometry {
  switch (spec.kind) {
    case 'box': {
      const sx = Math.max(0.002, evalDim(spec.sx, params, 0.08))
      const sy = Math.max(0.002, evalDim(spec.sy, params, 0.08))
      const sz = Math.max(0.002, evalDim(spec.sz, params, 0.08))
      return box(sx, sy, sz)
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
      return finalize(new THREE.TorusGeometry(r, tr, 20, 44), Math.PI / 3)
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
      return gear({
        teeth,
        module: m,
        width,
        bore,
        pressureAngleDeg: spec.pressureAngle ?? 20,
        helixDeg: spec.helixAngle ?? 0,
      })
    }
    case 'sprocket': {
      const teeth = Math.max(8, Math.min(80, Math.round(evalDim(spec.teeth, params, 16))))
      const m = Math.max(0.0015, evalDim(spec.module, params, 0.004))
      const width = Math.max(0.003, evalDim(spec.h ?? spec.depth, params, 0.01))
      const bore = Math.max(0, evalDim(spec.rInner, params, (teeth * m) / 5))
      return gear({
        teeth,
        module: m,
        width,
        bore,
        pressureAngleDeg: 28,
      })
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
      return box(sx, sy, sz)
    }
    case 'spring': {
      const r = Math.max(0.005, evalDim(spec.r ?? spec.rOuter, params, 0.025))
      const wr = Math.max(0.001, evalDim(spec.wireRadius ?? spec.tubeRadius, params, 0.0035))
      const h = Math.max(0.01, evalDim(spec.h, params, 0.1))
      const turns = Math.max(2, Math.min(40, Math.round(evalDim(spec.turns, params, 6))))
      const g = helixSpring(r, wr, h, turns, true)
      return xform(g, mat4.t(0, -h / 2, 0))
    }
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
export function buildPartGeometry(
  shapes: NoteShapeSpec[],
  params: Record<string, number>,
): THREE.BufferGeometry {
  if (!shapes.length) return box(0.05, 0.05, 0.05)

  const expanded: { op: 'add' | 'subtract' | 'intersect'; geom: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = []

  for (const s of shapes) {
    const baseGeom = buildSingleShapeGeometry(s, params)
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
