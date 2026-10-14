import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SRC } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { hexBolt } from '@/geometry/parts'
import { pipe } from '@/geometry'
import { plungerState } from '@/physics/fuel'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { createDynamicCutMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { INJ, buildFuelGeometry } from './geometry'
import {
  DIM,
  ELEMENT,
  ELEMENT_PHASE,
  ELEMENT_X,
  INJ_Y,
  LAYOUT,
  elementPose,
  feedPlungerY,
  PINION_PHASE,
  RACK_X0,
  linePressure,
  live,
  phaseOf,
  useFuel,
} from './model'

const { PI } = Math
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)
const curve = (pts: THREE.Vector3[], tension = 0.2) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', tension)

/** Fuel colours: low-pressure supply, high-pressure delivery, leak-off/overflow return, air. */
export const FUEL_COLORS = { lp: '#e8c94a', hp: '#ff5233', ret: '#9bd36a', air: '#f4f7ff' }

const C = {
  sys: [SRC.supp509('diesel fuel system'), SRC.tb509('§4.5, Fig 4.2')],
  tank: [SRC.tb509('Fig 4.2; §4.4 vented cap'), SRC.supp509('fuel tank')],
  bowl: [SRC.tb509('Fig 4.5 sediment bowl')],
  lift: [SRC.supp509('lift / feed pump, priming'), SRC.tb509('§4.5')],
  filters: [SRC.supp509('primary and secondary filters, overflow valve, bleeding'), SRC.tb509('§4.5, Fig 4.2')],
  pump: [SRC.tb509('§4.5.3, Fig 4.8 injection pump — helical groove on the plunger'), SRC.supp509('injection pump 120–300 kg/cm²')],
  injector: [SRC.tb509('Fig 4.9 injector'), SRC.supp509('injector: needle valve, spring, pressure-adjusting screw, leak-off')],
}

const INFO = {
  system: { summary: 'Diesel fuel system of a four-cylinder tractor engine, laid out flat so one section shows every passage.', details: 'Tank → sediment bowl → lift pump → primary filter → secondary filter → in-line injection pump → high-pressure pipe → injector; leak-off and overflow fuel return to the tank.' },
  tank: { summary: 'Fuel tank with a vented filler cap and a gauze strainer in the filler neck.', role: 'Stores the fuel. The vent lets air in as fuel is used, so no vacuum forms; the return line brings back leak-off and overflow fuel.' },
  bowl: { summary: 'Sediment bowl: glass bowl, gauze strainer and a bail with a clamp nut.', role: 'Fuel slows down in the bowl so water and dirt settle to the bottom, where you can see them through the glass and drain them.' },
  liftPump: { summary: 'Lift (feed) pump on the side of the injection pump, worked by an eccentric on the pump camshaft, with a hand-priming plunger.', role: 'Draws fuel from the tank and pushes it through the filters to the injection pump at low pressure. The priming plunger is worked by hand to fill the system and push air out at the bleed screws.' },
  primary: { summary: 'Primary filter (water and coarse dirt) with a glass water trap.', role: 'Fuel enters outside the element and passes inwards to the centre tube. Water, heavier than diesel, collects in the bowl and is drained off.' },
  secondary: { summary: 'Secondary (final) filter with the overflow valve in its head.', role: 'A fine element removes the smallest particles that would score the pump plungers and injector nozzles. The overflow valve limits feed pressure: surplus fuel from the lift pump returns to the tank, carrying air bubbles with it.' },
  pump: { summary: 'In-line injection pump: one plunger-and-barrel element per cylinder, driven by its own camshaft at half engine speed.', role: 'Meters the fuel and raises it to injection pressure, delivering it to each injector in firing order (1-3-4-2).' },
  camshaft: { summary: 'Pump camshaft: one lobe per element plus the eccentric that works the lift pump.', role: 'Turns at half crankshaft speed. The lobes are phased 90° apart (720°/4 cylinders of crank angle) to give the firing order.' },
  plunger: { summary: 'Plungers with a vertical slot and a helical groove (the "helix") machined on them.', role: 'The cam lifts the plunger. Delivery starts when its top edge covers the barrel ports and ends when the helix uncovers the spill port, so the effective stroke — and the fuel per stroke — depends on how far the plunger is turned.' },
  barrel: { summary: 'Barrels with an inlet and a spill port at the fuel-gallery level.', role: 'Lapped to the plunger with no packing; fuel from the gallery fills the barrel through the ports while the plunger is down.' },
  sleeve: { summary: 'Control sleeves with clamped toothed quadrants (pinions).', role: 'The control rack turns every pinion — and through the slot in the sleeve, every plunger — by the same angle.' },
  rack: { summary: 'Control rack, moved by the accelerator and the governor.', role: 'Sliding the rack turns all the plungers together. Forward = more of the helix land under the spill port = longer effective stroke = more fuel.' },
  springs: { summary: 'Plunger return springs.', role: 'Keep the tappets on the cam and pull the plungers down on the filling stroke.' },
  tappets: { summary: 'Tappets (cam followers).', role: 'Carry the cam lift to the plungers.' },
  dValves: { summary: 'Delivery valves in their holders.', role: 'Lift to let the pressurised fuel into the high-pressure pipe, then snap shut as the helix spills, so the injector closes sharply and a residual pressure stays in the pipe.' },
  hpPipe: { summary: 'High-pressure pipe (thick-walled steel).', role: 'Carries each metered charge to the injector at 120–300 kg/cm². All pipes are the same length so the cylinders get equal timing.' },
  injector: { summary: 'Multi-hole injector: nozzle body, needle valve, spindle, spring, pressure-adjusting screw, leak-off.', role: 'The needle lifts off its conical seat when fuel pressure on its shoulder overcomes the spring, and the fuel sprays into the combustion chamber as a fine mist. Screwing the adjusting screw down raises the opening pressure.' },
  needle: { summary: 'Needle (nozzle) valve.', role: 'Shut by the spring; lifted by fuel pressure. Lift is exaggerated here (real lift ≈ 0.25 mm).' },
  leakOff: { summary: 'Leak-off and overflow return lines.', role: 'A little fuel leaks past the needle to lubricate it; it returns to the tank with the overflow fuel from the secondary filter.' },
  bleed: { summary: 'Bleed screws on the filter heads and the pump gallery.', role: 'To remove air: open each bleed screw in turn, working from the tank towards the pump, and work the priming lever until fuel without bubbles comes out; then close it.' },
  head: { summary: 'Cylinder head and piston (stub) around the injector.', role: 'The injector sprays into the bowl in the piston crown near TDC.' },
}

