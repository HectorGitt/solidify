import * as THREE from 'three'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MODULES } from '@/modules/catalog'
import type { ModuleDef, SceneDef } from '@/modules/types'
import { useView } from '@/render/view'
import { AUDIENCE_SWITCH, useAcademic, useAudience } from './audience'
import { SUPPORT_EMAIL } from '@/cloud/config'
import { useReport } from '@/cloud/ui/ReportDialog'
import { useSales } from '@/cloud/ui/SalesDialog'
import { Icon } from './icons'
import { Loader, LoaderMark } from './Loader'
import { Stage, type StageFrame } from './Stage'
import { hasWebGL } from './webgl'
import { getCameraControls } from './camera'
import { partObjects, useParts } from '@/parts/registry'
import { SiteHeader } from '@/ui/SiteHeader'
import { SiteFooter } from './SiteFooter'
import { ALL_ORDER, MEDIA, Media, ModuleTile, READY } from './labsCatalog'
import { BuildYourOwn, RigOfTheDay } from './HomeSections'
import { applySceneView, useHomeStage } from './homeStage'


/**
 * The live hero scenes: picked to look their best and to load quickly (the first one downloads with
 * the page; the rest only when chosen). Gauge figures are each scene's own panel readouts at its
 * default settings; `fill` draws a bar only where the figure is a fraction of a limit.
 */
type HeroReadout = { label: string; value: string; unit: string; fill?: number }
const HERO_SCENES: { moduleId: string; sceneId: string; label: string; frame: StageFrame; focus?: RegExp; xray?: boolean; noExplode?: boolean; fromFront?: RegExp; pad?: number; readouts: HeroReadout[] }[] = [
  { moduleId: 'vibration', sceneId: 'seat', label: 'Seat suspension', focus: /^suspension$|suspension/i, xray: true, frame: { back: 1.6, shift: 0.55 }, readouts: [{ label: 'Operator vibration', value: '0.666', unit: 'm/s² RMS' }, { label: 'Seat transmissibility', value: '0.549', unit: 'floor to operator' }] },
  { moduleId: 'mechanisms', sceneId: 'four-bar', label: 'Four-bar linkage', focus: /^crank$/, noExplode: true, frame: { back: 1.45, shift: 0.35 }, readouts: [{ label: 'Rocker swing', value: '73.8', unit: '° (crank-rocker)' }, { label: 'Transmission angle', value: '18.2–65.4', unit: '°' }] },
  { moduleId: 'powertrain', sceneId: 'differential', label: 'Differential & diff lock', focus: /^cage$/, fromFront: /^pinion$/, pad: 0.45, frame: { back: 1.8, shift: 0.35 }, readouts: [{ label: 'Pinion', value: '600', unit: 'rpm' }, { label: 'Crown wheel', value: '140', unit: 'rpm' }] },
  { moduleId: 'engine', sceneId: 'cooling', label: 'Engine cooling', focus: /radiator|water pump/i, frame: { back: 1.4, shift: 0.45 }, readouts: [{ label: 'Heat to coolant', value: '36', unit: 'kW' }] },
]


