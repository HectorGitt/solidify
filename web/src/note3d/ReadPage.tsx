import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { findModule } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { useView } from '@/render/view'
import { StudyShell } from '@/study/ui/StudyShell'
import { ApiError } from '@/cloud/api'
import { useAuth } from '@/cloud/auth'
import { primaryBtn } from '@/cloud/ui/Modal'
import { PartCard } from '@/ui/PartCard'
import { PartsTree } from '@/ui/PartsTree'
import { OrientationGizmo, Stage } from '@/ui/Stage'
import { Icon } from '@/ui/icons'
import { Tex } from '@/ui/Tex'
import { toast } from '@/ui/toast'
import { Toolbar } from '@/ui/Toolbar'
import { InlineFigure3D } from './InlineFigure3D'
import { createSceneDefFromSpec } from './NoteSceneRenderer'
import { analyzeTextbookPage, loadUploadedDocument } from './pdfPageRenderer'
import { SAMPLE_TEXTBOOKS, type TextbookDocument } from './sampleTextbooks'
import { CONFIDENCE_THRESHOLD, type DetectedPageFigure } from './schema'

function ExpandedFigureModal({
  figure,
  initialParams,
  onClose,
}: {
  figure: DetectedPageFigure
  initialParams: Record<string, number>
  onClose: () => void
}) {
  const [params, setParams] = useState<Record<string, number>>(initialParams)
  const [catalogScene, setCatalogScene] = useState<SceneDef | null>(null)

  useEffect(() => {
    useView.getState().resetView()
    if (figure.visualization.kind === 'procedural' && figure.visualization.spec.recommendedCut) {
      const rc = figure.visualization.spec.recommendedCut
      useView.getState().setCut({
        enabled: rc.enabled,
        planes: [{ normal: rc.normal, pos: rc.pos }],
      })
    }
  }, [figure])

  useEffect(() => {
    let alive = true
    if (figure.visualization.kind !== 'catalog') {
      setCatalogScene(null)
      return
    }
    const { moduleId, sceneId } = figure.visualization
    const mod = findModule(moduleId)
    const entry = mod?.scenes.find((s) => s.id === sceneId) ?? mod?.scenes[0]
    if (!entry?.load) return
    entry
      .load()
      .then(async ({ default: def }) => {
        await def.prepare?.()
        return def
      })
      .then((def) => {
        if (!alive) return
        def.applyParams?.(params)
        setCatalogScene(def)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figure])

  useEffect(() => {
    if (figure.visualization.kind === 'catalog' && catalogScene) {
      catalogScene.applyParams?.(params)
    }
  }, [params, catalogScene, figure.visualization.kind])

  const activeSceneDef = useMemo<SceneDef | null>(() => {
    if (figure.visualization.kind === 'procedural') {
      return createSceneDefFromSpec(figure.visualization.spec, params)
    }
    return catalogScene
  }, [figure.visualization, params, catalogScene])

  const paramSpecs =
    figure.visualization.kind === 'procedural'
      ? figure.visualization.spec.parameters
      : (figure.visualization.paramSpecs ?? [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur-xl">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-accent">
            {figure.title}
          </span>
          <h2 className="text-[14.5px] font-semibold text-ink">{figure.caption}</h2>
        </div>
        <div className="flex items-center gap-2">
          {figure.visualization.kind === 'catalog' && (
            <Link
              to={`/m/${figure.visualization.moduleId}/${figure.visualization.sceneId}`}
              className="rounded-full border border-accent/50 bg-accent/15 px-3 py-1 text-[12px] font-semibold text-accent hover:bg-accent/25"
            >
              Open Full Lab Workbench →
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line-2 bg-panel-2 px-3.5 py-1 text-[12.5px] font-medium text-ink hover:border-accent/50"
          >
            Back to the page
          </button>
        </div>
      </header>

      <div className="relative grid flex-1 overflow-hidden lg:grid-cols-[280px_1fr_320px]">
        <aside className="hidden overflow-y-auto border-r border-line bg-panel/90 p-3 lg:block">
          <div className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-mute">
            Assembly Parts Tree
          </div>
          <PartsTree />
        </aside>

        <div className="relative h-full w-full overflow-hidden">
          {activeSceneDef ? (
            <>
              <Stage scene={activeSceneDef} />
              <div className="pointer-events-none absolute left-3 top-3 z-20">
                <OrientationGizmo scene={activeSceneDef} />
              </div>
              <PartCard />
              <Toolbar scene={activeSceneDef} />
            </>
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[13px] text-mute">
              Loading 3D engineering rig…
            </div>
          )}
        </div>

        <aside className="overflow-y-auto border-l border-line bg-panel/90 p-4">
          <div className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-mute">
            Extracted Problem Givens
          </div>
          {paramSpecs.length > 0 ? (
            <div className="space-y-3">
              {paramSpecs.map((p) => {
                const val = params[p.id] ?? p.value
                return (
                  <label
                    key={p.id}
                    className="block rounded-xl border border-line bg-panel-2/60 p-3"
                  >
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="font-medium text-ink">
                        {p.symbol ? <strong className="mr-1 font-mono text-accent">{p.symbol}</strong> : null}
                        {p.label}
                      </span>
                      <span className="font-mono text-[12px] font-semibold text-accent">
                        {Number(val.toPrecision(4))} {p.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={val}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        setParams((prev) => ({ ...prev, [p.id]: v }))
                      }}
                      className="h-1.5 w-full accent-emerald-400"
                    />
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="text-[12.5px] text-mute">
              Use the section plane, explode slider, calipers, and part tree to inspect the internal geometry.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

export default function ReadPage() {
  const [documents, setDocuments] = useState<TextbookDocument[]>(SAMPLE_TEXTBOOKS)
  const [activeDocId, setActiveDocId] = useState<string>(SAMPLE_TEXTBOOKS[0].id)
  const [pageIdx, setPageIdx] = useState(0)
  const [readingMode, setReadingMode] = useState<'page-overlay' | 'reflow'>('page-overlay')
  const [uploading, setUploading] = useState(false)
  const [lassoActive, setLassoActive] = useState(false)
  const [lassoStart, setLassoStart] = useState<[number, number] | null>(null)
  const [lassoCurrent, setLassoCurrent] = useState<[number, number] | null>(null)
  const [expandedFig, setExpandedFig] = useState<{
    figure: DetectedPageFigure
    params: Record<string, number>
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageSheetRef = useRef<HTMLDivElement>(null)

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) ?? documents[0],
    [documents, activeDocId],
  )
  const currentPage = activeDoc.pages[pageIdx] ?? activeDoc.pages[0]

  // Single Active Live Figure ID: only ONE figure on the page runs a live WebGL canvas at a time
  // so repeated rigs (e.g. two beam figures on the same page) never collide on global stores!
  const [activeFigureId, setActiveFigureId] = useState<string | null>(() => {
    const firstHighConf = currentPage.figures.find((f) => (f.confidence ?? 0) >= CONFIDENCE_THRESHOLD)
    return (firstHighConf ?? currentPage.figures[0])?.id ?? null
  })

  useEffect(() => {
    const firstHighConf = currentPage.figures.find((f) => (f.confidence ?? 0) >= CONFIDENCE_THRESHOLD)
    setActiveFigureId((firstHighConf ?? currentPage.figures[0])?.id ?? null)
  }, [activeDoc.id, currentPage.pageNumber, currentPage.figures])

  /** problems are shown as a toast; a missing sign-in offers to sign in */
  const showError = (e: unknown, otherwise: string) => {
    if (e instanceof ApiError && e.status === 401)
      toast('Sign in to read your own pages in 3D. Pages are read by Solidify’s AI, which needs an account.', { tone: 'warn', action: { label: 'Sign in', run: () => useAuth.getState().openDialog() } })
    else toast(e instanceof Error ? e.message : otherwise, { tone: 'warn' })
  }

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const loaded = await loadUploadedDocument(file)
      setDocuments((prev) => [loaded, ...prev])
      setActiveDocId(loaded.id)
      setPageIdx(0)
    } catch (e) {
      showError(e, 'Couldn’t read that document.')
    } finally {
      setUploading(false)
    }
  }

  const toNormCoords = (e: MouseEvent<HTMLDivElement>): [number, number] => {
    const rect = pageSheetRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0]
    const x = Math.max(0, Math.min(1000, Math.round(((e.clientX - rect.left) / rect.width) * 1000)))
    const y = Math.max(0, Math.min(1000, Math.round(((e.clientY - rect.top) / rect.height) * 1000)))
    return [x, y]
  }

  const finishLasso = async () => {
    if (!lassoStart || !lassoCurrent) {
      setLassoStart(null)
      setLassoCurrent(null)
      return
    }
    const xmin = Math.min(lassoStart[0], lassoCurrent[0])
    const xmax = Math.max(lassoStart[0], lassoCurrent[0])
    const ymin = Math.min(lassoStart[1], lassoCurrent[1])
    const ymax = Math.max(lassoStart[1], lassoCurrent[1])
    setLassoStart(null)
    setLassoCurrent(null)
    setLassoActive(false)

    if (xmax - xmin < 80 || ymax - ymin < 80) return
    const cropBox: [number, number, number, number] = [ymin, xmin, ymax, xmax]
    setUploading(true)
    try {
      const newFigs = await analyzeTextbookPage({
        pageNumber: currentPage.pageNumber,
        pageImageUrl: currentPage.pageImageUrl,
        pageText: currentPage.pageText,
        fileName: activeDoc.title,
        cropBox,
      })
      if (newFigs.length > 0) {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id !== activeDoc.id
              ? doc
              : {
                  ...doc,
                  pages: doc.pages.map((p) =>
                    p.pageNumber !== currentPage.pageNumber
                      ? p
                      : {
                          ...p,
                          figures: [...p.figures, ...newFigs],
                          blocks: [
                            ...p.blocks,
                            ...newFigs.map((nf) => ({ kind: 'figure-slot' as const, figureId: nf.id })),
                          ],
                        },
                  ),
                },
          ),
        )
        setActiveFigureId(newFigs[0].id)
      } else {
        toast('Solidify couldn’t turn that part of the page into 3D. Try a box tighter around the figure.')
      }
    } catch (e) {
      showError(e, 'Couldn’t read that part of the page.')
    } finally {
      setUploading(false)
    }
  }

  const highConfCount = currentPage.figures.filter((f) => (f.confidence ?? 0) >= CONFIDENCE_THRESHOLD).length
  const gatedCount = currentPage.figures.length - highConfCount

  const segBtn = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${on ? 'bg-ink text-bg' : 'text-mute hover:text-ink'}`
  const smallGhost =
    'inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-panel-2 px-3 py-1.5 text-[12.5px] font-medium text-ink/90 transition-colors hover:border-ink/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <StudyShell
      title="Read notes in 3D"
      lead="Upload a PDF or a photo of a note page. The page stays as it is: figures Solidify recognises become 3D models you can turn and test, and any it isn't sure of stay as the original drawing."
      right={
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              void handleFileUpload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className={primaryBtn}>
            <Icon.upload width={16} height={16} />
            {uploading ? 'Reading the page…' : 'Upload a PDF or page'}
          </button>
        </>
      }
    >
      <div className="mb-5 rounded-2xl border border-line bg-panel shadow-sm">
        {/* documents + layout */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="-mx-4 flex min-w-0 items-center gap-1.5 overflow-x-auto px-4 text-[12.5px] scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Documents">
            {documents.map((doc) => {
              const active = doc.id === activeDoc.id
              return (
                <button
                  key={doc.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setActiveDocId(doc.id)
                    setPageIdx(0)
                  }}
                  className={`max-w-[240px] shrink-0 truncate rounded-full border px-3 py-1.5 font-medium transition-colors ${
                    active ? 'border-ink bg-ink text-bg' : 'border-line-2 text-ink/80 hover:border-ink/40 hover:text-ink'
                  }`}
                >
                  {doc.title}
                </button>
              )
            })}
          </div>

          <div className="flex items-center rounded-full border border-line-2 bg-panel-2 p-0.5 text-[12.5px]" role="group" aria-label="Layout">
            <button type="button" aria-pressed={readingMode === 'page-overlay'} onClick={() => setReadingMode('page-overlay')} className={segBtn(readingMode === 'page-overlay')}>
              <Icon.page width={14} height={14} />
              Page
            </button>
            <button
              type="button"
              aria-pressed={readingMode === 'reflow'}
              onClick={() => {
                setReadingMode('reflow')
                setLassoActive(false)
              }}
              className={segBtn(readingMode === 'reflow')}
            >
              <Icon.text width={14} height={14} />
              Text
            </button>
          </div>
        </div>

        {/* status + page tools */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[12.5px]">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-mute">
            <span className="truncate text-ink/90">{activeDoc.sourceLabel}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {highConfCount} {highConfCount === 1 ? 'figure' : 'figures'} in 3D
            </span>
            {gatedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-warn">
                <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                {gatedCount} kept as {gatedCount === 1 ? 'a drawing' : 'drawings'}
              </span>
            )}
            <span className="hidden text-dim xl:inline">Pages are sent only to find figures and are never saved.</span>
          </div>

          <div className="flex items-center gap-2">
            {readingMode === 'page-overlay' && (
              <button
                type="button"
                aria-pressed={lassoActive}
                onClick={() => setLassoActive((v) => !v)}
                disabled={uploading}
                className={lassoActive ? `${smallGhost} !border-ink !bg-ink !text-bg` : smallGhost}
                title="Drag a box around a figure the reader missed to turn it into 3D"
              >
                <Icon.select width={14} height={14} />
                {lassoActive ? 'Drag a box on the page' : 'Select a figure'}
              </button>
            )}
            {activeDoc.pages.length > 1 && (
              <div className="flex items-center gap-1" role="group" aria-label="Pages">
                <button type="button" aria-label="Previous page" disabled={pageIdx === 0} onClick={() => setPageIdx((p) => Math.max(0, p - 1))} className={`${smallGhost} !px-2`}>
                  <Icon.back width={14} height={14} />
                </button>
                <span className="min-w-[56px] text-center font-mono text-[12px] text-mute">
                  {pageIdx + 1} / {activeDoc.pages.length}
                </span>
                <button type="button" aria-label="Next page" disabled={pageIdx >= activeDoc.pages.length - 1} onClick={() => setPageIdx((p) => Math.min(activeDoc.pages.length - 1, p + 1))} className={`${smallGhost} !px-2`}>
                  <Icon.chevron width={14} height={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: EXACT PAGE-FIDELITY OVERLAY (PDF Page + In-Place 3D Figures)  */}
      {/* ===================================================================== */}
      {readingMode === 'page-overlay' ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file) void handleFileUpload(file)
          }}
          className="mx-auto max-w-[920px]"
        >
          <div
            ref={pageSheetRef}
            onMouseDown={(e) => {
              if (!lassoActive) return
              const pt = toNormCoords(e)
              setLassoStart(pt)
              setLassoCurrent(pt)
            }}
            onMouseMove={(e) => {
              if (!lassoActive || !lassoStart) return
              setLassoCurrent(toNormCoords(e))
            }}
            onMouseUp={() => {
              if (lassoActive && lassoStart) void finishLasso()
            }}
            style={{ aspectRatio: `${currentPage.aspectRatio}` }}
            className={`relative w-full overflow-hidden rounded-2xl border border-line-2 bg-[#fcfbf7] shadow-[0_24px_60px_rgba(0,0,0,0.35)] ${
              lassoActive ? 'cursor-crosshair select-none ring-2 ring-amber-400' : ''
            }`}
          >
            {/* Original Page Image (All Text, Headings & Equations Remain Intact) */}
            <img
              src={currentPage.pageImageUrl}
              alt={`${activeDoc.title} — Page ${currentPage.pageNumber}`}
              className="pointer-events-none h-full w-full select-none object-fill"
            />

            {/* In-Place 3D Viewports Positioned Directly Over Each Detected Figure Bounding Box */}
            {currentPage.figures.map((fig) => {
              const [ymin, xmin, ymax, xmax] = fig.box
              return (
                <div
                  key={fig.id}
                  style={{
                    top: `${ymin / 10}%`,
                    left: `${xmin / 10}%`,
                    height: `${(ymax - ymin) / 10}%`,
                    width: `${(xmax - xmin) / 10}%`,
                  }}
                  className="absolute z-10 flex flex-col"
                >
                  <InlineFigure3D
                    figure={fig}
                    isActive={activeFigureId === fig.id}
                    onActivate={() => setActiveFigureId(fig.id)}
                    className="h-full w-full"
                    onExpand={(f, p) => setExpandedFig({ figure: f, params: p })}
                  />
                </div>
              )
            })}

            {/* Active Lasso Selection Rectangle */}
            {lassoActive && lassoStart && lassoCurrent && (
              <div
                style={{
                  left: `${Math.min(lassoStart[0], lassoCurrent[0]) / 10}%`,
                  top: `${Math.min(lassoStart[1], lassoCurrent[1]) / 10}%`,
                  width: `${Math.abs(lassoCurrent[0] - lassoStart[0]) / 10}%`,
                  height: `${Math.abs(lassoCurrent[1] - lassoStart[1]) / 10}%`,
                }}
                className="pointer-events-none absolute z-30 rounded-lg border-2 border-amber-400 bg-amber-400/20"
              />
            )}
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* MODE 2: REFLOWED PHONE / READING MODE (Typography + Inline 3D)        */
        /* ===================================================================== */
        <article className="mx-auto max-w-[880px] rounded-3xl border border-line bg-[#fcfbf7] p-6 text-[#18212b] shadow-xl sm:p-10">
          <div className="mb-6 flex items-center justify-between border-b border-slate-300 pb-3 font-serif text-[13px] italic text-slate-600">
            <span>{activeDoc.sourceLabel}</span>
            <span className="font-bold not-italic text-slate-900">Page {currentPage.pageNumber}</span>
          </div>

          <div className="space-y-5">
            {currentPage.blocks.map((block, i) => {
              if (block.kind === 'heading') {
                return (
                  <h2 key={i} className="pt-2 font-serif text-[21px] font-bold tracking-tight text-slate-900">
                    {block.number ? <span className="mr-2.5 text-emerald-700">{block.number}</span> : null}
                    {block.text}
                  </h2>
                )
              }
              if (block.kind === 'paragraph') {
                return (
                  <p key={i} className="font-serif text-[16px] leading-[1.75] text-slate-800">
                    {block.text}
                  </p>
                )
              }
              if (block.kind === 'equation' && block.latex) {
                return (
                  <div
                    key={i}
                    className="my-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100/80 px-5 py-3 text-slate-900"
                  >
                    <div className="mx-auto overflow-x-auto">
                      <Tex tex={block.latex} display />
                    </div>
                    {block.number ? (
                      <span className="ml-4 font-serif text-[14px] font-semibold text-slate-600">{block.number}</span>
                    ) : null}
                  </div>
                )
              }
              if (block.kind === 'figure-slot' && block.figureId) {
                const fig = currentPage.figures.find((f) => f.id === block.figureId)
                if (!fig) return null
                return (
                  <div key={i} className="my-6 h-[390px]">
                    <InlineFigure3D
                      figure={fig}
                      isActive={activeFigureId === fig.id}
                      onActivate={() => setActiveFigureId(fig.id)}
                      className="h-full w-full"
                      onExpand={(f, p) => setExpandedFig({ figure: f, params: p })}
                    />
                  </div>
                )
              }
              return null
            })}
          </div>
        </article>
      )}

      {/* Expanded Full-Screen 3D Workbench Modal */}
      {expandedFig && (
        <ExpandedFigureModal
          figure={expandedFig.figure}
          initialParams={expandedFig.params}
          onClose={() => setExpandedFig(null)}
        />
      )}
    </StudyShell>
  )
}
