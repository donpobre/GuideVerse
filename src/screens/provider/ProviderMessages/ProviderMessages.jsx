import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, BellRing, CalendarCheck, Check, Clock3, MapPin, Send, X } from 'lucide-react'
import ProviderSidebar from '../../../components/ProviderSidebar/ProviderSidebar'
import { getProviderConversations, sendProviderMessage } from '../../../services/providerOperationsService'

export default function ProviderMessages() {
  const [searchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [active, setActive] = useState(null)
  const [draft, setDraft] = useState('')
  const [dispatch, setDispatch] = useState('incoming')
  const [seconds, setSeconds] = useState(14 * 60 + 32)
  const [acceptError, setAcceptError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')

  const loadConversations = () => {
    setLoading(true)
    setLoadError('')
    getProviderConversations()
      .then(res => {
        if (Array.isArray(res)) {
          setConversations(res)
          if (res.length > 0) {
            const requestedBooking = searchParams.get('booking')
            const requestedConversation = searchParams.get('conversation')
            const requested = res.find(item => item.id === requestedConversation || item.booking_id === requestedBooking || item.booking_reference === requestedBooking)
            setActive(requested?.id || res[0].id)
          }
        }
      })
      .catch(err => setLoadError(err.message || 'Could not load conversations from the database.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadConversations() }, [searchParams])

  const selected = conversations.find(item => item.id === active) || conversations[0]

  const formatTime = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

  useEffect(() => {
    if (dispatch !== 'incoming' || acceptError) return
    const timer = window.setInterval(() => setSeconds(value => {
      if (value <= 1) {
        setDispatch('expired')
        return 0
      }
      return value - 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [dispatch, acceptError])

  const send = async event => {
    event.preventDefault()
    if (!draft.trim() || !selected) return
    const messageBody = draft
    setDraft('')
    setSendError('')
    try {
      const newMessage = await sendProviderMessage(selected.id, messageBody)
      setConversations(old => old.map(item => item.id === selected.id ? {
        ...item,
        messages: [...(item.messages || []), newMessage]
      } : item))
    } catch (e) {
      setDraft(messageBody)
      setSendError(e.message || 'Could not send this message.')
    }
  }

  const acceptDispatch = () => {
    setAcceptError(false)
    if (seconds % 7 === 0) return setAcceptError(true)
    setDispatch('accepted')
  }

  return (
    <div className="portal-page provider-layout provider-messages-page">
      <ProviderSidebar />
      <main className="provider-messages-main">
        {dispatch === 'incoming' && (
          <section className="dispatch-alert">
            <div className="dispatch-alert-icon"><BellRing size={22} /></div>
            <div className="dispatch-alert-copy">
              <div>
                <p className="settings-eyebrow">New instant request · 5 km away</p>
                <span className="dispatch-timer"><Clock3 size={15} /> {formatTime(seconds)} left</span>
              </div>
              <h2>Photography session, 2 hours, $150</h2>
              <p><MapPin size={14} /> Ayala Center Cebu · Start within 45 minutes</p>
            </div>
            <div className="dispatch-actions">
              <button className="btn btn-outline" onClick={() => setDispatch('declined')}>Decline</button>
              <button className="btn btn-primary" onClick={acceptDispatch}>Accept</button>
              {acceptError && (
                <div className="dispatch-error">
                  <AlertCircle size={15} />Couldn’t record acceptance. <button onClick={acceptDispatch}>Retry</button>
                </div>
              )}
            </div>
          </section>
        )}
        {dispatch === 'accepted' && <div className="dispatch-status success"><Check size={17} />Dispatch accepted — a confirmed booking thread has been created.</div>}
        {dispatch === 'expired' && <div className="dispatch-status">This instant request expired and was auto-declined.</div>}
        <section className="provider-chat traveler-message-shell">
          <aside className="provider-conversation-list traveler-message-list">
            <header>
              <div>
                <p className="settings-eyebrow">Inbox</p>
                <h1>Guest messages</h1>
              </div>
              <span>{conversations.length}</span>
            </header>
            {loading ? (
              <div className="provider-chat-empty">Loading conversations…</div>
            ) : loadError ? (
              <div className="provider-chat-empty">{loadError}<button className="btn btn-outline btn-sm" onClick={loadConversations}>Retry</button></div>
            ) : conversations.length ? (
              conversations.map(conversation => (
                <button key={conversation.id} className={`traveler-message-conversation ${conversation.id === selected?.id ? 'active' : ''}`} onClick={() => setActive(conversation.id)}>
                  <span className="provider-chat-avatar">{((conversation.first_name ? `${conversation.first_name} ${conversation.last_name}` : null) || conversation.subject || 'G').slice(0, 1)}</span>
                  <span>
                    <strong>{(conversation.first_name ? `${conversation.first_name} ${conversation.last_name}` : null) || conversation.subject}</strong>
                    <small>{conversation.booking_reference ? `${conversation.booking_reference} · ` : ''}{(conversation.messages && conversation.messages.length) ? conversation.messages[conversation.messages.length - 1].body || conversation.messages[conversation.messages.length - 1].text : 'New conversation'}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className="provider-chat-empty">Your guest messages will appear here.</div>
            )}
          </aside>
          <section className="provider-thread traveler-message-thread">
            {selected ? (
              <>
                <header className="traveler-message-thread-header">
                  <div>
                    <strong>{(selected.first_name ? `${selected.first_name} ${selected.last_name}` : null) || selected.subject}</strong>
                    <span>{(selected.first_name ? `${selected.first_name} ${selected.last_name}` : null) || 'Traveler'} · {selected.subject}{selected.booking_reference ? ` · ${selected.booking_reference}` : ''}</span>
                  </div>
                  <CalendarCheck size={19} />
                </header>
                <div className="provider-message-stack traveler-message-stack">
                  {(selected.messages || []).map((message, idx) => (
                    <div key={message.id || idx} className={`provider-bubble traveler-message-bubble ${message.self || message.is_self ? 'self' : ''}`}>
                      <span>{message.body || message.text}</span>
                      <small>{message.self || message.is_self ? 'You' : ((selected.first_name ? `${selected.first_name} ${selected.last_name}` : null) || 'Traveler')}</small>
                    </div>
                  ))}
                </div>
                {sendError && <div className="inline-banner">{sendError}</div>}
                <form className="provider-reply traveler-message-composer" onSubmit={send}>
                  <input className="input-field" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Reply to guest…" />
                  <button className="btn btn-primary btn-icon" aria-label="Send"><Send size={17} /></button>
                </form>
              </>
            ) : (
              <div className="provider-thread-empty">Your guest messages will appear here.</div>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}
