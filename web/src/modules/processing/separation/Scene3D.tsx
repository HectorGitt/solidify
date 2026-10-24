import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, pipe, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { P504 } from './cites'
import { boxShell, centrifugalFan, cyclone, dustBin, eccentricCrank, electricMotor, feedRoller, hopper, leafSpring, legStand, pitmanRod, rotaryValve, screenBox, screenDeck, shakerBase, shakerLid, testSieve } from '@/parts/lib/processing'
import { live, rad, useSeparation } from './model'

const { PI, cos, sin } = Math

/* =========================================================================
 * 1. SIEVE SHAKER WITH SCREEN STACK
 * ========================================================================= */

const IS_LABELS = ['IS 100 (1.0 mm)', 'IS 70 (0.71 mm)', 'IS 50 (0.50 mm)', 'IS 40 (0.42 mm)', 'IS 30 (0.30 mm)', 'IS 20 (0.21 mm)', 'IS 15 (0.16 mm)', 'Bottom Pan']

function SieveShakerAssembly({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const p = useSeparation()
  const tableRef = useRef<THREE.Group>(null)

  const R = 0.12
  const H_PAN = 0.04
  const N_SIEVES = 8

  const geo = useMemo(() => {
    return {
      base: shakerBase({ rBase: 0.18, rTop: 0.14, h: 0.22 }),
      shakerPlate: cylinder(0.14, 0.015, 36),
      panRim: testSieve({ r: R, h: H_PAN, lip: 0.003 }).rim,
      panBottom: testSieve({ r: R, h: H_PAN }).pan,
      meshDisc: testSieve({ r: R, h: H_PAN }).mesh,
      lid: shakerLid({ r: R, h: 0.03 }),
      tieRod: cylinder(0.006, 0.48, 16),
      clampKnob: cylinder(0.02, 0.018, 12),
      crossBar: box(0.3, 0.015, 0.03),
      grainLayer: cylinder(R - 0.006, 0.01, 32),
    }
  }, [R, H_PAN])

  useSimFrame((_dt, t) => {
    const k = p.shakerRpm > 0 ? 1 : 0
    const w = (p.shakerRpm * 2 * PI) / 60
    const ox = 0.005 * cos(w * t) * k
    const oz = 0.005 * sin(w * t) * k
    live.shakerOrbX = ox
    live.shakerOrbZ = oz

    if (tableRef.current) {
      tableRef.current.position.set(ox, 0.235, oz)
    }
  })

  return (
    <Part
      id="sieve-shaker"
      name="Sieve shaker & screen stack"
      role="housing"
      material="castIron"
      position={offset}
      info={{
        summary: 'Standard laboratory sieve shaker with 8-tier IS sieve stack and gyratory motion.',
        role: 'Agitates granular agricultural sample across calibrated screen apertures to determine Fineness Modulus and particle size distribution.',
        details: 'Gyratory orbital motion (~280 rpm) stratifies particles until each reaches its limiting screen aperture. Retention follows Tyler / Indian Standard sieve series.',
      }}
      cites={[P504.red('sieve shaker method'), P504.red('IS sieves series')]}
    >
      {/* Heavy cast iron machine base */}
      <Part id="shaker-base" name="Motorized shaker base" role="static" material="castIron">
        <PartMesh geometry={geo.base} position={[0, 0, 0]} material="castIron" />
      </Part>

      {/* Vibrating table & sieve stack */}
      <group ref={tableRef} position={[0, 0.235, 0]}>
        <Part id="shaker-table" name="Gyratory table plate" role="moving" material="steelMatte">
          <PartMesh geometry={geo.shakerPlate} position={[0, 0, 0]} material="steelMatte" />
        </Part>

        {/* 8 Sieve pans stacked vertically */}
        {Array.from({ length: N_SIEVES }).map((_, i) => {
          // Bottom pan is index 7, top IS 100 is index 0
          const tierIndex = N_SIEVES - 1 - i
          const y = 0.015 + i * H_PAN
          const isPan = tierIndex === 7
          const label = IS_LABELS[tierIndex]

          return (
            <Part
              key={tierIndex}
              id={`sieve-tier-${tierIndex}`}
              name={`Sieve ${label}`}
              role="moving"
              material={isPan ? 'galvanised' : 'brass'}
              explode={[0, (i + 1) * 0.045, 0]}
              info={{
                summary: `${label} retention pan.`,
                role: isPan ? 'Blind pan collecting undersize dust passing IS 15.' : `Precision aperture screen (${label}).`,
                details: `Sample fraction retained contributes to Fineness Modulus calculation with weight multiplier ${7 - tierIndex}.`,
              }}
              cites={[P504.red('IS sieve series'), P504.pq('p1 Q3c')]}
            >
              {/* Cylindrical rim */}
              <PartMesh geometry={geo.panRim} position={[0, y, 0]} material={isPan ? 'galvanised' : 'brass'} />
              {/* Floor: solid disc for pan, mesh disc for sieves */}
              {isPan ? (
                <PartMesh geometry={geo.panBottom} position={[0, y, 0]} material="galvanised" />
              ) : (
                <PartMesh geometry={geo.meshDisc} position={[0, y + 0.0015, 0]} material="steel" />
              )}
              {/* Retained particle pile */}
              <PartMesh
                geometry={geo.grainLayer}
                position={[0, y + 0.008, 0]}
                material="grain"
                scale={[1, Math.max(0.2, (p.retainedMasses[tierIndex] || 5) / 40), 1]}
              />
            </Part>
          )
        })}

        {/* Top cover lid & clamp crossbar */}
        <Part
          id="shaker-lid"
          name="Stack clamping lid"
          role="moving"
          material="castIron"
          explode={[0, 0.42, 0]}
          position={[0, 0.015 + N_SIEVES * H_PAN, 0]}
        >
          <PartMesh geometry={geo.lid} position={[0, 0, 0]} material="castIron" />
          <PartMesh geometry={geo.crossBar} position={[0, 0.025, 0]} material="steelMatte" />
        </Part>
      </group>

      {/* Vertical clamping guide tie-rods on left & right */}
      <Part id="shaker-rods" name="Clamping tie-rods" role="static" material="steel">
        <PartMesh geometry={geo.tieRod} position={[-R - 0.025, 0.35, 0]} material="steel" />
        <PartMesh geometry={geo.tieRod} position={[R + 0.025, 0.35, 0]} material="steel" />
        <PartMesh geometry={geo.clampKnob} position={[-R - 0.025, 0.58, 0]} material="plastic" />
        <PartMesh geometry={geo.clampKnob} position={[R + 0.025, 0.58, 0]} material="plastic" />
      </Part>
    </Part>
  )
}

/* =========================================================================
 * 2. OSCILLATING SCREEN CLEANER (RECIPROCATING 2-DECK SEPARATOR)
 * ========================================================================= */

function ScreenCleanerAssembly({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const p = useSeparation()
  const boxRef = useRef<THREE.Group>(null)
  const crankRef = useRef<THREE.Group>(null)
  const spring1Ref = useRef<THREE.Group>(null)
  const spring2Ref = useRef<THREE.Group>(null)

  const L = 0.95
  const W = 0.46
  const H_BOX = 0.22
  const slopeRad = rad(p.screenSlopeDeg)

  const geo = useMemo(() => {
    // Base stand: structural angle frame with 4 legs
    const stand = legStand({ x: L * 0.42, z: W * 0.48, h: 0.65, leg: 0.045, tieY: 0.12, tie: 0.04 })

    return {
      stand,
      screenFrame: screenBox({ len: L, width: W, height: H_BOX, wall: 0.018 }),
      scalpDeck: screenDeck({ len: L * 0.94, width: W * 0.92 }),
      gradeDeck: screenDeck({ len: L * 0.94, width: W * 0.92 }),
      bottomPan: screenDeck({ len: L * 0.94, width: W * 0.92, t: 0.006 }),
      leafSpring: leafSpring({ len: 0.24, width: 0.05 }),
      crank: eccentricCrank({ r: 0.075, t: 0.025, pinOffset: 0.012 }),
      pitman: pitmanRod({ len: 0.28 }),
      hopper: hopper({ top: 0.32, bottom: 0.12, h: 0.28 }),
      feedRoll: feedRoller({ r: 0.045, length: W * 0.85 }),
      motor: electricMotor({ r: 0.08, length: 0.16 }),
      // Discharge chutes:
      scalpChute: box(0.22, 0.08, 0.14),
      grainChute: box(0.24, 0.08, 0.18),
      finesChute: box(0.22, 0.08, 0.14),
    }
  }, [L, W, H_BOX])

  useSimFrame((_dt, t) => {
    const k = p.screenRpm > 0 ? 1 : 0
    const w = (p.screenRpm * 2 * PI) / 60
    const angle = (w * t) % (2 * PI)
    const strokeM = (p.screenStrokeMm * 1e-3) * 0.5 * k

    const dx = strokeM * cos(angle) * cos(slopeRad)
    const dy = -strokeM * cos(angle) * sin(slopeRad)

    live.cleanerAngle = angle
    live.cleanerDispX = dx
    live.cleanerDispY = dy

    if (boxRef.current) {
      boxRef.current.position.set(dx, 0.58 + dy, 0)
    }
    if (crankRef.current) {
      crankRef.current.rotation.z = angle
    }
    const flex = (strokeM / 0.24) * cos(angle)
    if (spring1Ref.current) spring1Ref.current.rotation.z = flex
    if (spring2Ref.current) spring2Ref.current.rotation.z = flex
  })

  // Particle flow curves along the screens:
  const scalpCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-L * 0.38, 0.76, 0),
      new THREE.Vector3(-L * 0.15, 0.72, 0.05),
      new THREE.Vector3(L * 0.15, 0.68, 0.08),
      new THREE.Vector3(L * 0.45, 0.63, 0.1),
      new THREE.Vector3(L * 0.58, 0.56, 0.12),
    ])
  }, [L])

  const cleanGrainCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-L * 0.35, 0.72, 0),
      new THREE.Vector3(-L * 0.1, 0.64, 0),
      new THREE.Vector3(L * 0.2, 0.6, 0),
      new THREE.Vector3(L * 0.48, 0.55, 0),
      new THREE.Vector3(L * 0.62, 0.42, 0),
    ])
  }, [L])

  const finesCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-L * 0.3, 0.68, 0),
      new THREE.Vector3(-L * 0.1, 0.56, -0.05),
      new THREE.Vector3(L * 0.15, 0.51, -0.08),
      new THREE.Vector3(L * 0.42, 0.46, -0.1),
      new THREE.Vector3(L * 0.55, 0.32, -0.12),
    ])
  }, [L])

  return (
    <Part
      id="screen-cleaner"
      name="Oscillating screen cleaner"
      role="housing"
      material="paintGreen"
      position={offset}
      info={{
        summary: 'Reciprocating dual-deck screen separator with scalping screen, grading screen and eccentric drive.',
        role: 'Separates raw grain feed into coarse trash (scalpings), clean seed (middle fraction), and fine weed seeds/sand (siftings).',
        details: 'Inclined deck oscillates on leaf springs driven by eccentric pitman crank. Screen effectiveness E = E_A · E_B measures precision of recovery.',
      }}
      cites={[P504.sep('screens note 1'), P504.sep('eqs 1-9 mass balance'), P504.pq('p3 Q3b')]}
    >
      {/* Heavy support base stand */}
      <Part id="cleaner-stand" name="Cleaner support stand" role="static" material="paintGrey">
        <PartMesh geometry={geo.stand} position={[0, 0, 0]} material="paintGrey" />
      </Part>

      {/* Overhead feed hopper with feed roller */}
      <Part
        id="cleaner-hopper"
        name="Feed hopper & feed roll"
        role="housing"
        material="galvanised"
        position={[-L * 0.36, 0.95, 0]}
        explode={[0, 0.3, 0]}
      >
        <PartMesh geometry={geo.hopper} position={[0, 0, 0]} material="galvanised" />
        <PartMesh geometry={geo.feedRoll} position={[0, -0.12, 0]} material="castIron" />
      </Part>

      {/* Reciprocating screen box (inclined by screenSlopeDeg) */}
      <group ref={boxRef} position={[0, 0.58, 0]} rotation={[0, 0, -slopeRad]}>
        <Part id="screen-box" name="Oscillating screen box" role="moving" material="wood" explode={[0, 0.15, 0]}>
          <PartMesh geometry={geo.screenFrame} position={[0, 0, 0]} material="wood" />

          {/* Upper deck: Scalping screen (coarse perforations) */}
          <Part
            id="scalp-screen"
            name="Upper scalping screen deck"
            role="moving"
            material="steel"
            explode={[0, 0.18, 0]}
            info={{
              summary: 'Top coarse punch-plate screen.',
              role: 'Removes oversize debris (straw, maize cobs, large stones) while allowing grain and fines to fall through.',
              details: 'Fraction X_A retained and discharged via oversize spout.',
            }}
            cites={[P504.sep('eq 7 E_A recovery')]}
          >
            <PartMesh geometry={geo.scalpDeck} position={[0, 0.06, 0]} material="steel" />
          </Part>

          {/* Lower deck: Grading screen (fine woven wire mesh) */}
          <Part
            id="grade-screen"
            name="Lower grading screen deck"
            role="moving"
            material="brass"
            explode={[0, 0.08, 0]}
            info={{
              summary: 'Bottom fine woven wire sieve.',
              role: 'Retains clean grain while permitting fine dirt, broken grains, and weed seeds to pass into the bottom pan.',
              details: 'Screen effectiveness E_B measures recovery of undersize in underflow stream.',
            }}
            cites={[P504.sep('eq 8 E_B recovery')]}
          >
            <PartMesh geometry={geo.gradeDeck} position={[0, -0.02, 0]} material="brass" />
          </Part>

          {/* Bottom collecting pan */}
          <Part id="fines-pan" name="Bottom fines collection tray" role="moving" material="galvanised">
            <PartMesh geometry={geo.bottomPan} position={[0, -0.08, 0]} material="galvanised" />
          </Part>

          {/* Three discharge spouts at tail end */}
          <Part id="chutes-assembly" name="Discharge chutes (3-way split)" role="moving" material="paintGreen">
            {/* Top scalpings chute (straw / oversize) */}
            <PartMesh
              geometry={geo.scalpChute}
              position={[L * 0.52, 0.05, 0.12]}
              rotation={[0, 0, -0.4]}
              material="paintGreen"
            />
            {/* Middle clean grain delivery chute */}
            <PartMesh
              geometry={geo.grainChute}
              position={[L * 0.54, -0.03, 0]}
              rotation={[0, 0, -0.4]}
              material="paintGreen"
            />
            {/* Bottom screenings / fines chute */}
            <PartMesh
              geometry={geo.finesChute}
              position={[L * 0.52, -0.1, -0.12]}
              rotation={[0, 0, -0.4]}
              material="paintGreen"
            />
          </Part>
        </Part>
      </group>

      {/* 4 Flexible leaf spring rockers */}
      <Part id="leaf-springs" name="Flexible leaf spring rockers" role="moving" material="steelDark">
        <group ref={spring1Ref} position={[-L * 0.35, 0.44, W * 0.45]}>
          <PartMesh geometry={geo.leafSpring} position={[0, 0, 0]} material="steelDark" />
        </group>
        <group ref={spring2Ref} position={[L * 0.35, 0.44, W * 0.45]}>
          <PartMesh geometry={geo.leafSpring} position={[0, 0, 0]} material="steelDark" />
        </group>
        <group position={[-L * 0.35, 0.44, -W * 0.45]}>
          <PartMesh geometry={geo.leafSpring} position={[0, 0, 0]} material="steelDark" />
        </group>
        <group position={[L * 0.35, 0.44, -W * 0.45]}>
          <PartMesh geometry={geo.leafSpring} position={[0, 0, 0]} material="steelDark" />
        </group>
      </Part>

      {/* Eccentric drive: Motor, flywheel, crank, pitman rod */}
      <Part
        id="cleaner-drive"
        name="Eccentric pitman drive"
        role="moving"
        material="castIron"
        position={[-L * 0.48, 0.54, -W * 0.46]}
        explode={[0, 0, -0.22]}
      >
        <PartMesh geometry={geo.motor} position={[-0.15, -0.12, -0.02]} material="paintBlue" />
        <group ref={crankRef} position={[0, 0, 0]}>
          <PartMesh geometry={geo.crank} position={[0, 0, 0]} rotation={[PI / 2, 0, 0]} material="castIron" />
        </group>
        <PartMesh geometry={geo.pitman} position={[0.15, 0.02, 0]} rotation={[0, 0, 0.1]} material="steelMatte" />
      </Part>

      {/* Particle flows moving down the decks */}
      <Flow
        curve={scalpCurve}
        count={70}
        radius={0.011}
        color="#8a7b5c"
        intensity={() => (p.screenRpm > 0 ? 1 : 0)}
        speed={0.4}
        spread={0.03}
      />
      <Flow
        curve={cleanGrainCurve}
        count={120}
        radius={0.012}
        color="#d6b25e"
        intensity={() => (p.screenRpm > 0 ? 1 : 0)}
        speed={0.45}
        spread={0.04}
      />
      <Flow
        curve={finesCurve}
        count={80}
        radius={0.007}
        color="#a3aab0"
        intensity={() => (p.screenRpm > 0 ? 1 : 0)}
        speed={0.4}
        spread={0.03}
      />
    </Part>
  )
}

