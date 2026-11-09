import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AudienceSwitch } from './AudienceSwitch'
import { AUDIENCE_SWITCH } from './audience'
import { Icon } from './icons'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

/** The tour: the promo film (made by scripts/promo from the real scenes and screens). */
const SRC = 'media/tour/solidify-tour.mp4'
const POSTER = 'media/tour/poster.jpg'

export default function PromoPage() {
  const video = useRef<HTMLVideoElement>(null)
  // browsers only autoplay muted; the button turns the score on (and starts it over the first time)
  const [muted, setMuted] = useState(true)
  const [heard, setHeard] = useState(false)
  const soundOn = () => {
    const v = video.current
    if (!v) return
    v.muted = false
    if (!heard) v.currentTime = 0
    void v.play()
    setMuted(false)
    setHeard(true)
  }

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-5">
          <Link to="/" aria-label="Solidify home">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {AUDIENCE_SWITCH ? <AudienceSwitch /> : null}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
        <Link to="/" className="mb-5 inline-flex items-center gap-1 text-[13px] text-mute hover:text-ink">
          <Icon.back width={16} height={16} /> Home
        </Link>
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">The Solidify tour</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-mute">
          One session on one tractor: cut through it, see through it, take it apart and open it up. Change the settings, ask about any part, practise with worked solutions, then build the engine yourself.
        </p>

        <div className="relative mt-7 overflow-hidden rounded-3xl border border-line bg-panel-2 shadow-2xl shadow-black/20">
          <video
            ref={video}
            src={SRC}
            poster={POSTER}
            className="block aspect-video w-full bg-black"
            autoPlay
            muted={muted}
            loop={!heard}
            playsInline
            controls={heard}
            preload="metadata"
            onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          />
          {muted ? (
            <button
              onClick={soundOn}
              className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-line-2 bg-panel/90 px-4 py-2 text-[13px] font-medium text-ink shadow-lg backdrop-blur transition-colors hover:border-accent/60"
            >
              <Icon.play width={14} height={14} /> {heard ? 'Sound on' : 'Play with sound'}
            </button>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/m/powertrain/line-of-drive" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[14.5px] font-semibold text-accent-ink transition-transform hover:brightness-105 active:scale-[0.98]">
            Explore the tractor <Icon.chevron width={16} height={16} />
          </Link>
          <Link to="/m/engine/four-stroke-diesel" className="inline-flex items-center gap-2 rounded-full border border-line-2 px-6 py-3.5 text-[14.5px] font-medium text-ink transition-colors hover:border-accent/50">
            Build the diesel engine
          </Link>
        </div>
      </main>
    </div>
  )
}
