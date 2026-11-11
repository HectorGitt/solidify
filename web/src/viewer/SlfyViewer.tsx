import { ContactShadows, Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SimClockDriver } from '@/core/sim'
import { fitView } from '@/note3d/fitView'
import { ChartView } from '@/note3d/ChartView'
import { InlineStudioLights } from '@/note3d/studioLights'
import { NoteSceneViewport, type InlineViewConfig } from '@/note3d/NoteSceneRenderer'
import { sanitizeGeneratedSpec } from '@/note3d/sanitize'
import { evaluateCalculations, evaluateChart, type NotePartSpec, type NoteSceneSpec } from '@/note3d/schema'
import { SLFY_VERSION, fromSlfy } from '@/note3d/slfyFormat'
import { CutController } from '@/render/CutController'
import { Tex } from '@/ui/Tex'

/**
 * The reference viewer for .slfy files (the open model format): a standalone page, no account and no app
 * around it, built from Solidify's own model code so a file looks and works as it does in Solidify. It opens
 * ?file=<relative or https URL>, a dropped or chosen file; ?embed=1 shows only the model and its controls
 * (for the format's site and other pages).
 */

const MAX_BYTES = 2_000_000
const query = new URLSearchParams(location.search)
const EMBED = query.get('embed') === '1'
// ?shot=1: the model alone, no controls (the format site's pictures of the examples)
/** every part, the ones carried inside another part (children) included */
const flatParts = (parts: NotePartSpec[]): NotePartSpec[] => parts.flatMap((p) => [p, ...flatParts(p.children ?? [])])
const SHOT = query.get('shot') === '1'

interface Loaded {
  spec: NoteSceneSpec
  name: string
  warnings: string[]
}

function useTheme() {
  const dark = document.documentElement.getAttribute('data-theme') !== 'light'
  return dark
}

/** a slider's value at its own precision: whole teeth as 41, a module of 2.5 as 2.5 */
const fmtStep = (v: number, step: number) => {
  const dp = step >= 1 ? 0 : Math.min(4, Math.max(0, Math.ceil(-Math.log10(step))))
  return v.toFixed(dp)
}

const fmt = (v: number) => {
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 10000) return v.toExponential(2)
  if (a >= 100) return v.toFixed(1)
  if (a >= 1) return v.toFixed(2)
  return Number(v.toPrecision(3)).toString()
}

