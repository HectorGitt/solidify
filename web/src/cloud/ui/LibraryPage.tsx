import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pills, StudyShell } from '@/study/ui/StudyShell'
import { Icon } from '@/ui/icons'
import { CardGridSkeleton } from '@/ui/Skeleton'
import { ApiError } from '../api'
import { listLibrary, type LibraryCard } from '../admin'
import { useOpenLibrary } from '../library'
import { ghostBtn, inputCls, primaryBtn } from './Modal'
import { LibraryCardView } from './LibraryCardView'

/** every published model, for anyone to browse; opening one gives you your own copy to change */
export default function LibraryPage() {
  const [items, setItems] = useState<LibraryCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('all')
  const { opening, open } = useOpenLibrary()

  const load = () => {
    setError(null)
    listLibrary()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t load the library.'))
  }
  useEffect(load, [])

  const topics = useMemo(() => [...new Set((items ?? []).map((i) => i.topic).filter((t): t is string => !!t))].sort(), [items])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter((i) => (topic === 'all' || i.topic === topic) && (!q || `${i.title} ${i.prompt} ${i.topic ?? ''}`.toLowerCase().includes(q)))
  }, [items, query, topic])

  return (
    <StudyShell
      title="Model library"
      lead="Machines and structures built by Solidify and checked by the team. Open one to get your own copy: cut it open, run it, resize it and change it by chatting."
      right={
        <Link to="/create/new" className={primaryBtn}>
          Build your own
        </Link>
      }
    >
      <div className="pb-16">
        {error ? (
          <section className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-panel px-6 py-12 text-center">
            <p className="text-[13.5px] text-ink">{error}</p>
            <button type="button" className={ghostBtn} onClick={load}>
              Try again
            </button>
          </section>
        ) : items === null ? (
          <CardGridSkeleton cards={8} cols="sm:grid-cols-2 lg:grid-cols-4" />
        ) : items.length === 0 ? (
          <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-2 bg-panel px-6 py-16 text-center">
            <Icon.build width={30} height={30} className="text-dim" />
            <h2 className="text-[16px] font-semibold text-ink">The library is on its way</h2>
            <p className="max-w-md text-[13px] text-mute">New models are added as the team checks them. In the meantime, describe any machine and Solidify builds it for you.</p>
            <Link to="/create/new" className={primaryBtn}>
              Build a model
            </Link>
          </section>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the library" aria-label="Search the library" className={`${inputCls} sm:max-w-xs`} />
              {topics.length > 1 ? <Pills label="Topic" value={topic} onChange={setTopic} options={[{ value: 'all', label: 'All' }, ...topics.map((t) => ({ value: t, label: t }))]} /> : null}
            </div>
            {shown.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {shown.map((item) => (
                  <LibraryCardView key={item.id} item={item} opening={opening === item.id} onOpen={() => void open(item)} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-line-2 px-6 py-10 text-center text-[13px] text-mute">Nothing matches. Try another word, or build it yourself.</p>
            )}
          </>
        )}
      </div>
    </StudyShell>
  )
}
