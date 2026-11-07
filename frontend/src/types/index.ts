export type SourceKind = 'html' | 'json'
export type SourceConfig = {
  kind: SourceKind
  item_selector?: string
  items_path?: string
  fields: Record<string, { selector: string; attribute: string } | string>
  allow_empty?: boolean
}
export type SourceInput = { name: string; kind: SourceKind; url: string; config: SourceConfig; enabled: boolean }
export type Source = SourceInput & { id: number; created_at: string; updated_at: string }
export type RunStatus = 'running' | 'succeeded' | 'failed'
export type Run = {
  id: number; source_id: number; status: RunStatus; started_at: string; finished_at: string | null
  fetched_count: number; extracted_count: number; created_count: number; updated_count: number
  unchanged_count: number; error_count: number
}
export type RunLog = { id: number; timestamp: string; stage: string; level: string; message: string }
export type RecordItem = {
  id: number; source_id: number; external_id: string | null; title: string; url: string
  current_version_id: number | null; first_seen_at: string; last_seen_at: string
}
export type RecordVersion = {
  id: number; record_id: number; content_hash: string; payload: Record<string, unknown>
  captured_at: string; run_id: number
}
export type Page<T> = { items: T[]; total: number; limit: number; offset: number }
export type Stats = { sources: number; records: number; versions: number; runs: number; recent_runs: Run[] }

