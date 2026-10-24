import { useMemo, useState } from 'react'
import { IS_SIEVES, type Law } from '@/physics/processing'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { CITES } from './cites'
import {
  analyseEnergy,
  analyseSieves,
  DEFAULTS,
  useSizeReduction,
  type MachineKind,
  type SizeReductionParams,
} from './model'

const set = (p: Partial<SizeReductionParams>) => useSizeReduction.getState().set(p)
const base = (p: Partial<SizeReductionParams>) => set({ ...DEFAULTS, ...p })

export const EXAM_PRESETS: Preset[] = [
  {
    id: 'pq1-q3c-setting1',
    label: '2015 Q3c · Setting 1 (burr mill)',
    note: 'Sorghum 4.3 mm in a burr mill, 250 g sample on sieves 70/50/40/30/20/15/pan: FM = 2.93, average size D = 0.337 mm, UI = 1:5:4. Measured motor power 6.5 kW.',
    apply: () =>
      base({
        machine: 'burr',
        feedName: 'Sorghum grain',
        L1: 4.3,
        L2: 0.337,
        burrGapMm: 0.8,
        burrRpm: 500,
        motorPowerKw: 6.5,
        feedRateKgH: 450,
        sieveRetainedG: [0, 6.8, 16.5, 40.1, 86.2, 91.0, 7.3, 2.1],
      }),
  },
  {
    id: 'pq1-q3c-setting2',
    label: '2015 Q3c · Setting 2 (burr mill)',
    note: 'Narrower plate gap setting (250 g sample): FM = 2.71, average size D = 0.314 mm, UI = 1:4:5. Scaling from Setting 1 (6.5 kW) with D as product size: Rittinger gives P₂ ≈ 7.0 kW, Bond gives P₂ ≈ 6.8 kW.',
    flag: "Note 2 prints n = 1 for Bond's law; correct theoretical exponent is n = 1.5 (giving E ∝ 1/√L₂ - 1/√L₁).",
    apply: () =>
      base({
        machine: 'burr',
        feedName: 'Sorghum grain',
        L1: 4.3,
        L2: 0.314,
        burrGapMm: 0.5,
        burrRpm: 500,
        motorPowerKw: 7.0,
        feedRateKgH: 450,
        sieveRetainedG: [0, 5.4, 13.5, 38.1, 70.8, 101.6, 9.2, 11.4],
      }),
  },
  {
    id: 'red-worked',
    label: 'RED worked · sieve analysis',
    note: 'Standard worked example from Note 2: % retained [1.0, 2.5, 7.0, 24.0, 35.5, 22.5, 7.5, 0] → sum = 312.0 → FM = 3.12, average size D = 0.357 mm, UI = 1:6:3.',
    apply: () =>
      base({
        machine: 'shaker',
        feedName: 'Ground feed sample',
        L1: 6.0,
        L2: 0.357,
        sieveRetainedG: [1.0, 2.5, 7.0, 24.0, 35.5, 22.5, 7.5, 0],
      }),
  },
  {
    id: 'fel-4-1',
    label: 'Fellows 4.1 · 10 hp motor check',
    note: 'Milling food from 6 mm to 0.0012 mm on a 10 hp (7457 W) motor. Target size is 0.0008 mm. With Rittinger law: P₂/P₁ = (1/0.0008 - 1/6)/(1/0.0012 - 1/6) ≈ 1.5, requiring 11.2 kW (15 hp). The 10 hp motor is not adequate.',
    apply: () =>
      base({
        machine: 'roller',
        feedName: 'Food material',
        L1: 6.0,
        L2: 0.0008,
        law: 'rittinger',
        motorPowerKw: 7.457,
        feedRateKgH: 300,
        rollGapMm: 0.1,
      }),
  },
  {
    id: 'pq6-q3c',
    label: 'PQ p6 Q3c · ½ hp motor check',
    note: 'Food reduced 4.22 mm to 0.4 mm with a 0.5 hp (373 W) motor. Target size is 0.004 mm. Required power: Kick gives 1.10 kW, Rittinger gives 41.2 kW. The motor is inadequate under both laws.',
    apply: () =>
      base({
        machine: 'burr',
        feedName: 'Food grain',
        L1: 4.22,
        L2: 0.004,
        law: 'kick',
        motorPowerKw: 0.373,
        feedRateKgH: 200,
      }),
  },
  {
    id: 'pq1-q2c-hammer',
    label: '2015 Q2c · cassava hammer mill',
    note: 'Hammer mill fitted with 1.5 mm screen for disintegrating cassava mash for garri processing. High speed 3000 rpm swinging beaters shatter fibrous tubers, pneumatically assisted by aspirator.',
    apply: () =>
      base({
        machine: 'hammer',
        feedName: 'Cassava tuber mash',
        L1: 8.0,
        L2: 1.2,
        screenHoleMm: 1.5,
        hammerRpm: 3000,
        aspiratorOn: true,
        motorPowerKw: 15.0,
        feedRateKgH: 800,
      }),
  },
]

