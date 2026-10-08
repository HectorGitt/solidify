import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, mat4, merge, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { ForceArrow } from '../_shared/Arrow'
import { A503 } from '../_shared/cites'
import { bandResult, coneResult, discResult, live, shoeResult, useCB } from './model'
import { DISC, bandPath, coneClutchParts, discClutchParts, drum, pin, plateStack, sector, stand, strip } from './parts'

const { PI } = Math
export const FLOOR = -0.45
const MM = 0.001
/** clutches sit low so their pedestals reach the floor */
export const CLUTCH_Y = -0.37

const C8 = [A503.m(8, 'Clutches, Fig 14-1'), A503.mg16('Q5'), A503.mg19('Q6a')]
const C9 = [A503.m(9, 'Brake design'), A503.mg15('Q5'), A503.mg19('Q6b')]

export function ClutchBrake3D() {
  const mode = useCB((s) => s.mode)
  // driving member angle and driven member angle (clutches), drum angle (brakes)
  const thC = useRef(0)
  const thD = useRef(0)
  useSimFrame((dt) => {
    const s = useCB.getState()
    const w = (s.rpm * 2 * PI) / 60
    if (s.mode === 'disc' || s.mode === 'cone') {
      thC.current += w * dt
      // the driven member is dragged up to speed by the friction pack; it coasts down when released
      const k = s.engage > 0.05 ? 10 * s.engage * s.engage : 0
      live.omegaD += (w - live.omegaD) * (1 - Math.exp(-k * dt)) - live.omegaD * (1 - Math.exp(-0.4 * dt)) * (s.engage < 0.05 ? 1 : 0)
      if (s.engage >= 0.98) live.omegaD = w
      thD.current += live.omegaD * dt
    } else {
      // a brake that holds the torque keeps the drum at the set speed (the energy becomes heat)
      thC.current += (s.dir === 'ccw' && s.mode === 'shoe' ? 1 : -1) * w * dt
    }
    live.drum = thC.current
    live.driven = thD.current
  })
  return (
    <group>
      {mode === 'disc' ? <DiscClutch thC={thC} thD={thD} /> : null}
      {mode === 'cone' ? <ConeClutch thC={thC} thD={thD} /> : null}
      {mode === 'shoe' ? <ShoeBrake th={thC} /> : null}
      {mode === 'band' ? <BandBrake th={thC} /> : null}
    </group>
  )
}

type Ang = React.MutableRefObject<number>

function Spin({ angle, children }: { angle: Ang; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => ref.current?.rotation.set(0, angle.current, 0))
  return <group ref={ref}>{children}</group>
}

function Pedestals({ xs, top }: { xs: number[]; top: number }) {
  const g = useMemo(() => merge(...xs.map((x) => stand(x, 0, top, FLOOR - CLUTCH_Y, 0.04, 0.07))), [xs, top])
  return (
    <Part id="pedestals" name="Bearing pedestals" role="housing" material="paintGrey" info={{ summary: 'Pedestals carrying the two shafts.' }}>
      <PartMesh geometry={g} />
    </Part>
  )
}

/* ------------------------------ multiple-disc clutch ------------------------------ */

