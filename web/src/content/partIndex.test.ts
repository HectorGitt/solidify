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

/** the tractor's systems, mounted in place on every procedural tractor */
const TRACTOR_FILES = ['Tractor', 'DrivelineInternals', 'FinalDrives', 'PtoDrive', 'Hydraulics', 'Steering', 'Cooling', 'Fuel', 'Electrical'].map((n) => `src/tractor/${n}.tsx`)
/** parts only a tractor variant has, credited only where a scene asks for that variant */
const VARIANTS: { when: RegExp; names: string[] }[] = [
  { when: /frame="articulated"/, names: ['Articulation hinge & steering rams', 'Front propeller shaft'] },
  { when: /drive="4wd"/, names: ['Transfer box & front propeller shaft'] },
  { when: /running="tracks"/, names: ['Tracks'] },
]
/** the shared engine's part names (its NAMES table) */
function engineNames() {
  const src = fs.readFileSync('src/machines/Engine.tsx', 'utf8')
  const start = src.indexOf('const NAMES')
  const table = src.slice(start, src.indexOf('}', start))
  return new Set([...table.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]))
}

export function buildIndex() {
  const tractor = namesIn(TRACTOR_FILES)
  const variantOnly = new Set(VARIANTS.flatMap((v) => v.names))
  const engine = engineNames()
  const shared = namesIn(['src/modules/implements/_shared/field.tsx'])
  const index: Record<string, string[]> = {}
  for (const m of MODULES) {
    for (const s of m.scenes) {
      const dir = `src/modules/${m.id}/${s.folder ?? s.id}`
      if (!fs.existsSync(path.join(dir, 'index.tsx'))) continue
      const files = tsxIn(dir)
      const names = namesIn(files)
      const src = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
      const hasTractor = /<Tractor\b|<FieldRun\b/.test(src)
      if (hasTractor) for (const n of tractor) if (!variantOnly.has(n)) names.add(n)
      if (hasTractor) for (const v of VARIANTS) if (v.when.test(src)) for (const n of v.names) names.add(n)
      if (hasTractor || /<Engine\b/.test(src)) for (const n of engine) names.add(n)
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
