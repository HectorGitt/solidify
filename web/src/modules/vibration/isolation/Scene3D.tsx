import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, roundedBox, xform } from '@/geometry'
import { hexBolt } from '@/geometry/parts'
import { coilSpring, telescopicDamper } from '@/parts/lib/chassis'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { Arrow, setArrow } from '../_shared/ui'
import { C, DIM, FRAME_Y, analyse, live, useIso } from './model'

const INFO = {
  foundation: { summary: 'Concrete foundation (rigid support).', role: 'Receives the force transmitted through the isolators, F_T = kx + cẋ. Isolation aims to keep F_T small.' },
  mounts: {
    summary: 'Four vibration isolators (spring + viscous damper in each).',
    role: 'Together they give the support stiffness k and damping c. Soft mounts lower ω_n so the running frequency is well above it (r > √2), where TR < 1.',
    details: 'Each mount carries ¼ of the stiffness and damping shown in the panel.',
  },
  springs: { summary: 'Isolator springs (total stiffness k).', role: 'Carry the machine weight and set ω_n = √(k/M).' },
  dampers: { summary: 'Isolator dampers (total c).', role: 'Limit the amplitude when the machine runs through resonance at start-up and stop, but raise TR above r = √2.' },
  frame: { summary: 'Machine base frame.', role: 'Ties the machine into one rigid mass M that moves on the mounts.' },
  compressor: {
    summary: 'Single-cylinder reciprocating compressor and motor, 450 kg.',
    role: 'At 1750 rpm the 10 kg reciprocating mass on a 100 mm crank gives an exciting force F₀ = m e ω² = 33.6 kN.',
  },
  hopper: {
    summary: 'Hopper with a shaker, 400 kg.',
    role: 'The shaker vibrates the hopper to keep the material flowing. Here k = 39.5 MN/m, b = 100 N·s/m and a 75 N force at 50 Hz.',
  },
  grain: { summary: 'Material in the hopper.', role: 'Part of the vibrating mass.' },
  eccentric: {
    summary: 'Rotating unbalance.',
    role: 'An eccentric mass m on radius e turning at ω produces a rotating force m e ω²; its vertical component F₀ sin ωt excites the mounts.',
  },
}

/** Square hopper shell as a 4-sided lathe: faces aligned with X and Z. */
function hopperShell() {
  const k = Math.SQRT2
  const top = 0.52 * k
  const bot = 0.11 * k
  const H = 0.7
  const t = 0.012 * k
  return lathe(
    [
      [bot - t * 0.4, 0],
      [bot, 0],
      [top + t, H],
      [top + t, H + 0.04],
      [top, H + 0.04],
      [bot - t * 0.4, 0.02],
    ].map(([r, y]) => [r, y] as [number, number]),
    4,
    Math.PI / 4,
  )
}

