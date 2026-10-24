import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { P536 } from './cites'
import {
  buildBlancherGeom,
  buildColdStoreGeom,
  buildPackagingGeom,
  buildRetortGeom,
  buildStorageGeom,
} from './geom'
import { usePreservation } from './model'

/* ---------------------- Station Subcomponents ---------------------- */

/** 1. Blancher: Steam tunnel vs hot-water bath with conveyor and manifolds. */
function BlancherStation({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const geom = useMemo(() => buildBlancherGeom(), [])
  const blancherType = usePreservation((s) => s.blancherType)
  const foodRef = useRef<THREE.Group>(null)

  useSimFrame((dt) => {
    if (foodRef.current) {
      foodRef.current.position.z = (foodRef.current.position.z + dt * 0.25) % 0.24
    }
  })

  // Vegetable color varies: brighter green with alkaline additive (Na2CO3/CaO), duller without

  return (
    <group position={offset}>
      <Part
        id="blancher-assembly"
        name="Blancher System"
        role="housing"
        cites={[P536.n536('Blanching'), P536.n536('Enzyme inactivation')]}
      >
        <Part
          id="blancher-hood"
          name="Insulated Steam Hood"
          material="aluminium"
          role="housing"
        >
          <PartMesh geometry={geom.hood} />
          <PartMesh geometry={geom.stacks} material="steel" />
        </Part>

        <Part
          id="blancher-tank"
          name="Hot Water Bath Tank"
          material="steelMatte"
          role="static"
        >
          <PartMesh geometry={geom.tank} />
          {blancherType === 'water' ? (
            <PartMesh geometry={geom.waterVolume} material="water" position={[0, 0.77, 0]} />
          ) : null}
        </Part>

        <Part
          id="blancher-frame"
          name="Support Leg Frame"
          material="paintGrey"
          role="static"
        >
          <PartMesh geometry={geom.frameLegs} />
          <PartMesh geometry={geom.endRollers} material="steel" />
        </Part>

        <Part
          id="blancher-belt"
          name="Perforated Mesh Conveyor"
          material="galvanised"
          role="moving"
        >
          <PartMesh geometry={geom.beltMesh} position={[0, 0.95, 0]} />
        </Part>

        <Part
          id="blancher-steam"
          name="Steam Spray Nozzles & Manifolds"
          material="brass"
          role="fluid"
        >
          <PartMesh geometry={geom.steamManifolds} />
        </Part>

        <Part
          id="blancher-food"
          name="Vegetables on Conveyor"
          material="crop"
          role="moving"
        >
          <group ref={foodRef}>
            <PartMesh geometry={geom.foodVegetables} />
          </group>
        </Part>
      </Part>

      <PartLabel partId="blancher-hood" at={[0, 1.7, 0]} />
      <PartLabel partId="blancher-steam" at={[0, 1.35, 0.4]} />
      <PartLabel partId="blancher-belt" at={[0, 1.02, 1.2]} />
      <PartLabel partId="blancher-tank" at={[0, 0.7, 0]} />
    </group>
  )
}

/** 2. Retort / Autoclave: Pressure steriliser with can crate and cold point probe. */
function RetortStation({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const geom = useMemo(() => buildRetortGeom(), [])
  const canAgitation = usePreservation((s) => s.canAgitation)
  const basketRef = useRef<THREE.Group>(null)

  useSimFrame((dt) => {
    if (basketRef.current && canAgitation) {
      basketRef.current.rotation.z += dt * 1.5
    }
  })

  return (
    <group position={offset}>
      <Part
        id="retort-assembly"
        name="Canning Retort Autoclave"
        role="housing"
        cites={[P536.n536('Thermal death time'), P536.n536('D and z values'), P536.n536('12D Cook')]}
      >
        <Part
          id="retort-vessel"
          name="Pressure Vessel Shell"
          material="paintBlue"
          role="housing"
        >
          <PartMesh geometry={geom.shell} />
          <PartMesh geometry={geom.rearDome} material="paintBlue" />
        </Part>

        <Part
          id="retort-door"
          name="Locking Autoclave Door"
          material="steelDark"
          role="moving"
        >
          <PartMesh geometry={geom.doorAssembly} />
          <PartMesh geometry={geom.lockingLugs} material="steel" />
          <PartMesh geometry={geom.handwheel} material="paintRed" />
        </Part>

        <Part
          id="retort-saddles"
          name="Saddle Cradles"
          material="castIron"
          role="static"
        >
          <PartMesh geometry={geom.saddles} />
          <PartMesh geometry={geom.fittings} material="brass" />
        </Part>

        <Part
          id="retort-basket"
          name="Can Basket & Cans"
          material="galvanised"
          role="moving"
        >
          <group ref={basketRef} position={[0, 0, 0]}>
            <PartMesh geometry={geom.basketFrame} />
            <PartMesh geometry={geom.canStack} material="aluminium" />
          </group>
        </Part>

        {/* Featured Cutaway Inspection Can placed in front */}
        <Part
          id="retort-inspect-can"
          name="Cold-Point Cutaway Can"
          material="steel"
          role="static"
        >
          <group position={[0.75, 0.9, 0.8]}>
            <PartMesh geometry={geom.inspectCanBody} material="chrome" />
            <PartMesh geometry={geom.inspectCanFood} material="friction" />
            <PartMesh geometry={geom.thermocoupleAssembly} material="copper" />
          </group>
        </Part>
      </Part>

      <PartLabel partId="retort-vessel" at={[0, 1.7, -0.4]} />
      <PartLabel partId="retort-door" at={[0, 1.7, 0.9]} />
      <PartLabel partId="retort-basket" at={[0, 1.1, 0]} />
      <PartLabel partId="retort-inspect-can" at={[0.75, 1.1, 0.8]} text="Cold Point Can" />
    </group>
  )
}

/** 3. Cold Store & Blast Freezer: Room panels, evaporators, blast duct, freezing front. */
function ColdStoreStation({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const geom = useMemo(() => buildColdStoreGeom(), [])
  const fanRef = useRef<THREE.Group>(null)

  useSimFrame((dt) => {
    if (fanRef.current) {
      fanRef.current.rotation.z += dt * 12.0
    }
  })

  return (
    <group position={offset}>
      <Part
        id="coldstore-assembly"
        name="Cold Store & Blast Tunnel"
        role="housing"
        cites={[P536.n536('Refrigeration cooling load'), P536.n536('Plank freezing equation')]}
      >
        <Part
          id="coldstore-room"
          name="Insulated Room Envelope"
          material="paintGrey"
          role="housing"
        >
          <PartMesh geometry={geom.roomEnvelope} />
          <PartMesh
            geometry={geom.coldDoor}
            material="paintGrey"
            position={[-0.8, 0.88, 1.15]}
            rotation={[0, 0.7, 0]}
          />
        </Part>

        <Part
          id="coldstore-evap"
          name="Ceiling Evaporator Unit"
          material="aluminium"
          role="static"
        >
          <PartMesh geometry={geom.evapAssembly} />
        </Part>

        <Part
          id="coldstore-blast"
          name="Air Blast Freezer Tunnel"
          material="paintBlue"
          role="housing"
        >
          <PartMesh geometry={geom.blastDuct} />
        </Part>

        <Part
          id="coldstore-pallets"
          name="Stored Meat Pallet"
          material="wood"
          role="static"
        >
          <PartMesh geometry={geom.palletSlats} />
          <PartMesh geometry={geom.meatBoxes} material="friction" />
        </Part>

        {/* Plank Freezing Sphere on inspection stand */}
        <Part
          id="coldstore-sphere"
          name="Plank Freezing Sphere (7 cm)"
          material="coolant"
          role="static"
        >
          <group position={[0.6, 0.7, 0.2]}>
            <PartMesh geometry={geom.sphereOuter} material="coolant" />
            <PartMesh geometry={geom.sphereCore} material="crop" />
          </group>
        </Part>

        <Part
          id="coldstore-condenser"
          name="Refrigeration Condenser Unit"
          material="castIron"
          role="static"
        >
          <PartMesh geometry={geom.condUnit} />
        </Part>
      </Part>

      <PartLabel partId="coldstore-room" at={[0, 2.1, 0]} />
      <PartLabel partId="coldstore-evap" at={[0, 1.8, -0.6]} />
      <PartLabel partId="coldstore-blast" at={[0.6, 1.25, 0.2]} text="Blast Tunnel" />
      <PartLabel partId="coldstore-sphere" at={[0.6, 0.9, 0.2]} text="Plank 7cm Sphere" />
      <PartLabel partId="coldstore-condenser" at={[1.6, 0.8, 0]} />
    </group>
  )
}

/** 4. Storage Structures: Traditional Nigerian yam barn & modern grain silo with aeration. */
function StorageStation({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const geom = useMemo(() => buildStorageGeom(), [])

  return (
    <group position={offset}>
      <Part
        id="storage-assembly"
        name="Storage Structures & Hermetic Bags"
        role="housing"
        cites={[P536.n536('Yam storage'), P536.n536('Grain storage'), P536.pack('Hermetic storage')]}
      >
        {/* Yam Barn */}
        <group position={[-1.2, 0, 0]}>
          <Part
            id="yam-barn-frame"
            name="Yam Barn Poles & Thatch"
            material="wood"
            role="static"
          >
            <PartMesh geometry={geom.yamBarn.poles} />
            <PartMesh geometry={geom.yamBarn.braceRails} />
            <PartMesh geometry={geom.yamBarn.thatchRoof} material="straw" />
          </Part>

          <Part
            id="yam-barn-tubers"
            name="Horizontally Tied Tubers"
            material="wood"
            role="static"
          >
            <PartMesh geometry={geom.yamBarn.tubers} material="wood" />
            <PartMesh geometry={geom.yamBarn.ties} material="rubber" />
          </Part>
        </group>

        {/* Grain Silo */}
        <group position={[1.3, 0, 0]}>
          <Part
            id="grain-silo-body"
            name="Galvanised Corrugated Silo"
            material="galvanised"
            role="housing"
          >
            <PartMesh geometry={geom.silo.siloWall} />
            <PartMesh geometry={geom.silo.corrugations} />
            <PartMesh geometry={geom.silo.siloRoof} />
            <PartMesh geometry={geom.silo.roofVent} material="steel" />
            <PartMesh geometry={geom.silo.siloHopper} material="steelMatte" />
            <PartMesh geometry={geom.silo.siloLegs} material="paintGrey" />
            <PartMesh geometry={geom.silo.aerationSystem} material="paintGreen" />
          </Part>
        </group>

        {/* PICS Hermetic Triple Bag cutaway */}
        <group position={[0.0, 0, 1.1]}>
          <Part
            id="triple-bag-hermetic"
            name="PICS Triple-Bag Hermetic Pack"
            material="paintYellow"
            role="static"
          >
            <PartMesh geometry={geom.tripleBag.outerBag} material="paintYellow" />
            <PartMesh geometry={geom.tripleBag.middleLiner} material="plastic" />
            <PartMesh geometry={geom.tripleBag.innerLiner} material="glass" />
            <PartMesh geometry={geom.tripleBag.bagTie} material="rubber" />
          </Part>
        </group>
      </Part>

      <PartLabel partId="yam-barn-frame" at={[-1.2, 3.0, 0]} text="Traditional Yam Barn" />
      <PartLabel partId="yam-barn-tubers" at={[-1.2, 1.4, 0.4]} text="Tied Yams (0.5m grid)" />
      <PartLabel partId="grain-silo-body" at={[1.3, 2.7, 0]} text="Aerated Grain Silo" />
      <PartLabel partId="triple-bag-hermetic" at={[0.0, 0.8, 1.1]} text="PICS Triple-Bag" />
    </group>
  )
}

/** 5. Packaging Line & Detailed Barrier Containers. */
function PackagingStation({ offset = [0, 0, 0] }: { offset?: [number, number, number] }) {
  const geom = useMemo(() => buildPackagingGeom(), [])

  return (
    <group position={offset}>
      <Part
        id="packaging-assembly"
        name="Packaging Line & Containers"
        role="housing"
        cites={[P536.pack('Packaging functions'), P536.pack('Materials'), P536.prac('Survey')]}
      >
        <Part
          id="pack-table"
          name="Conveyor Packaging Line"
          material="paintGrey"
          role="static"
        >
          <PartMesh geometry={geom.table} />
          <PartMesh geometry={geom.fillingNozzle} material="steel" />
          <PartMesh geometry={geom.seamerHead} material="castIron" />
          <PartMesh geometry={geom.coderHead} material="paintRed" />
        </Part>

        {/* Containers on line */}
        <Part
          id="pack-can"
          name="Tinplate Double-Seamed Can"
          material="chrome"
          role="moving"
        >
          <group position={[0, 0.88, 0.6]}>
            <PartMesh geometry={geom.metalCan} />
          </group>
        </Part>

        <Part
          id="pack-jar"
          name="Glass Jar with Lug Cap"
          material="glass"
          role="moving"
        >
          <group position={[0, 0.88, 0]}>
            <PartMesh geometry={geom.glassJar} />
          </group>
        </Part>

        <Part
          id="pack-pouch"
          name="Multilayer Retort Pouch"
          material="aluminium"
          role="moving"
        >
          <group position={[0, 0.88, -0.6]}>
            <PartMesh geometry={geom.retortPouch} />
          </group>
        </Part>
      </Part>

      <PartLabel partId="pack-can" at={[0, 1.05, 0.6]} text="Tinplate Can" />
      <PartLabel partId="pack-jar" at={[0, 1.05, 0]} text="Glass Jar" />
      <PartLabel partId="pack-pouch" at={[0, 1.05, -0.6]} text="Retort Pouch" />
      <PartLabel partId="pack-table" at={[0, 1.4, 0]} text="Double-Seamer Head" />
    </group>
  )
}

/* ---------------------- Root 3D Scene Viewport ---------------------- */

export function Preservation3D() {
  const apparatus = usePreservation((s) => s.apparatus)

  return (
    <group>
      {apparatus === 'all' ? (
        <>
          <BlancherStation offset={[-3.6, 0, 0]} />
          <RetortStation offset={[-1.2, 0, 0]} />
          <ColdStoreStation offset={[1.5, 0, 0]} />
          <StorageStation offset={[4.3, 0, 0]} />
          <PackagingStation offset={[0, 0, 2.4]} />
        </>
      ) : apparatus === 'blancher' ? (
        <BlancherStation offset={[0, 0, 0]} />
      ) : apparatus === 'retort' ? (
        <RetortStation offset={[0, 0, 0]} />
      ) : apparatus === 'coldstore' ? (
        <ColdStoreStation offset={[0, 0, 0]} />
      ) : apparatus === 'storage' ? (
        <StorageStation offset={[0, 0, 0]} />
      ) : (
        <PackagingStation offset={[0, 0, 0]} />
      )}
    </group>
  )
}
