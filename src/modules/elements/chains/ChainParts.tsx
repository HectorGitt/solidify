import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { cylinder, extrude, lathe, mat4, merge, tube, xform } from '@/geometry'
import { sprocket } from '@/geometry/parts'
import { Part, PartMesh } from '@/render/Part'
import { A503 } from '../_shared/cites'
import { InstancedPartMesh } from '../_shared/InstancedPartMesh'
import { chainDims, rollerPositions, sprocketAngle, type ChainLoop } from './model'

const { PI } = Math
const along = mat4.rx(PI / 2)

/** Waisted (figure-of-eight) link plate with two holes, pitch p apart, in XY, thickness along Z. */
export function linkPlate(p: number, h: number, holeR: number, t: number) {
  const r = h / 2
  const w = h * 0.36
  const a = (52 * PI) / 180
  const s = new THREE.Shape()
  s.moveTo(-p / 2 + r * Math.cos(a), r * Math.sin(a))
  s.absarc(-p / 2, 0, r, a, 2 * PI - a, false)
  s.quadraticCurveTo(0, -w, p / 2 - r * Math.cos(a), -r * Math.sin(a))
  s.absarc(p / 2, 0, r, PI + a, 3 * PI - a, false)
  s.quadraticCurveTo(0, w, -p / 2 + r * Math.cos(a), r * Math.sin(a))
  for (const x of [-p / 2, p / 2]) {
    const hole = new THREE.Path()
    hole.absarc(x, 0, holeR, 0, 2 * PI, true)
    s.holes.push(hole)
  }
  return extrude(s, t, { curveSegments: 14 })
}

export function chainGeometry(p: number, strands: 1 | 2) {
  const d = chainDims(p)
  const span = (strands - 1) * d.transverse
  return {
    d,
    roller: xform(tube(d.roller / 2, d.bush / 2 + 0.0001, d.inner * 0.94, 20), along),
    bush: xform(tube(d.bush / 2, d.pin / 2 + 0.00005, d.inner + 2 * d.tp, 16), along),
    pin: xform(lathe([[0, -(span + d.inner) / 2 - 2 * d.tp - 0.0012], [d.pin / 2, -(span + d.inner) / 2 - 2 * d.tp - 0.0012], [d.pin / 2 * 1.12, -(span + d.inner) / 2 - 2 * d.tp - 0.0006], [d.pin / 2 * 1.12, (span + d.inner) / 2 + 2 * d.tp + 0.0006], [d.pin / 2, (span + d.inner) / 2 + 2 * d.tp + 0.0012], [0, (span + d.inner) / 2 + 2 * d.tp + 0.0012]], 12), along),
    inner: linkPlate(p, d.h * 0.96, d.bush / 2, d.tp),
    outer: linkPlate(p, d.h, d.pin / 2, d.tp),
    zInner: d.inner / 2 + d.tp / 2,
    zOuter: d.inner / 2 + d.tp * 1.5 + 0.0002,
    span,
  }
}

/** Simplex or duplex sprocket (axis Z) with hub. */
export function sprocketGeometry(z: number, p: number, strands: 1 | 2, bore = 0.012) {
  const d = chainDims(p)
  const w = d.inner * 0.88
  const R = p / (2 * Math.sin(PI / z))
  const rings: THREE.BufferGeometry[] = []
  for (let k = 0; k < strands; k++) rings.push(xform(sprocket(z, p, d.roller, w, bore), mat4.t(0, 0, (k - (strands - 1) / 2) * d.transverse)))
  const hubR = Math.min(R - d.roller, Math.max(bore * 2.2, R * 0.35))
  const hubL = (strands - 1) * d.transverse + w + 0.03
  const hub = xform(tube(hubR, bore, hubL, 32), mat4.c(mat4.t(0, 0, -0.012), along))
  const key = xform(cylinder(bore * 0.3, hubL, 8), mat4.c(mat4.t(0, bore, -0.012), along))
  return merge(...rings, hub, key)
}

const INFO = {
  chain: { summary: 'Roller chain: alternate inner (roller) links and outer (pin) links.', role: 'Transmits power without slip, compactly; needs lubrication, is noisier and dearer than a belt.' },
  rollers: { summary: 'Rollers.', role: 'Turn freely on the bushes so the chain rolls — not rubs — into the sprocket tooth seats.' },
  bushes: { summary: 'Bushes.', role: 'Pressed into the inner plates; the pin turns inside the bush as the chain articulates over the sprocket.' },
  pins: { summary: 'Pins.', role: 'Pressed into the outer plates; joint between inner and outer links. In a duplex chain one long pin carries both strands.' },
  innerPlates: { summary: 'Inner (roller-link) plates.', role: 'Hold the two bushes of each roller link.' },
  outerPlates: { summary: 'Outer (pin-link) plates.', role: 'Hold the two pins of each pin link, outside the inner plates.' },
}

const CHAIN_CITES = [A503.m(3, 'roller chain'), A503.manual('chain drives'), A503.mg15('Q2 types of chain')]

/**
 * An instanced roller chain following a ChainLoop. `m0()` gives the material coordinate of
 * roller 0 each frame. Exploding pulls the plates and pins out sideways to show how they nest.
 */
