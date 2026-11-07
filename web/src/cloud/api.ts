import { useAuth } from './auth'
import { appCheckToken } from './appCheck'
import { API_URL } from './config'

/** An error the API answered with; `message` is written for the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

async function headers(json: boolean): Promise<Record<string, string>> {
  const h: Record<string, string> = {}
  if (json) h['Content-Type'] = 'application/json'
  const [token, check] = await Promise.all([useAuth.getState().token(), appCheckToken()])
  if (token) h.Authorization = `Bearer ${token}`
  if (check) h['X-Firebase-AppCheck'] = check
  return h
}

async function request(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}) {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: await headers(init.body !== undefined),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('Can’t reach Solidify’s servers. Check your connection and try again.', 0)
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg
    } catch {
      /* not JSON */
    }
    throw new ApiError(msg, res.status)
  }
  return res
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await request(path, init)
  return (res.status === 204 ? undefined : await res.json()) as T
}

/** Download a file the API returns (e.g. the class results CSV). */
export async function download(path: string, fallbackName: string) {
  const res = await request(path)
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface SseEvent {
  event: string
  data: string
}

/**
 * Incremental Server-Sent Events parser: feed it text as it arrives, get back the complete
 * events so far. Handles events split across chunks and CRLF line endings.
 */
export function sseParser() {
  let buf = ''
  return (chunk: string): SseEvent[] => {
    buf += chunk.replace(/\r\n/g, '\n')
    const out: SseEvent[] = []
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      let event = 'message'
      const data: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (data.length) out.push({ event, data: data.join('\n') })
    }
    return out
  }
}

/** POST and read the streamed reply as SSE events. */
export async function* stream(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const res = await request(path, { body, signal })
  if (!res.body) return
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  const parse = sseParser()
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    for (const ev of parse(value)) yield ev
  }
}
