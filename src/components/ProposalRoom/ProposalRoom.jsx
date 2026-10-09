import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, LoaderCircle, Send, X, PencilLine, Save } from 'lucide-react'

export default function ProposalRoom({ room, loading, error, canReply = true, canEdit = false, canAccept = false, onClose, onSend, onAccept, onUpdate, title = 'Proposal room' }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState('')
  const [itinerary, setItinerary] = useState('')
  const [updating, setUpdating] = useState(false)
  const [sendError, setSendError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState('')
  const threadEndRef = useRef(null)
  const proposal = room?.proposal
  useEffect(() => { setMessage('') }, [proposal?.id])
  useEffect(() => { setPrice(String(proposal?.quoted_price || '')); setItinerary(proposal?.proposed_itinerary || '') }, [proposal?.id, proposal?.quoted_price, proposal?.proposed_itinerary])
  useEffect(() => {
    if (!room?.messages?.length) return
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [room?.messages?.length])
  const send = async event => {
    event.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    setSendError('')
    try { await onSend(message.trim()); setMessage('') } catch (error) { setSendError(error.message || 'The message could not be sent.') } finally { setSending(false) }
  }
  const update = async event => {
    event.preventDefault()
    if (!onUpdate || !price || itinerary.trim().length < 20) return
    setUpdating(true)
    try { await onUpdate({ quoted_price: Number(price), proposed_itinerary: itinerary.trim() }); setEditing(false) } finally { setUpdating(false) }
  }
  const accept = async () => {
    if (!onAccept || accepting) return
    setAccepting(true)
    setAcceptError('')
    try { await onAccept(proposal) } catch (error) { setAcceptError(error.message || 'Could not accept this proposal.') } finally { setAccepting(false) }
  }
  const quickReplies = ['Can you include meals?', 'Is hotel pickup included?', 'Can you customize the itinerary?', 'Can you offer a private tour?']
  return <div className="modal-overlay proposal-room-overlay" role="dialog" aria-modal="true">
    <section className="modal proposal-room-modal">
      <header className="modal-header"><div><p className="settings-eyebrow">{title}</p><h2>{proposal?.title || proposal?.request_title || 'Proposal details'}</h2><span>{proposal?.destination_name} · {proposal?.start_date} to {proposal?.end_date}</span></div><button type="button" aria-label="Close" onClick={onClose}><X size={20} /></button></header>
      {loading ? <div className="proposal-room-loading"><LoaderCircle className="spinner" /> Loading discussion…</div> : proposal && <div className="proposal-room-content">
        {error && <div className="inline-banner">{error}</div>}
        <div className="proposal-room-summary"><div><small>Provider</small><strong>{proposal.provider_name}</strong></div><div><small>Current offer</small><strong>{proposal.currency} {Number(proposal.quoted_price).toFixed(2)}</strong></div><div><small>Status</small><strong className="proposal-room-status">{proposal.status}</strong></div><div><small>Group</small><strong>{proposal.group_size} guests</strong></div></div>
        {acceptError && <div className="inline-banner" role="alert">{acceptError}</div>}
        <div className="proposal-room-itinerary"><div className="proposal-room-section-heading"><small>Current itinerary</small>{canEdit && <button type="button" className="text-link" onClick={() => setEditing(value => !value)}>{editing ? <><X size={14} /> Cancel</> : <><PencilLine size={14} /> Edit offer</>}</button>}</div>{editing ? <form className="proposal-room-edit" onSubmit={update}><label><span>Quote</span><input type="number" min="1" value={price} onChange={event => setPrice(event.target.value)} /></label><label><span>Itinerary</span><textarea rows="4" value={itinerary} onChange={event => setItinerary(event.target.value)} /></label><button className="btn btn-primary" disabled={updating}>{updating ? <LoaderCircle className="spinner" size={16} /> : <Save size={16} />} Save revision</button></form> : <p>{proposal.proposed_itinerary}</p>}</div>
        {(room.revisions?.length > 0 || canAccept) && <div className="proposal-room-revisions"><div className="proposal-room-revisions-header"><strong>Recent changes</strong>{canAccept && !['accepted', 'rejected', 'withdrawn'].includes(String(proposal.status || '').toLowerCase()) && <button type="button" className="btn btn-primary btn-sm" onClick={accept} disabled={accepting}>{accepting ? <LoaderCircle className="spinner" size={14} /> : <CheckCircle2 size={14} />} {accepting ? 'Accepting…' : 'Accept proposal'}</button>}</div>{room.revisions?.length > 0 ? room.revisions.slice(0, 3).map(revision => <span key={revision.id}>{revision.change_summary} · {new Date(revision.created_at).toLocaleDateString()}</span>) : <span>No changes yet</span>}</div>}
        <div className="proposal-room-thread" aria-live="polite">{room.messages?.length ? room.messages.map(item => {
          const senderName = [item.first_name, item.last_name].filter(Boolean).join(' ') || (item.self ? 'You' : 'Participant')
          return <article key={item.id} className={`proposal-message ${item.self ? 'is-self' : ''}`}><div><strong>{senderName}{item.self && <span className="proposal-message-you">You</span>}</strong><time>{new Date(item.created_at).toLocaleString()}</time></div><p>{item.body}</p></article>
        }) : <div className="proposal-room-empty"><strong>No messages yet</strong><span>Ask a question to fine-tune this proposal.</span></div>}<div ref={threadEndRef} aria-hidden="true" /></div>
        {canReply && <><div className="proposal-quick-replies">{quickReplies.map(reply => <button type="button" key={reply} onClick={() => setMessage(reply)}>{reply}</button>)}</div>{sendError && <div className="inline-banner" role="alert">{sendError}</div>}<form className="proposal-room-composer" onSubmit={send}><textarea value={message} onChange={event => { setMessage(event.target.value); if (sendError) setSendError('') }} placeholder="Ask about meals, pickup, itinerary, or price…" rows="3" maxLength="2000"/><button className="btn btn-primary" disabled={sending || !message.trim()}>{sending ? <LoaderCircle className="spinner" size={16} /> : <Send size={16} />} Send reply</button></form></>}
      </div>}
    </section>
  </div>
}