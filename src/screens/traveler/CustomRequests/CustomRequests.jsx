import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, LoaderCircle, MapPin, PencilLine, Plus, ShieldCheck, Sparkles, Trash2, UsersRound } from 'lucide-react'
import TravelerTabs from '../../../components/TravelerTabs/TravelerTabs'
import ProposalRoom from '../../../components/ProposalRoom/ProposalRoom'
import { acceptCustomRequestProposal, createCustomRequest, getCustomRequestProposals, getTravelerCustomRequests, getTravelerProposalRoom, sendTravelerProposalMessage, updateCustomRequest, withdrawCustomRequest } from '../../../services/customRequestService'
import { getPublicTourLocations } from '../../../services/tourLocationService'


const fallbackLocations = [
  'Kyoto, Japan',
  'Cebu, Philippines',
  'Santorini, Greece',
  'Bali, Indonesia',
  'Paris, France',
  'Istanbul, Turkey',
  'Cusco, Peru',
  'Marrakech, Morocco',
]

const typicalBudgetByLocation = {
  'Kyoto, Japan': 650,
  'Cebu, Philippines': 350,
  'Santorini, Greece': 800,
  'Bali, Indonesia': 400,
  'Paris, France': 700,
  'Istanbul, Turkey': 450,
  'Cusco, Peru': 500,
  'Marrakech, Morocco': 360,
}

const defaultTags = ['Food', 'Photos', 'Adventure', 'Family']

const initialFallbackRequests = [
  {
    id: 'r1',
    title: 'Kyoto Cultural & Culinary Day',
    destination: 'Kyoto, Japan',
    startDate: '2026-09-18',
    endDate: '2026-09-20',
    guests: 2,
    budget: 450,
    interests: ['Food', 'Photos'],
    status: 'Receiving Bids',
    proposals: 2
  },
  {
    id: 'r2',
    title: 'Cebu Island Hopping Discovery',
    destination: 'Cebu, Philippines',
    startDate: '2026-10-04',
    endDate: '2026-10-05',
    guests: 4,
    budget: 350,
    interests: ['Adventure', 'Family'],
    status: 'Open',
    proposals: 1
  }
]

const fallbackProposals = {
  r1: [
    { id: 'p1', provider: 'Sora Kim', price: 420, schedule: 'Sep 18 · 9:00', responseTime: 6, matchScore: 97, rating: 4.9, inclusions: ['Local food crawl', 'Photo stops'], bio: 'Kyoto-based host with a strong track record for family-friendly day plans.' },
    { id: 'p2', provider: 'Aiko Mori', price: 560, schedule: 'Sep 19 · 14:00', responseTime: 10, matchScore: 94, rating: 4.8, inclusions: ['Temple entry', 'Tea pairing'], bio: 'Design-led guide focused on hidden gardens and deeper cultural context.' },
  ],
  r2: [
    { id: 'p3', provider: 'Liam Chen', price: 310, schedule: 'Oct 04 · 08:30', responseTime: 4, matchScore: 91, rating: 4.7, inclusions: ['Beach transfers', 'Sunset dinner'], bio: 'Cebu host known for balancing local insights with flexible pacing.' },
  ],
}

function normalize(value) {
  return (value || '').trim().toLowerCase()
}

function normalizeRequest(request) {
  return {
    ...request,
    id: String(request.id),
    destination: request.destination || request.destination_name || '',
    startDate: request.startDate || request.start_date || '',
    endDate: request.endDate || request.end_date || '',
    guests: request.guests || request.group_size || 1,
    budget: request.budget || request.budget_max || 0,
    interests: request.interests || request.vibe_tags || [],
    inquiry: request.inquiry || request.description || '',
    groupType: request.groupType || request.group_type || 'private',
    proposals: request.proposals ?? request.proposal_count ?? request.bid_count ?? 0,
    status: request.status || 'Open',
  }
}

function normalizeProposal(proposal) {
  const provider = proposal.provider || {}
  const providerName = proposal.provider_name || provider.name || [provider.first_name, provider.last_name].filter(Boolean).join(' ') || 'Provider'
  return {
    ...proposal,
    id: String(proposal.id),
    status: proposal.status || 'pending',
    provider_id: proposal.provider_id,
    public_slug: proposal.public_slug,
    provider: providerName,
    price: Number(proposal.price ?? proposal.quoted_price ?? 0),
    schedule: proposal.schedule || proposal.start_time || proposal.created_at || 'Schedule pending',
    responseTime: proposal.responseTime ?? proposal.response_time_hours ?? proposal.response_time ?? 0,
    matchScore: proposal.matchScore ?? proposal.match_score ?? 0,
    rating: Number(proposal.rating ?? provider.rating ?? provider.trust_score ?? 0),
    inclusions: proposal.inclusions || proposal.included_items || [],
    proposalMessage: proposal.proposed_itinerary || proposal.proposal_message || proposal.message || 'No proposal message provided.',
  }
}

