import { cite } from '@/content/citations'

/**
 * Citations for Size Reduction (AEE 504 Note 2, past questions, and Fellows Ch 4).
 * As listed in docs/notes-inventory/AEE504-AEE536-crop-processing.md.
 */
export const CITES = {
  /** Notes 2: Size Reduction by Mrs Aregbesola (hammer, burr, roller mills; laws; FM & UI) */
  red: (where?: string) => cite('AEE504', 'AGE 504 note 2, reduction.doc', where),
  /** Note 1: Separation (cleaning, screens, aspirators) */
  sep: (where?: string) => cite('AEE504', 'seperation 504.docx', where),
  /** Note 3: Materials handling (conveyors & pneumatic systems) */
  hand: (where?: string) => cite('AEE504', 'AGE 504 Handling and planning new.docx', where),
  /** Past exam questions */
  pq: (where?: string) => cite('AEE504', 'AEE 504 past question.pdf', where),
  /** Fellows, Food Processing Technology 2e (Ch. 4 Size Reduction: Kick, Rittinger, Bond laws) */
  fel: (where?: string) => cite('Textbook', 'Fellows, Food Processing Technology 2e', where),
  /** Standard mechanical engineering references for standard machine elements */
  beyond: (what: string) => cite('Textbook', 'Standard mechanical engineering texts (not in 500L notes)', what),
}
