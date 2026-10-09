import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, CircleDollarSign, ExternalLink, LoaderCircle, MapPin, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import ProviderSidebar from '../../../components/ProviderSidebar/ProviderSidebar'
import ProposalRoom from '../../../components/ProposalRoom/ProposalRoom'
import { getProviderBids, getProviderProposalRoom, sendProviderProposalMessage, submitProviderBid, updateProviderBid } from '../../../services/providerOperationsService'

export default function BiddingFeed() {
  const [loading, setLoading] = useState(true)
  const [tag, setTag] = useState('All')
  const [budget, setBudget] = useState('All')
  const [selected, setSelected] = useState(null)
  const [price, setPrice] = useState('')
  const [text, setText] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState({})
  const [requests, setRequests] = useState([])
  const [experiences, setExperiences] = useState([])
  const [loadError, setLoadError] = useState('')
  const [roomBid, setRoomBid] = useState(null)
  const [room, setRoom] = useState(null)
  const [roomLoading, setRoomLoading] = useState(false)
  const [roomError, setRoomError] = useState('')
  const [view, setView] = useState('all')
  const [drafts, setDrafts] = useState(() => { try { return JSON.parse(localStorage.getItem('tgm_bid_drafts') || '{}') } catch { return {} } })

  const loadFeed = () => {
    setLoading(true)
    setLoadError('')
    getProviderBids()
      .then(data => {
        if (data && (data.open_requests || data.requests)) setRequests(data.open_requests || data.requests)
        if (data && (data.provider_experiences || data.listings)) setExperiences(data.provider_experiences || data.listings)
        if (data && (data.open_requests || data.requests)) {
          const subObj = {}
          ;(data.open_requests || data.requests).forEach(b => { if (b.bid_id) subObj[b.id] = b.bid_status || 'pending' })
          setSubmitted(subObj)
        }
      })
      .catch(err => setLoadError(err.message || 'Could not load bidding requests from the database.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadFeed() }, [])

  const list = useMemo(() => requests.filter(r => (view === 'all' || (view === 'submitted' && r.bid_id) || (view === 'needs-reply' && r.bid_id && Number(r.unread_traveler_message_count) > 0) || (view === 'open' && !r.bid_id)) && (tag === 'All' || (r.vibe_tags || []).includes(tag)) && (budget === 'All' || Number(r.budget_max) <= Number(budget))), [tag, budget, requests, view])

  const open = r => {
    setSelected(r)
    setPrice(String(r.budget_max || ''))
    setText(drafts[r.id]?.text || '')
    setPortfolio(experiences[0]?.id || '')
    setErrors({})
    setSubmitError('')
  }
  const saveDraft = () => { const next = { ...drafts, [selected.id]: { price, text, portfolio } }; setDrafts(next); localStorage.setItem('tgm_bid_drafts', JSON.stringify(next)); setSelected(null) }

  const send = async e => {
    e.preventDefault()
    const x = {}
    if (!Number(price) || Number(price) <= 0) x.price = 'Enter a positive price.'
    if (text.trim().length < 20) x.text = 'Proposal text must be at least 20 characters.'
    setErrors(x)
    if (Object.keys(x).length) return

    setSending(true)
    setSubmitError('')
    try {
      const createdBid = await submitProviderBid(selected.id, {
        proposed_itinerary: text,
        quoted_price: Number(price),
        portfolio_experience_id: portfolio || null
      })
      setRequests(items => items.map(item => item.id === selected.id ? { ...item, bid_id: createdBid?.id || item.bid_id, bid_status: createdBid?.status || 'pending', quoted_price: Number(price), proposed_itinerary: text, message_count: 0 } : item))
      setSubmitted(s => ({ ...s, [selected.id]: 'Pending' }))
      setSelected(null)
    } catch (err) {
      setSubmitError(err.message || "Couldn't submit your proposal — try again.")
    } finally {
      setSending(false)
    }
  }
  const openRoom = bid => {
    setRequests(items => items.map(item => item.bid_id === bid.bid_id ? { ...item, unread_traveler_message_count: 0 } : item))
    setRoomBid(bid); setRoom(null); setRoomError(''); setRoomLoading(true)
    getProviderProposalRoom(bid.bid_id).then(setRoom).catch(error => setRoomError(error.message)).finally(() => setRoomLoading(false))
  }
  const sendRoomMessage = async body => {
    await sendProviderProposalMessage(roomBid.bid_id, body)
    const refreshed = await getProviderProposalRoom(roomBid.bid_id)
    setRoom(refreshed)
  }
  const updateRoomProposal = async payload => {
    const updated = await updateProviderBid(roomBid.bid_id, payload)
    setRoom(current => ({ ...current, proposal: { ...current.proposal, ...updated }, revisions: [{ ...updated, id: `local-${Date.now()}`, change_summary: 'Proposal updated', created_at: new Date().toISOString() }, ...(current.revisions || [])] }))
    setRequests(items => items.map(item => item.bid_id === roomBid.bid_id ? { ...item, ...updated } : item))
  }

  return (
    <div className="portal-page provider-layout bids-page">
      <ProviderSidebar />
      <main className="bids-main">
        <header className="bids-header">
          <div>
            <p className="settings-eyebrow">Custom requests</p>
            <h1>Bidding Feed — Marketplace</h1>
            <span>Find travelers whose plans match your local expertise.</span>
          </div>
          <div className="bids-filters"><select value={view} onChange={e => setView(e.target.value)}><option value="all">All requests</option><option value="open">Needs proposal</option><option value="submitted">My proposals</option><option value="needs-reply">Needs reply</option></select>
            <SlidersHorizontal size={17} />
            <select value={tag} onChange={e => setTag(e.target.value)}>
              <option>All</option>
              <option>Food</option>
              <option>Photos</option>
              <option>Family</option>
              <option>Adventure</option>
            </select>
            <select value={budget} onChange={e => setBudget(e.target.value)}>
              <option value="All">Any budget</option>
              <option value="300">Up to $300</option>
              <option value="450">Up to $450</option>
              <option value="600">Up to $600</option>
            </select>
          </div>
        </header>
        {loadError && <div className="inline-banner">{loadError}<button onClick={loadFeed}>Retry</button></div>}
        {loading ? (
          <div className="bids-grid">{[1, 2, 3, 4].map(i => <div key={i} className="bid-skeleton" />)}</div>
        ) : list.length ? (
          <div className="bids-grid">
            {list.map(r => (
              <article className="portal-card bid-request" key={r.id}>
                <div className="bid-request-top">
                  <span className="bid-age">{r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent'}</span>
                  <span className="request-badge">{r.bid_id ? r.bid_status || 'Submitted' : 'Open'}</span>
                </div>
                <h2>{r.title}</h2>
                <p>
                  <MapPin size={14} /> {r.destination_name} · <CalendarDays size={14} /> {r.start_date} to {r.end_date}
                </p>
                <p className="bid-group-type"><strong>Format:</strong> {r.group_type === 'group' ? 'Small group OK' : 'Private — just us'}</p>
                <div className="bid-tags">
                  {(r.vibe_tags || []).map(x => <span key={x}>{x}</span>)}
                </div>
                {r.description && <div className="bid-inquiry"><strong>Traveler inquiry</strong><p>{r.description}</p></div>}
                <div className="bid-request-bottom">
                  <strong><CircleDollarSign size={16} /> Budget ${r.budget_max}</strong>
                  <span>{r.group_size} guests</span>
                </div>
                {r.bid_id || submitted[r.id] ? (
                  <><div className="provider-submitted-proposal"><strong>Your proposal</strong><span>{r.currency} {Number(r.quoted_price || 0).toFixed(2)} · {r.message_count || 0} replies</span><p>{r.proposed_itinerary}</p>{Number(r.unread_traveler_message_count) > 0 && <span className="conversation-unread-badge">New traveler message{Number(r.unread_traveler_message_count) > 1 ? 's' : ''} · {r.unread_traveler_message_count}</span>}</div><div className="provider-bid-actions"><button className="btn btn-outline btn-full" onClick={() => openRoom(r)}><Check size={16} /> View proposal room</button>{r.booking_id && <button className="btn btn-primary btn-full" onClick={() => window.location.assign(`/app/provider/bookings/${r.booking_id}`)}><ExternalLink size={16} /> View booking</button>}</div></>
                ) : (
                  <button className="btn btn-primary btn-full" onClick={() => open(r)}>Submit proposal</button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="bids-empty">
            <Sparkles size={30} />
            <h2>No open requests match your category right now</h2>
            <p>Check back soon, or broaden your listed categories and languages in settings.</p>
          </div>
        )}
      </main>

      {selected && (
        <div className="modal-overlay bids-overlay">
          <form className="modal bid-builder" onSubmit={send}>
            <div className="modal-header">
              <div>
                <p className="settings-eyebrow">Proposal for</p>
                <h3>{selected.title}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            <div className="modal-body bid-form">
              {submitError && <div className="inline-banner">{submitError}</div>}
              <label className="input-group">
                <span className="input-label">Price quote *</span>
                <input className={'input-field ' + (errors.price ? 'error' : '')} type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="350" />
                {Number(price) > selected.budget_max * 1.2 && <span className="input-hint">This is above the traveler's stated budget — consider explaining the value in your proposal.</span>}
                {errors.price && <span className="input-error">{errors.price}</span>}
              </label>
              <label className="input-group">
                <span className="input-label">Draft itinerary & inclusions *</span>
                <textarea className={'input-field ' + (errors.text ? 'error' : '')} rows="5" value={text} onChange={e => setText(e.target.value)} placeholder="Describe your plan, highlights, pacing, and what’s included…" />
                {errors.text && <span className="input-error">{errors.text}</span>}
              </label>
              <label className="input-group">
                <span className="input-label">Portfolio link</span>
                <select className={'input-field ' + (errors.portfolio ? 'error' : '')} value={portfolio} onChange={e => setPortfolio(e.target.value)}>
                  <option value="">Select an experience to attach</option>
                  {experiences.map(exp => <option key={exp.id} value={exp.id}>{exp.title}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" type="button" onClick={saveDraft}>Save draft</button><button className="btn btn-ghost" type="button" onClick={() => setSelected(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={sending}>{sending ? <><LoaderCircle size={16} className="spinner" /> Sending…</> : 'Send proposal'}</button>
            </div>
          </form>
        </div>
      )}
      {roomBid && <ProposalRoom room={room} loading={roomLoading} error={roomError} canEdit onUpdate={updateRoomProposal} onClose={() => setRoomBid(null)} onSend={sendRoomMessage} title="Your proposal room" />}
    </div>
  )
}
