import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoaderCircle, Search, Trash2 } from 'lucide-react'
import { adminMetrics } from '../../../data/mockData'
import { deleteAdminCustomRequest, getAdminCustomRequests } from '../../../services/adminRequestService'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const m = adminMetrics
  const [requests, setRequests] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState('')

  useEffect(() => {
    getAdminCustomRequests().then(setRequests).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  const removeRequest = async request => {
    if (!window.confirm(`Permanently delete "${request.title}"? This cannot be undone.`)) return
    setDeleting(request.id)
    try {
      await deleteAdminCustomRequest(request.id)
      setRequests(items => items.filter(item => item.id !== request.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting('')
    }
  }

  const visibleRequests = requests.filter(request => `${request.title} ${request.traveler_email} ${request.destination_name}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <main className="portal-page admin-layout container">
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>Admin — Executive Dashboard</h1>
      <div className="stat-row" style={{ margin: 'var(--space-6) 0' }}>
        {[{ v: m.gmv, l: 'GMV' }, { v: m.revenue, l: 'Revenue' }, { v: m.travelers, l: 'Travelers' }, { v: m.providers, l: 'Providers' }].map(s => (
          <div key={s.l} className="stat-widget card metric-kpi"><div className="value">{s.v}</div><div className="label">{s.l}</div></div>
        ))}
      </div>
      <div className="portal-card chart gmv-trend" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>GMV Trend Chart — last 90 days</div>
      <div className="portal-card indicator system-health" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
        <span>API p95: {m.apiLatency} ✓</span>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/escrow')}>Escrow Queue: {m.escrowQueue} ✓</span>
        <span style={{ color: 'var(--color-warning)', cursor: 'pointer' }} onClick={() => navigate('/admin/disputes')}>Disputes: {m.disputes} ⚠</span>
      </div>
      <section className="portal-card admin-request-cleanup">
        <div className="admin-request-cleanup-header"><div><p className="settings-eyebrow">Data cleanup</p><h2>Custom requests</h2><span>Permanently remove requests and their provider bids.</span></div><label className="admin-request-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search requests" /></label></div>
        {error && <div className="inline-banner">{error}</div>}
        {loading ? <div className="admin-request-loading"><LoaderCircle className="spinner" /> Loading requests…</div> : visibleRequests.length ? <div className="admin-request-list">{visibleRequests.map(request => <div className="admin-request-row" key={request.id}><div><strong>{request.title}</strong><span>{request.traveler_email} · {request.destination_name}</span><small>{request.status} · {request.proposal_count} proposal{Number(request.proposal_count) === 1 ? '' : 's'} · {request.description || 'No inquiry'}</small></div><button className="btn btn-danger btn-sm" disabled={deleting === request.id} onClick={() => removeRequest(request)}>{deleting === request.id ? <LoaderCircle className="spinner" size={14} /> : <Trash2 size={14} />} Delete</button></div>)}</div> : <p className="admin-request-empty">No custom requests found.</p>}
      </section>
    </main>
  )
}
