import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { ApiError } from '@/cloud/api'
import { useAuth } from '@/cloud/auth'
import { toast } from '@/ui/toast'
import { startTask } from '@/ui/tasks'
import { analyzeTextbookPage, buildFigureFromPage, loadUploadedDocument } from './pdfPageRenderer'
import { SAMPLE_TEXTBOOKS, type TextbookDocument } from './sampleTextbooks'
import { CONFIDENCE_THRESHOLD, type DetectedPageFigure } from './schema'

/**
 * Read notes in 3D's documents and its long jobs, kept outside the page: reading a PDF, building a picked
 * figure and "Make every figure 3D" carry on while the student uses the rest of the app (as background
 * tasks), and uploaded documents with every figure built for them are saved in the browser, so they are
 * still there next visit. A half-finished "Make every figure 3D" resumes from what is left.
 */
const KEY = 'solidify.reader.v1'
/** uploaded documents kept: each holds its page images, a few megabytes */
const KEEP = 5
const SAMPLE_IDS = new Set(SAMPLE_TEXTBOOKS.map((d) => d.id))

interface ReaderState {
  documents: TextbookDocument[]
  activeDocId: string
  /** something on the page is being read or built, for the build screen */
  reading: { kind: 'document' | 'figure'; name?: string } | null
  converting: { docId: string; done: number; total: number } | null
  loaded: boolean
}

export const useReader = create<ReaderState>(() => ({ documents: SAMPLE_TEXTBOOKS, activeDocId: SAMPLE_TEXTBOOKS[0].id, reading: null, converting: null, loaded: false }))

let saveTimer: number | undefined
const save = () => {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const { documents, activeDocId } = useReader.getState()
    const uploads = documents.filter((d) => !SAMPLE_IDS.has(d.id)).slice(0, KEEP)
    void set(KEY, { uploads, activeDocId }).catch(() => {
      /* storage full or blocked: the documents still work for this visit */
    })
  }, 400)
}

/** the saved documents, once per visit */
export async function loadReader() {
  if (useReader.getState().loaded) return
  useReader.setState({ loaded: true })
  try {
    const saved = (await get(KEY)) as { uploads?: TextbookDocument[]; activeDocId?: string } | undefined
    if (!saved?.uploads?.length) return
    useReader.setState((s) => {
      const have = new Set(s.documents.map((d) => d.id))
      const documents = [...saved.uploads!.filter((d) => !have.has(d.id)), ...s.documents]
      return { documents, activeDocId: documents.some((d) => d.id === saved.activeDocId) ? saved.activeDocId! : s.activeDocId }
    })
  } catch {
    /* storage blocked: start with the samples */
  }
}

export const setDocuments = (fn: (prev: TextbookDocument[]) => TextbookDocument[]) => {
  useReader.setState((s) => ({ documents: fn(s.documents) }))
  save()
}

export const setActiveDoc = (id: string) => {
  useReader.setState({ activeDocId: id })
  save()
}

export const removeDocument = (id: string) => {
  if (SAMPLE_IDS.has(id)) return
  setDocuments((prev) => prev.filter((d) => d.id !== id))
  useReader.setState((s) => (s.activeDocId === id ? { activeDocId: s.documents[0]?.id ?? SAMPLE_TEXTBOOKS[0].id } : {}))
  if (!useReader.getState().documents.some((d) => !SAMPLE_IDS.has(d.id))) void del(KEY).catch(() => {})
}

/** adds figures to a page (replacing any with the same id), and drops the candidates they came from */
export function putFigures(docId: string, pageNumber: number, figs: DetectedPageFigure[], usedCandidates: string[] = []) {
  setDocuments((prev) =>
    prev.map((doc) =>
      doc.id !== docId
        ? doc
        : {
            ...doc,
            pages: doc.pages.map((p) => {
              if (p.pageNumber !== pageNumber) return p
              const ids = new Set(figs.map((f) => f.id))
              const kept = p.figures.filter((f) => !ids.has(f.id))
              const newSlots = figs.filter((f) => !p.figures.some((x) => x.id === f.id)).map((nf) => ({ kind: 'figure-slot' as const, figureId: nf.id }))
              return { ...p, figures: [...kept, ...figs], blocks: [...p.blocks, ...newSlots], candidates: (p.candidates ?? []).filter((c) => !usedCandidates.includes(c.id)) }
            }),
          },
    ),
  )
}

