import { useMemo, useState } from 'react'
import { buildTree, useParts, type PartNode } from '@/parts/registry'
import { useView } from '@/render/view'
import { focusPart } from './camera'
import { Icon } from './icons'

function Row({ node, depth }: { node: PartNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1)
  const selectedId = useView((s) => s.selectedId)
  const hidden = useView((s) => s.hidden.includes(node.id))
  const select = useView((s) => s.select)
  const hover = useView((s) => s.hover)
  const toggleHidden = useView((s) => s.toggleHidden)
  const selected = selectedId === node.id
  const hasKids = node.children.length > 0
  return (
    <li>
      <div
        className={`group flex items-center gap-1 rounded-md pr-1 text-[12.5px] ${selected ? 'bg-accent/15 text-ink' : 'text-ink/80 hover:bg-panel-3'}`}
        style={{ paddingLeft: 4 + depth * 12 }}
        onMouseEnter={() => hover(node.id)}
        onMouseLeave={() => hover(null)}
      >
        <button
          aria-label={open ? 'Collapse' : 'Expand'}
          className={`grid h-5 w-4 place-items-center text-dim ${hasKids ? '' : 'invisible'}`}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon.chevron width={12} height={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        <button
          className={`min-w-0 flex-1 truncate py-1 text-left ${hidden ? 'text-dim line-through' : ''}`}
          onClick={() => select(selected ? null : node.id)}
          onDoubleClick={() => focusPart(node.id)}
          title={node.info?.summary ?? node.name}
        >
          {node.name}
        </button>
        <button
          aria-label={hidden ? `Show ${node.name}` : `Hide ${node.name}`}
          className={`grid h-6 w-6 place-items-center rounded text-dim hover:text-ink ${hidden ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
          onClick={() => toggleHidden(node.id)}
        >
          {hidden ? <Icon.eyeOff width={14} height={14} /> : <Icon.eye width={14} height={14} />}
        </button>
      </div>
      {hasKids && open ? (
        <ul>
          {node.children.map((c) => (
            <Row key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function PartsTree() {
  const parts = useParts((s) => s.parts)
  const tree = useMemo(() => buildTree(parts), [parts])
  const hiddenCount = useView((s) => s.hidden.length)
  const isolated = useView((s) => s.isolatedId)
  const showAll = useView((s) => s.showAll)
  return (
    <div>
      {(hiddenCount > 0 || isolated) && (
        <button onClick={showAll} className="mb-1 w-full rounded-md border border-line-2 px-2 py-1 text-[11.5px] text-info hover:bg-panel-3">
          Show all parts
        </button>
      )}
      {tree.length === 0 ? <p className="px-1 text-[12px] text-dim">Loading parts…</p> : null}
      <ul>
        {tree.map((n) => (
          <Row key={n.id} node={n} depth={0} />
        ))}
      </ul>
    </div>
  )
}
