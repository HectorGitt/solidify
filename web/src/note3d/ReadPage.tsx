import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { findModule } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { useView } from '@/render/view'
import { StudyShell } from '@/study/ui/StudyShell'
import { Notice } from '@/cloud/ui/Modal'
import { PartCard } from '@/ui/PartCard'
import { PartsTree } from '@/ui/PartsTree'
import { OrientationGizmo, Stage } from '@/ui/Stage'
import { Tex } from '@/ui/Tex'
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
            ✕ Back to Page
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
  const [uploadError, setUploadError] = useState<string | null>(null)
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

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const loaded = await loadUploadedDocument(file)
      setDocuments((prev) => [loaded, ...prev])
      setActiveDocId(loaded.id)
      setPageIdx(0)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Could not process document.')
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
      }
    } finally {
      setUploading(false)
    }
  }

  const highConfCount = currentPage.figures.filter((f) => (f.confidence ?? 0) >= CONFIDENCE_THRESHOLD).length
  const gatedCount = currentPage.figures.length - highConfCount

  return (
    <StudyShell
      title="Read Notes & PDFs in 3D"
      lead="Upload a PDF page or engineering handout. Your document stays intact while high-confidence figures are replaced in-place with interactive 3D models. Low-confidence figures remain as the original 2D drawing."
      right={
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => void handleFileUpload(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-black shadow-lg shadow-accent/20 transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            <span>📄 {uploading ? 'Analyzing Page…' : 'Upload PDF / Note Page'}</span>
          </button>
        </div>
      }
    >
      {uploadError && (
        <div className="mb-4">
          <Notice tone="warn">{uploadError}</Notice>
        </div>
      )}

      {/* Document Selector & Safeguard Status Bar */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-panel p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-mute">
              Course Notes:
            </span>
            {documents.map((doc) => {
              const active = doc.id === activeDoc.id
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    setActiveDocId(doc.id)
                    setPageIdx(0)
                  }}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    active
                      ? 'border-accent/60 bg-accent/15 text-accent font-semibold'
                      : 'border-line-2 bg-panel-2/60 text-ink/80 hover:border-accent/40'
                  }`}
                >
                  {doc.title}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center rounded-full border border-line-2 bg-panel-2 p-0.5 text-[11.5px]"
              role="group"
              aria-label="Reading layout mode"
            >
              <button
                type="button"
                onClick={() => setReadingMode('page-overlay')}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  readingMode === 'page-overlay' ? 'bg-ink text-bg' : 'text-mute hover:text-ink'
                }`}
              >
                📄 Exact Page Layout
              </button>
              <button
                type="button"
                onClick={() => setReadingMode('reflow')}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  readingMode === 'reflow' ? 'bg-ink text-bg' : 'text-mute hover:text-ink'
                }`}
              >
                📖 Phone / Reflow Mode
              </button>
            </div>

            {readingMode === 'page-overlay' && (
              <button
                type="button"
                onClick={() => setLassoActive((v) => !v)}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                  lassoActive
                    ? 'border-amber-400/70 bg-amber-400/15 text-amber-300 font-semibold'
                    : 'border-line-2 bg-panel-2 text-ink/85 hover:border-accent/40'
                }`}
                title="Drag a box around any missed diagram on the page to convert it to 3D in-place"
              >
                {lassoActive ? '⊹ Drag on Page to Select Diagram…' : '⊹ Lasso Diagram → 3D'}
              </button>
            )}
          </div>
        </div>

        {/* Subtitle, Confidence Gating Summary & Multi-page Pager */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-[12px] text-mute">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">{activeDoc.sourceLabel}</span>
            <span>·</span>
            <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-accent">
              {highConfCount} {highConfCount === 1 ? 'figure' : 'figures'} in 3D (1 live + still snapshots)
            </span>
            {gatedCount > 0 && (
              <span className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-amber-300">
                {gatedCount} low-confidence kept as 2D
              </span>
            )}
            <span className="hidden text-[11.5px] text-dim xl:inline">
              🔒 Private: documents stay in your browser and are never stored.
            </span>
          </div>

          {activeDoc.pages.length > 1 && (
            <div className="flex items-center gap-1.5 font-mono text-[11.5px]">
              <button
                type="button"
                disabled={pageIdx === 0}
                onClick={() => setPageIdx((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-line-2 bg-panel-2 px-2.5 py-0.5 text-ink disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="px-2">
                Page {pageIdx + 1} / {activeDoc.pages.length}
              </span>
              <button
                type="button"
                disabled={pageIdx >= activeDoc.pages.length - 1}
                onClick={() => setPageIdx((p) => Math.min(activeDoc.pages.length - 1, p + 1))}
                className="rounded-lg border border-line-2 bg-panel-2 px-2.5 py-0.5 text-ink disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
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
