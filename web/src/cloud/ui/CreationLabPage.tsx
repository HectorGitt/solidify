import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StudyShell } from '@/study/ui/StudyShell'
import { Icon } from '@/ui/icons'
import { toast } from '@/ui/toast'
import { ApiError } from '../api'
import { useAuth } from '../auth'
import { deleteCreation, getCreation, listCreations, saveNewCreation, updateCreation, type CreationSummary } from '../creations'
import { ghostBtn, inputCls, primaryBtn } from './Modal'
import { ModelCardSkeleton } from '@/ui/Skeleton'
import { logEvent } from '../events'

const when = (t: number) => {
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const smallBtn = 'rounded-full px-2.5 py-1 text-[12px] font-medium text-mute transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-50'

function CreationCard({ item, onRenamed, onDuplicated, onDeleted }: { item: CreationSummary; onRenamed: (title: string) => void; onDuplicated: () => void; onDeleted: () => void }) {
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const rename = async (e: FormEvent) => {
    e.preventDefault()
    const next = title.trim()
    if (!next || next === item.title) return setRenaming(false)
    setBusy(true)
    try {
      await updateCreation(item.id, { title: next })
      onRenamed(next)
      setRenaming(false)
    } catch {
      toast('Couldn’t rename it. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async () => {
    setBusy(true)
    try {
      const full = await getCreation(item.id)
      await saveNewCreation({ title: `${full.title} (copy)`.slice(0, 120), prompt: full.prompt, fromPhoto: full.fromPhoto, spec: full.spec, params: full.params, history: full.history, thumbnail: full.thumbnail })
      onDuplicated()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t duplicate it. Please try again.', { tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteCreation(item.id)
      logEvent('delete', item.title)
      onDeleted()
    } catch {
      toast('Couldn’t delete it. Please try again.', { tone: 'warn' })
      setBusy(false)
    }
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-panel transition-colors hover:border-line-2">
      <Link to={`/create/${item.id}`} className="relative block aspect-[4/3] bg-[var(--color-stage)]" aria-label={`Open ${item.title}`}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-dim">
            <Icon.build width={28} height={28} />
          </div>
        )}
        <span className="absolute bottom-2 left-2 rounded-full bg-panel/90 px-2 py-0.5 text-[11px] text-mute backdrop-blur">
          {item.parts} {item.parts === 1 ? 'part' : 'parts'}
          {item.fromPhoto ? ' · from a photo' : ''}
          {item.shareId ? ' · shared by link' : ''}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {renaming ? (
          <form onSubmit={rename} className="flex gap-1.5">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Model name" className={`${inputCls} py-1.5 text-[13px]`} />
            <button type="submit" disabled={busy} className={`${primaryBtn} px-3 py-1.5 text-[12px]`}>
              Save
            </button>
          </form>
        ) : (
          <Link to={`/create/${item.id}`} className="truncate text-[14px] font-semibold text-ink hover:underline">
            {item.title}
          </Link>
        )}
        {item.prompt ? <p className="line-clamp-2 text-[12.5px] leading-snug text-mute">“{item.prompt}”</p> : null}
        <p className="mt-auto pt-1 text-[11.5px] text-dim">Changed {when(item.updatedAt)}</p>
      </div>
      <div className="flex items-center gap-0.5 border-t border-line px-2 py-1.5">
        {confirmDelete ? (
          <>
            <span className="px-2 text-[12px] text-ink">Delete this model?</span>
            <button type="button" disabled={busy} onClick={() => void remove()} className={`${smallBtn} !text-danger`}>
              Delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className={smallBtn}>
              Keep
            </button>
          </>
        ) : (
          <>
            <Link to={`/create/${item.id}`} className={`${smallBtn} !text-ink`}>
              Open
            </Link>
            <button type="button" disabled={busy} onClick={() => setRenaming((r) => !r)} className={smallBtn}>
              Rename
            </button>
            <button type="button" disabled={busy} onClick={() => void duplicate()} className={smallBtn}>
              Duplicate
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className={`${smallBtn} ml-auto`}>
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  )
}

/** My models: everything a student has built in Create in 3D, to reopen and keep changing */
export default function CreationLabPage() {
  const status = useAuth((s) => s.status)
  const navigate = useNavigate()
  const [items, setItems] = useState<CreationSummary[] | null>(null)
  const [limit, setLimit] = useState(50)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    listCreations()
      .then((r) => {
        setItems(r.items)
        setLimit(r.limit)
        setError(null)
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t load your models.'))
  }, [])

  useEffect(() => {
    if (status === 'signed-in') load()
  }, [status, load])

  const update = (id: string, patch: Partial<CreationSummary>) => setItems((list) => list?.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)) ?? null)

  return (
    <StudyShell
      title="My models"
      lead="Everything you build in Create in 3D is saved here. Open one to keep changing it: sliders, materials, parts, or ask for a change."
      right={
        <Link to="/create/new" className={primaryBtn}>
          Build a new model
        </Link>
      }
    >
      {status === 'loading' ? (
        <ModelCardSkeleton />
      ) : status !== 'signed-in' ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-2 bg-panel px-6 py-16 text-center">
          <Icon.build width={30} height={30} className="text-dim" />
          <h2 className="text-[16px] font-semibold text-ink">Sign in to see your models</h2>
          <p className="max-w-md text-[13px] text-mute">Models you build are saved to your account, so you can come back to them on any device.</p>
          <button type="button" className={primaryBtn} onClick={() => useAuth.getState().openDialog()}>
            Sign in
          </button>
        </section>
      ) : error ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-panel px-6 py-12 text-center">
          <p className="text-[13.5px] text-ink">{error}</p>
          <button type="button" className={ghostBtn} onClick={load}>
            Try again
          </button>
        </section>
      ) : items === null ? (
        <ModelCardSkeleton />
      ) : items.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-2 bg-panel px-6 py-16 text-center">
          <Icon.build width={30} height={30} className="text-dim" />
          <h2 className="text-[16px] font-semibold text-ink">No models yet</h2>
          <p className="max-w-md text-[13px] text-mute">Describe a machine or upload a photo in Create in 3D. Every model you build is kept here.</p>
          <button type="button" className={primaryBtn} onClick={() => navigate('/create/new')}>
            Build your first model
          </button>
        </section>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] text-mute">
            {items.length} of {limit} saved
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <CreationCard
                key={item.id}
                item={item}
                onRenamed={(title) => update(item.id, { title })}
                onDuplicated={load}
                onDeleted={() => setItems((list) => list?.filter((i) => i.id !== item.id) ?? null)}
              />
            ))}
          </div>
        </>
      )}
    </StudyShell>
  )
}