export default function CustomRequests() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ destination: '', startDate: '', endDate: '', guests: '2', budget: 400, interests: ['Food'], inquiry: '', groupType: 'private', datesFlexible: false })
  const [formErrors, setFormErrors] = useState({})
  const [softWarning, setSoftWarning] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeRequestId, setActiveRequestId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [proposalState, setProposalState] = useState({})
  const [proposalFilter, setProposalFilter] = useState('recommended')
  const [budgetOnly, setBudgetOnly] = useState(false)
  const [compareIds, setCompareIds] = useState([])
  const [loadError, setLoadError] = useState('')
  const [roomProposal, setRoomProposal] = useState(null)
  const [room, setRoom] = useState(null)
  const [roomLoading, setRoomLoading] = useState(false)
  const [roomError, setRoomError] = useState('')
  const [recognizedLocations, setRecognizedLocations] = useState(fallbackLocations)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    getPublicTourLocations().then(locations => {
      if (locations.length) setRecognizedLocations(locations.map(location => location.name))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const destination = searchParams.get('destination')
    if (!destination) return
    const start = new Date()
    start.setDate(start.getDate() + 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const formatDate = value => value.toISOString().slice(0, 10)
    const requestedGuests = Number(searchParams.get('min_travelers') || 0)
    const requestedInterests = searchParams.getAll('themes')
    const requestedStart = searchParams.get('date_start')
    const requestedEnd = searchParams.get('date_end')
    setForm(prev => ({
      ...prev,
      destination,
      inquiry: prev.inquiry || searchParams.get('inquiry') || (searchParams.get('experience') ? `I have a question about ${searchParams.get('experience')}. ` : ''),
      groupType: searchParams.get('group_type') || prev.groupType,
      guests: requestedGuests > 0 ? String(requestedGuests) : prev.guests,
      interests: requestedInterests.length ? requestedInterests : prev.interests,
      startDate: requestedStart || prev.startDate || formatDate(start),
      endDate: requestedEnd || prev.endDate || formatDate(end),
      datesFlexible: searchParams.get('flexible_dates') === 'true' || prev.datesFlexible,
    }))
  }, [searchParams])

  const loadRequests = () => {
    setLoading(true)
    setLoadError('')
    getTravelerCustomRequests()
      .then(res => {
        const items = Array.isArray(res) ? res.map(normalizeRequest) : []
        setRequests(items)
        setActiveRequestId(searchParams.get('request') || items[0]?.id || null)
      })
      .catch(err => setLoadError(err.message || 'Could not load your custom requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRequests() }, [])

  useEffect(() => {
    if (!requests.length) return
    const active = requests.find(request => request.id === activeRequestId) || requests[0]
    if (!active) return

    setProposalState(prev => ({
      ...prev,
      [active.id]: { ...prev[active.id], loading: true, error: false }
    }))

    getCustomRequestProposals(active.id)
      .then(proposals => {
        const bids = Array.isArray(proposals) ? proposals.map(normalizeProposal) : []
        setProposalState(prev => ({
          ...prev,
          [active.id]: { loading: false, error: false, items: bids }
        }))
      })
      .catch(() => {
        setProposalState(prev => ({
          ...prev,
          [active.id]: { loading: false, error: true, items: [] }
        }))
      })
  }, [activeRequestId, requests])

  const openProposalRoom = proposal => {
    if (!selectedRequest?.id || !proposal?.id) return
    setProposalState(current => ({ ...current, [selectedRequest.id]: { ...current[selectedRequest.id], items: (current[selectedRequest.id]?.items || []).map(item => item.id === proposal.id ? { ...item, unread_provider_message_count: 0 } : item) } }))
    const roomProposal = {
      ...proposal,
      title: selectedRequest.title,
      destination_name: selectedRequest.destination,
      start_date: selectedRequest.startDate,
      end_date: selectedRequest.endDate,
      group_size: selectedRequest.guests,
    }
    setRoomProposal(proposal); setRoom({ proposal: roomProposal, messages: [], revisions: [] }); setRoomError(''); setRoomLoading(true)
    getTravelerProposalRoom(selectedRequest.id, proposal.id)
      .then(response => setRoom(current => ({ ...current, ...response, proposal: { ...roomProposal, ...(response?.proposal || {}) } })))
      .catch(error => setRoomError(error.message))
      .finally(() => setRoomLoading(false))
  }
  const sendProposalMessage = async body => {
    await sendTravelerProposalMessage(selectedRequest.id, roomProposal.id, body)
    const refreshed = await getTravelerProposalRoom(selectedRequest.id, roomProposal.id)
    setRoom(current => ({
      ...current,
      ...refreshed,
      proposal: { ...current?.proposal, ...(refreshed?.proposal || {}) },
    }))
  }

  const selectedRequest = useMemo(() => requests.find(request => request.id === activeRequestId) || requests[0] || null, [activeRequestId, requests])
  const currentProposals = proposalState[selectedRequest?.id]?.items || []
  const proposalLoading = proposalState[selectedRequest?.id]?.loading || false
  const proposalError = proposalState[selectedRequest?.id]?.error || false
  const requestAccepted = normalize(selectedRequest?.status) === 'accepted'

  const filteredProposals = useMemo(() => {
    const items = [...currentProposals]
    if (proposalFilter === 'price') return items.sort((a, b) => a.price - b.price)
    return items.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
  }, [currentProposals, proposalFilter])

  const visibleProposals = useMemo(() => budgetOnly ? filteredProposals.filter(proposal => proposal.price <= (selectedRequest?.budget || Infinity)) : filteredProposals, [budgetOnly, filteredProposals, selectedRequest])

  const validate = () => {
    const errors = {}
    const location = form.destination.trim()
    if (!location) errors.destination = 'Destination is required.'

    if (!form.startDate) errors.startDate = 'Start date is required.'
    if (!form.endDate) errors.endDate = 'End date is required.'
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errors.endDate = 'End date must be on or after the start date.'
    }

    const guests = Number(form.guests)
    if (!Number.isInteger(guests) || guests < 1) errors.guests = 'Group size must be at least 1.'

    if (form.budget < 100 || form.budget > 2000) errors.budget = 'Budget must stay within platform range.'

    const normalizedDestination = recognizedLocations.find(option => normalize(option) === normalize(location))
    const typicalBudget = normalizedDestination ? (typicalBudgetByLocation[normalizedDestination] || 500) : 500
    if (normalizedDestination && form.budget < typicalBudget * 0.7) {
      setSoftWarning('Budget below typical range for this destination may reduce provider interest')
    } else {
      setSoftWarning('')
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setSubmitError('')

    const payload = {
      title: `${form.destination.split(',')[0]} trip`,
      destination_name: form.destination,
      start_date: form.startDate,
      end_date: form.endDate,
      group_size: Number(form.guests),
      budget_max: Number(form.budget),
      vibe_tags: form.interests,
      description: form.inquiry.trim() || `Custom request for ${form.guests} guests to ${form.destination}`
       ,group_type: form.groupType, dates_flexible: form.datesFlexible
    }

    try {
      if (editingId) {
        await updateCustomRequest(editingId, payload)
        setRequests(prev => prev.map(req => req.id === editingId ? {
          ...req,
          title: payload.title,
          destination: form.destination,
          startDate: form.startDate,
          endDate: form.endDate,
          guests: Number(form.guests),
          budget: Number(form.budget),
           interests: form.interests,
           inquiry: form.inquiry
          ,groupType: form.groupType, datesFlexible: form.datesFlexible
        } : req))
        setEditingId(null)
      } else {
        const created = await createCustomRequest(payload).catch(() => ({
          id: `r_${Date.now()}`,
          title: payload.title,
          destination: form.destination,
          startDate: form.startDate,
          endDate: form.endDate,
          guests: Number(form.guests),
          budget: Number(form.budget),
          interests: form.interests,
           inquiry: form.inquiry,
          status: 'Open',
          proposals: 0
        }))
        const newReq = {
          id: created.id,
          title: created.title || payload.title,
          destination: created.destination_name || form.destination,
          startDate: created.start_date || form.startDate,
          endDate: created.end_date || form.endDate,
          guests: created.group_size || Number(form.guests),
          budget: created.budget_max || Number(form.budget),
           interests: created.vibe_tags || form.interests,
           inquiry: created.description || form.inquiry,
            groupType: created.group_type || form.groupType,
            datesFlexible: Boolean(created.dates_flexible || form.datesFlexible),
          status: created.status || 'Open',
          proposals: 0
        }
        setRequests(prev => [newReq, ...prev])
        setActiveRequestId(newReq.id)
      }

      setForm({ destination: '', startDate: '', endDate: '', guests: '2', budget: 400, interests: ['Food'], inquiry: '', groupType: 'private', datesFlexible: false })
      setFormErrors({})
      setSoftWarning('')
    } catch (err) {
      setSubmitError(err.message || "Couldn't post your request — try again")
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleInterest = tag => {
    setForm(prev => ({
      ...prev,
      interests: prev.interests.includes(tag) ? prev.interests.filter(item => item !== tag) : [...prev.interests, tag],
    }))
  }

  const handleEdit = request => {
    setEditingId(request.id)
    setActiveRequestId(request.id)
    setForm({
      destination: request.destination || '',
      startDate: request.startDate || '',
      endDate: request.endDate || '',
      guests: String(request.guests || 2),
      budget: request.budget || 400,
      interests: request.interests || [],
      inquiry: request.inquiry || '',
      groupType: request.groupType || 'private',
      datesFlexible: Boolean(request.dates_flexible || request.datesFlexible),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleWithdraw = async id => {
    try {
      await withdrawCustomRequest(id)
    } catch (e) {
      // Local optimistic update fallback
    }
    setRequests(prev => prev.map(request => (request.id === id ? { ...request, status: 'Closed' } : request)))
  }

  const handleAcceptProposal = async proposal => {
    setSubmitError('')
    try {
      const result = await acceptCustomRequestProposal(selectedRequest.id, proposal.id)
      navigate(`/app/traveler/checkout/${result.experience_id}?date=${result.date}&guests=${result.guests}&booking=${result.booking_id}&approved=1`)
    } catch (error) {
      setSubmitError(error.message || 'Could not accept this proposal.')
    }
  }

  const hasRequests = requests.length > 0



  return (
    <main className="portal-page custom-request-page">
      <div className="container custom-request-shell">
        <section className="portal-card custom-request-card">
          <div className="custom-request-header">
            <div>
              <p className="eyebrow">Booking mode 3</p>
              <h1>Custom Request Manager</h1>
            </div>
            <span className="custom-request-pill"><Sparkles size={14} /> Match with local experts</span>
          </div>

          <form className="form custom-request-form" onSubmit={handleSubmit}>
            {submitError && <div className="inline-banner"><AlertCircle size={16} />{submitError}</div>}

            <div className="custom-request-grid">
              <label className="field-stack">
                <span className="input-label">Destination or trip area *</span>
                <input aria-describedby="destination-help" className="input-field" list="locations" placeholder="Enter a city, island, region, or new location" value={form.destination} onChange={event => setForm(prev => ({ ...prev, destination: event.target.value }))} />
                <datalist id="locations">
                  {recognizedLocations.map(location => <option key={location} value={location} />)}
                </datalist>
                <small id="destination-help" className="field-hint">Choose a suggestion or type any new destination, island, region, or custom tour area.</small>
                {formErrors.destination && <small className="field-error">{formErrors.destination}</small>}
              </label>

              <div className="custom-request-grid-date">
                <label className="field-stack">
                  <span className="input-label">Start date</span>
                  <input type="date" min={today} className="input-field" value={form.startDate} onChange={event => setForm(prev => ({ ...prev, startDate: event.target.value, endDate: prev.endDate && prev.endDate < event.target.value ? '' : prev.endDate }))} />
                  {formErrors.startDate && <small className="field-error">{formErrors.startDate}</small>}
                </label>
                <label className="field-stack">
                  <span className="input-label">End date</span>
                  <input type="date" min={form.startDate || today} className="input-field" value={form.endDate} onChange={event => setForm(prev => ({ ...prev, endDate: event.target.value }))} />
                  {formErrors.endDate && <small className="field-error">{formErrors.endDate}</small>}
                </label>
              </div>
              <label className="request-flexible-toggle"><input type="checkbox" checked={form.datesFlexible} onChange={event => setForm(prev => ({ ...prev, datesFlexible: event.target.checked }))} /><span><strong>My dates are flexible</strong><small>Providers may suggest nearby dates for better availability or value.</small></span></label>

              <label className="field-stack">
                <span className="input-label">Group size</span>
                <input type="number" min="1" className="input-field" value={form.guests} onChange={event => setForm(prev => ({ ...prev, guests: event.target.value }))} />
                {formErrors.guests && <small className="field-error">{formErrors.guests}</small>}
              </label>

              <div className="field-stack">
                <div className="custom-request-budget-row">
                  <span className="input-label">Budget</span>
                  <span className="custom-request-budget-value">${form.budget}</span>
                </div>
                <input className="slider budget" type="range" min="100" max="2000" step="5" value={form.budget} onChange={event => setForm(prev => ({ ...prev, budget: Math.round(Number(event.target.value) / 5) * 5 }))} />
                {formErrors.budget && <small className="field-error">{formErrors.budget}</small>}
                {softWarning && <small className="soft-warning"><CircleDollarSign size={14} />{softWarning}</small>}
              </div>
            </div>

            <div className="field-stack">
              <span className="input-label">Interest tags</span>
              <div className="chip-row">
                {defaultTags.map(tag => (
                  <button key={tag} type="button" className={`chip interest-tag ${form.interests.includes(tag) ? 'active' : ''}`} onClick={() => toggleInterest(tag)}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <label className="field-stack custom-request-inquiry-field">
              <span className="input-label">Tour inquiry</span>
              <textarea className="input-field custom-request-inquiry" rows="4" value={form.inquiry} onChange={event => setForm(prev => ({ ...prev, inquiry: event.target.value }))} placeholder="Ask anything about this tour—pickup, itinerary, what’s included, accessibility, or changes you would like." />
              <small className="field-help">Tell the guide what you would like to know or customize before booking.</small>
            </label>

            <button type="submit" className="btn btn-primary custom-request-submit" disabled={isSubmitting}>
              {isSubmitting ? <><LoaderCircle size={16} className="spinner" /> Posting request…</> : <><Plus size={16} /> Post request</>}
            </button>
          </form>
        </section>

        <section className="custom-request-list-card">
          <div className="custom-request-list-header">
            <h2>My Requests</h2>
            <span className="custom-request-pill alt">{requests.length} active</span>
          </div>

          {!hasRequests && (
            <div className="custom-request-empty-state">
              <h3>You haven't posted a custom request</h3>
              <p>Describe your ideal trip and let local experts pitch you.</p>
              <button className="btn btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Create request</button>
            </div>
          )}

          {hasRequests && requests.map(request => (
            <div key={request.id} className="portal-card list request-status">
              <div className="request-card-scene" aria-hidden="true"><span>{request.destination?.split(',')[0]?.slice(0, 1) || 'T'}</span><div><MapPin size={15} /> {request.destination}</div></div>
              <div className="request-status-top">
                <div className="request-card-copy">
                  <div className="request-card-badges">
                    <span className="request-card-badge">Curated lead</span>
                    <span className="request-card-badge soft">{request.proposals > 0 ? `${request.proposals} bids` : 'Awaiting bids'}</span>
                  </div>
                  <p className="request-title">{request.title}</p>
                  <p className="request-meta"><CalendarDays size={14} /> {request.startDate} → {request.endDate}</p>
                </div>
                <span className={`request-badge ${request.status.toLowerCase().replace(/\s+/g, '-')}`}>{request.status}</span>
              </div>
              <div className="request-status-bottom">
                <div className="request-pill-row">
                  <span className="request-pill"><Clock3 size={14} /> {request.proposals > 0 ? `${request.proposals} proposals` : 'No bids yet'}</span>
                  <span className="request-pill"><UsersRound size={14} /> {request.guests} guests</span>
                  <span className="request-pill">Budget ${request.budget}</span>
                </div>
                {request.interests?.length > 0 && (
                  <div className="request-tag-row">
                    {request.interests.map(tag => <span key={tag} className="request-tag">{tag}</span>)}
                  </div>
                )}
                <p className="request-inquiry"><strong>Type:</strong> {request.groupType === 'group' ? 'Small group OK' : 'Private — just us'}{request.inquiry && <> · <strong>Inquiry:</strong> {request.inquiry}</>}</p>
                <div className="request-action-row">
                  {request.status !== 'Closed' && (
                    <button className="btn btn-outline btn-sm" onClick={() => handleEdit(request)}><PencilLine size={14} /> Edit</button>
                  )}
                  {request.proposals > 0 && (
                    <button className="btn btn-outline btn-sm" onClick={() => setActiveRequestId(request.id)}>Compare</button>
                  )}
                  {request.status !== 'Closed' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleWithdraw(request.id)}><Trash2 size={14} /> Withdraw</button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {selectedRequest && (
            <div className="portal-card proposal-compare-card">
              <div className="proposal-compare-header">
                <div>
                  <p className="eyebrow">Proposal comparison</p>
                  <h3>{selectedRequest.title}</h3>
                </div>
                <div className="proposal-toolbar">
                  <span className="custom-request-pill alt">{selectedRequest.status}</span>
                  <div className="proposal-filter-row">
                    {['recommended', 'price'].map(option => (
                      <button key={option} type="button" className={`proposal-filter-pill ${proposalFilter === option ? 'active' : ''}`} onClick={() => setProposalFilter(option)}>
                        {option === 'recommended' ? 'Recommended' : 'Lowest price'}
                      </button>
                    ))}
                  </div>
                  <label className="proposal-budget-filter"><input type="checkbox" checked={budgetOnly} onChange={event => setBudgetOnly(event.target.checked)} /> Within ${selectedRequest.budget} budget</label>
                </div>
              </div>

              {proposalLoading ? (
                <div className="proposal-skeleton-grid">
                  <div className="proposal-skeleton-card" />
                  <div className="proposal-skeleton-card" />
                </div>
              ) : proposalError ? (
                <div className="proposal-error-card">
                  <div>
                    <p className="request-title">Couldn't load proposals</p>
                    <p className="request-meta">The bid feed is temporarily unavailable.</p>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={handleRetryProposals}>Retry</button>
                </div>
              ) : currentProposals.length === 0 ? (
                <div className="custom-request-empty-state compact">
                  <h3>Receiving bids</h3>
                  <p>Providers typically respond within 24 hours.</p>
                </div>
              ) : visibleProposals.length === 0 ? (
                <div className="custom-request-empty-state compact"><h3>No proposals match this filter</h3><p>Try expanding beyond your current trip budget.</p><button className="btn btn-outline btn-sm" onClick={() => setBudgetOnly(false)}>Show all proposals</button></div>
              ) : (
                <div className="proposal-compare-grid">
                  {visibleProposals.map((proposal, index) => (
                    <article key={proposal.id} className={`proposal-card ${index === 0 && proposalFilter === 'recommended' ? 'featured' : ''}`}>
                      <div className="proposal-card-top">
                        <div>
                          <h4><a className="provider-name-link" href={`/provider/${proposal.public_slug || proposal.provider_id || ''}`}>{proposal.provider}</a></h4>
                          <span className="proposal-message-label">Provider message {Number(proposal.unread_provider_message_count) > 0 && <span className="conversation-unread-badge">New reply · {proposal.unread_provider_message_count}</span>}</span>
                        </div>
                        <span className="proposal-price">${proposal.price}</span>
                      </div>
                      <p className="proposal-bio proposal-message-copy">{proposal.proposalMessage}</p>
                      <div className="proposal-actions"><label className="proposal-compare-check"><input type="checkbox" checked={compareIds.includes(proposal.id)} onChange={() => setCompareIds(ids => ids.includes(proposal.id) ? ids.filter(id => id !== proposal.id) : ids.length < 3 ? [...ids, proposal.id] : ids)} /> Compare</label><button className="btn btn-outline" type="button" onClick={() => openProposalRoom(proposal)}>Discuss <span className="proposal-message-count">{proposal.message_count || 0}</span></button>{!requestAccepted && normalize(proposal.status) !== 'accepted' && <button className="btn btn-primary" type="button" onClick={() => handleAcceptProposal(proposal)}><CheckCircle2 size={16} /> Accept</button>}</div>
                    </article>
                  ))}
                </div>
              )}
              {compareIds.length > 1 && <div className="proposal-comparison-table"><strong>Quick comparison</strong><div className="comparison-grid"><span>Provider</span>{compareIds.map(id => <b key={id}>{currentProposals.find(item => item.id === id)?.provider}</b>)}<span>Price</span>{compareIds.map(id => <span key={id}>{currentProposals.find(item => item.id === id)?.price}</span>)}<span>Proposal message</span>{compareIds.map(id => <span key={id}>{currentProposals.find(item => item.id === id)?.proposalMessage}</span>)}</div></div>}
            </div>
          )}
        </section>
      </div>
      {roomProposal && <ProposalRoom room={room} loading={roomLoading} error={roomError} canAccept onAccept={handleAcceptProposal} onClose={() => setRoomProposal(null)} onSend={sendProposalMessage} />}
      <TravelerTabs />
    </main>
  )
}
