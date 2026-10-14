import { Html } from '@react-three/drei'
import { useParts } from '@/parts/registry'
import { useView } from './view'

/** A floating name tag for a part, shown when labels are switched on. */
export function PartLabel({ partId, at, text }: { partId: string; at: [number, number, number]; text?: string }) {
  const labels = useView((s) => s.labels)
  const name = useParts((s) => s.parts[partId]?.name)
  const hidden = useView((s) => s.hidden.includes(partId))
  const isolated = useView((s) => s.isolatedId)
  if (!labels) return null
  // isolating or hiding parts happens mid-render: hide with CSS, since unmounting an Html root then makes React warn
  const show = !hidden && !(isolated && isolated !== partId)
  return (
    <Html position={at} zIndexRange={[20, 0]} style={{ pointerEvents: 'none', display: show ? undefined : 'none' }}>
      <div className="part-label">
        <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 3, background: 'var(--color-accent)', marginRight: 5, verticalAlign: 1 }} />
        {text ?? name ?? partId}
      </div>
    </Html>
  )
}