/** problems are shown as a toast; a missing sign-in offers to sign in */
export function showReaderError(e: unknown, otherwise: string) {
  if (e instanceof ApiError && e.status === 401)
    toast('Sign in to read your own pages in 3D. Pages are read by Solidify’s AI, which needs an account.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
  else toast(e instanceof Error ? e.message : otherwise, { tone: 'warn' })
}

/** reads an uploaded PDF or page, as a background task, and opens it when done */
export async function readDocument(file: File) {
  useReader.setState({ reading: { kind: 'document', name: file.name } })
  const task = startTask(`Reading ${file.name}`, '/read')
  try {
    const loaded = await loadUploadedDocument(file, (page, total) => task.update(`Reading page ${page} of ${total}`, page - 1, total))
    setDocuments((prev) => [loaded, ...prev])
    setActiveDoc(loaded.id)
    const figures = loaded.pages.reduce((n, p) => n + p.figures.length, 0)
    const more = loaded.pages.reduce((n, p) => n + (p.candidates?.length ?? 0), 0)
    task.finish({ href: '/read', message: `${loaded.title} is ready: ${figures} ${figures === 1 ? 'figure' : 'figures'} in 3D${more ? `, ${more} more to build` : ''}.` })
    return loaded
  } catch (e) {
    task.fail(e instanceof Error ? e.message : 'Couldn’t read that document.')
    if (!(e instanceof ApiError && e.status === 401)) return null
    showReaderError(e, 'Couldn’t read that document.')
    return null
  } finally {
    useReader.setState({ reading: null })
  }
}

/** a picked box: a lab rig the reader recognises is used as it is; anything else is built from the picture */
export async function buildPicked(docId: string, pageNumber: number, box: [number, number, number, number]): Promise<DetectedPageFigure | null> {
  const doc = useReader.getState().documents.find((d) => d.id === docId)
  const page = doc?.pages.find((p) => p.pageNumber === pageNumber)
  if (!doc || !page) return null
  useReader.setState({ reading: { kind: 'figure' } })
  const task = startTask(`Building a figure on page ${pageNumber}`, '/read')
  try {
    const found = await analyzeTextbookPage({ pageNumber, pageImageUrl: page.pageImageUrl, pageText: page.pageText, fileName: doc.title, cropBox: box })
    const rigs = found.filter((f) => f.visualization.kind === 'catalog').map((f) => ({ ...f, chosen: true }))
    const figs = rigs.length
      ? rigs
      : [await buildFigureFromPage({ pageNumber, pageImageUrl: page.pageImageUrl, pageText: page.pageText, box, title: found[0]?.title, caption: found[0]?.caption })].filter((f): f is DetectedPageFigure => !!f)
    if (!figs.length) {
      task.fail('Solidify couldn’t build that part of the page. Try a box tighter around the drawing.')
      return null
    }
    putFigures(docId, pageNumber, figs)
    task.finish({ message: `${figs[0].title || 'Your figure'} is ready in 3D.` })
    return figs[0]
  } catch (e) {
    task.fail(e instanceof Error ? e.message : 'Couldn’t read that part of the page.')
    if (e instanceof ApiError && e.status === 401) showReaderError(e, '')
    return null
  } finally {
    useReader.setState({ reading: null })
  }
}

let stopFlag = false
export const stopConverting = () => {
  stopFlag = true
}

/** what "Make every figure 3D" would do for a document: figures kept as drawings to show, drawings to build */
export function convertTodo(doc: TextbookDocument) {
  const kept = doc.pages.flatMap((p) => p.figures.filter((f) => !f.chosen && (f.confidence ?? 0) < CONFIDENCE_THRESHOLD).map((f) => ({ pageNumber: p.pageNumber, figure: f })))
  const toBuild = doc.pages.flatMap((p) => (p.candidates ?? []).map((c) => ({ pageNumber: p.pageNumber, candidate: c })))
  return { kept, toBuild }
}

/**
 * "Make every figure 3D", as a background task: figures kept as drawings are shown in 3D, and each drawing
 * still to build is built and saved as it lands, so stopping (or closing the tab) keeps what is done and
 * running it again builds the rest.
 */
export async function convertAll(docId: string) {
  if (useReader.getState().converting) return
  const doc = useReader.getState().documents.find((d) => d.id === docId)
  if (!doc) return
  const { kept, toBuild } = convertTodo(doc)
  for (const { pageNumber, figure } of kept) putFigures(docId, pageNumber, [{ ...figure, chosen: true }])
  if (!toBuild.length) return
  stopFlag = false
  useReader.setState({ converting: { docId, done: 0, total: toBuild.length } })
  const task = startTask(`Making ${doc.title} 3D`, '/read')
  let built = 0
  for (let i = 0; i < toBuild.length && !stopFlag; i++) {
    const { pageNumber, candidate } = toBuild[i]
    task.update(`Building figure ${i + 1} of ${toBuild.length}`, i, toBuild.length)
    // the page as it is now (it may have been changed since the run started)
    const page = useReader.getState().documents.find((d) => d.id === docId)?.pages.find((p) => p.pageNumber === pageNumber)
    if (!page) break
    try {
      const fig = await buildFigureFromPage({ pageNumber, pageImageUrl: page.pageImageUrl, pageText: page.pageText, box: candidate.box, title: candidate.title, caption: candidate.caption })
      if (fig) {
        putFigures(docId, pageNumber, [fig], [candidate.id])
        built++
      }
    } catch (e) {
      // out of builds for today, or signed out: no point going on
      if (e instanceof ApiError && (e.status === 429 || e.status === 401)) {
        useReader.setState({ converting: null })
        task.fail(`${e.message} Built ${built} of ${toBuild.length}; run it again later for the rest.`)
        return
      }
    }
    useReader.setState({ converting: { docId, done: i + 1, total: toBuild.length } })
  }
  useReader.setState({ converting: null })
  task.finish({ message: `Built ${built} of ${toBuild.length} figures in 3D${stopFlag ? ' (stopped; run it again for the rest)' : ''}.` })
}