function DiscClutch({ thC, thD }: { thC: Ang; thD: Ang }) {
  const p = useCB()
  const g = useMemo(() => discClutchParts(p.Ro * 1000, p.Ri * 1000), [p.Ro, p.Ri])
  const stack = plateStack(p.nSteel, p.nBronze, p.engage)
  const r = discResult(p)
  const k = 0.06 / 1000
  return (
    <group position={[0, CLUTCH_Y, 0]}>
      <group rotation={[0, 0, -PI / 2]}>
        <Part id="driving" name="Shaft C with steel plates A" role="moving" material="steel" info={{ summary: `Driving shaft C with ${p.nSteel} steel plates A on splines.`, role: 'The steel plates slide axially on the splines of C (except the last one, fixed to C) and turn with it.' }} cites={C8}>
          <Spin angle={thC}>
            <PartMesh geometry={g.shaftC} material="steelDark" />
            <Part id="steel-plates" name="Steel plates A" role="moving" material="steel" info={{ summary: 'Steel plates A.', role: 'Splined to shaft C; their faces rub against the bronze plates.' }} cites={C8} explode={[0, 0.04, 0]}>
              {stack.plates.map((pl, i) => (pl.steel ? <PartMesh key={i} geometry={g.steel} position={[0, pl.y * MM, 0]} /> : null))}
            </Part>
            <Part id="collar" name="Pressure collar (axial force F)" role="moving" material="forged" info={{ summary: 'Pressure (thrust) collar.', role: 'Squeezes the pack with the axial force F; the fixed last plate reacts it, so F acts on every pair of faces.' }} cites={C8} explode={[0, 0.07, 0]}>
              <PartMesh geometry={g.collar} position={[0, stack.collarY * MM, 0]} />
            </Part>
          </Spin>
        </Part>
        <Part id="driven" name="Member D with bronze plates B" role="moving" material="castIron" info={{ summary: `Driven housing D with ${p.nBronze} bronze plates B.`, role: 'The bronze plates are splined into D. When the pack is squeezed the friction couples D to C; released, D coasts.' }} cites={C8}>
          <Spin angle={thD}>
            <Part id="housing-d" name="Housing (drum) D" role="housing" material="castIron" info={{ summary: 'Clutch housing D on the driven shaft.' }} explode={[0, -0.06, 0]}>
              <PartMesh geometry={g.housing} />
              <PartMesh geometry={g.shaftD} material="steelDark" />
            </Part>
            <Part id="bronze-plates" name="Bronze plates B" role="moving" material="bronze" info={{ summary: 'Bronze plates B.', role: `Splined in D. Friction pairs n = ${p.nSteel} + ${p.nBronze} − 1 = ${r.n}.` }} cites={C8} explode={[0, 0.02, 0]}>
              {stack.plates.map((pl, i) => (!pl.steel ? <PartMesh key={i} geometry={g.bronze} position={[0, pl.y * MM, 0]} /> : null))}
            </Part>
          </Spin>
        </Part>
      </group>
      <Pedestals xs={[-0.05, 0.07]} top={-0.022} />
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3((stack.collarY + DISC.collarT) * MM, 0.028, 0), dir: new THREE.Vector3(-1, 0, 0), toward: true, length: 0.02 + r.F * k * p.engage, label: `F = ${r.F.toFixed(0)} N`, visible: p.engage > 0.02 })} radius={0.0025} />
      <PartLabel partId="steel-plates" at={[0.01, 0.05, 0.02]} />
      <PartLabel partId="bronze-plates" at={[0.0, -0.05, 0.03]} />
      <PartLabel partId="housing-d" at={[-0.02, 0.06, 0.03]} />
      <PartLabel partId="collar" at={[0.03, 0.04, 0.02]} />
      <PartLabel partId="driving" at={[0.08, 0.03, 0]} />
    </group>
  )
}

/* ------------------------------ cone clutch ------------------------------ */

