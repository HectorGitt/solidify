import { Html, Line } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { box, cylinder, helixSpring, mat4, merge, xform } from '@/geometry'
import { leafNip } from '@/physics/elements'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { ForceArrow } from '../_shared/Arrow'
import { A503 } from '../_shared/cites'
import { DEFAULTS, helicalResult, leafResult, useSW, weldResult } from './model'
import { barBead, bentLeaf, bracketWelds } from './parts'

const { PI } = Math
export const FLOOR = -0.15

export function SpringsWelds3D() {
  const mode = useSW((s) => s.mode)
  const weld = useSW((s) => s.weld)
  return (
    <group>
      {mode === 'helical' ? <Helical /> : null}
      {mode === 'leaf' ? <Leaf /> : null}
      {mode === 'weld' ? weld === 'bar' ? <BarWeld /> : <BracketWeld /> : null}
    </group>
  )
}

function Tag({ at, children, color = '#c8d0d6' }: { at: [number, number, number]; children: ReactNode; color?: string }) {
  const labels = useView((s) => s.labels)
  if (!labels) return null
  return (
    <Html position={at} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} center>
      <div className="part-label" style={{ color, borderColor: color, whiteSpace: 'nowrap' }}>
        {children}
      </div>
    </Html>
  )
}

/* ------------------------------ helical compression spring ------------------------------ */

function Helical() {
  const p = useSW()
  const r = helicalResult(p)
  const base = FLOOR + 0.012
  const turns = p.n + 2
  const len = Math.round(r.len * 2000) / 2000
  const geo = useMemo(
    () => ({
      spring: helixSpring(p.D / 2, p.d / 2, Math.max(p.d * turns * 1.001, len - p.d), turns),
      seat: xform(cylinder(p.D / 2 + 0.012, 0.012, 48), mat4.t(0, FLOOR + 0.006, 0)),
      plate: cylinder(p.D / 2 + 0.012, 0.01, 48),
      guide: xform(cylinder(p.D / 2 - p.d / 2 - 0.004, 0.02, 32), mat4.t(0, base + 0.01, 0)),
    }),
    [p.D, p.d, turns, len, base],
  )
  const topY = base + len
  return (
    <group>
      <Part id="spring" name={`Helical compression spring, d = ${(p.d * 1000).toFixed(1)} mm, D = ${(p.D * 1000).toFixed(0)} mm`} role="moving" material="steelDark" info={{ summary: `Close-coiled helical compression spring: spring index C = D/d = ${r.C.toFixed(2)}, ${p.n.toFixed(2)} active coils (+2 inactive end coils).`, role: 'An elastic body that distorts under load and recovers when unloaded: absorbs shock, applies forces (clutches, valves), keeps cam followers in contact, measures forces.', details: `Load ${p.F.toFixed(0)} N → deflection ${(r.y * 1000).toFixed(1)} mm, stiffness ${(r.k / 1000).toFixed(1)} N/mm. Material: 0.60–0.70 % C, 0.60–1.0 % Mn spring steel. Wire stress is torsional shear, highest on the inside of the coil (Wahl).` }} cites={[A503.m(10, 'slides 2–6, 12–13'), A503.mg21('Q4b–d')]}>
        <PartMesh geometry={geo.spring} position={[0, base + p.d / 2, 0]} />
      </Part>
      <Part id="seats" name="Spring seats" role="static" material="steel" info={{ summary: 'Spring seats (plates).', role: 'Locate the end coils and apply the load squarely.' }}>
        <PartMesh geometry={geo.seat} />
        <PartMesh geometry={geo.guide} />
        <PartMesh geometry={geo.plate} position={[0, topY + 0.005, 0]} />
      </Part>
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3(0, topY + 0.01, 0), dir: new THREE.Vector3(0, -1, 0), toward: true, length: 0.02 + useSW.getState().F * 3e-5, label: `F = ${useSW.getState().F.toFixed(0)} N` })} radius={0.0025} />
      <Line points={[[p.D / 2 + 0.02, base, 0], [p.D / 2 + 0.02, topY, 0]]} color="#9bd17a" lineWidth={1.2} />
      <Line points={[[p.D / 2 + 0.035, base, 0], [p.D / 2 + 0.035, base + p.L0, 0]]} color="#6fb3e0" lineWidth={1} dashed dashSize={0.003} gapSize={0.002} />
      <Tag at={[p.D / 2 + 0.05, base + p.L0 + 0.006, 0]} color="#6fb3e0">free length {(p.L0 * 1000).toFixed(0)} mm</Tag>
      <Tag at={[p.D / 2 + 0.04, topY - 0.01, 0]} color="#9bd17a">loaded {(len * 1000).toFixed(1)} mm{r.bottomed ? ' (solid!)' : ''}</Tag>
      <Tag at={[-p.D / 2 - 0.03, base + 0.02, 0]} color="#f5b942">D = {(p.D * 1000).toFixed(0)} mm</Tag>
      <PartLabel partId="spring" at={[-p.D / 2 - 0.02, base + len * 0.6, 0.02]} />
      <PartLabel partId="seats" at={[p.D / 2 + 0.02, FLOOR + 0.01, 0.03]} />
    </group>
  )
}

