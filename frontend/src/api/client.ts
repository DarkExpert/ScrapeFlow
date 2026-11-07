import type { Page, RecordItem, RecordVersion, Run, RunLog, Source, SourceInput, Stats } from '../types'

const BASE = '/api/v1'

export class ApiError extends Error {
  constructor(message: string, public status?: number) { super(message) }
}

function messageFor(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => {
    const issue = item as { loc?: (string | number)[]; msg?: string }
    return `${issue.loc?.filter((part) => part !== 'body').join('.') || 'Input'}: ${issue.msg || 'Invalid value'}`
  }).join('; ')
  return 'The request could not be completed.'
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('Cannot connect to the ScrapeFlow API. Start FastAPI and try again.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: unknown } | null
    const message = body?.detail === undefined && response.status >= 500
      ? 'Cannot connect to the ScrapeFlow API. Start FastAPI and try again.'
      : messageFor(body?.detail)
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const params = (values: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)) })
  return `?${query.toString()}`
}

export const api = {
  stats: (signal?: AbortSignal) => request<Stats>('/stats', { signal }),
  sources: (offset = 0, signal?: AbortSignal) => request<Page<Source>>(`/sources${params({ limit: 100, offset })}`, { signal }),
  source: (id: number, signal?: AbortSignal) => request<Source>(`/sources/${id}`, { signal }),
  createSource: (body: SourceInput) => request<Source>('/sources', { method: 'POST', body: JSON.stringify(body) }),
  updateSource: (id: number, body: Partial<SourceInput>) => request<Source>(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  runSource: (id: number) => request<Run>(`/sources/${id}/runs`, { method: 'POST' }),
  runs: (offset = 0, signal?: AbortSignal) => request<Page<Run>>(`/runs${params({ limit: 50, offset })}`, { signal }),
  run: (id: number, signal?: AbortSignal) => request<Run>(`/runs/${id}`, { signal }),
  runLogs: (id: number, signal?: AbortSignal) => request<RunLog[]>(`/runs/${id}/logs`, { signal }),
  records: (offset = 0, sourceId?: number, signal?: AbortSignal) => request<Page<RecordItem>>(`/records${params({ limit: 50, offset, source_id: sourceId })}`, { signal }),
  record: (id: number, signal?: AbortSignal) => request<RecordItem>(`/records/${id}`, { signal }),
  versions: (id: number, signal?: AbortSignal) => request<RecordVersion[]>(`/records/${id}/versions`, { signal }),
}

export async function allPages<T>(load: (offset: number, signal?: AbortSignal) => Promise<Page<T>>, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = []
  let offset = 0
  while (true) {
    const page = await load(offset, signal)
    items.push(...page.items)
    offset += page.items.length
    if (!page.items.length || offset >= page.total) return items
  }
}

