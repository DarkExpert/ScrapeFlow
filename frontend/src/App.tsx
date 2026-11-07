import { useState } from 'react'
import { Activity, Database, LayoutDashboard, Layers3, Menu, Plus, RefreshCw, X } from 'lucide-react'
import { api, allPages } from './api/client'
import { ErrorState, Loading } from './components/UI'
import { useResource } from './hooks/useResource'
import Overview from './pages/Overview'
import Sources from './pages/Sources'
import Records from './pages/Records'
import Runs from './pages/Runs'
import type { Run, Source, Stats } from './types'

type Page = 'overview' | 'sources' | 'records' | 'runs'
type Shared = { sources: Source[]; runs: Run[]; stats: Stats }

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'sources', label: 'Sources', icon: Layers3 },
  { id: 'records', label: 'Records', icon: Database },
  { id: 'runs', label: 'Executions', icon: Activity },
] as const

export default function App() {
  const [page, setPage] = useState<Page>('overview')
  const [revision, setRevision] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const refresh = () => setRevision((value) => value + 1)
  const shared = useResource<Shared>(async (signal) => {
    const [sources, runs, stats] = await Promise.all([
      allPages(api.sources, signal), allPages(api.runs, signal), api.stats(signal),
    ])
    return { sources, runs, stats }
  }, [revision])

  const navigate = (next: Page) => { setPage(next); setMobileOpen(false) }
  const engineState = shared.error ? 'unavailable' : shared.loading && !shared.data ? 'connecting' : 'ready'

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Layers3 size={20} strokeWidth={2.4} /></div><div><strong>ScrapeFlow</strong><span>OPERATIONS</span></div><button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'nav-active' : ''}`} onClick={() => navigate(id)}><Icon size={18} strokeWidth={1.8} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="engine-card"><div className="engine-line"><span className={`live-dot ${engineState === 'unavailable' ? 'offline-dot' : ''}`} />LOCAL ENGINE</div><strong>{engineState === 'unavailable' ? 'API unavailable' : engineState === 'connecting' ? 'Connecting…' : 'Ready to collect'}</strong><p>{engineState === 'unavailable' ? 'Start FastAPI and refresh the dashboard.' : 'Sources run on demand. Data stays in your local SQLite database.'}</p></div><div className="sidebar-footer">ScrapeFlow <span>v0.1</span></div></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <div className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={20} /></button><span className="breadcrumb">Workspace</span><span className="breadcrumb-slash">/</span><strong>{navigation.find((item) => item.id === page)?.label}</strong></div><div className="topbar-right"><span className="connection"><span className={`live-dot ${shared.error ? 'offline-dot' : ''}`} />{engineState === 'unavailable' ? 'API unavailable' : engineState === 'connecting' ? 'Connecting' : 'Local API'}</span><button className="icon-button" title="Refresh data" aria-label="Refresh data" onClick={refresh}><RefreshCw size={17} /></button><button className="button button-primary top-new" disabled={engineState === 'unavailable'} onClick={() => { setCreateOpen(true); setPage('sources') }}><Plus size={16} /> New source</button></div></header>
      <main className="content">
        {shared.error && <ErrorState message={shared.error} retry={refresh} />}
        {shared.error ? null : shared.loading && !shared.data ? <Loading /> : shared.data && <>
          {page === 'overview' && <Overview {...shared.data} onNavigate={navigate} onRefresh={refresh} />}
          {page === 'sources' && <Sources sources={shared.data.sources} runs={shared.data.runs} onRefresh={refresh} createOpen={createOpen} setCreateOpen={setCreateOpen} />}
          {page === 'records' && <Records sources={shared.data.sources} revision={revision} onRefresh={refresh} />}
          {page === 'runs' && <Runs runs={shared.data.runs} sources={shared.data.sources} onRefresh={refresh} />}
        </>}
      </main>
    </div>
  </div>
}
