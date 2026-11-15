/**
 * Share links (solidify.studio/s/<id>): WhatsApp, Telegram, X and the rest read the page for a preview (title,
 * a line of text, a picture) and never run its script, and they never see anything after a "#". So this page
 * is answered here, on Netlify's edge: the shared model's title, its question (or summary) and its picture, in
 * the preview tags, and a person's browser goes straight on to the app at /#/s/<id> (keeping ?try=1).
 * If the API can't be reached, the preview is the site's own and the link still opens.
 */

const API = 'https://solidify-api-6b27sr35hq-ew.a.run.app'
const SITE_IMAGE = 'https://solidify.studio/media/og.jpg'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

interface Shared {
  title?: string
  by?: string
  thumbnail?: string
  spec?: { summary?: unknown; question?: { text?: unknown } }
}

export default async function sharePreview(req: Request): Promise<Response | undefined> {
  const url = new URL(req.url)
  const m = /^\/s\/([a-z0-9]{6,20})\/?$/.exec(url.pathname)
  if (!m) return undefined
  const id = m[1]
  const practice = url.searchParams.get('try') === '1'
  const target = `/#/s/${id}${practice ? '?try=1' : ''}`

  let title = 'A model shared on Solidify'
  let text = 'Open it in 3D: turn it, cut it open and move its sliders. No account needed.'
  let image = SITE_IMAGE
  try {
    const r = await fetch(`${API}/v1/shared/${id}`, { signal: AbortSignal.timeout(3500) })
    if (r.ok) {
      const d = (await r.json()) as Shared
      const q = typeof d.spec?.question?.text === 'string' ? d.spec.question.text.trim() : ''
      const summary = typeof d.spec?.summary === 'string' ? d.spec.summary.trim() : ''
      if (d.title) title = clip(d.title, 90)
      if (q) {
        title = practice ? `Try this: ${title}` : `Worked solution: ${title}`
        text = clip(`${q} ${practice ? 'Try it in 3D; the answers show once you have.' : 'Solved step by step, in 3D.'}`, 220)
      } else if (summary) text = clip(`${summary} Open it in 3D.`, 220)
      if (d.by) text = `${text} Shared by ${clip(d.by, 30)}.`
      if (d.thumbnail) image = `${API}/v1/shared/${id}/image`
    } else if (r.status === 404) {
      title = 'This link no longer opens'
      text = 'Whoever shared it has stopped sharing it. Solidify: engineering in 3D.'
    }
  } catch {
    /* the API is slow or down: the site's own preview, and the link still opens */
  }

  const page = `${url.origin}/s/${id}${practice ? '?try=1' : ''}`
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · Solidify</title>
<meta name="description" content="${esc(text)}" />
<meta property="og:site_name" content="Solidify" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(text)}" />
<meta property="og:url" content="${esc(page)}" />
<meta property="og:image" content="${esc(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(text)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta name="robots" content="noindex" />
<meta http-equiv="refresh" content="0;url=${esc(target)}" />
<script>location.replace(${JSON.stringify(target)})</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:2rem">
<p><a href="${esc(target)}">Open ${esc(title)} on Solidify</a></p>
</body>
</html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } })
}

export const config = { path: '/s/*' }
