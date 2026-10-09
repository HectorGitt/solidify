/**
 * Citations back to the 500L course notes. Every part, equation and tour step points
 * to where it comes from so the app stays faithful to the notes.
 */
export interface Citation {
  course: 'AEE501' | 'AEE502' | 'AEE503' | 'AEE505' | 'AEE509' | 'AEE510' | 'AEE518' | 'Textbook' | 'AEE504' | 'AEE507' | 'AEE536'
  /** file name as it appears in the course folder */
  file: string
  /** page / figure / equation reference */
  where?: string
}

export const cite = (course: Citation['course'], file: string, where?: string): Citation => ({ course, file, where })

/** Short names for the files cited most often. */
export const SRC = {
  // AEE509 Farm Power I
  tb509: (where?: string) => cite('AEE509', 'extract fromtextbook(509).pdf', where),
  l3_509: (where?: string) => cite('AEE509', '509 Lecture 3.pdf', where),
  l4_509: (where?: string) => cite('AEE509', '509 Lecture 4.pdf', where),
  thermo509: (where?: string) => cite('AEE509', 'AEE 509 (Thermodynamic).pdf', where),
  misc509: (where?: string) => cite('AEE509', 'AEE 509 Miscellaneous Exercises and Tutorial Questions.pdf', where),
  supp509: (where?: string) => cite('AEE509', 'ENGINE SYSTEMS-Supplementary notes.pdf', where),
  man509: (where?: string) => cite('AEE509', 'AEE 509 manual.pdf', where),
  add509: (where?: string) => cite('AEE509', '509 Additional notes.pdf', where),
  exam509: (where?: string) => cite('AEE509', 'AEE_509_exam_past_questions[1].pdf', where),
  // AEE510 Farm Power II
  pt510: (where?: string) => cite('AEE510', 'AEE510 Power Transmission .pdf', where),
  tts510: (where?: string) => cite('AEE510', 'AEE510 Tractor Transmission System.pdf', where),
  top510: (where?: string) => cite('AEE510', 'AEE510 Transmission of Power.pdf', where),
  tt510: (where?: string) => cite('AEE510', 'AEE510 Tires and Tracks.pdf', where),
  hy510: (where?: string) => cite('AEE510', 'Tractor Hydraulic System .pdf', where),
  st510: (where?: string) => cite('AEE510', 'Tractor Steering .pdf', where),
  ma510: (where?: string) => cite('AEE510', 'Tractor Maintenance .pdf', where),
  he510: (where?: string) => cite('AEE510', 'Human Engineering in tractor design .pdf', where),
  l27: (where?: string) => cite('AEE510', 'Lecture27.pdf (Zoz & Grisso)', where),
  bal510: (where?: string) => cite('AEE510', 'Ballasting In Tractor - Types And Importance.pdf', where),
  // AEE502 Farm Machinery II
  am502: (where?: string) => cite('AEE502', 'AGRICULTURAL MACHINERIES.docx', where),
  hitch502: (where?: string) => cite('AEE502', 'Hitching and Mechanics of Tractor Chassis-1.docx', where),
  mac502: (where?: string) => cite('AEE502', '65851_Macmillan.pdf', where),
  mech502: (where?: string) => cite('AEE502', 'Tractor Mechanics AEE502.pdf', where),
  tests502: (where?: string) => cite('AEE502', 'Tractor Tests and Performance (502).pdf', where),
  uj502: (where?: string) => cite('AEE502', 'DOC-20210628-WA0047..pdf', where),
  hj502: (where?: string) => cite('AEE502', "Hooke's joint-1.ppt", where),
  pto502: (where?: string) => cite('AEE502', 'Power Take -off shaft.docx', where),
  vers502: (where?: string) => cite('AEE502', 'Tractor as a versatile equipment-new-3.doc', where),
  pm502: (where?: string) => cite('AEE502', 'Tractor power-measurement.pdf', where),
  // AEE501
  bush501: (where?: string) => cite('AEE501', 'AEE501 Bush.Land clearing Tillage.pdf', where),
  mgmt501: (where?: string) => cite('AEE501', 'AEE501 Machinery Management MODULE 1.pdf', where),
  // AEE503 / AEE518
  m503: (module: number, where?: string) => cite('AEE503', `AEE 503 Module ${module}`, where),
  ln518: (where?: string) => cite('AEE518', 'AEE 518 LECTURE NOTES-NEW-REVISED-2019-1.pdf', where),
  /** content added from standard texts because the notes do not cover it */
  beyond: (what: string) => cite('Textbook', 'Standard engineering texts (not in the 500L notes)', what),
}

export function formatCitation(c: Citation) {
  return `${c.course} · ${c.file}${c.where ? ` · ${c.where}` : ''}`
}
