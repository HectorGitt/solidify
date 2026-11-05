import { api, ApiError } from '@/cloud/api'
import {
  type RenderedTextbookPage,
  type TextbookDocument,
  type TextbookParagraphBlock,
} from './sampleTextbooks'
import type { DetectedPageFigure, NoteSceneSpec } from './schema'

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
  const res = await api<{ figures: DetectedPageFigure[] }>('/v1/notes/analyze', {
    body: {
      pageNumber: opts.pageNumber,
      pageImageBase64: opts.pageImageUrl,
      pageText: opts.pageText,
      fileName: opts.fileName,
      cropBox: opts.cropBox,
    },
  })
  // only figures Solidify can show in 3D are overlaid; the rest stay as printed on the page
  const showable = (res?.figures ?? []).filter((f) => f?.visualization?.kind === 'catalog' || f?.visualization?.kind === 'procedural')
  return Promise.all(
    showable.map(async (f) => ({
      ...f,
      originalCropUrl: f.originalCropUrl ?? (await cropFigureFromPage(opts.pageImageUrl, f.box)),
    })),
  )
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

export async function loadUploadedDocument(file: File): Promise<TextbookDocument> {
  const baseTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')

  // Case 1: Image file (PNG, JPG, WEBP, SVG) — e.g. screenshot of a textbook page or scan of notes
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(file.name)) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Could not read image file'))
      reader.readAsDataURL(file)
    })

    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.width || 850, h: img.height || 1100 })
      img.onerror = () => resolve({ w: 850, h: 1100 })
      img.src = dataUrl
    })

    const figures = await analyzeTextbookPage({
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
        },
      ],
    }
  }

  // Case 2: PDF file — render each page with PDF.js, then find its figures with the API
  const buffer = await file.arrayBuffer()
  try {
    // bundled with the app (loaded only when a PDF is opened), so it works on networks that block CDNs
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const doc = await pdfjs.getDocument({ data: buffer }).promise
    const maxPages = Math.min(doc.numPages, 6)
    const pages: RenderedTextbookPage[] = []

    for (let p = 1; p <= maxPages; p++) {
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

      const figures = await analyzeTextbookPage({
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
      })
    }

    return {
      id: `pdf-${Date.now()}`,
      title: baseTitle,
      subtitle: `PDF Textbook Extract (${pages.length} ${pages.length === 1 ? 'page' : 'pages'})`,
      sourceLabel: file.name,
      courseCode: pages[0]?.figures[0]?.courseTag ?? 'ENG',
      pages,
    }
  } catch (e) {
    // sign-in, allowance and connection problems are shown as they are
    if (e instanceof ApiError) throw e
    throw new Error('Couldn’t open this PDF. Try another file, or upload a photo of the page.')
  }
}