/* ------------------------------ leaf spring (cantilever) ------------------------------ */


function Leaf() {
  const p = useSW()
  const r = leafResult(p)
  const root = -0.5
  const top = 0.15
  const Fd = DEFAULTS.lF
  const nipOpen = p.prestressed ? leafNip(Fd, p.L, p.b, p.t, r.n, p.E) * Math.max(0, 1 - p.lF / Fd) : 0
  const geo = useMemo(() => {
    const curve = (x: number) => r.y * (x / p.L) ** 2
    const full: THREE.BufferGeometry[] = []
    const grad: THREE.BufferGeometry[] = []
    for (let i = 0; i < p.ne; i++) full.push(bentLeaf(root, p.L, p.t * 0.98, p.b, top - i * p.t, (x) => curve(x) - nipOpen * (x / p.L) ** 2))
    for (let j = 0; j < p.ng; j++) {
      const Lj = (p.L * (p.ng - j)) / p.ng
      grad.push(bentLeaf(root, Lj, p.t * 0.98, p.b, top - (p.ne + j) * p.t, curve))
    }
    const stackH = (p.ne + p.ng) * p.t
    const clampTop = xform(box(0.1, 0.02, p.b + 0.02), mat4.t(root + 0.05, top + 0.01, 0))
    const clampBot = xform(box(0.1, 0.02, p.b + 0.02), mat4.t(root + 0.05, top - stackH - 0.01, 0))
    const bolts = merge(...[-1, 1].map((s) => xform(cylinder(0.006, stackH + 0.07, 16), mat4.t(root + 0.05, top - stackH / 2, s * (p.b / 2 + 0.016)))))
    const wall = xform(box(0.06, 0.25 - FLOOR + 0.1, 0.25), mat4.t(root - 0.03, (0.35 + FLOOR) / 2, 0))
    return { full, grad, clamp: merge(clampTop, clampBot), bolts, wall, stackH }
  }, [p.ne, p.ng, p.L, p.t, p.b, r.y, nipOpen])
  const tipY = top - r.y
  return (
    <group>
      <Part id="leaf-spring" name={`Leaf spring: ${p.ne} extra full-length + ${p.ng} graduated leaves`} role="moving" material="paintBlack" info={{ summary: `Laminated (leaf) cantilever spring, L = ${p.L} m, leaves ${(p.b * 1000).toFixed(0)} × ${(p.t * 1000).toFixed(1)} mm.`, role: 'Leaves of decreasing length held by a clamp and bolts. The graduated leaves make a beam of nearly uniform strength; bending stresses are tensile and compressive.', details: `Tip deflection ${(r.y * 1000).toFixed(1)} mm under ${p.lF} N.` }} cites={[A503.m(10, 'slides 5–11'), A503.mg17('Q4c')]}>
        <Part id="full-leaves" name="Extra full-length leaves" role="moving" material="steel" info={{ summary: 'Extra full-length leaf (on top).', role: p.prestressed ? `Pre-formed with a nip gap h = 2FL³/(nbt³E) so that every leaf carries the same stress at full load (s = 6FL/nbt²).` : `Without pre-stress the full leaves are the most stressed: s_e = 18FL/[bt²(3n_e + 2n_g)] = ${(r.se / 1e6).toFixed(0)} MPa.` }} cites={[A503.m(10, 'slides 7, 10–11')]}>
          {geo.full.map((g, i) => (
            <PartMesh key={i} geometry={g} />
          ))}
        </Part>
        <Part id="graduated-leaves" name="Graduated leaves" role="moving" material="steelDark" info={{ summary: 'Graduated leaves.', role: `Stress s_g = ⅔ s_e = ${(r.sg / 1e6).toFixed(0)} MPa without pre-stress.` }} cites={[A503.m(10, 'slide 8')]}>
          {geo.grad.map((g, i) => (
            <PartMesh key={i} geometry={g} />
          ))}
        </Part>
      </Part>
      <Part id="clamp" name="Clamp and U-bolts" role="static" material="forged" info={{ summary: 'Clamp and bolts.', role: 'Hold the leaves together and fix the root of the cantilever.' }} cites={[A503.m(10, 'slide 5')]}>
        <PartMesh geometry={geo.clamp} />
        <PartMesh geometry={geo.bolts} material="steel" />
      </Part>
      <Part id="wall" name="Support" role="housing" material="concrete" info={{ summary: 'Rigid support at the root.' }}>
        <PartMesh geometry={geo.wall} />
      </Part>
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3(root + p.L - 0.01, tipY + 0.002, 0), dir: new THREE.Vector3(0, -1, 0), toward: true, length: 0.04 + p.lF * 3e-5, label: `F = ${p.lF.toFixed(0)} N` })} radius={0.004} />
      <Line points={[[root + p.L + 0.02, top, 0], [root + p.L + 0.02, tipY, 0]]} color="#9bd17a" lineWidth={1.4} />
      <Tag at={[root + p.L + 0.08, top - r.y / 2, 0]} color="#9bd17a">y = {(r.y * 1000).toFixed(1)} mm</Tag>
      {p.prestressed && nipOpen > 0.0005 ? <Tag at={[root + p.L - 0.05, top + nipOpen + 0.03, 0]} color="#f5b942">nip gap opens {(nipOpen * 1000).toFixed(1)} mm</Tag> : null}
      <PartLabel partId="full-leaves" at={[0, top + 0.03, 0.03]} />
      <PartLabel partId="graduated-leaves" at={[-0.2, top - geo.stackH - 0.04, 0.03]} />
      <PartLabel partId="clamp" at={[root + 0.05, top + 0.06, 0.04]} />
    </group>
  )
}

