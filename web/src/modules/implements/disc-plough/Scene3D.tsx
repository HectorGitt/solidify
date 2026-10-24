import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { helixSpring, merge } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { PROFILES, createSoil, stampRun } from '@/render/soil'
import { SoilSurface } from '@/render/SoilSurface'
import { discNormal } from '@/physics/tillage'
import { createTractorPose } from '@/tractor/Tractor'
import { FieldGround, FieldRun, makeSoil, mirror } from '../_shared/field'
import { bar, concaveDisc, hash, headstockGeometry, landWheel, rod, type P3 } from '@/parts/lib/implements'
import { freshSoil, treadmill, type Treadmill } from '../_tillage/soil'
import { LiveTag, Segment } from '../_tillage/three'
import { BEAM_Y, C, HARROW, HH, HS, RAISED, discOf, live, useDisc } from './model'

const INFO = {
  plough: {
    summary: 'Mounted disc plough.',
    role: 'Primary tillage with concave discs that roll rather than slide. It penetrates by its own weight (heavy build, extra weights) rather than by suction, and suits hard, dry, sticky, stony or root-filled soils where a mouldboard will not scour or would break.',
  },
  disc: {
    summary: 'Concave disc.',
    role: 'Cuts, lifts and partly turns the furrow slice. Disc angle (face to the direction of travel) is 42–45°; tilt angle (face to the vertical) is 15–25°.',
    details: 'Typical 660 mm (26 in) disc; concavity drawn ≈ 80 mm (typical value).',
  },
  standard: { summary: 'Standards and disc brackets.', role: 'Carry each disc’s hub bearing from the frame at the set disc and tilt angles.' },
  scraper: { summary: 'Scrapers.', role: 'Clean soil off the concave face of each disc — essential in sticky soil — and help turn the slice.' },
  wheel: { summary: 'Furrow (rear) wheel with spring.', role: 'Runs tilted in the furrow bottom and takes the side thrust of the discs; the spring keeps it pressed down.' },
  frame: { summary: 'Frame, cross shaft and top-link connection.', role: 'Carries the standards and attaches to the three-point linkage.' },
  harrow: { summary: 'Mounted tandem disc harrow.', role: 'Secondary tillage: two gangs in front throw soil outward, two behind throw it back, breaking clods and cutting trash.' },
  gang: { summary: 'Disc gangs.', role: 'Concave discs on a common square axle (with spools between). The gang angle to the line square to travel makes the discs cut and throw soil; a larger gang angle cuts deeper and more aggressively.' },
  field: { summary: 'Field soil.', role: 'Disc ploughing leaves a rougher, less completely turned surface than the mouldboard.' },
}

const cites = {
  plough: [C.am('§12 disc plough'), C.guide1819('3-disc mounted plough sketch')],
  harrow: [C.guide1819('disc harrow sketch'), C.bush('p6 Fig 4 disc harrow'), C.am('§12.7.2 harrows')],
}

const Y = new THREE.Vector3(0, 1, 0)

interface DiscPlace {
  c: THREE.Vector3
  n: THREE.Vector3
  q: THREE.Quaternion
  curve: THREE.CatmullRomCurve3
}

/** Place a disc of radius R with its lowest point on the floor yFloor, rim-plane centre at (x, ?, z). */
function placeDisc(x: number, z: number, yFloor: number, R: number, a: number, b: number): DiscPlace {
  const n = new THREE.Vector3(...discNormal(a, b))
  const c = new THREE.Vector3(x, yFloor + R * Math.cos(b), z)
  const q = new THREE.Quaternion().setFromUnitVectors(Y, n)
  const u = Y.clone().addScaledVector(n, -n.y).normalize()
  const t = new THREE.Vector3().crossVectors(n, u).normalize()
  const pts = [
    c.clone().addScaledVector(u, -R * 0.85).addScaledVector(t, t.x > 0 ? R * 0.35 : -R * 0.35).addScaledVector(n, 0.04),
    c.clone().addScaledVector(u, -R * 0.2).addScaledVector(n, 0.08),
    c.clone().addScaledVector(u, R * 0.3).addScaledVector(n, 0.16),
    new THREE.Vector3(x - 0.35, yFloor + 0.05, z - R * 1.3),
  ]
  return { c, n, q, curve: new THREE.CatmullRomCurve3(pts) }
}

