import { useMemo, useState } from 'react'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { ModeTabs, PresetGrid, type Preset } from '../../elements/_shared/PanelBits'
import { P536 } from './cites'
import {
  DEFAULTS,
  analysePreservation,
  plankShapeFactors,
  usePreservation,
  type Apparatus,
  type Commodity,
  type FreezeShape,
  type PreservationParams,
} from './model'

const set = (p: Partial<PreservationParams>) => usePreservation.getState().set(p)
const base = (p: Partial<PreservationParams>) => set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  {
    id: 'retort-12d',
    label: 'C. botulinum · 12D Cook',
    note: 'Standard 12D botulinum cook for low-acid canned foods (pH > 4.5). D₁₂₁.₁ = 0.21 min, z = 10 °C. Target 12-log reduction gives F₀ = 12 × 0.21 = 2.52 min.',
    apply: () =>
      base({
        apparatus: 'retort',
        microbe: 'botulinum',
        retortTempC: 121.1,
        dRefMin: 0.21,
        zValueC: 10.0,
        targetLogs: 12,
        canAgitation: false,
      }),
  },
  {
    id: 'retort-stearo',
    label: 'B. stearothermophilus · Flat-sour',
    note: 'Heat-resistant thermophilic spore causing flat-sour spoilage in canned goods stored in warm climates. D₁₂₁.₁ = 4.0 min, z = 10 °C. 5-log reduction gives F₀ = 20.0 min.',
    apply: () =>
      base({
        apparatus: 'retort',
        microbe: 'stearothermophilus',
        retortTempC: 121.1,
        dRefMin: 4.0,
        zValueC: 10.0,
        targetLogs: 5,
        canAgitation: true,
      }),
  },
  {
    id: 'cooling-meat-90t',
    label: 'Meat cooling · 90 t/day (263 kW)',
    note: 'Worked example: 90 t/day beef chilled 2 °C to -12 °C (T_f = -1 °C, C_a = 3.2, h_l = 225, C_b = 1.63 kJ/kg·K). Product cooling load H = 263 kW (74.8 TR).',
    apply: () =>
      base({
        apparatus: 'coldstore',
        commodity: 'meat',
        dailyMassT: 90,
        inletTempC: 2.0,
        storageTempC: -12.0,
        freezingPointC: -1.0,
        Ca: 3.2,
        latentHeatKj: 225,
        Cb: 1.63,
      }),
  },
  {
    id: 'plank-sphere-7cm',
    label: 'Plank freezing · 7 cm sphere (2.04 h)',
    note: 'Worked example: 7 cm sphere in -15 °C air-blast tunnel (T_f = -1.25 °C, ρ = 1000 kg/m³, H_L = 250 kJ/kg, k = 1.2 W/m·K, h_c = 50 W/m²·K). t_f = 7335 s = 2.04 h.',
    apply: () =>
      base({
        apparatus: 'coldstore',
        freezeShape: 'sphere',
        dimensionM: 0.07,
        airTempC: -15.0,
        freezingPointC: -1.25,
        foodDensity: 1000,
        latentHeatKj: 250,
        kFrozen: 1.2,
        hc: 50,
        packageThicknessMm: 0,
      }),
  },
]

export const EXAM_PRESETS: Preset[] = [
  {
    id: 'respiration-oranges',
    label: 'Table 3.1 · 1 t oranges respiration',
    note: 'Heat of respiration table: oranges at 15.6 °C respire 3850–5405 J/kg/day (~53 W/tonne), continuously releasing biological heat that adds to the refrigeration compressor duty.',
    apply: () =>
      base({
        apparatus: 'coldstore',
        commodity: 'oranges',
        dailyMassT: 1.0,
        inletTempC: 15.6,
        storageTempC: 4.4,
      }),
  },
  {
    id: 'yam-barn-traditional',
    label: 'Yam barn · 3 m poles on 50 cm grid',
    note: 'Traditional yam barn: 3 m vertical poles on 50 cm spacing, horizontal tuber tying with twine, palm-frond thatch shade. Natural ventilation keeps tubers dry; loss from rots, sprouts, respiration.',
    apply: () =>
      base({
        apparatus: 'storage',
        storeType: 'yam_barn',
        yamPoleHeightM: 3.0,
        yamPoleSpacingM: 0.5,
        yamTubersCount: 200,
      }),
  },
  {
    id: 'pics-triple-bag',
    label: 'PICS triple bag · Hermetic storage',
    note: 'Triple bag: 2 inner HDPE liners inside outer woven PP sack. Respiration depletes O₂ to < 5%, asphyxiating Callosobruchus maculatus without chemical insecticides.',
    apply: () =>
      base({
        apparatus: 'storage',
        storeType: 'triple_bag',
      }),
  },
  {
    id: 'onion-powder-hurdle',
    label: '2022/23 Exam · Onion powder hurdles',
    note: 'Onion powder line — hurdle technology sequence: Washing → Blanching (enzymes) → Slicing → Blanching → Drying (a_w < 0.3) → Chemical Preservative → Hermetic Packaging.',
    apply: () =>
      base({
        apparatus: 'packaging',
        packagingType: 'retort_pouch',
        hurdleBlanching: true,
        hurdleDrying: true,
        hurdlePreservative: true,
        hurdleHermetic: true,
        hurdleSterilization: false,
      }),
  },
]

