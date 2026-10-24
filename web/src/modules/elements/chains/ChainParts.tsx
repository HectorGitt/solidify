import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { chainSprocket, linkPlate, rollerChain } from '@/parts/lib/elements'
import { Part, PartMesh } from '@/render/Part'
import { A503 } from '../_shared/cites'
import { InstancedPartMesh } from '@/render/InstancedPartMesh'
import { rollerPositions, sprocketAngle, type ChainLoop } from './model'

/** Chain and sprocket geometry: the shared parts library's (src/parts/lib/elements.ts). */
export { linkPlate }
export const chainGeometry = rollerChain
export const sprocketGeometry = chainSprocket

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