function usePloughGeo() {
  const st = useDisc()
  return useMemo(() => {
    const r = discOf(st)
    const disc = concaveDisc(r.R, 0.08 * (st.D / 0.66), 0.006, 64)
    const places: DiscPlace[] = []
    for (let i = 0; i < st.discs; i++) places.push(placeDisc(-0.75 - i * 0.8, -0.5 + i * r.w, -HS, r.R, r.a, r.b))
    const f = places[0].c
    const l = places[places.length - 1].c
    const parts: THREE.BufferGeometry[] = []
    const scr: THREE.BufferGeometry[] = []
    for (const p of places) {
      const hub = p.c.clone().addScaledVector(p.n, -0.1)
      const top: P3 = [p.c.x + 0.15, BEAM_Y, p.c.z + 0.12]
      parts.push(bar(top, [hub.x + 0.06, (hub.y + BEAM_Y) / 2, hub.z + 0.05], 0.05, 0.07), bar([hub.x + 0.06, (hub.y + BEAM_Y) / 2, hub.z + 0.05], [hub.x, hub.y, hub.z], 0.05, 0.07))
      const u = Y.clone().addScaledVector(p.n, -p.n.y).normalize()
      const a = p.c.clone().addScaledVector(p.n, 0.03).addScaledVector(u, r.R * 0.75)
      const b = p.c.clone().addScaledVector(p.n, 0.05).addScaledVector(u, r.R * 0.15)
      scr.push(bar([a.x, a.y, a.z], [b.x, b.y, b.z], 0.1, 0.008), bar([a.x, a.y, a.z], [p.c.x + 0.15, BEAM_Y, p.c.z + 0.12], 0.025, 0.025))
    }
    const frame = merge(
      bar([0.1, BEAM_Y, f.z - 0.05], [l.x - 0.5, BEAM_Y, l.z + 0.12], 0.08, 0.1),
      headstockGeometry({ plateZ: 0.08 }),
      bar([0, 0.6, 0], [f.x * 0.5, BEAM_Y, (f.z + l.z) / 2], 0.05, 0.05),
      bar([0, 0.02, 0.3], [f.x * 0.4, BEAM_Y, f.z * 0.2], 0.05, 0.05),
    )
    const wheelAt: P3 = [l.x - 0.7, -HS + 0.28, l.z - r.w * 0.6]
    const wheel = landWheel(0.28, 0.1, 'smooth')
    const arm = merge(bar([l.x - 0.4, BEAM_Y, l.z + 0.1], [wheelAt[0], BEAM_Y, wheelAt[2] + 0.1], 0.05, 0.06), rod([wheelAt[0], BEAM_Y, wheelAt[2] + 0.1], [wheelAt[0], wheelAt[1], wheelAt[2] + 0.1], 0.02))
    const spring = helixSpring(0.035, 0.006, 0.22, 7)
    return { r, disc, places, standards: merge(...parts), scrapers: merge(...scr), frame, wheel, wheelAt, arm, spring }
  }, [st.D, st.discs, st.discAngle, st.tilt, st.depth]) // eslint-disable-line react-hooks/exhaustive-deps
}