function LiveMetrics() {
  const p = usePreservation()
  const a = useMemo(() => analysePreservation(p), [p])
  const R = (label: string, v: number, d: number, unit: string, tone?: 'accent' | 'warn' | 'info') => (
    <Readout label={label} value={fmt(v, d)} unit={unit} tone={tone} />
  )

  return (
    <Section title="Live Metrics">
      <div className="grid grid-cols-3 gap-1.5">
        {p.apparatus === 'blancher' ? (
          <>
            {R('Blanch temp', p.blancherTempC, 3, '°C', 'accent')}
            {R('Residence time', p.blancherTimeMin, 3, 'min')}
            {R('Belt speed', p.blancherBeltSpeed, 3, 'm/min')}
            <Readout label="Peroxidase" value={a.peroxidaseInactivated ? 'Inactivated' : 'Active'} tone={a.peroxidaseInactivated ? 'accent' : 'warn'} />
            {R('Solids leaching', a.steamLeachingLossPct, 3, '%', 'info')}
            {R('Throughput', p.blancherThroughput, 3, 'kg/h')}
          </>
        ) : p.apparatus === 'retort' ? (
          <>
            {R('Retort temp', p.retortTempC, 4, '°C', 'accent')}
            {R('D-value @ T', a.dAtTempMin, 3, 'min', 'warn')}
            {R('D-value (sec)', a.dAtTempSec, 3, 's')}
            {R('Cook time (t)', a.sterilisationTimeMin, 3, 'min', 'accent')}
            {R('F₀ value', a.F0Min, 3, 'min', 'info')}
            {R('Lethality rate L', a.lethalityRate, 3, '')}
          </>
        ) : p.apparatus === 'coldstore' ? (
          <>
            {R('Mass flow m', a.mKgPerSec, 3, 'kg/s')}
            {R('Product load H', a.productLoadKw, 3, 'kW', 'warn')}
            {R('Load in TR', a.productLoadTr, 3, 'TR')}
            {R('Plank time tf', a.plankHours, 3, 'h', 'accent')}
            {R('Plank (sec)', a.plankSeconds, 4, 's')}
            {R('Respiration Q', a.respLoadKw, 3, 'kW', 'info')}
          </>
        ) : p.apparatus === 'storage' ? (
          <>
            {R('Tubers/pole', a.tubersPerPole, 0, '')}
            {R('Poles needed', a.totalPolesNeeded, 0, '', 'accent')}
            {R('Barn length', a.barnLengthM, 2, 'm', 'info')}
            <Readout label="O₂ in PICS bag" value="< 5 %" tone="accent" />
            <Readout label="Yam chilling risk" value="< 10 °C" tone="warn" />
            <Readout label="Optimum yam T" value="15–16 °C" tone="accent" />
          </>
        ) : p.apparatus === 'packaging' ? (
          <>
            <Readout label="Hermetic barrier" value={p.hurdleHermetic ? 'High (O₂/H₂O)' : 'Low'} tone="accent" />
            <Readout label="Enzyme hurdle" value={p.hurdleBlanching ? 'Passed' : 'Active'} tone={p.hurdleBlanching ? 'accent' : 'warn'} />
            <Readout label="Water activity" value={p.hurdleDrying ? 'aw < 0.6' : 'aw > 0.95'} tone="info" />
            <Readout label="Target shelf life" value={p.packagingType === 'metal_can' ? '2–5 years' : '6–18 months'} />
            <Readout label="Dating type" value="Best before / Exp" />
            <Readout label="Pack integrity" value="Double-seam hermetic" tone="accent" />
          </>
        ) : (
          <>
            {R('Retort F₀', a.F0Min, 3, 'min', 'accent')}
            {R('Cooling load', a.productLoadKw, 3, 'kW', 'warn')}
            {R('Plank tf', a.plankHours, 3, 'h', 'info')}
            {R('D-value @ T', a.dAtTempMin, 3, 'min')}
            <Readout label="Blancher enzyme" value={a.peroxidaseInactivated ? 'Inactivated' : 'Active'} tone="accent" />
            <Readout label="Hermetic storage" value="PICS triple bag" tone="accent" />
          </>
        )}
      </div>
    </Section>
  )
}

