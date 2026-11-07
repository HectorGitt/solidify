import { GoogleGenAI } from '@google/genai'

/**
 * Text embeddings, for matching a student's request to checked models in the library: similar requests
 * ("a 30:1 worm reducer", "worm and wheel gearbox") land close together even with no words in common.
 */
export interface Embedder {
  /** one vector per text: `document` for library entries, `query` for what a student typed */
  embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]>
}

export const DIMENSIONS = 768

export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

/**
 * Gemini embeddings on Vertex AI. Embedding models are not served in every region: the first location that
 * answers is kept for the rest of the process.
 */
export class GeminiEmbedder implements Embedder {
  private working: GoogleGenAI | null = null
  constructor(
    private model: string,
    private project: string,
    private locations: string[],
  ) {}

  async embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]> {
    if (!texts.length) return []
    const config = { taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT', outputDimensionality: DIMENSIONS }
    const tryWith = async (ai: GoogleGenAI) => {
      const out: number[][] = []
      // a few at a time: the service limits how many texts one call may carry
      for (let i = 0; i < texts.length; i += 50) {
        const res = await ai.models.embedContent({ model: this.model, contents: texts.slice(i, i + 50), config })
        for (const e of res.embeddings ?? []) out.push(e.values ?? [])
      }
      if (out.length !== texts.length || out.some((v) => !v.length)) throw new Error('incomplete embeddings')
      return out
    }
    if (this.working) return tryWith(this.working)
    let last: unknown
    for (const location of this.locations) {
      const ai = new GoogleGenAI({ enterprise: true, project: this.project, location })
      try {
        const out = await tryWith(ai)
        this.working = ai
        return out
      } catch (e) {
        last = e
      }
    }
    throw last instanceof Error ? last : new Error('No embedding model answered.')
  }
}

/** for tests and local runs: word counts hashed into a vector, so shared words make texts similar */
export class FakeEmbedder implements Embedder {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const v = new Array(DIMENSIONS).fill(0)
      for (const w of words(t)) {
        let h = 0
        for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0
        v[h % DIMENSIONS] += 1
      }
      return v
    })
  }
}

const STOP = new Set(['a', 'an', 'the', 'and', 'with', 'of', 'on', 'in', 'for', 'to', 'its', 'at', 'by', 'from', 'two', 'one', 'three'])
export const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))

/** shared words over all words: the fallback when embeddings cannot be had */
export function keywordScore(a: string, b: string): number {
  const A = new Set(words(a))
  const B = new Set(words(b))
  if (!A.size || !B.size) return 0
  let both = 0
  for (const w of A) if (B.has(w)) both++
  return both / (A.size + B.size - both)
}
