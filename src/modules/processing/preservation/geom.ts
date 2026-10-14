import * as THREE from 'three'
import { box, cylinder, mat4, merge, tube, xform } from '@/geometry'
import { blancher, centrifugalFan, coldStore, foodContainers, packagingLine, retort } from '@/parts/lib/processing'
import { grainSilo, yamBarn } from '@/parts/lib/structures'

const { PI, sin } = Math

/**
 * Preservation-scene stations: the machines and stores come from the parts library
 * (processing.ts: blancher, retort, cold store, packaging line and containers; structures.ts:
 * grain silo and yam barn). This file adds the produce and goods each station shows and keeps the
 * station layout the scene expects.
 */

export function buildBlancherGeom() {
  const foodPieces: THREE.BufferGeometry[] = []
  for (let i = 0; i < 24; i++) {
    const zPos = -1.4 + i * 0.12
    const xPos = ((i % 3) - 1) * 0.16 + sin(i * 1.5) * 0.05
    foodPieces.push(xform(cylinder(0.025, 0.02), mat4.t(xPos, 0.97, zPos)))
  }
  return { ...blancher(), foodVegetables: merge(...foodPieces) }
}

export function buildRetortGeom() {
  const cans: THREE.BufferGeometry[] = []
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 5; col++)
      for (let layer = 0; layer < 3; layer++) cans.push(xform(cylinder(0.04, 0.11, 24), mat4.t(-0.22 + row * 0.22, 0.74 + layer * 0.125, -0.45 + col * 0.22)))
  return {
    ...retort(),
    canStack: merge(...cans),
    // featured cold-point inspection can with its thermocouple
    inspectCanBody: cylinder(0.06, 0.15, 32),
    inspectCanFood: cylinder(0.055, 0.14, 32),
    thermocoupleAssembly: merge(cylinder(0.012, 0.012, 16), xform(cylinder(0.003, 0.14), mat4.t(0, 0.07, 0))),
  }
}

export function buildColdStoreGeom() {
  return {
    ...coldStore(),
    palletSlats: merge(xform(box(1.0, 0.03, 1.0), mat4.t(-0.4, 0.14, 0)), ...[-0.8, -0.4, 0].map((x) => xform(box(0.08, 0.1, 1.0), mat4.t(x, 0.08, 0)))),
    meatBoxes: merge(
      xform(box(0.4, 0.25, 0.4), mat4.t(-0.6, 0.3, -0.2)),
      xform(box(0.4, 0.25, 0.4), mat4.t(-0.2, 0.3, -0.2)),
      xform(box(0.4, 0.25, 0.4), mat4.t(-0.6, 0.3, 0.2)),
      xform(box(0.4, 0.25, 0.4), mat4.t(-0.2, 0.3, 0.2)),
      xform(box(0.4, 0.25, 0.4), mat4.t(-0.4, 0.55, 0)),
    ),
    // Plank's 7 cm freezing sphere with its frozen core
    sphereOuter: cylinder(0.035, 0.07, 32),
    sphereCore: cylinder(0.018, 0.036, 24),
  }
}

export function buildStorageGeom() {
  const silo = grainSilo({ r: 0.8, h: 1.6, roofRise: 0.45, legH: 0.65, hopperH: 0.45, legSize: 0.08, corrugated: true, wall: 0.02 })
  const fan = centrifugalFan({ r: 0.15, width: 0.22 })
  const aerationSystem = merge(xform(merge(fan.housing, fan.impeller), mat4.t(-0.95, 0.22, 0)), xform(tube(0.1, 0.08, 0.5), mat4.c(mat4.t(-0.55, 0.22, 0), mat4.rz(PI / 2))))
  return {
    yamBarn: yamBarn(),
    silo: { siloWall: silo.barrel, corrugations: silo.rings!, siloRoof: silo.roof, roofVent: silo.vent, siloHopper: silo.hopper!, siloLegs: silo.legs!, aerationSystem },
    tripleBag: {
      outerBag: xform(cylinder(0.24, 0.65, 24), mat4.t(0, 0.32, 0)),
      middleLiner: xform(cylinder(0.22, 0.62, 24), mat4.t(0, 0.32, 0)),
      innerLiner: xform(cylinder(0.2, 0.58, 24), mat4.t(0, 0.32, 0)),
      bagTie: xform(tube(0.12, 0.08, 0.06), mat4.t(0, 0.68, 0)),
    },
  }
}

export function buildPackagingGeom() {
  return { ...packagingLine(), ...foodContainers() }
}