function ConeClutch({ thC, thD }: { thC: Ang; thD: Ang }) {
  const p = useCB()
  const g = useMemo(() => coneClutchParts(p.cRo * 1000, p.cRi * 1000, p.alpha), [p.cRo, p.cRi, p.alpha])
  const off = (1 - p.engage) * 0.012
  const r = coneResult(p)
  return (
    <group position={[0, CLUTCH_Y, 0]}>
      <group rotation={[0, 0, -PI / 2]}>
        <Part id="cone" name="Cone (sliding member)" role="moving" material="steel" info={{ summary: `Cone, semi-angle α = ${((p.alpha * 180) / PI).toFixed(1)}°, R_o = ${p.cRo * 1000} mm, R_i = ${p.cRi * 1000} mm.`, role: 'Slides on its shaft and wedges into the cup: a small axial force F gives a large normal force F/sin α on the face.' }} cites={[A503.m(8, 'cone clutch, slides 6–9')]} explode={[0, 0.08, 0]}>
          <group position={[0, off, 0]}>
            <Spin angle={thC}>
              <PartMesh geometry={g.cone} />
              <PartMesh geometry={g.shaftIn} material="steelDark" />
              <Part id="lining" name="Friction lining" role="moving" material="friction" info={{ summary: 'Friction lining on the cone face.', role: `Face width b = (R_o − R_i)/sin α = ${(r.b * 1000).toFixed(1)} mm.` }} cites={[A503.m(8, 'slide 8')]}>
                <PartMesh geometry={g.lining} />
              </Part>
            </Spin>
          </group>
        </Part>
        <Part id="cup" name="Cup (driven member)" role="housing" material="castIron" info={{ summary: 'Cup on the driven shaft.', role: 'Receives the cone; torque is transmitted by friction on the conical face.' }} cites={[A503.m(8, 'slide 6')]} explode={[0, -0.05, 0]}>
          <Spin angle={thD}>
            <PartMesh geometry={g.cup} />
            <PartMesh geometry={g.shaftOut} material="steelDark" />
          </Spin>
        </Part>
      </group>
      <Pedestals xs={[-0.05, 0.11]} top={-0.018} />
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3(g.h + off + 0.02, 0.03, 0), dir: new THREE.Vector3(-1, 0, 0), toward: true, length: 0.03 + p.F * 2e-5, label: `F = ${p.F.toFixed(0)} N`, visible: p.engage > 0.02 })} radius={0.0025} />
      <PartLabel partId="cone" at={[0.05, 0.075, 0.02]} />
      <PartLabel partId="cup" at={[-0.01, 0.085, 0.02]} />
      <PartLabel partId="lining" at={[0.03, -0.07, 0.03]} />
    </group>
  )
}

/* ------------------------------ single shoe brake (Fig 15-10) ------------------------------ */

