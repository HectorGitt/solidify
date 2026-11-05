import { describe, expect, it } from 'vitest'
import { generateOrEdit3DScene } from './ai3dCompiler'
import { verifyBackProjection } from './backProjectCheck'
import { buildPartGeometry } from './builder'
import { buildOrRefineModelFromText, CREATE_TEMPLATES, TWO_STAGE_REDUCER_SPEC } from './createCatalog'
import { classifyEngineeringFigure } from './pdfPageRenderer'
import {
  BEARING_BRACKET_ORTHO_SPEC,
  FLANGED_COUPLING_SPEC,
  SAMPLE_TEXTBOOKS,
  STEPPED_GEAR_SHAFT_SPEC,
} from './sampleTextbooks'
import {
  CONFIDENCE_THRESHOLD,
  evalDim,
  evalVec3,
  evaluateCalculations,
  noteSceneSpecSchema,
  type NoteSceneSpec,
} from './schema'

describe('note3d safeguards, benchmark & back-projection checks', () => {
  it('evaluates parametric expressions safely with evalDim and evalVec3', () => {
    const params = { shaftD: 0.045, flangeOD: 0.19, pcd: 0.135, webT: 0.022 }
    expect(evalDim(0.12, params)).toBeCloseTo(0.12)
    expect(evalDim('flangeOD / 2', params)).toBeCloseTo(0.095)
    expect(evalDim('shaftD * 0.95 + 0.01', params)).toBeCloseTo(0.045 * 0.95 + 0.01)
    expect(evalDim('sqrt(16) + sin(0)', params)).toBeCloseTo(4)
    expect(evalVec3(['shaftD / 2', '-webT / 2', 0], params)).toEqual([0.0225, -0.011, 0])
  })

  it('validates all procedural NoteSceneSpecs, compiles watertight CSG, and passes 2D back-projection check', () => {
    const specs = [FLANGED_COUPLING_SPEC, STEPPED_GEAR_SHAFT_SPEC, BEARING_BRACKET_ORTHO_SPEC]
    for (const spec of specs) {
      const parsed = noteSceneSpecSchema.safeParse(spec)
      expect(parsed.success).toBe(true)

      const paramMap = Object.fromEntries(spec.parameters.map((p) => [p.id, p.value]))
      for (const part of spec.parts) {
        const geom = buildPartGeometry(part.shapes, paramMap)
        const pos = geom.getAttribute('position')
        const norm = geom.getAttribute('normal')
        expect(pos).toBeDefined()
        expect(norm).toBeDefined()
        expect(pos.count).toBeGreaterThan(12)
        expect(geom.boundingBox).not.toBeNull()
      }

      const check = verifyBackProjection(spec, paramMap, 1.5)
      expect(check.passed).toBe(true)
      expect(check.score).toBeGreaterThanOrEqual(0.65)
    }
  })

  it('flags broken or disconnected procedural parts during 2D back-projection check', () => {
    const brokenSpec: NoteSceneSpec = {
      ...FLANGED_COUPLING_SPEC,
      parts: [
        FLANGED_COUPLING_SPEC.parts[0],
        {
          ...FLANGED_COUPLING_SPEC.parts[1],
          // Floating 5 meters away from the coupling
          position: [5.0, 5.0, 0],
        },
      ],
    }
    const check = verifyBackProjection(brokenSpec)
    expect(check.passed).toBe(false)
    expect(check.reason).toContain('disconnected')
  })

  it('achieves >= 70% accuracy across 10 benchmark chapter figures', () => {
    const benchmarkCases: {
      caption: string
      expectedModule: string
      expectedScene: string
      expectedParam?: [string, number]
    }[] = [
      {
        caption: 'Figure 1.1 Simply supported beam of span L = 4.2 m carrying point load P1 = 24 kN and UDL w = 6 kN/m',
        expectedModule: 'materials',
        expectedScene: 'beam',
        expectedParam: ['span', 4.2],
      },
      {
        caption: 'Figure 1.2 Cantilever beam of length L = 2.5 m with tip load P1 = 10 kN',
        expectedModule: 'materials',
        expectedScene: 'beam',
        expectedParam: ['support', 1],
      },
      {
        caption: 'Figure 1.3 Plane stress element and Mohr circle with sigma_x = 90 MPa, sigma_y = -45 MPa, tau = 30 MPa',
        expectedModule: 'materials',
        expectedScene: 'stress-state',
        expectedParam: ['sx', 90],
      },
      {
        caption: 'Figure 2.1 Planar Grashof four-bar linkage with ground link L1 = 240 mm and crank L2 = 80 mm',
        expectedModule: 'mechanisms',
        expectedScene: 'four-bar',
        expectedParam: ['l1', 240],
      },
      {
        caption: 'Figure 2.2 Slider-crank quick-return mechanism inversion',
        expectedModule: 'mechanisms',
        expectedScene: 'inversions',
      },
      {
        caption: 'Figure 2.3 Meshing spur gear train with pinion and wheel teeth',
        expectedModule: 'mechanisms',
        expectedScene: 'gear-trains',
      },
      {
        caption: 'Figure 3.1 Curve of interpenetration of two intersecting cylinders of radius R = 60 mm',
        expectedModule: 'drawing',
        expectedScene: 'interpenetration',
        expectedParam: ['mainR', 60],
      },
      {
        caption: 'Figure 3.2 True length of an oblique line AB in space',
        expectedModule: 'drawing',
        expectedScene: 'true-length',
      },
      {
        caption: 'Figure 3.3 Rankine steam turbine power plant cycle with boiler and condenser',
        expectedModule: 'thermal',
        expectedScene: 'rankine',
      },
      {
        caption: 'Figure 3.4 Vapour-compression refrigeration loop with evaporator and compressor',
        expectedModule: 'thermal',
        expectedScene: 'refrigeration',
      },
    ]

    let correct = 0
    for (const c of benchmarkCases) {
      const res = classifyEngineeringFigure(c.caption)
      if (
        res.visualization.kind === 'catalog' &&
        res.visualization.moduleId === c.expectedModule &&
        res.visualization.sceneId === c.expectedScene
      ) {
        if (!c.expectedParam || Math.abs((res.visualization.params[c.expectedParam[0]] ?? 0) - c.expectedParam[1]) < 1e-3) {
          correct++
        }
      }
    }

    const accuracy = correct / benchmarkCases.length
    expect(accuracy).toBeGreaterThanOrEqual(0.7)
    expect(accuracy).toBe(1.0)
  })

  it('uses self-authored sample notes, repeated-rig isolation, and confidence gating', () => {
    const serialized = JSON.stringify(SAMPLE_TEXTBOOKS)
    expect(serialized).not.toMatch(/shigley|hibbeler|norton/i)

    // Note 1 Page 1 has two distinct beam figures on the same page with different spans
    const page1Figs = SAMPLE_TEXTBOOKS[0].pages[0].figures
    expect(page1Figs.length).toBe(2)
    expect(page1Figs[0].visualization.kind).toBe('catalog')
    expect(page1Figs[1].visualization.kind).toBe('catalog')
    if (page1Figs[0].visualization.kind === 'catalog' && page1Figs[1].visualization.kind === 'catalog') {
      expect(page1Figs[0].visualization.sceneId).toBe('beam')
      expect(page1Figs[1].visualization.sceneId).toBe('beam')
      expect(page1Figs[0].visualization.params.span).not.toBe(page1Figs[1].visualization.params.span)
    }

    // Note 1 Page 2 includes a low-confidence figure (< CONFIDENCE_THRESHOLD) for gating
    const page2Figs = SAMPLE_TEXTBOOKS[0].pages[1].figures
    const lowConf = page2Figs.find((f) => (f.confidence ?? 1) < CONFIDENCE_THRESHOLD)
    expect(lowConf).toBeDefined()
  })

  it('compiles all Create in 3D machine templates, evaluates live calculations, and refines by chat', () => {
    for (const tpl of CREATE_TEMPLATES) {
      const parsed = noteSceneSpecSchema.safeParse(tpl.spec)
      expect(parsed.success).toBe(true)

      const params = Object.fromEntries(tpl.spec.parameters.map((p) => [p.id, p.value]))
      for (const part of tpl.spec.parts) {
        const geom = buildPartGeometry(part.shapes, params)
        expect(geom.getAttribute('position').count).toBeGreaterThan(12)
      }

      const { results } = evaluateCalculations(tpl.spec.calculations, params)
      expect(results.length).toBeGreaterThan(0)
      for (const r of results) {
        expect(Number.isFinite(r.value)).toBe(true)
      }
    }

    // Design by chat: "Make the output shaft 40 mm longer"
    const longer = buildOrRefineModelFromText('Make the output shaft 40 mm longer', TWO_STAGE_REDUCER_SPEC)
    const extParam = longer.spec.parameters.find((p) => p.id === 'shaftExt')
    expect(extParam?.value).toBeCloseTo(0.09 + 0.04)

    // Design by chat: "Why isn't this 20 : 1?"
    const exact20 = buildOrRefineModelFromText('Why isn’t this 20 : 1?', TWO_STAGE_REDUCER_SPEC)
    const exactParams = Object.fromEntries(exact20.spec.parameters.map((p) => [p.id, p.value]))
    const { results: exactCalcs } = evaluateCalculations(exact20.spec.calculations, exactParams)
    const ratioCalc = exactCalcs.find((c) => c.spec.id === 'i_tot')
    expect(ratioCalc?.value).toBeCloseTo(20.0)

    // Describing any new machine switches the 3D assembly and assigns a fresh revision id
    const pump = buildOrRefineModelFromText('A centrifugal water pump running at 1800 rpm', TWO_STAGE_REDUCER_SPEC)
    expect(pump.isNewMachine).toBe(true)
    expect(pump.spec.id).toContain('create-centrifugal-pump')
    expect(pump.spec.parameters.find((p) => p.id === 'rpm')?.value).toBe(1800)

    const planetary = buildOrRefineModelFromText('Planetary epicyclic gear set for a 25 kW tractor drive', TWO_STAGE_REDUCER_SPEC)
    expect(planetary.isNewMachine).toBe(true)
    expect(planetary.spec.id).toContain('create-planetary-gearset')
    expect(planetary.matchedCatalogScene?.scene.id).toBe('planetary')

    const customRoaster = buildOrRefineModelFromText('A 4 kW rotary cocoa bean roaster drum at 60 rpm', TWO_STAGE_REDUCER_SPEC)
    expect(customRoaster.isNewMachine).toBe(true)
    expect(customRoaster.spec.title).toContain('Rotary Cocoa Bean Roaster Drum')
  })

  it('compiles open-ended machines and structural part additions via generateOrEdit3DScene', async () => {
    const turbine = await generateOrEdit3DScene('A 3-blade wind turbine on a tubular tower')
    expect(turbine.isNewMachine).toBe(true)
    expect(turbine.spec.parts.length).toBeGreaterThanOrEqual(3)

    const robot = await generateOrEdit3DScene('An articulated robotic manipulator arm with gripper')
    expect(robot.isNewMachine).toBe(true)
    expect(robot.spec.title).toContain('Robotic Manipulator Arm')

    const withFan = await generateOrEdit3DScene('Add a 6-blade cooling fan', TWO_STAGE_REDUCER_SPEC)
    expect(withFan.isNewMachine).toBe(false)
    expect(withFan.spec.parts.length).toBe(TWO_STAGE_REDUCER_SPEC.parts.length + 1)

    const novelMachine = await generateOrEdit3DScene('A dual-rotor cocoa pod splitter with top hopper at 400 rpm')
    expect(novelMachine.isNewMachine).toBe(true)
    expect(novelMachine.spec.title).toContain('Cocoa Pod Splitter')
    expect(novelMachine.spec.parts.some((p) => p.name.toLowerCase().includes('hopper'))).toBe(true)
  })
})