/* ------------------------------ welded round bar ------------------------------ */

function BarWeld() {
  const p = useSW()
  const r = weldResult(p)
  const R = p.barD / 2
  const x0 = -0.1
  const w = p.leg
  const geo = useMemo(() => {
    const bead = barBead(R, w, x0)
    const bar = xform(cylinder(R, p.arm + 0.02, 48), mat4.c(mat4.t(x0 + (p.arm + 0.02) / 2, 0, 0), mat4.rz(-PI / 2)))
    const plate = xform(box(0.02, 0.15 - FLOOR, 0.22), mat4.t(x0 - 0.01, (0.15 + FLOOR) / 2, 0))
    return { bead, bar, plate }
  }, [R, w, p.arm])
  const root: [number, number, number] = [x0, R, 0.0005]
  const throatEnd: [number, number, number] = [x0 + w / 2, R + w / 2, 0.0005]
  return (
    <group>
      <Part id="plate" name="Steel plate" role="housing" material="paintGrey" info={{ summary: 'Plate to which the bar is welded.' }}>
        <PartMesh geometry={geo.plate} />
      </Part>
      <Part id="bar" name={`Round bar Ø${p.barD * 1000} mm`} role="static" material="steel" info={{ summary: `Ø${p.barD * 1000} mm bar loaded with ${p.V / 1000} kN at ${p.arm * 1000} mm from the plate.`, role: 'The weld must carry the bending moment M = V·e and the direct shear V.' }} cites={[A503.mg15('Q6c'), A503.mg19('Q5d'), A503.mg21('Q5c')]}>
        <PartMesh geometry={geo.bar} />
      </Part>
      <Part id="weld" name={`Fillet weld all round, leg w = ${(w * 1000).toFixed(1)} mm`} role="static" material="castIron" info={{ summary: `Circumferential fillet weld, leg ${(w * 1000).toFixed(1)} mm, throat 0.707w = ${(0.707 * w * 1000).toFixed(1)} mm.`, role: 'Treated as a line: Z_w = πd²/4 for bending, length πd for shear. Section the scene to see the triangular fillet and its 45° throat.', details: `Required leg for ${(p.s / 1e6).toFixed(0)} MN/m²: ${(r.w * 1000).toFixed(1)} mm.` }} cites={[A503.m(11, 'slides 14–24')]}>
        <PartMesh geometry={geo.bead} />
      </Part>
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3(x0 + p.arm, R + 0.002, 0), dir: new THREE.Vector3(0, -1, 0), toward: true, length: 0.03 + p.V * 4e-6, label: `V = ${(p.V / 1000).toFixed(1)} kN` })} radius={0.003} />
      <Line points={[root, throatEnd]} color="#f5b942" lineWidth={2} />
      <Tag at={[x0 + w + 0.02, R + w + 0.012, 0]} color="#f5b942">throat 0.707w at 45°</Tag>
      <Line points={[[x0, -R - 0.02, 0], [x0 + p.arm, -R - 0.02, 0]]} color="#9bd17a" lineWidth={1} dashed dashSize={0.006} gapSize={0.004} />
      <Tag at={[x0 + p.arm / 2, -R - 0.032, 0]} color="#9bd17a">e = {(p.arm * 1000).toFixed(0)} mm</Tag>
      <PartLabel partId="weld" at={[x0 + 0.02, R + 0.045, 0.03]} />
      <PartLabel partId="bar" at={[x0 + p.arm * 0.6, R + 0.03, 0.03]} />
      <PartLabel partId="plate" at={[x0 - 0.02, 0.12, 0.1]} />
    </group>
  )
}

