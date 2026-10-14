import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, extrude, mat4, merge, tube, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { Particles, hash, plantsGeometry } from '../_shared/fx'
import { C, derive, live, useReq } from './model'

/** Field 20 × 12 m (x = head → tail), soil 2.6 m deep. Source and canal on the −X side. */
const FL = 20
const FW = 12
const X0 = -FL / 2
const DEPTH = 2.6
const NS = 24
const BUCKET = { x: 14, z: -5, r: 0.55, h: 2.2, pwp: 0.35, fc: 1.95 }
const line = (a: [number, number, number], b: [number, number, number]) => new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b))

const INFO = {
  source: { summary: 'Water source (reservoir / river intake).', role: 'W_i — the water introduced at the source. Conveyance efficiency E_c = W_d/W_i compares it with what reaches the field.' },
  canal: { summary: 'Conveyance canal.', role: 'Seepage and evaporation from the canal are the conveyance losses (W_i − W_d). Lining canals is one of the ways of eliminating losses.' },
  ditch: { summary: 'Field (head) ditch.', role: 'W_d — the water delivered to the field.' },
  field: { summary: 'Soil profile under the field.', role: 'Cut to see the stored water (W_s) in the root zone and any deep percolation below it.' },
  stored: { summary: 'Water stored in the root zone (W_s).', role: 'Application efficiency E_a = W_s/W_d; storage efficiency E_s = W_s/W_n, where W_n is the deficit before irrigation.' },
  deep: { summary: 'Deep percolation.', role: 'Water below the root zone: lost to the crop, but it can serve as the leaching requirement (salts carried down).' },
  root: { summary: 'Bottom of the root zone.', role: 'Root-zone deficit W_n = WHC × root depth × depletion × area.' },
  crop: { summary: 'Crop (maize).', role: 'Transpires; with evaporation from the soil this is the evapotranspiration (consumptive use) estimated by Blaney–Criddle or Jensen–Haise.' },
  drain: { summary: 'Tail drain (runoff).', role: 'Surface runoff leaving the tail of the field — a loss that lowers application efficiency.' },
  bucket: { summary: 'Soil-water “bucket”.', role: 'The root zone as a reservoir: full at field capacity, empty at the permanent wilting point. ET drains it; irrigation refills it when the depletion reaches the trigger (50–60 %).', details: 'Plant-available water = FC − PWP. Marks: blue FC, yellow trigger, red PWP.' },
}