/* =========================================================================
 * 3. ASPIRATOR / WINNOWER (AERODYNAMIC AIR CLASSIFIER)
 * ========================================================================= */

function AspiratorAssembly({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const p = useSeparation()
  const fanRef = useRef<THREE.Group>(null)

  const COL_W = 0.32
  const COL_D = 0.28
  const COL_H = 1.25

  const geo = useMemo(() => {
    return {
      column: boxShell({ w: COL_W, d: COL_D, h: COL_H, t: 0.015 }),
      glassFront: box(COL_W * 0.88, COL_H * 0.72, 0.006),
      ...(({ housing, impeller }) => ({ blowerScroll: housing, fanRotor: impeller }))(centrifugalFan({ r: 0.17, width: 0.14 })),
      blowerMotor: electricMotor({ r: 0.09, length: 0.18 }),
      hopper: hopper({ top: 0.32, bottom: 0.12, h: 0.26 }),
      feedRoll: feedRoller({ r: 0.04, length: COL_D * 0.8 }),
      expansionPlenum: box(COL_W * 1.5, 0.28, COL_D * 1.2),
      bafflePlate: box(COL_W * 0.7, 0.01, COL_D * 0.9),
      chaffOutlet: box(0.28, 0.12, 0.16),
      cleanGrainOutlet: box(0.26, 0.14, 0.18),
      ductJoint: cylinder(0.08, 0.25, 24),
    }
  }, [COL_W, COL_D, COL_H])

  useSimFrame((_dt, t) => {
    const k = p.airVelocity > 0 ? 1 : 0
    const w = (p.airVelocity * 400 * 2 * PI) / 60
    const angle = (w * t) % (2 * PI)
    live.fanAngle = angle
    if (fanRef.current) {
      fanRef.current.rotation.z = angle * k
    }
  })

  // Aerodynamic paths:
  // Chaff is swept upward and into chaff outlet
  const chaffFlowCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.78, 0),
      new THREE.Vector3(0.02, 0.95, 0),
      new THREE.Vector3(0.05, 1.15, 0),
      new THREE.Vector3(0.18, 1.25, 0),
      new THREE.Vector3(0.38, 1.22, 0),
    ])
  }, [])

  // Clean grain falls downward against air stream into discharge chute
  const grainFlowCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.82, 0),
      new THREE.Vector3(-0.02, 0.62, 0),
      new THREE.Vector3(-0.04, 0.42, 0),
      new THREE.Vector3(-0.06, 0.25, 0),
      new THREE.Vector3(-0.24, 0.15, 0),
    ])
  }, [])

  return (
    <Part
      id="aspirator"
      name="Air classifier & winnower"
      role="housing"
      material="paintGreen"
      position={offset}
      info={{
        summary: 'Vertical aspiration column separator utilizing aerodynamic drag and terminal settling velocity.',
        role: 'Separates light chaff, husks, and glumes from heavy clean grain by maintaining upward airflow between their terminal velocities.',
        details: 'Stokes regime Vt = g D² (ρ_p − ρ_a) / (18 µ) applies to fine dust; iterative drag applies to grain and chaff.',
      }}
      cites={[P504.sep('aerodynamics eqs 1-12'), P504.sep('terminal velocity iteration'), P504.pq('p5 Q v')]}
    >
      {/* Vertical rectangular aspiration column housing */}
      <Part id="aspirator-column" name="Aspiration throat column" role="housing" material="paintGreen">
        <PartMesh geometry={geo.column} position={[0, 0.75, 0]} material="paintGreen" />
        {/* Transparent observation window on front */}
        <PartMesh geometry={geo.glassFront} position={[0, 0.75, COL_D * 0.48]} material="glass" />
      </Part>

      {/* Top feed hopper & fluted feed roller */}
      <Part
        id="aspirator-hopper"
        name="Feed hopper & airlock feed roll"
        role="housing"
        material="galvanised"
        position={[0, 1.48, 0]}
        explode={[0, 0.35, 0]}
      >
        <PartMesh geometry={geo.hopper} position={[0, 0, 0]} material="galvanised" />
        <PartMesh geometry={geo.feedRoll} position={[0, -0.12, 0]} material="castIron" />
      </Part>

      {/* Top expansion settling chamber & chaff outlet */}
      <Part
        id="expansion-plenum"
        name="Expansion settling plenum"
        role="housing"
        material="paintGrey"
        position={[0.08, 1.25, 0]}
        explode={[0.2, 0.2, 0]}
      >
        <PartMesh geometry={geo.expansionPlenum} position={[0, 0, 0]} material="paintGrey" />
        <PartMesh geometry={geo.bafflePlate} position={[0, 0.05, 0]} rotation={[0, 0, 0.35]} material="steel" />
        <PartMesh geometry={geo.chaffOutlet} position={[COL_W * 0.9, -0.05, 0]} rotation={[0, 0, -0.3]} material="galvanised" />
      </Part>

      {/* Centrifugal blower fan at column base */}
      <Part
        id="blower-fan"
        name="Centrifugal blower assembly"
        role="housing"
        material="paintYellow"
        position={[-0.18, 0.22, 0]}
        explode={[-0.25, 0, 0]}
      >
        <PartMesh geometry={geo.blowerScroll} position={[0, 0, 0]} material="paintYellow" />
        <group ref={fanRef} position={[0, 0, 0]}>
          <PartMesh geometry={geo.fanRotor} position={[0, 0, 0]} material="steel" />
        </group>
        <PartMesh geometry={geo.blowerMotor} position={[0, 0, -0.17]} material="paintBlue" />
      </Part>

      {/* Bottom clean grain discharge spout */}
      <Part id="grain-outlet" name="Clean grain discharge chute" role="housing" material="galvanised">
        <PartMesh
          geometry={geo.cleanGrainOutlet}
          position={[-0.15, 0.2, 0]}
          rotation={[0, 0, -0.45]}
          material="galvanised"
        />
      </Part>

      {/* Aerodynamic particle flows */}
      {/* Chaff blown up */}
      <Flow
        curve={chaffFlowCurve}
        count={90}
        radius={0.009}
        color="#d8bf72"
        intensity={() => (p.airVelocity > 2 ? 1 : 0.05)}
        speed={Math.max(0.2, p.airVelocity / 6)}
        spread={0.03}
      />
      {/* Clean grain falling down */}
      <Flow
        curve={grainFlowCurve}
        count={110}
        radius={0.012}
        color="#d6b25e"
        intensity={() => (p.airVelocity < 9.5 ? 1 : 0.1)}
        speed={0.45}
        spread={0.03}
      />
    </Part>
  )
}

