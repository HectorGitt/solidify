import type { CSSProperties } from 'react'
import { SiteHeader } from './SiteHeader'

/**
 * Placeholders shaped like what is about to appear, with a soft shimmer, so a page keeps its layout while
 * it loads instead of showing a spinner on an empty screen. The shimmer stops under reduced motion.
 */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton rounded-xl ${className}`} style={style} aria-hidden />
}

/** a few lines of text, the last one shorter */
export function SkeletonLines({ lines = 2, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-3/5' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** rows of a list (classes, students, results) */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-3.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** a grid of cards with a heading and a few lines each (challenges, panels) */
export function CardGridSkeleton({ cards = 4, cols = 'sm:grid-cols-2' }: { cards?: number; cols?: string }) {
  return (
    <div role="status" aria-label="Loading" className={`grid gap-3 ${cols}`}>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="space-y-3 rounded-3xl border border-line bg-panel p-4">
          <Skeleton className="h-4 w-1/2" />
          <SkeletonLines lines={3} />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** saved-model cards: a picture, a name and a line */
export function ModelCardSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading your models" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-line bg-panel">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-3.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** a study page while its code loads: the real header, then the page's outline */
export function PageSkeleton() {
  return (
    <div className="h-full overflow-hidden bg-bg" role="status" aria-label="Loading">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-2xl space-y-3">
            <Skeleton className="h-9 w-64 sm:h-11" />
            <SkeletonLines lines={2} />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
        <Skeleton className="mb-5 h-14 w-full rounded-3xl" />
        <CardGridSkeleton cards={4} cols="sm:grid-cols-2 lg:grid-cols-3" />
      </div>
    </div>
  )
}

/** the model workspace while it loads: conversation, model and engineering panels */
export function WorkspaceSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-bg" role="status" aria-label="Opening your model">
      {withHeader ? <SiteHeader width="max-w-none" /> : null}
      {withHeader ? (
        <div className="flex items-center gap-3 border-b border-line px-6 py-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-56" />
          <Skeleton className="ml-auto h-8 w-28 rounded-full" />
        </div>
      ) : null}
      <WorkspaceBodySkeleton />
    </div>
  )
}

export function WorkspaceBodySkeleton() {
  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
      <div className="hidden space-y-4 border-r border-line p-4 lg:block" aria-hidden>
        <Skeleton className="ml-6 h-10 rounded-2xl" />
        <div className="mr-6 space-y-2 rounded-2xl border border-line p-3.5">
          <SkeletonLines lines={4} />
        </div>
        <Skeleton className="ml-10 h-9 rounded-2xl" />
        <div className="mr-6 space-y-2 rounded-2xl border border-line p-3.5">
          <SkeletonLines lines={2} />
        </div>
      </div>
      <div className="flex min-h-[380px] flex-col" aria-hidden>
        <div className="flex gap-2 border-b border-line px-3 py-2">
          {[52, 64, 44, 48, 56].map((w, i) => (
            <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="relative flex flex-1 items-center justify-center bg-stage">
          <div className="bp-grid pointer-events-none absolute inset-0 opacity-50" />
          <Skeleton className="h-40 w-56 rounded-3xl opacity-70" />
        </div>
      </div>
      <div className="hidden space-y-3 border-l border-line p-4 lg:block" aria-hidden>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 flex-1 rounded-full" />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-line p-3">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
