import { Line } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { box, extrude, mat4, merge, roundedBox, xform } from '@/geometry'
import { Part, PartMesh } from '@/render/Part'
import type { Citation } from '@/content/citations'

/** a flat link from its pivot along +x, with a hole at each end */
export function flatBar(L: number, W: number, T: number) {
  const r = W / 2
  const s = new THREE.Shape()
  s.moveTo(0, -r)
  s.lineTo(L, -r)
  s.absarc(L, 0, r, -Math.PI / 2, Math.PI / 2, false)
  s.lineTo(0, r)
  s.absarc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false)
  for (const x of [0, L]) {
    const h = new THREE.Path()
    h.absarc(x, 0, r * 0.32, 0, Math.PI * 2, true)
    s.holes.push(h)
  }
  return extrude(s, T, { curveSegments: 14 })
}

/** A closed shape from a radius at each angle. */
export function polarShape(radiusAt: (a: number) => number, n = 240) {
  const s = new THREE.Shape()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = radiusAt(a)
    if (i === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a))
    else s.lineTo(r * Math.cos(a), r * Math.sin(a))
  }
  s.closePath()
  return s
}

/** the upright plate these rigs are mounted on, standing on two feet */
export function BenchPlate({ width, height, floor, cites }: { width: number; height: number; floor: number; cites?: Citation[] }) {
  const geo = useMemo(
    () => ({
      plate: xform(roundedBox(width, height, 0.012, 0.01), mat4.t(0, floor + 0.03 + height / 2, -0.012)),
      feet: merge(...[-1, 1].map((k) => xform(box(0.05, 0.03, 0.2), mat4.t((k * (width - 0.1)) / 2, floor + 0.015, -0.012)))),
    }),
    [width, height, floor],
  )
  return (
    <Part id="plate" name="Mounting plate" role="static" material="aluminium" info={{ summary: 'The rig’s upright plate.', role: 'Holds the bearings and guides square to one another.' }} cites={cites} cut={false} explode={[0, 0, -0.1]}>
      <PartMesh geometry={geo.plate} />
      <PartMesh geometry={geo.feet} material="paintGrey" />
    </Part>
  )
}

export function Trace({ points, color = '#d0631c' }: { points: [number, number, number][]; color?: string }) {
  return points.length > 1 ? <Line points={points} color={color} lineWidth={2} /> : null
}

export function ExamList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">{children}</ul>
}
