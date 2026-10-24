import { SRC } from '@/content/citations'
import { Badge, Section, Toggle } from '@/ui/controls'
import { Note, Points } from '../common/bits'
import { HISTORY, TYPES, TYPE_BY_ID, useTypes } from './model'

export function TypesPanel() {
  const st = useTypes()
  const t = TYPE_BY_ID[st.type]
  return (
    <div>
      <Section title="Tractor type">
        <div className="grid grid-cols-3 gap-1.5">
          {TYPES.map((x, i) => (
            <button
              key={x.id}
              onClick={() => st.set({ type: x.id })}
              className={`rounded-md border px-1.5 py-1.5 text-left text-[11.5px] leading-tight ${st.type === x.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
            >
              <span className="mr-1 font-mono text-[10px] text-mute">{i + 1}</span>
              {x.short}
            </button>
          ))}
        </div>
        <Toggle label="Turntable" checked={st.spin} onChange={(spin) => st.set({ spin })} />
      </Section>
      <Section title={t.name} right={t.power ? <Badge tone="info">{t.power}</Badge> : undefined}>
        <Points items={t.features} />
        <Note>
          {st.type === 'standard'
            ? 'Shown with the shared Farmland tractor.'
            : 'The 3D model uses typical proportions for this type; its dimensions are indicative.'}
        </Note>
      </Section>
      <Section title="The twelve types">
        <ol className="list-decimal space-y-0.5 pl-5 text-[11.5px] text-ink/85">
          {TYPES.map((x) => (
            <li key={x.id} className={x.id === st.type ? 'text-accent' : undefined}>
              {x.name}
              {x.power ? <span className="text-mute"> · {x.power}</span> : null}
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Evolution">
        <ol className="space-y-1 text-[11.5px] leading-snug">
          {HISTORY.map((h) => (
            <li key={h.year} className="flex gap-2">
              <span className="w-14 shrink-0 font-mono text-accent">{h.year}</span>
              <span className="text-ink/85">
                {h.text}
                {h.beyond ? (
                  <>
                    {' '}
                    <Badge tone="info" title="Date from standard tractor histories">
                      indicative
                    </Badge>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Exam points">
        <Points
          items={[
            'A tractor is a mobile power source: it pulls through the drawbar, drives machines through the PTO and lifts or controls implements through the hydraulic three-point linkage.',
            'Attachment modes: towed (single point), mounted (three-point), semi-mounted and frame-mounted; power out by PTO or hydraulic hoses.',
            'Modern features: power steering, epicyclic front hubs, wet disc brakes, power-shift transmission, ROPS cab.',
            'Early tractors were made heavy for traction (the 36 t California giant); tests at Winnipeg and the 1919 Nebraska law made performance claims comparable.',
          ]}
        />
      </Section>
    </div>
  )
}

export const TYPES_CITES = [SRC.vers502('types and evolution'), SRC.tests502('p2 history of testing')]
