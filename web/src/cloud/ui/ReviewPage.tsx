import { StudyShell } from '@/study/ui/StudyShell'
import { ListSkeleton } from '@/ui/Skeleton'
import { useAuth } from '../auth'
import { useProfile } from '../profile'
import { ReviewQueue } from './AdminPage'
import { primaryBtn } from './Modal'

/**
 * For reviewers: the drafts waiting to be checked. Each one is opened in the full workspace (calculations,
 * graphs, parts), fixed or rebuilt if needed, ticked off and published to the library, or rejected with a reason.
 */
export default function ReviewPage() {
  const status = useAuth((s) => s.status)
  const profile = useProfile((s) => s.profile)
  const allowed = !!profile && (profile.isReviewer || profile.isAdmin)
  return (
    <StudyShell
      title="Review queue"
      lead="Models drafted by Solidify, waiting to be checked. Open each one in 3D, check its calculations, graphs and parts, fix what’s wrong, then tick it off and publish it to the library."
    >
      <div className="pb-16">
        {status === 'loading' || (status === 'signed-in' && !profile) ? (
          <ListSkeleton rows={4} />
        ) : status !== 'signed-in' ? (
          <section className="rounded-2xl border border-dashed border-line-2 bg-panel px-6 py-12 text-center">
            <button type="button" className={primaryBtn} onClick={() => useAuth.getState().openDialog()}>
              Sign in
            </button>
          </section>
        ) : !allowed ? (
          <section className="rounded-2xl border border-dashed border-line-2 bg-panel px-6 py-12 text-center text-[13.5px] text-mute">This page is for Solidify’s reviewers.</section>
        ) : (
          <ReviewQueue canDraft={!!profile?.isAdmin} backTo="/review" />
        )}
      </div>
    </StudyShell>
  )
}
