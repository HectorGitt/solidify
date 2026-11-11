// scores every saved draft in a folder with today's checks (what the admin review page does), printing each
// draft's score, its failed checks and how long the scoring took
//   npx tsx scripts/time-score.ts <folder of dumped drafts>
import fs from 'node:fs'
import path from 'node:path'
import { scoreBuild } from '../src/evals/score'

const dir = process.argv[2]
let total = 0
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const t = performance.now()
  const r = scoreBuild({ id: 'draft', prompt: d.prompt ?? '' }, { spec: d.spec, explanation: d.explanation ?? '' }, 0)
  const ms = performance.now() - t
  total += ms
  console.log(String(r.score).padStart(4), `${ms.toFixed(0)} ms`.padStart(8), d.col === 'library' ? 'LIB  ' : 'draft', d.id, d.title)
  for (const c of r.checks) if (!c.ok && c.name !== 'under two minutes') console.log(`        ${c.name}: ${c.detail ?? ''}`)
}
console.log('total', total.toFixed(0), 'ms')
