import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, merge, roundedBox, tube, xform, mat4 } from '@/geometry'
import { coilSpring, dashpot } from '@/parts/lib/chassis'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { rk4Step, smdDeriv } from '@/physics/vibration'
import { Arrow, setArrow } from '../_shared/ui'
import { C, RIG, forcing, getRun, live, pick, useSmd } from './model'

const INFO = {
  rig: {
    summary: 'Spring–mass–damper rig: the idealised model of every vibrating machine.',
    role: 'A mass M on a spring k and a viscous damper (dashpot) b, with an applied force F(t). Free-body forces on the mass: kx, bẋ and F(t).',
    details: 'x is measured from static equilibrium, so the weight Mg is balanced by the initial spring deflection and drops out of mẍ + cẋ + kx = F(t).',
  },
  base: { summary: 'Rigid base (the "ground" of the model).', role: 'Fixed support for the spring and the dashpot cylinder.' },
  mass: {
    summary: 'Lumped mass m.',
    role: 'All the inertia of the system, concentrated in one rigid body (lumped-parameter assumption). It slides on two guide rods so it has one degree of freedom.',
  },
  spring: {
    summary: 'Linear spring, stiffness k.',
    role: 'Restoring force kx proportional to displacement (linearity assumption). Its own mass is neglected; if not, add M_s/3 to m.',
  },
  dashpot: {
    summary: 'Viscous damper (dashpot), coefficient b (or c).',
    role: 'Oil forced through orifices in the piston gives a force bẋ proportional to velocity. It dissipates energy, so free vibration dies away.',
    details: 'Cut the cylinder to see the perforated piston in the oil.',
  },
  piston: { summary: 'Dashpot piston with orifices.', role: 'Oil squeezes through the holes as it moves; the pressure difference across it is the damping force.' },
  oil: { summary: 'Damping oil.', role: 'Its viscosity and the orifice size set the damping coefficient b.' },
  guides: { summary: 'Guide rods and bushes.', role: 'Constrain the mass to vertical motion only — a single-degree-of-freedom system.' },
  exciter: {
    summary: 'Vibration exciter (shaker) and stinger.',
    role: 'Applies the input force F(t): a step u(t) or a sinusoid F₀ sin ωt. Disconnected for free vibration.',
  },
  ruler: { summary: 'Displacement scale.', role: 'The pointer on the mass reads x from the equilibrium mark (red).' },
}

