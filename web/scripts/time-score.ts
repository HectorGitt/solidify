// times the admin review page's live scoring of every saved draft (what it does on first render)
import fs from 'node:fs'
import path from 'node:path'
import { scoreBuild } from '../src/evals/score'
const dir = process.argv[2]
let total = 0
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('libraryDrafts-'))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const t = performance.now()
  const r = scoreBuild({ id: 'draft', prompt: d.prompt }, { spec: d.spec, explanation: d.explanation ?? '' }, 0)
  const ms = performance.now() - t
  total += ms
  console.log(ms.toFixed(0).padStart(6), 'ms', String(r.score).padStart(4), d.title)
}
console.log('total', total.toFixed(0), 'ms')
