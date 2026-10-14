import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, mat4, merge, xform } from '@/geometry'
import { stabiliserParts, topLinkParts } from '@/parts/lib/hydraulics'
import { draftLineY, soilDir } from '@/physics/linkageControl'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { createSoil, PROFILES, stampRun } from '@/render/soil'
import { SoilSurface } from '@/render/SoilSurface'
import { LINKAGE } from '@/tractor/dims'
import { tractorGeometry } from '@/tractor/geometry'
import { Tractor, createTractorPose } from '@/tractor/Tractor'
import { CATS, C, analyse, floatStep, live, useThreePoint, type Analysis } from './model'
import { Arrow, Dot, Seg, orientX, type V3 } from './overlay'
import { PLOUGH, couplerGeometry, ploughGeometry } from './plough'

/** Overlay plane for the side-view construction (just outside the rear tyre). */
export const ZO = 1.12

const INFO = {
  linkage: { summary: 'Three-point linkage.', role: 'Lower links, top link and the implement mast form a four-bar chain with the tractor. The lift arms raise the lower links through the lift rods.', details: 'Side-view proportions are typical Category II.' },
  lower: { summary: 'Lower links (lower lift arms).', role: 'Pull the implement and carry its weight. Attach the left arm first, then the right (adjustable) arm, then the top link. Do not oil the balls.' },
  top: { summary: 'Top link with turnbuckle.', role: 'Its length sets the pitch of the implement and moves the virtual hitch point V. In draft control its compression is the sensing signal.', details: 'Turn the barrel: one end has a right-hand and the other a left-hand thread, so the link lengthens or shortens.' },
  arms: { summary: 'Lift arms on the rockshaft (ram cross shaft).', role: 'Turned by the hydraulic ram; lift the lower links through the lift rods.' },
  rods: { summary: 'Lift rods; the right-hand rod has a levelling box.', role: 'Link the lift arms to the lower links. Winding the levelling box changes one rod’s length to level the implement across its width. Grease weekly.' },
  stab: { summary: 'Stabilisers / check chains.', role: 'Limit the side sway of the lower links — tight for transport and for implements such as drills, slack for ploughing. Internal or external check chains do the same job.' },
  pins: { summary: 'Hitch pins (Category I, II or III).', role: 'Implement pins and link balls are made in three size categories by tractor power; a Cat I/II dual linkage is made by changing the hitch balls.', details: 'ISO 730 sizes: Cat I 22/19 mm pins, 683 mm spread, 460 mm mast; Cat II 28/25 mm, 825 mm, 610 mm; Cat III 37/32 mm, 965 mm, 685 mm.' },
  coupler: { summary: 'Automatic coupler.', role: 'An inverted-V frame on the link ends. Reverse under the implement’s matching A-frame and lift: the hooks pick up the pins without leaving the seat. A release lever frees them.' },
  plough: { summary: 'Fully mounted two-furrow mouldboard plough.', role: 'Carried wholly on the linkage. The soil force S on it, with the linkage geometry, decides whether it is pulled in or lifted out.', details: 'Typical size: 2 × 350 mm furrows, 320 kg.' },
  headstock: { summary: 'Headstock (implement mast).', role: 'Carries the two lower hitch pins and the top-link pin; the mast height (Cat II ≈ 610 mm) is the fourth bar of the chain.' },
  bodies: { summary: 'Plough bodies: share, mouldboard, landside.', role: 'The share cuts the furrow slice, the mouldboard lifts and turns it, the landside takes the side thrust against the furrow wall.' },
  V: { summary: 'Virtual hitch point V.', role: 'Where the lower-link and top-link lines meet: the instantaneous centre about which the implement moves relative to the tractor. If the soil-force line passes above V the implement is pulled in; through V it is in free-link equilibrium.' },
  soil: { summary: 'Field soil.', role: 'The furrow is cut at the current working depth.' },
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export function ThreePoint3D() {
  const catKey = useThreePoint((s) => s.cat)
  const coupler = useThreePoint((s) => s.coupler)
  const construct = useThreePoint((s) => s.construct)
  const cat = CATS[catKey]
  const G = useMemo(() => tractorGeometry(), [])
  const P = useMemo(() => ploughGeometry(cat.mast, cat.spread, cat.lowerPin, cat.topPin), [cat])
  const K = useMemo(() => couplerGeometry(cat.mast, cat.spread), [cat])
  const parts = useMemo(
    () => ({
      ...(() => {
        const t = topLinkParts()
        const st = stabiliserParts()
        return { topRod: t.rod, topBarrel: t.barrel, topEye: t.eye, stab: st.bar, stabSleeve: st.sleeve }
      })(),
      levelBox: merge(box(0.07, 0.11, 0.06), xform(box(0.12, 0.012, 0.012), mat4.t(0.06, 0.06, 0.03))),
      anchor: box(0.06, 0.08, 0.06),
    }),
    [],
  )
  const lowerLen = Math.hypot(LINKAGE.lowerLength, LINKAGE.hitchSpread - LINKAGE.lowerPivot.z)
  const pose = useMemo(() => createTractorPose(), [])
  const soil = useMemo(() => createSoil(10.6, 2.3, 0.04, -4.6, -1.3), [])
  const r = {
    lowL: useRef<THREE.Group>(null),
    lowR: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null),
    armR: useRef<THREE.Group>(null),
    rodL: useRef<THREE.Group>(null),
    rodR: useRef<THREE.Group>(null),
    stabL: useRef<THREE.Group>(null),
    stabR: useRef<THREE.Group>(null),
    rock: useRef<THREE.Group>(null),
    top: useRef<THREE.Group>(null),
    topRod: useRef<THREE.Group>(null),
    topBarrel: useRef<THREE.Group>(null),
    topEyeB: useRef<THREE.Group>(null),
    hitch: useRef<THREE.Group>(null),
  }
  const state = useRef<{ h: number; jump: number; lastDepth: number; a: Analysis | null }>({ h: useThreePoint.getState().h, jump: useThreePoint.getState().jump, lastDepth: NaN, a: null })

  useSimFrame((dt) => {
    const p = useThreePoint.getState()
    const s = state.current
    let a: Analysis
    if (p.jump !== s.jump) {
      s.jump = p.jump
      s.h = p.h
    }
    if (p.mode === 'float') {
      const f = floatStep(p, s.h, dt)
      s.h = f.h
      a = f.a
    } else {
      s.h = p.h
      a = analyse(p, s.h, 'hold')
    }
    s.a = a
    const lk = a.pose
    live.h = s.h
    live.depth = a.depth
    live.beta = lk.beta
    live.tilt = lk.mastTilt
    live.V = lk.V
    live.e = a.e
    live.stage = a.stage
    live.S = a.S
    live.T = a.T
    live.Ctop = a.Ctop

    const ct = CATS[p.cat]
    const half = ct.spread / 2
    const zl = LINKAGE.lowerPivot.z
    const zr = LINKAGE.rockshaft.z
    const zE = zl + (half - zl) * (LINKAGE.liftRodAt / LINKAGE.lowerLength)
    const A = LINKAGE.lowerPivot
    const Cr = LINKAGE.rockshaft
    for (const [sg, low, arm, rod, stab] of [
      [1, r.lowL.current, r.armL.current, r.rodL.current, r.stabL.current],
      [-1, r.lowR.current, r.armR.current, r.rodR.current, r.stabR.current],
    ] as const) {
      const a3 = v3(A.x, A.y, sg * zl)
      const l3 = v3(lk.L.x, lk.L.y, sg * half)
      orientX(low, a3, l3)
      low?.scale.set(a3.distanceTo(l3) / lowerLen, 1, 1)
      orientX(arm, v3(Cr.x, Cr.y, sg * zr), v3(lk.D.x, lk.D.y, sg * zr))
      orientX(rod, v3(lk.D.x, lk.D.y, sg * zr), v3(lk.E.x, lk.E.y, sg * zE))
      const m = a3.clone().lerp(l3, 0.62)
      const anc = v3(0.02, 0.5, sg * 0.5)
      orientX(stab, anc, m)
      stab?.scale.set(anc.distanceTo(m), 1, 1)
    }
    r.rock.current?.rotation.set(0, 0, -lk.beta)
    const b3 = v3(LINKAGE.topPivot.x, LINKAGE.topPivot.y, 0)
    const u3 = v3(lk.U.x, lk.U.y, 0)
    const tl = b3.distanceTo(u3)
    orientX(r.top.current, b3, u3)
    r.topRod.current?.position.set(0.02, 0, 0)
    r.topRod.current?.scale.set(Math.max(0.01, tl - 0.04), 1, 1)
    r.topBarrel.current?.position.set(tl / 2, 0, 0)
    r.topEyeB.current?.position.set(tl, 0, 0)
    if (r.hitch.current) {
      r.hitch.current.position.set(lk.L.x, lk.L.y, 0)
      r.hitch.current.rotation.set(0, 0, -lk.mastTilt)
    }

    // furrow at the current depth
    if (!(Math.abs(a.depth - s.lastDepth) < 0.003)) {
      s.lastDepth = a.depth
      soil.height.fill(0)
      soil.disturbed.fill(0)
      if (a.depth > 0.004) {
        const c = Math.cos(lk.mastTilt)
        const sn = Math.sin(lk.mastTilt)
        for (const b of PLOUGH.bodies) {
          const x = lk.L.x + b.x * c + PLOUGH.shareY * sn
          stampRun(soil, soil.x0, x, b.z, PLOUGH.furrow * 1.3, PROFILES.mouldboard(a.depth, PLOUGH.furrow), { disturb: 1 })
        }
      }
      soil.version++
    }
  })

  const A = () => state.current.a
  const z = ZO
  const far = (x: number) => Math.max(-9, Math.min(12, x))
  return (
    <group>
      <Tractor pose={pose} linkage={false} drawbar={false} internals={false} labels={false} />
      <Part id="linkage" name="Three-point linkage" role="moving" material="forged" info={INFO.linkage} cites={[...C.linkage, ...C.fig64]}>
        <Part id="lower-links" name="Lower links" info={INFO.lower} cites={C.linkage} explode={[0, -0.15, 0.25]}>
          <group ref={r.lowL}>
            <PartMesh geometry={G.lowerLink} />
          </group>
          <group ref={r.lowR}>
            <PartMesh geometry={G.lowerLink} />
          </group>
        </Part>
        <Part id="top-link" name="Top link (turnbuckle)" material="paintYellow" info={INFO.top} cites={[...C.linkage, ...C.fig65]} explode={[0, 0.2, 0]}>
          <group ref={r.top}>
            <PartMesh geometry={parts.topEye} />
            <group ref={r.topRod}>
              <PartMesh geometry={parts.topRod} material="chrome" />
            </group>
            <group ref={r.topBarrel}>
              <PartMesh geometry={parts.topBarrel} />
            </group>
            <group ref={r.topEyeB}>
              <PartMesh geometry={parts.topEye} />
            </group>
          </group>
        </Part>
        <Part id="lift-arms" name="Lift arms & rockshaft" info={INFO.arms} cites={[SRC.hy510('p1–2 Fig 40 ram cross shaft'), ...C.linkage]} explode={[0, 0.25, 0]}>
          <group position={[LINKAGE.rockshaft.x, LINKAGE.rockshaft.y, 0]} ref={r.rock}>
            <PartMesh geometry={G.rockshaft} material="steel" />
          </group>
          <group ref={r.armL}>
            <PartMesh geometry={G.liftArm} />
          </group>
          <group ref={r.armR}>
            <PartMesh geometry={G.liftArm} />
          </group>
        </Part>
        <Part id="lift-rods" name="Lift rods & levelling box" info={INFO.rods} cites={[...C.linkage, ...C.care]} explode={[0, 0.1, 0.2]}>
          <group ref={r.rodL}>
            <PartMesh geometry={G.liftRod} />
            <PartMesh geometry={parts.levelBox} position={[0.3, 0, 0.04]} material="paintYellow" />
          </group>
          <group ref={r.rodR}>
            <PartMesh geometry={G.liftRod} />
          </group>
        </Part>
        <Part id="stabilisers" name="Stabilisers / check chains" material="steelDark" info={INFO.stab} cites={C.linkage} explode={[0, 0, 0.3]}>
          {[1, -1].map((s) => (
            <group key={s}>
              <PartMesh geometry={parts.anchor} position={[0.02, 0.5, s * 0.5]} material="forged" />
            </group>
          ))}
          <group ref={r.stabL}>
            <PartMesh geometry={parts.stab} />
            <PartMesh geometry={parts.stabSleeve} />
          </group>
          <group ref={r.stabR}>
            <PartMesh geometry={parts.stab} />
            <PartMesh geometry={parts.stabSleeve} />
          </group>
        </Part>
      </Part>

      <group ref={r.hitch}>
        <Part id="plough" name="Mounted plough" role="static" material="paintBlue" info={INFO.plough} cites={[...C.plough, ...C.fig65]} explode={[-0.3, 0, 0]}>
          <Part id="headstock" name="Headstock (mast)" info={INFO.headstock} cites={C.fig64}>
            <PartMesh geometry={P.headstock} />
          </Part>
          <Part id="hitch-pins" name={`Hitch pins (${cat.label})`} material="chrome" info={INFO.pins} cites={C.linkage} beyondNotes>
            <PartMesh geometry={P.lowerPins} />
            <PartMesh geometry={P.topPin} />
          </Part>
          <Part id="frame" name="Plough frame" info={INFO.plough}>
            <PartMesh geometry={P.frame} />
            <PartMesh geometry={P.legs} material="forged" />
          </Part>
          <Part id="bodies" name="Plough bodies" material="steelDark" info={INFO.bodies} cites={C.plough} explode={[0, -0.2, 0]}>
            <PartMesh geometry={P.boards} material="steel" />
            <PartMesh geometry={P.shares} material="chrome" />
            <PartMesh geometry={P.landsides} />
          </Part>
        </Part>
        {coupler && (
          <Part id="coupler" name="Automatic coupler" material="paintYellow" info={INFO.coupler} cites={C.coupler} explode={[0.25, 0, 0]}>
            <PartMesh geometry={K.frame} />
            <PartMesh geometry={K.lever} material="paintRed" />
          </Part>
        )}
      </group>

      <Part id="soil" name="Soil" role="static" material="soil" info={INFO.soil} cut={false}>
        <SoilSurface grid={soil} depth={0.45} />
      </Part>

      {construct && (
        <group>
          {/* ground level and the side-view construction of V (Macmillan Fig 6.5) */}
          <Seg color="#8a7a66" radius={0.004} get={() => [[-4.6, 0, z], [6, 0, z]]} />
          <Seg
            color="#6fb3e0"
            radius={0.007}
            get={() => {
              const a = A()
              if (!a) return null
              const lk = a.pose
              const end = lk.V ?? { x: lk.L.x + 6 * (LINKAGE.lowerPivot.x - lk.L.x), y: lk.L.y + 6 * (LINKAGE.lowerPivot.y - lk.L.y) }
              return [[lk.L.x, lk.L.y, z], [far(end.x), end.y, z]] as [V3, V3]
            }}
          />
          <Seg
            color="#f5b942"
            radius={0.007}
            get={() => {
              const a = A()
              if (!a) return null
              const lk = a.pose
              const B = LINKAGE.topPivot
              const end = lk.V ?? { x: lk.U.x + 6 * (B.x - lk.U.x), y: lk.U.y + 6 * (B.y - lk.U.y) }
              return [[lk.U.x, lk.U.y, z], [far(end.x), end.y, z]] as [V3, V3]
            }}
          />
          <Seg
            color="#e8794f"
            radius={0.008}
            get={() => {
              const a = A()
              if (!a || a.depth <= 0) return null
              const th = (useThreePoint.getState().theta * Math.PI) / 180
              const x1 = far((a.pose.V?.x ?? a.P.x + 4) + 0.8)
              return [[a.P.x - 0.3, draftLineY(a.P, th, a.P.x - 0.3), z], [x1, draftLineY(a.P, th, x1), z]] as [V3, V3]
            }}
          />
          <Arrow
            color="#e8794f"
            get={() => {
              const a = A()
              if (!a || a.S <= 0) return null
              const u = soilDir((useThreePoint.getState().theta * Math.PI) / 180)
              return { from: [a.P.x, a.P.y, z], dir: [u.x, u.y, 0], len: Math.min(1.2, a.S / 10000) }
            }}
          />
          <Dot color="#e8794f" radius={0.022} get={() => (A() && A()!.depth > 0 ? [A()!.P.x, A()!.P.y, z] : null)} />
          <Dot color="#6fb3e0" radius={0.018} get={() => (A() ? [A()!.pose.L.x, A()!.pose.L.y, z] : null)} />
          <Dot color="#f5b942" radius={0.018} get={() => (A() ? [A()!.pose.U.x, A()!.pose.U.y, z] : null)} />
          <Part id="v-point" name="Virtual hitch point V" role="static" info={INFO.V} cites={C.fig65} cut={false}>
            <Dot color="#ff5b5b" radius={0.045} get={() => (A()?.pose.V ? [far(A()!.pose.V!.x), A()!.pose.V!.y, z] : null)} />
          </Part>
        </group>
      )}

      <PartLabel partId="top-link" at={[-0.8, 1.15, 0.15]} />
      <PartLabel partId="lower-links" at={[-0.75, 0.3, 0.55]} />
      <PartLabel partId="lift-arms" at={[-0.3, 1.25, 0.45]} />
      <PartLabel partId="lift-rods" at={[-0.45, 0.85, 0.62]} />
      <PartLabel partId="stabilisers" at={[-0.3, 0.42, 0.75]} />
      <PartLabel partId="headstock" at={[-1.1, 0.95, 0.3]} />
      <PartLabel partId="bodies" at={[-2.2, 0.1, -0.5]} />
      <PartLabel partId="hitch-pins" at={[-1.05, 0.4, 0.6]} />
      {construct && <PartLabel partId="v-point" at={[2.1, 0.85, ZO]} />}
      {coupler && <PartLabel partId="coupler" at={[-0.9, 0.8, -0.5]} />}
    </group>
  )
}
