// scores corrected models (a folder of {id, col, prompt, explanation, spec}) and writes what to store for each:
// the spec, today's score and checks (keeping the stored build-time check), and whether its picture is now stale
import fs from 'node:fs'
import path from 'node:path'
import { scoreBuild } from '../src/evals/score'
const [dir, before, out] = process.argv.slice(2)
const rows = []
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const old = JSON.parse(fs.readFileSync(path.join(before, f), 'utf8'))
  const timed = (old.checks ?? []).find((x: { name: string }) => x.name === 'under two minutes')
  const r = scoreBuild({ id: 'draft', prompt: d.prompt ?? '' }, { spec: d.spec, explanation: d.explanation ?? '' }, 0)
  const checks = r.checks.map((x) => (x.name === 'under two minutes' && timed ? timed : x))
  const score = Math.round((100 * checks.filter((x) => x.ok).length) / Math.max(1, checks.length))
  // the picture is stale when the parts changed (not when only labels or units did)
  const dropThumb = JSON.stringify(d.spec.parts) !== JSON.stringify(old.spec.parts)
  const parts = (function count(l: { children?: unknown[] }[]): number { return l.reduce((n, p) => n + 1 + count((p.children ?? []) as never), 0) })(d.spec.parts)
  rows.push({ col: d.col, id: d.id, title: d.title, spec: d.spec, score, checks, parts, dropThumb })
  console.log(d.col.padEnd(13), d.id, `${old.score} -> ${score}`, dropThumb ? 'new picture' : 'labels only', d.title, checks.filter((c) => !c.ok).map((c) => c.name).join(', '))
}
fs.writeFileSync(out, JSON.stringify(rows))
