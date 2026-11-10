// Builds the open model format's files (format/ in the repo root):
//   format/schema/slfy-<version>.schema.json   the JSON Schema, generated from the app's own zod schemas
//   format/examples/*.slfy                     the examples, from format/source (reviewed library exports,
//                                              a worked question, hand-written tutorials), each cleaned the
//                                              way the app cleans any model and checked against the schema
// and copies both into web/public/slfy/ so the app serves them (the Open a model file page lists them).
//
//   npx tsx scripts/format-build.ts        (from web/)
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { sanitizeGeneratedSpec } from '../src/note3d/sanitize'
import { SLFY_VERSION, fromSlfy, slfyFileSchema, toSlfy, validateSlfy } from '../src/note3d/slfyFormat'

const ROOT = path.resolve('..', 'format')
const SRC = path.join(ROOT, 'source')
const EXAMPLES = path.join(ROOT, 'examples')
const SCHEMA_DIR = path.join(ROOT, 'schema')
const PUBLIC = path.resolve('public', 'slfy')
const SCHEMA_URL = `https://slfy.solidify.studio/schema/slfy-${SLFY_VERSION}.schema.json`

// the published name of each source file
const NAMES: Record<string, string> = {
  '01-minimal-block.json': 'minimal-block',
  '02-parametric-shaft.json': 'shaft-in-torsion',
  '03-gear-pair.json': 'spur-gear-pair',
  'beam-question.mjs': 'beam-question',
  'helical-gear-pair-on-parallel-shafts.json': 'helical-gear-pair',
  'worm-worm-wheel-reducer-30-1.json': 'worm-reducer',
  'open-differential-mechanism.json': 'open-differential',
  'scotch-yoke-mechanism.json': 'scotch-yoke',
  'crank-slotted-lever-quick-return-mechanism.json': 'quick-return-mechanism',
  'rigid-sleeve-muff-coupling.json': 'muff-coupling',
}

fs.mkdirSync(EXAMPLES, { recursive: true })
fs.mkdirSync(SCHEMA_DIR, { recursive: true })
fs.mkdirSync(path.join(PUBLIC, 'examples'), { recursive: true })

// --- the schema ------------------------------------------------------------------------------------------
const json = z.toJSONSchema(slfyFileSchema, { target: 'draft-2020-12', cycles: 'ref', reused: 'ref' }) as Record<string, unknown>
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: SCHEMA_URL,
  title: `Solidify model file (.slfy) ${SLFY_VERSION}`,
  description: 'A 3D engineering model that moves and calculates: parameters, parts placed by relation, motion, annotations, live calculations, charts and the question it answers. See format/SPEC.md.',
  ...json,
}
const schemaFile = `slfy-${SLFY_VERSION}.schema.json`
fs.writeFileSync(path.join(SCHEMA_DIR, schemaFile), JSON.stringify(schema, null, 2) + '\n')
fs.copyFileSync(path.join(SCHEMA_DIR, schemaFile), path.join(PUBLIC, schemaFile))
console.log(`schema: format/schema/${schemaFile}`)

// --- the examples ----------------------------------------------------------------------------------------
const index: { file: string; title: string; summary: string; parts: number; calculations: number; question: boolean }[] = []
let failed = 0
for (const [src, name] of Object.entries(NAMES)) {
  const file = path.join(SRC, src)
  if (!fs.existsSync(file)) {
    console.log(`  missing ${src}`)
    failed++
    continue
  }
  const raw = src.endsWith('.mjs') ? (await import(pathToFileURL(file).href)).spec : JSON.parse(fs.readFileSync(file, 'utf8'))
  const read = fromSlfy(raw)
  if (!read.ok) {
    console.log(`  ${src}: ${read.error}`)
    failed++
    continue
  }
  const spec = sanitizeGeneratedSpec(read.spec, read.title)
  if (!spec) {
    console.log(`  ${src}: nothing the app can draw`)
    failed++
    continue
  }
  spec.id = name
  const out = { $schema: SCHEMA_URL, ...toSlfy(spec, { generator: 'Solidify (solidify.studio)', license: 'CC-BY-4.0', created: new Date().toISOString().slice(0, 10) }) }
  const check = validateSlfy(out)
  if (!check.ok) {
    console.log(`  ${name}: does not pass the schema:\n    ${check.issues.join('\n    ')}`)
    failed++
    continue
  }
  const text = JSON.stringify(out, null, 2) + '\n'
  fs.writeFileSync(path.join(EXAMPLES, `${name}.slfy`), text)
  fs.writeFileSync(path.join(PUBLIC, 'examples', `${name}.slfy`), text)
  index.push({ file: `${name}.slfy`, title: spec.title, summary: spec.summary, parts: spec.parts.length, calculations: spec.calculations?.length ?? 0, question: !!spec.question })
  console.log(`  ${name}.slfy: ${spec.parts.length} parts, ${spec.calculations?.length ?? 0} calculations${spec.question ? ', a question' : ''}`)
}
fs.writeFileSync(path.join(PUBLIC, 'examples', 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log(`${index.length} examples${failed ? `, ${failed} failed` : ''}`)
if (failed) process.exitCode = 1