const COPY = {
  professional: {
    eyebrow: 'Interactive 3D machinery simulator and engineering lab',
    title: 'Open up the machine.',
    lead: 'Cut through a running tractor, pull a specimen until it snaps, or bring a steam plant up to pressure. Set the conditions, watch the test run, and read the results as they come in.',
    primary: { label: 'Explore the tractor', to: '/m/powertrain/line-of-drive' },
    features: [
      { icon: 'cut', title: 'True cutaways', text: 'Slice any assembly at any angle. Cut faces are hatched by material like an engineering drawing; moving parts stay whole so you can watch them work.' },
      { icon: 'sliders', title: 'Live calculations', text: 'Every slider drives the physics: belt tensions, clutch capacity, hydrostatic flow, slip and tractive efficiency, with the working shown.' },
      { icon: 'target', title: 'Verified physics', text: 'Over a thousand automated checks pin the calculations to reference answers, and mechanisms follow exact kinematics.' },
      { icon: 'tour', title: 'Live lab tests', text: 'Move the controls freely, then start a test on any machine, material or thermal rig: gauges move, specimens break, and the readings log themselves.' },
    ],
  },
  academic: {
    eyebrow: '3D models, labs and worked answers for engineering and science students',
    title: 'Engineering, brought to life.',
    lead: 'Paste any question, from materials science to machine design, and see it in 3D with the working step by step. Run lab tests on engines, materials, mechanisms and thermal plant, then practise with fresh numbers and see the slip behind a wrong answer.',
    primary: { label: 'Solve a question', to: '/questions' },
    labs: { label: 'Open the labs', to: '/labs' },
    features: [
      { icon: 'cut', title: 'Interactive diagrams', text: 'Every textbook figure becomes a model you can turn, slice, explode and run in slow motion, down to 1/200 of real speed.' },
      { icon: 'book', title: 'Worked examples', text: 'Load exam-style data into any scene and follow the working: the formula, the numbers substituted, then the answer.' },
      { icon: 'target', title: 'Marked like an examiner', text: 'Method marks carry an early slip forward, and each wrong answer names the likely mistake.' },
      { icon: 'tour', title: 'A lab that runs itself', text: 'Explore the rig freely, then start the experiment and it logs a table of readings to work up. Each rig also has a guided tour with checkpoints.' },
    ],
  },
} as const

/** Rigs to jump to from the live test section. */
const LAB_LINKS = [
  { label: 'Tensile test', to: '/m/materials/tensile' },
  { label: 'Four-bar linkage', to: '/m/mechanisms/four-bar' },
  { label: 'Beam bending', to: '/m/materials/beam' },
  { label: 'Steam plant', to: '/m/thermal/steam-plant' },
  { label: 'Refrigeration', to: '/m/thermal/refrigeration' },
]

