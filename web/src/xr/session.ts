import { create } from 'zustand'

/**
 * Whether this device can show a rig in the headset, and whether it is doing so. The headset code itself
 * (`./lab`) is a separate file, fetched only on a device that supports it (a Quest browser, or the
 * emulator on a developer's machine), so nobody else downloads it.
 */
interface XRSessionState {
  /** 'ar': the rig on the real table (passthrough); 'vr': in a virtual room; null: not on this device */
  supported: 'ar' | 'vr' | null
  /** the headset code has loaded */
  loaded: boolean
  /** a session is on */
  active: boolean
  mode: 'ar' | 'vr' | null
}

export const useXRSession = create<XRSessionState>(() => ({ supported: null, loaded: false, active: false, mode: null }))

let loading: Promise<typeof import('./lab')> | null = null
export const loadXR = () => {
  loading ??= import('./lab').then((m) => {
    useXRSession.setState({ loaded: true })
    return m
  })
  return loading
}

const local = () => typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)

let checked = false
/** finds out once whether the device can enter a session; on a supporting device the headset code is fetched ahead, so Enter starts at once */
export async function checkXRSupport() {
  if (checked) return
  checked = true
  const probe = async () => {
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr
    if (!xr) return null
    if (await xr.isSessionSupported('immersive-ar').catch(() => false)) return 'ar' as const
    if (await xr.isSessionSupported('immersive-vr').catch(() => false)) return 'vr' as const
    return null
  }
  try {
    let supported = await probe()
    // on a developer's machine with no headset: an emulated Quest (with hands) for testing. The browser's own
    // WebXR, which has no headset behind it, is hidden so the emulator can take its place
    if (!supported && local()) {
      if ('xr' in navigator) Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true })
      // ?xrtest: the emulated Quest without its control panel, so a test script can move the hands itself
      if (/[?&]xrtest(&|=|$)/.test(location.search)) {
        const { XRDevice, metaQuest3 } = await import('iwer')
        const device = new XRDevice(metaQuest3)
        device.primaryInputMode = 'hand'
        device.installRuntime()
        ;(window as unknown as { __xrDevice?: unknown }).__xrDevice = device
      }
      await loadXR()
      for (let i = 0; !supported && i < 15; i++) {
        await new Promise((r) => setTimeout(r, 500))
        supported = await probe()
      }
    }
    useXRSession.setState({ supported })
    if (supported) void loadXR()
  } catch {
    /* no headset: nothing to show */
  }
}

/** starts a session (from a tap, so the browser allows it) */
export async function enterXR() {
  const { supported } = useXRSession.getState()
  if (!supported) return
  const m = await loadXR()
  await m.enter(supported)
}