export function Scene3D() {
  const mode = useSmd((s) => s.mode)
  const m = useSmd((s) => s.m)

  const g = useMemo(() => {
    // dashpot from the parts library, its cup standing on the base
    const dp = dashpot()
    const onBase = mat4.t(0, RIG.baseTop, 0)
    const cup = xform(dp.cup, onBase)
    const gland = xform(dp.gland, onBase)
    const oil = xform(dp.oil, onBase)
    const piston = dp.piston
    const rodLen = RIG.massRest - RIG.pistonRest
    const rod = xform(cylinder(0.0065, rodLen, 20), mat4.t(0, rodLen / 2, 0))
    const base = xform(roundedBox(0.58, 0.04, 0.3, 0.01), mat4.t(0, 0.02, 0))
    const springSeat = xform(cylinder(0.042, 0.008, 40), mat4.t(0, 0, 0))
    const guide = xform(cylinder(0.008, RIG.beamY - RIG.baseTop, 20), mat4.t(0, (RIG.beamY + RIG.baseTop) / 2, 0))
    const beam = xform(box(0.5, 0.04, 0.08), mat4.t(0, RIG.beamY + 0.02, 0))
    const massBody = xform(box(RIG.massW, RIG.massH, RIG.massD), mat4.t(0, RIG.massH / 2, 0))
    const lugs = merge(...[-1, 1].map((s) => xform(box(0.06, 0.05, 0.05), mat4.t(s * 0.17, RIG.massH / 2, 0))))
    const bush = tube(0.017, 0.0085, 0.07, 32)
    const exciter = merge(
      xform(cylinder(0.05, 0.1, 40), mat4.t(0, RIG.beamY + 0.04 + 0.05, 0)),
      xform(cylinder(0.055, 0.012, 40), mat4.t(0, RIG.beamY + 0.04 + 0.106, 0)),
    )
    const stinger = xform(cylinder(0.004, 1, 12), mat4.t(0, 0.5, 0))
    const springGeo = coilSpring({ coilR: 0.034, wireR: 0.0048, turns: 9 })
    const ruler = xform(box(0.012, 0.32, 0.05), mat4.t(RIG.rulerX, RIG.massRest + RIG.massH / 2, 0))
    const ticks: THREE.BufferGeometry[] = []
    for (let i = -6; i <= 6; i++) {
      const w = i % 2 === 0 ? 0.022 : 0.012
      ticks.push(xform(box(w, 0.0025, 0.004), mat4.t(RIG.rulerX + 0.006 + w / 2, RIG.massRest + RIG.massH / 2 + i * 0.01 * 2.2, 0.018)))
    }
    const zero = xform(box(0.034, 0.004, 0.006), mat4.t(RIG.rulerX + 0.017, RIG.massRest + RIG.massH / 2, 0.018))
    const pointer = xform(box(0.105, 0.006, 0.012), mat4.t(-RIG.massW / 2 - 0.05, RIG.massH / 2, 0.018))
    const rulerPost = xform(box(0.02, RIG.massRest + RIG.massH / 2 - 0.16 - RIG.baseTop, 0.02), mat4.t(RIG.rulerX, (RIG.massRest + RIG.massH / 2 - 0.16 + RIG.baseTop) / 2, 0))
    return { cup, gland, oil, piston, rod, base, springSeat, guide, beam, massBody, lugs, bush, exciter, stinger, springGeo, ruler, ticks: merge(...ticks), zero, pointer, rulerPost }
  }, [])

  const massRef = useRef<THREE.Group>(null)
  const springRef = useRef<THREE.Mesh>(null)
  const stingerRef = useRef<THREE.Mesh>(null)
  const arrowRef = useRef<THREE.Group>(null)
  const state = useRef({ key: '', t: 0, y: [0, 0] })
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const base = useMemo(() => new THREE.Vector3(), [])

  useSimFrame((dt) => {
    const p = pick(useSmd.getState())
    const run = getRun(p)
    const key = JSON.stringify(p)
    const s = state.current
    if (key !== s.key || s.t >= run.tEnd) {
      s.key = key
      s.t = 0
      s.y = [p.mode === 'free' ? p.x0 : 0, 0]
    }
    const F = forcing(p)
    const f = smdDeriv(p.m, p.c, p.k, F)
    const n = Math.max(1, Math.ceil(dt / run.h))
    const h = dt / n
    for (let i = 0; i < n && dt > 0; i++) {
      s.y = rk4Step(f, s.t, s.y, h)
      s.t += h
    }
    const [x, v] = s.y
    const disp = Math.max(-RIG.travel * 1.15, Math.min(RIG.travel * 1.15, x * run.gain))
    const yM = RIG.massRest + disp
    massRef.current?.position.set(0, yM, 0)
    if (springRef.current) {
      springRef.current.position.y = RIG.baseTop + 0.008
      springRef.current.scale.y = yM - RIG.baseTop - 0.016
    }
    const top = yM + RIG.massH
    if (stingerRef.current) {
      stingerRef.current.position.y = top
      stingerRef.current.scale.y = RIG.beamY - top
    }
    const Fv = F(s.t)
    const Fmax = Math.max(Math.abs(p.F0), 1e-9)
    const L = p.mode === 'free' ? 0 : (0.13 * Fv) / Fmax
    // a downward force is drawn above the mass, pointing at it
    base.set(0.06, top + 0.005 + (L < 0 ? -L : 0), 0)
    setArrow(arrowRef.current, base, up, L)
    live.t = s.t
    live.x = x
    live.v = v
    live.a = (Fv - p.c * v - p.k * x) / p.m
    live.F = Fv
    live.tEnd = run.tEnd
  })

  return (
    <group>
      <Part id="rig" name="Spring–mass–damper rig" role="housing" material="castIron" info={INFO.rig} cites={[C.m12('idealised mass, spring, dashpot'), C.ln('modelling, second-order systems')]}>
        <Part id="base" name="Base" material="castIron" role="housing" info={INFO.base}>
          <PartMesh geometry={g.base} />
          <PartMesh geometry={g.beam} material="paintGrey" />
        </Part>
        <Part id="guides" name="Guide rods" material="chrome" role="static" info={INFO.guides} cut={false}>
          <PartMesh geometry={g.guide} position={[-RIG.guideX, 0, 0]} />
          <PartMesh geometry={g.guide} position={[RIG.guideX, 0, 0]} />
        </Part>
        <Part id="spring" name="Spring k" material="steelDark" role="moving" info={INFO.spring} cites={[C.ln('springs; equivalent systems')]} cut={false}>
          <group position={[RIG.springX, 0, 0]}>
            <PartMesh geometry={g.springSeat} position={[0, RIG.baseTop + 0.004, 0]} material="steel" />
            <PartMesh ref={springRef} geometry={g.springGeo} />
          </group>
        </Part>
        <Part id="dashpot" name="Dashpot b" material="aluminium" role="housing" info={INFO.dashpot} cites={[C.m12('dashpot b'), C.ln('viscous damping')]} explode={[0.12, 0, 0.1]}>
          <group position={[RIG.dashX, 0, 0]}>
            <PartMesh geometry={g.cup} />
            <PartMesh geometry={g.gland} material="steelDark" />
            <Part id="oil" name="Damping oil" material="oil" role="fluid" info={INFO.oil}>
              <PartMesh geometry={g.oil} />
            </Part>
          </group>
        </Part>
        <Part id="mass-assembly" name="Mass, piston and rod" role="moving" material="paintYellow" info={INFO.mass} cites={[C.ln('lumped parameters')]}>
          <group ref={massRef} position={[0, RIG.massRest, 0]}>
            <Part id="mass" name={`Mass m`} material="paintYellow" info={INFO.mass}>
              <PartMesh geometry={g.massBody} />
              <PartMesh geometry={g.lugs} material="paintYellow" />
              <PartMesh geometry={g.pointer} material="paintRed" />
            </Part>
            <Part id="bushes" name="Linear bushes" material="bronze" info={{ summary: 'Bronze bushes sliding on the guide rods.' }}>
              <PartMesh geometry={g.bush} position={[-RIG.guideX, RIG.massH / 2, 0]} />
              <PartMesh geometry={g.bush} position={[RIG.guideX, RIG.massH / 2, 0]} />
            </Part>
            <Part id="piston" name="Dashpot piston & rod" material="chrome" info={INFO.piston} cites={[C.m12('dashpot')]}>
              <PartMesh geometry={g.rod} position={[RIG.dashX, RIG.pistonRest - RIG.massRest, 0]} />
              <PartMesh geometry={g.piston} material="steel" position={[RIG.dashX, RIG.pistonRest - RIG.massRest, 0]} />
            </Part>
          </group>
        </Part>
        <Part id="exciter" name="Exciter (applied force F)" material="paintBlue" role="static" info={INFO.exciter} cites={[C.ln('forced response, transfer function')]} cut={false}>
          <PartMesh geometry={g.exciter} />
          <group visible={mode !== 'free'}>
            <PartMesh ref={stingerRef} geometry={g.stinger} material="chrome" />
          </group>
        </Part>
        <Part id="ruler" name="Displacement scale" material="paintBlack" role="static" info={INFO.ruler} cut={false}>
          <PartMesh geometry={g.ruler} />
          <PartMesh geometry={g.rulerPost} material="paintGrey" />
          <PartMesh geometry={g.ticks} material="ceramic" />
          <PartMesh geometry={g.zero} material="paintRed" />
        </Part>
      </Part>
      <Arrow ref={arrowRef} color="#f08a3c" radius={0.006} />

      <PartLabel partId="mass" at={[0.12, RIG.massRest + 0.12, 0.08]} text={`Mass m = ${m < 10 ? m.toFixed(2) : m.toFixed(1)} kg`} />
      <PartLabel partId="spring" at={[RIG.springX - 0.05, 0.2, 0.05]} />
      <PartLabel partId="dashpot" at={[RIG.dashX + 0.05, 0.12, 0.05]} />
      <PartLabel partId="piston" at={[RIG.dashX + 0.04, RIG.pistonRest + 0.02, 0.03]} />
      <PartLabel partId="exciter" at={[0.08, RIG.beamY + 0.15, 0.05]} />
      <PartLabel partId="ruler" at={[RIG.rulerX, RIG.massRest + 0.22, 0.03]} />
      <PartLabel partId="guides" at={[RIG.guideX + 0.02, 0.55, 0.02]} />
    </group>
  )
}
