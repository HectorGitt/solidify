import { useMemo } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, merge, xform, mat4 } from '@/geometry'
import { greenhouse } from '@/parts/lib/structures'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Flow } from '@/render/Flow'
import { C, useGreenhouse, live } from './model'
import { GREENHOUSE, ventRateMid, ventFlow, solarLoad, riseFor } from '@/physics/structures'

const INFO = {
  frame: {
    summary: 'Greenhouse frame',
    role: 'Steel (galvanised) main frame, aluminium glazing bars.',
    details: 'Narrow open trusses are used to minimise shading.',
  },
  cladding: {
    summary: 'Greenhouse cladding',
    role: 'Covers the frame to trap heat and protect crops.',
  },
  vents: {
    summary: 'Ventilation and fans',
    role: 'Lowers temperature, reduces humidity, resupplies CO₂.',
  },
  doors: {
    summary: 'End doors',
    role: 'Natural ventilation when open.',
  },
  shading: {
    summary: 'Whitewash shading',
    role: 'Whitewash applied to the inside of the roof reduces solar heat gain in steady weather.',
  },
}

export function Scene3D() {
  const st = useGreenhouse()
  
  const A = st.bays * GREENHOUSE.bay * st.length
  const c = st.cladding === 'frp' ? 'polythene' : st.cladding
  const qSensible = solarLoad(800, c, st.whitewash ? 0.3 : 0) * A
  const qRate = ventRateMid(c)
  const Qactual = st.qFans * st.fanCapacity + (st.doorsOpen ? ventFlow(qRate, A) : 0)
  const dt = riseFor(qSensible, Qactual)
  
  const geom = useMemo(() => greenhouse({ bays: st.bays, bayW: GREENHOUSE.bay, L: st.length }), [st.bays, st.length])
  
  // Fans geometry
  const fansGeom = useMemo(() => {
    const W = st.bays * GREENHOUSE.bay
    const fanBox = box(0.6, 0.6, 0.2)
    const fs = []
    const spacing = W / (st.qFans + 1)
    for (let i = 0; i < st.qFans; i++) {
      fs.push(xform(fanBox, mat4.t(-W/2 + (i+1)*spacing, 2.0, st.length/2)))
    }
    return fs.length ? merge(...fs) : box(0,0,0)
  }, [st.bays, st.length, st.qFans])
  
  useSimFrame((_delta, _t) => {
    live.dt = dt
    live.qAir = Qactual
    live.floorArea = A
    live.loadW = qSensible
  })
  
  const material = st.cladding === 'glass' ? 'glass' : 'plastic'
  const W = st.bays * GREENHOUSE.bay
  
  const curves = useMemo(() => {
    const arr = []
    for(let i=0; i<5; i++) {
      arr.push(new THREE.LineCurve3(
        new THREE.Vector3(-W/2 + W*Math.random(), 1.0 + Math.random(), -st.length/2 - 2),
        new THREE.Vector3(-W/2 + W*Math.random(), 1.5 + Math.random(), st.length/2 + 2)
      ))
    }
    return arr
  }, [st.bays, st.length])

  const groundGeom = useMemo(() => box(1, 1, 1), [])
  return (
    <group>
      <Part id="ground" name="Site" role="static" material="crop" info={{ summary: "Level, well-drained site.", role: "Long axis set to the prevailing wind so the fans and end doors pull air down the house." }} cut={false}>
        <PartMesh geometry={groundGeom} position={[0, -0.1, 0]} scale={[70, 0.2, 90]} receiveShadow />
      </Part>
      <Part id="frame" name="Frame" role="housing" material="galvanised" info={INFO.frame} cites={[C.aee505('p29')]} cut={false}>
        <PartMesh geometry={geom.frame} />
      </Part>
      
      <Part id="cladding" name="Cladding" role="housing" material={material} info={INFO.cladding} cites={[C.aee505('p30')]} cut={true}>
        <PartMesh geometry={geom.cladding} material={material} />
        {st.whitewash && <PartMesh geometry={geom.cladding} material="paintGrey" />}
      </Part>
      
      <Part id="doors" name="End Doors" role="housing" material={material} info={INFO.doors} cites={[C.aee505('p30')]} cut={true}>
        <PartMesh geometry={geom.doors} material={material} visible={!st.doorsOpen} />
      </Part>
      
      <Part id="vents" name="Fans" role="static" material="steel" info={INFO.vents} cites={[C.aee505('p30')]} cut={false}>
        <PartMesh geometry={fansGeom} material="paintBlue" />
      </Part>
      
      {Qactual > 0 && curves.map((c, i) => (
        <Flow key={i} curve={c} count={20} radius={0.05} color="#88ccff" intensity={() => 1} speed={1.5 + (st.qFans * 0.1)} />
      ))}
      
      <PartLabel partId="frame" at={[-W/2, 2.9, 0]} />
      <PartLabel partId="cladding" at={[0, 3.2, 0]} />
      {st.qFans > 0 && <PartLabel partId="vents" at={[0, 2.0, st.length/2]} />}
    </group>
  )
}
