import { Fragment, type ReactNode } from 'react'
import { Tex } from './Tex'
import { AnswerChart, readAnswerChart } from '@/note3d/AnswerChart'

/**
 * Light Markdown + KaTeX for generated text (the tutor's answers): paragraphs, headings,
 * bullet and numbered lists, **bold**, *italic*, `code`, $inline$ and $$display$$ maths.
 * Tolerates half-finished input, since answers render while they stream.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: Inline[] }
  | { t: 'em'; v: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'math'; v: string; display: boolean }

export type Block =
  | { t: 'p'; v: Inline[] }
  | { t: 'h'; level: number; v: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][]; start?: number }
  | { t: 'math'; v: string }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  /** a ```chart block: JSON for a graph or a bar chart (see note3d/AnswerChart) */
  | { t: 'chart'; json: string }

/** Split text into inline tokens. Unclosed markers are kept as plain text. */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = () => {
    if (buf) out.push({ t: 'text', v: buf })
    buf = ''
  }
  let i = 0
  while (i < s.length) {
    const rest = s.slice(i)
    if (rest.startsWith('$$')) {
      const end = s.indexOf('$$', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ t: 'math', v: s.slice(i + 2, end).trim(), display: true })
        i = end + 2
        continue
      }
    } else if (s[i] === '$' && s[i + 1] !== ' ') {
      const end = s.indexOf('$', i + 1)
      if (end > i + 1 && s[end - 1] !== ' ') {
        flush()
        out.push({ t: 'math', v: s.slice(i + 1, end), display: false })
        i = end + 1
        continue
      }
    } else if (rest.startsWith('**')) {
      const end = s.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ t: 'bold', v: parseInline(s.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    } else if (s[i] === '`') {
      const end = s.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ t: 'code', v: s.slice(i + 1, end) })
        i = end + 1
        continue
      }
    } else if ((s[i] === '*' || s[i] === '_') && s[i + 1] !== ' ' && s[i + 1] !== s[i]) {
      const end = s.indexOf(s[i], i + 1)
      if (end > i + 1 && s[end - 1] !== ' ' && (s[i] === '*' || !/\w/.test(s[end + 1] ?? ''))) {
        flush()
        out.push({ t: 'em', v: parseInline(s.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }
    buf += s[i]
    i++
  }
  flush()
  return out
}

const BULLET = /^\s*[*-]\s+(.*)$/
const NUMBER = /^\s*\d+[.)]\s+(.*)$/

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const endPara = () => {
    if (para.length) blocks.push({ t: 'p', v: parseInline(para.join(' ')) })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      endPara()
      continue
    }
    // an indented line right after a list item continues that item (including its maths)
    const prevBlock = blocks[blocks.length - 1]
    if (!para.length && prevBlock && (prevBlock.t === 'ul' || prevBlock.t === 'ol') && /^\s{2,}/.test(line) && !BULLET.test(line) && !NUMBER.test(line)) {
      const item = prevBlock.items[prevBlock.items.length - 1]
      item.push({ t: 'text', v: ' ' }, ...parseInline(trimmed))
      continue
    }
    // display maths on its own line(s)
    if (trimmed.startsWith('$$')) {
      if (trimmed.length > 4 && trimmed.indexOf('$$', 2) === trimmed.length - 2) {
        endPara()
        blocks.push({ t: 'math', v: trimmed.slice(2, -2).trim() })
        continue
      }
      const body: string[] = [trimmed.slice(2)]
      let j = i + 1
      while (j < lines.length && !lines[j].includes('$$')) body.push(lines[j++])
      if (j < lines.length) {
        body.push(lines[j].slice(0, lines[j].indexOf('$$')))
        endPara()
        blocks.push({ t: 'math', v: body.join('\n').trim() })
        i = j
        continue
      }
      // unclosed (still streaming): show as text for now
    }
    // a graph or chart: ```chart, its JSON, then ``` (while still streaming, nothing is shown yet)
    if (/^```\s*chart\b/i.test(trimmed)) {
      const body: string[] = []
      let j = i + 1
      while (j < lines.length && !lines[j].trim().startsWith('```')) body.push(lines[j++])
      endPara()
      if (j < lines.length) blocks.push({ t: 'chart', json: body.join('\n') })
      i = j
      continue
    }
    // a Markdown table: a header row, a |---| row, then rows (a transportation tableau, a cost matrix)
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => parseInline(c.trim()))
      const head = cells(trimmed)
      const rows: Inline[][][] = []
      let j = i + 2
      while (j < lines.length && lines[j].trim().startsWith('|')) rows.push(cells(lines[j++]))
      endPara()
      blocks.push({ t: 'table', head, rows })
      i = j - 1
      continue
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (h) {
      endPara()
      blocks.push({ t: 'h', level: h[1].length, v: parseInline(h[2]) })
      continue
    }
    const b = BULLET.exec(line)
    const n = NUMBER.exec(line)
    if (b || n) {
      endPara()
      const kind = b ? 'ul' : 'ol'
      const last = blocks[blocks.length - 1]
      const item = parseInline((b ?? n)![1])
      if (last && last.t === kind) last.items.push(item)
      // a numbered list keeps the number written, so steps split by a displayed equation go 1, 2, 3, 4
      else blocks.push({ t: kind, items: [item], ...(n ? { start: Number(/\d+/.exec(line)![0]) } : {}) })
      continue
    }
    para.push(trimmed)
  }
  endPara()
  return blocks
}

