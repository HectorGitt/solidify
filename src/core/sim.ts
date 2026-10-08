import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { create } from 'zustand'

/**
 * Global simulation clock. Real mechanisms run far too fast to see (a 2000 rpm engine
 * turns 33 times a second), so the sim runs on scaled time: simDt = realDt × timeScale.
 */
export interface SimClock {
  playing: boolean
  /** sim seconds per real second */
  timeScale: number
  /** accumulated sim time, s */
  time: number
  /** request a single step of `stepSize` sim seconds while paused */
  stepRequest: number
  stepSize: number
  setPlaying: (p: boolean) => void
  toggle: () => void
  setTimeScale: (s: number) => void
  step: () => void
  reset: () => void
}

export const TIME_SCALES = [1 / 200, 1 / 100, 1 / 50, 1 / 20, 1 / 10, 1 / 4, 1 / 2, 1] as const

export const useSim = create<SimClock>((set) => ({
  playing: true,
  timeScale: 1 / 50,
  time: 0,
  stepRequest: 0,
  stepSize: 1 / 600,
  setPlaying: (playing) => set({ playing }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  setTimeScale: (timeScale) => set({ timeScale }),
  step: () => set((s) => ({ stepRequest: s.stepRequest + 1, playing: false })),
  reset: () => set({ time: 0 }),
}))

/** Largest real frame time honoured; protects against tab-switch jumps. */
const MAX_REAL_DT = 1 / 20

/**
 * Like useFrame, but the callback receives scaled sim time. Runs nothing while paused
 * (except single steps). The sim time is advanced once per frame by <SimClockDriver/>.
 */
export function useSimFrame(cb: (simDt: number, simTime: number) => void, priority = 0) {
  const lastStep = useRef(useSim.getState().stepRequest)
  useFrame((_, realDt) => {
    const s = useSim.getState()
    let dt = 0
    if (s.playing) dt = Math.min(realDt, MAX_REAL_DT) * s.timeScale
    else if (s.stepRequest !== lastStep.current) dt = s.stepSize
    lastStep.current = s.stepRequest
    cb(dt, s.time)
  }, priority)
}

/** Mount once inside the Canvas: advances the shared clock (runs before other frame callbacks). */
export function SimClockDriver() {
  const lastStep = useRef(useSim.getState().stepRequest)
  useFrame((_, realDt) => {
    const s = useSim.getState()
    let dt = 0
    if (s.playing) dt = Math.min(realDt, MAX_REAL_DT) * s.timeScale
    else if (s.stepRequest !== lastStep.current) dt = s.stepSize
    lastStep.current = s.stepRequest
    if (dt > 0) useSim.setState({ time: s.time + dt })
  }, -100)
  return null
}

export function formatTimeScale(s: number) {
  if (s >= 1) return `${s}×`
  return `1/${Math.round(1 / s)}×`
}
