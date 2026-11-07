import { useState } from 'react'
import { Activity, ArrowRight } from 'lucide-react'
import { api } from '../api/client'
import { Drawer, Empty, ErrorState, Loading, PageHeader, Panel, StatusBadge, formatDate } from '../components/UI'
import { useResource } from '../hooks/useResource'
import type { Run, Source } from '../types'

function RunDetail({ run, sources, onClose }: { run: Run; sources: Source[]; onClose: () => void }) {
  const logs = useResource((signal) => api.runLogs(run.id, signal), [run.id])
  const counts = [['Fetched', run.fetched_count], ['Extracted', run.extracted_count], ['Created', run.created_count], ['Updated', run.updated_count], ['Unchanged', run.unchanged_count], ['Errors', run.error_count]]
  return <Drawer title={`Run #${run.id}`} kicker="EXECUTION DETAIL" onClose={onClose}>
    <div className="run-detail-top"><StatusBadge status={run.status} /><strong>{sources.find((source) => source.id === run.source_id)?.name || `Source #${run.source_id}`}</strong><span>{formatDate(run.started_at)}</span></div>
    <div className="detail-block"><span className="eyebrow">RESULTS</span><div className="detail-counts">{counts.map(([label, count]) => <div key={label}><span>{label}</span><strong>{count}</strong></div>)}</div><dl className="detail-list"><div><dt>Started</dt><dd>{formatDate(run.started_at)}</dd></div><div><dt>Finished</dt><dd>{formatDate(run.finished_at)}</dd></div></dl></div>
    <div className="detail-block"><div className="detail-section-head"><div><span className="eyebrow">EXECUTION LOG</span><h3>Stage events</h3></div><span className="count-chip">{logs.data?.length ?? 0}</span></div>{logs.loading && <Loading label="Loading logs" />}{logs.error && <ErrorState message={logs.error} />}{logs.data && !logs.data.length && <Empty title="No logs recorded" detail="This run has no stage events." />}{logs.data?.map((log) => <div className={`log-entry log-${log.level}`} key={log.id}><div><strong>{log.stage}</strong><time>{formatDate(log.timestamp)}</time></div><p>{log.message}</p></div>)}</div>
  </Drawer>
}

export default function Runs({ runs, sources, onRefresh }: { runs: Run[]; sources: Source[]; onRefresh: () => void }) {
  const [selected, setSelected] = useState<Run | null>(null)
  const [filter, setFilter] = useState('all')
  const visible = filter === 'all' ? runs : runs.filter((run) => run.status === filter)
  return <>
    <PageHeader eyebrow="WORKSPACE / EXECUTIONS" title="Execution history" description="Every run, its outcome, and the events that explain it." action={<button className="button" onClick={onRefresh}>Refresh history</button>} />
    <Panel title="All runs" subtitle={`${runs.length} executions recorded`} action={<select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option><option value="running">Running</option></select>}>
      {!visible.length ? <Empty title="No executions to show" detail="Run a source or choose another status filter." /> : <div className="table-scroll"><table className="runs-table"><thead><tr><th>Run</th><th>Source</th><th>Status</th><th>Started</th><th>Extracted</th><th>Created</th><th>Updated</th><th>Errors</th><th className="align-right">Details</th></tr></thead><tbody>{visible.map((run) => <tr key={run.id}><td><div className="run-id"><Activity size={16} />#{run.id}</div></td><td>{sources.find((source) => source.id === run.source_id)?.name || `Source #${run.source_id}`}</td><td><StatusBadge status={run.status} /></td><td>{formatDate(run.started_at)}</td><td>{run.extracted_count}</td><td>{run.created_count}</td><td>{run.updated_count}</td><td>{run.error_count}</td><td className="align-right"><button className="text-button" onClick={() => setSelected(run)}>Inspect <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div>}
    </Panel>
    {selected && <RunDetail run={selected} sources={sources} onClose={() => setSelected(null)} />}
  </>
}