export function SlfyViewer() {
  const [model, setModel] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [params, setParams] = useState<Record<string, number>>({})
  const [playing, setPlaying] = useState(true)
  const [cut, setCut] = useState(false)
  const [explode, setExplode] = useState(0)
  const [xray, setXray] = useState(false)
  const [labels, setLabels] = useState(false)
  const [selected, setSelected] = useState<NotePartSpec | null>(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const dark = useTheme()

  const take = (text: string, name: string) => {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      setError(`${name} isn’t a model file: it isn’t valid JSON.`)
      return
    }
    const r = fromSlfy(raw)
    if (!r.ok) {
      setError(`${name}: ${r.error}`)
      return
    }
    const spec = sanitizeGeneratedSpec(r.spec, r.title)
    if (!spec) {
      setError(`${name}: nothing in it can be drawn.`)
      return
    }
    setError(null)
    setModel({ spec, name, warnings: r.warnings })
    setParams(Object.fromEntries(spec.parameters.map((p) => [p.id, p.value])))
    setCut(false)
    setExplode(0)
    setXray(false)
    setSelected(null)
    setPlaying(true)
    document.title = `${spec.title} · .slfy viewer`
  }

  const loadUrl = (url: string) => {
    setBusy(true)
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`the link answered ${res.status}`)
        return res.text()
      })
      .then((t) => {
        if (t.length > MAX_BYTES) throw new Error('the file is over 2 MB')
        take(t, decodeURIComponent(url.split('/').pop() || 'the file'))
      })
      .catch((e) => setError(`Couldn’t open ${url}: ${e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'the site holding it doesn’t allow it to be opened from here, or it is offline'}.`))
      .finally(() => setBusy(false))
  }

  const loadFile = (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_BYTES) {
      setError(`${f.name} is over 2 MB.`)
      return
    }
    f.text().then((t) => take(t, f.name))
  }

  useEffect(() => {
    const file = query.get('file')
    if (file && (/^https:\/\//i.test(file) || !/^[a-z]+:/i.test(file))) loadUrl(file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spec = model?.spec ?? null
  // the canvas's shape, so a wide view frames the model as tightly as a tall one
  const box = useRef<HTMLDivElement>(null)
  const [aspect, setAspect] = useState<number | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => el.clientWidth && el.clientHeight && setAspect(el.clientWidth / el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // framed once per model (and its first measured shape) from where its parts end up; sliders don't move the camera
  const aspectKey = aspect ? Math.round(aspect * 10) / 10 : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fit = useMemo(() => (spec && aspectKey ? fitView(spec, params, aspectKey) : null), [spec, aspectKey !== null])
  const { results, scope } = useMemo(() => evaluateCalculations(spec?.calculations, params), [spec, params])
  const charts = useMemo(() => (spec?.charts ?? []).map((c) => evaluateChart(c, scope)).filter((c): c is NonNullable<typeof c> => !!c), [spec, scope])
  const cutPlane = spec?.recommendedCut
  const inlineConfig: InlineViewConfig = {
    independent: true,
    cutEnabled: cut,
    cutNormal: (cutPlane?.normal ?? [0, 0, 1]) as [number, number, number],
    cutPos: cutPlane?.pos ?? 0,
    explode,
    xray,
    showLabels: labels,
    playing,
    selectedPartId: selected?.id ?? null,
    onSelectPart: setSelected,
  }
  const hasMotion = !!spec && JSON.stringify(spec.parts).includes('"motion"')

  const canvasBg = dark ? '#090d10' : '#f3f2ec'

  const viewport = (
    <div ref={box} className="relative h-full w-full" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={(e) => (e.preventDefault(), setDragging(false), loadFile(e.dataTransfer.files?.[0]))}>
      {spec && fit ? (
        <Canvas
          key={spec.id}
          shadows
          dpr={[1, 2]}
          camera={{ fov: 32, near: Math.max(0.001, fit.extent / 200), far: Math.max(50, fit.extent * 60), position: fit.camera.position }}
          gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
          onPointerMissed={() => setSelected(null)}
        >
          <color attach="background" args={[canvasBg]} />
          <SimClockDriver />
          <InlineStudioLights extent={fit.extent} />
          <CutController hatchScale={fit.extent / 220} />
          <Suspense fallback={null}>
            <NoteSceneViewport spec={spec} params={params} inlineConfig={inlineConfig} />
          </Suspense>
          <group position={[0, fit.floorY, 0]}>
            <mesh rotation-x={-Math.PI / 2} receiveShadow>
              <planeGeometry args={[fit.extent * 30, fit.extent * 30]} />
              <shadowMaterial transparent opacity={0.22} />
            </mesh>
            <ContactShadows resolution={512} scale={fit.extent * 8} blur={2.4} opacity={0.5} far={fit.extent * 1.6} color="#000000" position={[0, 0.001, 0]} />
          </group>
          <Grid
            position={[0, fit.floorY + 0.0005, 0]}
            args={[fit.extent * 16, fit.extent * 16]}
            cellSize={fit.extent / 10}
            cellThickness={0.5}
            cellColor={dark ? '#16202a' : '#dedbd1'}
            sectionSize={fit.extent / 2}
            sectionThickness={0.9}
            sectionColor={dark ? '#223242' : '#c9c3b5'}
            fadeDistance={fit.extent * 6}
            fadeStrength={1.5}
            infiniteGrid
          />
          <OrbitControls makeDefault target={fit.camera.target} enableDamping dampingFactor={0.08} />
        </Canvas>
      ) : (
        <div className={`grid h-full place-items-center px-6 text-center ${dragging ? 'bg-accent/10' : ''}`}>
          <div>
            <p className="text-[17px] font-semibold text-ink">{busy ? 'Opening…' : 'Drop a .slfy file here'}</p>
            {!busy ? (
              <button type="button" onClick={() => input.current?.click()} className="mt-3 rounded-full bg-accent px-5 py-2 text-[13.5px] font-semibold text-accent-ink hover:opacity-90">
                Choose a file
              </button>
            ) : null}
          </div>
        </div>
      )}

      {spec && !SHOT ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-line-2 bg-panel-2/90 px-2 py-1.5 shadow-xl backdrop-blur">
            {hasMotion ? (
              <ToolButton on={playing} onClick={() => setPlaying((v) => !v)} label={playing ? 'Pause' : 'Play'} />
            ) : null}
            <ToolButton on={cut} onClick={() => setCut((v) => !v)} label="Cut away" />
            {/* embedded on someone's page, the bar stays one short row; the full viewer has the rest */}
            {!EMBED ? <ToolButton on={xray} onClick={() => setXray((v) => !v)} label="X-ray" /> : null}
            {!EMBED ? <ToolButton on={labels} onClick={() => setLabels((v) => !v)} label="Labels" /> : null}
            <label className="flex items-center gap-2 whitespace-nowrap px-2 text-[12px] text-mute">
              Take apart
              <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(Number(e.target.value))} className="slider w-20" style={{ ['--fill' as string]: `${explode * 100}%` }} aria-label="Take apart" />
            </label>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="absolute left-3 top-3 max-w-[280px] rounded-2xl border border-line-2 bg-panel/95 p-3 shadow-xl backdrop-blur">
          <p className="text-[13.5px] font-semibold text-ink">{selected.name}</p>
          {selected.info?.summary ? <p className="mt-1 text-[12px] leading-snug text-mute">{selected.info.summary}</p> : null}
          {selected.info?.role ? <p className="mt-1 text-[12px] leading-snug text-ink/80">{selected.info.role}</p> : null}
        </div>
      ) : null}

      {EMBED && spec && !SHOT ? (
        <a href={`./?file=${encodeURIComponent(query.get('file') ?? '')}`} target="_blank" rel="noopener" className="absolute right-3 top-3 rounded-full border border-line-2 bg-panel/90 px-3 py-1.5 text-[12px] font-medium text-ink backdrop-blur hover:border-ink/40">
          Open with its working ↗
        </a>
      ) : null}
    </div>
  )

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".slfy,.json,application/json,application/vnd.solidify+json"
      className="hidden"
      onChange={(e) => {
        loadFile(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  if (EMBED) {
    return (
      <div className="h-full w-full bg-bg text-ink">
        {viewport}
        {fileInput}
        {error ? <p className="absolute inset-x-3 top-3 rounded-xl bg-panel px-3 py-2 text-[12.5px] text-ink">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
        <a href="../" className="text-[17px] font-bold tracking-[-0.02em] text-ink">
          <span className="text-accent">.</span>slfy <span className="text-[13px] font-medium text-mute">viewer</span>
        </a>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{spec?.title ?? ''}</span>
        <div className="flex items-center gap-2">
          <a href="../#examples" className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-mute hover:bg-panel-2 hover:text-ink">
            Examples
          </a>
          <button type="button" onClick={() => input.current?.click()} className="rounded-full border border-line-2 px-3.5 py-1.5 text-[12.5px] font-medium text-ink hover:border-ink/40">
            Open a file
          </button>
        </div>
        {fileInput}
      </header>
      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[13px]">
          {error}
        </p>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(320px,56vh)_auto] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
        <div className="min-h-0">{viewport}</div>
        <aside className="min-h-0 overflow-y-auto border-line px-4 py-4 lg:border-l">
          {spec ? (
            <>
              <h1 className="text-[18px] font-semibold leading-snug tracking-[-0.01em]">{spec.title}</h1>
              <p className="mt-1 text-[13px] leading-relaxed text-mute">{spec.summary}</p>
              {model?.warnings.length ? <p className="mt-2 text-[12px] text-mute">{model.warnings.join(' ')}</p> : null}

              {spec.question ? (
                <Section title="Question">
                  <p className="text-[13px] leading-relaxed">{spec.question.text}</p>
                  {spec.question.find.length ? (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12.5px] text-mute">
                      {spec.question.find.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                </Section>
              ) : null}

              {spec.parameters.length ? (
                <Section title="Sizes and values">
                  <div className="space-y-3">
                    {spec.parameters.map((p) => {
                      const v = params[p.id] ?? p.value
                      const fill = ((v - p.min) / (p.max - p.min || 1)) * 100
                      return (
                        <label key={p.id} className="block">
                          <span className="flex justify-between text-[12.5px]">
                            <span>{p.label}</span>
                            <span className="font-mono text-accent">
                              {fmtStep(v, p.step)}
                              {p.unit ? ` ${p.unit}` : ''}
                            </span>
                          </span>
                          <input type="range" min={p.min} max={p.max} step={p.step} value={v} onChange={(e) => setParams((s) => ({ ...s, [p.id]: Number(e.target.value) }))} className="slider mt-1 w-full" style={{ ['--fill' as string]: `${fill}%` }} aria-label={p.label} />
                        </label>
                      )
                    })}
                  </div>
                </Section>
              ) : null}

              {results.length ? (
                <Section title={spec.question ? 'Worked solution' : 'Working'}>
                  <ol className="space-y-2">
                    {results.map((r, i) => (
                      <li key={r.spec.id} className={`rounded-xl border px-3 py-2 ${r.status === 'warn' ? 'border-amber-500/50' : 'border-line'} ${r.spec.answer ? 'bg-accent/8' : 'bg-panel'}`}>
                        {r.spec.step ? <p className="text-[12px] text-mute">{`${i + 1}. ${r.spec.step}`}</p> : null}
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[12.5px]">{r.spec.label}</span>
                          <span className="shrink-0 font-mono text-[13px] font-medium">
                            {r.formatted}
                            {r.spec.unit && !r.broken ? <span className="text-mute"> {r.spec.unit}</span> : null}
                          </span>
                        </div>
                        {r.spec.latex ? (
                          <div className="mt-1 overflow-x-auto text-[12.5px] text-mute">
                            <Tex tex={r.spec.latex} />
                          </div>
                        ) : null}
                        {r.status === 'warn' && r.limitValue !== undefined ? (
                          <p className="mt-1 text-[11.5px] text-amber-600 dark:text-amber-400">
                            {r.spec.limit?.kind === 'max' ? 'Over' : 'Under'} {r.spec.limit?.label ?? 'the limit'} ({fmt(r.limitValue)} {r.spec.unit})
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </Section>
              ) : null}

              {charts.map((c) => (
                <Section key={c.spec.id} title={c.spec.title}>
                  <ChartView chart={c} />
                </Section>
              ))}

              <Section title="Parts">
                <ul className="flex flex-wrap gap-1.5">
                  {flatParts(spec.parts).map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => setSelected(p)} className={`rounded-full border px-2.5 py-1 text-[12px] ${selected?.id === p.id ? 'border-accent text-ink' : 'border-line-2 text-mute hover:text-ink'}`}>
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
              <p className="mt-6 text-[11.5px] text-dim">
                {model?.name} · .slfy {SLFY_VERSION}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-mute">Open a .slfy file, or pick one of the examples.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function ToolButton({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition-colors ${on ? 'bg-accent text-accent-ink' : 'text-mute hover:bg-panel-3 hover:text-ink'}`}>
      {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">{title}</h2>
      {children}
    </section>
  )
}
