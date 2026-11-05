import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODULES } from '@/modules/catalog'
import { CATALOG_TARGETS, toSceneParams } from './catalogTargets'
import { SAMPLE_TEXTBOOKS } from './sampleTextbooks'

describe('catalog targets', () => {
  it('every target is a built scene', () => {
    for (const t of CATALOG_TARGETS) {
      const scene = MODULES.find((m) => m.id === t.moduleId)?.scenes.find((s) => s.id === t.sceneId)
      expect(scene?.load, `${t.moduleId}/${t.sceneId}`).toBeTruthy()
    }
  })

  it('the API prompt offers exactly these rigs, with the same setting names', () => {
    const api = fs.readFileSync(path.resolve(__dirname, '../../../api/src/noteCatalog.ts'), 'utf8')
    const listed = [...api.matchAll(/moduleId: '([a-z-]+)', sceneId: '([a-z-]+)'[^\n]*keys: '([^']+)'/g)]
    expect(listed.map((m) => `${m[1]}/${m[2]}`).sort()).toEqual(CATALOG_TARGETS.map((t) => `${t.moduleId}/${t.sceneId}`).sort())
    for (const [, moduleId, sceneId, keys] of listed) {
      const target = CATALOG_TARGETS.find((t) => t.moduleId === moduleId && t.sceneId === sceneId)!
      const names = [...keys.matchAll(/(?:^|, )([A-Za-z0-9]+) \(/g)].map((m) => m[1])
      expect(names.sort(), `${moduleId}/${sceneId}`).toEqual(Object.keys(target.keys).sort())
    }
  })
})

describe('a figure’s values become the rig’s settings', () => {
  it('beam: span and loads, and a cantilever spelled as a number', () => {
    const r = toSceneParams('materials', 'beam', { span: 2.2, p1: 12, x1: 2, w: 0, support: 1 })
    expect(r.params).toMatchObject({ L: 2.2, P1: 12, x1: 2, w: 0, support: 'cantilever', P2: 0 })
    expect(r.usable).toBe(5)
  })
  it('four-bar: millimetres on the page become the rig’s centimetres', () => {
    const r = toSceneParams('mechanisms', 'four-bar', { l1: 240, l2: 80, l3: 210, l4: 140, rpm: 30 })
    expect(r.params).toMatchObject({ frame: 24, crank: 8, coupler: 21, rocker: 14, rpm: 30 })
  })
  it('the rig’s own names pass straight through', () => {
    expect(toSceneParams('drawing', 'interpenetration', { R: 55, r: 38 }).params).toMatchObject({ R: 55, r: 38 })
  })
  it('unknown names are dropped, and values are kept in the rig’s range', () => {
    const r = toSceneParams('drawing', 'interpenetration', { mainR: 500, branchR: 38, unfold: 0.35 })
    expect(r.params).toEqual({ R: 80, r: 38 })
    expect(r.usable).toBe(2)
  })
  it('a rig that is not a target, or values it cannot use, give nothing to apply', () => {
    expect(toSceneParams('engine', 'cooling', { L: 3 }).supported).toBe(false)
    expect(toSceneParams('materials', 'beam', { colour: 'red' }).usable).toBe(0)
  })
  it('every sample figure that opens a rig gives it values it understands', () => {
    for (const doc of SAMPLE_TEXTBOOKS)
      for (const page of doc.pages)
        for (const fig of page.figures) {
          if (fig.visualization.kind !== 'catalog') continue
          const r = toSceneParams(fig.visualization.moduleId, fig.visualization.sceneId, fig.visualization.params)
          expect(r.usable, `${doc.id} ${fig.id}`).toBeGreaterThan(0)
        }
  })
})