/* ------------------------------ eccentric bracket (M11 Example 1) ------------------------------ */



function BracketWeld() {
  const p = useSW()
  const r = weldResult(p)
  const w = p.leg
  const hb = p.wb
  const hd = p.wd / 2
  const geo = useMemo(() => {
    const column = xform(box(hb + 0.1, 0.3 - FLOOR, 0.02), mat4.t((hb - 0.1) / 2, (0.3 + FLOOR) / 2, -0.01))
    const plate = xform(box(0.66, 2 * hd, 0.012), mat4.t(0.33, 0, 0.006))
    const welds = bracketWelds(hb, hd, w)
    return { column, plate, welds }
  }, [hb, hd, w])
  const cg = r.kind === 'bracket' ? r.Ny : 0
  const loadX = cg + p.arm
  return (
    <group>
      <Part id="column" name="Column flange" role="housing" material="paintGrey" info={{ summary: 'Column (stanchion) flange the bracket is welded to.' }}>
        <PartMesh geometry={geo.column} />
      </Part>
      <Part id="bracket" name="Bracket plate" role="static" material="steel" info={{ summary: `Bracket plate carrying ${p.V / 1000} kN at ${p.arm * 1000} mm from the weld group’s centre of gravity.`, role: 'The load is replaced by the same force at the c.g. of the weld plus a twisting couple T = V·e.' }} cites={[A503.m(11, 'Example 1')]}>
        <PartMesh geometry={geo.plate} />
      </Part>
      <Part id="welds" name={`Fillet welds ${p.wb * 1000}/${p.wd * 1000}/${p.wb * 1000} mm, leg ${(w * 1000).toFixed(1)} mm`} role="static" material="castIron" info={{ summary: 'Three fillet welds forming a C: two flanges b and a web d.', role: 'Treated as a line: N_y = b²/(2b + d), J_w = (2b + d)³/12 − b²(b + d)²/(2b + d). The worst point is a flange tip, farthest from the c.g.' }} cites={[A503.m(11, 'slides 23–33')]}>
        {geo.welds.map((g, i) => (
          <PartMesh key={i} geometry={g} />
        ))}
      </Part>
      <ForceArrow color="#e8794f" spec={() => ({ origin: new THREE.Vector3(loadX, hd + 0.002, 0.01), dir: new THREE.Vector3(0, -1, 0), toward: true, length: 0.06 + p.V * 2e-6, label: `V = ${(p.V / 1000).toFixed(0)} kN` })} radius={0.004} />
      <Line points={[[cg, -hd - 0.03, 0.02], [loadX, -hd - 0.03, 0.02]]} color="#9bd17a" lineWidth={1} dashed dashSize={0.01} gapSize={0.006} />
      <Tag at={[(cg + loadX) / 2, -hd - 0.05, 0.02]} color="#9bd17a">e = {(p.arm * 1000).toFixed(0)} mm from the c.g.</Tag>
      <Tag at={[cg, 0, 0.03]} color="#f5b942">c.g. (N_y = {(cg * 1000).toFixed(0)} mm)</Tag>
      <PartLabel partId="welds" at={[hb / 2, hd + 0.04, 0.03]} />
      <PartLabel partId="bracket" at={[0.45, 0.05, 0.03]} />
      <PartLabel partId="column" at={[-0.05, 0.25, 0]} />
    </group>
  )
}