export function ChainStrands({ cl, p, strands, m0, z = 0, idPrefix = '' }: { cl: ChainLoop; p: number; strands: 1 | 2; m0: () => number; z?: number; idPrefix?: string }) {
  const g = useMemo(() => chainGeometry(p, strands), [p, strands])
  const N = cl.links
  const per = strands * N
  const refs = {
    roller: useRef<THREE.InstancedMesh>(null),
    bush: useRef<THREE.InstancedMesh>(null),
    pin: useRef<THREE.InstancedMesh>(null),
    innerF: useRef<THREE.InstancedMesh>(null),
    innerB: useRef<THREE.InstancedMesh>(null),
    outerF: useRef<THREE.InstancedMesh>(null),
    outerB: useRef<THREE.InstancedMesh>(null),
  }
  const pos = useMemo<THREE.Vector3[]>(() => [], [])
  const o = useMemo(() => new THREE.Object3D(), [])

  useSimFrame(() => {
    rollerPositions(cl, m0(), pos)
    const counters = { innerF: 0, innerB: 0, outerF: 0, outerB: 0, roller: 0, bush: 0, pin: 0 }
    const put = (key: keyof typeof refs, x: number, y: number, zz: number, ang: number) => {
      const mesh = refs[key].current
      if (!mesh) return
      o.position.set(x, y, zz)
      o.rotation.set(0, 0, ang)
      o.updateMatrix()
      mesh.setMatrixAt(counters[key]++, o.matrix)
    }
    for (let j = 0; j < N; j++) {
      const a = pos[j]
      const b = pos[(j + 1) % N]
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      put('pin', a.x, a.y, 0, 0)
      for (let k = 0; k < strands; k++) {
        const zc = (k - (strands - 1) / 2) * g.d.transverse
        put('roller', a.x, a.y, zc, 0)
        put('bush', a.x, a.y, zc, 0)
        if (j % 2 === 0) {
          put('innerF', mx, my, zc + g.zInner, ang)
          put('innerB', mx, my, zc - g.zInner, ang)
        } else {
          put('outerF', mx, my, zc + g.zOuter, ang)
          put('outerB', mx, my, zc - g.zOuter, ang)
        }
      }
    }
    for (const key of Object.keys(refs) as (keyof typeof refs)[]) {
      const mesh = refs[key].current
      if (!mesh) continue
      mesh.count = counters[key]
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  const e = g.d.h * 2.2
  return (
    <group position={[0, 0, z]}>
      <Part id={`${idPrefix}chain`} name={strands === 2 ? 'Duplex roller chain' : 'Simplex roller chain'} role="moving" material="steelDark" info={INFO.chain} cites={CHAIN_CITES}>
        <Part id={`${idPrefix}rollers`} name="Rollers" material="steel" info={INFO.rollers} cites={CHAIN_CITES}>
          <InstancedPartMesh ref={refs.roller} geometry={g.roller} count={per} />
        </Part>
        <Part id={`${idPrefix}bushes`} name="Bushes" material="bronze" info={INFO.bushes} cites={CHAIN_CITES} explode={[0, 0, e * 0.15]}>
          <InstancedPartMesh ref={refs.bush} geometry={g.bush} count={per} />
        </Part>
        <Part id={`${idPrefix}pins`} name="Pins" material="chrome" info={INFO.pins} cites={CHAIN_CITES} explode={[0, 0, e * 1.6]}>
          <InstancedPartMesh ref={refs.pin} geometry={g.pin} count={N} />
        </Part>
        <Part id={`${idPrefix}inner-plates`} name="Inner plates" material="steelDark" info={INFO.innerPlates} cites={CHAIN_CITES}>
          <Part id={`${idPrefix}inner-front`} name="Inner plates (front)" explode={[0, 0, e * 0.5]}>
            <InstancedPartMesh ref={refs.innerF} geometry={g.inner} count={per} />
          </Part>
          <Part id={`${idPrefix}inner-back`} name="Inner plates (back)" explode={[0, 0, -e * 0.5]}>
            <InstancedPartMesh ref={refs.innerB} geometry={g.inner} count={per} />
          </Part>
        </Part>
        <Part id={`${idPrefix}outer-plates`} name="Outer plates" material="forged" info={INFO.outerPlates} cites={CHAIN_CITES}>
          <Part id={`${idPrefix}outer-front`} name="Outer plates (front)" explode={[0, 0, e]}>
            <InstancedPartMesh ref={refs.outerF} geometry={g.outer} count={per} />
          </Part>
          <Part id={`${idPrefix}outer-back`} name="Outer plates (back)" explode={[0, 0, -e]}>
            <InstancedPartMesh ref={refs.outerB} geometry={g.outer} count={per} />
          </Part>
        </Part>
      </Part>
    </group>
  )
}

/** A sprocket turning in step with the chain. */
export function SprocketPart({ id, name, cl, i, z, p, strands, m0, at, zOffset = 0, info, material = 'steel' }: { id: string; name: string; cl: ChainLoop; i: number; z: number; p: number; strands: 1 | 2; m0: () => number; at: [number, number]; zOffset?: number; info: { summary: string; role: string }; material?: 'steel' | 'castIron' | 'forged' }) {
  const geo = useMemo(() => sprocketGeometry(z, p, strands), [z, p, strands])
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => {
    ref.current?.rotation.set(0, 0, sprocketAngle(cl, i, z, m0()))
  })
  return (
    <Part id={id} name={name} role="moving" material={material} info={info} cites={[A503.m(3, 'sprocket teeth'), A503.table('chain selection')]}>
      <group position={[at[0], at[1], zOffset]}>
        <group ref={ref}>
          <PartMesh geometry={geo} />
        </group>
      </group>
    </Part>
  )
}
