import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Edit3, Trash2, Plus, X, Check, LoaderCircle, ExternalLink, Image, MapPin } from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const adminHeaders = () => {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Sign in is required for admin operations.')
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-User-Id': user.id }
}

async function fetchWithAdminAuth(path, options = {}) {
  const headers = adminHeaders()
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || 'Request failed')
  return body
}

export default function AdminDestinations() {
  const [destinations, setDestinations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [newHighlight, setNewHighlight] = useState(null)
  const [availableTours, setAvailableTours] = useState([])

  const loadDestinations = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAdminAuth('/api/admin/destinations')
      setDestinations(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDestinations()
    fetch(`${API_BASE_URL}/api/search/experiences?page_size=48`)
      .then(r => r.json())
      .then(d => setAvailableTours(d.items || []))
      .catch(e => console.error('Failed to load tours', e))
  }, [])

  const startEdit = async (id) => {
    setEditingId(id)
    setEditData(null)
    try {
      const data = await fetchWithAdminAuth(`/api/admin/destinations/${id}`)
      setEditData(data)
    } catch (err) {
      alert('Failed to load destination details: ' + err.message)
      setEditingId(null)
    }
  }

  const saveDestination = async () => {
    setSaving(true)
    try {
      await fetchWithAdminAuth(`/api/admin/destinations/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(editData)
      })
      alert('Saved successfully')
      loadDestinations()
      setEditingId(null)
    } catch (err) {
      alert('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const generateAI = async (id) => {
    if (!confirm('This will overwrite current intel using AI. Proceed?')) return
    setAiLoading(true)
    try {
      await fetchWithAdminAuth(`/api/admin/destinations/${id}/generate-intel`, { method: 'POST' })
      alert('Intel generated successfully!')
      if (editingId === id) startEdit(id)
      loadDestinations()
    } catch (err) {
      alert('AI Generation failed: ' + err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const deleteHighlight = async (highlightId) => {
    if (!confirm('Delete highlight?')) return
    try {
      await fetchWithAdminAuth(`/api/admin/destinations/${editingId}/highlights/${highlightId}`, { method: 'DELETE' })
      setEditData({ ...editData, highlights: editData.highlights.filter(h => h.id !== highlightId) })
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  const addHighlight = async (e) => {
    e.preventDefault()
    try {
      const created = await fetchWithAdminAuth(`/api/admin/destinations/${editingId}/highlights`, {
        method: 'POST',
        body: JSON.stringify(newHighlight)
      })
      setEditData({ ...editData, highlights: [...editData.highlights, created] })
      setNewHighlight(null)
    } catch (err) {
      alert('Add failed: ' + err.message)
    }
  }

  const handleImageUpload = (e, setter, field) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return alert('Image must be under 2MB')
    const reader = new FileReader()
    reader.onload = () => {
      setter(prev => ({...prev, [field]: reader.result}))
    }
    reader.readAsDataURL(file)
  }

  if (loading) return <div style={{ padding: '40px' }}>Loading...</div>
  if (error) return <div className="inline-banner">{error}</div>

  return (
    <div style={{ padding: '0 24px 40px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', margin: 0 }}>Manage Destinations</h2>
      </div>

      <div className="portal-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Destination</th>
              <th>Status</th>
              <th>Intel Snippet</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {destinations.map(d => (
              <tr key={d.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <Link to={`/destination/${d.name.toLowerCase()}`} target="_blank" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <ExternalLink size={12} /> View Hub
                  </Link>
                </td>
                <td>
                  {d.weather_summary ? <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '12px' }}>✓ Setup</span> : <span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>Pending</span>}
                </td>
                <td style={{ fontSize: '13px', color: 'var(--color-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.weather_summary || 'No data generated'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => generateAI(d.id)} disabled={aiLoading}>
                      <Sparkles size={14} color="var(--color-accent-600)" /> {aiLoading ? 'Gen...' : 'AI Gen'}
                    </button>
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => startEdit(d.id)}>
                      <Edit3 size={14} /> Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && editData && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '500px', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Edit: {editData.name}</h3>
            <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X /></button>
          </div>
          
          <div style={{ padding: '24px', flex: 1 }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
               <button className="btn" onClick={() => generateAI(editingId)} disabled={aiLoading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <Sparkles size={16} color="var(--color-accent-600)" /> Regenerate Intel with AI
               </button>
            </div>

            <h4 style={{ marginBottom: '16px', fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Destination Intel</h4>
            
            <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Hero Image URL
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" className="text-input" style={{ flex: 1 }} value={editData.hero_image_url || ''} onChange={e => setEditData({...editData, hero_image_url: e.target.value})} />
                  <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <Image size={14} /> Upload
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e, setEditData, 'hero_image_url')} />
                  </label>
                </div>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Weather Summary
                <input type="text" className="text-input" value={editData.weather_summary || ''} onChange={e => setEditData({...editData, weather_summary: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Best Time To Visit
                <input type="text" className="text-input" value={editData.best_time_to_visit || ''} onChange={e => setEditData({...editData, best_time_to_visit: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Currency Info
                <input type="text" className="text-input" value={editData.currency_info || ''} onChange={e => setEditData({...editData, currency_info: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Visa Info
                <input type="text" className="text-input" value={editData.visa_info || ''} onChange={e => setEditData({...editData, visa_info: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Languages
                <input type="text" className="text-input" value={editData.languages || ''} onChange={e => setEditData({...editData, languages: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Timezone
                <input type="text" className="text-input" value={editData.timezone || ''} onChange={e => setEditData({...editData, timezone: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Safety Status
                <input type="text" className="text-input" value={editData.safety_status || ''} onChange={e => setEditData({...editData, safety_status: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Emergency Numbers (separate by | )
                <input type="text" className="text-input" value={editData.emergency_numbers || ''} onChange={e => setEditData({...editData, emergency_numbers: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Getting Around Editorial
                <textarea className="text-input" style={{ minHeight: '80px', resize: 'vertical' }} value={editData.getting_around_editorial || ''} onChange={e => setEditData({...editData, getting_around_editorial: e.target.value})} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                Best Time Editorial
                <textarea className="text-input" style={{ minHeight: '80px', resize: 'vertical' }} value={editData.best_time_editorial || ''} onChange={e => setEditData({...editData, best_time_editorial: e.target.value})} />
              </label>
            </div>

            <h4 style={{ marginBottom: '16px', fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Things To Do (Highlights)</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {editData.highlights.map(h => (
                <div key={h.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: '#ddd', backgroundImage: `url(${h.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }}></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{h.tag_native || h.tag_info} · {h.price || 'Free'}</div>
                  </div>
                  <button onClick={() => deleteHighlight(h.id)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            {newHighlight ? (
              <form onSubmit={addHighlight} style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <h5 style={{ margin: '0 0 12px', fontSize: '13px' }}>Add Highlight</h5>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {availableTours.length > 0 && (
                    <select className="text-input" onChange={e => {
                      const tour = availableTours.find(t => t.id === e.target.value)
                      if (tour) {
                        setNewHighlight({
                          ...newHighlight,
                          title: tour.title,
                          image_url: tour.image || '',
                          price: `${tour.price} ${tour.currency}`,
                          meta_info: `${tour.duration_minutes} min`,
                          tag_native: 'Tour',
                          is_free: false
                        })
                      }
                      e.target.value = ''
                    }}>
                      <option value="">Autofill from an existing tour...</option>
                      {availableTours.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  )}
                  <input type="text" className="text-input" placeholder="Title*" required value={newHighlight.title || ''} onChange={e => setNewHighlight({...newHighlight, title: e.target.value})} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" className="text-input" style={{ flex: 1 }} placeholder="Image URL" value={newHighlight.image_url || ''} onChange={e => setNewHighlight({...newHighlight, image_url: e.target.value})} />
                    <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                      <Image size={14} /> Upload
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e, setNewHighlight, 'image_url')} />
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input type="text" className="text-input" placeholder="Tag (Primary)" value={newHighlight.tag_native || ''} onChange={e => setNewHighlight({...newHighlight, tag_native: e.target.value})} />
                    <input type="text" className="text-input" placeholder="Tag (Secondary)" value={newHighlight.tag_info || ''} onChange={e => setNewHighlight({...newHighlight, tag_info: e.target.value})} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <input type="text" className="text-input" placeholder="Meta Info (e.g. 2 hrs)" value={newHighlight.meta_info || ''} onChange={e => setNewHighlight({...newHighlight, meta_info: e.target.value})} />
                    <input type="text" className="text-input" placeholder="Price (e.g. $25)" value={newHighlight.price || ''} onChange={e => setNewHighlight({...newHighlight, price: e.target.value})} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newHighlight.is_free || false} onChange={e => setNewHighlight({...newHighlight, is_free: e.target.checked})} />
                    Is Free
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add</button>
                    <button type="button" className="btn" onClick={() => setNewHighlight(null)}>Cancel</button>
                  </div>
                </div>
              </form>
            ) : (
              <button className="btn" onClick={() => setNewHighlight({ tag_native: 'GuideVerse', is_free: false })} style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
                <Plus size={16} /> Add Highlight
              </button>
            )}

          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fff' }}>
             <button className="btn" onClick={() => setEditingId(null)}>Cancel</button>
             <button className="btn btn-primary" onClick={saveDestination} disabled={saving}>
               {saving ? 'Saving...' : 'Save Intel'}
             </button>
          </div>
        </div>
      )}
    </div>
  )
}
