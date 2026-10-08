import { SRC, cite } from '@/content/citations'

/**
 * AEE503 sources used by the machine-elements scenes. File names are exactly as they appear in
 * the course folder (see docs/notes-inventory/AEE503-AEE518-machine-elements-vibration.md).
 */
export const A503 = {
  m: SRC.m503,
  manual: (where?: string) => cite('AEE503', 'AEE 503 MANUAL.pdf', where),
  /** 2015/16 marking guide */
  mg15: (where?: string) => cite('AEE503', 'AEE 503-15-16-MARKIN GUIDE-recent-corrected.docx', where),
  /** 2016/17 marking guide */
  mg16: (where?: string) => cite('AEE503', 'AEE 503-2016-17-MARKING GUIDE.docx', where),
  /** 2017/18 marking scheme (file mislabelled "AEE 501") */
  mg17: (where?: string) => cite('AEE503', 'AEE 501 201920 questions.docx (2017/18 AGE 503 marking scheme)', where),
  /** 2017/18 question paper */
  q17: (where?: string) => cite('AEE503', 'AEE 503 Q -2017-2018-final-new.docx', where),
  /** 2019/20 exam marking guide */
  mg19: (where?: string) => cite('AEE503', 'AEE  503  Q-1920-2021-Marking  Guide.docx', where),
  /** 2019/20 test marking guide */
  t19: (where?: string) => cite('AEE503', 'AEE  503  1920-2021-TEST-Marking Guide-1.docx', where),
  /** 2021/22 exam marking guide */
  mg21: (where?: string) => cite('AEE503', 'AEE 503 EXAM  -2021-22-MARKING GUIDE.docx', where),
  /** 2021/22 test marking guide */
  t21: (where?: string) => cite('AEE503', 'AEE 503 Test -2021-22-Marking Guide-1.docx', where),
  /** 2015/16 exam questions */
  e15: (where?: string) => cite('AEE503', 'AEE 503 2015-2016 EXAMINATION QUESTION.docx', where),
  /** Fenner belt & chain catalogue extract */
  table: (where?: string) => cite('AEE503', 'BELT DRIVES TABLE( AEE 503).pdf', where),
  beyond: SRC.beyond,
}