function DiscPlough({ spins, wheelRef }: { spins: React.MutableRefObject<(THREE.Group | null)[]>; wheelRef: React.RefObject<THREE.Group | null> }) {
  const G = usePloughGeo()
  return (
    <Part id="disc-plough" name="Disc plough" material="paintRed" info={INFO.plough} cites={cites.plough}>
      <Part id="frame" name="Frame & headstock" info={INFO.frame} cites={cites.plough}>
        <PartMesh geometry={G.frame} />
      </Part>
      <Part id="standards" name="Standards" material="paintRed" info={INFO.standard} cites={cites.plough}>
        <PartMesh geometry={G.standards} />
      </Part>
      <Part id="scrapers" name="Scrapers" material="steelDark" info={INFO.scraper} cites={cites.plough}>
        <PartMesh geometry={G.scrapers} />
      </Part>
      <Part id="discs" name="Concave discs" role="moving" material="steel" info={INFO.disc} cites={[C.am('§12 disc and tilt angles')]}>
        {G.places.map((p, i) => (
          <group key={i} position={p.c} quaternion={p.q}>
            <group ref={(el) => void (spins.current[i] = el)}>
              <PartMesh geometry={G.disc} />
            </group>
          </group>
        ))}
      </Part>
      <Part id="furrow-wheel" name="Furrow wheel & spring" role="moving" material="rubber" info={INFO.wheel} cites={cites.plough}>
        <PartMesh geometry={G.arm} material="paintRed" />
        <PartMesh geometry={G.spring} material="steel" position={[G.wheelAt[0], 0.05, G.wheelAt[2] + 0.1]} />
        <group position={G.wheelAt} rotation={[0.35, 0, 0]}>
          <group ref={wheelRef}>
            <PartMesh geometry={G.wheel.tyre} />
            <PartMesh geometry={G.wheel.rim} material="paintGrey" />
          </group>
        </group>
      </Part>
      <Part id="thrown-soil" name="Soil thrown off the discs" role="fluid" material="soil" info={{ summary: 'Soil lifted and thrown by the discs.', role: 'The disc lifts the slice on its concave face and throws it sideways, partly inverting it.' }} cut={false}>
        {G.places.map((p, i) => (
          <Flow key={i} curve={p.curve} count={22} radius={0.022} color="#5a3d26" emissive={0.05} intensity={() => live.lowered} speed={0.9} spread={0.06} />
        ))}
      </Part>
    </Part>
  )
}

function useHarrowGeo() {
  const st = useDisc()
  return useMemo(() => {
    const disc = concaveDisc(HARROW.R, 0.05, 0.005, 48)
    disc.rotateX(Math.PI / 2)
    const n = HARROW.n
    const axle = rod([0, 0, -0.05], [0, 0, (n - 1) * HARROW.spacing + 0.05], 0.022, 8)
    const half = (n - 1) * HARROW.spacing
    const frame = merge(
      bar([-0.55, 0.15, -1.05], [-0.55, 0.15, 1.05], 0.08, 0.08),
      bar([-1.35, 0.15, -1.05], [-1.35, 0.15, 1.05], 0.08, 0.08),
      bar([0, 0.15, -0.6], [-1.4, 0.15, -0.6], 0.08, 0.08),
      bar([0, 0.15, 0.6], [-1.4, 0.15, 0.6], 0.08, 0.08),
      headstockGeometry(),
      bar([0, 0.6, 0], [-0.55, 0.15, 0], 0.05, 0.05),
    )
    const g = (st.gangAngle * Math.PI) / 180
    // [x, side (+1 left), throws outward?]
    const gangs = ([
      [-0.75, 1, true],
      [-0.75, -1, true],
      [-1.55, 1, false],
      [-1.55, -1, false],
    ] as const).map(([x, s, out]) => ({ x, s, out, rotY: (out ? -1 : 1) * s * g }))
    return { disc, axle, frame, gangs, half }
  }, [st.gangAngle])
}