/* =========================================================================
 * 4. CYCLONE SEPARATOR CUTAWAY WITH PARTICLE PATHS
 * ========================================================================= */

function CycloneAssembly({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const p = useSeparation()
  const valveRef = useRef<THREE.Group>(null)

  const R = p.cycloneRadius
  const R_APEX = 0.08
  const H_CYL = 0.42
  const H_CONE = 0.58
  const R_VORTEX = R * 0.45

  const geo = useMemo(() => {
    // cyclone frame: apex at y = 0; the scene's datum (0.75) is the barrel/cone joint
    const c = cyclone({ rBarrel: R, rApex: R_APEX, hBarrel: H_CYL, hCone: H_CONE, wall: 0.012, rFinder: R_VORTEX, depth: 0.29, above: 0.09 })
    const down = mat4.t(0, -H_CONE, 0)
    return {
      body: xform(c.body, down),
      roof: xform(c.roof, down),
      vortexFinder: xform(c.finder, mat4.t(0, -H_CYL - H_CONE + 0.1, 0)),
      exhaustElbow: pipe(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0.3, 0.35, 0)), R_VORTEX, R_VORTEX - 0.008, 24),
      inletDuct: box(0.32, 0.18, p.cycloneInletWidth),
      starValve: rotaryValve({ r: 0.07, width: 0.14 }),
      dustBin: dustBin({ r: 0.16, h: 0.32, wall: 0.012 }),
      supportLegs: cylinder(0.02, 1.2, 16),
    }
  }, [R, R_APEX, H_CYL, H_CONE, R_VORTEX, p.cycloneInletWidth])

  useSimFrame((_dt, t) => {
    const w = (p.cycloneVelocity * 60 * 2 * PI) / 60
    const angle = (w * t) % (2 * PI)
    live.cycloneSpinAngle = angle
    if (valveRef.current) {
      valveRef.current.rotation.z = (t * 0.8) % (2 * PI)
    }
  })

  // Double-helix vortex trajectories:
  // 1. Outer descending vortex (dust thrown to wall, spiraling down)
  const outerSpiral = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const turns = p.cycloneTurns
    const N = 150
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const angle = turns * 2 * PI * u
      // Radius tapers from R near wall to apex radius
      const r = (R * 0.92) * (1 - u * 0.65)
      // Height drops from top of cylinder to bottom cone
      const y = H_CYL - u * (H_CYL + H_CONE)
      pts.push(new THREE.Vector3(r * cos(angle), y, r * sin(angle)))
    }
    return new THREE.CatmullRomCurve3(pts)
  }, [R, H_CYL, H_CONE, p.cycloneTurns])

  // 2. Inner ascending vortex (clean air core spiraling up into vortex finder)
  const innerSpiral = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const turns = p.cycloneTurns * 1.2
    const N = 120
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const angle = -turns * 2 * PI * u
      const r = R_VORTEX * 0.55
      const y = -H_CONE * 0.85 + u * (H_CYL + H_CONE * 0.85 + 0.25)
      pts.push(new THREE.Vector3(r * cos(angle), y, r * sin(angle)))
    }
    return new THREE.CatmullRomCurve3(pts)
  }, [R_VORTEX, H_CYL, H_CONE, p.cycloneTurns])

  return (
    <Part
      id="cyclone"
      name="Cyclone separator (cutaway)"
      role="housing"
      material="galvanised"
      position={offset}
      info={{
        summary: 'Centrifugal gas-solid cyclone separator with cutaway view of inner and outer helical vortices.',
        role: 'Separates dust and air-conveyed crop particles by centrifugal force C_f = W V² / (g R) and collects clean exhaust gas via central vortex finder.',
        details: 'Tangential inlet creates outer descending helical vortex throwing particles against wall, while inner ascending vortex core discharges clean gas.',
      }}
      cites={[P504.sep('cyclone eqs 13-17'), P504.sep('separation factor S = V^2/(gR)'), P504.hand('cyclone collectors')]}
    >
      {/* Cyclone outer cylindrical & conical body */}
      <Part id="cyclone-body" name="Cyclone body & cone" role="housing" material="galvanised">
        <PartMesh geometry={geo.body} position={[0, 0.75, 0]} material="galvanised" />
        <PartMesh geometry={geo.roof} position={[0, 0.75, 0]} material="steelMatte" />
      </Part>

      {/* Tangential rectangular inlet scroll duct */}
      <Part
        id="cyclone-inlet"
        name="Tangential inlet duct"
        role="housing"
        material="paintGrey"
        position={[R * 0.75, 0.75 + H_CYL * 0.75, 0]}
      >
        <PartMesh geometry={geo.inletDuct} position={[0, 0, 0]} material="paintGrey" />
      </Part>

      {/* Central vortex finder exhaust tube */}
      <Part
        id="vortex-finder"
        name="Central vortex finder tube"
        role="static"
        material="steelMatte"
        position={[0, 0.75 + H_CYL - 0.1, 0]}
        explode={[0, 0.45, 0]}
        info={{
          summary: 'Internal tubular exhaust sleeve.',
          role: 'Prevents inlet gas short-circuiting directly to exhaust; forces formation of inner ascending vortex core.',
          details: 'Extends below inlet duct into cylindrical barrel.',
        }}
        cites={[P504.sep('cyclone gas flow')]}
      >
        <PartMesh geometry={geo.vortexFinder} position={[0, 0, 0]} material="steelMatte" />
        <PartMesh geometry={geo.exhaustElbow} position={[0, 0.28, 0]} material="galvanised" />
      </Part>

      {/* Apex rotary airlock star valve */}
      <Part
        id="rotary-valve"
        name="Rotary airlock discharge valve"
        role="moving"
        material="castIron"
        position={[0, 0.75 - H_CONE - 0.08, 0]}
        explode={[0, -0.22, 0]}
        info={{
          summary: 'Continuous dust airlock star valve.',
          role: 'Discharges collected solids continuously while preventing atmospheric air ingress into sub-atmospheric cyclone apex.',
          details: '6-vane rotating pocket star wheel.',
        }}
        cites={[P504.hand('cyclone rotary valve')]}
      >
        <PartMesh geometry={geo.starValve.casing} material="castIron" />
        <group ref={valveRef}>
          <PartMesh geometry={geo.starValve.rotor} material="steel" />
        </group>
      </Part>

      {/* Dust collection bin / drum at bottom */}
      <Part
        id="dust-bin"
        name="Dust collector catch bin"
        role="static"
        material="paintGrey"
        position={[0, 0.75 - H_CONE - 0.45, 0]}
        explode={[0, -0.4, 0]}
      >
        <PartMesh geometry={geo.dustBin} position={[0, 0, 0]} material="paintGrey" />
      </Part>

      {/* Double-helix particle flows */}
      {/* Outer descending spiral: dense dust thrown to wall */}
      <Flow
        curve={outerSpiral}
        count={140}
        radius={0.011}
        color="#d6b25e"
        intensity={() => (p.cycloneVelocity > 0 ? 1 : 0)}
        speed={Math.max(0.2, p.cycloneVelocity / 45)}
        spread={0.02}
        emissive={0.3}
      />
      {/* Inner ascending spiral: clean air core spinning up */}
      <Flow
        curve={innerSpiral}
        count={70}
        radius={0.007}
        color="#9fd3ff"
        intensity={() => (p.cycloneVelocity > 0 ? 1 : 0)}
        speed={Math.max(0.25, p.cycloneVelocity / 30)}
        spread={0.015}
      />
    </Part>
  )
}

