import { cite } from '@/content/citations'

/**
 * AEE 536 and AEE 504 citations for food preservation, storage structures and packaging.
 * Documents catalogued in docs/notes-inventory/AEE504-AEE536-crop-processing.md.
 */
export const P536 = {
  /** AEE 536 Notes New.docx — Spoilage, Methods, Thermal, Freezing, Cold Store, Yam & Grain Storage */
  n536: (where?: string) => cite('AEE536', 'AEE 536 Notes New.docx', where),
  /** Packaging and Food Preservation.docx — Functions, Barrier requirements, Materials, Machinability */
  pack: (where?: string) => cite('AEE536', 'Packaging and Food Preservation.docx', where),
  /** AEE 536 PRACTICAL.docx — Supermarket packaging survey, shelf life classification */
  prac: (where?: string) => cite('AEE536', 'AEE 536 PRACTICAL.docx', where),
  /** 2019/20 test — Spoilage signs, hurdles, traditional methods */
  t536a: (where?: string) => cite('AEE536', 'IMG-20250531-WA0010.jpg (2019/20 test)', where),
  /** 2022/23 test — Onion powder flow, hurdles, perishability, best-before */
  t536b: (where?: string) => cite('AEE536', 'IMG-20250531-WA0011.jpg (2022/23 test)', where),
  /** AEE 504 Handing & Planning — storage bins, conveyors, plant layout */
  hand: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where),
}
