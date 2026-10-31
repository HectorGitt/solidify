import { useParts } from '@/parts/registry'
import { useView } from '@/render/view'

/**
 * What the user is looking at, for the tutor: live readouts and worked-solution steps currently
 * rendered (tagged with data-readout / data-working-step), and the selected part.
 */
export function collectReadouts(root: ParentNode = document, max = 40): Record<string, string> {
  const out: Record<string, string> = {}
  for (const el of Array.from(root.querySelectorAll('[data-readout]')).slice(0, max)) {
    const label = el.querySelector('[data-readout-label]')?.textContent?.trim()
    const v = el.querySelector('[data-readout-value]')
    // value and unit are separate nodes; keep a space between them ("978.3 rpm")
    const value = v ? Array.from(v.childNodes, (n) => n.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim() : undefined
    if (label && value) out[label.slice(0, 80)] = value.slice(0, 120)
  }
  return out
}

export function collectWorking(root: ParentNode = document, max = 30): string[] {
  return Array.from(root.querySelectorAll('[data-working-step]'))
    .slice(0, max)
    .map((el) => (el.getAttribute('data-working-step') ?? '').slice(0, 600))
    .filter(Boolean)
}

export function selectedPart(): { name: string; summary?: string; role?: string } | undefined {
  const id = useView.getState().selectedId
  if (!id) return undefined
  const p = useParts.getState().parts[id]
  if (!p) return undefined
  const clip = (s?: string) => (s ? s.slice(0, 1500) : undefined)
  return { name: p.name.slice(0, 200), summary: clip(p.info?.summary), role: clip(p.info?.role) }
}
