import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'
import { generatePromoWav } from './generate-promo-audio.mjs'

const FPS = 24
const WIDTH = 1280
const HEIGHT = 720
const FRAMES_DIR = path.resolve('docs/.promo-frames')
const AUDIO_WAV = path.resolve('docs/.promo-audio.wav')
const OUTPUT_MP4 = path.resolve('docs/solidify-promo.mp4')

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]

function findBrowser() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p
  }
  throw new Error('Could not find Edge or Chrome executable.')
}

function runFfmpeg(framesDir, audioWav, outputMp4, fps) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.join(framesDir, 'frame_%04d.jpg'),
      '-i',
      audioWav,
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      '-movflags',
      '+faststart',
      outputMp4,
    ]
    const ff = spawn('ffmpeg', args, { stdio: 'inherit' })
    ff.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}`))
    })
  })
}

async function main() {
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true })
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true })

  console.log('Synthesizing 30.0s 48kHz stereo commercial soundtrack & SFX...')
  generatePromoWav(AUDIO_WAV)

  console.log('Starting programmatic Vite server...')
  const server = await createServer({
    server: { port: 4179, strictPort: false, hmr: false, watch: null },
  })
  await server.listen()
  const resolvedUrl = server.resolvedUrls?.local[0] || 'http://localhost:4179/'
  const url = `${resolvedUrl.replace(/\/$/, '')}/#/promo`
  console.log(`Vite listening at ${url}`)

  const executablePath = findBrowser()
  console.log(`Launching browser: ${executablePath}`)
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
  })

  try {
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()

    page.on('pageerror', (err) => console.error('Page error:', err))
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('Browser console error:', msg.text())
    })

    console.log(`Navigating to ${url}...`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 })

    console.log('Waiting for 3D geometries & CSG workers to finish preloading...')
    await page.waitForFunction(() => window.__promoReady === true, null, { timeout: 120000 })
    // Extra settle time for environment maps & fonts
    await page.waitForTimeout(1500)

    const cdp = await context.newCDPSession(page)
    const duration = await page.evaluate(() => window.__promoDuration || 30)
    const totalFrames = Math.floor(duration * FPS)
    console.log(`Recording ${totalFrames} frames (${duration}s @ ${FPS}fps)...`)

    for (let i = 0; i < totalFrames; i++) {
      const t = i / FPS
      await page.evaluate(async (time) => {
        if (window.__setPromoTime) window.__setPromoTime(time)
        // Wait 2 requestAnimationFrames so React commits and Three.js gl.render executes
        await new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve)
          })
        })
      }, t)

      const framePath = path.join(FRAMES_DIR, `frame_${String(i).padStart(4, '0')}.jpg`)
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
      fs.writeFileSync(framePath, Buffer.from(data, 'base64'))

      if (i % 60 === 0 || i === totalFrames - 1) {
        console.log(`Captured frame ${i + 1}/${totalFrames} (${t.toFixed(1)}s)`)
      }
    }

    console.log('Encoding MP4 + Stereo AAC Audio with FFmpeg...')
    await runFfmpeg(FRAMES_DIR, AUDIO_WAV, OUTPUT_MP4, FPS)
    console.log(`Successfully generated promo video: ${OUTPUT_MP4}`)
  } finally {
    await browser.close()
    await server.close()
    if (fs.existsSync(FRAMES_DIR)) {
      fs.rmSync(FRAMES_DIR, { recursive: true, force: true })
    }
    if (fs.existsSync(AUDIO_WAV)) {
      fs.rmSync(AUDIO_WAV, { force: true })
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
