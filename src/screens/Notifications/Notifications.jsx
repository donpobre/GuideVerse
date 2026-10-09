import { useEffect, useState } from 'react'
import { Bell, LoaderCircle, MessageCircle, Sparkles } from 'lucide-react'
import { getTravelerNotifications } from '../../services/travelerSettingsService'
import { useNavigate } from 'react-router-dom'

export default function Notifications() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { getTravelerNotifications().then(setItems).catch(error => setError(error.message)).finally(() => setLoading(false)) }, [])
  return <main className="portal-page notifications-page"><div className="container notifications-shell"><header className="notifications-header"><div><p className="eyebrow">Your activity</p><h1>Notifications</h1><span>Stay current on provider proposals and replies.</span></div><Bell size={28} /></header>{error && <div className="inline-banner">{error}</div>}{loading ? <div className="proposal-room-loading"><LoaderCircle className="spinner" /> Loading notifications…</div> : items.length ? <section className="notifications-list">{items.map(item => <button key={`${item.type}-${item.id}`} className="notification-card" onClick={() => navigate(`/app/traveler/requests?request=${item.request_id}`)}><span className="notification-icon">{item.type === 'reply' ? <MessageCircle size={18} /> : <Sparkles size={18} />}</span><span><strong>{item.message}</strong><small>{item.title}</small><time>{new Date(item.created_at).toLocaleString()}</time></span><span className="notification-arrow">›</span></button>)}</section> : <section className="notifications-empty"><Bell size={34} /><h2>You’re all caught up</h2><p>New proposal replies will appear here.</p></section>}</div></main>
}