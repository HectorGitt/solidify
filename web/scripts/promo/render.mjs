// Render comp.html frame by frame, then encode with the score:
//   node scripts/promo/render.mjs <v2 dir> [--from s] [--to s] [--every n] [--sheet]
import { chromium } from 'playwright-core'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = path.resolve(process.argv[2])
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const every = Number(arg('--every', 1))
const sheet = process.argv.includes('--sheet')
const frames = path.join(dir, sheet ? 'sheet' : 'frames')
fs.mkdirSync(frames, { recursive: true })
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files', '--disable-web-security'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => console.log('pageerror', e.message))
const shots = pathToFileURL(path.join(dir, 'shots')).href + '/'
await page.goto(pathToFileURL(path.resolve('scripts/promo/comp.html')).href + '?shots=' + encodeURIComponent(shots))
await page.waitForFunction(() => window.PROMO_READY)
await page.evaluate(() => window.PROMO_READY)
const { DURATION, FPS } = await page.evaluate(() => window.PROMO)
const from = Math.round(Number(arg('--from', 0)) * FPS)
const to = Math.round(Number(arg('--to', DURATION)) * FPS)
const t0 = Date.now()
let k = 0
for (let f = from; f < to; f += every) {
  await page.evaluate((t) => window.render(t), f / FPS)
  await page.screenshot({ path: path.join(frames, (sheet ? `t${(f / FPS).toFixed(2)}` : String(f).padStart(5, '0')) + '.jpg'), type: 'jpeg', quality: 95 })
  if (++k % 120 === 0) console.log(`${f}/${to} ${((Date.now() - t0) / k).toFixed(0)} ms/frame`)
}
await browser.close()
console.log('rendered', k, 'frames')
// a full render encodes; so does --encode after re-rendering only a range (the other frames are reused)
if (!sheet && every === 1 && ((from === 0 && to >= DURATION * FPS) || process.argv.includes('--encode'))) {
  const wav = path.join(dir, 'score.wav')
  const out = path.join(dir, 'solidify-promo.mp4')
  const a = ['-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg')]
  if (fs.existsSync(wav)) a.push('-i', wav)
  a.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart')
  if (fs.existsSync(wav)) a.push('-c:a', 'aac', '-b:a', '256k', '-shortest')
  a.push(out)
  const r = spawnSync('ffmpeg', a, { stdio: 'inherit' })
  console.log(r.status === 0 ? 'wrote ' + out : 'ffmpeg failed')
}
