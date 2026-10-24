import { Fragment, type ReactNode } from 'react'
import { Tex } from './Tex'

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
  | { t: 'ul' | 'ol'; items: Inline[][] }
  | { t: 'math'; v: string }

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
      else blocks.push({ t: kind, items: [item] })
      continue
    }
    para.push(trimmed)
  }
  endPara()
  return blocks
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
              <span key={i} className="my-1 block overflow-x-auto">
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

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = parseBlocks(text)
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
      case 'ul':
      case 'ol': {
        const L = b.t === 'ul' ? 'ul' : 'ol'
        return (
          <L key={i} className={`space-y-1 pl-5 ${b.t === 'ul' ? 'list-disc' : 'list-decimal'}`}>
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
