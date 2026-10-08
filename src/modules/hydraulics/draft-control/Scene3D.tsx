import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, helixSpring, mat4, merge, tube, xform } from '@/geometry'
import { HITCH_VMAX, hitchToWorld, soilDir, soilResistance, traceAt } from '@/physics/linkageControl'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { PROFILES, createSoil, stampRun } from '@/render/soil'
import { SoilSurface } from '@/render/SoilSurface'
import { LINKAGE, TRACTOR } from '@/tractor/dims'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { DEFAULT_LINKAGE, phiForHitchHeight, solveLinkage } from '@/tractor/linkage'
import { Arrow } from '../three-point/overlay'
import { PLOUGH, ploughGeometry, resistanceLocal } from '../three-point/plough'
import { C, FIELD, SPRING_K, THETA, live, traces, useDraft } from './model'

const INFO = {
  plough: { summary: 'Fully mounted two-furrow plough.', role: 'Its draft rises with depth and soil strength. With no depth wheel, the hydraulics set its depth.', details: 'Typical 2 × 350 mm, 320 kg.' },
  bodies: { summary: 'Plough bodies.', role: 'Share, mouldboard and landside cut and turn the furrow slice; the soil force acts on them.' },
  spring: {
    summary: 'Draft-sensing spring (top-link sensing).',
    role: 'The top link pushes on a heavy spring (sometimes inside the top cover). More draft → more compression → the spring moves the control valve to lift the implement; less draft → the spring pushes back and the implement lowers.',
    details: 'Drawn schematically above the top-link bracket, deflection exaggerated ×6. A double-acting top link also senses tension (shallow work, front wheels dropping into a furrow).',
  },
  valve: { summary: 'Control valve (spool).', role: 'Its spool is moved by the sensing linkage and the operator’s lever: off-centre one way sends pump oil to the ram (lift), the other way lets the ram oil out to the reservoir (lower).', details: 'The response (damping) knob restricts the flow — fast to slow.' },
  soil: { summary: 'Field soil of varying strength.', role: 'Darker bands are harder soil (higher specific resistance). The furrow depth left behind shows what the control did.' },
}

const g = DEFAULT_LINKAGE
const SPRING_L = 0.17
/** spring capsule, fixed end at x0, rocker end toward −X */
const SPRING_X0 = -0.21
const SPRING_Y = 1.11

