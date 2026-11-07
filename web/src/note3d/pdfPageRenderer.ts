import { api, ApiError } from '@/cloud/api'
import {
  type RenderedTextbookPage,
  type TextbookDocument,
  type TextbookParagraphBlock,
} from './sampleTextbooks'
import type { DetectedPageFigure, FigureCandidate, NoteSceneSpec } from './schema'
import { sanitizeGeneratedSpec } from './sanitize'

/**
 * Crops a normalized `[ymin, xmin, ymax, xmax]` (0..1000) region out of a page image Data URL
 * so the student can toggle between the 3D model and the original 2D figure from their PDF/note.
 */
export async function cropFigureFromPage(
  pageImageUrl: string,
  box: [number, number, number, number],
): Promise<string> {
  if (typeof document === 'undefined') return pageImageUrl
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const [ymin, xmin, ymax, xmax] = box
      const sx = Math.max(0, Math.round((xmin / 1000) * img.width))
      const sy = Math.max(0, Math.round((ymin / 1000) * img.height))
      const sw = Math.max(32, Math.round(((xmax - xmin) / 1000) * img.width))
      const sh = Math.max(32, Math.round(((ymax - ymin) / 1000) * img.height))
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(pageImageUrl)
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, sw, sh)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(pageImageUrl)
    img.src = pageImageUrl
  })
}

/**
 * Finds the figures on a page with Solidify's API (Gemini). Errors (not signed in, today's pages used,
 * server unreachable) go back to the page to show; nothing is guessed without the model.
 */
export async function analyzeTextbookPage(opts: {
  pageNumber: number
  pageImageUrl: string
  pageText: string
  fileName: string
  cropBox?: [number, number, number, number]
}): Promise<DetectedPageFigure[]> {
  return (await analyzeTextbookPageAll(opts)).figures
}

/** a page's figures shown in 3D now, and the drawings that can be built on request */
export async function analyzeTextbookPageAll(opts: {
  pageNumber: number
  pageImageUrl: string
  pageText: string
  fileName: string
  cropBox?: [number, number, number, number]
}): Promise<{ figures: DetectedPageFigure[]; candidates: FigureCandidate[] }> {
  const res = await api<{ figures: DetectedPageFigure[] }>('/v1/notes/analyze', {
    body: {
      pageNumber: opts.pageNumber,
      pageImageBase64: opts.pageImageUrl,
      pageText: opts.pageText,
      fileName: opts.fileName,
      cropBox: opts.cropBox,
    },
  })
  // only figures Solidify can show in 3D are overlaid; drawings it can build wait as candidates; the rest stay as printed
  const all = res?.figures ?? []
  const showable = all.filter((f) => f?.visualization?.kind === 'catalog' || f?.visualization?.kind === 'procedural')
  const candidates: FigureCandidate[] = all
    .filter((f) => (f?.visualization as { kind?: string } | undefined)?.kind === 'build' && Array.isArray(f.box) && f.box.length === 4)
    .map((f, i) => ({ id: f.id || `cand-${opts.pageNumber}-${i}`, pageNumber: opts.pageNumber, box: f.box, title: f.title || 'Figure', caption: f.caption || '' }))
  const figures = await Promise.all(
    showable.map(async (f) => ({
      ...f,
      originalCropUrl: f.originalCropUrl ?? (await cropFigureFromPage(opts.pageImageUrl, f.box)),
    })),
  )
  return { figures, candidates }
}

/**
 * Builds a figure in 3D the way Create in 3D builds from a photo: a picture of the region and the words
 * around it go to the full build prompt, so trusses, frames and assemblies work too, with their loads,
 * graphs and calculations. Counts as one 3D build.
 */
export async function buildFigureFromPage(opts: {
  pageNumber: number
  pageImageUrl: string
  pageText: string
  box: [number, number, number, number]
  title?: string
  caption?: string
}): Promise<DetectedPageFigure | null> {
  const crop = await cropFigureFromPage(opts.pageImageUrl, opts.box)
  const words = [opts.title, opts.caption].filter(Boolean).join(': ')
  const prompt = `Build the engineering figure in this picture, from page ${opts.pageNumber} of a student's notes${words ? ` (${words})` : ''}. Use the sizes, loads and values it shows; where it leaves one out, take it from this text from the page: ${opts.pageText.slice(0, 1500)}`
  const res = await api<Record<string, unknown>>('/v1/create-3d', { body: { prompt: prompt.slice(0, 2000), photoBase64: crop } })
  const spec = sanitizeGeneratedSpec(res, prompt)
  if (!spec) return null
  return {
    id: `built-${opts.pageNumber}-${Date.now().toString(36)}`,
    pageNumber: opts.pageNumber,
    box: opts.box,
    title: opts.title || spec.title,
    caption: opts.caption || (typeof res.explanation === 'string' ? res.explanation.slice(0, 200) : ''),
    confidence: 1,
    chosen: true,
    originalCropUrl: crop,
    extractedGivens: [],
    visualization: { kind: 'procedural', spec },
  }
}

