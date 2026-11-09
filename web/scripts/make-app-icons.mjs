// Renders the installed-app icons from public/favicon.svg (run from web/: node scripts/make-app-icons.mjs).
// "any" icons are the logo as it is; the maskable one sits the logo inside the safe zone on its own dark ground,
// so a phone's round or squircle mask never cuts it.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const svg = fs.readFileSync('public/favicon.svg', 'utf8')
const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
fs.mkdirSync('public/icons', { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const page = await browser.newPage()
const shoot = async (size, file, scale, bg) => {
  await page.setViewportSize({ width: size, height: size })
  const inner = Math.round(size * scale)
  await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}"><img src="${uri}" style="width:${inner}px;height:${inner}px"></body></html>`)
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: bg === 'transparent' })
}
await shoot(192, 'icon-192.png', 1, 'transparent')
await shoot(512, 'icon-512.png', 1, 'transparent')
await shoot(512, 'maskable-512.png', 0.9, '#0c110f')
await shoot(180, 'apple-touch-icon.png', 1.05, '#0c110f')
await browser.close()
console.log(fs.readdirSync('public/icons'))
