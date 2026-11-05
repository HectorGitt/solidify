import { api, ApiError } from '@/cloud/api'
import {
  BEARING_BRACKET_ORTHO_SPEC,
  FLANGED_COUPLING_SPEC,
  STEPPED_GEAR_SHAFT_SPEC,
  type RenderedTextbookPage,
  type TextbookDocument,
  type TextbookParagraphBlock,
} from './sampleTextbooks'
import type { DetectedPageFigure, FigureVisualization, NoteSceneSpec } from './schema'

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
 * Smart Client-Side Engineering Classifier & Parameter Hydrator:
 * Matches textbook text / captions / filenames to either one of Solidify's 114 catalog scenes
 * hydrated with numbers extracted from the text, or a tailored procedural `NoteSceneSpec`.
 */
export function classifyEngineeringFigure(
  textContext: string,
  index = 0,
): {
  title: string
  caption: string
  courseTag: string
  extractedGivens: { symbol: string; label: string; value: number; unit: string }[]
  visualization: FigureVisualization
} {
  const lower = textContext.toLowerCase()

  const extractNumber = (re: RegExp, fallback: number): number => {
    const m = re.exec(textContext)
    if (!m) return fallback
    const v = parseFloat(m[1])
    return Number.isFinite(v) ? v : fallback
  }

  // 1. Beam bending / shear / deflection
  if (/\b(beam|cantilever|udl|bending moment|shear force|deflection|simply supported)\b/i.test(lower)) {
    const span = extractNumber(/(?:span|length|l)\s*=\s*([0-9.]+)/i, 3.0)
    const p1 = extractNumber(/(?:load|p_?1|f)\s*=\s*([0-9.]+)/i, 15)
    const w = extractNumber(/(?:udl|w)\s*=\s*([0-9.]+)/i, 4)
    return {
      title: `Figure ${index + 1}`,
      caption: `Beam under point load P = ${p1} kN and distributed load w = ${w} kN/m (span L = ${span} m).`,
      courseTag: 'MEE204',
      extractedGivens: [
        { symbol: 'L', label: 'Beam span', value: span, unit: 'm' },
        { symbol: 'P_1', label: 'Point load', value: p1, unit: 'kN' },
        { symbol: 'w', label: 'Distributed load', value: w, unit: 'kN/m' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'materials',
        sceneId: 'beam',
        params: { span, p1, x1: Number((span * 0.55).toFixed(2)), w, support: lower.includes('cantilever') ? 1 : 0 },
      },
    }
  }

  // 2. Plane stress / Mohr's circle
  if (/\b(mohr|principal stress|plane stress|shear stress|sigma|biaxial)\b/i.test(lower)) {
    const sx = extractNumber(/(?:sigma_?x|σ_?x)\s*=\s*([+-]?[0-9.]+)/i, 75)
    const sy = extractNumber(/(?:sigma_?y|σ_?y)\s*=\s*([+-]?[0-9.]+)/i, -35)
    const txy = extractNumber(/(?:tau|τ)\s*=\s*([+-]?[0-9.]+)/i, 30)
    return {
      title: `Figure ${index + 1}`,
      caption: `3D Plane-stress element and Mohr's circle transformation (σx = ${sx} MPa, σy = ${sy} MPa, τxy = ${txy} MPa).`,
      courseTag: 'MEE204',
      extractedGivens: [
        { symbol: 'σ_x', label: 'Normal stress X', value: sx, unit: 'MPa' },
        { symbol: 'σ_y', label: 'Normal stress Y', value: sy, unit: 'MPa' },
        { symbol: 'τ_xy', label: 'Shear stress', value: txy, unit: 'MPa' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'materials',
        sceneId: 'stress-state',
        params: { sx, sy, txy, angle: 20 },
      },
    }
  }

  // 3. Four-bar linkage / Grashof / mechanism
  if (/\b(four-bar|4-bar|grashof|crank-rocker|coupler|linkage)\b/i.test(lower)) {
    const l1 = extractNumber(/l_?1\s*=\s*([0-9.]+)/i, 240)
    const l2 = extractNumber(/l_?2\s*=\s*([0-9.]+)/i, 80)
    const l3 = extractNumber(/l_?3\s*=\s*([0-9.]+)/i, 210)
    const l4 = extractNumber(/l_?4\s*=\s*([0-9.]+)/i, 140)
    return {
      title: `Figure ${index + 1}`,
      caption: `Planar four-bar linkage (L1 = ${l1} mm, L2 = ${l2} mm, L3 = ${l3} mm, L4 = ${l4} mm).`,
      courseTag: 'MEE301',
      extractedGivens: [
        { symbol: 'L_1', label: 'Ground link', value: l1, unit: 'mm' },
        { symbol: 'L_2', label: 'Input crank', value: l2, unit: 'mm' },
        { symbol: 'L_3', label: 'Coupler', value: l3, unit: 'mm' },
        { symbol: 'L_4', label: 'Rocker', value: l4, unit: 'mm' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'mechanisms',
        sceneId: 'four-bar',
        params: { l1, l2, l3, l4, rpm: 30 },
      },
    }
  }

  // 4. Slider-crank / inversions / Whitworth / quick-return
  if (/\b(slider-crank|whitworth|quick-return|shaper|oscillating cylinder|inversion)\b/i.test(lower)) {
    return {
      title: `Figure ${index + 1}`,
      caption: 'Slider-crank kinematic chain and quick-return mechanism inversion.',
      courseTag: 'MEE301',
      extractedGivens: [
        { symbol: 'r', label: 'Crank radius', value: 70, unit: 'mm' },
        { symbol: 'l', label: 'Connecting rod', value: 210, unit: 'mm' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'mechanisms',
        sceneId: 'inversions',
        params: { crank: 70, rod: 210, rpm: 30 },
      },
    }
  }

  // 5. Gear train / spur / helical / planetary / epicyclic / countershaft
  if (/\b(gear|pinion|epicyclic|planetary|tooth|teeth|countershaft|spur)\b/i.test(lower)) {
    if (/\b(shaft|bearing|countershaft|key)\b/i.test(lower)) {
      return {
        title: `Figure ${index + 1}`,
        caption: 'Stepped transmission countershaft with involute spur gear and support bearings.',
        courseTag: 'MEE202',
        extractedGivens: [
          { symbol: 'N', label: 'Gear teeth', value: 22, unit: '' },
          { symbol: 'm', label: 'Module', value: 4.5, unit: 'mm' },
          { symbol: 'F_t', label: 'Tangential load', value: 3.4, unit: 'kN' },
        ],
        visualization: {
          kind: 'procedural',
          spec: STEPPED_GEAR_SHAFT_SPEC,
        },
      }
    }
    return {
      title: `Figure ${index + 1}`,
      caption: 'Meshing involute gear train showing pitch circles, line of action, and speed ratio.',
      courseTag: 'MEE301',
      extractedGivens: [
        { symbol: 'N_1', label: 'Pinion teeth', value: 18, unit: '' },
        { symbol: 'N_2', label: 'Gear teeth', value: 36, unit: '' },
        { symbol: 'm', label: 'Module', value: 4, unit: 'mm' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'mechanisms',
        sceneId: 'gear-trains',
        params: { n1: 18, n2: 36, module: 4 },
      },
    }
  }

  // 6. Interpenetration / tee cylinder / surface development
  if (/\b(interpenetration|intersecting cylinder|tee|development|branch pipe)\b/i.test(lower)) {
    const mainR = extractNumber(/r\s*=\s*([0-9.]+)/i, 55)
    return {
      title: `Figure ${index + 1}`,
      caption: 'Curve of interpenetration of two intersecting cylinders with lateral surface development.',
      courseTag: 'MEE201',
      extractedGivens: [
        { symbol: 'R', label: 'Main cylinder radius', value: mainR, unit: 'mm' },
        { symbol: 'r', label: 'Branch radius', value: 38, unit: 'mm' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'drawing',
        sceneId: 'interpenetration',
        params: { mainR, branchR: 38, offset: 0, unfold: 0.35 },
      },
    }
  }

  // 7. True length of oblique line
  if (/\b(true length|oblique line|auxiliary inclination|apparent length)\b/i.test(lower)) {
    return {
      title: `Figure ${index + 1}`,
      caption: 'True length and inclinations (θ, φ) of an oblique line AB in space by conical locus rotation.',
      courseTag: 'MEE201',
      extractedGivens: [
        { symbol: 'Δx', label: 'Projector spacing', value: 85, unit: 'mm' },
        { symbol: 'z_B', label: 'Elevation B', value: 75, unit: 'mm' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'drawing',
        sceneId: 'true-length',
        params: { dx: 85, ya: 30, yb: 75, za: 20, zb: 75, rotate: 1 },
      },
    }
  }

  // 8. Orthographic projection / bracket / pedestal / bearing housing
  if (/\b(orthographic|first-angle|third-angle|1st angle|3rd angle|bracket|pedestal|plumber)\b/i.test(lower)) {
    return {
      title: `Figure ${index + 1}`,
      caption: 'Cast-iron pedestal bearing bracket with 1st/3rd-angle orthographic projection planes.',
      courseTag: 'MEE201',
      extractedGivens: [
        { symbol: 'W', label: 'Base width', value: 180, unit: 'mm' },
        { symbol: 'D', label: 'Boss outer dia', value: 84, unit: 'mm' },
        { symbol: 'd', label: 'Bore diameter', value: 48, unit: 'mm' },
      ],
      visualization: {
        kind: 'procedural',
        spec: BEARING_BRACKET_ORTHO_SPEC,
      },
    }
  }

  // 9. Thermodynamics / Rankine / Refrigeration / Heat Exchanger / Diesel
  if (/\b(rankine|steam turbine|boiler|condenser)\b/i.test(lower)) {
    return {
      title: `Figure ${index + 1}`,
      caption: 'Rankine vapour power cycle plant (boiler, steam turbine, condenser, feed pump).',
      courseTag: 'MEE305',
      extractedGivens: [
        { symbol: 'P_high', label: 'Boiler pressure', value: 8, unit: 'MPa' },
        { symbol: 'T_max', label: 'Superheat temp', value: 480, unit: '°C' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'thermal',
        sceneId: 'rankine',
        params: {},
      },
    }
  }

  if (/\b(refrigeration|evaporator|compressor|cop|vapour-compression)\b/i.test(lower)) {
    return {
      title: `Figure ${index + 1}`,
      caption: 'Vapour-compression refrigeration loop with cut-open compressor, condenser, TXV, and evaporator.',
      courseTag: 'MEE305',
      extractedGivens: [
        { symbol: 'T_evap', label: 'Evaporator temp', value: -10, unit: '°C' },
        { symbol: 'T_cond', label: 'Condenser temp', value: 40, unit: '°C' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'thermal',
        sceneId: 'refrigeration',
        params: {},
      },
    }
  }

  if (/\b(diesel|piston|four-stroke|crankshaft|cylinder block|engine)\b/i.test(lower)) {
    return {
      title: `Figure ${index + 1}`,
      caption: 'Four-stroke direct-injection diesel engine cylinder and cranktrain assembly.',
      courseTag: 'AGE301',
      extractedGivens: [
        { symbol: 'r_c', label: 'Compression ratio', value: 17.5, unit: ':1' },
        { symbol: 'N', label: 'Engine speed', value: 1800, unit: 'rpm' },
      ],
      visualization: {
        kind: 'catalog',
        moduleId: 'engine',
        sceneId: 'four-stroke',
        params: {},
      },
    }
  }

  // Default fallback: alternate richly between Flanged Coupling, Stepped Gear Shaft, and Bearing Bracket
  const specs: NoteSceneSpec[] = [FLANGED_COUPLING_SPEC, STEPPED_GEAR_SHAFT_SPEC, BEARING_BRACKET_ORTHO_SPEC]
  const chosen = specs[index % specs.length]
  return {
    title: `Figure ${index + 1}`,
    caption: chosen.summary,
    courseTag: 'MEE202',
    extractedGivens: chosen.parameters.map((p) => ({
      symbol: p.symbol ?? p.id,
      label: p.label,
      value: p.value,
      unit: p.unit,
    })),
    visualization: {
      kind: 'procedural',
      spec: chosen,
    },
  }
}

/**
 * Calls the backend Gemini Vision endpoint `POST /v1/notes/analyze` first;
 * if the backend is offline or unreachable, falls back seamlessly to client-side figure extraction.
 */
export async function analyzeTextbookPage(opts: {
  pageNumber: number
  pageImageUrl: string
  pageText: string
  fileName: string
  cropBox?: [number, number, number, number]
}): Promise<DetectedPageFigure[]> {
  try {
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
    if (showable.length) {
      // Populate originalCropUrl for each returned figure
      const withCrops = await Promise.all(
        showable.map(async (f) => ({
          ...f,
          originalCropUrl: f.originalCropUrl ?? (await cropFigureFromPage(opts.pageImageUrl, f.box)),
        })),
      )
      return withCrops
    }
  } catch (e) {
    // a student who isn't signed in, or has used today's pages, is told so; only an unreachable server falls back
    if (e instanceof ApiError && (e.status === 401 || e.status === 429)) throw e
  }

  const box: [number, number, number, number] = opts.cropBox ?? [210, 75, 680, 925]
  const classified = classifyEngineeringFigure(`${opts.fileName}\n${opts.pageText}`, opts.pageNumber - 1)
  const cropUrl = await cropFigureFromPage(opts.pageImageUrl, box)

  return [
    {
      id: `fig-p${opts.pageNumber}-${Date.now().toString(36)}`,
      pageNumber: opts.pageNumber,
      box,
      title: classified.title,
      caption: classified.caption,
      courseTag: classified.courseTag,
      originalCropUrl: cropUrl,
      extractedGivens: classified.extractedGivens,
      visualization: classified.visualization,
    },
  ]
}

/**
 * Refines a procedural `NoteSceneSpec` in-place from a natural-language student instruction.
 */
export async function refineFigureSpec(
  currentSpec: NoteSceneSpec,
  instruction: string,
): Promise<NoteSceneSpec> {
  try {
    const res = await api<{ spec: NoteSceneSpec }>('/v1/notes/refine', {
      body: {
        currentSpec,
        instruction,
      },
    })
    if (res?.spec) return res.spec
  } catch {
    // Offline fallback: apply deterministic parametric / structural edits locally
  }

  const lower = instruction.toLowerCase()
  const next: NoteSceneSpec = JSON.parse(JSON.stringify(currentSpec))

  if (lower.includes('first-angle') || lower.includes('1st angle')) {
    next.showProjectionPlanes = 'first-angle'
  } else if (lower.includes('third-angle') || lower.includes('3rd angle')) {
    next.showProjectionPlanes = 'third-angle'
  } else if (lower.includes('projection')) {
    next.showProjectionPlanes = next.showProjectionPlanes === 'first-angle' ? 'third-angle' : 'first-angle'
  }

  // Check if user mentioned a number to scale or set a parameter
  const numMatch = /([0-9]+(?:\.[0-9]+)?)\s*(mm|m|teeth|deg)?/i.exec(instruction)
  if (numMatch && next.parameters.length > 0) {
    const rawVal = parseFloat(numMatch[1])
    const unit = (numMatch[2] ?? '').toLowerCase()
    const targetParam =
      next.parameters.find((p) => lower.includes(p.id.toLowerCase()) || lower.includes(p.label.toLowerCase().split(' ')[0])) ??
      next.parameters[0]
    if (targetParam) {
      const converted = unit === 'mm' && targetParam.unit === 'm' ? rawVal / 1000 : rawVal
      targetParam.value = Math.max(targetParam.min, Math.min(targetParam.max, converted))
    }
  }

  if (lower.includes('bolt') && numMatch) {
    const count = Math.max(3, Math.min(16, Math.round(parseFloat(numMatch[1]))))
    for (const part of next.parts) {
      for (const s of part.shapes) {
        if (s.radialCount) s.radialCount = count
      }
    }
  }

  if (lower.includes('spin') || lower.includes('rotate') || lower.includes('animate')) {
    for (const part of next.parts) {
      if (!part.motion) {
        part.motion = { kind: 'rotate', axis: 'x', speed: 1.5 }
      }
    }
  }

  return next
}

/**
 * Extracts readable ASCII/UTF-8 text strings from a raw PDF buffer when offline (fallback if PDF.js CDN is unreachable).
 */
function extractRawPdfStrings(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer)
  const raw = new TextDecoder('latin1').decode(bytes)
  const out: string[] = []
  const tjRegex = /\(([^()\\]{3,160})\)\s*Tj/g
  let m: RegExpExecArray | null
  while ((m = tjRegex.exec(raw)) !== null) {
    const cleaned = m[1].replace(/[^\x20-\x7E]/g, ' ').trim()
    if (cleaned.length > 3) out.push(cleaned)
    if (out.length > 60) break
  }
  return out
}

/**
 * Loads a user-uploaded PDF or Image file and returns a `TextbookDocument` ready for in-place 3D figure replacement.
 */
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

  // Case 2: PDF file — try PDF.js ESM first, fallback to offline PDF stream extractor
  const buffer = await file.arrayBuffer()
  try {
    // bundled with the app (loaded only when a PDF is opened), so reading works offline and on networks that block CDNs
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
  } catch {
    // Offline fallback when CDN is unreachable inside sandboxed environments
    const extractedLines = extractRawPdfStrings(buffer)
    const combinedText = [baseTitle, ...extractedLines].join(' ')
    const classified = classifyEngineeringFigure(combinedText, 0)

    const syntheticSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 1200" width="850" height="1200">
  <rect width="850" height="1200" fill="#fcfbf7"/>
  <line x1="70" y1="68" x2="780" y2="68" stroke="#94a3b8" stroke-width="1"/>
  <text x="70" y="54" font-family="Georgia, serif" font-size="13" fill="#475569">${baseTitle.replace(/[<>&]/g, '')}</text>
  <text x="780" y="54" text-anchor="end" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="#1e293b">Page 1</text>
  <text x="70" y="115" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#0f172a">${baseTitle.replace(/[<>&]/g, '')}</text>
  ${(extractedLines.length
    ? extractedLines.slice(0, 4)
    : [
        'Extracted engineering textbook page from uploaded PDF document.',
        'All surrounding notes and equations remain intact while 2D figures are replaced in-place with 3D.',
      ]
  )
    .map(
      (line, idx) =>
        `<text x="70" y="${155 + idx * 26}" font-family="Georgia, serif" font-size="15" fill="#1e293b">${line.replace(/[<>&]/g, '')}</text>`,
    )
    .join('\n  ')}
  <rect x="65" y="260" width="720" height="440" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-dasharray="6,4"/>
</svg>`
    const pageImageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(syntheticSvg.trim())}`

    const fig: DetectedPageFigure = {
      id: `fig-pdf-1-${Date.now().toString(36)}`,
      pageNumber: 1,
      box: [215, 75, 585, 925],
      title: classified.title,
      caption: classified.caption,
      courseTag: classified.courseTag,
      extractedGivens: classified.extractedGivens,
      visualization: classified.visualization,
    }

    return {
      id: `pdf-offline-${Date.now()}`,
      title: baseTitle,
      subtitle: `PDF Extract · ${file.name}`,
      sourceLabel: file.name,
      courseCode: classified.courseTag,
      pages: [
        {
          pageNumber: 1,
          pageImageUrl,
          aspectRatio: 850 / 1200,
          pageText: combinedText,
          blocks: [
            { kind: 'heading', number: '1.1', text: baseTitle },
            {
              kind: 'paragraph',
              text:
                extractedLines.slice(0, 6).join(' ') ||
                `Uploaded PDF document (${file.name}). Interact with the replaced 3D engineering figure below.`,
            },
            { kind: 'figure-slot', figureId: fig.id },
          ],
          figures: [fig],
        },
      ],
    }
  }
}
