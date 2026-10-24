import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, lathe, mat4, merge, xform } from '@/geometry'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { RICE_CITES } from './cites'
import { centrifugalFan, cyclone, elevatorCasing, hexScreenCage, hopper, pressureVessel, rotaryDrum, rubberRollSleeve } from '@/parts/lib/processing'
import { analyseRiceProcessing, live, useRice } from './model'

const { PI, sin, cos } = Math

export function Scene3D() {
  const params = useRice()
  const analysis = useMemo(() => analyseRiceProcessing(params), [params])

  // Moving part rotation refs
  const hullerFastRef = useRef<THREE.Group>(null)
  const hullerSlowRef = useRef<THREE.Group>(null)
  const cleanerScreenRef = useRef<THREE.Group>(null)
  const trieurDrumRef = useRef<THREE.Group>(null)
  const fanRotorRef = useRef<THREE.Group>(null)
  const polisherShaftRef = useRef<THREE.Group>(null)
  const separatorTrayRef = useRef<THREE.Group>(null)

  // Simulation animation loop
  useSimFrame((dt, t) => {
    // 1. Rubber roll differential rotation
    // Fast roll ~1300 rpm, slow roll ~1050 rpm
    const fastSpeed = (params.hullerFastRpm * 2 * PI) / 60
    const slowSpeed = (analysis.hullerSlowRpm * 2 * PI) / 60
    live.fastAngle = (live.fastAngle + dt * fastSpeed) % (2 * PI)
    live.slowAngle = (live.slowAngle + dt * slowSpeed) % (2 * PI)

    if (hullerFastRef.current) hullerFastRef.current.rotation.z = live.fastAngle
    if (hullerSlowRef.current) hullerSlowRef.current.rotation.z = -live.slowAngle

    // 2. Vibrating screens: 12 Hz eccentric oscillation
    const vibFreq = 12 * 2 * PI
    live.screenVibX = sin(t * vibFreq) * 0.008
    live.screenVibY = cos(t * vibFreq) * 0.003
    if (cleanerScreenRef.current) {
      cleanerScreenRef.current.position.x = live.screenVibX
      cleanerScreenRef.current.position.y = live.screenVibY
    }
    if (separatorTrayRef.current) {
      separatorTrayRef.current.position.z = cos(t * vibFreq * 0.8) * 0.012
    }

    // 3. Trieur cylinder rotation: slow ~35 rpm
    live.trieurAngle = (live.trieurAngle + dt * ((35 * 2 * PI) / 60)) % (2 * PI)
    if (trieurDrumRef.current) trieurDrumRef.current.rotation.x = live.trieurAngle

    // 4. Aspirator fan rotor: fast 2000 rpm
    live.fanAngle = (live.fanAngle + dt * ((2000 * 2 * PI) / 60)) % (2 * PI)
    if (fanRotorRef.current) fanRotorRef.current.rotation.y = live.fanAngle

    // 5. Polisher shaft: 900 rpm
    if (polisherShaftRef.current) polisherShaftRef.current.rotation.y = (t * ((900 * 2 * PI) / 60)) % (2 * PI)

    // Update live readouts
    live.time = t
    live.headRiceKgH = analysis.headRice
    live.brokensKgH = analysis.totalBrokens
    live.huskKgH = analysis.huskOut
    live.branKgH = analysis.branOut
    live.hryPct = analysis.headRiceYieldPct
  })

  // Machine static geometries
  const geoms = useMemo(() => {
    // 1. Cleaner
    const cleanerHopper = hopper({ top: 0.65, bottom: 0.22, h: 0.45 })
    const cleanerFrame = box(0.85, 0.9, 0.7)
    const screenDeck = box(0.72, 0.08, 0.55)
    const cleanerFan = centrifugalFan({ r: 0.14, width: 0.12 })
    const cleanerFanHousing = merge(cleanerFan.housing, cleanerFan.impeller)

    // 2. Parboiling
    const soakTank = lathe(
      [
        [0.08, 0],
        [0.45, 0.35],
        [0.45, 1.4],
        [0.05, 1.55],
      ],
      32,
    )
    const autoclave = pressureVessel({ r: 0.38, length: 1.5, headDepth: 0.18, wall: 0.015 })
    const dryerColumn = box(0.6, 1.8, 0.6)
    const blower = centrifugalFan({ r: 0.2, width: 0.3 })
    const furnaceBlower = merge(blower.housing, blower.impeller)

    // 3. Huller
    const hullerStand = box(0.75, 0.7, 0.6)
    const hullerHopper = hopper({ top: 0.5, bottom: 0.15, h: 0.35 })
    const rollSleeve = rubberRollSleeve({ outerR: 0.111, innerR: 0.05, length: 0.25 })
    const rollCore = xform(cylinder(0.05, 0.38, 20), mat4.rx(PI / 2))
    const hullerHousing = box(0.65, 0.55, 0.45)

    // 4. Husk Aspirator & Cyclone
    const cyc = cyclone({ rBarrel: 0.28, rApex: 0.08, hBarrel: 0.55, hCone: 0.65, rFinder: 0.1, depth: 0.3, above: 0.15 })
    const huskCyclone = merge(cyc.body, cyc.roof, cyc.finder)
    const aspiratorDuct = box(0.22, 1.2, 0.22)
    // induced-draught fan on the cyclone outlet, axis vertical: the housing stays, the impeller turns
    const idFan = centrifugalFan({ r: 0.18, width: 0.18 })
    const fanHousing = xform(idFan.housing, mat4.rx(PI / 2))
    const fanScroll = xform(idFan.impeller, mat4.rx(PI / 2))

    // 5. Paddy Separator
    const sepFrame = box(0.8, 0.7, 0.9)
    const sepTray = box(0.72, 0.12, 0.82)

    // 6. Whitener & Polisher
    const whitenerBase = box(0.6, 0.6, 0.6)
    const hexCage = hexScreenCage({ r: 0.18, height: 0.7 })
    const polishRotor = cylinder(0.13, 0.68, 16)
    const polisherHousing = cylinder(0.26, 0.85, 28)

    // 7. Grader (Trieur & Sifter)
    const trieurDrum = rotaryDrum({ r: 0.28, t: 0.02, L: 1.4, segments: 36 }).shell
    const trieurStand = box(0.8, 0.8, 1.5)
    const binBox = box(0.28, 0.5, 0.45)

    // Bucket elevators casing
    const el1 = elevatorCasing({ bootW: 0.35, bootD: 0.28, bootH: 0.3, legW: 0.12, legD: 0.14, legH: 2.1, legSpacing: 0.18 })
    const el2 = el1

    // Floor baseplate
    const floorPlate = box(8.2, 0.04, 3.2)

    return {
      cleanerHopper,
      cleanerFrame,
      screenDeck,
      cleanerFanHousing,
      soakTank,
      autoclave,
      dryerColumn,
      furnaceBlower,
      hullerStand,
      hullerHopper,
      rollSleeve,
      rollCore,
      hullerHousing,
      cyclone: huskCyclone,
      aspiratorDuct,
      fanHousing,
      fanScroll,
      sepFrame,
      sepTray,
      whitenerBase,
      hexCage,
      polishRotor,
      polisherHousing,
      trieurDrum,
      trieurStand,
      binBox,
      el1,
      el2,
      floorPlate,
    }
  }, [])

  // Flow curves for grain streams
  const curves = useMemo(() => {
    // 1. Raw paddy into cleaner
    const p1 = new THREE.LineCurve3(new THREE.Vector3(-3.2, 2.2, 0), new THREE.Vector3(-3.2, 1.4, 0))
    // 2. Parboil or bypass route to huller
    const parboilPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.0, 0.6, 0),
      new THREE.Vector3(-2.1, 1.6, -0.4),
      new THREE.Vector3(-1.4, 1.2, -0.4),
      new THREE.Vector3(-0.5, 1.6, 0),
    ])
    const rawBypassPath = new THREE.LineCurve3(new THREE.Vector3(-3.0, 0.6, 0), new THREE.Vector3(-0.5, 1.6, 0))
    // 3. Husk lifted to cyclone
    const huskLiftPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.4, 0.7, 0),
      new THREE.Vector3(0.0, 1.5, 0.5),
      new THREE.Vector3(0.4, 2.1, 0.5),
    ])
    // 4. Brown rice to separator
    const brownRicePath = new THREE.LineCurve3(new THREE.Vector3(-0.3, 0.4, 0), new THREE.Vector3(1.1, 0.7, 0))
    // 5. White rice to grader
    const whiteRicePath = new THREE.LineCurve3(new THREE.Vector3(2.2, 0.5, 0), new THREE.Vector3(3.0, 1.2, 0))
    // 6. Head rice discharge
    const headRiceOut = new THREE.LineCurve3(new THREE.Vector3(3.3, 0.7, 0), new THREE.Vector3(3.8, 0.2, 0))

    return { p1, parboilPath, rawBypassPath, huskLiftPath, brownRicePath, whiteRicePath, headRiceOut }
  }, [])

  const rollGapM = params.hullerGapMm * 0.001
  const rollR = params.rollDiameterM / 2

  return (
    <group position={[0, 0, 0]}>
      {/* Factory Floor */}
      <Part
        id="factory-floor"
        name="Processing Floor Plate"
        material="concrete"
        role="static"
        info={{ summary: 'Reinforced concrete factory slab.', role: 'Level vibration-damped foundation.' }}
      >
        <PartMesh geometry={geoms.floorPlate} position={[0, -0.02, 0]} material="concrete" />
      </Part>

      {/* ==================== 1. PRE-CLEANING & SCALPER ==================== */}
      <group position={[-3.2, 0, 0]}>
        <Part
          id="cleaner"
          name="Paddy Pre-Cleaner & Scalper"
          material="paintGreen"
          role="housing"
          info={{
            summary: 'Double-deck oscillating cleaner with aspiration scalper.',
            role: 'Removes oversize straw, stalks, weed seeds, stones and fine dust before hulling.',
            details: 'Cleaning efficiency removes 1.5–3.0 % dockage. Prevents roll wear and machinery damage.',
          }}
          cites={[RICE_CITES.flow(), RICE_CITES.sepScreen()]}
        >
          <PartMesh geometry={geoms.cleanerFrame} position={[0, 0.55, 0]} />
          <PartMesh geometry={geoms.cleanerHopper} position={[0, 1.1, 0]} material="galvanised" />

          {/* Vibrating Screens (Moving) */}
          <group ref={cleanerScreenRef} position={[0, 0.55, 0]}>
            <Part
              id="cleaner-screens"
              name="Double-Deck Vibrating Screens"
              material="galvanised"
              role="moving"
              info={{
                summary: 'Reciprocating screen decks.',
                role: 'Top deck scalps large straw/sticks; bottom fine screen sifts sand and weed seeds.',
              }}
              cites={[RICE_CITES.sepScreen()]}
            >
              <PartMesh geometry={geoms.screenDeck} position={[0, 0.08, 0]} />
              <PartMesh geometry={geoms.screenDeck} position={[0, -0.12, 0]} />
            </Part>
          </group>

          {/* Aspiration Air Fan */}
          <Part
            id="cleaner-fan"
            name="Aspiration Exhaust Fan"
            material="paintGrey"
            role="moving"
            info={{ summary: 'Dust aspiration fan.', role: 'Extracts light dust and chaff by suction air blast.' }}
          >
            <PartMesh geometry={geoms.cleanerFanHousing} position={[0.3, 1.1, 0]} material="paintGrey" />
          </Part>

          <PartLabel partId="cleaner" at={[0, 1.6, 0]} text="Pre-Cleaner" />
        </Part>
      </group>

      {/* ==================== 2. PARBOILING & DRYING SECTION ==================== */}
      <group position={[-1.8, 0, -0.3]}>
        <Part
          id="parboiler"
          name="Parboiling Plant (Soaking & Autoclave)"
          material="steel"
          role="housing"
          info={{
            summary: 'Hydrothermal conditioning: hot-water soaking and pressurized steam retort.',
            role: 'Gelatinizes starch, seals internal grain fissures, drives vitamins into endosperm, maximizes head-rice yield.',
            details: 'Soak at 60–75 °C to ~32 % MC; steam at 1–2.5 bar. Starch gelatinization drives thiamine from bran to core.',
          }}
          cites={[RICE_CITES.parboil(), RICE_CITES.pqParboil()]}
        >
          {/* Twin Soaking Tanks */}
          <Part
            id="soak-tank-1"
            name="Warm-Water Soaking Tank A"
            material="steelMatte"
            role="housing"
            info={{ summary: 'Insulated soaking vessel.', role: 'Hydrates paddy up to 30–35 % moisture.' }}
          >
            <PartMesh geometry={geoms.soakTank} position={[-0.45, 0.45, 0]} />
          </Part>

          <Part
            id="soak-tank-2"
            name="Warm-Water Soaking Tank B"
            material="steelMatte"
            role="housing"
            info={{ summary: 'Twin soaking vessel for continuous batch cycling.', role: 'Maintains steady soak cycle.' }}
          >
            <PartMesh geometry={geoms.soakTank} position={[-0.45, 0.45, -0.6]} />
          </Part>

          {/* Steaming Autoclave Pressure Vessel */}
          <Part
            id="steam-autoclave"
            name="Steam Retort Pressure Autoclave"
            material="forged"
            role="housing"
            info={{
              summary: 'Horizontal steam pressure chamber.',
              role: 'Applies direct saturated steam (1–2.5 bar) to gelatinize starch granules completely.',
            }}
            cites={[RICE_CITES.parboil()]}
          >
            <PartMesh geometry={geoms.autoclave} position={[0.45, 0.85, -0.3]} />
          </Part>

          {/* Column Grain Dryer */}
          <Part
            id="paddy-dryer"
            name="Tempered Air Column Dryer"
            material="galvanised"
            role="housing"
            info={{
              summary: 'Continuous hot-air grain dryer.',
              role: 'Slowly dries gelatinized paddy from 32 % back down to 12.5 % MC to avoid moisture stress cracks.',
            }}
          >
            <PartMesh geometry={geoms.dryerColumn} position={[0.45, 0.9, 0.5]} />
            <PartMesh geometry={geoms.furnaceBlower} position={[0.45, 0.25, 0.95]} material="castIron" />
          </Part>

          <PartLabel partId="parboiler" at={[0, 1.9, -0.3]} text="Parboiling & Steaming" />
        </Part>
      </group>

      {/* ==================== 3. RUBBER-ROLL HULLER (SHELLER) ==================== */}
      <group position={[-0.45, 0, 0]}>
        <Part
          id="huller"
          name="Rubber-Roll Paddy Huller"
          material="paintGreen"
          role="housing"
          info={{
            summary: 'Twin counter-rotating rubber rolls running at differential peripheral speeds.',
            role: 'Applies differential shearing forces on paddy husks while elastomeric rubber cushions kernel from compressive damage.',
            details: 'Fast roll ~1300 rpm, slow roll ~1050 rpm (ratio 1.24 : 1). Dehulls 85–95 % in a single pass with <3 % brokens.',
          }}
          cites={[RICE_CITES.flow(), RICE_CITES.beyond('Rubber-roll huller mechanics')]}
        >
          <PartMesh geometry={geoms.hullerStand} position={[0, 0.35, 0]} material="castIron" />
          <PartMesh geometry={geoms.hullerHousing} position={[0, 0.85, 0]} material="paintGreen" />
          <PartMesh geometry={geoms.hullerHopper} position={[0, 1.3, 0]} material="galvanised" />

          {/* Fast Rubber Roll (Moving) */}
          <group
            ref={hullerFastRef}
            position={[-rollR - rollGapM / 2, 0.85, 0]}
          >
            <Part
              id="roll-fast"
              name="Fast Rubber Roll"
              material="rubber"
              role="moving"
              info={{
                summary: 'High-speed elastomeric polyurethane rubber roll.',
                role: 'Rotates at ~1300 rpm (peripheral speed ~15.1 m/s). Drives top surface of paddy husk forward.',
              }}
            >
              <PartMesh geometry={geoms.rollSleeve} position={[0, 0, 0]} material="rubber" />
              <PartMesh geometry={geoms.rollCore} position={[0, 0, 0]} material="steel" />
            </Part>
          </group>

          {/* Slow Rubber Roll (Moving) */}
          <group
            ref={hullerSlowRef}
            position={[rollR + rollGapM / 2, 0.85, 0]}
          >
            <Part
              id="roll-slow"
              name="Slow Rubber Roll"
              material="rubber"
              role="moving"
              info={{
                summary: 'Low-speed elastomeric rubber roll.',
                role: 'Rotates at ~1050 rpm (peripheral speed ~12.2 m/s). Retards bottom husk, generating differential shear that strips husk.',
              }}
            >
              <PartMesh geometry={geoms.rollSleeve} position={[0, 0, 0]} material="rubber" />
              <PartMesh geometry={geoms.rollCore} position={[0, 0, 0]} material="steel" />
            </Part>
          </group>

          <PartLabel partId="huller" at={[0, 1.6, 0]} text="Rubber-Roll Huller" />
        </Part>
      </group>

      {/* ==================== 4. HUSK ASPIRATOR & CYCLONE ==================== */}
      <group position={[0.45, 0, 0.35]}>
        <Part
          id="husk-aspirator"
          name="Husk Aspirator & Cyclone Collector"
          material="paintBlue"
          role="housing"
          info={{
            summary: 'Aerodynamic winnowing chamber and centrifugal cyclone separator.',
            role: 'Exploits difference in terminal velocity: air at 4.5 m/s lifts light husk (Vt ≈ 2.5 m/s) into cyclone while heavy brown rice (Vt ≈ 7.2 m/s) drops.',
            details: 'Husk makes up ~20 % of paddy weight. Recovered for boiler fuel or silica extraction.',
          }}
          cites={[RICE_CITES.sepAero(), RICE_CITES.flow()]}
        >
          {/* Aspirator Trunk */}
          <PartMesh geometry={geoms.aspiratorDuct} position={[-0.2, 0.75, 0]} material="paintGrey" />

          {/* Cyclone Collector */}
          <PartMesh geometry={geoms.cyclone} position={[0.25, 0.85, 0]} material="paintBlue" />
          <PartMesh geometry={geoms.fanHousing} position={[0.25, 2.29, 0]} material="paintGrey" />

          {/* Blower fan (moving) */}
          <group ref={fanRotorRef} position={[0.25, 2.29, 0]}>
            <Part
              id="aspirator-fan"
              name="Centrifugal Exhaust Blower"
              material="castIron"
              role="moving"
              info={{ summary: 'Induced draft fan.', role: 'Generates winnowing airflow up through the husk column.' }}
            >
              <PartMesh geometry={geoms.fanScroll} position={[0, 0, 0]} material="steelDark" />
            </Part>
          </group>

          <PartLabel partId="husk-aspirator" at={[0.25, 2.1, 0]} text="Husk Cyclone" />
        </Part>
      </group>

      {/* ==================== 5. PADDY SEPARATOR ==================== */}
      <group position={[1.25, 0, 0]}>
        <Part
          id="paddy-separator"
          name="Compartment Paddy Separator"
          material="paintGreen"
          role="housing"
          info={{
            summary: 'Oscillating zig-zag inclined compartment separator table.',
            role: 'Separates unhulled rough rice from dehulled brown rice by specific gravity and surface friction.',
            details: 'Unhulled paddy is recycled back to the rubber-roll huller; clean brown rice moves forward to whitening.',
          }}
          cites={[RICE_CITES.flow()]}
        >
          <PartMesh geometry={geoms.sepFrame} position={[0, 0.45, 0]} material="castIron" />

          {/* Oscillating Tray (moving) */}
          <group ref={separatorTrayRef} position={[0, 0.55, 0]}>
            <Part
              id="separator-deck"
              name="Oscillating Compartment Trays"
              material="galvanised"
              role="moving"
              info={{ summary: 'Inclined multi-tray divider deck.', role: 'Bounces lighter unhulled grains upward.' }}
            >
              <PartMesh geometry={geoms.sepTray} position={[0, 0, 0]} />
            </Part>
          </group>

          <PartLabel partId="paddy-separator" at={[0, 1.05, 0]} text="Paddy Separator" />
        </Part>
      </group>

      {/* ==================== 6. WHITENER & POLISHER ==================== */}
      <group position={[2.15, 0, 0]}>
        <Part
          id="polisher"
          name="Abrasive Whitener & Water-Mist Polisher"
          material="paintGreen"
          role="housing"
          info={{
            summary: 'Two-stage milling: abrasive emery roll whitener followed by friction water-mist polisher.',
            role: 'Gently removes outer bran and germ layers (8–10 % of brown rice), then buffs grain surface to translucent sheen.',
            details: 'Rice bran by-product (8–10 %) contains 15–20 % edible oil and high protein.',
          }}
          cites={[RICE_CITES.flow(), RICE_CITES.anatomy()]}
        >
          <PartMesh geometry={geoms.whitenerBase} position={[0, 0.3, 0]} material="castIron" />
          <PartMesh geometry={geoms.polisherHousing} position={[0, 0.95, 0]} material="paintGreen" />

          {/* Hexagonal Perforated Screen Cage */}
          <Part
            id="hex-screen"
            name="Perforated Hexagonal Screen"
            material="steelMatte"
            role="static"
            info={{ summary: 'Perforated milling cylinder.', role: 'Retains grain while allowing detached bran dust to pass out.' }}
          >
            <PartMesh geometry={geoms.hexCage} position={[0, 0.95, 0]} />
          </Part>

          {/* Polisher Rotor (moving) */}
          <group ref={polisherShaftRef} position={[0, 0.95, 0]}>
            <Part
              id="polisher-rotor"
              name="Carborundum Emery Stone Rotor"
              material="ceramic"
              role="moving"
              info={{
                summary: 'High-speed rotating abrasive cylinder.',
                role: 'Scrubs bran coat off grains at 13 m/s peripheral speed with minimal kernel friction heat.',
              }}
            >
              <PartMesh geometry={geoms.polishRotor} position={[0, 0, 0]} />
            </Part>
          </group>

          <PartLabel partId="polisher" at={[0, 1.6, 0]} text="Whitener & Polisher" />
        </Part>
      </group>

      {/* ==================== 7. GRADER & SORTING ==================== */}
      <group position={[3.35, 0, 0]}>
        <Part
          id="grader"
          name="Indented Cylinder Grader (Trieur) & Sifter"
          material="paintGrey"
          role="housing"
          info={{
            summary: 'Length-grading indented cylinder drum and rotary multi-sieve classifier.',
            role: 'Fractionates milled rice by kernel length into 4 commercial grades: Head Rice (≥3/4), Second Heads (1/2–3/4), Screenings (1/4–1/2), and Brewers (<1/4).',
            details: 'Whole head rice stays in bottom of rotating drum; broken grains fit in spherical indents and are lifted to collection trough.',
          }}
          cites={[RICE_CITES.flow(), RICE_CITES.types()]}
        >
          <PartMesh geometry={geoms.trieurStand} position={[0, 0.6, 0]} material="castIron" />

          {/* Rotating Indented Drum (moving) */}
          <group ref={trieurDrumRef} position={[0, 1.0, 0]}>
            <Part
              id="trieur-drum"
              name="Indented Trieur Cylinder Drum"
              material="steel"
              role="moving"
              info={{
                summary: 'Rotating cylinder with thousands of internal hemispherical indents.',
                role: 'Lifts short broken pieces into central trough while full-length head rice slides out axially.',
              }}
            >
              <PartMesh geometry={geoms.trieurDrum} position={[0, 0, 0]} />
            </Part>
          </group>

          {/* 4 Collection Hoppers / Bins */}
          <group position={[0, 0.25, 0]}>
            <Part
              id="bin-head-rice"
              name="Head Rice Discharge Bin (≥ 3/4 length)"
              material="grain"
              role="static"
              info={{ summary: 'Head rice fraction.', role: 'Premium whole-kernel rice (50–65 % yield).' }}
            >
              <PartMesh geometry={geoms.binBox} position={[-0.45, 0, 0.35]} material="paintGreen" />
            </Part>

            <Part
              id="bin-second-heads"
              name="Second Heads Bin (1/2–3/4 length)"
              material="straw"
              role="static"
              info={{ summary: 'Second heads broken fraction.', role: 'Large broken grains used in economy blends or cereals.' }}
            >
              <PartMesh geometry={geoms.binBox} position={[-0.15, 0, 0.35]} material="galvanised" />
            </Part>

            <Part
              id="bin-screenings"
              name="Screenings Bin (1/4–1/2 length)"
              material="straw"
              role="static"
              info={{ summary: 'Screenings broken fraction.', role: 'Medium brokens milled into rice flour.' }}
            >
              <PartMesh geometry={geoms.binBox} position={[0.15, 0, 0.35]} material="galvanised" />
            </Part>

            <Part
              id="bin-brewers"
              name="Brewers Rice Bin (< 1/4 length)"
              material="straw"
              role="static"
              info={{ summary: 'Brewers small broken rice.', role: 'Fine brokens used in beer fermentation brewing.' }}
            >
              <PartMesh geometry={geoms.binBox} position={[0.45, 0, 0.35]} material="galvanised" />
            </Part>
          </group>

          <PartLabel partId="grader" at={[0, 1.6, 0]} text="Length Grader (Trieur)" />
        </Part>
      </group>

      {/* ==================== 8. CONNECTING ELEVATORS & CHUTES ==================== */}
      {/* Elevator 1: Cleaner to Huller/Parboiler */}
      <Part
        id="elevator-1"
        name="Bucket Elevator 1 (Paddy Intake)"
        material="paintGrey"
        role="static"
        info={{ summary: 'Vertical bucket elevator.', role: 'Lifts raw paddy to pre-cleaner.' }}
        cites={[RICE_CITES.conveyors()]}
      >
        <PartMesh geometry={geoms.el1.boot} position={[-3.65, 0.15, 0]} material="castIron" />
        <PartMesh geometry={geoms.el1.leg1} position={[-3.65, 0, 0]} material="galvanised" />
        <PartMesh geometry={geoms.el1.leg2} position={[-3.65, 0, 0]} material="galvanised" />
        <PartMesh geometry={geoms.el1.head} position={[-3.65, 0, 0]} material="paintGrey" />
      </Part>

      {/* Elevator 2: Huller to Whitener */}
      <Part
        id="elevator-2"
        name="Bucket Elevator 2 (Brown Rice)"
        material="paintGrey"
        role="static"
        info={{ summary: 'Brown rice transfer elevator.', role: 'Lifts dehulled brown rice from separator to whitener.' }}
        cites={[RICE_CITES.conveyors()]}
      >
        <PartMesh geometry={geoms.el2.boot} position={[1.75, 0.15, 0]} material="castIron" />
        <PartMesh geometry={geoms.el2.leg1} position={[1.75, 0, 0]} material="galvanised" />
        <PartMesh geometry={geoms.el2.leg2} position={[1.75, 0, 0]} material="galvanised" />
        <PartMesh geometry={geoms.el2.head} position={[1.75, 0, 0]} material="paintGrey" />
      </Part>

      {/* ==================== 9. FLOW PARTICLE STREAMS ==================== */}
      {/* Raw Paddy Inflow */}
      <Flow
        curve={curves.p1}
        count={50}
        radius={0.007}
        color="#d6b25e"
        speed={1.5}
        intensity={() => (params.paddyFeedRate > 0 ? 1 : 0)}
      />

      {/* Parboiled Paddy stream (active in parboiled route) */}
      <Flow
        curve={params.route === 'parboiled' ? curves.parboilPath : curves.rawBypassPath}
        count={65}
        radius={0.007}
        color={params.route === 'parboiled' ? '#c49a45' : '#d6b25e'}
        speed={1.2}
        intensity={() => (params.paddyFeedRate > 0 ? 1 : 0)}
      />

      {/* Husk stream lifting into cyclone */}
      <Flow
        curve={curves.huskLiftPath}
        count={45}
        radius={0.006}
        color="#dfc588"
        speed={2.2}
        spread={0.012}
        intensity={() => (params.paddyFeedRate > 0 ? 0.9 : 0)}
      />

      {/* Brown rice stream to separator */}
      <Flow
        curve={curves.brownRicePath}
        count={50}
        radius={0.006}
        color="#b08b59"
        speed={1.4}
        intensity={() => (params.paddyFeedRate > 0 ? 1 : 0)}
      />

      {/* White polished rice to grader */}
      <Flow
        curve={curves.whiteRicePath}
        count={50}
        radius={0.006}
        color="#f4f1ea"
        speed={1.5}
        intensity={() => (params.paddyFeedRate > 0 ? 1 : 0)}
      />

      {/* Graded head rice exit */}
      <Flow
        curve={curves.headRiceOut}
        count={40}
        radius={0.006}
        color="#ffffff"
        speed={1.2}
        intensity={() => (analysis.headRice > 0 ? 1 : 0)}
      />
    </group>
  )
}
