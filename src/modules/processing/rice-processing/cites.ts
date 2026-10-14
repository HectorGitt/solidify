import { cite, SRC, type Citation } from '@/content/citations'

/**
 * Citations for rice processing (AEE 504 / AEE 536).
 * Based on notes inventory in docs/notes-inventory/AEE504-AEE536-crop-processing.md:
 * - RICE = RICE 101.pdf (USA Rice Federation "Rice Technical Information Kit")
 * - PQ   = AEE 504 past question.pdf (April 2015, March 2017, PQ p4 Q5)
 * - SEP  = seperation 504.docx (Note 1: Separation – cleaning, sorting and grading)
 * - HAND = AGE 504 Handling and planning new.docx (Note 3 Materials handling, Note 4 Factory layout)
 */
export const RICE_CITES = {
  flow: (where?: string) => cite('AEE504', 'RICE 101.pdf', where ?? 'p9, Rice Processing Flow Chart'),
  anatomy: (where?: string) => cite('AEE504', 'RICE 101.pdf', where ?? 'p6, Parts of a Rice Kernel'),
  parboil: (where?: string) => cite('AEE504', 'RICE 101.pdf', where ?? 'p11, Parboiled Rice'),
  types: (where?: string) => cite('AEE504', 'RICE 101.pdf', where ?? 'p12, Rice Types and Characteristics'),
  pqParboil: (where?: string) => cite('AEE504', 'AEE 504 past question.pdf', where ?? 'p4 Q5 (Parboiled rice flow chart, quality, by-products)'),
  sepScreen: (where?: string) => cite('AEE504', 'seperation 504.docx', where ?? 'Note 1, Dry cleaning & screening'),
  sepAero: (where?: string) => cite('AEE504', 'seperation 504.docx', where ?? 'Note 1, Aerodynamics of small particles & cyclone'),
  conveyors: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where ?? 'Note 3, Bucket elevators and belt conveyors'),
  layout: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where ?? 'Note 4, Factory Layout'),
  beyond: (what: string): Citation => SRC.beyond(what),
}
