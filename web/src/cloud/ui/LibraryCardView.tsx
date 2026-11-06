import type { LibraryCard } from '../admin'

/** one library model as a card: its topic, title, what it shows and its size */
export function LibraryCardView({ item, opening, onOpen }: { item: LibraryCard; opening: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      disabled={opening}
      onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-line bg-panel p-4 text-left transition-colors hover:border-line-2 disabled:opacity-60"
    >
      {item.topic ? <span className="text-[11px] uppercase tracking-wide text-dim">{item.topic}</span> : null}
      <span className="mt-1 text-[13.5px] font-semibold text-ink group-hover:underline">{item.title}</span>
      <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-mute">{item.prompt}</span>
      <span className="mt-auto pt-3 text-[11.5px] text-dim">{opening ? 'Opening…' : `${item.parts} parts`}</span>
    </button>
  )
}
