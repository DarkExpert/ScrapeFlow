import { Activity, ArrowRight, Database, Layers3, RefreshCw, ScanSearch } from 'lucide-react'
import { Empty, PageHeader, Panel, StatusBadge, timeAgo } from '../components/UI'
import type { Run, Source, Stats } from '../types'

type Page = 'overview' | 'sources' | 'records' | 'runs'

export default function Overview({ sources, runs, stats, onNavigate, onRefresh }: { sources: Source[]; runs: Run[]; stats: Stats; onNavigate: (page: Page) => void; onRefresh: () => void }) {
  const latest = new Map<number, Run>()
  runs.forEach((run) => { if (!latest.has(run.source_id)) latest.set(run.source_id, run) })
  const healthy = sources.filter((source) => source.enabled && latest.get(source.id)?.status === 'succeeded').length
  const attention = sources.filter((source) => source.enabled && latest.get(source.id)?.status === 'failed').length
  const cards = [
    { label: 'Total sources', value: stats.sources, icon: Layers3, detail: `${sources.filter((source) => source.enabled).length} enabled` },
    { label: 'Collected records', value: stats.records, icon: Database, detail: 'Across all sources' },
    { label: 'Executions', value: stats.runs, icon: Activity, detail: `${runs.filter((run) => run.status === 'failed').length} failed` },
    { label: 'Record versions', value: stats.versions, icon: ScanSearch, detail: `${Math.max(0, stats.versions - stats.records)} detected changes` },
  ]

  return <>
    <PageHeader eyebrow="OPERATIONS / OVERVIEW" title="Your data, in motion." description="Monitor collection health and see what changed across every source." action={<button className="button" onClick={onRefresh}><RefreshCw size={15} /> Refresh overview</button>} />
    <div className="kpi-grid">{cards.map(({ label, value, icon: Icon, detail }) => <div className="kpi-card" key={label}><div className="kpi-head"><span>{label}</span><Icon size={18} /></div><strong>{value.toLocaleString()}</strong><div className="kpi-detail">{detail}</div></div>)}</div>
    <div className="overview-grid">
      <Panel title="Recent executions" subtitle="Latest activity across your workspace" action={<button className="text-button" onClick={() => onNavigate('runs')}>View all <ArrowRight size={15} /></button>}>
        {stats.recent_runs.length === 0 ? <Empty title="No executions yet" detail="Add a source and run it to start collecting data." action={<button className="button button-primary" onClick={() => onNavigate('sources')}>Explore sources</button>} /> : <div className="recent-list">{stats.recent_runs.map((run) => <button className="recent-row" key={run.id} onClick={() => onNavigate('runs')}><div className={`run-icon run-icon-${run.status}`}><Activity size={17} /></div><div className="recent-main"><strong>{sources.find((source) => source.id === run.source_id)?.name || `Source #${run.source_id}`}</strong><span>Run #{run.id} · {run.created_count} new · {run.updated_count} updated</span></div><div className="recent-side"><StatusBadge status={run.status} /><small>{timeAgo(run.started_at)}</small></div></button>)}</div>}
      </Panel>
      <Panel title="Source health" subtitle="Latest result for each configured source" action={<button className="text-button" onClick={() => onNavigate('sources')}>Manage <ArrowRight size={15} /></button>}>
        <div className="health-summary"><div><strong>{healthy}</strong><span>Healthy</span></div><div><strong>{attention}</strong><span>Needs attention</span></div><div><strong>{sources.filter((source) => !source.enabled).length}</strong><span>Paused</span></div></div>
        {sources.length === 0 ? <Empty title="No sources configured" detail="Create a source or load one of the included examples." /> : <div className="health-list">{sources.slice(0, 5).map((source) => <div className="health-row" key={source.id}><div className="source-glyph">{source.kind === 'html' ? 'H' : 'J'}</div><div><strong>{source.name}</strong><span>{source.kind.toUpperCase()} · {timeAgo(latest.get(source.id)?.started_at)}</span></div><StatusBadge status={!source.enabled ? 'paused' : latest.get(source.id)?.status || 'unknown'} /></div>)}</div>}
      </Panel>
    </div>
    <div className="footnote">All figures reflect the connected FastAPI database. Data refreshes after every source action.</div>
  </>
}