export function Fuel3D() {
  const g = buildFuelGeometry()
  const flows = useFuel((s) => s.flows)
  const cam = useRef(0)
  const camRef = useRef<THREE.Group>(null)
  const tappets = useRef<(THREE.Group | null)[]>([])
  const plungers = useRef<(THREE.Group | null)[]>([])
  const sleeves = useRef<(THREE.Group | null)[]>([])
  const springs = useRef<(THREE.Mesh | null)[]>([])
  const dvalves = useRef<(THREE.Group | null)[]>([])
  const columns = useRef<(THREE.Mesh | null)[]>([])
  const rackRef = useRef<THREE.Group>(null)
  const feedPl = useRef<THREE.Group>(null)
  const feedSp = useRef<THREE.Mesh>(null)
  const primer = useRef<THREE.Group>(null)
  const needle = useRef<THREE.Group>(null)
  const injSpring = useRef<THREE.Mesh>(null)
  const screw = useRef<THREE.Group>(null)
  const ball = useRef<THREE.Group>(null)
  const needleLift = useRef(0)
  const deliveries = useRef([0, 0, 0, 0])

  const chamberMats = useMemo(() => ELEMENT_X.map(() => createDynamicCutMaterial({ color: FUEL_COLORS.lp, hatch: 'fluid', roughness: 0.2 })), [])
  const column = useMemo(() => {
    const r = ELEMENT.plungerD / 2 - 0.00005
    const geo = new THREE.CylinderGeometry(r, r, 1, 24)
    geo.translate(0, 0.5, 0)
    return geo
  }, [])
  const bolt = useMemo(() => hexBolt(0.006, 0.01), [])

  /* ---------------- pipes and flow paths (world) ---------------- */
  const P = useMemo(() => {
    const pr = LAYOUT.primary
    const se = LAYOUT.secondary
    const inj = LAYOUT.injector
    const tankToBowl = curve([V(-0.54, 0.395), V(-0.54, 0.37), V(-0.5, 0.35), V(-0.44, 0.348), V(-0.416, 0.348)])
    const bowlInside = curve([V(-0.416, 0.348), V(-0.392, 0.344), V(-0.392, 0.325), V(-0.388, 0.29), V(-0.372, 0.29), V(-0.368, 0.325), V(-0.368, 0.344), V(-0.344, 0.348)])
    const bowlToFeed = curve([V(-0.344, 0.348), V(-0.3, 0.348), V(-0.24, 0.33), V(-0.2, 0.25), V(-0.18, 0.02), V(-0.14, -0.03), V(0.1, -0.03), V(0.128, 0.02), V(0.132, 0.095), V(0.151, 0.1)])
    const feedToPrimary = curve([V(0.179, 0.1), V(0.215, 0.1), V(0.235, 0.15), V(0.24, 0.24), V(0.255, 0.266), V(pr.x - 0.052, pr.y + 0.016)])
    const through = (x: number) =>
      curve([V(x - 0.052, 0.266), V(x - 0.028, 0.266), V(x - 0.024, 0.25), V(x - 0.036, 0.225), V(x - 0.036, 0.14), V(x - 0.02, 0.118), V(x, 0.118), V(x, 0.2), V(x, 0.258), V(x + 0.012, 0.266), V(x + 0.052, 0.266)])
    const primaryIn = through(pr.x)
    const prToSe = curve([V(pr.x + 0.052, 0.266), V(se.x - 0.052, 0.266)], 0)
    const secondaryIn = through(se.x)
    const seToPump = curve([V(se.x + 0.052, 0.266), V(0.54, 0.255), V(0.555, 0.2, -0.03), V(0.5, 0.14, -0.05), V(0.25, 0.135, -0.05), V(0.14, 0.13, -0.03), V(0.11, 0.1201, -0.004), V(0.1, 0.1201, 0)])
    const gallery = curve([V(0.1, 0.1201), V(-0.09, 0.1201)], 0)
    const hp = curve([V(ELEMENT_X[0], 0.186), V(ELEMENT_X[0], 0.25), V(0.1, 0.34), V(0.2, 0.37), V(0.55, 0.37), V(0.61, 0.34), V(0.635, 0.3), V(inj.x - 0.025, INJ_Y + INJ.inletY)])
    const hpStubs = ELEMENT_X.slice(1).map((x) => curve([V(x, 0.186), V(x, 0.24), V(x + 0.005, 0.28, -0.05), V(x + 0.02, 0.3, -0.14)]))
    const leak = curve([V(inj.x + 0.018, INJ_Y + INJ.leakY), V(inj.x + 0.045, INJ_Y + INJ.leakY + 0.01), V(inj.x + 0.06, 0.45), V(inj.x, 0.6), V(0.3, 0.7), V(-0.3, 0.74), V(-0.6, 0.73), V(-0.66, 0.7), V(-0.66, 0.652)])
    const overflow = curve([V(se.x + 0.036, se.y + 0.046), V(se.x + 0.06, se.y + 0.05), V(se.x + 0.1, 0.38), V(0.6, 0.52), V(0.7, 0.58), V(0.72, 0.6)])
    // flow paths inside the pump element 1 and the injector
    const injLocal = (x: number, y: number) => V(inj.x + x, INJ_Y + y)
    const injIn = curve([injLocal(-0.025, INJ.inletY), injLocal(-0.0075, INJ.inletY + 0.001), injLocal(-0.0024, 0.0095), injLocal(-0.0012, 0.004), injLocal(0, 0.0015)], 0)
    const injLeak = curve([injLocal(0.0035, 0.036), injLocal(0.0045, 0.08), injLocal(0.004, 0.118), injLocal(0.012, INJ.leakY)], 0)
    const sprays = [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * PI * 2 + PI / 4
      const s = Math.sin((72 * PI) / 180)
      const d = V(Math.cos(a) * s, -Math.cos((72 * PI) / 180), Math.sin(a) * s)
      const tip = injLocal(0, 0.0012)
      return new THREE.LineCurve3(tip, tip.clone().addScaledVector(d, 0.032))
    })
    const barrelFill = curve([V(ELEMENT_X[0] + 0.004, 0.1201), V(ELEMENT_X[0] + 0.0012, 0.123), V(ELEMENT_X[0], 0.135)], 0)
    const spill = curve([V(ELEMENT_X[0], 0.128), V(ELEMENT_X[0] + 0.0035, 0.1201), V(ELEMENT_X[0] + 0.013, 0.1201)], 0)
    const bleedPts = [V(pr.x - 0.02, 0.29), V(se.x - 0.02, 0.29), V(-0.105, 0.1201)]
    const bleeds = bleedPts.map((p) => curve([p, p.clone().add(V(0.004, 0.03)), p.clone().add(V(-0.004, 0.07))]))
    return { tankToBowl, bowlInside, bowlToFeed, feedToPrimary, primaryIn, prToSe, secondaryIn, seToPump, gallery, hp, hpStubs, leak, overflow, injIn, injLeak, sprays, barrelFill, spill, bleeds, bleedPts }
  }, [])

  const pipes = useMemo(
    () => ({
      lp: [P.tankToBowl, P.bowlToFeed, P.feedToPrimary, P.prToSe, P.seToPump].map((c) => pipe(c, 0.0045, 0.003, 64, 12)),
      hp: [pipe(P.hp, 0.0035, 0.001, 96, 12), ...P.hpStubs.map((c) => pipe(c, 0.0035, 0.001, 32, 12))],
      ret: [pipe(P.leak, 0.0035, 0.0022, 96, 12), pipe(P.overflow, 0.0035, 0.0022, 48, 12)],
    }),
    [P],
  )

  /* ---------------- animation ---------------- */
  useSimFrame((dt) => {
    const st = useFuel.getState()
    const w = ((st.rpm / 2) * 2 * PI) / 60 // pump camshaft = half engine speed
    cam.current = (cam.current + w * dt) % (2 * PI)
    const a = cam.current
    camRef.current?.rotation.set(-a, 0, 0)
    const rot = -Math.min(ELEMENT.maxRotation, st.rack / ELEMENT.sleeveR)
    rackRef.current?.position.set(RACK_X0 + st.rack, DIM.sleeveY, DIM.rackPitchZ)

    for (let i = 0; i < 4; i++) {
      const s = elementPose(a, st.rack, i)
      const x = s.x
      tappets.current[i]?.position.set(x, s.tappetY, 0)
      const pl = plungers.current[i]
      if (pl) {
        pl.position.set(x, s.plungerY, 0)
        pl.rotation.set(0, rot, 0)
      }
      sleeves.current[i]?.rotation.set(0, rot, 0)
      const sp = springs.current[i]
      if (sp) {
        sp.position.set(x, s.springY0, 0)
        sp.scale.set(1, s.springLen, 1)
      }
      const delivering = s.delivering && !st.air
      deliveries.current[i] = delivering ? 1 : Math.max(0, deliveries.current[i] - dt / 0.004)
      dvalves.current[i]?.position.set(x, delivering ? 0.0012 : 0, 0)
      const col = columns.current[i]
      if (col) {
        const top = s.plungerTop
        col.position.set(x, top, 0)
        col.scale.set(1, Math.max(1e-4, 0.142 - top), 1)
      }
      const m = chamberMats[i]
      const hex = s.delivering ? (st.air ? FUEL_COLORS.air : FUEL_COLORS.hp) : FUEL_COLORS.lp
      m.material.color.set(hex)
      m.capColor.set(hex)
    }

    // element 1 drives the live readouts and the injector shown
    const a0 = a - ELEMENT_PHASE[0]
    const s0 = plungerState(a0, st.rack, ELEMENT)
    const phase = phaseOf(a0, st.rack)
    const pulse = deliveries.current[0]
    const open = phase === 'delivering' && !st.air
    needleLift.current += ((open ? DIM.needleLiftVis : 0) - needleLift.current) * Math.min(1, dt / 0.0008)
    needle.current?.position.set(0, needleLift.current, 0)
    const screwY = 0.1 - ((st.pOpen - 140) * 0.004) / 160
    screw.current?.position.set(0, screwY, 0)
    if (injSpring.current) {
      const y0 = INJ.springBottom + needleLift.current
      injSpring.current.position.y = y0
      injSpring.current.scale.y = screwY - y0
    }

    // lift pump: eccentric on the camshaft (e = 3 mm) under a spring-returned plunger
    const fy = feedPlungerY(a)
    feedPl.current?.position.set(LAYOUT.feed.x, fy, 0)
    if (feedSp.current) {
      feedSp.current.position.set(LAYOUT.feed.x, fy + 0.03, 0)
      feedSp.current.scale.set(1, 0.113 - (fy + 0.03), 1)
    }
    ball.current?.position.set(LAYOUT.secondary.x + 0.024, LAYOUT.secondary.y + 0.02775 + (st.rpm > 0 && !st.air ? 0.0012 : 0), 0)

    live.cam = (((a0 % (2 * PI)) + 2 * PI) % (2 * PI))
    live.lift = s0.lift
    live.phase = phase
    live.pulse = pulse
    live.needleOpen = open
    live.pLine = st.air ? 0 : linePressure(phase, st.pOpen, pulse)
  })

  // priming and bleeding run in real time (seconds of hand pumping, not engine time)
  useFrame((_, realDt) => {
    const st = useFuel.getState()
    if (st.bleeding) {
      live.bleed = Math.min(1, live.bleed + realDt / 4)
      primer.current?.position.set(LAYOUT.feed.x, 0.118 + 0.006 * (1 - Math.cos(live.bleed * 2 * PI * 6)), 0)
      if (live.bleed >= 1) {
        live.bleed = 0
        useFuel.getState().set({ bleeding: false, air: false })
      }
    } else primer.current?.position.set(LAYOUT.feed.x, 0.118, 0)
  })

  const running = () => {
    const s = useFuel.getState()
    return s.rpm > 0 && !s.bleeding ? 1 : s.bleeding ? 0.7 : 0
  }
  const lpOn = () => (useFuel.getState().air && !useFuel.getState().bleeding ? 0.25 : running())
  const pr = LAYOUT.primary
  const se = LAYOUT.secondary
  const inj = LAYOUT.injector

  return (
    <group>
      <Part id="fuel-system" name="Diesel fuel system" role="housing" material="castIron" info={INFO.system} cites={C.sys}>
        {/* ---------------- tank ---------------- */}
        <Part id="tank" name="Fuel tank" material="paintGreen" role="housing" info={INFO.tank} cites={C.tank} explode={[-0.1, 0.12, 0]}>
          <PartMesh geometry={g.tankShell} />
          <Part id="tank-fuel" name="Diesel fuel" material="fuel" role="fluid" info={{ summary: 'Diesel fuel in the tank.' }}>
            <PartMesh geometry={g.tankFuel} />
          </Part>
          <Part id="vented-cap" name="Vented filler cap" material="paintBlack" role="static" info={{ summary: 'Filler cap with a vent hole.', role: 'Lets air replace the fuel used so the lift pump does not have to work against a vacuum.' }} cites={C.tank} explode={[0, 0.08, 0]}>
            <PartMesh geometry={g.ventedCap} position={[LAYOUT.tank.x0 + 0.09, LAYOUT.tank.y1 + 0.027, 0]} />
          </Part>
          <Part id="tank-strainer" name="Filler strainer" material="brass" role="static" info={{ summary: 'Gauze strainer in the filler neck.', role: 'Stops coarse dirt entering with the fuel when the tank is filled.' }}>
            <PartMesh geometry={g.tankStrainer} position={[LAYOUT.tank.x0 + 0.09, LAYOUT.tank.y1 + 0.027, 0]} />
          </Part>
        </Part>

        {/* ---------------- sediment bowl ---------------- */}
        <Part id="sediment-bowl" name="Sediment bowl" material="castIron" role="housing" info={INFO.bowl} cites={C.bowl} explode={[-0.05, 0.05, 0]}>
          <PartMesh geometry={g.bowlHead} />
          <Part id="bowl-glass" name="Glass bowl" material="glass" role="static" explode={[0, -0.06, 0]}>
            <PartMesh geometry={g.glassBowl} />
            <Part id="bowl-fuel" name="Fuel in the bowl" material="fuel" role="fluid">
              <PartMesh geometry={g.bowlFuel} />
            </Part>
            <Part id="sediment" name="Water and sediment" material="soil" role="fluid" info={{ summary: 'Water and dirt that have settled out of the fuel.' }}>
              <PartMesh geometry={g.sediment} />
            </Part>
          </Part>
          <Part id="bowl-strainer" name="Bowl strainer gauze" material="brass" role="static">
            <PartMesh geometry={g.bowlStrainer} />
          </Part>
          <Part id="bowl-gasket" name="Bowl gasket" material="rubber" role="static">
            <PartMesh geometry={g.bowlGasket} />
          </Part>
          <Part id="bail" name="Bail and clamp nut" material="steel" role="static" cut={false} explode={[0, -0.1, 0]}>
            <PartMesh geometry={g.bail} />
            <PartMesh geometry={g.jamNut} material="brass" />
          </Part>
        </Part>

        {/* ---------------- injection pump ---------------- */}
        <Part id="injection-pump" name="In-line injection pump" material="aluminium" role="housing" info={INFO.pump} cites={C.pump}>
          <Part id="pump-housing" name="Pump housing" material="aluminium" role="housing" info={INFO.pump} cites={C.pump} explode={[0, 0, -0.12]}>
            <PartMesh geometry={g.housing} />
          </Part>
          <Part id="gallery-fuel" name="Fuel gallery" material="fuel" role="fluid" info={{ summary: 'Low-pressure fuel gallery along the pump.', role: 'Keeps every barrel surrounded by fuel at feed pressure.' }}>
            <PartMesh geometry={g.gallery} />
          </Part>
          <Part id="pump-camshaft" name="Pump camshaft & lift-pump eccentric" material="forged" role="moving" info={INFO.camshaft} cites={C.pump} explode={[0, -0.08, 0]}>
            <group ref={camRef} position={[0, LAYOUT.camY, 0]}>
              <PartMesh geometry={g.camshaft} />
              <PartMesh geometry={g.camLobes} material="steel" />
              <PartMesh geometry={g.eccentric} material="steel" />
              <PartMesh geometry={g.flange} material="castIron" />
            </group>
          </Part>
          <Part id="tappets" name="Tappets" material="steel" role="moving" info={INFO.tappets} cites={C.pump} explode={[0, -0.03, 0.06]}>
            {ELEMENT_X.map((_, i) => (
              <group key={i} ref={(o) => void (tappets.current[i] = o)}>
                <PartMesh geometry={g.tappet} />
              </group>
            ))}
          </Part>
          <Part id="element-springs" name="Plunger springs" material="steelDark" role="moving" cut={false} info={INFO.springs} cites={C.pump} explode={[0, 0, 0.09]}>
            {ELEMENT_X.map((_, i) => (
              <PartMesh key={i} ref={(o) => void (springs.current[i] = o)} geometry={g.spring} />
            ))}
          </Part>
          <Part id="plungers" name="Plungers (helix)" material="chrome" role="moving" info={INFO.plunger} cites={C.pump} explode={[0, 0.02, 0.15]}>
            {ELEMENT_X.map((_, i) => (
              <group key={i} ref={(o) => void (plungers.current[i] = o)}>
                <PartMesh geometry={g.plunger} />
              </group>
            ))}
          </Part>
          <Part id="control-sleeves" name="Control sleeves & pinions" material="steelDark" role="moving" info={INFO.sleeve} cites={C.pump} explode={[0, 0, 0.11]}>
            {ELEMENT_X.map((x, i) => (
              <group key={i} position={[x, 0, 0]}>
                <group ref={(o) => void (sleeves.current[i] = o)}>
                  <PartMesh geometry={g.sleeve} />
                  <PartMesh geometry={g.pinion} material="brass" rotation={[0, PINION_PHASE[i], 0]} />
                </group>
              </group>
            ))}
          </Part>
          <Part id="control-rack" name="Control rack" material="steel" role="moving" info={INFO.rack} cites={C.pump} explode={[0, 0, -0.06]}>
            <group ref={rackRef}>
              <PartMesh geometry={g.rack} />
            </group>
          </Part>
          <Part id="barrels" name="Barrels" material="steelDark" role="static" info={INFO.barrel} cites={C.pump} explode={[0, 0.04, 0.13]}>
            {ELEMENT_X.map((x) => (
              <PartMesh key={x} geometry={g.barrel} position={[x, 0, 0]} />
            ))}
          </Part>
          <Part id="pump-chambers" name="Fuel above the plungers" role="fluid" info={{ summary: 'Fuel trapped between plunger and delivery valve.', role: 'Turns red while the plunger is delivering (high pressure) and yellow while the ports are open.' }} cites={C.pump}>
            {ELEMENT_X.map((x, i) => (
              <PartMesh key={x} ref={(o) => void (columns.current[i] = o)} geometry={column} customMaterial={chamberMats[i].material} castShadow={false} />
            ))}
          </Part>
          <Part id="delivery-valves" name="Delivery valves & holders" material="steel" role="moving" info={INFO.dValves} cites={C.pump} explode={[0, 0.07, 0.05]}>
            {ELEMENT_X.map((x, i) => (
              <group key={x}>
                <group ref={(o) => void (dvalves.current[i] = o)}>
                  <PartMesh geometry={g.dValve} />
                </group>
                <Part id={`holder-${i + 1}`} name={`Delivery-valve holder ${i + 1}`} material="steelDark" role="static">
                  <PartMesh geometry={g.holder} position={[x, 0, 0]} />
                </Part>
              </group>
            ))}
          </Part>
        </Part>

        {/* ---------------- lift pump ---------------- */}
        <Part id="lift-pump" name="Lift (feed) pump & primer" material="castIron" role="housing" info={INFO.liftPump} cites={C.lift} explode={[0.06, 0, 0.08]}>
          <PartMesh geometry={g.feedBody} />
          <Part id="feed-plunger" name="Lift-pump plunger" material="steel" role="moving" info={{ summary: 'Lift-pump plunger.', role: 'Pushed up by the eccentric, returned by its spring; each stroke moves a little fuel on towards the filters.' }} cites={C.lift}>
            <group ref={feedPl}>
              <PartMesh geometry={g.feedPlunger} />
            </group>
            <PartMesh ref={feedSp} geometry={g.feedSpring} material="steelDark" />
          </Part>
          <Part id="primer" name="Hand priming plunger" material="paintRed" role="moving" info={{ summary: 'Hand primer.', role: 'Worked by hand to fill the filters and pump and to drive air out at the bleed screws before starting.' }} cites={C.lift}>
            <group ref={primer} position={[LAYOUT.feed.x, 0.118, 0]}>
              <PartMesh geometry={g.primer} />
            </group>
          </Part>
        </Part>

        {/* ---------------- filters ---------------- */}
        <Part id="primary-filter" name="Primary filter & water trap" material="aluminium" role="housing" info={INFO.primary} cites={C.filters} explode={[0, 0.06, 0.06]}>
          <PartMesh geometry={g.headPrimary} position={[pr.x, pr.y, 0]} />
          <PartMesh geometry={g.filterBowl} material="glass" position={[pr.x, pr.y, 0]} />
          <Part id="primary-element" name="Primary element" material="nylon" role="static" info={{ summary: 'Coarse filter element.', role: 'Fuel passes from outside to the centre tube; coarse dirt stays on the outside.' }}>
            <PartMesh geometry={g.element} position={[pr.x, pr.y, 0]} />
            <PartMesh geometry={g.elementCaps} material="steel" position={[pr.x, pr.y, 0]} />
            <PartMesh geometry={g.elementCore} material="galvanised" position={[pr.x, pr.y, 0]} />
          </Part>
          <Part id="primary-fuel" name="Fuel and trapped water" material="fuel" role="fluid">
            <PartMesh geometry={g.fuelPrimary} position={[pr.x, pr.y, 0]} />
            <PartMesh geometry={g.waterPrimary} material="water" position={[pr.x, pr.y, 0]} />
          </Part>
        </Part>
        <Part id="secondary-filter" name="Secondary filter & overflow valve" material="aluminium" role="housing" info={INFO.secondary} cites={C.filters} explode={[0, 0.06, 0.1]}>
          <PartMesh geometry={g.headSecondary} position={[se.x, se.y, 0]} />
          <PartMesh geometry={g.filterBowl} material="paintGrey" position={[se.x, se.y, 0]} />
          <Part id="secondary-element" name="Secondary (fine) element" material="nylon" role="static" info={{ summary: 'Fine paper element.', role: 'Removes the fine particles that would wear the pump elements and nozzles.' }}>
            <PartMesh geometry={g.element} position={[se.x, se.y, 0]} />
            <PartMesh geometry={g.elementCaps} material="steel" position={[se.x, se.y, 0]} />
            <PartMesh geometry={g.elementCore} material="galvanised" position={[se.x, se.y, 0]} />
          </Part>
          <Part id="secondary-fuel" name="Fuel in the secondary filter" material="fuel" role="fluid">
            <PartMesh geometry={g.fuelSecondary} position={[se.x, se.y, 0]} />
          </Part>
          <Part id="overflow-valve" name="Overflow valve" material="steel" role="moving" cut={false} info={{ summary: 'Spring-loaded ball overflow valve.', role: 'Opens when the feed pressure exceeds its setting and returns surplus fuel — and any air — to the tank.' }} cites={C.filters}>
            <group ref={ball}>
              <PartMesh geometry={g.overflowBall} />
              <PartMesh geometry={g.overflowSpring} material="steelDark" position={[0, 0.0034, 0]} scale={[1, 0.02, 1]} />
            </group>
          </Part>
        </Part>
        <Part id="bleed-screws" name="Bleed screws" material="brass" role="static" cut={false} info={INFO.bleed} cites={C.filters}>
          <PartMesh geometry={bolt} position={[pr.x - 0.02, pr.y + 0.031, 0]} />
          <PartMesh geometry={bolt} position={[se.x - 0.02, se.y + 0.031, 0]} />
          <PartMesh geometry={bolt} position={[P.bleedPts[2].x - 0.006, P.bleedPts[2].y, 0]} rotation={[0, 0, PI / 2]} />
        </Part>

        {/* ---------------- pipes ---------------- */}
        <Part id="lp-pipes" name="Low-pressure feed pipes" material="copper" role="static" info={{ summary: 'Low-pressure fuel pipes.', role: 'Carry fuel from the tank through the lift pump and filters to the injection-pump gallery.' }} cites={C.sys}>
          {pipes.lp.map((p, i) => (
            <PartMesh key={i} geometry={p} />
          ))}
        </Part>
        <Part id="hp-pipe" name="High-pressure pipes" material="steel" role="static" info={INFO.hpPipe} cites={C.pump}>
          {pipes.hp.map((p, i) => (
            <PartMesh key={i} geometry={p} />
          ))}
        </Part>
        <Part id="return-lines" name="Leak-off & overflow return" material="copper" role="static" info={INFO.leakOff} cites={C.injector}>
          {pipes.ret.map((p, i) => (
            <PartMesh key={i} geometry={p} />
          ))}
        </Part>

        {/* ---------------- injector & head ---------------- */}
        <Part id="injector" name="Injector" material="steel" role="static" info={INFO.injector} cites={C.injector} explode={[0, 0.16, 0]}>
          <group position={[inj.x, INJ_Y, 0]}>
            <PartMesh geometry={g.injBody} />
            <Part id="needle" name="Needle valve & spindle" material="chrome" role="moving" info={INFO.needle} cites={C.injector}>
              <group ref={needle}>
                <PartMesh geometry={g.needle} />
                <PartMesh geometry={g.spindle} material="steel" />
              </group>
            </Part>
            <Part id="injector-spring" name="Injector spring" material="steelDark" role="moving" cut={false} info={{ summary: 'Injector spring.', role: 'Holds the needle on its seat; its compression sets the opening pressure (120–300 kg/cm²).' }} cites={C.injector}>
              <PartMesh ref={injSpring} geometry={g.injSpring} />
            </Part>
            <Part id="adjusting-screw" name="Pressure-adjusting screw & lock nut" material="brass" role="static" info={{ summary: 'Pressure-adjusting screw.', role: 'Screwed down, it compresses the spring and raises the opening pressure; the lock nut holds the setting. Follow the screw with the opening-pressure slider.' }} cites={C.injector}>
              <group ref={screw}>
                <PartMesh geometry={g.screw} />
              </group>
            </Part>
          </group>
        </Part>
        <Part id="engine-head" name="Cylinder head & piston (stub)" material="castIron" role="housing" info={INFO.head} cites={C.injector} explode={[0, -0.06, 0]}>
          <PartMesh geometry={g.headStub} />
          <PartMesh geometry={g.liner} material="steelDark" />
          <Part id="piston-stub" name="Piston near TDC" material="aluminium" role="moving">
            <PartMesh geometry={g.piston} />
            <PartMesh geometry={g.pistonRings} material="steelDark" />
            <PartMesh geometry={g.pistonPin} material="steel" />
          </Part>
        </Part>

        {/* ---------------- flows ---------------- */}
        {flows ? (
          <>
            {[P.tankToBowl, P.bowlInside, P.bowlToFeed].map((c, i) => (
              <Flow key={`a${i}`} curve={c} count={36} radius={0.0022} color={FUEL_COLORS.lp} speed={0.25} spread={0.002} intensity={lpOn} />
            ))}
            {[P.feedToPrimary, P.primaryIn, P.prToSe, P.secondaryIn, P.seToPump, P.gallery].map((c, i) => (
              <Flow key={`b${i}`} curve={c} count={34} radius={0.0022} color={FUEL_COLORS.lp} speed={0.3} spread={0.002} intensity={lpOn} />
            ))}
            <Flow curve={P.barrelFill} count={8} radius={0.0011} color={FUEL_COLORS.lp} speed={3} spread={0.0005} intensity={() => (live.phase === 'filling' ? 1 : 0)} />
            <Flow curve={P.spill} count={10} radius={0.0012} color={FUEL_COLORS.lp} speed={4} spread={0.0005} intensity={() => (live.phase === 'spill' ? 1 : 0)} />
            <Flow curve={P.hp} count={60} radius={0.0022} color={FUEL_COLORS.hp} speed={2.2} spread={0.0008} intensity={() => (useFuel.getState().air ? 0 : live.pulse)} />
            <Flow curve={P.injIn} count={12} radius={0.0011} color={FUEL_COLORS.hp} speed={4} spread={0.0003} intensity={() => (live.needleOpen ? 1 : 0)} />
            {P.sprays.map((c, i) => (
              <Flow key={`s${i}`} curve={c} count={14} radius={0.0011} color="#ffe08a" speed={8} spread={0.002} intensity={() => (live.needleOpen ? 1 : 0)} />
            ))}
            <Flow curve={P.injLeak} count={8} radius={0.0009} color={FUEL_COLORS.ret} speed={0.4} spread={0.0004} intensity={running} />
            <Flow curve={P.leak} count={50} radius={0.0018} color={FUEL_COLORS.ret} speed={0.12} spread={0.0012} intensity={running} />
            <Flow curve={P.overflow} count={24} radius={0.0018} color={FUEL_COLORS.ret} speed={0.2} spread={0.0012} intensity={running} />
            {P.bleeds.map((c, i) => (
              <Flow key={`bl${i}`} curve={c} count={10} radius={0.0024} color={FUEL_COLORS.air} speed={0.8} spread={0.004} intensity={() => (useFuel.getState().bleeding ? 1 : 0)} />
            ))}
          </>
        ) : null}
      </Part>

      <PartLabel partId="tank" at={[-0.68, 0.7, 0.13]} />
      <PartLabel partId="sediment-bowl" at={[-0.38, 0.39, 0.03]} />
      <PartLabel partId="lift-pump" at={[0.2, 0.15, 0.03]} />
      <PartLabel partId="injection-pump" at={[-0.06, 0.2, 0.04]} />
      <PartLabel partId="control-rack" at={[-0.16, 0.11, 0.0]} />
      <PartLabel partId="plungers" at={[ELEMENT_X[0] + 0.012, 0.135, 0.01]} />
      <PartLabel partId="primary-filter" at={[pr.x, pr.y + 0.06, 0.04]} />
      <PartLabel partId="secondary-filter" at={[se.x + 0.02, se.y + 0.08, 0.04]} />
      <PartLabel partId="hp-pipe" at={[0.33, 0.39, 0]} />
      <PartLabel partId="injector" at={[inj.x + 0.03, INJ_Y + 0.15, 0.02]} />
      <PartLabel partId="return-lines" at={[0.1, 0.72, 0]} />
    </group>
  )
}