export function Draft3D() {
  const flows = useDraft((s) => s.flows)
  const pose = useMemo(() => createTractorPose({ hitchHeight: 0.35 }), [])
  const P = useMemo(() => ploughGeometry(LINKAGE.mastHeight, 2 * LINKAGE.hitchSpread, 0.028, 0.025), [])
  const soil = useMemo(() => createSoil(16, 2.4, 0.05, 0, -1.3), [])
  const G = useMemo(() => {
    const spring = xform(helixSpring(0.026, 0.0055, SPRING_L, 7), mat4.rz(-Math.PI / 2))
    return {
      spring,
      capsule: xform(tube(0.04, 0.034, 0.22, 32), mat4.c(mat4.t(SPRING_X0 - 0.11, SPRING_Y, 0), mat4.rz(Math.PI / 2))),
      capEnd: xform(cylinder(0.04, 0.012, 32), mat4.c(mat4.t(SPRING_X0 + 0.006, SPRING_Y, 0), mat4.rz(Math.PI / 2))),
      plunger: xform(cylinder(0.009, 1, 12), mat4.c(mat4.t(-0.5, 0, 0), mat4.rz(Math.PI / 2))),
      rocker: merge(box(0.03, 0.27, 0.05), xform(cylinder(0.02, 0.07, 16), mat4.rx(Math.PI / 2))),
      senseRod: xform(cylinder(0.006, 0.2, 10), mat4.c(mat4.t(SPRING_X0 + 0.1, SPRING_Y + 0.02, 0.03), mat4.rz(Math.PI / 2))),
      valveBody: box(0.17, 0.075, 0.1),
      spool: merge(
        xform(cylinder(0.008, 0.17, 16), mat4.rz(Math.PI / 2)),
        ...[-0.05, 0, 0.05].map((x) => xform(cylinder(0.016, 0.02, 20), mat4.c(mat4.t(x, 0, 0), mat4.rz(Math.PI / 2)))),
      ),
    }
  }, [])
  const valvePos: [number, number, number] = [0.07, 1.105, 0]
  const flowUp = useMemo(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(0.12, 1.1, 0.03), new THREE.Vector3(0.14, 1.03, 0.06), new THREE.Vector3(0.05, 0.98, 0.1), new THREE.Vector3(-0.12, 0.98, 0.1)]),
    [],
  )
  const flowDown = useMemo(() => new THREE.CatmullRomCurve3(flowUp.getPoints(12).reverse()), [flowUp])

  const soilGroup = useRef<THREE.Group>(null)
  const springRef = useRef<THREE.Group>(null)
  const plungerRef = useRef<THREE.Group>(null)
  const rockerRef = useRef<THREE.Group>(null)
  const spoolRef = useRef<THREE.Group>(null)
  const st = useRef({ s: 0, g0: -1e9, last: [NaN, NaN] as number[], key: '' })

  const regen = (g0: number, s: number) => {
    const p = useDraft.getState()
    const T = traces(p)[p.mode]
    st.current.g0 = g0
    soil.height.fill(0)
    soil.disturbed.fill(0)
    for (let i = 0; i < soil.nx; i++) {
      const k = soilResistance(g0 + i * soil.cell, p.k0, p.variability) / p.k0
      const c = Math.max(0, Math.min(0.85, (k - 1) * 0.9))
      for (let j = 0; j < soil.nz; j++) soil.compacted[j * soil.nx + i] = c
    }
    // furrow already ploughed behind each body
    const lk = solveLinkage(phiForHitchHeight(traceAt(T, 'h', s), g), g)
    PLOUGH.bodies.forEach((b, bi) => {
      const off = hitchToWorld(lk, { x: b.x, y: PLOUGH.shareY }).x
      const end = s + off
      for (let x = Math.max(g0, off); x < end; x += 0.1) {
        const d = traceAt(T, 'depth', x - off)
        if (d > 0.002) stampRun(soil, x - g0, Math.min(end, x + 0.1) - g0, b.z, PLOUGH.furrow * 1.3, PROFILES.mouldboard(d, PLOUGH.furrow))
      }
      st.current.last[bi] = end
    })
    soil.version++
  }

  useSimFrame((dt) => {
    const p = useDraft.getState()
    const T = traces(p)
    const tr = T[p.mode]
    const other = T[p.mode === 'draft' ? 'position' : 'draft']
    const S = st.current
    const v = p.speed / 3.6
    const key = `${p.mode}|${p.depth}|${p.response}|${p.k0}|${p.variability}|${p.speed}`
    S.s += v * dt
    let fresh = false
    if (S.s > FIELD || key !== S.key) {
      if (S.s > FIELD) S.s = 0
      S.key = key
      fresh = true
    }
    const s = S.s
    if (fresh || s + 4.6 > S.g0 + 16) regen(s - 7, s)
    soilGroup.current?.position.set(S.g0 - s, 0, 0)

    const h = traceAt(tr, 'h', s)
    const rate = traceAt(tr, 'rate', s)
    const comp = traceAt(tr, 'comp', s)
    pose.hitchHeight = h
    pose.rearAngle += (v / TRACTOR.rear.rolling) * dt
    pose.frontAngle += (v / TRACTOR.front.radius) * dt
    live.x = s
    live.h = h
    live.depth = traceAt(tr, 'depth', s)
    live.draft = traceAt(tr, 'draft', s)
    live.comp = comp
    live.k = traceAt(tr, 'k', s)
    live.rate = rate
    live.other.depth = traceAt(other, 'depth', s)
    live.other.draft = traceAt(other, 'draft', s)

    // furrow behind each body
    const lk = solveLinkage(phiForHitchHeight(h, g), g)
    PLOUGH.bodies.forEach((b, bi) => {
      const xb = s + hitchToWorld(lk, { x: b.x, y: PLOUGH.shareY }).x
      const prev = S.last[bi]
      if (Number.isFinite(prev) && xb > prev && live.depth > 0.002) {
        stampRun(soil, prev - S.g0, xb - S.g0, b.z, PLOUGH.furrow * 1.3, PROFILES.mouldboard(live.depth, PLOUGH.furrow))
        soil.version++
      }
      S.last[bi] = xb
    })

    // sensing spring, rocker and spool (deflections exaggerated)
    const defl = Math.max(-0.05, Math.min(0.06, (comp / SPRING_K) * 6))
    const Ls = SPRING_L - defl
    springRef.current?.scale.set(Ls / SPRING_L, 1, 1)
    springRef.current?.position.set(SPRING_X0 - Ls, SPRING_Y, 0)
    const rx = SPRING_X0 - Ls
    if (plungerRef.current) {
      plungerRef.current.position.set(rx, SPRING_Y, 0)
      plungerRef.current.scale.set(rx - (LINKAGE.topPivot.x - 0.01), 1, 1)
    }
    rockerRef.current?.rotation.set(0, 0, -defl * 1.5)
    spoolRef.current?.position.set(valvePos[0] + Math.max(-1, Math.min(1, rate / HITCH_VMAX)) * 0.025, valvePos[1], valvePos[2])
  })

  const ploughMounted = (
    <Part id="plough" name="Mounted plough" role="static" material="paintBlue" info={INFO.plough} cites={[SRC.am502('§12 mouldboard plough'), ...C.draft]}>
      <PartMesh geometry={P.headstock} />
      <PartMesh geometry={P.lowerPins} material="chrome" />
      <PartMesh geometry={P.topPin} material="chrome" />
      <PartMesh geometry={P.frame} />
      <PartMesh geometry={P.legs} material="forged" />
      <Part id="plough-bodies" name="Plough bodies" material="steel" info={INFO.bodies}>
        <PartMesh geometry={P.boards} />
        <PartMesh geometry={P.shares} material="chrome" />
        <PartMesh geometry={P.landsides} material="steelDark" />
      </Part>
    </Part>
  )

  const curP = () => {
    const lk = solveLinkage(phiForHitchHeight(live.h, g), g)
    return hitchToWorld(lk, resistanceLocal(live.depth))
  }
  return (
    <group>
      <Tractor pose={pose} mounted={ploughMounted} drawbar={false} internals={false}>
        <Part id="sensing-spring" name="Draft-sensing spring" role="moving" material="steel" info={INFO.spring} cites={C.draft} cut={false}>
          <PartMesh geometry={G.capsule} material="paintGrey" />
          <PartMesh geometry={G.capEnd} material="paintGrey" />
          <group ref={springRef}>
            <PartMesh geometry={G.spring} />
          </group>
          <group ref={plungerRef}>
            <PartMesh geometry={G.plunger} material="chrome" />
          </group>
          <group ref={rockerRef} position={[LINKAGE.topPivot.x, (LINKAGE.topPivot.y + SPRING_Y) / 2 + 0.01, 0]}>
            <PartMesh geometry={G.rocker} material="forged" />
          </group>
          <PartMesh geometry={G.senseRod} material="chrome" />
        </Part>
        <Part id="control-valve" name="Control valve" role="housing" material="castIron" info={INFO.valve} cites={[...C.draft, ...C.circuit]}>
          <PartMesh geometry={G.valveBody} position={valvePos} />
          <Part id="valve-spool" name="Valve spool" role="moving" material="chrome" info={INFO.valve}>
            <group ref={spoolRef} position={valvePos}>
              <PartMesh geometry={G.spool} />
            </group>
          </Part>
        </Part>
      </Tractor>
      {flows && (
        <>
          <Flow curve={flowUp} count={30} radius={0.007} color="#e8794f" speed={0.8} spread={0.008} intensity={() => (live.rate > 0 ? Math.min(1, 0.3 + live.rate / HITCH_VMAX) : 0)} />
          <Flow curve={flowDown} count={30} radius={0.007} color="#6fb3e0" speed={0.8} spread={0.008} intensity={() => (live.rate < 0 ? Math.min(1, 0.3 - live.rate / HITCH_VMAX) : 0)} />
        </>
      )}
      <group ref={soilGroup}>
        <Part id="soil" name="Field soil" role="static" material="soil" info={INFO.soil} cut={false}>
          <SoilSurface grid={soil} depth={0.45} compactedColor="#a08c70" />
        </Part>
      </group>
      <Arrow
        color="#e8794f"
        get={() => {
          if (live.depth <= 0) return null
          const P0 = curP()
          const u = soilDir(THETA)
          return { from: [P0.x, P0.y, 0.75], dir: [u.x, u.y, 0], len: Math.min(1.4, live.draft / 8000) }
        }}
      />
      <PartLabel partId="sensing-spring" at={[-0.33, 1.3, 0.12]} />
      <PartLabel partId="control-valve" at={[0.08, 1.3, 0.1]} />
      <PartLabel partId="plough-bodies" at={[-2.0, 0.15, -0.6]} />
      <PartLabel partId="soil" at={[-3.5, 0.05, 0.9]} />
    </group>
  )
}
