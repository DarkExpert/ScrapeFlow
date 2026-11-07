import { useState } from 'react'
import { ArrowUpRight, Braces, FileCode2, Play, Plus, Power, Settings2 } from 'lucide-react'
import { api } from '../api/client'
import { Drawer, Empty, ErrorState, PageHeader, Panel, StatusBadge, timeAgo } from '../components/UI'
import type { Run, Source, SourceConfig, SourceInput, SourceKind } from '../types'
import quotesPreset from '../../../examples/quotes.json'
import photosPreset from '../../../examples/photos.json'

const presets = [quotesPreset, photosPreset] as unknown as SourceInput[]
const initialConfig = (kind: SourceKind): SourceConfig => kind === 'html'
  ? { kind: 'html', item_selector: 'article', fields: { title: { selector: 'h2', attribute: 'text' }, url: { selector: 'a', attribute: 'href' } } }
  : { kind: 'json', items_path: 'data.items', fields: { title: 'title', url: 'url' } }

function SourceEditor({ source, onClose, onSaved }: { source?: Source; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(source?.name || '')
  const [kind, setKind] = useState<SourceKind>(source?.kind || 'html')
  const [url, setUrl] = useState(source?.url || '')
  const [enabled, setEnabled] = useState(source?.enabled ?? true)
  const [config, setConfig] = useState(JSON.stringify(source?.config || initialConfig(kind), null, 2))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const changeKind = (next: SourceKind) => { setKind(next); setConfig(JSON.stringify(initialConfig(next), null, 2)) }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    let parsed: SourceConfig
    try { parsed = JSON.parse(config) as SourceConfig } catch { setError('Configuration must be valid JSON.'); return }
    if (parsed.kind !== kind || typeof parsed.fields !== 'object' || !parsed.fields) { setError(`Configuration kind must be "${kind}" and include fields.`); return }
    setSaving(true)
    try {
      const payload = { name: name.trim(), kind, url: url.trim(), enabled, config: parsed }
      if (source) await api.updateSource(source.id, payload)
      else await api.createSource(payload)
      onSaved()
      onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save source.') }
    finally { setSaving(false) }
  }

  return <Drawer title={source ? 'Edit source' : 'Add a source'} kicker="SOURCE CONFIGURATION" onClose={onClose}><form onSubmit={save} className="editor-form"><p className="form-intro">Configure where ScrapeFlow collects records. Saving a source does not start a run.</p>
    <label>Source name<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Product catalog" /></label>
    <div className="form-row"><label>Source type<select value={kind} onChange={(event) => changeKind(event.target.value as SourceKind)}><option value="html">HTML page</option><option value="json">JSON API</option></select></label><label>State<select value={enabled ? 'enabled' : 'paused'} onChange={(event) => setEnabled(event.target.value === 'enabled')}><option value="enabled">Enabled</option><option value="paused">Paused</option></select></label></div>
    <label>Public URL<input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/data" /><span className="input-help">HTTP(S) only. Internal network destinations and redirects are blocked.</span></label>
    <label>Extraction configuration <textarea spellCheck={false} rows={13} value={config} onChange={(event) => setConfig(event.target.value)} /><span className="input-help">{kind === 'html' ? 'Use item_selector and CSS selectors for title and URL fields.' : 'Use items_path (or $ for a top-level array) and object paths for title and URL.'} Add external_id when available.</span></label>
    {error && <ErrorState message={error} />}
    <div className="form-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button disabled={saving} className="button button-primary" type="submit">{saving ? 'Saving…' : source ? 'Save changes' : 'Create source'}</button></div>
  </form></Drawer>
}

export default function Sources({ sources, runs, onRefresh, createOpen, setCreateOpen }: { sources: Source[]; runs: Run[]; onRefresh: () => void; createOpen: boolean; setCreateOpen: (open: boolean) => void }) {
  const [editing, setEditing] = useState<Source | null>(null)
  const [busy, setBusy] = useState<number | string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const latest = new Map<number, Run>()
  runs.forEach((run) => { if (!latest.has(run.source_id)) latest.set(run.source_id, run) })

  const perform = async (key: number | string, action: () => Promise<void>) => {
    setBusy(key); setError(''); setNotice('')
    try { await action(); onRefresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Action failed.') }
    finally { setBusy(null) }
  }
  const addPreset = (preset: SourceInput) => perform(preset.name, async () => {
    await api.createSource(preset)
    setNotice(`${preset.name} added. Run it when you are ready.`)
  })
  const run = (source: Source) => perform(source.id, async () => {
    const result = await api.runSource(source.id)
    if (result.status === 'failed') {
      const logs = await api.runLogs(result.id)
      setError(`${source.name}: run #${result.id} failed. ${logs.find((entry) => entry.level === 'error')?.message || 'Open Execution history for details.'}`)
    } else {
      setNotice(`${source.name}: run #${result.id} ${result.status}. ${result.created_count} new, ${result.updated_count} updated.`)
    }
  })
  const toggle = (source: Source) => perform(`toggle-${source.id}`, async () => { await api.updateSource(source.id, { enabled: !source.enabled }) })

  return <>
    <PageHeader eyebrow="WORKSPACE / SOURCES" title="Collection sources" description="Configure public pages and APIs, then run them when you want fresh data." action={<button className="button button-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Add source</button>} />
    {error && <ErrorState message={error} />}{notice && <div className="success-note">{notice}</div>}
    <div className="preset-strip"><div><span className="eyebrow">QUICK START</span><strong>Start with an example</strong><p>Register a real public source. You decide when to run it.</p></div><div className="preset-actions">{presets.map((preset) => <button key={preset.name} className="button" disabled={busy !== null || sources.some((source) => source.name === preset.name)} onClick={() => addPreset(preset)}>{preset.kind === 'html' ? <FileCode2 size={16} /> : <Braces size={16} />}{sources.some((source) => source.name === preset.name) ? 'Added' : `Add ${preset.kind === 'html' ? 'Quotes' : 'Photos'}`}</button>)}</div></div>
    <Panel title="All sources" subtitle={`${sources.length} configured · ${sources.filter((source) => source.enabled).length} enabled`}>
      {sources.length === 0 ? <Empty title="No sources yet" detail="Create your first source or add a bundled example above." action={<button className="button button-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Add source</button>} /> : <div className="table-scroll"><table><thead><tr><th>Source</th><th>Type</th><th>Last execution</th><th>Status</th><th title="Items extracted in the most recent run; this is not a persisted record total.">Last extracted</th><th className="align-right">Actions</th></tr></thead><tbody>{sources.map((source) => { const last = latest.get(source.id); return <tr key={source.id}><td><div className="table-primary"><div className="source-glyph">{source.kind === 'html' ? 'H' : 'J'}</div><div><strong>{source.name}</strong><a href={source.url} target="_blank" rel="noreferrer" className="table-subline">{source.url}<ArrowUpRight size={12} /></a></div></div></td><td><span className="type-pill">{source.kind.toUpperCase()}</span></td><td>{last ? timeAgo(last.started_at) : 'Never'}</td><td><StatusBadge status={!source.enabled ? 'paused' : last?.status || 'unknown'} /></td><td>{last?.extracted_count ?? '—'}</td><td><div className="row-actions"><button className="button button-small button-run" disabled={!source.enabled || busy !== null} onClick={() => run(source)}><Play size={14} fill="currentColor" />{busy === source.id ? 'Running…' : 'Run'}</button><button className="icon-button" title="Edit source" aria-label={`Edit ${source.name}`} onClick={() => setEditing(source)}><Settings2 size={16} /></button><button className="icon-button" title={source.enabled ? 'Pause source' : 'Enable source'} aria-label={`${source.enabled ? 'Pause' : 'Enable'} ${source.name}`} disabled={busy !== null} onClick={() => toggle(source)}><Power size={16} /></button></div></td></tr> })}</tbody></table></div>}
    </Panel>
    {(createOpen || editing) && <SourceEditor key={editing?.id || 'new'} source={editing || undefined} onClose={() => { setCreateOpen(false); setEditing(null) }} onSaved={onRefresh} />}
  </>
}

