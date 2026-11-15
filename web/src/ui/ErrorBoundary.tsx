import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportCrash } from '@/cloud/crashes'
import { useXRSession } from '@/xr/session'
import { announceUpdate, isUpdateError } from './appUpdate'

/**
 * Keeps one broken piece (a model that won't draw, a graph that won't plot) from blanking the whole page:
 * it shows what went wrong in its place, with a retry. A new `resetKey` (another model, another change)
 * clears it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; label: string; resetKey?: unknown; compact?: boolean }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // a page file from before the latest deploy: the update notice says so and reloads
    if (isUpdateError(error)) {
      announceUpdate()
      return
    }
    console.error(`[${this.props.label}]`, error, info.componentStack)
    // the team hears about it (Admin → Activity → Crashes), without names
    reportCrash(this.props.label, error, { headset: useXRSession.getState().active })
  }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (isUpdateError(error))
      return (
        <div role="alert" className="flex h-full min-h-60 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-[15px] font-semibold text-ink">Solidify has been updated</p>
          <p className="max-w-sm text-[13px] text-mute">This page is from the version before. The notice below reloads it into the new one; nothing you saved is lost.</p>
        </div>
      )
    return (
      <div role="alert" className={`flex h-full flex-col items-center justify-center gap-2 p-6 text-center ${this.props.compact ? '' : 'min-h-40'}`}>
        <p className="text-[13.5px] font-medium text-ink">The {this.props.label} couldn’t be shown.</p>
        <p className="max-w-md break-words font-mono text-[11.5px] text-mute">{error.message || String(error)}</p>
        <button type="button" onClick={() => this.setState({ error: null })} className="mt-1 rounded-full border border-line-2 px-3 py-1 text-[12px] font-medium text-ink/90 hover:border-ink/40">
          Try again
        </button>
      </div>
    )
  }
}
