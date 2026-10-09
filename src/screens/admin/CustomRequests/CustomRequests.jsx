import { useEffect, useState } from 'react'
import { LoaderCircle, Search, Trash2, X } from 'lucide-react'
import { closeAdminCustomRequest, deleteAdminCustomRequest, getAdminCustomRequests, hideAdminProposal } from '../../../services/adminRequestService'
import ProposalRoom from '../../../components/ProposalRoom/ProposalRoom'
import { getAdminCustomRequestDetail } from '../../../services/adminRequestService'

export default function AdminCustomRequests() {
  const [requests, setRequests] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [roomProposal, setRoomProposal] = useState(null)
  const [room, setRoom] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    getAdminCustomRequests().then(setRequests).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  const removeRequest = async request => {
    if (!window.confirm(`Permanently delete "${request.title}"? This cannot be undone.`)) return
    setDeleting(request.id)
    setError('')
    try {
      await deleteAdminCustomRequest(request.id)
      setRequests(items => items.filter(item => item.id !== request.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting('')
    }
  }

  const visibleRequests = requests.filter(request => (statusFilter === 'all' || request.status === statusFilter) && `${request.title} ${request.traveler_email} ${request.destination_name} ${request.description || ''}`.toLowerCase().includes(query.toLowerCase()))
  const openDetail = request => { setSelected(request); setDetail(null); setDetailLoading(true); getAdminCustomRequestDetail(request.id).then(setDetail).catch(err => setError(err.message)).finally(() => setDetailLoading(false)) }

  return <main className="admin-requests-page">
    <header className="admin-requests-header"><div><p className="settings-eyebrow">Traveler operations</p><h1>Custom request moderation</h1><span>Review traveler inquiries and permanently remove requests when necessary.</span></div><span className="admin-request-count">{requests.length} requests</span></header>
    <section className="portal-card admin-request-cleanup admin-request-page-card">
      <div className="admin-request-cleanup-header"><div><h2>Request queue</h2><span>Review negotiation activity and safety signals before taking action.</span></div><div className="admin-request-filters"><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="accepted">Accepted</option><option value="closed">Closed</option><option value="withdrawn">Withdrawn</option></select><label className="admin-request-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, traveler, destination, or inquiry" /></label></div></div>
      {error && <div className="inline-banner">{error}</div>}
      {loading ? <div className="admin-request-loading"><LoaderCircle className="spinner" /> Loading requests…</div> : visibleRequests.length ? <div className="admin-request-list">{visibleRequests.map(request => <article className="admin-request-row" key={request.id} onClick={() => openDetail(request)}><div><strong>{request.title}</strong><span>{request.traveler_email} · {request.destination_name}</span><small>{request.status} · {request.group_type === 'group' ? 'Small group OK' : 'Private'} · {request.proposal_count} proposal{Number(request.proposal_count) === 1 ? '' : 's'}</small>{request.description && <p className="admin-request-inquiry">{request.description}</p>}</div><button className="btn btn-danger btn-sm" disabled={deleting === request.id} onClick={event => { event.stopPropagation(); removeRequest(request) }}>{deleting === request.id ? <LoaderCircle className="spinner" size={14} /> : <Trash2 size={14} />} Delete permanently</button></article>)}</div> : <p className="admin-request-empty">No custom requests found.</p>}
    </section>
    {selected && <div className="modal-overlay moderation-detail-overlay"><section className="modal admin-request-detail"><header className="modal-header"><div><p className="settings-eyebrow">Moderation review</p><h2>{selected.title}</h2><span>{selected.traveler_email} · {selected.destination_name}</span></div><div className="admin-detail-actions"><button className="btn btn-outline btn-sm" onClick={async () => { await closeAdminCustomRequest(selected.id); setSelected(null); setRequests(items => items.map(item => item.id === selected.id ? { ...item, status: 'closed' } : item)) }}>Close request</button><button type="button" onClick={() => setSelected(null)}><X size={20} /></button></div></header>{detailLoading ? <div className="proposal-room-loading"><LoaderCircle className="spinner" /> Loading proposals…</div> : detail?.proposals?.length ? <div className="admin-proposal-stack">{detail.proposals.map(proposal => <div className="admin-proposal-row" key={proposal.id}><div><strong>{proposal.provider_name}</strong><span>{proposal.currency} {Number(proposal.quoted_price).toFixed(2)} · {proposal.status} · {proposal.message_count || 0} messages {proposal.message_count > 0 ? '· Review for external contact details' : ''}</span><p>{proposal.proposed_itinerary}</p></div><div className="admin-proposal-actions"><button className="btn btn-outline btn-sm" onClick={() => { setRoomProposal(proposal); setRoom({ proposal, messages: proposal.messages || [] }) }}>Review thread</button><button className="btn btn-ghost btn-sm" onClick={async () => { await hideAdminProposal(selected.id, proposal.id); setDetail(current => ({ ...current, proposals: current.proposals.filter(item => item.id !== proposal.id) })) }}>Hide</button></div></div>)}</div> : <p className="admin-request-empty">No provider proposals yet.</p>}</section></div>}
    {roomProposal && <ProposalRoom room={room} loading={false} canReply={false} onClose={() => setRoomProposal(null)} onSend={() => Promise.resolve()} title="Moderation view" />}
  </main>
}