/**
 * Refines a procedural `NoteSceneSpec` in-place from a natural-language student instruction.
 */
export async function refineFigureSpec(
  currentSpec: NoteSceneSpec,
  instruction: string,
): Promise<NoteSceneSpec> {
  const res = await api<{ spec: NoteSceneSpec }>('/v1/notes/refine', { body: { currentSpec, instruction } })
  return res.spec
}

/** pages read in one go: the daily allowance of note pages */
export const MAX_PAGES_PER_READ = 20

async function openPdf(file: File) {
  // bundled with the app (loaded only when a PDF is opened), so it works on networks that block CDNs
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
}

export const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

/** how many pages a PDF has (to ask which to read) */
export async function pdfPageCount(file: File): Promise<number> {
  try {
    return (await openPdf(file)).numPages
  } catch {
    throw new Error('Couldn’t open this PDF. Try another file, or upload a photo of the page.')
  }
}

export async function loadUploadedDocument(file: File, onPage?: (page: number, total: number) => void, range?: { from: number; to: number }): Promise<TextbookDocument> {
  const baseTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')

  // Case 1: Image file (PNG, JPG, WEBP, SVG) — e.g. screenshot of a textbook page or scan of notes
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(file.name)) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read image file'))
      reader.readAsDataURL(file)
    })

    onPage?.(1, 1)
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.width || 850, h: img.height || 1100 })
      img.onerror = () => resolve({ w: 850, h: 1100 })
      img.src = dataUrl
    })

    const { figures, candidates } = await analyzeTextbookPageAll({
      pageNumber: 1,
      pageImageUrl: dataUrl,
      pageText: baseTitle,
      fileName: file.name,
      cropBox: [140, 60, 840, 940],
    })

    const blocks: TextbookParagraphBlock[] = [
      { kind: 'heading', number: '1.1', text: baseTitle },
      {
        kind: 'paragraph',
        text: `Uploaded engineering document page (${file.name}). The 2D diagram region has been replaced in-place with an interactive 3D model view below.`,
      },
      ...figures.map((f) => ({ kind: 'figure-slot' as const, figureId: f.id })),
    ]

    return {
      id: `upload-${Date.now()}`,
      title: baseTitle,
      subtitle: `Uploaded Page · ${file.name}`,
      sourceLabel: file.name,
      courseCode: figures[0]?.courseTag ?? 'ENG',
      pages: [
        {
          pageNumber: 1,
          pageImageUrl: dataUrl,
          aspectRatio: dims.w / dims.h,
          pageText: baseTitle,
          blocks,
          figures,
          candidates,
        },
      ],
    }
  }

  // Case 2: PDF file — render each page with PDF.js, then find its figures with the API
  try {
    const doc = await openPdf(file)
    // the pages asked for (the first 6 if none were), at most a day's allowance at a time
    const from = Math.max(1, Math.min(doc.numPages, range?.from ?? 1))
    const to = Math.max(from, Math.min(doc.numPages, range?.to ?? from + 5, from + MAX_PAGES_PER_READ - 1))
    const pages: RenderedTextbookPage[] = []

    for (let p = from; p <= to; p++) {
      onPage?.(p - from + 1, to - from + 1)
      const page = await doc.getPage(p)
      const viewport = page.getViewport({ scale: 1.75 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      const pageImageUrl = canvas.toDataURL('image/jpeg', 0.9)

      const textContent = await page.getTextContent()
      const strings: string[] = textContent.items.map((it: any) => String(it.str ?? '')).filter(Boolean)
      const pageText = strings.join(' ')

      const { figures, candidates } = await analyzeTextbookPageAll({
        pageNumber: p,
        pageImageUrl,
        pageText: pageText || baseTitle,
        fileName: file.name,
      })

      const blocks: TextbookParagraphBlock[] = [
        { kind: 'heading', number: `Page ${p}`, text: baseTitle },
        {
          kind: 'paragraph',
          text: pageText.slice(0, 650) || `Extracted page ${p} from ${file.name}.`,
        },
        ...figures.map((f) => ({ kind: 'figure-slot' as const, figureId: f.id })),
      ]

      pages.push({
        pageNumber: p,
        pageImageUrl,
        aspectRatio: viewport.width / viewport.height,
        pageText,
        blocks,
        figures,
        candidates,
      })
    }

    return {
      id: `pdf-${Date.now()}`,
      title: baseTitle,
      subtitle: `PDF Textbook Extract (${pages.length} ${pages.length === 1 ? 'page' : 'pages'})`,
      sourceLabel: file.name,
      courseCode: pages[0]?.figures[0]?.courseTag ?? 'ENG',
      pages,
      pageCount: doc.numPages,
    }
  } catch (e) {
    // sign-in, allowance and connection problems are shown as they are
    if (e instanceof ApiError) throw e
    throw new Error('Couldn’t open this PDF. Try another file, or upload a photo of the page.')
  }
}
