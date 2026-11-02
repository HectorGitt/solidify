import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { instrument, useResetOnChange, useRunDriver } from '@/lab/run'
import { deadCentres, sliderDisplacement, sliderPosition, yokeDisplacement } from '@/physics/linkages'
import { PartLabel } from '@/render/Label'
import { Part, PartMesh } from '@/render/Part'
import { BenchPlate, flatBar } from '../_shared/rig'
import { MM, SLIDER_PROC, live, sliderRun, useSlider } from './model'

export const FLOOR = -0.32
const axial = mat4.rx(Math.PI / 2)

export function Slider3D() {
  const mode = useSlider((s) => s.mode)
  const rmm = useSlider((s) => s.r)
  const n = useSlider((s) => s.n)
  const emm = useSlider((s) => s.e)
  const r = rmm * MM
  const l = n * r
  const yoke = mode === 'yoke'
  // the offset belongs to the slider-crank only
  const e = yoke ? 0 : emm * MM

  const refs = {
    crank: useRef<THREE.Group>(null),
    rod: useRef<THREE.Group>(null),
    slider: useRef<THREE.Group>(null),
    pin: useRef<THREE.Group>(null),
  }

  const xMid = yoke ? 0 : l
  const xOut = yoke ? r : l + r
  const geo = useMemo(() => {
    const blockW = 0.1
    const railFrom = xMid - r - blockW
    const railTo = xOut + blockW + (yoke ? 0.28 : 0.06)
    const railLen = railTo - railFrom
    const railX = (railFrom + railTo) / 2
    const rail = (y: number) => xform(box(railLen, 0.014, 0.03), mat4.t(railX, e + y, 0.016))
    const ticks: THREE.BufferGeometry[] = []
    // a scale along the guide, a tick every 5 mm, longer every 10 mm
    for (let i = 0; i * 5 * MM <= 2 * r + 1e-6; i++) {
      const long = i % 2 === 0
      ticks.push(xform(box(0.0018, long ? 0.02 : 0.012, 0.002), mat4.t(xOut - i * 5 * MM + (yoke ? 0.17 : 0), e - 0.052 - (long ? 0.01 : 0.006), 0.002)))
    }
    return {
      rails: merge(rail(0.041), rail(-0.041)),
      ticks: merge(...ticks),
      disc: xform(tube(Math.max(r + 0.028, 0.06), 0.012, 0.012, 64), axial),
      hub: xform(cylinder(0.013, 0.05, 28), mat4.c(mat4.t(0, 0, 0.012), axial)),
      pin: merge(xform(cylinder(0.0075, 0.05, 20), mat4.c(mat4.t(0, 0, 0.026), axial)), xform(cylinder(0.012, 0.005, 24), mat4.c(mat4.t(0, 0, 0.05), axial))),
      rod: flatBar(l, 0.03, 0.008),
      block: xform(box(blockW, 0.068, 0.04), mat4.t(0, 0, 0.02)),
      yoke: merge(
        // the slotted cross-head, its slot wide enough for the crank-pin
        xform(box(0.03, 2 * r + 0.1, 0.02), mat4.t(-0.034, 0, 0.038)),
        xform(box(0.03, 2 * r + 0.1, 0.02), mat4.t(0.034, 0, 0.038)),
        xform(box(0.098, 0.02, 0.02), mat4.t(0, r + 0.04, 0.038)),
        xform(box(0.098, 0.02, 0.02), mat4.t(0, -r - 0.04, 0.038)),
      ),
      yokeRod: xform(box(0.25, 0.03, 0.02), mat4.t(0.17, 0, 0.02)),
    }
  }, [r, l, e, xMid, xOut, yoke])

  const phase = useRef(0.5)
  useResetOnChange(sliderRun, JSON.stringify([mode, rmm, n, emm]))
  /** from the outer dead centre, as the procedure starts */
  const startAngle = () => {
    const st = useSlider.getState()
    return st.mode === 'yoke' ? 0 : deadCentres({ r: st.r, l: st.n * st.r, e: st.e }).tdc
  }
  useRunDriver(
    sliderRun,
    SLIDER_PROC,
    (f) => {
      phase.current = startAngle() + f * 2 * Math.PI
    },
    (step, f) => {
      const st = useSlider.getState()
      const a = f * 2 * Math.PI
      const x = st.mode === 'yoke' ? yokeDisplacement(st.r, a) : sliderDisplacement({ r: st.r, l: st.n * st.r, e: st.e }, a + startAngle())
      // a linear scale read to about half a millimetre
      sliderRun.getState().log([f * 360, Math.max(0, instrument(x, 0.006, step)), st.r * (1 - Math.cos(a))])
    },
  )
  useSimFrame((dt) => {
    const st = useSlider.getState()
    if (sliderRun.getState().status !== 'running') phase.current += (st.rpm * 2 * Math.PI * dt) / 60
    const t = phase.current
    live.theta = t
    refs.crank.current?.rotation.set(0, 0, t)
    const bx = r * Math.cos(t)
    const by = r * Math.sin(t)
    refs.pin.current?.position.set(bx, by, 0)
    if (yoke) {
      refs.slider.current?.position.set(bx, 0, 0)
      return
    }
    const s = sliderPosition({ r, l, e }, t)
    refs.slider.current?.position.set(s, e, 0)
    refs.rod.current?.position.set(bx, by, 0.036)
    refs.rod.current?.rotation.set(0, 0, Math.atan2(e - by, s - bx))
  })

  return (
    <group>
      <BenchPlate width={1.7} height={0.56} floor={FLOOR} />
      <group position={[-(xOut + (yoke ? 0.3 : 0.1)) / 2 + 0.02, 0, 0]}>
        <Part id="guide" name="Guide and scale" role="static" material="steelDark" info={{ summary: 'Holds the cross-head to a straight line.', role: 'The line of stroke. Its scale gives the displacement at each crank angle.' }} cut={false} explode={[0, 0, -0.04]}>
          <PartMesh geometry={geo.rails} />
          <PartMesh geometry={geo.ticks} material="paintBlack" />
        </Part>
        <group ref={refs.crank}>
          <Part id="crank" name="Crank disc" role="moving" material="paintOrange" info={{ summary: 'Turned at steady speed.', role: 'Its pin, at radius r, drives the output. Stroke is twice the radius when the line of stroke runs through its centre.' }} explode={[0, 0, 0.03]}>
            <PartMesh geometry={geo.disc} />
            <PartMesh geometry={geo.hub} material="chrome" />
          </Part>
        </group>
        <group ref={refs.pin}>
          <Part id="pin" name="Crank-pin" role="moving" material="chrome" info={{ summary: 'The driving pin on the disc.', role: yoke ? 'Slides up and down in the yoke’s slot while pushing it sideways.' : 'The rod’s big end turns on it.' }} explode={[0, 0, 0.09]}>
            <PartMesh geometry={geo.pin} />
          </Part>
        </group>
        {yoke ? null : (
          <group ref={refs.rod}>
            <Part id="rod" name="Connecting rod" role="moving" material="paintRed" info={{ summary: 'Links the crank-pin to the cross-head.', role: 'Its swing makes the slider’s motion depart from a pure sine: a shorter rod, more departure.' }} explode={[0, 0, 0.06]}>
              <PartMesh geometry={geo.rod} />
            </Part>
          </group>
        )}
        <group ref={refs.slider}>
          <Part id="crosshead" name={yoke ? 'Yoke' : 'Cross-head'} role="moving" material="paintBlue" info={{ summary: yoke ? 'The slotted cross-head.' : 'The slider.', role: yoke ? 'The slot takes out the pin’s up-and-down motion, leaving exactly r cos θ: true simple harmonic motion.' : 'Moves along the guide as the piston does in an engine.' }} explode={[0, 0, 0.04]}>
            {yoke ? (
              <>
                <PartMesh geometry={geo.yoke} />
                <PartMesh geometry={geo.yokeRod} material="chrome" />
              </>
            ) : (
              <PartMesh geometry={geo.block} />
            )}
          </Part>
        </group>
        <PartLabel partId="crank" at={[0, -r - 0.05, 0.05]} />
        <PartLabel partId="guide" at={[xOut + 0.06, e + 0.08, 0.04]} />
      </group>
    </group>
  )
}