export function Scene3D() {
  const machine = useIso((s) => s.machine)
  const g = useMemo(() => {
    const foundation = xform(box(1.7, DIM.foundationTop, 1.05), mat4.t(0, DIM.foundationTop / 2, 0))
    const pad = xform(cylinder(0.075, 0.02, 32), mat4.t(0, 0.01, 0))
    // isolator: coil spring with a telescopic damper inside it (parts library)
    const springGeo = coilSpring({ coilR: 0.055, wireR: 0.0095, turns: 5.5 })
    const damper = telescopicDamper({ bodyR: 0.026, bodyL: 0.1, rodR: 0.009, base: 0.02 })
    const damperBodySolid = damper.body
    const damperRod = damper.rod
    const frame = xform(roundedBox(1.42, DIM.frameT, 0.86, 0.015), mat4.t(0, DIM.frameT / 2, 0))
    const topPad = xform(cylinder(0.075, 0.018, 32), mat4.t(0, -0.009, 0))
    // compressor + motor
    const motor = merge(xform(cylinder(0.15, 0.42, 40), mat4.c(mat4.t(-0.36, DIM.frameT + 0.17, 0), mat4.rz(Math.PI / 2))), xform(box(0.32, 0.03, 0.26), mat4.t(-0.36, DIM.frameT + 0.015, 0)))
    const crankcase = xform(roundedBox(0.42, 0.34, 0.4, 0.04), mat4.t(0.26, DIM.frameT + 0.17, 0))
    const cyl = lathe(
      (() => {
        const pts: [number, number][] = [[0, 0]]
        for (let i = 0; i < 8; i++) {
          const y0 = 0.01 + i * 0.026
          pts.push([0.095, y0], [0.115, y0 + 0.004], [0.115, y0 + 0.012], [0.095, y0 + 0.016])
        }
        pts.push([0.095, 0.23], [0.11, 0.23], [0.11, 0.27], [0, 0.27])
        return pts
      })(),
      40,
    )
    const cylinder1 = xform(cyl, mat4.t(0.26, DIM.frameT + 0.34, 0))
    const flywheel = merge(
      lathe([[0.03, -0.03], [0.22, -0.03], [0.22, 0.03], [0.03, 0.03]], 64),
      lathe([[0.0, -0.05], [0.04, -0.05], [0.04, 0.05], [0, 0.05]], 24),
    )
    flywheel.rotateX(Math.PI / 2)
    const unbalance = xform(roundedBox(0.09, 0.07, 0.05, 0.01), mat4.t(0, 0.15, 0))
    const bolts = merge(...[-0.025, 0.025].map((x) => xform(hexBolt(0.012, 0.03), mat4.c(mat4.t(x, 0.15, 0.03), mat4.rx(Math.PI / 2)))))
    const belt = xform(box(0.62, 0.02, 0.05), mat4.t(-0.05, DIM.frameT + 0.17, 0.29))
    // hopper
    const shell = hopperShell()
    const grain = lathe(
      [
        [0, 0.02],
        [0.13, 0.02],
        [0.52, 0.5],
        [0.3, 0.56],
        [0, 0.58],
      ],
      4,
      Math.PI / 4,
    )
    const legs = merge(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => xform(box(0.06, 0.62, 0.06), mat4.t(sx * 0.46, DIM.frameT + 0.31, sz * 0.32)))))
    const ringY = DIM.frameT + 0.62
    const ring = merge(
      ...[-1, 1].map((s) => xform(box(0.06, 0.05, 0.8), mat4.t(s * 0.46, ringY, 0))),
      ...[-1, 1].map((s) => xform(box(0.86, 0.05, 0.06), mat4.t(0, ringY, s * 0.37))),
    )
    const vibMotor = merge(xform(cylinder(0.075, 0.2, 32), mat4.rx(Math.PI / 2)), xform(box(0.16, 0.03, 0.16), mat4.t(0, -0.08, 0)))
    const smallEcc = merge(lathe([[0, -0.015], [0.07, -0.015], [0.07, 0.015], [0, 0.015]], 40))
    smallEcc.rotateX(Math.PI / 2)
    const smallMass = xform(roundedBox(0.05, 0.04, 0.03, 0.008), mat4.t(0, 0.05, 0))
    return { foundation, pad, springGeo, damperBodySolid, damperRod, frame, topPad, motor, crankcase, cylinder1, flywheel, unbalance, bolts, belt, shell, grain, legs, ring, vibMotor, smallEcc, smallMass }
  }, [])

  const body = useRef<THREE.Group>(null)
  const springs = useRef<(THREE.Mesh | null)[]>([])
  const rods = useRef<(THREE.Group | null)[]>([])
  const ecc = useRef<THREE.Group>(null)
  const fArrow = useRef<THREE.Group>(null)
  const tArrows = useRef<(THREE.Group | null)[]>([])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const theta = useRef(0)

  const mounts = useMemo(
    () =>
      [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * DIM.mountX, sz * DIM.mountZ] as [number, number])),
    [],
  )
  const eccPos: [number, number, number] = machine === 'compressor' ? [0.26, DIM.frameT + 0.17, 0.25] : [0.6, DIM.frameT + 0.1, 0.25]

  useSimFrame((dt) => {
    const p = useIso.getState()
    const a = analyse(p)
    theta.current += a.w * dt
    const th = theta.current
    // steady state: F = F0 sin θ, x = X sin(θ − φ), F_T = TR·F0 sin(θ − φ_T)
    const x = a.X * Math.sin(th - a.phase)
    const show = Math.max(-DIM.maxShow, Math.min(DIM.maxShow, x * DIM.gain))
    body.current?.position.set(0, FRAME_Y + show, 0)
    const h = DIM.mountH + show
    springs.current.forEach((s) => {
      if (s) {
        s.position.y = DIM.foundationTop + 0.02
        s.scale.y = h - 0.04
      }
    })
    rods.current.forEach((r) => {
      if (r) {
        r.position.y = FRAME_Y + show
        r.scale.y = 0.07 + show
      }
    })
    // eccentric: its vertical component (mass up) is in phase with F
    ecc.current?.rotation.set(0, 0, th - Math.PI / 2)
    const Fv = a.F0 * Math.sin(th)
    const FT = a.FT * Math.sin(th - a.phaseT)
    const L = 0.35
    tmp.set(eccPos[0], FRAME_Y + show + eccPos[1] + (machine === 'compressor' ? 0.28 : 0.15), eccPos[2] + 0.06)
    setArrow(fArrow.current, tmp, up, (L * Fv) / a.F0)
    // force on the foundation from each mount (¼ of F_T, drawn at the same scale ×4 for the total):
    // up when the mounts are stretched (x > 0), down when compressed
    const len = Math.max(-0.8, Math.min(0.8, (L * FT) / a.F0))
    mounts.forEach(([mx, mz], i) => {
      tmp.set(mx, DIM.foundationTop + 0.005 + (len < 0 ? -len : 0), mz + 0.16 * Math.sign(mz))
      setArrow(tArrows.current[i], tmp, up, len)
    })
    live.theta = th
    live.x = x
    live.F = Fv
    live.FT = FT
  })

  return (
    <group>
      <Part id="installation" name="Machine on isolators" role="housing" material="concrete" info={{ summary: 'A machine with a rotating unbalance on four spring–damper isolators.' }} cites={[C.ln('vibration isolation')]}>
        <Part id="foundation" name="Foundation" material="concrete" role="housing" info={INFO.foundation} cites={[C.ln('transmissibility, rigid support')]}>
          <PartMesh geometry={g.foundation} />
        </Part>
        <Part id="mounts" name="Isolators" role="static" material="rubber" info={INFO.mounts} cites={[C.ln('vibration isolation')]}>
          {mounts.map(([mx, mz], i) => (
            <group key={i} position={[mx, DIM.foundationTop, mz]}>
              <PartMesh geometry={g.pad} material="rubber" />
              <PartMesh geometry={g.damperBodySolid} material="paintBlack" />
            </group>
          ))}
          <Part id="iso-springs" name="Isolator springs k" material="steelDark" role="moving" info={INFO.springs} cut={false}>
            {mounts.map(([mx, mz], i) => (
              <PartMesh key={i} ref={(el) => (springs.current[i] = el)} geometry={g.springGeo} position={[mx, 0, mz]} />
            ))}
          </Part>
          <Part id="iso-dampers" name="Isolator dampers c" material="chrome" role="moving" info={INFO.dampers}>
            {mounts.map(([mx, mz], i) => (
              <group key={i} ref={(el) => (rods.current[i] = el)} position={[mx, FRAME_Y, mz]}>
                <PartMesh geometry={g.damperRod} />
              </group>
            ))}
          </Part>
        </Part>
        <Part id="machine" name={machine === 'compressor' ? 'Compressor set (mass M)' : 'Hopper (mass M)'} role="moving" material="paintGrey" info={machine === 'compressor' ? INFO.compressor : INFO.hopper} cites={[machine === 'compressor' ? C.ln('compressor example') : C.q16('hopper with shaker')]}>
          <group ref={body} position={[0, FRAME_Y, 0]}>
            <Part id="frame" name="Base frame" material="paintGrey" info={INFO.frame}>
              <PartMesh geometry={g.frame} />
              {mounts.map(([mx, mz], i) => (
                <PartMesh key={i} geometry={g.topPad} material="rubber" position={[mx, 0, mz]} />
              ))}
            </Part>
            {machine === 'compressor' ? (
              <>
                <Part id="motor" name="Electric motor" material="paintBlue" info={{ summary: 'Drive motor.', role: 'Turns the compressor crank at 1750 rpm in the example.' }}>
                  <PartMesh geometry={g.motor} />
                  <PartMesh geometry={g.belt} material="rubber" />
                </Part>
                <Part id="compressor" name="Compressor" material="castIron" info={INFO.compressor}>
                  <PartMesh geometry={g.crankcase} material="paintGreen" />
                  <PartMesh geometry={g.cylinder1} />
                </Part>
              </>
            ) : (
              <>
                <Part id="stand" name="Hopper stand" material="paintGreen" info={{ summary: 'Hopper stand.', role: 'Carries the hopper on the base frame.' }}>
                  <PartMesh geometry={g.legs} />
                  <PartMesh geometry={g.ring} />
                </Part>
                <Part id="hopper" name="Hopper" material="galvanised" role="housing" info={INFO.hopper} cites={[C.q16(), C.mg18()]}>
                  <group position={[0, DIM.frameT + 0.22, 0]}>
                    <PartMesh geometry={g.shell} />
                    <Part id="grain" name="Grain" material="grain" role="fluid" info={INFO.grain}>
                      <PartMesh geometry={g.grain} />
                    </Part>
                  </group>
                </Part>
                <Part id="shaker-motor" name="Shaker motor" material="paintBlue" info={{ summary: 'Vibrator motor.', role: 'Turns the eccentric that shakes the hopper at 50 Hz (3000 rpm).' }}>
                  <PartMesh geometry={g.vibMotor} position={[0.6, DIM.frameT + 0.1, 0.1]} />
                </Part>
              </>
            )}
            <Part id="eccentric" name="Rotating unbalance" material="steel" info={INFO.eccentric} cites={[C.ln('unbalance m e ω²')]} cut={false}>
              <group ref={ecc} position={eccPos}>
                {machine === 'compressor' ? (
                  <>
                    <PartMesh geometry={g.flywheel} material="castIron" />
                    <PartMesh geometry={g.unbalance} material="paintRed" />
                    <PartMesh geometry={g.bolts} material="steelDark" />
                  </>
                ) : (
                  <>
                    <PartMesh geometry={g.smallEcc} />
                    <PartMesh geometry={g.smallMass} material="paintRed" />
                  </>
                )}
              </group>
            </Part>
          </group>
        </Part>
      </Part>
      <Arrow ref={fArrow} color="#f08a3c" radius={0.012} />
      {mounts.map((_, i) => (
        <Arrow key={i} ref={(el) => {
            tArrows.current[i] = el
          }} color="#6fb3e0" radius={0.01} />
      ))}

      <PartLabel partId="foundation" at={[0.75, 0.2, 0.5]} />
      <PartLabel partId="iso-springs" at={[DIM.mountX + 0.08, FRAME_Y - 0.05, DIM.mountZ + 0.08]} />
      <PartLabel partId="iso-dampers" at={[-DIM.mountX - 0.08, FRAME_Y - 0.08, DIM.mountZ + 0.06]} />
      <PartLabel partId="frame" at={[-0.6, FRAME_Y + 0.08, 0.45]} />
      <PartLabel partId="eccentric" at={[eccPos[0] + 0.1, FRAME_Y + eccPos[1] + 0.25, eccPos[2] + 0.08]} />
      {machine === 'compressor' ? <PartLabel partId="compressor" at={[0.3, FRAME_Y + 0.65, 0]} /> : <PartLabel partId="hopper" at={[0.3, FRAME_Y + 0.95, 0.3]} />}
      {machine === 'compressor' ? <PartLabel partId="motor" at={[-0.4, FRAME_Y + 0.38, 0.1]} /> : <PartLabel partId="shaker-motor" at={[0.7, FRAME_Y + 0.25, 0.15]} />}
    </group>
  )
}
