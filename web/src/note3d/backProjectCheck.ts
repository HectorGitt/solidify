import * as THREE from 'three'
import { buildPartGeometry } from './builder'
import { evalVec3, type NotePartSpec, type NoteSceneSpec } from './schema'

export interface BackProjectionResult {
  passed: boolean
  /** 0..1 similarity/sanity score between the 3D part projection and expected 2D drawing envelope */
  score: number
  /** Projected 2D width-to-height aspect ratio in the front orthographic view */
  projectedAspect: number
  /** Projected 2D silhouette fill ratio (0..1) inside the 2D bounding rectangle */
  fillRatio: number
  /** Human-readable reason if a check failed or scored low */
  reason?: string
}

function collectPartBoxes(
  parts: NotePartSpec[],
  params: Record<string, number>,
  parentOffset: [number, number, number] = [0, 0, 0],
  out: THREE.Box3[] = [],
): THREE.Box3[] {
  for (const part of parts) {
    const geom = buildPartGeometry(part.shapes, params)
    geom.computeBoundingBox()
    const pos = evalVec3(part.position, params, [0, 0, 0])
    const worldPos: [number, number, number] = [
      parentOffset[0] + pos[0],
      parentOffset[1] + pos[1],
      parentOffset[2] + pos[2],
    ]
    if (geom.boundingBox && !geom.boundingBox.isEmpty()) {
      const b = geom.boundingBox.clone()
      b.translate(new THREE.Vector3(...worldPos))
      out.push(b)
    }
    if (part.children?.length) {
      collectPartBoxes(part.children, params, worldPos, out)
    }
  }
  return out
}

/**
 * Projects a built `NoteSceneSpec` assembly onto the 2D orthographic front plane (X-Y)
 * on a raster occupancy grid, checking:
 * 1. Every part produces a valid, non-empty 3D bounding volume.
 * 2. Parts are not floating disjointly far apart from the assembly core.
 * 3. The 2D projected silhouette has a sensible aspect ratio and occupancy compared to the 2D figure box.
 */
export function verifyBackProjection(
  spec: NoteSceneSpec,
  params?: Record<string, number>,
  expectedBoxAspect = 1.6,
): BackProjectionResult {
  const paramMap =
    params ?? Object.fromEntries(spec.parameters.map((p) => [p.id, p.value]))

  if (!spec.parts.length) {
    return {
      passed: false,
      score: 0,
      projectedAspect: 1,
      fillRatio: 0,
      reason: 'No 3D parts were generated.',
    }
  }

  const boxes = collectPartBoxes(spec.parts, paramMap)
  if (boxes.length !== spec.parts.length && boxes.length === 0) {
    return {
      passed: false,
      score: 0,
      projectedAspect: 1,
      fillRatio: 0,
      reason: 'Generated geometry has empty bounding volume.',
    }
  }

  const union = new THREE.Box3()
  for (const b of boxes) union.union(b)

  const size = new THREE.Vector3()
  union.getSize(size)
  const w = Math.max(size.x, size.z)
  const h = size.y

  if (w < 1e-4 || h < 1e-4) {
    return {
      passed: false,
      score: 0.1,
      projectedAspect: 1,
      fillRatio: 0,
      reason: 'Projected 2D silhouette is degenerate (near-zero width or height).',
    }
  }

  // Check if any part is disconnected (floating far away from the rest of the assembly)
  let disconnectedCount = 0
  if (boxes.length > 1) {
    const tol = Math.max(w, h) * 0.25
    for (let i = 0; i < boxes.length; i++) {
      const expanded = boxes[i].clone().expandByScalar(tol)
      const touchesOther = boxes.some((other, j) => i !== j && expanded.intersectsBox(other))
      if (!touchesOther) disconnectedCount++
    }
  }

  if (disconnectedCount > 0) {
    return {
      passed: false,
      score: 0.35,
      projectedAspect: w / h,
      fillRatio: 0.2,
      reason: `${disconnectedCount} part(s) are floating disconnected from the assembly.`,
    }
  }

  // Rasterize 2D orthographic projection onto a 24×24 grid to measure silhouette occupancy
  const GRID = 24
  let occupiedCells = 0
  const xMin = union.min.x
  const xSpan = Math.max(1e-5, union.max.x - union.min.x)
  const yMin = union.min.y
  const ySpan = Math.max(1e-5, union.max.y - union.min.y)

  for (let gx = 0; gx < GRID; gx++) {
    const x0 = xMin + (gx / GRID) * xSpan
    const x1 = xMin + ((gx + 1) / GRID) * xSpan
    for (let gy = 0; gy < GRID; gy++) {
      const y0 = yMin + (gy / GRID) * ySpan
      const y1 = yMin + ((gy + 1) / GRID) * ySpan
      const hit = boxes.some(
        (b) => b.max.x >= x0 && b.min.x <= x1 && b.max.y >= y0 && b.min.y <= y1,
      )
      if (hit) occupiedCells++
    }
  }

  const fillRatio = occupiedCells / (GRID * GRID)
  const projectedAspect = w / h

  // Compare projected aspect against reasonable engineering drawing proportions
  const aspectRatioDiff = Math.abs(Math.log(Math.max(0.25, projectedAspect) / Math.max(0.25, expectedBoxAspect)))
  const aspectScore = Math.max(0, 1 - aspectRatioDiff * 0.35)
  const fillScore = fillRatio >= 0.12 && fillRatio <= 0.98 ? 1 : 0.4

  const score = Number((aspectScore * 0.55 + fillScore * 0.45).toFixed(2))
  const passed = score >= 0.65

  return {
    passed,
    score,
    projectedAspect: Number(projectedAspect.toFixed(2)),
    fillRatio: Number(fillRatio.toFixed(2)),
    reason: passed ? undefined : '2D back-projection silhouette differs significantly from figure proportions.',
  }
}