function DiscHarrow({ spins }: { spins: React.MutableRefObject<(THREE.Group | null)[]> }) {
  const G = useHarrowGeo()
  return (
    <Part id="disc-harrow" name="Tandem disc harrow" material="paintYellow" info={INFO.harrow} cites={cites.harrow}>
      <Part id="harrow-frame" name="Harrow frame & headstock" info={INFO.frame} cites={cites.harrow}>
        <PartMesh geometry={G.frame} />
      </Part>
      <Part id="gangs" name="Disc gangs" role="moving" material="steel" info={INFO.gang} cites={cites.harrow}>
        {G.gangs.map((k, i) => (
          <group key={i} position={[k.x, -HH + HARROW.R, k.s * 0.08]} rotation={[0, k.rotY, 0]}>
            <group scale={[1, 1, k.s]}>
              <PartMesh geometry={G.axle} material="steelDark" />
              <group ref={(el) => void (spins.current[i] = el)}>
                {Array.from({ length: HARROW.n }, (_, j) => (
                  <group key={j} position={[0, 0, j * HARROW.spacing]} scale={[1, 1, k.out ? 1 : -1]}>
                    <PartMesh geometry={G.disc} />
                  </group>
                ))}
              </group>
            </group>
          </group>
        ))}
      </Part>
    </Part>
  )
}

const FIELD = { length: 18, width: 4, cell: 0.04 }

function FieldView() {
  const st = useDisc()
  const grid = useMemo(() => makeSoil(FIELD), [])
  const pose = useMemo(() => createTractorPose({ hitchHeight: RAISED }), [])
  const spins = useRef<(THREE.Group | null)[]>([])
  const wheelRef = useRef<THREE.Group>(null)
  const prev = useRef<number[]>([])
  const harrow = st.implement === 'harrow'
  return (
    <group>
      <Part id="field" name="Field soil" role="static" material="soil" info={INFO.field} cites={[C.bush('p4–7 tillage')]} cut>
        <FieldGround grid={grid} />
      </Part>
      <FieldRun
        key={st.implement}
        grid={grid}
        pose={pose}
        start={-3}
        end={7.5}
        speed={() => useDisc.getState().speed / 3.6}
        hitchWork={() => (useDisc.getState().implement === 'harrow' ? HH - useDisc.getState().harrowDepth : HS - useDisc.getState().depth)}
        hitchRaised={RAISED}
        onReset={() => {
          prev.current = []
          live.area = 0
        }}
        onStep={(c) => {
          const p = useDisc.getState()
          const r = discOf(p)
          live.X = c.X
          live.lowered = c.lowered
          const v = p.speed / 3.6
          const isH = p.implement === 'harrow'
          for (const s of spins.current) if (s) s.rotation.y -= (r.spin * 2 * Math.PI * c.dt) / 60
          if (isH) for (const s of spins.current) if (s) s.rotation.set(0, 0, s.rotation.z - (v * c.dt) / HARROW.R)
          if (wheelRef.current) wheelRef.current.rotation.z -= (v * c.dt) / 0.28
          if (c.lowered < 0.15 || c.dx <= 0) {
            prev.current = []
            return
          }
          if (isH) {
            const d = Math.min(p.harrowDepth, Math.max(0, HH - c.hitchY))
            const x = c.hitchX - 1.85
            const x0 = prev.current[0] ?? x
            prev.current[0] = x
            stampRun(grid, x0, x, 0, r.harrowW / 2, PROFILES.tilth(d * 0.6, 0.2), { blend: 0.8 })
            live.area += c.dx * r.harrowW
            return
          }
          const d = Math.min(p.depth, Math.max(0, HS - c.hitchY))
          for (let i = 0; i < p.discs; i++) {
            const x = c.hitchX - 0.75 - i * 0.8 - 0.5
            const x0 = prev.current[i] ?? x
            if (prev.current[i] !== undefined && x - x0 < grid.cell) continue
            prev.current[i] = x
            const base = mirror(PROFILES.mouldboard(d, r.w))
            const lump = 0.6 + 0.6 * hash(x * 5.1 + i)
            stampRun(grid, x0, x, -0.5 + i * r.w, r.w * 1.9, (dz) => {
              const h = base(dz)
              return h > 0 ? h * lump : h * (0.9 + 0.1 * lump)
            }, { blend: 0.9 })
          }
          live.area += c.dx * r.W
        }}
        mounted={harrow ? <DiscHarrow spins={spins} /> : <DiscPlough spins={spins} wheelRef={wheelRef} />}
      />
    </group>
  )
}