/* =========================================================================
 * 5. MAIN SEPARATION VIEWPORT COMPONENT
 * ========================================================================= */

export function Separation3D() {
  const kind = useSeparation((s) => s.kind)

  return (
    <group>
      {kind === 'cleaner' ? (
        <>
          <ScreenCleanerAssembly offset={[0, 0, 0]} />
          <PartLabel partId="screen-box" at={[0, 0.85, 0.28]} />
          <PartLabel partId="scalp-screen" at={[-0.15, 0.72, 0.26]} />
          <PartLabel partId="grade-screen" at={[0.1, 0.62, 0.26]} />
          <PartLabel partId="cleaner-drive" at={[-0.48, 0.54, -0.32]} />
          <PartLabel partId="chutes-assembly" at={[0.55, 0.52, 0.15]} />
        </>
      ) : kind === 'aspirator' ? (
        <>
          <AspiratorAssembly offset={[0, 0, 0]} />
          <PartLabel partId="aspirator-column" at={[0, 0.9, 0.2]} />
          <PartLabel partId="aspirator-hopper" at={[0, 1.55, 0.2]} />
          <PartLabel partId="expansion-plenum" at={[0.25, 1.35, 0.2]} />
          <PartLabel partId="blower-fan" at={[-0.22, 0.35, 0.15]} />
          <PartLabel partId="grain-outlet" at={[-0.2, 0.15, 0.2]} />
        </>
      ) : kind === 'cyclone' ? (
        <>
          <CycloneAssembly offset={[0, 0, 0]} />
          <PartLabel partId="cyclone-body" at={[0.3, 1.05, 0.2]} />
          <PartLabel partId="vortex-finder" at={[0, 1.35, 0.18]} />
          <PartLabel partId="cyclone-inlet" at={[0.32, 1.25, 0.12]} />
          <PartLabel partId="rotary-valve" at={[0, 0.38, 0.15]} />
          <PartLabel partId="dust-bin" at={[0, 0.12, 0.2]} />
        </>
      ) : kind === 'shaker' ? (
        <>
          <SieveShakerAssembly offset={[0, 0, 0]} />
          <PartLabel partId="sieve-tier-0" at={[0, 0.58, 0.15]} />
          <PartLabel partId="sieve-tier-4" at={[0, 0.42, 0.15]} />
          <PartLabel partId="sieve-tier-7" at={[0, 0.28, 0.15]} />
          <PartLabel partId="shaker-base" at={[0, 0.12, 0.2]} />
          <PartLabel partId="shaker-lid" at={[0, 0.65, 0.15]} />
        </>
      ) : (
        /* 'all': Integrated cleaning house plant sequence */
        <>
          <ScreenCleanerAssembly offset={[-1.6, 0, 0]} />
          <AspiratorAssembly offset={[-0.3, 0, 0]} />
          <CycloneAssembly offset={[1.0, 0, 0]} />
          <SieveShakerAssembly offset={[2.2, 0, 0]} />

          <PartLabel partId="screen-cleaner" at={[-1.6, 1.15, 0.2]} />
          <PartLabel partId="aspirator" at={[-0.3, 1.6, 0.2]} />
          <PartLabel partId="cyclone" at={[1.0, 1.4, 0.2]} />
          <PartLabel partId="sieve-shaker" at={[2.2, 0.75, 0.2]} />
        </>
      )}
    </group>
  )
}
