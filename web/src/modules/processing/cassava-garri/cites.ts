import { cite } from '@/content/citations'

/**
 * Citations for the Cassava-to-Garri processing line.
 * References from docs/notes-inventory/AEE504-AEE536-crop-processing.md:
 * - GSTD = Codex STAN 151-1989 (garri standards.pdf)
 * - IMG-GARRI = gari flow chart (IMG-20250531-WA0006... / WA0028...jpg)
 * - SEP = Note 1: Separation – cleaning, sorting and grading (seperation 504.docx)
 * - RED = Notes 2: Size Reduction (AGE 504 note 2, reduction.doc)
 * - HAND = Note 3 & 4: Materials Handling & Factory Layout
 * - PQ = AEE 504 Past Questions (April 2015, March 2017)
 * - N536 / PACK = AEE 536 Food Preservation and Packaging
 */
export const CITE = {
  /** Garri standards: Codex STAN 151-1989 */
  gstd: (where?: string) => cite('AEE504', 'garri standards.pdf', where),
  /** Gari flow chart image */
  garriFlow: (where?: string) => cite('AEE504', 'gari flow chart image (IMG-GARRI)', where),
  /** Separation notes: cleaning, washing, sieving */
  sep: (where?: string) => cite('AEE504', 'seperation 504.docx', where),
  /** Size reduction notes: grating, hammer mill mash */
  red: (where?: string) => cite('AEE504', 'AGE 504 note 2, reduction.doc', where),
  /** Handling and factory planning */
  hand: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where),
  /** Past exam questions */
  pq: (where?: string) => cite('AEE504', 'AEE 504 past question.pdf', where),
  /** Preservation kinetics & fermentation */
  n536: (where?: string) => cite('AEE536', 'AEE 536 Notes New.docx', where),
  /** Food packaging standards */
  pack: (where?: string) => cite('AEE536', 'Packaging and Food Preservation.docx', where),
}
