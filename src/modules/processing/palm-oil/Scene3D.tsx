import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { Flow } from '@/render/Flow'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { P504 } from './cites'
import {
  biomassBoiler,
  bunchCage,
  centrifugePurifier,
  clarifierLiquidLayers,
  clarifierTank,
  depericarperColumn,
  digesterBeaterShaft,
  digesterVessel,
  ffbClusters,
  nutPolishingDrum,
  pressHydraulicCone,
  pressScrewShaft,
  pressStrainerCage,
  railTracks,
  steriliserDoor,
  steriliserRings,
  steriliserVessel,
  thresherCasing,
  thresherDrum,
  vacuumDryer,
} from '@/parts/lib/processing'
import { storageTank } from '@/parts/lib/water'
import { calculateMillPerformance, live, usePalmOil } from './model'

const { sin, PI } = Math
const V3 = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)

const C = {
  mill: [P504.cpo('Pictorial flow sheet'), P504.pomb('Mass balance 1000 kg FFB')],
  steriliser: [P504.cpo('Horizontal steriliser cylinders'), P504.pq('p1 Q1 Sterilisation')],
  thresher: [P504.cpo('Rotary drum thresher'), P504.pomb('Empty bunch split 234 kg')],
  digester: [P504.cpo('Vertical digester with rotating arms'), P504.t23('Digestion comparison')],
  press: [P504.cpo('Continuous screw press'), P504.sep('Separation nodes'), P504.pomb('Liquid/solid press split')],
  clarifier: [P504.cpo('Clarification tank & centrifuge'), P504.sep('Centrifugation eq 18'), P504.pq('p5 Q v Stokes settling')],
  depericarper: [P504.cpo('Depericarper & nut cracking'), P504.pomb('Fibre 180 kg & Shell 73 kg to boiler')],
}

const INFO = {
  steriliser: {
    summary: 'Horizontal autoclave steriliser (130–145 °C steam, ~3 bar).',
    role: 'Arrests lipolytic enzyme activity (preventing Free Fatty Acid rise), loosens fruits from stalks, softens mesocarp for digestion, coagulates mucilage, and preconditions nuts.',
    details: 'Sterilises whole Fresh Fruit Bunches (FFB) loaded in perforated rail cages for 60–90 min.',
  },
  bunchCages: {
    summary: 'Perforated steel FFB bunch cages on rail tracks.',
    role: 'Transport 1000 kg FFB charges into the pressure vessel; perforations allow steam circulation and condensate drainage.',
  },
  thresher: {
    summary: 'Rotary drum stripper (slotted squirrel-cage drum, 20–25 rpm).',
    role: 'Tumbles sterilised bunches; impact detaches loose fruits through drum slots (666 kg/t FFB) while empty fruit bunches (EFB, 234 kg/t FFB) discharge at the end to plantation mulch/fertiliser.',
  },
  digester: {
    summary: 'Vertical cylindrical steam-jacketed digester (90–95 °C).',
    role: 'Steam heating and maceration: breaks open oleiferous mesocarp cells, mashes fruit into homogeneous pulp, and detaches pericarp from nuts without breaking the inner nut shell.',
  },
  beaters: {
    summary: 'Central rotating shaft with pairs of cross beater arms.',
    role: 'Revolving at 22–26 rpm, the heavy forged arms shear and pulp the heated fruit mash against stationary counter-baffles.',
  },
  pressCage: {
    summary: 'Perforated strainer cage barrel (cutaway).',
    role: 'Heavy cast alloy cage plates with longitudinal drainage gaps where expressed crude oil liquor escapes while retaining solid fibres and nuts.',
  },
  pressScrew: {
    summary: 'Continuous tapered screw press shaft.',
    role: 'Helical flight with progressive decreasing pitch and increasing core diameter creates a 3.5 : 1 compression ratio, generating intense squeezing pressure.',
  },
  hydraulicCone: {
    summary: 'Hydraulically adjusted backpressure choke cone.',
    role: 'Restricts the annular press cake discharge orifice (40–60 bar); regulates pressure nip for maximum oil extraction while avoiding palm nut breakage.',
  },
  clarifier: {
    summary: 'Continuous gravity settling / clarification tank (85–90 °C).',
    role: 'Density separation: pure crude palm oil (900 kg/m³) rises to the surface; heavy sludge, sand, and cell debris settle to the conical bottom.',
  },
  centrifuge: {
    summary: 'High-speed disk bowl centrifugal purifier (5000–6000 rpm).',
    role: 'Generates thousands of g-forces (S = rω²/g > 4000); forces fine 50 µm oil globules out of water and dirt emulsion per Stokes centrifuge eq 18.',
  },
  vacuumDryer: {
    summary: 'Vacuum flash moisture dryer (0.05 bar absolute).',
    role: 'Flashes off residual moisture from 0.5% down to < 0.1% before storage, preventing enzymatic and hydrolytic spoilage.',
  },
  depericarper: {
    summary: 'Pneumatic winnower column and fibre cyclone.',
    role: 'Uses terminal velocity differences (fibre ~2.8 m/s vs nuts ~11.5 m/s) to lift mesocarp fibres up to the cyclone for boiler fuel, while clean nuts drop down.',
  },
  nutDrum: {
    summary: 'Rotary nut polishing drum.',
    role: 'Revolving slotted drum polishes adhering fibres off nut shells before drying and nut cracking.',
  },
  boiler: {
    summary: 'Biomass co-generation water-tube boiler.',
    role: 'Fired 100% by mill by-products: 180 kg fibre + 73 kg shell per tonne FFB generate all process steam and electricity via turbo-alternator (self-sufficient mill!).',
  },
  cpoTank: {
    summary: 'Crude Palm Oil (CPO) bulk storage tank.',
    role: 'Stores finished purified CPO (225 kg / 1000 kg FFB, 22.5% OER) at 45–50 °C prior to road tanker transport or export.',
  },
}

