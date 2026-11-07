import { useMemo, useState } from 'react'
import { Database, Search } from 'lucide-react'
import { api } from '../api/client'
import { Drawer, Empty, ErrorState, ExternalLink, Loading, PageHeader, Pagination, Panel, formatDate } from '../components/UI'
import { useResource } from '../hooks/useResource'
import type { RecordItem, Source } from '../types'

function RecordDetail({ record, sources, onClose }: { record: RecordItem; sources: Source[]; onClose: () => void }) {
  const versions = useResource((signal) => api.versions(record.id, signal), [record.id])
  const [expanded, setExpanded] = useState<number | null>(null)
  return <Drawer title={record.title} kicker={`RECORD #${record.id}`} onClose={onClose}>
    <div className="detail-block"><span className="eyebrow">CURRENT RECORD</span><dl className="detail-list"><div><dt>Source</dt><dd>{sources.find((source) => source.id === record.source_id)?.name || `Source #${record.source_id}`}</dd></div><div><dt>External ID</dt><dd>{record.external_id || 'URL identity'}</dd></div><div><dt>First seen</dt><dd>{formatDate(record.first_seen_at)}</dd></div><div><dt>Last seen</dt><dd>{formatDate(record.last_seen_at)}</dd></div><div><dt>Record URL</dt><dd><ExternalLink href={record.url}>{record.url}</ExternalLink></dd></div></dl></div>
    <div className="detail-block"><div className="detail-section-head"><div><span className="eyebrow">CHANGE HISTORY</span><h3>Record versions</h3></div><span className="count-chip">{versions.data?.length ?? 0}</span></div>
      {versions.loading && <Loading label="Loading versions" />}{versions.error && <ErrorState message={versions.error} />}
      {versions.data?.map((version, index) => <div className="version-card" key={version.id}><button className="version-head" onClick={() => setExpanded(expanded === version.id ? null : version.id)}><div className="timeline-dot" /><div><strong>Version {versions.data!.length - index}</strong><span>{formatDate(version.captured_at)} · Run #{version.run_id}</span></div><span className="version-action">{expanded === version.id ? 'Hide payload' : 'View payload'}</span></button>{expanded === version.id && <pre>{JSON.stringify(version.payload, null, 2)}</pre>}</div>)}
    </div>
  </Drawer>
}

export default function Records({ sources, revision, onRefresh }: { sources: Source[]; revision: number; onRefresh: () => void }) {
  const [offset, setOffset] = useState(0)
  const [sourceId, setSourceId] = useState<number | undefined>()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<RecordItem | null>(null)
  const records = useResource((signal) => api.records(offset, sourceId, signal), [offset, sourceId, revision])
  const filtered = useMemo(() => (records.data?.items || []).filter((record) => `${record.title} ${record.url} ${record.external_id || ''}`.toLowerCase().includes(search.toLowerCase().trim())), [records.data, search])

  return <>
    <PageHeader eyebrow="WORKSPACE / RECORDS" title="Record explorer" description="Inspect collected data and trace every detected change." action={<button className="button" onClick={onRefresh}>Refresh records</button>} />
    <Panel title="Collected records" subtitle="Search the 50 records on this page. Use the source filter or pagination to explore more." action={<span className="count-chip">{records.data?.total ?? 0} total</span>}>
      <div className="filter-bar"><div className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page…" aria-label="Search records on this page" /></div><select className="filter-select" value={sourceId ?? ''} onChange={(event) => { setSourceId(event.target.value ? Number(event.target.value) : undefined); setOffset(0) }} aria-label="Filter by source"><option value="">All sources</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></div>
      {records.error && <ErrorState message={records.error} retry={onRefresh} />}
      {records.loading ? <Loading label="Loading records" /> : !filtered.length ? <Empty title={search ? 'No matching records' : 'No records collected'} detail={search ? 'Try a different search on this page or change the source filter.' : 'Run a source to collect your first records.'} /> : <div className="table-scroll"><table><thead><tr><th>Record</th><th>Source</th><th>External ID</th><th>First seen</th><th>Last seen</th><th className="align-right">Details</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td><div className="record-title"><div className="record-glyph"><Database size={16} /></div><div><strong>{record.title}</strong><span>{record.url}</span></div></div></td><td>{sources.find((source) => source.id === record.source_id)?.name || `Source #${record.source_id}`}</td><td><span className="mono-cell record-external-id" title={record.external_id || undefined}>{record.external_id || '—'}</span></td><td>{formatDate(record.first_seen_at)}</td><td>{formatDate(record.last_seen_at)}</td><td className="align-right"><button className="text-button" onClick={() => setSelected(record)}>View history</button></td></tr>)}</tbody></table></div>}
      <Pagination offset={offset} limit={records.data?.limit || 50} total={records.data?.total || 0} onPage={setOffset} />
    </Panel>
    {selected && <RecordDetail record={selected} sources={sources} onClose={() => setSelected(null)} />}
  </>
}
