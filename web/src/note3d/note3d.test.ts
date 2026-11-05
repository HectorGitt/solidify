import { describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => vi.fn())
vi.mock('@/cloud/api', async (orig) => ({ ...(await orig<typeof import('@/cloud/api')>()), api: apiMock }))

import { ApiError } from '@/cloud/api'
import { generateOrEdit3DScene } from './ai3dCompiler'
import { verifyBackProjection } from './backProjectCheck'
import { buildPartGeometry } from './builder'
import { analyzeTextbookPage } from './pdfPageRenderer'
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

  it('builds and reads pages only through the API, and passes its failures on', async () => {
    apiMock.mockRejectedValueOnce(new ApiError('Sign in to use this.', 401))
    await expect(generateOrEdit3DScene('A centrifugal pump')).rejects.toMatchObject({ status: 401 })
    apiMock.mockRejectedValueOnce(new ApiError('Can’t reach Solidify’s servers.', 0))
    await expect(generateOrEdit3DScene('A centrifugal pump')).rejects.toMatchObject({ status: 0 })
    apiMock.mockResolvedValueOnce({ explanation: 'ok' })
    await expect(generateOrEdit3DScene('A centrifugal pump')).rejects.toMatchObject({ status: 502 })

    apiMock.mockRejectedValueOnce(new ApiError('Can’t reach Solidify’s servers.', 0))
    await expect(analyzeTextbookPage({ pageNumber: 1, pageImageUrl: '', pageText: 'beam', fileName: 'x.pdf' })).rejects.toMatchObject({ status: 0 })
    apiMock.mockResolvedValueOnce({ figures: [{ id: 'f', visualization: { kind: 'none' } }] })
    await expect(analyzeTextbookPage({ pageNumber: 1, pageImageUrl: '', pageText: 'beam', fileName: 'x.pdf' })).resolves.toEqual([])
    // shapes the builder can't draw are dropped; a reply with nothing drawable is an incomplete answer
    const good = { id: 'shaft', name: 'Shaft', shapes: [{ kind: 'cylinder', r: 0.02, h: 0.2 }] }
    apiMock.mockResolvedValueOnce({ spec: { title: 'T', parts: [good, { id: 'b', name: 'Bolt', shapes: [{ kind: 'bolt' }] }, { id: 'n', name: 'No shapes' }] } })
    const cleaned = await generateOrEdit3DScene('A shaft')
    expect(cleaned.spec.parts.map((p) => p.id)).toEqual(['shaft'])
    apiMock.mockResolvedValueOnce({ spec: { title: 'T', parts: [{ id: 'b', name: 'Bolt', shapes: [{ kind: 'hexagon' }] }] } })
    await expect(generateOrEdit3DScene('A bolt')).rejects.toMatchObject({ status: 502 })
    expect(buildPartGeometry([{ kind: 'plate' } as never], {}).attributes.position.count).toBeGreaterThan(0)
    // fasteners from the parts library: a nut is a hexagon with a bore, centred on its axis
    const nut = buildPartGeometry([{ kind: 'hexNut', d: 0.1 }], {})
    nut.computeBoundingBox()
    expect(nut.boundingBox!.max.y).toBeCloseTo(0.04, 3)
    expect(nut.boundingBox!.max.x).toBeGreaterThan(0.075)
    expect(buildPartGeometry([{ kind: 'hexBolt', d: 0.02, h: 0.1 }], {}).attributes.position.count).toBeGreaterThan(0)
    expect(apiMock).toHaveBeenCalledWith('/v1/create-3d', expect.anything())
    expect(apiMock).toHaveBeenCalledWith('/v1/notes/analyze', expect.anything())
  })
})
