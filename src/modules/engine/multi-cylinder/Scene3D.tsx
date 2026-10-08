import { Html } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { tube, xform, mat4 } from '@/geometry'
import { pinHeight } from '@/physics/engine'
import { lastFired } from '@/physics/engineExtra'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { conRod, crankshaft, mainJournalZ, piston } from './crank'
import { CRANK, DECK, INJ_X, blockLength, getMultiGeometry } from './geometry'
import { DIM, SC, STROKE_COLOR, currentLayout, cylZ, cylinderState, live, useMulti } from './model'

const { PI } = Math

const C = {
  crank: [SRC.tb509('§2.6.4, Fig 2.5 crankshafts for 2-, 3-, 4- and 6-cylinder engines')],
  firing: [SRC.l4_509('firing order, advantages'), SRC.tb509('§2.6.4, Table 2.3')],
  parts: [SRC.l4_509('Parts description'), SRC.tb509('Table 2.1, Fig 2.1')],
  cool: [SRC.supp509('cooling'), SRC.tb509('Ch 7')],
  lube: [SRC.supp509('lubrication'), SRC.tb509('Ch 6')],
}

const INFO = {
  engine: {
    summary: 'Inline four-stroke tractor diesel with 2, 3, 4, 6 or 8 cylinders on one crankshaft (80 × 90 mm per cylinder, typical proportions).',
    details: 'Choose the number of cylinders and the firing order in the Controls tab. The crankshaft is rebuilt so its throws match the firing order you pick.',
  },
  block: {
    summary: 'Cylinder block and crankcase in one casting.',
    role: 'Holds the cylinder liners in a water jacket and carries the crankshaft in main bearings in the cross-walls (bulkheads) between the throws.',
  },
  liners: { summary: 'Wet cylinder liners.', role: 'Replaceable sleeves the pistons slide in; coolant touches their outside.' },
  coolant: { summary: 'Coolant in the water jacket.', role: 'Carries heat from the liners to the radiator.' },
  mains: { summary: 'Main-bearing shells.', role: 'Plain bearings in each bulkhead that support the crankshaft journals.' },
  head: { summary: 'Cylinder head (one casting for all cylinders).', role: 'Closes the cylinders and carries an injector for each one.' },
  injectors: { summary: 'Injectors, one per cylinder.', role: 'Spray fuel into each cylinder in turn, in firing order (the injection pump delivers in firing order).' },
  cover: { summary: 'Rocker cover.', role: 'Encloses the valve gear (not drawn in this scene).' },
  sump: { summary: 'Sump (oil pan).', role: 'Holds the engine oil below the crankshaft.' },
  oil: { summary: 'Engine oil.' },
  exhaust: { summary: 'Exhaust manifold.', role: 'Collects the exhaust from every cylinder.' },
  crankshaft: {
    summary: 'Crankshaft: one throw per cylinder, main journals between the throws.',
    role: 'Its shape fixes where every piston is at any moment, and therefore the firing order the engine can use. In a four-cylinder engine pistons 1 & 4 travel together, and so do 2 & 3; a two-cylinder crank has its pins 180° apart.',
  },
  flywheel: {
    summary: 'Flywheel.',
    role: 'Multi-cylinder engines need a smaller, lighter flywheel than a single: the power strokes come more often, so there is less to carry the crankshaft through.',
  },
  pulley: { summary: 'Crankshaft pulley (front).', role: 'Drives the fan, water pump and alternator.' },
  rods: { summary: 'Connecting rods.', role: 'Link each piston to its crank pin.' },
  pistons: { summary: 'Pistons with gudgeon pins.', role: 'Each one is driven down by its own power stroke in turn.' },
  gas: {
    summary: 'Gas in each cylinder, coloured by stroke.',
    role: 'Blue = intake, green = compression, orange = power (bright at the moment of firing), grey = exhaust — the same colours as the firing chart.',
  },
}

const MAX = 8

