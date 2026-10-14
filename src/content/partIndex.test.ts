import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODULES } from '@/modules/catalog'

/**
 * Generates src/content/partIndex.json — the named parts in every built scene — from the scene
 * sources. It powers "Seen in" links, part search and the follow-the-power path.
 * Run with UPDATE_PART_INDEX=1 to rewrite it; otherwise the test fails if it is out of date.
 */

const NAME = /<Part\b[\s\S]{0,400}?\bname=(?:"([^"]+)"|\{'([^']+)'\}|\{`([^`$]+)`\})/g

function namesIn(files: string[]) {
  const out = new Set<string>()
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    for (const m of src.matchAll(NAME)) {
      const n = (m[1] ?? m[2] ?? m[3]).trim()
      if (n && n.length < 80) out.add(n)
    }
  }
  return out
}

function tsxIn(dir: string) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.tsx')).map((f) => path.join(dir, f)) : []
}

export function buildIndex() {
  const tractor = namesIn(['src/tractor/Tractor.tsx'])
  const shared = namesIn(['src/modules/implements/_shared/field.tsx'])
  const index: Record<string, string[]> = {}
  for (const m of MODULES) {
    for (const s of m.scenes) {
      const dir = `src/modules/${m.id}/${s.folder ?? s.id}`
      if (!fs.existsSync(path.join(dir, 'index.tsx'))) continue
      const files = tsxIn(dir)
      const names = namesIn(files)
      const src = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
      if (/<Tractor\b|<FieldRun\b/.test(src)) for (const n of tractor) names.add(n)
      if (/<FieldRun\b/.test(src)) for (const n of shared) names.add(n)
      index[`${m.id}/${s.id}`] = [...names].sort()
    }
  }
  return index
}

const FILE = 'src/content/partIndex.json'

describe('part index', () => {
  it('is up to date with the scene sources', () => {
    const fresh = buildIndex()
    if (process.env.UPDATE_PART_INDEX) fs.writeFileSync(FILE, JSON.stringify(fresh, null, 1) + '\n')
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    expect(saved).toEqual(fresh)
  })

  it('knows the tractor parts in a tractor scene', () => {
    const idx = buildIndex()
    expect(idx['field/field']).toContain('Rear wheels')
    expect(idx['implements/mouldboard']).toContain('Gearbox')
  })
})