export function Panel() {
  const p = useSizeReduction()
  const [activePreset, setActivePreset] = useState<string | null>('pq1-q3c-setting1')

  const sieve = useMemo(() => analyseSieves(p.sieveRetainedG), [p.sieveRetainedG])
  const energy = useMemo(() => analyseEnergy(p), [p])

  /* Sieve cumulative distribution chart data */
  const chartData = useMemo(() => {
    // Cumulative oversize vs opening
    const xs: number[] = []
    const ysPct: number[] = []
    let cum = 0
    for (let i = 0; i < IS_SIEVES.length; i++) {
      const s = IS_SIEVES[i]
      cum += sieve.pct[i] || 0
      xs.push(s.mm)
      ysPct.push(cum)
    }
    // Reverse so opening increases left to right
    const revX = [...xs].reverse()
    const revY = [...ysPct].reverse()
    return [revX, revY]
  }, [sieve.pct])

  /* Working steps */
  const workingSteps = useMemo<WorkingStep[]>(() => {
    const steps: WorkingStep[] = []

    // 1. Reduction Ratio
    steps.push({
      label: 'Size-reduction ratio (RR)',
      tex: 'RR = \\frac{L_1}{L_2}',
      sub: `RR = \\frac{${n(p.L1)}}{${n(p.L2)}}`,
      result: `= ${n(energy.RR, 2)} : 1`,
      cite: CITES.red('Definitions — coarse < 8:1, fine > 100:1'),
    })

    // 2. Fineness Modulus
    steps.push({
      label: 'Fineness Modulus (FM)',
      tex: 'FM = \\frac{\\sum (\\%_{\\text{retained}, i} \\times m_i)}{100}',
      sub: `FM = \\frac{${sieve.pct.map((pct, i) => `${n(pct, 2)}\\times${7 - i}`).join(' + ')}}{100}`,
      result: `= ${n(sieve.FM, 3)}`,
      cite: CITES.red('Fineness modulus method, multipliers 7…0'),
    })

    // 3. Average Particle Size
    steps.push({
      label: 'Average particle size (D)',
      tex: 'D = 0.135 \\times (1.366)^{FM} \\quad [\\text{mm}]',
      sub: `D = 0.135 \\times (1.366)^{${n(sieve.FM, 3)}}`,
      result: `= ${n(sieve.averageD, 3)}\\text{ mm}`,
      cite: CITES.red('Average particle size equation'),
    })

    // 4. Uniformity Index
    steps.push({
      label: 'Uniformity Index (UI)',
      tex: '\\text{UI} = \\text{round}\\left(\\frac{C}{10}\\right) : \\text{round}\\left(\\frac{M}{10}\\right) : \\text{round}\\left(\\frac{F}{10}\\right)',
      sub: `C = ${n(sieve.UI.coarse, 2)}\\%, \\quad M = ${n(sieve.UI.medium, 2)}\\%, \\quad F = ${n(sieve.UI.fine, 2)}\\%`,
      result: `= ${sieve.UI.ratio[0]} : ${sieve.UI.ratio[1]} : ${sieve.UI.ratio[2]}`,
      cite: CITES.red('Uniformity index: coarse (100+70+50), medium (40+30), fine (20+15+pan)'),
    })

    // 5. Energy law
    if (p.law === 'kick') {
      steps.push({
        label: "Kick's Law (n = 1)",
        tex: 'E = C_K \\ln\\left(\\frac{L_1}{L_2}\\right)',
        sub: `E = ${n(p.Ck)} \\ln\\left(\\frac{${n(p.L1)}}{${n(p.L2)}}\\right)`,
        result: `= ${n(energy.E_kick / 1000, 2)}\\text{ kJ/kg}`,
        cite: CITES.red('Energy requirements; best for coarse grinding'),
      })
    } else if (p.law === 'rittinger') {
      steps.push({
        label: "Rittinger's Law (n = 2)",
        tex: 'E = C_R \\left(\\frac{1}{L_2} - \\frac{1}{L_1}\\right)',
        sub: `E = ${n(p.Cr)} \\left(\\frac{1}{${n(p.L2)}} - \\frac{1}{${n(p.L1)}}\\right)`,
        result: `= ${n(energy.E_rittinger / 1000, 2)}\\text{ kJ/kg}`,
        cite: CITES.red('Proportional to new surface; best for fine grinding'),
      })
    } else {
      steps.push({
        label: "Bond's Law (n = 1.5)",
        tex: 'E = W_i \\left(\\sqrt{\\frac{100}{d_2}} - \\sqrt{\\frac{100}{d_1}}\\right) = 2 C_B \\left(\\frac{1}{\\sqrt{L_2}} - \\frac{1}{\\sqrt{L_1}}\\right)',
        sub: `E = ${n(p.Wi)} \\left(\\sqrt{\\frac{100}{${n(p.L2 * 1000)}}} - \\sqrt{\\frac{100}{${n(p.L1 * 1000)}}}\\right)`,
        result: `= ${n(energy.E_bond / 1000, 2)}\\text{ kJ/kg}`,
        cite: CITES.fel('Ch 4, eq 4.3; intermediate between Kick and Rittinger'),
        errata: 'RED Note 2 prints n = 1 for Bond; theoretical exponent in general law dE/dL = -C/L^n is n = 1.5.',
      })
    }

    // 6. Power required & motor adequacy
    steps.push({
      label: 'Power required & adequacy check',
      tex: 'P = E \\times \\dot{m} = E \\times \\frac{\\text{Feed rate}}{3600}',
      sub: `P = ${n((p.law === 'kick' ? energy.E_kick : p.law === 'rittinger' ? energy.E_rittinger : energy.E_bond) / 1000, 2)}\\text{ kJ/kg} \\times \\frac{${n(p.feedRateKgH)}}{3600}\\text{ kg/s}`,
      result: `= ${n(energy.powerRequiredKw, 2)}\\text{ kW} \\quad (\\text{Motor: } ${n(p.motorPowerKw, 2)}\\text{ kW, load: } ${n(energy.motorLoadPercent, 1)}\\%)`,
      beyond: true,
    })

    return steps
  }, [p, sieve, energy])

  return (
    <div className="flex flex-col gap-0">
      {/* 1. Live section */}
      <Section title="Live readouts">
        <div className="grid grid-cols-3 gap-1.5">
          {p.machine === 'hammer' ? (
            <>
              <Readout label="Rotor speed" value={fmt(p.hammerRpm, 0)} unit="rpm" tone="accent" />
              <Readout label="Tip speed" value={fmt(((p.hammerRpm * 2 * Math.PI) / 60) * 0.18, 1)} unit="m/s" tone="info" />
              <Readout label="Screen aperture" value={fmt(p.screenHoleMm, 1)} unit="mm" />
              <Readout label="Power draw" value={fmt(energy.powerRequiredKw, 2)} unit="kW" tone={energy.adequate ? 'accent' : 'warn'} />
              <Readout label="Motor load" value={fmt(energy.motorLoadPercent, 1)} unit="%" tone={energy.adequate ? 'ink' : 'warn'} />
              <Readout label="Reduction ratio" value={`${fmt(energy.RR, 1)}:1`} tone="info" />
            </>
          ) : p.machine === 'burr' ? (
            <>
              <Readout label="Plate speed" value={fmt(p.burrRpm, 0)} unit="rpm" tone="accent" />
              <Readout label="Plate gap" value={fmt(p.burrGapMm, 2)} unit="mm" tone="info" />
              <Readout label="Spring preload" value={fmt(p.springPreloadN, 0)} unit="N" />
              <Readout label="Power draw" value={fmt(energy.powerRequiredKw, 2)} unit="kW" tone={energy.adequate ? 'accent' : 'warn'} />
              <Readout label="Motor load" value={fmt(energy.motorLoadPercent, 1)} unit="%" tone={energy.adequate ? 'ink' : 'warn'} />
              <Readout label="Reduction ratio" value={`${fmt(energy.RR, 1)}:1`} tone="info" />
            </>
          ) : p.machine === 'roller' ? (
            <>
              <Readout label="Roll speed" value={fmt(p.rollRpm, 0)} unit="rpm" tone="accent" />
              <Readout label="Nip gap" value={fmt(p.rollGapMm, 2)} unit="mm" tone="info" />
              <Readout label="Roll ratio" value={`${fmt(p.rollRatio, 2)}:1`} />
              <Readout label="Power draw" value={fmt(energy.powerRequiredKw, 2)} unit="kW" tone={energy.adequate ? 'accent' : 'warn'} />
              <Readout label="Motor load" value={fmt(energy.motorLoadPercent, 1)} unit="%" tone={energy.adequate ? 'ink' : 'warn'} />
              <Readout label="Reduction ratio" value={`${fmt(energy.RR, 1)}:1`} tone="info" />
            </>
          ) : (
            <>
              <Readout label="Sample mass" value={fmt(sieve.totalMassG, 1)} unit="g" />
              <Readout label="Fineness Modulus" value={fmt(sieve.FM, 2)} tone="accent" />
              <Readout label="Avg diameter D" value={fmt(sieve.averageD, 3)} unit="mm" tone="info" />
              <Readout label="Uniformity Index" value={`${sieve.UI.ratio[0]}:${sieve.UI.ratio[1]}:${sieve.UI.ratio[2]}`} tone="accent" />
              <Readout label="Coarse %" value={fmt(sieve.UI.coarse, 1)} unit="%" />
              <Readout label="Fine %" value={fmt(sieve.UI.fine, 1)} unit="%" />
            </>
          )}
        </div>
      </Section>

      {/* 2. Controls section */}
      <Section title="Machine & reduction controls">
        <Segmented<MachineKind>
          label="Selected machine"
          value={p.machine}
          options={[
            { value: 'hammer', label: 'Hammer mill' },
            { value: 'burr', label: 'Burr / plate' },
            { value: 'roller', label: 'Roller crusher' },
            { value: 'shaker', label: 'Sieve shaker' },
          ]}
          onChange={(m) => set({ machine: m })}
        />

        <div className="mt-3 border-t border-line-2 pt-2.5">
          <Slider
            label="Feed size L₁"
            value={p.L1}
            min={0.5}
            max={15}
            step={0.1}
            unit="mm"
            onChange={(v) => set({ L1: v })}
            hint="Initial feed dimension before reduction"
          />
          <Slider
            label="Target product size L₂"
            value={p.L2}
            min={0.0005}
            max={3.0}
            step={0.005}
            unit="mm"
            digits={4}
            onChange={(v) => set({ L2: v })}
            hint="Final desired product size"
          />
          <Slider
            label="Feed rate"
            value={p.feedRateKgH}
            min={50}
            max={2000}
            step={25}
            unit="kg/h"
            onChange={(v) => set({ feedRateKgH: v })}
          />
          <Slider
            label="Motor power rating"
            value={p.motorPowerKw}
            min={0.25}
            max={30}
            step={0.25}
            unit="kW"
            onChange={(v) => set({ motorPowerKw: v })}
          />
        </div>

        {/* Machine specific parameter sliders */}
        <div className="mt-2 border-t border-line-2 pt-2">
          {p.machine === 'hammer' && (
            <>
              <Slider
                label="Rotor speed"
                value={p.hammerRpm}
                min={1500}
                max={4000}
                step={50}
                unit="rpm"
                onChange={(v) => set({ hammerRpm: v })}
              />
              <Slider
                label="Screen hole diameter"
                value={p.screenHoleMm}
                min={0.8}
                max={6.0}
                step={0.1}
                unit="mm"
                onChange={(v) => set({ screenHoleMm: v, L2: Math.max(0.1, v * 0.7) })}
              />
              <Slider
                label="Hammer beaters count"
                value={p.hammerCount}
                min={8}
                max={32}
                step={4}
                onChange={(v) => set({ hammerCount: v })}
              />
              <Toggle
                label="Aspirator pneumatic assist"
                checked={p.aspiratorOn}
                onChange={(v) => set({ aspiratorOn: v })}
                hint="Negative pressure suction removes grist and reduces internal heating"
              />
            </>
          )}

          {p.machine === 'burr' && (
            <>
              <Slider
                label="Plate speed"
                value={p.burrRpm}
                min={350}
                max={700}
                step={10}
                unit="rpm"
                onChange={(v) => set({ burrRpm: v })}
              />
              <Slider
                label="Plate clearance gap"
                value={p.burrGapMm}
                min={0.1}
                max={3.0}
                step={0.05}
                unit="mm"
                onChange={(v) => set({ burrGapMm: v, L2: Math.max(0.05, v * 0.5) })}
                hint="Handwheel screw adjustment"
              />
              <Slider
                label="Safety spring preload"
                value={p.springPreloadN}
                min={500}
                max={2500}
                step={50}
                unit="N"
                onChange={(v) => set({ springPreloadN: v })}
                hint="Yields when uncrushable tramp metal enters"
              />
            </>
          )}

          {p.machine === 'roller' && (
            <>
              <Slider
                label="Roll speed"
                value={p.rollRpm}
                min={150}
                max={800}
                step={25}
                unit="rpm"
                onChange={(v) => set({ rollRpm: v })}
              />
              <Slider
                label="Roll nip gap"
                value={p.rollGapMm}
                min={0.05}
                max={2.5}
                step={0.05}
                unit="mm"
                onChange={(v) => set({ rollGapMm: v, L2: Math.max(0.02, v * 0.6) })}
              />
              <Slider
                label="Speed differential ratio"
                value={p.rollRatio}
                min={1.0}
                max={2.5}
                step={0.1}
                unit=": 1"
                onChange={(v) => set({ rollRatio: v })}
                hint="Ratio of fast roll to slow roll (shearing action)"
              />
              <Toggle
                label="Fluted rolls (break rollers)"
                checked={p.fluted}
                onChange={(v) => set({ fluted: v })}
                hint="Fluted rolls for initial break; smooth rolls for reduction"
              />
            </>
          )}

          {p.machine === 'shaker' && (
            <Toggle
              label="Gyratory shaker drive"
              checked={p.shakerActive}
              onChange={(v) => set({ shakerActive: v })}
              hint="Fixed vertical gyratory motion (approx. 5 min test)"
            />
          )}
        </div>

        {/* Law selection */}
        <div className="mt-3 border-t border-line-2 pt-2.5">
          <Segmented<Law>
            label="Energy law"
            value={p.law}
            options={[
              { value: 'kick', label: "Kick (n=1)" },
              { value: 'rittinger', label: "Rittinger (n=2)" },
              { value: 'bond', label: "Bond (n=1.5)" },
            ]}
            onChange={(l) => set({ law: l })}
          />
          {p.law === 'bond' && (
            <div className="mt-1 rounded-md border border-warn/30 bg-warn/10 p-2 text-[11px] leading-snug text-warn/90">
              <Badge tone="warn">errata</Badge> Note 2 prints <span className="font-mono">n = 1</span> for Bond; correct exponent is <span className="font-mono">n = 1.5</span> (between Kick n=1 and Rittinger n=2).
            </div>
          )}
        </div>
      </Section>

      {/* 3. Exam Presets */}
      <Section title="Exam presets">
        <PresetGrid
          presets={EXAM_PRESETS}
          active={activePreset}
          onPick={(id) => setActivePreset(id)}
        />
      </Section>

      {/* 4. Sieve Stack Breakdown & Chart */}
      <Section title="Sieve analysis & distribution">
        <div className="mb-2 text-[11.5px] text-mute">
          IS sieve stack (250 g sample standard):
        </div>
        <div className="space-y-1.5 font-mono text-[11px]">
          {IS_SIEVES.map((s, i) => {
            const retainedG = p.sieveRetainedG[i] || 0
            const pct = sieve.pct[i] || 0
            const mult = 7 - i
            const group = i < 3 ? 'Coarse' : i < 5 ? 'Medium' : 'Fine'
            const groupColor = i < 3 ? 'text-accent' : i < 5 ? 'text-info' : 'text-mute'
            return (
              <div key={s.no} className="flex items-center justify-between rounded border border-line-2/40 bg-panel-3/40 px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className="w-12 font-medium text-ink">IS {s.no}</span>
                  <span className="w-16 text-mute">{s.mm > 0 ? `${s.mm} mm` : 'Pan'}</span>
                  <span className={`text-[10px] uppercase ${groupColor}`}>[{group}]</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-14 text-right text-ink/80">{retainedG.toFixed(1)} g</span>
                  <span className="w-12 text-right text-accent font-semibold">{pct.toFixed(1)}%</span>
                  <span className="w-14 text-right text-dim">× {mult} = {(pct * mult).toFixed(0)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium text-mute">Cumulative oversize curve (% vs opening mm):</div>
          <Chart
            data={chartData}
            series={[{ label: 'Cumulative retained (%)', color: '#f5b942', width: 2 }]}
            xLabel="Sieve aperture (mm)"
            yLabel="Cumulative oversize (%)"
            height={160}
          />
        </div>
      </Section>

      {/* 5. Working calculations */}
      <Section title="Working">
        <Working steps={workingSteps} />
      </Section>
    </div>
  )
}