export function Scene3D() {
  const st = useReq()
  const d = useMemo(() => derive(st), [st])
  const geo = useMemo(() => {
    const unitDown = xform(box(1, 1, 1), mat4.t(0.5, -0.5, 0))
    const canalShape = new THREE.Shape([
      new THREE.Vector2(-1.1, 0.05),
      new THREE.Vector2(-0.45, -0.6),
      new THREE.Vector2(0.45, -0.6),
      new THREE.Vector2(1.1, 0.05),
      new THREE.Vector2(0.95, 0.05),
      new THREE.Vector2(0.38, -0.5),
      new THREE.Vector2(-0.38, -0.5),
      new THREE.Vector2(-0.95, 0.05),
    ])
    const canal = xform(extrude(canalShape, 6.2), mat4.c(mat4.t(-17.2, 0, 0), mat4.ry(Math.PI / 2)))
    const canalWater = xform(box(6.2, 0.38, 0.9), mat4.t(-14.1, -0.31, 0))
    const ditch = merge(xform(box(0.9, 0.6, FW + 1.2), mat4.t(X0 - 0.6, -0.3, 0)))
    const ditchWater = xform(box(0.7, 0.4, FW + 1), mat4.t(X0 - 0.6, -0.28, 0))
    const drain = xform(box(0.9, 0.6, FW + 1.2), mat4.t(-X0 + 0.6, -0.3, 0))
    const drainWater = xform(box(0.7, 0.15, FW + 1), mat4.t(-X0 + 0.6, -0.5, 0))
    const res = merge(xform(box(4, 1.2, 0.3), mat4.t(-19.5, 0.3, -2)), xform(box(4, 1.2, 0.3), mat4.t(-19.5, 0.3, 2)), xform(box(0.3, 1.2, 4.3), mat4.t(-21.5, 0.3, 0)), xform(box(0.3, 0.5, 4.3), mat4.t(-17.5, -0.05, 0)), xform(box(4.3, 0.2, 4.3), mat4.t(-19.5, -0.4, 0)))
    const resWater = xform(box(3.7, 0.9, 3.7), mat4.t(-19.5, 0.15, 0))
    const pts: [number, number][] = []
    for (let z = -FW / 2 + 0.5; z < FW / 2; z += 0.9) for (let x = X0 + 0.5; x < -X0; x += 0.8) pts.push([x, z])
    const crop = plantsGeometry(pts, 1.1, 0.16, 0)
    const glass = tube(BUCKET.r + 0.04, BUCKET.r, BUCKET.h, 32)
    const marks = [BUCKET.fc, BUCKET.pwp].map((y) => xform(tube(BUCKET.r + 0.08, BUCKET.r + 0.03, 0.03, 32), mat4.t(0, y, 0)))
    const trig = tube(BUCKET.r + 0.08, BUCKET.r + 0.03, 0.03, 32)
    return { unitDown, canal, canalWater, ditch, ditchWater, drain, drainWater, res, resWater, crop, glass, marks, trig, water: xform(cylinder(BUCKET.r - 0.03, 1, 32), mat4.t(0, 0.5, 0)), root: box(FL, 0.025, FW) }
  }, [])
  const bucketMat = useMemo(() => createDynamicCutMaterial({ color: '#3d8fd1', hatch: 'fluid', roughness: 0.1 }), [])
  const water = useRef<THREE.Mesh>(null)
  const trigRef = useRef<THREE.Mesh>(null)
  const state = useRef({ a: 1, day: 0, irr: 0 })
  const col = useMemo(() => ({ blue: new THREE.Color('#3d8fd1'), red: new THREE.Color('#c0392b'), tmp: new THREE.Color() }), [])

  const slices = useMemo(() => {
    return Array.from({ length: NS }, (_, s) => {
      const x = X0 + ((s + 0.5) * FL) / NS
      const dep = st.dHead + ((st.dTail - st.dHead) * (x - X0)) / FL
      return { x: X0 + (s * FL) / NS, up: Math.min(dep, st.root), low: Math.max(0, dep - st.root) }
    })
  }, [st.dHead, st.dTail, st.root])

  useSimFrame((dt) => {
    const p = useReq.getState()
    const s = state.current
    const days = dt * p.speed
    s.day += days
    const trigger = 1 - p.depletion
    if (s.irr > 0) {
      s.a = Math.min(1, s.a + days * 3)
      s.irr -= days
      if (s.a >= 1) s.irr = 0
    } else {
      s.a -= (d.etDay * days) / d.taw
      if (s.a <= trigger) s.irr = 0.5
    }
    const lvl = BUCKET.pwp + (BUCKET.fc - BUCKET.pwp) * Math.max(0, s.a)
    if (water.current) water.current.scale.y = lvl
    if (trigRef.current) trigRef.current.position.y = BUCKET.pwp + (BUCKET.fc - BUCKET.pwp) * trigger
    const k = Math.max(0, Math.min(1, (s.a - trigger) / 0.15))
    col.tmp.copy(col.red).lerp(col.blue, k)
    bucketMat.material.color.copy(col.tmp)
    bucketMat.capColor.copy(col.tmp)
    live.day = s.day
    live.avail = s.a
    live.irrigating = s.irr > 0
  })

  const ev = d.ev
  const kSeep = 1 - ev.Ec
  const kRun = ev.runoff / ev.Wd
  const kDeep = Math.max(ev.deep / ev.Wd, d.LR * 0.5)
  const kET = Math.min(1, d.etDay / 8)
  const vapour = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const sp = 0.25 + 0.5 * kET
    const s = (t * sp * 0.4 + hash(i)) % 1
    out.set(X0 + 0.5 + hash(i + 1) * (FL - 1) + Math.sin(t + i) * 0.2, 1 + s * 4, -FW / 2 + 0.5 + hash(i + 2) * (FW - 1))
    return i / 220 < kET + 0.1 ? (1 - s) * 1.2 : 0
  }
  const seep = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const s = (t * 0.3 + hash(i)) % 1
    out.set(-17 + hash(i + 3) * 6, -0.65 - s * 1.6, (hash(i + 4) - 0.5) * 0.8)
    return i / 60 < kSeep * 1.5 ? 1 - s : 0
  }
  const deep = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const s = (t * 0.2 + hash(i)) % 1
    const x = X0 + hash(i + 5) * FL * 0.5
    out.set(x, -st.root - s * (DEPTH - st.root - 0.1), (hash(i + 6) - 0.5) * 1)
    return i / 80 < kDeep * 3 ? 1 - s : 0
  }
  const salts = (i: number, t: number, _dt: number, out: THREE.Vector3) => {
    const s = (t * 0.06 * (0.3 + d.LR * 4) + hash(i)) % 1
    out.set(X0 + 0.3 + hash(i + 8) * (FL - 0.6), -0.1 - s * (st.root + 0.4), (hash(i + 9) - 0.5) * 0.6)
    return 0.8
  }

  return (
    <group>
      <Part id="source" name="Source reservoir" role="housing" material="concrete" info={INFO.source} cites={[C.ipp('p3 E_c = W_d/W_i'), C.wrd('p1 eliminating losses')]}>
        <PartMesh geometry={geo.res} />
        <Part id="source-water" name="Stored water" role="fluid" material="water" info={INFO.source}>
          <PartMesh geometry={geo.resWater} />
        </Part>
      </Part>
      <Part id="canal" name="Conveyance canal" role="housing" material="concrete" info={INFO.canal} cites={[C.ipp('p3 conveyance efficiency'), C.wrd('p1 lining canals')]}>
        <PartMesh geometry={geo.canal} />
        <Part id="canal-water" name="Canal water" role="fluid" material="water" info={INFO.canal}>
          <PartMesh geometry={geo.canalWater} />
        </Part>
        <Flow curve={line([-17.5, -0.2, 0], [X0 - 0.6, -0.2, 0])} count={50} radius={0.08} color="#5ab4ff" speed={0.25} spread={0.5} intensity={() => 1} />
        <Particles count={60} radius={0.05} color="#7cc4ff" update={seep} />
      </Part>
      <Part id="head-ditch" name="Field ditch (W_d)" role="housing" material="concrete" info={INFO.ditch} cites={[C.ipp('p3 W_d delivered')]}>
        <PartMesh geometry={geo.ditch} />
        <Part id="ditch-water" name="Delivered water" role="fluid" material="water" info={INFO.ditch}>
          <PartMesh geometry={geo.ditchWater} />
        </Part>
        <Flow curve={line([X0 - 0.6, -0.15, 0], [X0 - 0.6, -0.15, FW / 2])} count={20} radius={0.07} color="#5ab4ff" speed={0.3} spread={0.3} intensity={() => 1} />
        <Flow curve={line([X0 - 0.6, -0.15, 0], [X0 - 0.6, -0.15, -FW / 2])} count={20} radius={0.07} color="#5ab4ff" speed={0.3} spread={0.3} intensity={() => 1} />
        <Flow curve={line([X0 - 0.2, 0.06, 0], [-X0, 0.06, 0])} count={60} radius={0.06} color="#7cc4ff" speed={0.12} spread={FW * 0.8} intensity={() => 1} />
      </Part>
      <Part id="field" name="Field soil profile" role="housing" material="soil" info={INFO.field} cites={[C.ipp('p3–5 efficiencies')]}>
        <PartMesh geometry={geo.unitDown} position={[X0, 0, 0]} scale={[FL, DEPTH, FW]} />
        <Part id="stored" name="Stored water W_s" role="fluid" material="water" info={INFO.stored} cites={[C.ipp('p3–4 E_a, E_s'), C.s1('Q3c')]}>
          {slices.map((s, i) => (
            <PartMesh key={i} geometry={geo.unitDown} position={[s.x, -0.002, 0]} scale={[FL / NS, Math.max(0.001, s.up), FW - 0.1]} />
          ))}
        </Part>
        <Part id="deep-percolation" name="Deep percolation" role="fluid" material="coolant" info={INFO.deep} cites={[C.ipp('p3 leaching requirement')]}>
          {slices.map((s, i) => (s.low > 0.001 ? <PartMesh key={i} geometry={geo.unitDown} position={[s.x, -st.root, 0]} scale={[FL / NS, s.low, FW - 0.1]} /> : null))}
        </Part>
        <Part id="root-zone" name="Root-zone depth" role="static" material="paintYellow" info={INFO.root} cites={[C.ipp('p4 W_n'), C.s1('Q3c 20 cm/m × 1.8 m × 0.6')]}>
          <PartMesh geometry={geo.root} position={[0, -st.root, 0]} />
        </Part>
        <Particles count={80} radius={0.06} color="#5ab4ff" update={deep} />
        <Particles count={70} radius={0.04} color="#f2f2f2" update={salts} emissive={0.5} />
      </Part>
      <Part id="crop" name="Crop" role="static" material="crop" info={INFO.crop} cites={[C.ipp('p1–2 consumptive use')]} cut={false}>
        <PartMesh geometry={geo.crop} />
        <Particles count={220} radius={0.09} color="#e8f4ff" update={vapour} opacity={0.45} emissive={0.4} />
      </Part>
      <Part id="tail-drain" name="Tail drain (runoff)" role="housing" material="soil" info={INFO.drain} cites={[C.ipp('p3–4 runoff'), C.s1('Q3c 50 L/s for 3 h')]}>
        <PartMesh geometry={geo.drain} />
        <Part id="runoff" name="Runoff" role="fluid" material="water" info={INFO.drain}>
          <PartMesh geometry={geo.drainWater} />
        </Part>
        <Flow curve={line([-X0 + 0.6, -0.4, -FW / 2], [-X0 + 0.6, -0.4, FW / 2 + 1.5])} count={30} radius={0.07} color="#5ab4ff" speed={0.25} spread={0.3} intensity={() => Math.min(1, kRun * 4)} />
      </Part>
      <Part id="bucket" name="Soil-water bucket" role="static" material="glass" info={INFO.bucket} cites={[C.sg('p4 FC, 50 % FC, PWP'), C.ipp('p5 time to irrigate')]} cut={false} position={[BUCKET.x, 0, BUCKET.z]}>
        <PartMesh geometry={geo.glass} position={[0, BUCKET.h / 2, 0]} />
        <PartMesh geometry={geo.marks[0]} material="paintBlue" />
        <PartMesh geometry={geo.marks[1]} material="paintRed" />
        <PartMesh ref={trigRef} geometry={geo.trig} material="paintYellow" />
        <PartMesh ref={water} geometry={geo.water} customMaterial={bucketMat.material} />
      </Part>
      <PartLabel partId="source" at={[-19.5, 1.5, 0]} />
      <PartLabel partId="canal" at={[-14, 0.8, 0]} />
      <PartLabel partId="stored" at={[X0 + 3, -0.6, FW / 2]} />
      <PartLabel partId="deep-percolation" at={[X0 + 1.5, -st.root - 0.4, FW / 2]} />
      <PartLabel partId="root-zone" at={[-X0 - 2, -st.root, FW / 2]} />
      <PartLabel partId="crop" at={[0, 1.8, 0]} />
      <PartLabel partId="tail-drain" at={[-X0 + 0.6, 0.6, 3]} />
      <PartLabel partId="bucket" at={[BUCKET.x, BUCKET.h + 0.4, BUCKET.z]} />
    </group>
  )
}
