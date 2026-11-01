// One genuine tutor answer for the promo's Ask clip, built exactly as the API builds it, from Gemini on Vertex:
//   cd api && npx tsx ../web/scripts/promo/tutor-answer.mts <tutor-context.json> <tutor-answer.json> "<question>"
// (tutor-context.json comes from tutor-context.mjs; needs a gcloud login with access to solidify-studio)
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { SYSTEM_PROMPT, buildTurns } from '../../../api/src/tutor.ts'
const [ctxFile, outFile, question] = process.argv.slice(2)
const c = JSON.parse(fs.readFileSync(ctxFile, 'utf8'))
const turns = buildTurns({ question, history: [], context: { route: c.route, scene: c.scene, sceneSummary: c.sceneSummary, view: c.view, part: c.part, live: c.live, working: c.working, mode: 'professional' } } as never)
const token = execSync('gcloud auth print-access-token --account=ola@solidify.studio', { encoding: 'utf8' }).trim()
const url = 'https://aiplatform.googleapis.com/v1/projects/solidify-studio/locations/global/publishers/google/models/gemini-3.8-flash:generateContent'
const res = await fetch(url, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
  }),
})
const j = await res.json() as any
if (!res.ok) { console.log(res.status, JSON.stringify(j).slice(0, 500)); process.exit(1) }
const text = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? ''
fs.writeFileSync(outFile, JSON.stringify({ question, answer: text, model: 'gemini-3.8-flash', at: new Date().toISOString() }, null, 1))
console.log(text)
