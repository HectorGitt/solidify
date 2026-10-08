import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, mat4, xform } from '@/geometry'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { ForceArrow } from '../_shared/Arrow'
import { A503 } from '../_shared/cites'
import { InstancedPartMesh } from '../_shared/InstancedPartMesh'
import { flatSection, sweepLoop, vSection } from '../_shared/loop'
import { flatPulley, hubKey, idlerPulley, marker, motor, pillowBlock, shaft, vSheave } from './geometry'
import { IDLER_R, SECTIONS, analyse, buildLoop, idlerCentre, live, tensionAt, useBelts } from './model'

const { PI } = Math
const MAX_MARKERS = 220
export const FLOOR = -0.9

const C = {
  calc: [A503.m(4, 'slides 2–12'), A503.manual('belt drives')],
  sel: [A503.m(2, 'Example 1'), A503.table('Tables 2–6')],
  intro: [A503.m(1, 'Fig 1, flexible drives'), A503.mg15('Q1 merits of belts')],
}

const INFO = {
  drive: { summary: 'Belt drive: a driver pulley on the motor, a driven pulley on the machine, and an endless belt.', role: 'Transmits power by friction between belt and pulleys. Cheap, quiet, needs no lubrication and spans long centres — but it slips and stretches.' },
  driver: { summary: 'Driver (motor) pulley — the smaller pulley.', role: 'Pulls the belt in on the tight side. Its smaller wrap usually governs the drive.' },
  driven: { summary: 'Driven pulley on the machine shaft.', role: 'Speed ratio N₁/N₂ = D/d (less a little slip and creep).' },
  belt: { summary: 'The belt.', role: 'Tight side T₁ is pulled onto the driver; slack side T₂ leaves it. Power P = (T₁ − T₂)v.', details: 'Flat belts: leather (ρ ≈ 970 kg/m³, s ≈ 2–3.45 MPa) or rubber (ρ ≈ 1250 kg/m³, 1–1.7 MPa). V-belts wedge into the groove so the friction is multiplied by 1/sin(θ/2).' },
  idler: { summary: 'Idler (jockey) pulley on the slack side.', role: 'Presses the slack span in, increasing the angle of wrap on both pulleys, and takes up stretch.' },
  motor: { summary: 'Electric motor (prime mover).', role: 'Turns the driver pulley at its rated speed.' },
  bearings: { summary: 'Plummer-block bearings of the driven shaft.', role: 'Carry the belt pull T₁ + T₂ on the shaft.' },
  frame: { summary: 'Machine bed.', role: 'Holds both shafts parallel at the centre distance C.' },
  markers: { summary: 'Paint marks on the belt.', role: 'Spaced evenly on the unstretched belt: they open up on the tight side and close up on the slack side — creep (exaggerated here).' },
}

