import { describe, expect, it } from 'vitest'
import { deviceOf, isNoise } from './crashes'

describe('crash reports', () => {
  it('names the browser and device without anything personal', () => {
    expect(deviceOf('Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.1 Chrome/126.0 VR Safari/537.36')).toBe('Quest Browser · Quest')
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge · Windows')
    expect(deviceOf('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toBe('Chrome · Android')
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS')
  })

  it('ignores what is not the app’s fault', () => {
    expect(isNoise('Script error.')).toBe(true)
    expect(isNoise('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
    expect(isNoise('The user aborted a request.')).toBe(true)
    expect(isNoise('x is not a function', 'chrome-extension://abc/content.js')).toBe(true)
    expect(isNoise('x is not a function', 'https://some-other-site.example/a.js', 'https://solidify.studio')).toBe(true)
    expect(isNoise('x is not a function', 'https://solidify.studio/assets/index.js', 'https://solidify.studio')).toBe(false)
    expect(isNoise('Cannot read properties of undefined (reading "parts")')).toBe(false)
  })
})
