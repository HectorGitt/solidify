import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { rad } from '@/physics/joints'
import { PartLabel } from '@/render/Label'
import { getMaterial } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { ballCircuit, buildBoxesGeometry } from './geometry'
import { BALL, COLUMN_END, SCREW_PHASE, ST, TURNS, WORM, kinematics, live, useBoxes } from './model'

const { PI } = Math

const C = {
  ball: [ST('p3 (book p92): recirculating-ball steering'), ST('p4, Fig 46 parts A–F')],
  peg: [ST('p3–4 (book pp92–93): worm and peg steering'), ST('p4, Fig 46')],
  maint: [ST('p4 (book p93): maintenance — SAE 90, level plug every 200 h')],
}

const INFO = {
  ballBox: {
    summary: 'Recirculating-ball steering box — the type most tractors have.',
    role: 'Turns the steering-column rotation into a ±30° swing of the drop arm, with a large reduction, through a nut that runs on balls.',
    details: 'Proportions typical of a 30–60 kW tractor. Lock to lock here is 4 turns of the wheel.',
  },
  thread: { summary: 'Column thread (A).', role: 'The end of the steering column is cut with a helical ball groove.' },
  nut: { summary: 'Ball nut (B).', role: 'Moves along the thread when the steering wheel turns. It does not rotate — the peg in the rocker-arm slot stops it.' },
  balls: {
    summary: 'Steel balls in the grooves.',
    role: 'Run in the grooves formed by the threads on the shaft and in the nut, giving smooth, low-friction movement. At the end of the nut they leave the groove and return through the transfer tube — hence "recirculating".',
    details: 'Transfer tube and ball count are standard design details.',
  },
  tube: { summary: 'Ball transfer (return) tube.', role: 'Carries the balls from one end of the nut back to the other.' },
  ballPeg: { summary: 'Peg (F) on the nut.', role: 'Connects the nut to the rocker arm D; slides in the arm’s slot as the arm swings.' },
  ballRocker: { summary: 'Rocker arm (D) and rocker shaft (E).', role: 'When the nut moves along the thread the rocker arm and shaft rotate — about 30° backwards or forwards.' },
  dropArm: { summary: 'Drop arm.', role: 'Fixed to the rocker shaft; as it swings it pulls or pushes the drag link to steer the front wheels.' },
  housing: { summary: 'Steering-box housing.', role: 'Cast casing holding the bearings and the gear oil.' },
  oil: { summary: 'Steering-box oil (SAE 90).', role: 'Some boxes have a level plug: remove it every 200 hours to check the level. SAE 90 is commonly used.' },
  plug: { summary: 'Oil-level plug.', role: 'Removed every 200 h to check the oil level.' },
  wheel: { summary: 'Steering wheel and column.', role: 'Turned by the driver; the column carries the thread or worm at its lower end.' },
  pegBox: { summary: 'Worm-and-peg steering box.', role: 'Works on a similar principle: a peg on the rocker arm runs in the worm thread.', details: 'The worm is drawn hourglass-shaped so the swinging peg stays engaged (standard practice).' },
  worm: { summary: 'Steering shaft (A) with thread (B).', role: 'The worm thread on the end of the column drives the peg sideways as the wheel turns.' },
  pegC: { summary: 'Peg (C) on the rocker arm.', role: 'Runs in the thread on the shaft. When the wheel is turned the rocker arm and shaft (E) are rotated by the movement of the peg in the thread.' },
  pegRocker: { summary: 'Rocker arm (D) and shaft (E).', role: 'Carries the peg; the drop arm is attached to shaft E.' },
}

