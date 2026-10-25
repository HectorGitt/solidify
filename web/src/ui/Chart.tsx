import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useIsLight } from './theme'

export interface ChartSeries {
  label: string
  color: string
  width?: number
  dash?: number[]
  /** draw points only */
  points?: boolean
}

export interface ChartProps {
  /** x values then one array per series (all same length; use null for gaps) */
  data: (number | null)[][]
  series: ChartSeries[]
  xLabel: string
  yLabel: string
  height?: number
  logX?: boolean
  logY?: boolean
  /** live marker: returns [x, y] or null; polled every animation frame */
  marker?: () => [number, number] | null
  markerColor?: string
  /** segments of the loop to emphasise (optional) */
  xRange?: [number, number]
  yRange?: [number, number]
}

const axis = (light: boolean) => ({
  stroke: light ? '#4c5648' : '#a3aaa0',
  grid: { stroke: light ? 'rgba(14, 18, 12, 0.08)' : 'rgba(255, 255, 255, 0.07)', width: 1 },
  ticks: { stroke: light ? 'rgba(14, 18, 12, 0.2)' : 'rgba(255, 255, 255, 0.15)', width: 1 },
  font: '10.5px JetBrains Mono, monospace',
  labelFont: '11px Sora, sans-serif',
})

/** Series colours are picked for a dark panel; on a light one, take them 40 % toward black so lines keep their contrast. */
export function seriesInk(color: string, light: boolean): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color)
  if (!light || !m) return color
  const n = parseInt(m[1], 16)
  const rgb = [16, 8, 0].map((shift) => (n >> shift) & 255)
  // a near-white line (the "current" curve) becomes ink rather than grey
  if (Math.max(...rgb) - Math.min(...rgb) < 31 && Math.min(...rgb) > 190) return '#0e120c'
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * 0.6)
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
}

/** Small uPlot wrapper tuned for engineering plots with a live state marker. */
export function Chart({ data, series, xLabel, yLabel, height = 190, logX, logY, marker, markerColor = '#f5b942', xRange, yRange }: ChartProps) {
  const host = useRef<HTMLDivElement>(null)
  const plot = useRef<uPlot | null>(null)
  const markerRef = useRef(marker)
  markerRef.current = marker
  const dataRef = useRef(data)
  dataRef.current = data
  const light = useIsLight()

  useEffect(() => {
    const el = host.current
    if (!el) return
    const width = el.clientWidth || 300
    // loops are not sorted in x, so uPlot's default (first/last point) x-range would collapse
    const autoX = (): [number, number] => {
      const xs = (dataRef.current[0] as (number | null)[]).filter((v): v is number => v !== null && Number.isFinite(v))
      let lo = Math.min(...xs)
      let hi = Math.max(...xs)
      if (logX) return [lo / 1.08, hi * 1.08]
      const pad = (hi - lo || Math.abs(hi) || 1) * 0.04
      lo -= pad
      hi += pad
      return [lo, hi]
    }
    const opts: uPlot.Options = {
      width,
      height,
      legend: { show: false },
      cursor: { show: true, points: { show: false }, drag: { x: false, y: false } },
      scales: {
        x: { time: false, distr: logX ? 3 : 1, range: xRange ? () => xRange : () => autoX() },
        y: { distr: logY ? 3 : 1, ...(yRange ? { range: yRange } : {}) },
      },
      axes: [
        { ...axis(light), label: xLabel, size: 34, labelSize: 16 },
        { ...axis(light), label: yLabel, size: 48, labelSize: 16 },
      ],
      series: [
        {},
        ...series.map((s) => ({
          label: s.label,
          stroke: seriesInk(s.color, light),
          width: s.width ?? 1.75,
          dash: s.dash,
          points: { show: s.points ?? false, size: 5, fill: seriesInk(s.color, light) },
          spanGaps: false,
        })),
      ],
      hooks: {
        draw: [
          (u) => {
            const m = markerRef.current?.()
            if (!m) return
            const [mx, my] = m
            const cx = u.valToPos(mx, 'x', true)
            const cy = u.valToPos(my, 'y', true)
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return
            const ctx = u.ctx
            ctx.save()
            ctx.beginPath()
            ctx.arc(cx, cy, 5 * devicePixelRatio, 0, Math.PI * 2)
            ctx.fillStyle = seriesInk(markerColor, light)
            ctx.fill()
            ctx.lineWidth = 2 * devicePixelRatio
            ctx.strokeStyle = light ? '#ffffff' : '#050607'
            ctx.stroke()
            ctx.restore()
          },
        ],
      },
    }
    const u = new uPlot(opts, data as uPlot.AlignedData, el)
    plot.current = u
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (w > 0) u.setSize({ width: w, height })
    })
    ro.observe(el)
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (markerRef.current) u.redraw(false, false)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      u.destroy()
      plot.current = null
    }
    // series/axes structure is fixed per mount; data updates are handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, logX, logY, xLabel, yLabel, series.length, light])

  useEffect(() => {
    plot.current?.setData(data as uPlot.AlignedData, true)
  }, [data])

  return <div ref={host} className="w-full" />
}