export function Belts3D() {
  const p = useBelts()
  const a = useMemo(() => analyse(p), [p])
  const isV = p.kind === 'v'
  const crossed = p.layout === 'crossed' && !isV
  const sec = SECTIONS[p.section]
  const beltW = isV ? sec.top : Math.max(0.02, a.width ? a.width.b : p.b)
  const beltT = isV ? sec.h : Math.max(0.003, p.t)
  const n = isV ? Math.max(1, Math.round(p.nBelts)) : 1

  const geo = useMemo(() => {
    const r1 = p.d / 2
    const r2 = p.D / 2
    const W = beltW * 1.15 + 0.012
    const small = isV ? vSheave(r1, n, p.section, p.groove) : { geometry: flatPulley(r1, W), width: W, outside: r1 }
    const large = isV ? vSheave(r2, n, p.section, p.groove) : { geometry: flatPulley(r2, W), width: W, outside: r2 }
    // belt: flat belts ride on the rim (loop at r + t/2, symmetric section); V-belts on the pitch line
    const loop = isV ? buildLoop(p) : buildLoop(p, beltT / 2)
    const section = isV ? vSection(sec.top, sec.h, p.groove, sec.h * 0.35) : flatSection(beltW, beltT).map(([u, z]) => [u - beltT / 2, z] as [number, number])
    const twistAngle = (s: number) => {
      if (!crossed) return 0
      const si = loop.segAt(s)
      const g = loop.segs[si]
      const u = (s - g.s0) / (g.s1 - g.s0)
      return si === 1 ? Math.PI * u : si === 2 ? Math.PI : si === 3 ? Math.PI * (1 + u) : 0
    }
    const band = sweepLoop(loop, section, Math.min(720, Math.max(240, Math.round(loop.length * 120))), twistAngle)
    const pw = Math.max(small.width, large.width)
    return { small, large, loop, band, pw }
  }, [p.d, p.D, p.C, p.layout, p.kind, p.section, p.groove, p.idlerAt, p.idlerPush, n, beltW, beltT]) // eslint-disable-line react-hooks/exhaustive-deps

  const statics = useMemo(() => {
    const R = Math.max(p.d, p.D) / 2
    const bedY = -R - 0.12
    const zBack = -0.42
    return {
      bedY,
      motor: motor(0.1, 0.3),
      shaft1: shaft(0.019, -0.1, geo.pw / 2 + 0.03),
      shaft2: shaft(0.025, zBack - 0.05, geo.pw / 2 + 0.03),
      key1: hubKey(0.02, 0.07),
      key2: hubKey(0.02, 0.07),
      pillow: pillowBlock(0.026, -bedY),
      motorStand: xform(box(0.2, Math.max(0.01, -bedY - 0.1), 0.26), mat4.t(0, (bedY - 0.1) / 2, -0.25)),
      bed: xform(box(p.C + Math.max(p.d, p.D) + 0.3, 0.04, 0.5), mat4.t(0, bedY - 0.02, -0.2)),
      legs: Math.max(0.01, bedY - 0.04 - FLOOR),
      idler: idlerPulley(IDLER_R, beltW * 1.15 + 0.012),
      idlerShaft: shaft(0.012, -0.08, 0.06),
      zBack,
    }
  }, [p.d, p.D, p.C, geo.pw, beltW])

  const leg = useMemo(() => box(0.06, 1, 0.06), [])
  const markGeo = useMemo(() => marker(beltW), [beltW])

  // ----- animation: driver at rpm; belt material moves; creep opens marks on the tight side -----
  const th = useRef({ a1: 0, a2: 0, ai: 0, m0: 0 })
  const g1 = useRef<THREE.Group>(null)
  const g2 = useRef<THREE.Group>(null)
  const gi = useRef<THREE.Group>(null)
  const marks = useRef<THREE.InstancedMesh>(null)
  const table = useMemo(() => {
    // material coordinate along the loop: dm = ds / (1 + ε), ε = creep·(T − T2)/(T1 − T2)
    const K = 600
    const L = geo.loop.length
    const sArr = new Float64Array(K + 1)
    const mArr = new Float64Array(K + 1)
    let m = 0
    for (let i = 0; i <= K; i++) {
      const s = (L * i) / K
      sArr[i] = s
      mArr[i] = m
      const T = tensionAt(a, s + L / (2 * K))
      const eps = (p.creep * (T - a.T2)) / Math.max(1e-6, a.T1 - a.T2)
      m += L / K / (1 + eps)
    }
    return { sArr, mArr, M: mArr[K], L }
  }, [geo.loop, a, p.creep])

  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: new THREE.Vector3(), t: new THREE.Vector3(), nrm: new THREE.Vector3(), side: new THREE.Vector3(), basis: new THREE.Matrix4() }), [])

  useSimFrame((dt) => {
    const st = th.current
    const w1 = (p.rpm * 2 * PI) / 60
    const r1 = p.d / 2
    const v1 = w1 * (isV ? r1 : r1 + beltT / 2)
    // belt surface speed on the driver is v1 (tight side); the slack side is slower by the creep
    const vSlack = v1 / (1 + p.creep)
    const w2 = vSlack / (isV ? p.D / 2 : p.D / 2 + beltT / 2)
    st.a1 += w1 * dt
    st.a2 += (crossed ? -1 : 1) * w2 * dt
    st.ai -= (vSlack / (IDLER_R + beltT / 2)) * dt
    // material speed = local speed / (1 + ε); on the tight side ε = creep
    st.m0 = (st.m0 + (v1 / (1 + p.creep)) * dt) % table.M
    g1.current?.rotation.set(0, 0, st.a1)
    g2.current?.rotation.set(0, 0, st.a2)
    gi.current?.rotation.set(0, 0, st.ai)
    live.rpm1 = p.rpm
    live.rpm2 = (w2 * 60) / (2 * PI)
    live.v = v1
    live.slip = 1 - live.rpm2 / ((p.rpm * p.d) / p.D)

    const mesh = marks.current
    if (!mesh) return
    const spacing = 0.12
    const count = Math.min(Math.floor(MAX_MARKERS / n), Math.floor(table.M / spacing))
    const { sArr, mArr, M } = table
    let k = 0
    for (let j = 0; j < count; j++) {
      const mt = (st.m0 + (j * M) / count) % M
      // binary search material coordinate → arc length
      let lo = 0
      let hi = mArr.length - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (mArr[mid] <= mt) lo = mid
        else hi = mid
      }
      const f = (mt - mArr[lo]) / Math.max(1e-9, mArr[hi] - mArr[lo])
      const s = sArr[lo] + f * (sArr[hi] - sArr[lo])
      geo.loop.pointAt(s, tmp.p)
      geo.loop.tangentAt(s, tmp.t)
      tmp.nrm.set(tmp.t.y, -tmp.t.x, 0).normalize()
      const out = isV ? sec.h * 0.35 + 0.0009 : beltT / 2 + 0.0009
      // a crossed belt turns half over on each span, so its marked face rolls round the tangent
      let phi = 0
      if (crossed) {
        const si = geo.loop.segAt(s)
        const g = geo.loop.segs[si]
        const u = (s - g.s0) / (g.s1 - g.s0)
        phi = si === 1 ? PI * u : si === 2 ? PI : si === 3 ? PI * (1 + u) : 0
      }
      tmp.side.set(0, 0, 1)
      const nx = tmp.nrm.clone().multiplyScalar(Math.cos(phi)).addScaledVector(tmp.side, Math.sin(phi))
      const zx = tmp.side.clone().multiplyScalar(Math.cos(phi)).addScaledVector(tmp.nrm, -Math.sin(phi))
      tmp.basis.makeBasis(tmp.t, nx, zx)
      for (let b = 0; b < n; b++) {
        const z = isV ? (b - (n - 1) / 2) * sec.e : 0
        tmp.o.position.copy(tmp.p).addScaledVector(nx, out)
        tmp.o.position.z += z
        tmp.o.quaternion.setFromRotationMatrix(tmp.basis)
        tmp.o.updateMatrix()
        mesh.setMatrixAt(k++, tmp.o.matrix)
      }
    }
    mesh.count = k
    mesh.instanceMatrix.needsUpdate = true
  })

  const x1 = -p.C / 2
  const x2 = p.C / 2
  const ic = idlerCentre(p)
  const zs = isV ? Array.from({ length: n }, (_, b) => (b - (n - 1) / 2) * sec.e) : [0]
  // tension arrows at the driver end of each span
  const spanArrow = (tight: boolean) => () => {
    const loop = geo.loop
    const seg = loop.segs.find((g) => g.kind === 'line' && (tight ? g.to === 0 : g.from === 0))!
    const P0 = new THREE.Vector3(...(tight ? seg.p1! : seg.p0!), geo.pw / 2 + 0.03)
    const P1 = new THREE.Vector3(...(tight ? seg.p0! : seg.p1!), geo.pw / 2 + 0.03)
    const dir = P1.clone().sub(P0)
    const T = tight ? a.T1 : a.T2
    return { origin: P0.add(dir.clone().normalize().multiplyScalar(0.03)), dir, length: Math.min(0.6, 0.05 + T / (a.T1 + 1e-6) * 0.3), label: `${tight ? 'T₁' : 'T₂'} = ${T.toFixed(0)} N` }
  }

  return (
    <group>
      <Part id="drive" name="Belt drive" role="moving" material="castIron" info={INFO.drive} cites={C.intro}>
        <Part id="frame" name="Machine bed" role="housing" material="paintGrey" info={INFO.frame} explode={[0, -0.15, 0]}>
          <PartMesh geometry={statics.bed} />
          {[-1, 1].map((sx) =>
            [-0.4, 0].map((z) => (
              <PartMesh key={`${sx}${z}`} geometry={leg} position={[sx * (p.C / 2 + Math.max(p.d, p.D) / 2), FLOOR + statics.legs / 2, z]} scale={[1, statics.legs, 1]} />
            )),
          )}
        </Part>
        <group position={[x1, 0, 0]}>
          <Part id="motor" name="Electric motor" role="housing" material="paintBlue" info={INFO.motor} cites={C.calc} explode={[0, 0, -0.25]}>
            <PartMesh geometry={statics.motor} position={[0, 0, -0.1]} />
            <PartMesh geometry={statics.motorStand} material="paintGrey" />
          </Part>
          <Part id="driver" name={`Driver pulley, Ø${(p.d * 1000).toFixed(0)} mm`} role="moving" material="castIron" cut info={INFO.driver} cites={C.calc} explode={[0, 0, 0.12]}>
            <group ref={g1}>
              <PartMesh geometry={geo.small.geometry} />
              <PartMesh geometry={statics.shaft1} material="steel" />
              <PartMesh geometry={statics.key1} material="steelDark" />
            </group>
          </Part>
        </group>
        <group position={[x2, 0, 0]}>
          <Part id="bearings" name="Plummer blocks" role="housing" material="castIron" info={INFO.bearings} explode={[0, 0, -0.2]}>
            <PartMesh geometry={statics.pillow} position={[0, 0, -0.16]} />
            <PartMesh geometry={statics.pillow} position={[0, 0, statics.zBack]} />
          </Part>
          <Part id="driven" name={`Driven pulley, Ø${(p.D * 1000).toFixed(0)} mm`} role="moving" material="castIron" cut info={INFO.driven} cites={C.calc} explode={[0, 0, 0.12]}>
            <group ref={g2}>
              <PartMesh geometry={geo.large.geometry} />
              <PartMesh geometry={statics.shaft2} material="steel" />
              <PartMesh geometry={statics.key2} material="steelDark" />
            </group>
          </Part>
        </group>
        {p.layout === 'idler' && !isV ? (
          <Part id="idler" name="Idler pulley" role="moving" material="steel" info={INFO.idler} cites={[A503.m(4, 'Example: an idler pulley is used')]} explode={[0, -0.1, 0.1]}>
            <group position={[ic[0], ic[1], 0]}>
              <group ref={gi}>
                <PartMesh geometry={statics.idler} />
              </group>
              <PartMesh geometry={statics.idlerShaft} material="steelDark" />
            </group>
          </Part>
        ) : null}
        <Part id="belt" name={isV ? `${n} × ${p.section}-section V-belt${n > 1 ? 's' : ''}` : crossed ? 'Crossed flat belt' : 'Open flat belt'} role="moving" material={isV ? 'rubber' : 'leather'} cut info={INFO.belt} cites={C.calc} explode={[0, 0, 0.3]}>
          {zs.map((z) => (
            <PartMesh key={z} geometry={geo.band} position={[0, 0, z]} />
          ))}
          <Part id="markers" name="Creep marks" role="moving" material="ceramic" cut={false} info={INFO.markers} beyondNotes>
            <InstancedPartMesh ref={marks} geometry={markGeo} count={MAX_MARKERS} />
          </Part>
        </Part>
      </Part>

      <ForceArrow color="#e8794f" spec={spanArrow(true)} />
      <ForceArrow color="#6fb3e0" spec={spanArrow(false)} />

      <PartLabel partId="driver" at={[x1, p.d / 2 + 0.08, 0.05]} />
      <PartLabel partId="driven" at={[x2, p.D / 2 + 0.08, 0.05]} />
      <PartLabel partId="belt" at={[0, -Math.max(p.d, p.D) / 2 - 0.02, 0.06]} />
      <PartLabel partId="motor" at={[x1 - 0.12, 0.14, -0.3]} />
      <PartLabel partId="bearings" at={[x2 + 0.08, 0.06, -0.3]} />
      {p.layout === 'idler' && !isV ? <PartLabel partId="idler" at={[ic[0], ic[1] - 0.1, 0.05]} /> : null}
    </group>
  )
}
