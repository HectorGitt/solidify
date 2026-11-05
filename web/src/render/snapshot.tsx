import { useFrame, useThree } from '@react-three/fiber'

/**
 * A small picture of the 3D view, e.g. for a saved model's card. The page asks with `requestSnapshot()`;
 * the grabber inside the viewer answers on its next frame by rendering once and reading the canvas, so the
 * viewer does not have to keep its drawing buffer (which costs speed everywhere).
 */
let pending: ((url: string | null) => void)[] = []

export function requestSnapshot({ width = 480, timeoutMs = 3000 } = {}): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => {
      pending = pending.filter((r) => r !== done)
      resolve(null)
    }, timeoutMs)
    const done = (url: string | null) => {
      clearTimeout(timer)
      if (url) void shrink(url, width).then(resolve)
      else resolve(null)
    }
    pending.push(done)
  })
}

/** scales the frame down to `width` and re-encodes it as a small JPEG */
function shrink(url: string, width: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, width / img.width)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      const ctx = c.getContext('2d')
      if (!ctx) return resolve(null)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** mounted once inside the viewer's canvas */
export function SnapshotGrabber() {
  const { gl, scene, camera } = useThree()
  useFrame(() => {
    if (!pending.length) return
    const waiting = pending
    pending = []
    let url: string | null = null
    try {
      gl.render(scene, camera)
      url = gl.domElement.toDataURL('image/png')
    } catch {
      url = null
    }
    for (const r of waiting) r(url)
  })
  return null
}