export function Multi3D() {
  const g = getMultiGeometry()
  const n = useMulti((s) => s.n)
  const layoutId = useMulti((s) => s.layout)
  const gasOn = useMulti((s) => s.gas)
  const layout = currentLayout(n, layoutId)
  const cg = g.byCount[n]
  const L = blockLength(n)

  const crank = useMemo(() => crankshaft(CRANK, layout.firing.map((f, i) => ({ z: cylZ(i + 1, n), firingDeg: f })), DIM.pitch), [n, layout])
  const pist = useMemo(() => piston({ bore: DIM.bore, comp: DIM.pistonComp, skirt: DIM.pistonSkirt }), [])
  const rod = useMemo(() => conRod(DIM.rodL, CRANK.pinR + 0.0003, DIM.bore * 0.14 + 0.0002, 0.026), [])
  const shells = useMemo(() => {
    const zs = mainJournalZ(Array.from({ length: n }, (_, i) => cylZ(i + 1, n)), DIM.pitch)
    const t = tube(CRANK.journalR + 0.0024, CRANK.journalR + 0.0003, 0.028, 36)
    return zs.map((z) => xform(t, mat4.c(mat4.t(0, 0, z), mat4.rx(PI / 2))))
  }, [n])

  const theta = useRef(0)
  const crankRef = useRef<THREE.Group>(null)
  const pistons = useRef<(THREE.Group | null)[]>([])
  const rods = useRef<(THREE.Group | null)[]>([])
  const cols = useRef<(THREE.Mesh | null)[]>([])
  const tags = useRef<(HTMLDivElement | null)[]>([])
  const mats = useMemo(() => Array.from({ length: MAX }, () => createDynamicCutMaterial({ color: '#4f8fd0', hatch: 'fluid', roughness: 0.6, emissive: '#000000' })), [])
  const tmp = useMemo(() => new THREE.Color(), [])

  useSimFrame((dt) => {
    const st = useMulti.getState()
    const lay = currentLayout(st.n, st.layout)
    theta.current = (theta.current + st.rpm * 6 * dt) % 1440
    const th = theta.current
    crankRef.current?.rotation.set(0, 0, (th * PI) / 180)
    const R = DIM.crankR
    const inter = useView.getState().cut.intersection
    for (let i = 0; i < st.n; i++) {
      const f = lay.firing[i]
      const a = ((th - f) * PI) / 180
      const z = cylZ(i + 1, st.n)
      const pin = pinHeight(SC, a)
      pistons.current[i]?.position.set(0, pin, z)
      const r = rods.current[i]
      if (r) {
        r.position.set(-R * Math.sin(a), R * Math.cos(a), z)
        r.rotation.set(0, 0, -Math.asin((R * Math.sin(a)) / DIM.rodL))
      }
      const crown = pin + DIM.pistonComp
      const col = cols.current[i]
      if (col) {
        col.position.set(0, crown, z)
        col.scale.y = Math.max(1e-4, DECK - crown)
      }
      const cs = cylinderState(th % 720, f)
      const m = mats[i]
      tmp.set(STROKE_COLOR[cs.stroke])
      let glow = 0
      if (cs.stroke === 'compression') tmp.lerp(new THREE.Color('#d8c35a'), (cs.psi - 180) / 180)
      if (cs.stroke === 'power') {
        const u = (cs.psi - 360) / 180
        glow = Math.max(0, 1 - u * 1.6)
        tmp.lerp(new THREE.Color('#fff1c9'), glow * 0.7)
      }
      m.material.color.copy(tmp)
      m.capColor.copy(tmp)
      m.material.emissive.setRGB(1, 0.45, 0.12).multiplyScalar(glow * 0.9)
      m.material.clipIntersection = inter
      const tag = tags.current[i]
      if (tag) {
        tag.style.background = cs.stroke === 'power' && glow > 0.05 ? `rgba(232,121,79,${0.35 + 0.65 * glow})` : 'rgba(12,17,15,0.75)'
        tag.style.borderColor = STROKE_COLOR[cs.stroke]
      }
    }
    const lf = lastFired(lay.firing, th % 720)
    live.theta = th % 720
    live.lastFired = lf.cylinder
    live.sinceFire = lf.since
  })

  const zs = Array.from({ length: n }, (_, i) => cylZ(i + 1, n))

  return (
    <group>
      <Part id="engine" name={`${n}-cylinder inline engine`} role="housing" material="castIron" info={INFO.engine} cites={C.crank}>
        <Part id="block" name="Cylinder block & crankcase" material="castIron" role="housing" info={INFO.block} cites={C.parts}>
          <PartMesh geometry={cg.block} />
          <Part id="liners" name="Cylinder liners" material="steelDark" role="static" info={INFO.liners} cites={[SRC.man509('liner (sleeve)')]}>
            {zs.map((z, i) => (
              <PartMesh key={i} geometry={g.liner} position={[0, 0, z]} />
            ))}
          </Part>
          <Part id="coolant" name="Coolant" material="coolant" role="fluid" info={INFO.coolant} cites={C.cool}>
            <PartMesh geometry={cg.coolant} />
          </Part>
          <Part id="main-bearings" name="Main bearings" material="bearing" role="static" info={INFO.mains} cites={[SRC.l4_509('bearings')]}>
            {shells.map((s, i) => (
              <PartMesh key={i} geometry={s} />
            ))}
          </Part>
        </Part>
        <Part id="head-assembly" name="Cylinder head assembly" role="housing" explode={[0, 0.2, 0]}>
          <group position={[0, DECK, 0]}>
            <Part id="head" name="Cylinder head" material="castIron" role="housing" info={INFO.head} cites={C.parts}>
              <PartMesh geometry={cg.head} />
            </Part>
            <Part id="cover" name="Rocker cover" material="paintGreen" role="housing" info={INFO.cover} explode={[0, 0.1, 0]}>
              <PartMesh geometry={cg.cover} />
            </Part>
            <Part id="injectors" name="Injectors" material="steel" role="static" info={INFO.injectors} cites={[SRC.tb509('p25, Fig 4.9')]} explode={[0.04, 0.12, 0]}>
              {zs.map((z, i) => (
                <PartMesh key={i} geometry={g.injector} position={[INJ_X, 0.001, z]} />
              ))}
            </Part>
          </group>
        </Part>
        <Part id="sump" name="Sump" material="paintGrey" role="housing" info={INFO.sump} cites={C.lube} explode={[0, -0.16, 0]}>
          <PartMesh geometry={cg.sump} />
          <Part id="oil" name="Engine oil" material="oil" role="fluid" info={INFO.oil} cites={C.lube}>
            <PartMesh geometry={cg.oil} />
          </Part>
        </Part>
        <Part id="exhaust" name="Exhaust manifold" material="castIron" role="housing" cut={false} info={INFO.exhaust} explode={[0.12, 0, 0]}>
          <PartMesh geometry={cg.exhaust} position={[0, DECK, 0]} />
        </Part>

        <Part id="crank-assembly" name="Crankshaft, flywheel & pulley" role="moving" material="forged" info={INFO.crankshaft} cites={C.crank}>
          <group ref={crankRef}>
            <Part id="crankshaft" name="Crankshaft" material="forged" info={INFO.crankshaft} cites={C.crank} explode={[0, -0.14, 0]}>
              <PartMesh geometry={crank.geometry} />
            </Part>
            <Part id="flywheel" name="Flywheel" material="castIron" info={INFO.flywheel} cites={[SRC.tb509('p11')]} explode={[0, -0.14, -0.12]}>
              <PartMesh geometry={g.flywheel} position={[0, 0, crank.back]} />
            </Part>
            <Part id="pulley" name="Crankshaft pulley" material="castIron" info={INFO.pulley} explode={[0, -0.14, 0.1]}>
              <PartMesh geometry={g.pulley} position={[0, 0, crank.front - 0.03]} />
            </Part>
          </group>
        </Part>
        <Part id="conrods" name="Connecting rods" material="forged" role="moving" info={INFO.rods} cites={C.parts} explode={[0, -0.04, 0]}>
          {zs.map((_, i) => (
            <group key={i} ref={(el) => void (rods.current[i] = el)}>
              <PartMesh geometry={rod} />
            </group>
          ))}
        </Part>
        <Part id="pistons" name="Pistons" material="aluminium" role="moving" info={INFO.pistons} cites={C.parts} explode={[0, 0.1, 0]}>
          {zs.map((_, i) => (
            <group key={i} ref={(el) => void (pistons.current[i] = el)}>
              <PartMesh geometry={pist.body} />
              <PartMesh geometry={pist.pin} material="steel" />
            </group>
          ))}
        </Part>
        {gasOn ? (
          <Part id="gas" name="Cylinder gas" role="fluid" info={INFO.gas} cites={C.firing}>
            {zs.map((_, i) => (
              <PartMesh key={i} ref={(el) => void (cols.current[i] = el)} geometry={g.gas} customMaterial={mats[i].material} castShadow={false} />
            ))}
          </Part>
        ) : null}
      </Part>

      {zs.map((z, i) => (
        <Html key={`${n}-${i}`} position={[0.03, DECK + 0.165, z]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div
            ref={(el) => void (tags.current[i] = el)}
            style={{ border: '1.5px solid #4f8fd0', borderRadius: 6, padding: '1px 6px', font: '600 12px Inter, sans-serif', color: '#e8efe9', background: 'rgba(12,17,15,0.75)' }}
          >
            {i + 1}
          </div>
        </Html>
      ))}

      <PartLabel partId="crankshaft" at={[0.1, -0.06, L / 2 - 0.05]} />
      <PartLabel partId="flywheel" at={[0.12, 0.12, crank.back - 0.02]} />
      <PartLabel partId="pistons" at={[0.06, 0.2, zs[0]]} />
      <PartLabel partId="conrods" at={[0.06, 0.08, zs[n - 1]]} />
      <PartLabel partId="block" at={[0.11, 0.06, 0]} />
      <PartLabel partId="head" at={[0.09, DECK + 0.04, zs[n - 1]]} />
      <PartLabel partId="injectors" at={[0.03, DECK + 0.13, zs[0]]} />
      <PartLabel partId="sump" at={[0.12, -0.13, 0]} />
    </group>
  )
}