function ShoeBrake({ th }: { th: Ang }) {
  const p = useCB()
  const r = shoeResult(p)
  const R = p.R
  // the pivot sits c below the line of the friction force; draw at most 0.3 m below (not to scale beyond)
  const cDraw = Math.min(p.c, 0.3)
  const px = -p.a
  const py = R - cDraw
  const leverY = R + 0.045
  const g = useMemo(
    () => ({
      drum: drum(R * 1000, 50),
      lining: sector(R + 0.0005, R + 0.012, (70 * PI) / 180, (110 * PI) / 180, 0.08),
      shoe: sector(R + 0.012, leverY, (72 * PI) / 180, (108 * PI) / 180, 0.08),
      lever: xform(box(p.b + 0.04, 0.03, 0.04), mat4.t(px + (p.b + 0.04) / 2 - 0.02, leverY + 0.015, 0)),
      link: xform(box(0.03, leverY - py, 0.03), mat4.t(px, (leverY + py) / 2, 0)),
      pin: xform(pin(0.012, 0.09), mat4.t(px, py, 0)),
      bracket: stand(px, -0.06, py, FLOOR, 0.05, 0.03),
      shaft: xform(pin(0.025, 0.24), mat4.t(0, 0, -0.04)),
      stand: stand(0, -0.13, 0, FLOOR, 0.08, 0.04),
    }),
    [R, p.b, px, py, leverY],
  )
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => ref.current?.rotation.set(0, 0, th.current))
  const k = 0.15 / 2500
  const fric = p.dir === 'cw' ? 1 : -1
  return (
    <group>
      <Part id="drum" name={`Brake drum R = ${R * 1000} mm`} role="moving" material="castIron" info={{ summary: `Brake drum, radius ${R * 1000} mm.`, role: `Sustains ${p.T} N·m at ${p.rpm} rpm. The absorbed energy becomes heat: H_g = fNV = ${(r.Hg / 1000).toFixed(1)} kW.` }} cites={C9}>
        <group ref={ref}>
          <PartMesh geometry={g.drum} />
        </group>
        <PartMesh geometry={g.shaft} material="steelDark" />
      </Part>
      <Part id="lever" name="Brake lever (rigid shoe)" role="static" material="paintRed" info={{ summary: `Lever with a rigidly mounted shoe: N at a = ${p.a * 1000} mm, friction at c = ${(p.c * 1000).toFixed(0)} mm, effort F at b = ${p.b * 1000} mm from the pivot.`, role: 'Moments about the pivot: F·b = N·a ∓ fN·c. For clockwise rotation the friction helps to apply the brake.' }} cites={C9} explode={[0, 0.1, 0]}>
        <PartMesh geometry={g.lever} />
        <PartMesh geometry={g.link} />
        <Part id="shoe" name="Shoe (block)" role="static" material="castIron" info={{ summary: 'Brake block (shoe), rigidly mounted on the lever.', role: 'For contact angles up to about 60° the normal and friction forces can be taken at the middle of the shoe.' }} cites={[A503.m(9, 'slide 8')]}>
          <PartMesh geometry={g.shoe} />
        </Part>
        <Part id="shoe-lining" name="Friction lining" role="static" material="friction" info={{ summary: 'Lining on the shoe.', role: `Coefficient of friction f = ${p.fs}.` }} cites={[A503.m(9)]}>
          <PartMesh geometry={g.lining} />
        </Part>
      </Part>
      <Part id="pivot" name="Fixed pivot" role="housing" material="paintGrey" info={{ summary: `Lever pivot, ${(p.c * 1000).toFixed(0)} mm below the friction line${p.c > 0.3 ? ' (drawn shortened)' : ''}.`, role: `Self-locking when a/c ≤ f, i.e. c ≥ a/f = ${r.selfLock.toFixed(2)} m (clockwise only).` }} cites={[A503.m(9, 'Example 1d')]}>
        <PartMesh geometry={g.bracket} />
        <PartMesh geometry={g.pin} material="steel" />
      </Part>
      <Part id="stand" name="Drum bearing stand" role="housing" material="paintGrey">
        <PartMesh geometry={g.stand} />
      </Part>
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3(px + p.b, leverY + 0.03, 0.03), dir: new THREE.Vector3(0, r.F >= 0 ? -1 : 1, 0), toward: true, length: Math.max(0.02, Math.abs(r.F) * k), label: r.F > 0 ? `F = ${r.F.toFixed(0)} N` : 'self-locking (F ≤ 0)' })} radius={0.005} />
      <ForceArrow color="#6fb3e0" spec={() => ({ origin: new THREE.Vector3(0, R, 0.05), dir: new THREE.Vector3(0, 1, 0), length: r.N * k, label: `N = ${r.N.toFixed(0)} N` })} radius={0.005} />
      <ForceArrow color="#9bd17a" spec={() => ({ origin: new THREE.Vector3(0, R + 0.006, 0.05), dir: new THREE.Vector3(fric, 0, 0), length: Math.max(0.03, r.fN * k), label: `fN = ${r.fN.toFixed(0)} N` })} radius={0.005} />
      <PartLabel partId="drum" at={[0.25, -0.2, 0.06]} />
      <PartLabel partId="lever" at={[0.4, leverY + 0.06, 0]} />
      <PartLabel partId="shoe" at={[-0.12, R + 0.05, 0.05]} />
      <PartLabel partId="pivot" at={[px - 0.06, py, 0.03]} />
    </group>
  )
}

/* ------------------------------ simple band brake (Fig 15-7) ------------------------------ */

