import { useState } from 'react'
import { TIME_SCALES, formatTimeScale, useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { useView } from '@/render/view'
import { flyTo } from './camera'
import { IconButton } from './controls'
import { Icon } from './icons'

function Divider() {
  return <span className="mx-1 h-5 w-px bg-line-2" aria-hidden />
}

/** Floating viewport toolbar: time, section, explode, x-ray, labels, camera. */
export function Toolbar({ scene }: { scene: SceneDef }) {
  const playing = useSim((s) => s.playing)
  const toggle = useSim((s) => s.toggle)
  const step = useSim((s) => s.step)
  const timeScale = useSim((s) => s.timeScale)
  const setTimeScale = useSim((s) => s.setTimeScale)

  const cut = useView((s) => s.cut)
  const setCut = useView((s) => s.setCut)
  const setPlane = useView((s) => s.setPlane)
  const presets = useView((s) => s.cutPresets)
  const activePreset = useView((s) => s.activePreset)
  const applyPreset = useView((s) => s.applyPreset)
  const explode = useView((s) => s.explode)
  const setExplode = useView((s) => s.setExplode)
  const xray = useView((s) => s.xray)
  const setXray = useView((s) => s.setXray)
  const faultMode = useView((s) => s.faultMode)
  const setFaultMode = useView((s) => s.setFaultMode)
  const labels = useView((s) => s.labels)
  const setLabels = useView((s) => s.setLabels)
  const [openCut, setOpenCut] = useState(false)

  const primaryPlane = cut.planes[0]
  const cutRange = scene.extent * 0.6
  const cutFill = primaryPlane ? ((primaryPlane.pos + cutRange) / (2 * cutRange)) * 100 : 50

  return (
    <div className="pointer-events-auto relative max-w-[calc(100vw-1.5rem)]">
      {/* phones: two centred rows, so every control is in reach without a hidden sideways scroll */}
      <div className="flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-line-2 bg-panel-2/85 px-2 py-1.5 sm:flex-nowrap sm:justify-start sm:overflow-x-auto sm:px-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl ring-1 ring-ink/[0.04]">
        <IconButton label={playing ? 'Pause (space)' : 'Play (space)'} onClick={toggle} active={playing}>
          {playing ? <Icon.pause /> : <Icon.play />}
        </IconButton>
        <IconButton label="Step one frame" onClick={step}>
          {Icon.step ? <Icon.step /> : null}
        </IconButton>
        <label className="ml-1 flex items-center gap-1 text-[11.5px] text-mute" title="Slow motion: sim seconds per real second">
          <span className="sr-only">Speed</span>
          <select
            className="rounded-lg border border-line-2 bg-panel px-1.5 py-1 font-mono text-[11.5px] text-ink focus:outline-none focus:border-accent"
            value={timeScale}
            onChange={(e) => setTimeScale(parseFloat(e.target.value))}
          >
            {TIME_SCALES.map((t) => (
              <option key={t} value={t}>
                {formatTimeScale(t)}
              </option>
            ))}
          </select>
        </label>
        <Divider />
        <IconButton label={cut.enabled ? 'Section: on (C)' : 'Section: off (C)'} onClick={() => setCut({ enabled: !cut.enabled })} active={cut.enabled}>
          <Icon.cut />
        </IconButton>
        {cut.enabled && primaryPlane ? (
          <div className="hidden items-center gap-1.5 px-1 sm:flex" title="Sweep section plane across assembly">
            <input
              aria-label="Sweep section plane"
              type="range"
              className="slider w-20"
              min={-cutRange}
              max={cutRange}
              step={scene.extent / 1000}
              value={primaryPlane.pos}
              style={{ ['--fill' as string]: `${Math.max(0, Math.min(100, cutFill))}%` }}
              onChange={(e) => setPlane(0, { pos: parseFloat(e.target.value) })}
            />
          </div>
        ) : null}
        <button
          className="max-w-[9.5rem] truncate whitespace-nowrap rounded-lg px-2 py-1 text-[11.5px] font-medium text-mute hover:bg-panel-3 hover:text-ink transition-colors sm:max-w-none sm:shrink-0"
          onClick={() => {
            const next = !openCut
            setOpenCut(next)
            useView.getState().setShowPlanes(next)
          }}
          aria-expanded={openCut}
        >
          {presets.find((p) => p.id === activePreset)?.label ?? 'Custom'}
        </button>
        <Divider />
        <div className="flex items-center gap-1.5 px-1" title="Exploded view">
          <Icon.explode className="text-mute" />
          <input
            aria-label="Explode"
            type="range"
            className="slider w-16 sm:w-20"
            min={0}
            max={1}
            step={0.01}
            value={explode}
            style={{ ['--fill' as string]: `${explode * 100}%` }}
            onChange={(e) => setExplode(parseFloat(e.target.value))}
          />
        </div>
        <IconButton label="X-ray housings" onClick={() => setXray(!xray)} active={xray}>
          <Icon.xray />
        </IconButton>
        <IconButton label="Faults: tint parts with common faults (click one for symptoms and remedies)" onClick={() => setFaultMode(!faultMode)} active={faultMode}>
          <Icon.wrench />
        </IconButton>
        <IconButton label="Part labels" onClick={() => setLabels(!labels)} active={labels}>
          <Icon.label />
        </IconButton>
        <IconButton label="Measurement Calipers" onClick={() => useView.getState().setCaliperMode(!useView.getState().caliperMode)} active={useView((s) => s.caliperMode)}>
          <Icon.ruler />
        </IconButton>
        <IconButton label="Reset camera" onClick={() => flyTo(scene.camera)}>
          <Icon.camera />
        </IconButton>
      </div>

      {openCut ? (
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 w-72 -translate-x-1/2 rounded-2xl border border-line-2 bg-panel-2/95 p-3.5 shadow-2xl shadow-black/70 backdrop-blur-xl ring-1 ring-ink/[0.05]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-mute">Section view</div>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${
                  activePreset === p.id && cut.enabled ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-mute hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {cut.planes.map((_, i) => (
            <PlaneSlider key={i} index={i} extent={scene.extent} />
          ))}
          <label className="mt-2 flex items-center justify-between text-[12px] text-ink/90">
            Section moving parts too
            <input type="checkbox" checked={cut.sectionMoving} onChange={(e) => setCut({ sectionMoving: e.target.checked })} />
          </label>
          <p className="mt-2 text-[11px] leading-snug text-dim">
            Museum-style cutaway: housings are sectioned and hatched by material; moving parts stay whole unless you section them too.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function PlaneSlider({ index, extent }: { index: number; extent: number }) {
  const plane = useView((s) => s.cut.planes[index])
  const setPlane = useView((s) => s.setPlane)
  if (!plane) return null
  const axis = Math.abs(plane.normal[0]) > 0.9 ? 'X' : Math.abs(plane.normal[1]) > 0.9 ? 'Y' : Math.abs(plane.normal[2]) > 0.9 ? 'Z' : 'n'
  const range = extent * 0.6
  const fill = ((plane.pos + range) / (2 * range)) * 100
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex justify-between text-[11.5px] text-mute">
        <span>
          Plane {index + 1} · {axis} {plane.normal.some((v) => v < 0) ? '(−)' : '(+)'}
        </span>
        <button
          className="text-[11px] text-info hover:underline"
          onClick={() => setPlane(index, { normal: plane.normal.map((v) => -v) as [number, number, number], pos: -plane.pos })}
        >
          flip side
        </button>
      </div>
      <input
        aria-label={`Plane ${index + 1} position`}
        type="range"
        className="slider"
        min={-range}
        max={range}
        step={extent / 1000}
        value={plane.pos}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => setPlane(index, { pos: parseFloat(e.target.value) })}
      />
    </div>
  )
}