export function PalmOil3D() {
  const p = usePalmOil()
  const perf = useMemo(() => calculateMillPerformance(p), [p])

  // Refs for animated moving parts
  const cageRef = useRef<THREE.Group>(null)
  const thresherDrumRef = useRef<THREE.Group>(null)
  const digesterShaftRef = useRef<THREE.Group>(null)
  const pressScrewRef = useRef<THREE.Group>(null)
  const coneRef = useRef<THREE.Group>(null)
  const centrifugeBowlRef = useRef<THREE.Group>(null)
  const nutDrumRef = useRef<THREE.Group>(null)

  // Geometries memoized
  const geo = useMemo(() => {
    return {
      steriliser: steriliserVessel(3.8, 0.9, 0.05),
      steriliserRings: steriliserRings(3.8, 0.9),
      door: steriliserDoor(0.9),
      rails: railTracks(6.2, 0.8),
      cage: bunchCage(1.4, 0.95, 0.72, 0.8),
      ffb: ffbClusters(1.3, 0.75, 0.65),
      thresherDrum: thresherDrum(2.4, 0.72, 16),
      thresherCasing: thresherCasing(2.6, 0.78),
      digesterVessel: digesterVessel(2.3, 0.62, 0.04),
      beaters: digesterBeaterShaft(2.1, 0.50),
      pressCage: pressStrainerCage(1.8, 0.28, 0.20),
      pressScrew: pressScrewShaft(1.8, 0.38),
      cone: pressHydraulicCone(0.19, 0.35),
      clarifierTank: clarifierTank(2.5, 0.92, 0.04),
      clarifierLayers: clarifierLiquidLayers(0.88, 1.5),
      centrifuge: centrifugePurifier(0.42, 0.85),
      vacuumDryer: vacuumDryer(0.52, 1.5),
      depericarper: depericarperColumn(3.4, 0.52, 0.42),
      nutDrum: nutPolishingDrum(1.9, 0.38),
      boiler: biomassBoiler(1.8, 2.3, 1.5),
      cpoTank: storageTank({ r: 1.15, h: 2.1 }),
    }
  }, [])

  // Flow curves for process streams
  const curves = useMemo(() => {
    // 1. Steam to steriliser
    const steamSter = new THREE.CatmullRomCurve3([
      V3(-5.2, 2.8, -0.8),
      V3(-5.2, 2.2, -0.8),
      V3(-5.2, 1.6, -0.8),
    ])
    // 2. Threshed fruit elevator to digester
    const fruitElev = new THREE.CatmullRomCurve3([
      V3(-2.0, 0.3, -0.8),
      V3(-1.4, 1.4, 0.0),
      V3(-0.8, 2.8, 0.8),
    ])
    // 3. Digested fruit mash down into screw press
    const mashFeed = new THREE.CatmullRomCurve3([
      V3(-0.8, 1.6, 0.8),
      V3(-0.8, 1.1, 0.8),
      V3(-0.8, 0.8, 0.8),
    ])
    // 4. Expressed crude palm oil liquor draining from press cage into sump
    const oilPress = new THREE.CatmullRomCurve3([
      V3(-0.8, 0.55, 0.8),
      V3(-0.8, 0.35, 0.8),
      V3(-0.8, 0.20, 0.8),
    ])
    // 5. Crude oil pipe to clarification tank
    const cpoPipe = new THREE.CatmullRomCurve3([
      V3(-0.6, 0.2, 0.8),
      V3(-0.7, 0.3, -0.3),
      V3(-0.8, 2.4, -1.4),
    ])
    // 6. Clarified oil skimmer stream to centrifuge & vacuum dryer
    const cleanOilPipe = new THREE.CatmullRomCurve3([
      V3(-0.4, 2.2, -1.4),
      V3(0.2, 1.2, -1.4),
      V3(0.8, 1.0, -1.4),
      V3(1.5, 0.8, -1.4),
      V3(2.0, 1.4, -1.4),
      V3(2.8, 0.5, -1.4),
      V3(3.4, 2.0, -1.4),
    ])
    // 7. Press cake moving from screw press into depericarper
    const cakeFeed = new THREE.CatmullRomCurve3([
      V3(0.1, 0.6, 0.8),
      V3(0.6, 0.5, 0.8),
      V3(1.2, 0.7, 0.8),
    ])
    // 8. Mesocarp fibres lifted aerodynamically up depericarper column to boiler
    const fibreAir = new THREE.CatmullRomCurve3([
      V3(1.5, 0.8, 0.8),
      V3(1.5, 2.2, 0.8),
      V3(1.5, 3.2, 0.8),
      V3(2.3, 2.6, 0.8),
      V3(3.2, 2.0, 0.8),
    ])
    // 9. Dense nuts dropping through winnower into nut polishing drum
    const nutDrop = new THREE.CatmullRomCurve3([
      V3(1.5, 0.8, 0.8),
      V3(1.5, 0.4, 0.8),
      V3(1.5, 0.1, 0.8),
    ])
    // 10. Sludge underflow discharge from clarifier tank
    const sludgeDrain = new THREE.CatmullRomCurve3([
      V3(-0.8, 0.3, -1.4),
      V3(-0.8, 0.05, -1.4),
      V3(-0.4, 0.05, -1.4),
    ])
    return {
      steamSter,
      fruitElev,
      mashFeed,
      oilPress,
      cpoPipe,
      cleanOilPipe,
      cakeFeed,
      fibreAir,
      nutDrop,
      sludgeDrain,
    }
  }, [])

  // Animation frame loop
  useSimFrame((dt, t) => {
    live.time = t
    // 1. Thresher drum rotation
    const thresherOmega = (2 * PI * 22) / 60
    if (thresherDrumRef.current) {
      thresherDrumRef.current.rotation.x += dt * thresherOmega
    }
    // 2. Digester beater shaft rotation
    const digesterOmega = (2 * PI * p.digesterSpeed) / 60
    if (digesterShaftRef.current) {
      digesterShaftRef.current.rotation.y += dt * digesterOmega
    }
    // 3. Screw press shaft rotation
    const pressOmega = (2 * PI * p.pressRpm) / 60
    if (pressScrewRef.current) {
      pressScrewRef.current.rotation.x += dt * pressOmega
    }
    // 4. Hydraulic choke cone displacement:
    // Moves axially based on cone pressure (higher pressure pushes cone deeper in)
    const coneTargetX = 0.04 - (p.conePressure / 80) * 0.06 + sin(t * 3) * 0.004
    if (coneRef.current) {
      coneRef.current.position.x = coneTargetX
    }
    // 5. Centrifuge bowl high-speed rotation
    const centOmega = (2 * PI * p.centrifugeRpm) / 60
    if (centrifugeBowlRef.current) {
      centrifugeBowlRef.current.rotation.y += dt * centOmega * 0.1 // visually scaled
    }
    // 6. Nut polishing drum rotation
    if (nutDrumRef.current) {
      nutDrumRef.current.rotation.x += dt * (2 * PI * 18) / 60
    }
    // 7. Shuttling bunch cage on rails
    if (cageRef.current) {
      const cageX = -5.2 + sin(t * 0.4) * 0.45
      cageRef.current.position.x = cageX
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* ----------------- 1. STERILISATION STATION ----------------- */}
      <group position={[-5.2, 0.95, -0.8]}>
        <Part
          id="steriliser"
          name="Steriliser autoclave vessel"
          material="steelDark"
          role="housing"
          info={INFO.steriliser}
          cites={C.steriliser}
        >
          <PartMesh geometry={geo.steriliser} />
          <PartMesh geometry={geo.steriliserRings} material="castIron" />
          {/* Front hinged autoclave door (partially swung open) */}
          <group position={[1.9, 0, 0]} rotation={[0, 0.35, 0]}>
            <PartMesh geometry={geo.door} material="castIron" />
          </group>
          <PartLabel partId="steriliser" at={[0, 1.1, 0]} text="Steriliser (135 °C)" />
        </Part>

        {/* Rail tracks along floor */}
        <group position={[0, -0.92, 0]}>
          <PartMesh geometry={geo.rails} material="steelDark" />
        </group>

        {/* Wheeled bunch cage with Fresh Fruit Bunches (FFB) */}
        <group ref={cageRef} position={[0, -0.82, 0]}>
          <Part
            id="bunch-cages"
            name="FFB bunch cage on rails"
            material="galvanised"
            role="moving"
            info={INFO.bunchCages}
            cites={C.steriliser}
          >
            <PartMesh geometry={geo.cage} />
            <PartMesh geometry={geo.ffb} material="crop" />
            <PartLabel partId="bunch-cages" at={[0, 0.9, 0]} text="1000 kg FFB Cage" />
          </Part>
        </group>
      </group>

      {/* ----------------- 2. THRESHING STATION ----------------- */}
      <group position={[-2.8, 1.25, -0.8]}>
        <Part
          id="thresher"
          name="Rotary drum thresher"
          material="castIron"
          role="housing"
          info={INFO.thresher}
          cites={C.thresher}
        >
          <PartMesh geometry={geo.thresherCasing} material="paintGrey" />
          {/* Rotating squirrel-cage drum */}
          <group ref={thresherDrumRef}>
            <PartMesh geometry={geo.thresherDrum} material="steelMatte" />
          </group>
          <PartLabel partId="thresher" at={[0, 0.95, 0]} text="Thresher (Stripper)" />
        </Part>
      </group>

      {/* ----------------- 3. DIGESTION STATION ----------------- */}
      <group position={[-0.8, 1.65, 0.8]}>
        <Part
          id="digester"
          name="Steam-jacketed digester vessel"
          material="paintGreen"
          role="housing"
          info={INFO.digester}
          cites={C.digester}
        >
          <PartMesh geometry={geo.digesterVessel} />
          {/* Rotating central shaft with cross beater arms */}
          <group ref={digesterShaftRef}>
            <Part
              id="beaters"
              name="Digester beater arms"
              material="steel"
              role="moving"
              info={INFO.beaters}
              cites={C.digester}
            >
              <PartMesh geometry={geo.beaters} />
            </Part>
          </group>
          <PartLabel partId="digester" at={[0, 1.8, 0]} text="Digester (92 °C)" />
        </Part>
      </group>

      {/* ----------------- 4. SCREW PRESS STATION (CUTAWAY HIGHLIGHT) ----------------- */}
      <group position={[-0.8, 0.55, 0.8]}>
        <Part
          id="press-cage"
          name="Screw press strainer barrel (cutaway)"
          material="castIron"
          role="housing"
          info={INFO.pressCage}
          cites={C.press}
        >
          <PartMesh geometry={geo.pressCage} />
          <PartLabel partId="press-cage" at={[0, 0.45, 0]} text="Screw Press Cutaway" />
        </Part>

        {/* Tapered press screw */}
        <group ref={pressScrewRef}>
          <Part
            id="press-screw"
            name="Tapered continuous press screw"
            material="steelDark"
            role="moving"
            info={INFO.pressScrew}
            cites={C.press}
          >
            <PartMesh geometry={geo.pressScrew} />
          </Part>
        </group>

        {/* Hydraulic backpressure cone */}
        <group ref={coneRef} position={[0, 0, 0]}>
          <Part
            id="hydraulic-cone"
            name="Hydraulic choke cone"
            material="steel"
            role="moving"
            info={INFO.hydraulicCone}
            cites={C.press}
          >
            <PartMesh geometry={geo.cone} />
            <PartLabel partId="hydraulic-cone" at={[0.45, 0.25, 0]} text="Hydraulic Cone (50 bar)" />
          </Part>
        </group>
      </group>

      {/* ----------------- 5. CLARIFICATION & PURIFICATION STATION ----------------- */}
      <group position={[-0.8, 1.05, -1.4]}>
        <Part
          id="clarifier"
          name="Continuous settling tank (Clarifier)"
          material="paintOrange"
          role="housing"
          info={INFO.clarifier}
          cites={C.clarifier}
        >
          <PartMesh geometry={geo.clarifierTank} />
          {/* Fluid layers inside cutaway clarifier */}
          <PartMesh geometry={geo.clarifierLayers.oil} material="oil" />
          <PartMesh geometry={geo.clarifierLayers.emulsion} material="water" />
          <PartMesh geometry={geo.clarifierLayers.sludge} material="oil" />
          <PartLabel partId="clarifier" at={[0, 1.6, 0]} text="Clarifier Tank" />
        </Part>
      </group>

      {/* Centrifugal purifier */}
      <group position={[0.8, 0.55, -1.4]}>
        <Part
          id="centrifuge"
          name="Centrifugal purifier (Purifier)"
          material="steel"
          role="housing"
          info={INFO.centrifuge}
          cites={C.clarifier}
        >
          <group ref={centrifugeBowlRef}>
            <PartMesh geometry={geo.centrifuge} />
          </group>
          <PartLabel partId="centrifuge" at={[0, 0.7, 0]} text="Centrifuge (5000 rpm)" />
        </Part>
      </group>

      {/* Vacuum moisture dryer */}
      <group position={[2.0, 0.65, -1.4]}>
        <Part
          id="vacuum-dryer"
          name="Vacuum moisture dryer"
          material="galvanised"
          role="housing"
          info={INFO.vacuumDryer}
          cites={C.clarifier}
        >
          <PartMesh geometry={geo.vacuumDryer} />
          <PartLabel partId="vacuum-dryer" at={[0, 1.1, 0]} text="Vacuum Dryer" />
        </Part>
      </group>

      {/* Final Crude Palm Oil Bulk Tank */}
      <group position={[3.6, 1.05, -1.4]}>
        <Part
          id="cpo-tank"
          name="Crude Palm Oil storage tank"
          material="paintYellow"
          role="housing"
          info={INFO.cpoTank}
          cites={C.mill}
        >
          <PartMesh geometry={geo.cpoTank} />
          <PartLabel partId="cpo-tank" at={[0, 1.4, 0]} text="CPO Storage (225 kg)" />
        </Part>
      </group>

      {/* ----------------- 6. DEPERICARPER & BOILER STATION ----------------- */}
      <group position={[1.5, 0.05, 0.8]}>
        <Part
          id="depericarper"
          name="Depericarper air column & fibre cyclone"
          material="paintGrey"
          role="housing"
          info={INFO.depericarper}
          cites={C.depericarper}
        >
          <PartMesh geometry={geo.depericarper} />
          <PartLabel partId="depericarper" at={[0, 2.6, 0]} text="Depericarper (Air Column)" />
        </Part>

        {/* Nut polishing drum underneath */}
        <group position={[0, 0.35, 0]} ref={nutDrumRef}>
          <Part
            id="nut-drum"
            name="Nut polishing drum"
            material="steelMatte"
            role="moving"
            info={INFO.nutDrum}
            cites={C.depericarper}
          >
            <PartMesh geometry={geo.nutDrum} />
            <PartLabel partId="nut-drum" at={[0, -0.25, 0]} text="Nut Polishing Drum" />
          </Part>
        </group>
      </group>

      {/* Biomass co-generation boiler */}
      <group position={[3.2, 1.15, 0.8]}>
        <Part
          id="boiler"
          name="Biomass co-generation boiler"
          material="castIron"
          role="housing"
          info={INFO.boiler}
          cites={C.depericarper}
        >
          <PartMesh geometry={geo.boiler} />
          <PartLabel partId="boiler" at={[0, 1.8, 0]} text="Biomass Boiler (Fibre+Shell)" />
        </Part>
      </group>

      {/* ----------------- FLOW PARTICLE STREAMS ----------------- */}
      {/* 1. Steam to steriliser */}
      <Flow
        curve={curves.steamSter}
        count={35}
        radius={0.018}
        color="#c8e4f8"
        intensity={() => 0.85}
        speed={1.2}
      />
      {/* 2. Loose fruits into digester */}
      <Flow
        curve={curves.fruitElev}
        count={45}
        radius={0.024}
        color="#d04820"
        intensity={() => 0.9}
        speed={0.8}
      />
      {/* 3. Hot fruit mash into screw press */}
      <Flow
        curve={curves.mashFeed}
        count={30}
        radius={0.028}
        color="#b03418"
        intensity={() => 0.95}
        speed={1.0}
      />
      {/* 4. Expressed crude oil liquor showering from press */}
      <Flow
        curve={curves.oilPress}
        count={50}
        radius={0.016}
        color="#e08418"
        intensity={() => (p.conePressure > 30 ? 1.0 : 0.6)}
        speed={1.5}
      />
      {/* 5. CPO liquor to clarifier */}
      <Flow
        curve={curves.cpoPipe}
        count={40}
        radius={0.015}
        color="#d47c16"
        intensity={() => 0.9}
        speed={1.1}
      />
      {/* 6. Pure golden palm oil from clarifier to centrifuge and storage */}
      <Flow
        curve={curves.cleanOilPipe}
        count={65}
        radius={0.014}
        color="#f29e1c"
        intensity={() => 1.0}
        speed={1.3}
      />
      {/* 7. Solid press cake extruded into depericarper */}
      <Flow
        curve={curves.cakeFeed}
        count={40}
        radius={0.022}
        color="#8c5832"
        intensity={() => 0.85}
        speed={0.7}
      />
      {/* 8. Mesocarp fibres lifted aerodynamically to cyclone and boiler */}
      <Flow
        curve={curves.fibreAir}
        count={50}
        radius={0.016}
        color="#c8a452"
        intensity={() => (perf.fibreLiftPct > 20 ? 0.95 : 0.2)}
        speed={1.8}
      />
      {/* 9. Polished nuts dropping down */}
      <Flow
        curve={curves.nutDrop}
        count={25}
        radius={0.022}
        color="#5a3822"
        intensity={() => (perf.nutDropPurityPct > 50 ? 0.8 : 0.3)}
        speed={1.0}
      />
      {/* 10. Sludge effluent discharge from clarifier bottom */}
      <Flow
        curve={curves.sludgeDrain}
        count={30}
        radius={0.016}
        color="#62422c"
        intensity={() => 0.75}
        speed={0.8}
      />
    </group>
  )
}
