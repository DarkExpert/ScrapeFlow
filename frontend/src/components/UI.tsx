import type { ReactNode } from 'react'
import { AlertCircle, ArrowUpRight, LoaderCircle, X } from 'lucide-react'
import type { RunStatus } from '../types'

export function StatusBadge({ status }: { status: RunStatus | 'active' | 'paused' | 'unknown' }) {
  const label = status === 'succeeded' ? 'Succeeded' : status === 'failed' ? 'Failed' : status === 'running' ? 'Running' : status === 'active' ? 'Enabled' : status === 'paused' ? 'Paused' : 'No runs'
  return <span className={`status status-${status}`}><span className="status-dot" />{label}</span>
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-action">{action}</div>}</div>
}

export function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

export function Empty({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty"><div className="empty-icon"><AlertCircle size={21} /></div><strong>{title}</strong><p>{detail}</p>{action}</div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-state"><AlertCircle size={20} /><span>{message}</span>{retry && <button className="button button-small" onClick={retry}>Retry</button>}</div>
}

export function Loading({ label = 'Loading data' }: { label?: string }) {
  return <div className="loading"><LoaderCircle size={18} className="spin" />{label}…</div>
}

export function Drawer({ title, kicker, onClose, children }: { title: string; kicker: string; onClose: () => void; children: ReactNode }) {
  return <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="drawer" role="dialog" aria-modal="true" aria-label={title}><div className="drawer-head"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2></div><button className="icon-button" aria-label="Close panel" onClick={onClose}><X size={19} /></button></div><div className="drawer-body">{children}</div></aside></div>
}

export function Pagination({ offset, limit, total, onPage }: { offset: number; limit: number; total: number; onPage: (offset: number) => void }) {
  if (total <= limit) return null
  return <div className="pagination"><span>Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span><div><button className="button button-small" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>Previous</button><button className="button button-small" disabled={offset + limit >= total} onClick={() => onPage(offset + limit)}>Next</button></div></div>
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="external-link" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={14} /></a>
}

export const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—'
export const timeAgo = (value?: string | null) => {
  if (!value) return 'Never'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