/** One disc close up with its angles drawn; the soil scrolls past. */
function DiscView() {
  const st = useDisc()
  const r = discOf(st)
  const grid = useMemo(() => createSoil(4.4, 1.8, 0.02, -3.0, -1.2), [])
  const mill = useMemo<Treadmill>(() => ({ acc: 0, x: 0 }), [])
  useMemo(() => freshSoil(grid, mill), [grid, mill])
  const disc = useMemo(() => concaveDisc(r.R, 0.08 * (st.D / 0.66), 0.006, 72), [r.R, st.D])
  const P = useMemo(() => placeDisc(0, 0, -st.depth, r.R, r.a, r.b), [r.R, r.a, r.b, st.depth])
  const spin = useRef<THREE.Group>(null)
  useSimFrame((dt) => {
    if (dt <= 0) return
    const p = useDisc.getState()
    const v = p.speed / 3.6
    live.lowered = 1
    treadmill(grid, mill, v * dt)
    stampRun(grid, -3, -0.35, -discOf(p).w / 2, discOf(p).w * 1.9, mirror(PROFILES.mouldboard(p.depth, discOf(p).w)))
    if (spin.current) spin.current.rotation.y -= (discOf(p).spin * 2 * Math.PI * dt) / 60
  })
  const L = 0.6
  return (
    <group>
      <Part id="field" name="Field soil" role="static" material="soil" info={INFO.field} cites={[C.bush('p4–7 tillage')]} cut>
        <SoilSurface grid={grid} depth={0.45} />
      </Part>
      <Part id="disc" name="Concave disc" role="moving" material="steel" info={INFO.disc} cites={[C.am('§12 disc and tilt angles')]}>
        <group position={P.c} quaternion={P.q}>
          <group ref={spin}>
            <PartMesh geometry={disc} />
          </group>
        </group>
        <Flow curve={P.curve} count={40} radius={0.02} color="#5a3d26" emissive={0.05} intensity={() => 1} speed={0.8} spread={0.05} />
      </Part>
      {/* direction of travel, horizontal trace of the disc face (disc angle) and its vertical trace (tilt) */}
      <Segment color="#e6efe9" onTop get={(a, b) => void (a.set(-L, 0.02, 0.35), b.set(L, 0.02, 0.35))} />
      <Segment color="#f5b942" onTop radius={0.008} get={(a, b) => void (a.set(-L * Math.cos(r.a), P.c.y, -L * Math.sin(r.a)), b.set(L * Math.cos(r.a), P.c.y, L * Math.sin(r.a)))} />
      <Segment color="#7ab8f5" onTop radius={0.008} get={(a, b) => {
        const u = Y.clone().addScaledVector(P.n, -P.n.y).normalize()
        a.copy(P.c).addScaledVector(u, -0.5)
        b.copy(P.c).addScaledVector(u, 0.5)
      }} />
      <LiveTag get={() => ({ text: `disc angle ${st.discAngle}° to travel`, at: [0.45, P.c.y + 0.1, 0.45] })} />
      <LiveTag get={() => ({ text: `tilt ${st.tilt}° from vertical`, at: [P.c.x, P.c.y + 0.6, P.c.z] })} />
      <PartLabel partId="disc" at={[-0.2, 0.55, -0.3]} />
    </group>
  )
}

export function Scene3D() {
  const st = useDisc()
  return st.mode === 'disc' && st.implement === 'plough' ? <DiscView /> : <FieldView />
}