function Controls() {
  const p = usePreservation()

  return (
    <Section title="Preservation System">
      <ModeTabs<Apparatus>
        value={p.apparatus}
        onChange={(apparatus) => set({ apparatus })}
        options={[
          { value: 'all', label: 'All Facility' },
          { value: 'blancher', label: 'Blancher' },
          { value: 'retort', label: 'Retort / TDT' },
          { value: 'coldstore', label: 'Cold Store / Plank' },
          { value: 'storage', label: 'Yam Barn & Silo' },
          { value: 'packaging', label: 'Packaging & Hurdles' },
        ]}
      />

      <div className="h-3" />

      {/* Blancher Controls */}
      {p.apparatus === 'blancher' ? (
        <>
          <div className="mb-2">
            <span className="text-[12px] text-ink/90">Blancher Type</span>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => set({ blancherType: 'steam' })}
                className={`flex-1 rounded border px-2 py-1 text-[12px] ${p.blancherType === 'steam' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Steam Tunnel (3.5% leaching)
              </button>
              <button
                onClick={() => set({ blancherType: 'water' })}
                className={`flex-1 rounded border px-2 py-1 text-[12px] ${p.blancherType === 'water' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Hot Water Bath (12% leaching)
              </button>
            </div>
          </div>
          <Slider label="Temperature" value={p.blancherTempC} min={70} max={100} step={1} unit="°C" onChange={(blancherTempC) => set({ blancherTempC })} hint="70–100 °C (typically 95 °C)" />
          <Slider label="Residence time" value={p.blancherTimeMin} min={0.5} max={5.0} step={0.25} unit="min" onChange={(blancherTimeMin) => set({ blancherTimeMin })} hint="Typically 2–3 min" />
          <Slider label="Belt speed" value={p.blancherBeltSpeed} min={0.2} max={3.0} step={0.1} unit="m/min" onChange={(blancherBeltSpeed) => set({ blancherBeltSpeed })} />
          <Slider label="Throughput" value={p.blancherThroughput} min={100} max={2000} step={50} unit="kg/h" onChange={(blancherThroughput) => set({ blancherThroughput })} />

          <div className="mb-2">
            <span className="text-[12px] text-ink/90">Chemical Additive Dip</span>
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-[11.5px]">
              <button
                onClick={() => set({ blancherAdditive: 'none' })}
                className={`rounded border p-1 text-left ${p.blancherAdditive === 'none' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                None
              </button>
              <button
                onClick={() => set({ blancherAdditive: 'carbonate' })}
                className={`rounded border p-1 text-left ${p.blancherAdditive === 'carbonate' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Na₂CO₃ / CaO (chlorophyll)
              </button>
              <button
                onClick={() => set({ blancherAdditive: 'cacl2' })}
                className={`rounded border p-1 text-left ${p.blancherAdditive === 'cacl2' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                CaCl₂ (firmness / pectates)
              </button>
              <button
                onClick={() => set({ blancherAdditive: 'salt' })}
                className={`rounded border p-1 text-left ${p.blancherAdditive === 'salt' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Salt / SO₂ (anti-browning)
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* Retort Controls */}
      {p.apparatus === 'retort' ? (
        <>
          <div className="mb-2">
            <span className="text-[12px] text-ink/90">Target Microorganism</span>
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-[11.5px]">
              <button
                onClick={() => set({ microbe: 'botulinum', dRefMin: 0.21, zValueC: 10, targetLogs: 12 })}
                className={`rounded border p-1 text-left ${p.microbe === 'botulinum' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                C. botulinum (D=0.21m, 12D)
              </button>
              <button
                onClick={() => set({ microbe: 'sporogenes', dRefMin: 1.0, zValueC: 10, targetLogs: 5 })}
                className={`rounded border p-1 text-left ${p.microbe === 'sporogenes' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                C. sporogenes (D=1.0m, 5D)
              </button>
              <button
                onClick={() => set({ microbe: 'stearothermophilus', dRefMin: 4.0, zValueC: 10, targetLogs: 5 })}
                className={`rounded border p-1 text-left ${p.microbe === 'stearothermophilus' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                B. stearo (D=4.0m, thermophile)
              </button>
              <button
                onClick={() => set({ microbe: 'custom' })}
                className={`rounded border p-1 text-left ${p.microbe === 'custom' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Custom Organism
              </button>
            </div>
          </div>

          <Slider label="Retort temperature" value={p.retortTempC} min={100} max={135} step={0.1} unit="°C" onChange={(retortTempC) => set({ retortTempC })} hint="Standard: 121.1 °C (250 °F)" />
          <Slider label="Reference D₁₂₁.₁" value={p.dRefMin} min={0.05} max={8.0} step={0.05} unit="min" onChange={(dRefMin) => set({ dRefMin })} />
          <Slider label="Temperature sensitivity z" value={p.zValueC} min={5.0} max={20.0} step={0.5} unit="°C" onChange={(zValueC) => set({ zValueC })} hint="Typically 10 °C for bacterial spores" />
          <Slider label="Log reductions" value={p.targetLogs} min={1} max={16} step={1} unit="logs" onChange={(targetLogs) => set({ targetLogs })} hint="12D cook = 12 logs" />
          <div className="flex items-center justify-between text-[12px] pt-1">
            <span>Can agitation mode</span>
            <button
              onClick={() => set({ canAgitation: !p.canAgitation })}
              className={`rounded border px-2 py-0.5 ${p.canAgitation ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
            >
              {p.canAgitation ? 'Rotary Retort (Faster conduction)' : 'Still Retort (Stationary)'}
            </button>
          </div>
        </>
      ) : null}

      {/* Cold Store Controls */}
      {p.apparatus === 'coldstore' ? (
        <>
          <div className="mb-2">
            <span className="text-[12px] text-ink/90">Commodity</span>
            <div className="mt-1 grid grid-cols-4 gap-1 text-[11.5px]">
              {(['meat', 'oranges', 'apples', 'tomatoes'] as Commodity[]).map((c) => (
                <button
                  key={c}
                  onClick={() => set({ commodity: c })}
                  className={`capitalize rounded border py-1 text-center ${p.commodity === c ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <Slider label="Daily throughput" value={p.dailyMassT} min={5} max={200} step={5} unit="t/day" onChange={(dailyMassT) => set({ dailyMassT })} hint="Worked example: 90 t/day" />
          <Slider label="Inlet product temp" value={p.inletTempC} min={-5} max={30} step={0.5} unit="°C" onChange={(inletTempC) => set({ inletTempC })} />
          <Slider label="Target storage temp" value={p.storageTempC} min={-25} max={5} step={0.5} unit="°C" onChange={(storageTempC) => set({ storageTempC })} />
          <Slider label="Freezing point Tf" value={p.freezingPointC} min={-3.0} max={0.0} step={0.05} unit="°C" onChange={(freezingPointC) => set({ freezingPointC })} />

          <div className="mt-2 border-t border-line/60 pt-2">
            <span className="text-[12px] font-medium text-ink/90">Plank Freezing Equation</span>
            <div className="mt-1 flex gap-1.5 text-[11.5px]">
              {(['sphere', 'cylinder', 'slab'] as FreezeShape[]).map((s) => (
                <button
                  key={s}
                  onClick={() => set({ freezeShape: s })}
                  className={`flex-1 capitalize rounded border py-1 ${p.freezeShape === s ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="h-2" />
            <Slider label="Diameter / thickness a" value={p.dimensionM} min={0.01} max={0.2} step={0.005} unit="m" onChange={(dimensionM) => set({ dimensionM })} hint="7 cm sphere = 0.07 m" />
            <Slider label="Blast air temperature" value={p.airTempC} min={-40} max={-5} step={1} unit="°C" onChange={(airTempC) => set({ airTempC })} />
            <Slider label="Heat transfer coeff hc" value={p.hc} min={10} max={150} step={5} unit="W/m²·K" onChange={(hc) => set({ hc })} hint="Air blast: 30–80 W/m²·K" />
            <Slider label="Packaging thickness" value={p.packageThicknessMm} min={0} max={5} step={0.5} unit="mm" onChange={(packageThicknessMm) => set({ packageThicknessMm })} hint="x/k₁ term in Plank's packaged form" />
          </div>
        </>
      ) : null}

      {/* Storage Structures Controls */}
      {p.apparatus === 'storage' ? (
        <>
          <div className="mb-2">
            <span className="text-[12px] text-ink/90">Storage Structure Type</span>
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-[11.5px]">
              <button
                onClick={() => set({ storeType: 'yam_barn' })}
                className={`rounded border p-1 text-left ${p.storeType === 'yam_barn' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Traditional Yam Barn (3m)
              </button>
              <button
                onClick={() => set({ storeType: 'grain_silo' })}
                className={`rounded border p-1 text-left ${p.storeType === 'grain_silo' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Aerated Grain Silo
              </button>
              <button
                onClick={() => set({ storeType: 'triple_bag' })}
                className={`rounded border p-1 text-left ${p.storeType === 'triple_bag' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                PICS Hermetic Triple-Bag
              </button>
              <button
                onClick={() => set({ storeType: 'cold_room_15' })}
                className={`rounded border p-1 text-left ${p.storeType === 'cold_room_15' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                15 °C Yam Cold Room
              </button>
            </div>
          </div>
          <Slider label="Tuber count" value={p.yamTubersCount} min={50} max={1000} step={50} unit="tubers" onChange={(yamTubersCount) => set({ yamTubersCount })} />
          <Slider label="Pole height" value={p.yamPoleHeightM} min={2.0} max={4.0} step={0.25} unit="m" onChange={(yamPoleHeightM) => set({ yamPoleHeightM })} />
          <Slider label="Pole spacing" value={p.yamPoleSpacingM} min={0.3} max={1.0} step={0.05} unit="m" onChange={(yamPoleSpacingM) => set({ yamPoleSpacingM })} />
        </>
      ) : null}

      {/* Packaging & Hurdles Controls */}
      {p.apparatus === 'packaging' ? (
        <>
          <div className="mb-2">
            <span className="text-[12px] text-ink/90">Packaging Container</span>
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-[11.5px]">
              <button
                onClick={() => set({ packagingType: 'metal_can' })}
                className={`rounded border p-1 text-left ${p.packagingType === 'metal_can' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Tinplate Can (Double-seamed)
              </button>
              <button
                onClick={() => set({ packagingType: 'glass_jar' })}
                className={`rounded border p-1 text-left ${p.packagingType === 'glass_jar' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Glass Jar (Lug closure)
              </button>
              <button
                onClick={() => set({ packagingType: 'retort_pouch' })}
                className={`rounded border p-1 text-left ${p.packagingType === 'retort_pouch' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                Retort Pouch (Laminate)
              </button>
              <button
                onClick={() => set({ packagingType: 'triple_bag' })}
                className={`rounded border p-1 text-left ${p.packagingType === 'triple_bag' ? 'border-accent bg-accent/20 text-accent' : 'border-line text-ink/70'}`}
              >
                PICS Triple-Bag (Grain)
              </button>
            </div>
          </div>

          <div className="mt-2 border-t border-line/60 pt-2">
            <span className="text-[12px] font-medium text-ink/90">Hurdle Technology Chain</span>
            <div className="mt-1 space-y-1 text-[12px]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.hurdleBlanching}
                  onChange={(e) => set({ hurdleBlanching: e.target.checked })}
                  className="rounded border-line"
                />
                <span>Hurdle 1: Blanching (Enzyme inactivation & oxygen expulsion)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.hurdleDrying}
                  onChange={(e) => set({ hurdleDrying: e.target.checked })}
                  className="rounded border-line"
                />
                <span>Hurdle 2: Drying (Lower water activity aw &lt; 0.6)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.hurdlePreservative}
                  onChange={(e) => set({ hurdlePreservative: e.target.checked })}
                  className="rounded border-line"
                />
                <span>Hurdle 3: Chemical preservative (pH reduction / benzoate)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.hurdleHermetic}
                  onChange={(e) => set({ hurdleHermetic: e.target.checked })}
                  className="rounded border-line"
                />
                <span>Hurdle 4: Hermetic barrier (Excludes oxygen & moisture)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.hurdleSterilization}
                  onChange={(e) => set({ hurdleSterilization: e.target.checked })}
                  className="rounded border-line"
                />
                <span>Hurdle 5: In-pack thermal retort sterilization</span>
              </label>
            </div>
          </div>
        </>
      ) : null}
    </Section>
  )
}

function PresetsSection() {
  const [active, setActive] = useState<string | null>('retort-12d')

  return (
    <>
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={active} onPick={setActive} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={EXAM_PRESETS} active={active} onPick={setActive} />
      </Section>
    </>
  )
}

function ChartsSection() {
  const p = usePreservation()
  const a = useMemo(() => analysePreservation(p), [p])

  // Chart 1: Microbial Survivor Curve (Log N vs time in min)
  const survivorData = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    const totalTime = Math.max(1, a.sterilisationTimeMin * 1.25)
    const steps = 40
    const logN0 = Math.log10(p.initialLoadN0)
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * totalTime
      const logN = logN0 - t / Math.max(0.01, a.dAtTempMin)
      xs.push(t)
      ys.push(logN)
    }
    return [xs, ys]
  }, [a.sterilisationTimeMin, a.dAtTempMin, p.initialLoadN0])

  // Chart 2: Plank Freezing Time vs Diameter a (Sphere vs Cylinder vs Slab)
  const plankComparisonData = useMemo(() => {
    const xs: number[] = []
    const ySphere: number[] = []
    const yCylinder: number[] = []
    const ySlab: number[] = []
    const steps = 30
    const deltaT = Math.max(0.1, p.freezingPointC - p.airTempC)
    const factor1 = (p.foodDensity * p.latentHeatKj * 1000) / deltaT

    for (let i = 1; i <= steps; i++) {
      const dim = (i / steps) * 0.15 // 0.005 to 0.15 m
      xs.push(dim * 100) // in cm

      const tSphere = (factor1 * ((1 / 6) * (dim / p.hc) + (1 / 24) * ((dim * dim) / p.kFrozen))) / 3600
      const tCyl = (factor1 * ((1 / 4) * (dim / p.hc) + (1 / 16) * ((dim * dim) / p.kFrozen))) / 3600
      const tSlab = (factor1 * ((1 / 2) * (dim / p.hc) + (1 / 8) * ((dim * dim) / p.kFrozen))) / 3600

      ySphere.push(tSphere)
      yCylinder.push(tCyl)
      ySlab.push(tSlab)
    }
    return [xs, ySphere, yCylinder, ySlab]
  }, [p.freezingPointC, p.airTempC, p.foodDensity, p.latentHeatKj, p.hc, p.kFrozen])

  return (
    <Section title="Performance & Kinetics Charts">
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-[11px] font-medium text-ink/90">
            Microbial Log Survivor Curve (D-value slope = -1/D)
          </div>
          <Chart
            data={survivorData}
            series={[{ label: 'log₁₀ N (Spores)', color: '#e06c75', width: 2 }]}
            xLabel="Time (min)"
            yLabel="log₁₀ N"
            height={160}
          />
        </div>

        <div>
          <div className="mb-1 text-[11px] font-medium text-ink/90">
            Plank Freezing Time vs Dimension (Sphere vs Cyl vs Slab)
          </div>
          <Chart
            data={plankComparisonData}
            series={[
              { label: 'Sphere (1/6, 1/24)', color: '#61afef', width: 2 },
              { label: 'Cylinder (1/4, 1/16)', color: '#98c379', width: 2 },
              { label: 'Slab (1/2, 1/8)', color: '#e5c07b', width: 2 },
            ]}
            xLabel="Thickness / Diameter (cm)"
            yLabel="Freezing Time (hours)"
            height={170}
          />
        </div>
      </div>
    </Section>
  )
}

function WorkingSection() {
  const p = usePreservation()
  const a = useMemo(() => analysePreservation(p), [p])
  const { P, R } = plankShapeFactors(p.freezeShape)

  const steps: WorkingStep[] = [
    {
      label: '1. Microbial death kinetics and D at the retort temperature',
      beyond: true,
      tex: '\\frac{dN}{dt} = -k N \\implies D = \\frac{2.303}{k}',
      sub: `D(${n(p.retortTempC, 4)}\\,^\\circ\\text{C}) = ${n(p.dRefMin, 3)}\\times 10^{\\frac{121.1 - ${n(p.retortTempC, 4)}}{${n(p.zValueC, 2)}}}`,
      result: `= ${n(a.dAtTempMin, 3)}\\,\\text{min}\\;(${n(a.dAtTempSec, 3)}\\,\\text{s})`,
      cite: P536.n536('Thermal death time'),
    },
    {
      label: '2. Process time and F₀',
      beyond: true,
      tex: 't = D \\log_{10}\\left(\\frac{N_0}{N}\\right) = D \\times \\Delta\\log, \\quad F_0 = D_{121.1} \\times \\Delta\\log',
      sub: `t = ${n(a.dAtTempMin, 3)} \\times ${n(p.targetLogs, 2)}, \\quad F_0 = ${n(p.dRefMin, 3)} \\times ${n(p.targetLogs, 2)}`,
      result: `t = ${n(a.sterilisationTimeMin, 3)}\\,\\text{min}, \\quad F_0 = ${n(a.F0Min, 3)}\\,\\text{min}`,
      cite: P536.n536('F0 calculation'),
    },
    {
      label: '3. Product cooling load',
      tex: 'H = m\\left[C_a \\Delta T_a + h_l + C_b \\Delta T_b\\right]',
      sub: `H = ${n(a.mKgPerSec, 4)}\\left[${n(p.Ca, 3)}(${n(a.dTa, 2)}) + ${n(p.latentHeatKj, 3)} + ${n(p.Cb, 3)}(${n(a.dTb, 2)})\\right]`,
      result: `= ${n(a.productLoadKw, 4)}\\,\\text{kW}\\;(${n(a.productLoadTr, 3)}\\,\\text{TR})`,
      cite: P536.n536('Refrigeration cooling load'),
    },
    {
      label: '4. Plank freezing time',
      tex: 't_f = \\left[\\frac{\\rho H_L}{T_f - T_\\infty}\\right] \\left[\\frac{P\' a}{h_c} + \\frac{R\' a^2}{k}\\right]',
      sub: `t_f = \\left[\\frac{${n(p.foodDensity, 4)} \\times ${n(p.latentHeatKj * 1000, 5)}}{${n(p.freezingPointC, 3)} - (${n(p.airTempC, 3)})}\\right] \\left[\\frac{${n(P, 3)}(${n(p.dimensionM, 3)})}{${n(p.hc, 2)}} + \\frac{${n(R, 3)}(${n(p.dimensionM, 3)})^2}{${n(p.kFrozen, 3)}}\\right]`,
      result: `= ${n(a.plankSeconds, 4)}\\,\\text{s} = ${n(a.plankHours, 3)}\\,\\text{h}`,
      cite: P536.n536('Plank freezing equation'),
    },
    {
      label: '5. Packaged product (film resistance)',
      tex: 't_f = \\left[\\frac{\\rho H_L}{T_f - T_\\infty}\\right] \\left[P\' a \\left(\\frac{1}{h_c} + \\frac{x}{k_1}\\right) + \\frac{R\' a^2}{k_2}\\right]',
      sub: `x = ${n(p.packageThicknessMm, 2)}\\,\\text{mm}, \\quad k_1 = ${n(p.kPackage, 2)}\\,\\text{W/m}\\cdot\\text{K}`,
      result: `\\text{Thermal barrier added} = \\frac{x}{k_1} = ${n((p.packageThicknessMm / 1000) / p.kPackage, 4)}\\,\\text{m}^2\\cdot\\text{K/W}`,
      cite: P536.n536('Packaged food freezing'),
    },
  ]

  return (
    <Section title="Working Steps (Mathematical Derivation)">
      <Working steps={steps} />
    </Section>
  )
}

export function PreservationPanel() {
  return (
    <div className="pb-8">
      <LiveMetrics />
      <Controls />
      <PresetsSection />
      <ChartsSection />
      <WorkingSection />
    </div>
  )
}