export function Boxes3D() {
  const g = buildBoxesGeometry()
  const circuit = useMemo(() => ballCircuit(), [])
  const ballsRef = useRef<THREE.InstancedMesh>(null)
  const ballMat = useMemo(() => getMaterial('chrome', { variant: 'solid', highlight: 'none', intersection: false }), [])
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), p: new THREE.Vector3() }), [])
  const L = useMemo(() => circuit.curve.getLength(), [circuit])

  const screw = useRef<THREE.Group>(null)
  const nut = useRef<THREE.Group>(null)
  const ballRocker = useRef<THREE.Group>(null)
  const ballDrop = useRef<THREE.Group>(null)
  const wormRef = useRef<THREE.Group>(null)
  const pegRocker = useRef<THREE.Group>(null)
  const pegDrop = useRef<THREE.Group>(null)
  const wheelA = useRef<THREE.Group>(null)
  const wheelB = useRef<THREE.Group>(null)
  const t = useRef(0)

  useSimFrame((dt) => {
    const st = useBoxes.getState()
    let w = rad(st.wheel)
    if (st.sweep) {
      t.current += dt
      w = TURNS * 2 * PI * Math.sin(t.current * 0.35)
    }
    const k = kinematics(w)
    screw.current?.rotation.set(w + SCREW_PHASE, 0, 0)
    wheelA.current?.rotation.set(w, 0, 0)
    nut.current?.position.set(k.ball.x, 0, 0)
    ballRocker.current?.rotation.set(0, 0, -k.ball.phi)
    ballDrop.current?.rotation.set(0, 0, -k.ball.phi)
    wormRef.current?.rotation.set(w, 0, 0)
    wheelB.current?.rotation.set(w, 0, 0)
    pegRocker.current?.rotation.set(0, 0, k.peg.phi)
    pegDrop.current?.rotation.set(0, 0, k.peg.phi)

    const mesh = ballsRef.current
    if (mesh) {
      mesh.visible = !useView.getState().hidden.includes('balls')
      const off = ((w / 2) * circuit.helixArc) / L
      for (let i = 0; i < BALL.balls; i++) {
        let u = (i / BALL.balls + off) % 1
        if (u < 0) u += 1
        circuit.curve.getPointAt(u, tmp.p)
        tmp.o.position.copy(tmp.p)
        tmp.o.updateMatrix()
        mesh.setMatrixAt(i, tmp.o.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    live.wheel = (w * 180) / PI
    live.nutX = k.ball.x
    live.phiBall = (k.ball.phi * 180) / PI
    live.phiPeg = (k.peg.phi * 180) / PI
    live.ratioBall = k.ball.ratio
    live.ratioPeg = k.peg.ratio
  })

  return (
    <group>
      {/* ---------------- recirculating ball ---------------- */}
      <group position={[0, 0, BALL.z]}>
        <Part id="ball-box" name="Recirculating-ball box" role="housing" material="castIron" info={INFO.ballBox} cites={C.ball}>
          <Part id="ball-housing" name="Housing" material="paintGreen" role="housing" info={INFO.housing} cites={C.ball} explode={[0, 0, 0.12]}>
            <PartMesh geometry={g.ballHousing} />
            <Part id="ball-plug" name="Oil-level plug" material="brass" role="static" info={INFO.plug} cites={C.maint}>
              <PartMesh geometry={g.levelPlug} position={[0.05, 0.059, 0]} />
            </Part>
          </Part>
          <Part id="ball-oil" name="Gear oil (SAE 90)" material="oil" role="fluid" info={INFO.oil} cites={C.maint}>
            <PartMesh geometry={g.ballOil} position={[0, BALL.eY - 0.007, 0]} />
          </Part>
          <group ref={screw}>
            <Part id="thread" name="Column thread (A)" material="steel" role="moving" info={INFO.thread} cites={C.ball} explode={[0.1, 0, 0]}>
              <PartMesh geometry={g.ballThread} />
              <PartMesh geometry={g.ballShafts} />
            </Part>
          </group>
          <group ref={wheelA} position={[COLUMN_END, 0, 0]}>
            <Part id="wheel-a" name="Steering wheel" material="paintBlack" role="moving" info={INFO.wheel} cites={C.ball} cut={false} explode={[0.1, 0, 0]}>
              <PartMesh geometry={g.wheel} />
            </Part>
          </group>
          <group ref={nut}>
            <Part id="nut" name="Ball nut (B)" material="steelDark" role="static" info={INFO.nut} cites={C.ball} explode={[0, 0.07, 0]}>
              <PartMesh geometry={g.ballNut} />
              <Part id="tube" name="Transfer tube" material="steel" role="static" info={INFO.tube} beyondNotes>
                <PartMesh geometry={g.transferTube} />
              </Part>
              <Part id="ball-peg" name="Peg (F)" material="steel" role="moving" info={INFO.ballPeg} cites={C.ball}>
                <PartMesh geometry={g.ballPeg} />
              </Part>
              <Part id="balls" name="Steel balls" material="chrome" role="moving" info={INFO.balls} cites={C.ball} beyondNotes>
                <instancedMesh ref={ballsRef} args={[g.ball, ballMat, BALL.balls]} frustumCulled={false} castShadow />
              </Part>
            </Part>
          </group>
          <group position={[0, BALL.eY, 0]}>
            <group ref={ballRocker}>
              <Part id="ball-rocker" name="Rocker arm (D) & shaft (E)" material="forged" role="moving" info={INFO.ballRocker} cites={C.ball} explode={[0, -0.05, 0]}>
                <PartMesh geometry={g.ballRockerArm} />
                <PartMesh geometry={g.ballRockerShaft} material="steel" />
              </Part>
            </group>
            <group position={[0, 0, 0.082]}>
              <group ref={ballDrop}>
                <Part id="ball-drop" name="Drop arm" material="paintGrey" role="moving" info={INFO.dropArm} cites={C.ball} explode={[0, 0, 0.06]}>
                  <PartMesh geometry={g.dropArm} />
                </Part>
              </group>
            </group>
          </group>
        </Part>
      </group>

      {/* ---------------- worm and peg ---------------- */}
      <group position={[0, 0, WORM.z]}>
        <Part id="peg-box" name="Worm-and-peg box" role="housing" material="castIron" info={INFO.pegBox} cites={C.peg}>
          <Part id="peg-housing" name="Housing" material="paintGreen" role="housing" info={INFO.housing} cites={C.peg} explode={[0, 0, -0.12]}>
            <PartMesh geometry={g.wormHousing} />
          </Part>
          <Part id="peg-oil" name="Gear oil (SAE 90)" material="oil" role="fluid" info={INFO.oil} cites={C.maint}>
            <PartMesh geometry={g.wormOil} position={[0, -0.021, 0]} />
          </Part>
          <group ref={wormRef}>
            <Part id="worm" name="Shaft (A) with thread (B)" material="steel" role="moving" info={INFO.worm} cites={C.peg} explode={[0.1, 0, 0]}>
              <PartMesh geometry={g.wormBody} />
              <PartMesh geometry={g.wormShafts} />
            </Part>
          </group>
          <group ref={wheelB} position={[COLUMN_END, 0, 0]}>
            <Part id="wheel-b" name="Steering wheel" material="paintBlack" role="moving" info={INFO.wheel} cites={C.peg} cut={false} explode={[0.1, 0, 0]}>
              <PartMesh geometry={g.wheel} />
            </Part>
          </group>
          <group position={[0, WORM.eY, 0]}>
            <group ref={pegRocker}>
              <Part id="peg-rocker" name="Rocker arm (D) & shaft (E)" material="forged" role="moving" info={INFO.pegRocker} cites={C.peg} explode={[0, 0.06, 0]}>
                <PartMesh geometry={g.wormRockerArm} />
                <PartMesh geometry={g.wormRockerShaft} material="steel" />
                <Part id="peg-c" name="Peg (C)" material="steelDark" info={INFO.pegC} cites={C.peg}>
                  <PartMesh geometry={g.wormPeg} />
                </Part>
              </Part>
            </group>
            <group position={[0, 0, -0.098]}>
              <group ref={pegDrop}>
                <Part id="peg-drop" name="Drop arm" material="paintGrey" role="moving" info={INFO.dropArm} cites={C.peg} explode={[0, 0, -0.06]}>
                  <PartMesh geometry={g.dropArm} />
                </Part>
              </group>
            </group>
          </group>
        </Part>
      </group>

      <PartLabel partId="thread" at={[-0.05, 0.02, BALL.z + 0.03]} />
      <PartLabel partId="nut" at={[0.0, 0.045, BALL.z + 0.03]} />
      <PartLabel partId="tube" at={[0.03, 0.05, BALL.z]} />
      <PartLabel partId="ball-rocker" at={[0.02, BALL.eY + 0.02, BALL.z + 0.02]} />
      <PartLabel partId="ball-drop" at={[0.03, BALL.eY - 0.11, BALL.z + 0.09]} />
      <PartLabel partId="worm" at={[-0.04, -0.02, WORM.z + 0.03]} />
      <PartLabel partId="peg-c" at={[0.02, 0.03, WORM.z + 0.02]} />
      <PartLabel partId="peg-rocker" at={[0.02, WORM.eY + 0.02, WORM.z]} />
      <PartLabel partId="peg-drop" at={[0.03, WORM.eY - 0.11, WORM.z - 0.1]} />
      <PartLabel partId="ball-oil" at={[-0.05, BALL.eY - 0.01, BALL.z + 0.04]} />
      <PartLabel partId="wheel-a" at={[COLUMN_END, 0.11, BALL.z]} />
    </group>
  )
}
