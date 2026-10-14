import { cite } from '@/content/citations'

/**
 * AEE 504 citations for the Palm Oil Mill processing scene.
 * Sources from docs/notes-inventory/AEE504-AEE536-crop-processing.md:
 * - IMG-CPO  = Crude Palm Oil Milling Process pictorial flow chart
 * - IMG-POMB = Palm oil mass-balance flow chart (per 1000 kg FFB)
 * - IMG-T23  = 2022/23 test (traditional canoe matching vs modern mill, decanting device)
 * - PQ       = AEE 504 past question.pdf (p1 Q1 mill flowchart, p5 Q v centrifuge oil globule settling)
 * - SEP      = seperation 504.docx (centrifugation eq 18, Stokes law eqs 11–12)
 * - HAND     = AGE 504 Handling and planning new.docx (Note 3 conveyors, Note 4 plant layout)
 */
export const P504 = {
  cpo: (where?: string) => cite('AEE504', 'Crude Palm Oil Milling Process pictorial (…22.22.27_22a3c597.jpg)', where),
  pomb: (where?: string) => cite('AEE504', 'Palm oil mass-balance flow chart (…22.22.28_c83b592a.jpg)', where),
  t23: (where?: string) => cite('AEE504', 'IMG-20250531-WA0012.jpg (2022/23 test)', where),
  pq: (where?: string) => cite('AEE504', 'AEE 504 past question.pdf', where),
  sep: (where?: string) => cite('AEE504', 'seperation 504.docx', where),
  hand: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where),
}