function BandBrake({ th }: { th: Ang }) {
  const p = useCB()
  const r = bandResult(p)
  const t = 0.004
  const lt = 0.0125
  const band = useMemo(() => bandPath(p.rb, p.wrap, p.la, t, lt), [p.rb, p.wrap, p.la])
  const O = new THREE.Vector3(-p.la / 2, -band.h, 0)
  const g = useMemo(
    () => ({
      drum: drum(p.rb * 1000, 40),
      band: strip(band.pts, t, 0.06),
      lever: xform(box(p.lb + 0.06, 2 * lt, 0.03), mat4.t(O.x + (p.lb + 0.06) / 2 - 0.03, O.y, 0)),
      pin: xform(pin(0.01, 0.08), mat4.t(O.x, O.y, 0)),
      bracket: stand(O.x, -0.05, O.y, FLOOR, 0.04, 0.03),
      shaft: xform(pin(0.02, 0.2), mat4.t(0, 0, -0.04)),
      stand: stand(0, -0.11, 0, FLOOR, 0.07, 0.04),
    }),
    [p.rb, p.lb, band, O.x, O.y],
  )
  const ref = useRef<THREE.Group>(null)
  useSimFrame(() => ref.current?.rotation.set(0, 0, -th.current))
  const k = 0.12 / 1200
  const p1 = band.pts[1]
  const p2 = band.pts[band.pts.length - 2]
  const d1 = new THREE.Vector3(band.pts[0].x - p1.x, band.pts[0].y - p1.y, 0).normalize()
  const d2 = new THREE.Vector3(band.pts[band.pts.length - 1].x - p2.x, band.pts[band.pts.length - 1].y - p2.y, 0).normalize()
  return (
    <group>
      <Part id="drum" name={`Brake drum Ø${p.rb * 2000} mm`} role="moving" material="castIron" info={{ summary: `Drum Ø${p.rb * 2000} mm, turning so that the band end on the fixed pivot is the tight side.`, role: `Braking torque T = (F₁ − F₂)r = ${p.Tb} N·m.` }} cites={[A503.m(9, 'Fig 15-7, Example 2')]}>
        <group ref={ref}>
          <PartMesh geometry={g.drum} />
        </group>
        <PartMesh geometry={g.shaft} material="steelDark" />
      </Part>
      <Part id="band" name="Steel band with lining" role="static" material="steelDark" cut={false} info={{ summary: `Flexible band wrapped ${((p.wrap * 180) / PI).toFixed(0)}° round the drum.`, role: 'Pulled tight against the drum like a belt that does not move: F₁/F₂ = e^(fα). A simple band brake has no self-energising action.' }} cites={[A503.m(9, 'slides 18–20')]}>
        <PartMesh geometry={g.band} />
      </Part>
      <Part id="lever" name="Lever" role="static" material="paintRed" info={{ summary: `Lever: tight end on the fixed pivot O, slack end at a = ${p.la * 1000} mm, effort at b = ${p.lb * 1000} mm.`, role: 'F·b = F₂·a — only the slack-side tension has a moment about O, so the effort is small.' }} cites={[A503.m(9, 'Fig 15-7')]} explode={[0, -0.05, 0]}>
        <PartMesh geometry={g.lever} />
      </Part>
      <Part id="pivot" name="Fixed pivot O" role="housing" material="paintGrey">
        <PartMesh geometry={g.bracket} />
        <PartMesh geometry={g.pin} material="steel" />
      </Part>
      <Part id="stand" name="Drum bearing stand" role="housing" material="paintGrey">
        <PartMesh geometry={g.stand} />
      </Part>
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3(p1.x, p1.y, 0.04), dir: d1, length: r.F1 * k, label: `F₁ = ${r.F1.toFixed(0)} N (tight)` })} radius={0.004} />
      <ForceArrow color="#6fb3e0" spec={() => ({ origin: new THREE.Vector3(p2.x, p2.y, 0.04), dir: d2, length: r.F2 * k, label: `F₂ = ${r.F2.toFixed(0)} N (slack)` })} radius={0.004} />
      <ForceArrow color="#9bd17a" spec={() => ({ origin: new THREE.Vector3(O.x + p.lb, O.y + lt, 0.02), dir: new THREE.Vector3(0, -1, 0), toward: true, length: 0.03 + r.F * k, label: `F = ${r.F.toFixed(0)} N` })} radius={0.004} />
      <PartLabel partId="drum" at={[0.17, 0.1, 0.05]} />
      <PartLabel partId="band" at={[-0.2, 0.17, 0.04]} />
      <PartLabel partId="lever" at={[O.x + p.lb * 0.7, O.y + 0.04, 0]} />
      <PartLabel partId="pivot" at={[O.x - 0.06, O.y - 0.03, 0]} />
    </group>
  )
}