/**
 * A short label with maths in it, inline (a calculation's name, a "find" item, a readout): `$…$` drawn as maths,
 * and a label written entirely in bare LaTeX ("\sigma_{max}") taken as maths too.
 */
export function RichInline({ text }: { text: string }) {
  const t = toDollars(text)
  const bare = !t.includes('$') && /\\[a-zA-Z]+|[_^]\{/.test(t)
  return <Inlines items={parseInline(bare ? `$${t}$` : t)} />
}

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) => {
        switch (x.t) {
          case 'text':
            return <Fragment key={i}>{x.v}</Fragment>
          case 'bold':
            return (
              <strong key={i} className="font-semibold text-ink">
                <Inlines items={x.v} />
              </strong>
            )
          case 'em':
            return (
              <em key={i}>
                <Inlines items={x.v} />
              </em>
            )
          case 'code':
            return (
              <code key={i} className="rounded bg-panel-3 px-1 font-mono text-[0.92em]">
                {x.v}
              </code>
            )
          case 'math':
            return x.display ? (
              <span key={i} className="my-1 block overflow-x-auto overflow-y-hidden py-0.5">
                <Tex tex={x.v} display />
              </span>
            ) : (
              <Tex key={i} tex={x.v} />
            )
        }
      })}
    </>
  )
}

/** LaTeX's own delimiters, as Gemini sometimes writes them: \[ … \] for a displayed equation, \( … \) inline */
export const toDollars = (t: string) =>
  t.replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `\n$$${m.trim()}$$\n`).replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${m.trim()}$`)

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = parseBlocks(toDollars(text))
  const out: ReactNode[] = blocks.map((b, i) => {
    switch (b.t) {
      case 'p':
        return (
          <p key={i}>
            <Inlines items={b.v} />
          </p>
        )
      case 'h':
        return (
          <p key={i} className="font-semibold text-ink">
            <Inlines items={b.v} />
          </p>
        )
      case 'math':
        return (
          <div key={i} className="overflow-x-auto">
            <Tex tex={b.v} display />
          </div>
        )
      case 'chart': {
        const spec = readAnswerChart(b.json)
        return spec ? <AnswerChart key={i} spec={spec} /> : null
      }
      case 'table':
        return (
          <div key={i} className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-[12.5px] tabular-nums">
              <thead className="bg-panel-2">
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j} className="border-b border-line px-2.5 py-1.5 text-left font-semibold text-ink">
                      <Inlines items={c} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, k) => (
                  <tr key={k} className="border-b border-line/60 last:border-0">
                    {r.map((c, j) => (
                      <td key={j} className={`px-2.5 py-1.5 ${j === 0 ? 'font-medium text-ink' : 'text-ink/85'}`}>
                        <Inlines items={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case 'ul':
      case 'ol': {
        const L = b.t === 'ul' ? 'ul' : 'ol'
        return (
          <L key={i} start={b.t === 'ol' && b.start && b.start > 1 ? b.start : undefined} className={`space-y-1 pl-5 ${b.t === 'ul' ? 'list-disc' : 'list-decimal'}`}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Inlines items={it} />
              </li>
            ))}
          </L>
        )
      }
    }
  })
  return <div className={`space-y-2 ${className}`}>{out}</div>
}