/** A real recording of the tensile rig: the feature is easier to show than to describe. */
function LiveTest() {
  // no autoplay for anyone who has asked for less motion; they still get the controls
  const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return (
    <section id="live-test" className="mx-auto grid max-w-[1360px] scroll-mt-20 items-center gap-8 px-5 pt-16 sm:px-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-4">
        <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">Set the conditions. Watch the test run.</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">Choose a material, start the test, and the machine pulls it until it breaks. The curve draws itself, the readings fill the table, and the properties are worked out from those readings, scatter and all.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {LAB_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="rounded-full border border-line-2 px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-accent/50">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-line bg-[var(--color-stage)] lg:col-span-8">
        <video className="block aspect-video w-full" src={`${MEDIA}/lab/tensile-test.mp4`} poster={`${MEDIA}/lab/tensile-test.webp`} autoPlay={!calm} controls={calm} muted loop playsInline preload="metadata" aria-label="A specimen pulled to failure in the tensile rig, with the stress-strain curve and table of readings building beside it" />
      </div>
    </section>
  )
}


function Gauge({ label, value, unit, fill }: HeroReadout) {
  return (
    <div className="rounded-2xl border border-line-2 bg-[var(--color-scrim)] px-4 py-3.5 backdrop-blur-xl">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-dim">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[26px] font-medium tracking-tight text-ink">{value}</span>
        {unit ? <span className="text-[12px] text-mute">{unit}</span> : null}
      </div>
      {fill !== undefined ? (
        <div className="mt-2.5 h-1 rounded-full bg-line-2">
          <div className="h-1 rounded-full bg-accent transition-[width] duration-700" style={{ width: `${Math.round(fill * 100)}%` }} />
        </div>
      ) : null}
    </div>
  )
}

/** Full-bleed hero: a live scene behind the headline, with a scene dock and gauges floating over it. */
function Hero({ copy }: { copy: (typeof COPY)[keyof typeof COPY] }) {
  const [heroIdx, setHeroIdx] = useState(0)
  // falls back to the still render if a scene fails to load
  const [live3D, setLive3D] = useState(hasWebGL)
  const [scene, setScene] = useState<SceneDef | null>(null)
  const cutEnabled = useView((s) => s.cut.enabled)
  const explode = useView((s) => s.explode)
  const hero = HERO_SCENES[heroIdx]
  const shownFrame = HERO_SCENES.find((h) => h.sceneId === scene?.id)?.frame
  const switching = !!scene && scene.id !== hero.sceneId

  useEffect(() => {
    if (!live3D) return
    let alive = true
    const mod = MODULES.find((m) => m.id === hero.moduleId)
    const entry = mod?.scenes.find((s) => s.id === hero.sceneId)
    if (!entry?.load) return
    entry
      .load()
      .then(async ({ default: def }) => {
        await def.prepare?.()
        return def
      })
      .then((def) => {
        if (!alive) return
        applySceneView(def)
        setScene(def)
      })
      .catch(() => {
        if (alive) setLive3D(false)
      })
    return () => {
      alive = false
    }
  }, [heroIdx, live3D, hero.moduleId, hero.sceneId])

  // the rig of the day borrows the live view while it is on screen; back here, the hero's scene is set up again
  const owner = useHomeStage((s) => s.owner)

  /*
   * The show reel: until someone takes hold of the model, each system shows itself off in turn: the camera
   * circles it, it is cut open, comes apart and goes back together, then the next system. A press on the
   * model (mouse or pen; a finger only scrolls the page here) or on any chip stops it for good. Not run for
   * people who ask for less motion.
   */
  const [reel, setReel] = useState(() => hasWebGL() && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const stopReel = () => setReel(false)
  useEffect(() => {
    if (!reel || !scene || owner !== 'hero' || switching) return
    const view = () => useView.getState()
    const hero = HERO_SCENES.find((h) => h.sceneId === scene.id)
    const want = hero?.focus
    // the steps run one after another, each waiting for the last (a big machine's parts can take seconds to
    // appear); stopping the reel cancels whatever step is waiting
    let cancelled = false
    const pending: number[] = []
    const wait = (ms: number) => new Promise<void>((res) => pending.push(window.setTimeout(res, ms)))
    let orbit = 0
    // the sideways shift that clears the headline is a fixed distance: scaled with the zoom, or a close-up part
    // ends far off-centre (a tyre fills the view instead); restored on the way back out
    let back: { p: number[]; t: number[]; offset: THREE.Vector3 } | null = null

    /** the part to zoom in on, once it is there (up to 8 s) */
    const findPart = async () => {
      for (let i = 0; i < 27 && !cancelled; i++) {
        const parts = Object.values(useParts.getState().parts)
        const hit = want ? (parts.find((x) => want.test(x.id)) ?? parts.find((x) => want.test(x.name))) : undefined
        const obj = hit ? partObjects.get(hit.id) : undefined
        if (hit && obj && getCameraControls()) return { hit, obj }
        await wait(300)
      }
      return null
    }
    /** where the view is now, to come back to */
    const here = () => {
      const c = getCameraControls()!
      const p = new THREE.Vector3()
      const t = new THREE.Vector3()
      c.getPosition(p)
      c.getTarget(t)
      return { p: p.toArray(), t: t.toArray(), offset: c.getFocalOffset(new THREE.Vector3()) }
    }
    /**
     * Close in on a part along a chosen direction (by default the one the camera already looks along). Not the
     * library's fitToBox: that snaps the view to the nearest straight side or front first, which put the
     * differential side-on with a wheel filling the view.
     */
    const zoomIn = (hit: { id: string }, obj: THREE.Object3D, from = here(), dir?: THREE.Vector3) => {
      const c = getCameraControls()!
      const p = new THREE.Vector3(...from.p)
      const t = new THREE.Vector3(...from.t)
      const offset = from.offset
      back = from
      const box = new THREE.Box3().setFromObject(obj)
      const centre = box.getCenter(new THREE.Vector3())
      const radius = box.getSize(new THREE.Vector3()).length() / 2
      const fov = ((c.camera as THREE.PerspectiveCamera).fov ?? 40) * (Math.PI / 180)
      const distance = (radius / Math.sin(fov / 2)) * (1 + (hero?.pad ?? 0.15))
      const look = (dir ?? p.clone().sub(t)).normalize()
      const eye = centre.clone().addScaledVector(look, distance)
      // the sideways shift scaled with the distance, so the part stays in the clear right of the headline
      const k = Math.min(1, distance / Math.max(1e-6, p.distanceTo(t)))
      void c.setFocalOffset(offset.x * k, offset.y * k, offset.z * k, true)
      view().select(hit.id)
      void c.setLookAt(eye.x, eye.y, eye.z, centre.x, centre.y, centre.z, true)
    }
    const zoomOut = () => {
      const c = getCameraControls()
      if (!c || !back) return
      view().select(null)
      void c.setLookAt(back.p[0], back.p[1], back.p[2], back.t[0], back.t[1], back.t[2], true)
      void c.setFocalOffset(back.offset.x, back.offset.y, back.offset.z, true)
      back = null
    }

    const run = async () => {
      // a second of the whole machine once it is all there (the tractor takes a few seconds to arrive), then look
      // inside it: through the bodywork for a part within it (the seat's suspension), else cut open
      const found = await findPart()
      if (cancelled) return
      await wait(1000)
      if (cancelled) return
      if (hero?.xray) view().setXray(true)
      else view().setCut({ enabled: true })
      await wait(hero?.xray ? 1200 : 900)
      if (cancelled) return
      // zoom in on the part that shows how this machine works, and go round it
      if (found) {
        // the differential: in from the front, along the drive, so its wheels stay out to the sides
        const start = here()
        // "the front" is where the drive comes in (the bevel pinion): look in along it, from above, into the cut
        let dir: THREE.Vector3 | undefined
        const front = hero?.fromFront ? Object.values(useParts.getState().parts).find((x) => hero.fromFront!.test(x.id)) : undefined
        const frontObj = front ? partObjects.get(front.id) : undefined
        if (frontObj) {
          const a = new THREE.Box3().setFromObject(frontObj).getCenter(new THREE.Vector3())
          const b = new THREE.Box3().setFromObject(found.obj).getCenter(new THREE.Vector3())
          const flat = new THREE.Vector3(a.x - b.x, 0, a.z - b.z).normalize()
          dir = flat.multiplyScalar(Math.cos(0.9)).add(new THREE.Vector3(0, Math.sin(0.9), 0))
        }
        zoomIn(found.hit, found.obj, start, dir)
        await wait(1200)
        orbit = 1
        await wait(3600)
        orbit = 0
        if (cancelled) return
        if (hero?.xray) {
          view().setXray(false)
          await wait(1000)
        }
        if (cancelled) return
        zoomOut()
        await wait(1500)
      }
      if (cancelled) return
      // take it apart and put it back (a flat linkage has nothing to take apart: it keeps running instead)
      if (!hero?.noExplode) {
        view().setExplode(0.75)
        await wait(2500)
        view().setExplode(0)
        await wait(1800)
      }
      if (cancelled) return
      view().setCut({ enabled: false })
      await wait(1700)
      if (!cancelled) setHeroIdx((i) => (i + 1) % HERO_SCENES.length)
    }
    void run()

    // the camera sways gently either side of the scene's own view (about 18°), so flat rigs never turn edge-on;
    // while zoomed in on a part it goes round it instead
    let raf = 0
    let last = performance.now()
    let phase = 0
    let applied = 0
    let orbitPhase = 0
    let orbitApplied = 0
    const spin = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const c = getCameraControls()
      if (orbit && hero?.fromFront) {
        orbitPhase += dt
        const want = 0.35 * Math.sin(orbitPhase * 1.2)
        void c?.rotate(want - orbitApplied, 0, false)
        orbitApplied = want
      } else if (orbit) {
        void c?.rotate(dt * 0.6, 0, false)
      } else {
        phase += dt
        const want = 0.32 * Math.sin(phase * ((2 * Math.PI) / 15))
        void c?.rotate(want - applied, 0, false)
        applied = want
      }
      raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)
    return () => {
      cancelled = true
      pending.forEach(clearTimeout)
      if (hero?.xray) view().setXray(false)
      cancelAnimationFrame(raf)
    }
  }, [reel, scene, owner, switching])
  useEffect(() => {
    if (owner === 'hero' && scene) applySceneView(scene)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner])

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${on ? 'bg-ink text-bg' : 'text-mute hover:bg-ink/[0.06] hover:text-ink'}`

  return (
    <section className="relative overflow-hidden bg-panel-3 lg:flex lg:min-h-[max(min(92vh,860px),640px)] lg:flex-col lg:justify-end">
      {/* touch screens: the hero is look-only so a swipe always scrolls the page (camera controls
          otherwise capture the touch); "Open scene" is the way in. Mouse users can still drag it. */}
      <div className="absolute inset-0 [&_canvas]:!touch-pan-y pointer-coarse:[&_*]:!pointer-events-none" onPointerDownCapture={(e) => e.pointerType !== 'touch' && stopReel()}>
        {/* the current scene stays up while the next one's code loads; then the new scene builds
            under a frosted veil, so switching never blanks the hero */}
        {live3D && scene && owner === 'hero' ? (
          <Stage key={scene.id} scene={scene} pageScroll frame={shownFrame} veil />
        ) : live3D && scene ? (
          <div className="h-full bg-[var(--color-stage)]" />
        ) : live3D ? (
          <Loader size={52} className="h-full bg-[var(--color-stage)] lg:pl-[40%]" />
        ) : (
          // no live 3D (this browser can't, or the scene failed): the scene's picture
          <Media name={`scenes/${hero.moduleId}--${hero.sceneId}`} alt="A Solidify lab rig, in 3D" className="h-full w-full object-cover lg:pl-[30%]" />
        )}
      </div>
      {/* scrims keep the headline readable in either theme; they never take pointer events, so the scene stays draggable */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{ background: 'linear-gradient(0deg, var(--color-bg) 0%, var(--color-bg) 42%, transparent 62%), linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 70%, transparent) 0%, transparent 14%)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            'linear-gradient(90deg, var(--color-bg) 0%, color-mix(in srgb, var(--color-bg) 70%, transparent) 34%, transparent 62%), linear-gradient(0deg, var(--color-bg) 0%, transparent 26%), linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 70%, transparent) 0%, transparent 18%)',
        }}
        aria-hidden
      />

      <div className="pointer-events-none absolute right-5 top-24 hidden w-[230px] flex-col gap-2.5 lg:flex">
        {hero.readouts.map((r) => (
          <Gauge key={r.label} {...r} />
        ))}
      </div>

      {/* phones: the text sits below the scene (which fills the top half); large screens: over its left side, kept clear of the header, and the hero grows if the text needs more room */}
      <div className="pointer-events-none relative pt-[54vh] lg:pt-28">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-end justify-between gap-6 px-5 pb-10 sm:px-10 sm:pb-14 lg:gap-8">
          <div className="max-w-[640px]">
            {/* the keyword line is part of the h1, so search engines read the keywords before the title */}
            <h1>
              <span className="block text-[13.5px] font-medium tracking-normal text-accent">{copy.eyebrow}</span>
              <span className="mt-4 block text-[48px] font-semibold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[84px]">{copy.title}</span>
            </h1>
            <p className="mt-5 max-w-[540px] text-[15px] leading-relaxed text-mute sm:mt-6 sm:text-[17.5px]">{copy.lead}</p>
            <div className="pointer-events-auto mt-7 flex flex-wrap gap-3 sm:mt-9">
              <Link to={copy.primary.to} className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-[15px] font-semibold text-accent-ink transition-transform hover:brightness-105 active:scale-[0.98]">
                {copy.primary.label} <Icon.chevron width={16} height={16} />
              </Link>
              {'labs' in copy ? (
                <Link to={copy.labs.to} className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-[var(--color-scrim)] px-6 py-4 text-[15px] font-medium text-ink backdrop-blur-xl transition-colors hover:border-accent/50">
                  {copy.labs.label}
                </Link>
              ) : null}
              <Link to="/promo" className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-[var(--color-scrim)] px-6 py-4 text-[15px] font-medium text-ink backdrop-blur-xl transition-colors hover:border-accent/50">
                <Icon.tour width={16} height={16} /> Watch the tour
              </Link>
            </div>
          </div>

          <div className="pointer-events-auto flex max-w-full flex-col items-start gap-2 sm:items-end">
            <div className="flex max-w-[calc(100vw-2.5rem)] items-center gap-1 overflow-x-auto rounded-full border border-line-2 bg-[var(--color-scrim)] p-1 backdrop-blur-xl [scrollbar-width:none] sm:flex-wrap" role="group" aria-label="Hero scene">
              {HERO_SCENES.map((h, i) => (
                <button
                  key={`${h.moduleId}/${h.sceneId}`}
                  onClick={() => {
                    stopReel()
                    setHeroIdx(i)
                    setLive3D(hasWebGL())
                  }}
                  aria-pressed={i === heroIdx}
                  className={`${chip(i === heroIdx)} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap`}
                >
                  {i === heroIdx && switching ? <LoaderMark size={12} /> : null}
                  {h.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1 rounded-full border border-line-2 bg-[var(--color-scrim)] p-1 backdrop-blur-xl">
              {live3D && scene ? (
                <>
                  <button onClick={() => (stopReel(), useView.getState().setCut({ enabled: !cutEnabled }))} aria-pressed={cutEnabled} className={chip(cutEnabled)}>
                    Cutaway
                  </button>
                  <button onClick={() => (stopReel(), useView.getState().setExplode(explode > 0.1 ? 0 : 0.75))} aria-pressed={explode > 0.1} className={chip(explode > 0.1)}>
                    Explode
                  </button>
                </>
              ) : null}
              <Link to={`/m/${hero.moduleId}/${hero.sceneId}`} className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-accent hover:bg-accent/10">
                Open scene →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


function FeatureIcon({ name }: { name: string }) {
  const I = Icon[name as keyof typeof Icon] ?? Icon.target
  return (
    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/12 text-accent">
      <I width={20} height={20} />
    </span>
  )
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-3xl border border-line bg-panel p-7">
      <div className="font-mono text-[40px] font-medium tracking-tight text-accent">{value}</div>
      <div className="mt-1 text-[14px] text-mute">{label}</div>
    </div>
  )
}

/** who Solidify is for, and where each starts: set by the account (a teacher's account also gets Classes), not a switch */
function Roles() {
  const roles = [
    {
      who: 'For students',
      title: 'Learn it by seeing it work',
      points: [
        'Paste a question, or a screenshot of one, and see it built in 3D with the working step by step',
        'Upload your notes: their figures become models you can turn, cut open and test',
        'Practise exam-style problems with fresh numbers, method marks and spaced review',
      ],
      links: [
        { label: 'Solve a question', to: '/questions', primary: true },
        { label: 'Read notes in 3D', to: '/read' },
        { label: 'Exam practice', to: '/exam' },
      ],
    },
    {
      who: 'For teachers',
      title: 'Teach with models that run',
      points: [
        'Show any machine, structure or material in 3D in class, cut open and moving',
        'Set papers with numbers that differ for each student, marked with method marks',
        'See each student’s progress and a weak-spot report for the class',
      ],
      links: [
        { label: 'Set up a class', to: '/classes', primary: true },
        { label: 'Open the labs', to: '/labs' },
      ],
    },
  ]
  return (
    <section id="roles" className="mx-auto max-w-[1360px] scroll-mt-20 px-5 pt-20 sm:px-10">
      <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">For students and teachers</h2>
      <p className="mt-1.5 max-w-2xl text-[15px] text-mute">Engineering and science, from materials and mechanics to machines and thermal plant.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <div key={r.who} className="flex flex-col rounded-3xl border border-line bg-panel p-7">
            <p className="text-[13px] font-medium text-accent">{r.who}</p>
            <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">{r.title}</h3>
            <ul className="mt-5 space-y-3">
              {r.points.map((p) => (
                <li key={p} className="flex gap-3 text-[14px] leading-relaxed text-mute">
                  <Icon.check width={16} height={16} className="mt-[3px] shrink-0 text-accent" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-2">
              {r.links.map((l) => (
                <Link key={l.to} to={l.to} className={`rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-colors ${l.primary ? 'bg-accent text-accent-ink hover:brightness-110' : 'border border-line-2 text-ink hover:border-accent/50'}`}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AudienceCard({ who, title, points, active, onChoose }: { who: string; title: string; points: string[]; active: boolean; onChoose: () => void }) {
  return (
    <div className={`flex flex-col rounded-3xl border p-7 transition-colors ${active ? 'border-accent/50 bg-accent/[0.05]' : 'border-line bg-panel hover:border-line-2'}`}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-accent">{who}</p>
        {active ? <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">Current mode</span> : null}
      </div>
      <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      <ul className="mt-5 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-[14px] leading-relaxed text-mute">
            <Icon.check width={16} height={16} className="mt-[3px] shrink-0 text-accent" />
            {p}
          </li>
        ))}
      </ul>
      <button
        onClick={onChoose}
        className={`mt-7 self-start rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-colors ${active ? 'bg-accent text-accent-ink' : 'border border-line-2 text-ink hover:border-accent/50'}`}
      >
        {active ? 'Current view' : `Switch to ${who.toLowerCase()}`}
      </button>
    </div>
  )
}

const HOME_TITLE = 'Solidify — Engineering in 3D: models, labs and worked answers'

/** Two ways to reach us: ask for a feature, or talk to us about a school or company plan. */
function Contact() {
  const openReport = useReport((s) => s.open)
  const openSales = useSales((s) => s.show)
  return (
    <section id="contact" className="mx-auto grid max-w-[1360px] scroll-mt-20 gap-4 px-5 pt-20 sm:px-10 md:grid-cols-2">
      <div className="flex flex-col rounded-3xl border border-line bg-panel p-7">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Missing something?</h2>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-mute">A machine, a calculation, an exam topic or a feature for your class. Requests decide what we build next.</p>
        <button onClick={() => openReport({ mode: 'feature' })} className="mt-6 self-start rounded-full border border-line-2 px-5 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-accent/50">
          Request a feature
        </button>
      </div>
      <div className="flex flex-col rounded-3xl border border-line bg-panel p-7">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">For schools &amp; companies</h2>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-mute">Licences for a department or a team, classes and papers for your students, and Create in 3D for your engineers.</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button onClick={openSales} className="rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink transition-opacity hover:opacity-90">
            Talk to us
          </button>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[13px] text-mute hover:text-ink">
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  )
}

export function Landing() {
  useEffect(() => {
    document.title = HOME_TITLE
  }, [])
  const academic = useAcademic()
  const setAudience = useAudience((s) => s.setAudience)
  const copy = academic ? COPY.academic : COPY.professional
  const total = READY.reduce((n, m) => n + m.scenes.length, 0)
  const [scrolled, setScrolled] = useState(false)

  // the home page shows a few; the Labs page has them all
  const teaser = ALL_ORDER.map((id) => READY.find((m) => m.id === id)).filter((m): m is ModuleDef => !!m).slice(0, 8)

  return (
    <div className="h-full overflow-y-auto bg-bg text-ink selection:bg-accent/25" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 24)}>
      <SiteHeader floating scrolled={scrolled} width="max-w-[1360px]" />

      <Hero copy={copy} />

      <LiveTest />

      <section id="systems" className="mx-auto max-w-[1360px] scroll-mt-20 px-5 pt-16 sm:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">Every system and rig, in 3D</h2>
            <p className="mt-1.5 text-[15px] text-mute">From the combustion chamber to the test bench, each one opens straight into something working.</p>
          </div>
          <Link to="/labs" className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-panel px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent">
            See all {READY.length} systems and {total} rigs <Icon.chevron width={14} height={14} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {teaser.map((m, i) => (
            <ModuleTile key={m.id} m={m} academic={academic} big={i < 2} />
          ))}
        </div>
      </section>

      <RigOfTheDay />

      <BuildYourOwn />

      <section className="mx-auto grid max-w-[1360px] gap-4 px-5 pt-20 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
        <Stat value={total} label="interactive 3D scenes" />
        <Stat value={READY.length} label="systems and labs" />
        <Stat value="1,000+" label="verified calculations" />
        <Stat value="0 MB" label="to install: it runs in the browser" />
      </section>

      <section className="mx-auto max-w-[1360px] px-5 pt-20 sm:px-10">
        <h2 className="max-w-[620px] text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">Built for engineering depth</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.features.map((f) => (
            <div key={f.title} className="rounded-3xl border border-line bg-panel p-7">
              <FeatureIcon name={f.icon} />
              <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-mute">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <Roles />

      {AUDIENCE_SWITCH ? (
      <section id="audiences" className="mx-auto max-w-[1360px] scroll-mt-20 px-5 pt-20 sm:px-10">
        <h2 className="text-[30px] font-semibold tracking-[-0.03em] sm:text-[38px]">The workshop and the lecture hall</h2>
        <p className="mt-1.5 max-w-2xl text-[15px] text-mute">The same models, two ways of working. Switch any time from the top bar.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <AudienceCard
            who="Professional"
            title="Engineers, technicians and operators"
            active={!academic}
            onChoose={() => setAudience('professional')}
            points={[
              'A clean engineering view: mechanisms, sections and sizing calculations',
              'Size drives, pumps and hitches, or test beams, shafts and exchangers, with live formulas',
              'Show clients and teams how it works with exploded and X-ray views',
            ]}
          />
          <AudienceCard
            who="Academic"
            title="Students and lecturers"
            active={academic}
            onChoose={() => setAudience('academic')}
            points={[
              'Lab tests that log readings to work up, and exam-style questions with fresh numbers',
              'Method marks, spaced review and topic mastery that follow you between devices',
              'Classes and papers with per-student numbers and a weak-spot report',
            ]}
          />
        </div>
      </section>
      ) : null}

      <Contact />

      <section className="mx-auto max-w-[1360px] px-5 py-20 sm:px-10">
        <div className="relative overflow-hidden rounded-[32px] border border-line bg-[var(--color-stage)]">
          <Media name="modules/implements" alt="Tractor and implement in 3D" className="absolute inset-0 h-full w-full object-cover object-right" />
          <div className="relative bg-gradient-to-r from-[var(--color-stage)] via-[color-mix(in_srgb,var(--color-stage)_85%,transparent)] to-transparent p-8 sm:p-14">
            <h2 className="max-w-xl text-[32px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[44px]">Open a machine. Run a test. See how it works.</h2>
            <p className="mt-3 max-w-xl text-[15.5px] text-mute">No sign-up, nothing to download. Pick any system or rig and start.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={copy.primary.to} className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 text-[15px] font-semibold text-accent-ink">
                {copy.primary.label} <Icon.chevron width={16} height={16} />
              </Link>
              <Link to="/m/implements/mouldboard" className="rounded-full border border-line-2 bg-[var(--color-scrim)] px-6 py-4 text-[15px] font-medium text-ink backdrop-blur-xl hover:border-accent/50">
                Watch a plough at work
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
