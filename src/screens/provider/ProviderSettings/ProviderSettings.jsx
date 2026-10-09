import { useEffect, useState } from 'react'
import { BadgeCheck, Camera, Check, LoaderCircle, Plus, Trash2, UserRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ProviderSidebar from '../../../components/ProviderSidebar/ProviderSidebar'
import { deleteMyProviderProfile, getMyProviderProfile, updateMyProviderProfile } from '../../../services/providerProfileService'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const empty = {
  first_name: '', last_name: '', business_name: '', public_slug: '', bio: '',
  avatar_url: '', cover_url: '', video_intro_url: '', base_address: '',
  hourly_rate: '', currency: 'USD', years_experience: 0,
  is_accepting_custom_requests: true, languages: [], categories: [], portfolio_urls: []
}

export default function ProviderSettings() {
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [language, setLanguage] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')

  const [hasExternalVideo, setHasExternalVideo] = useState(false)

  // Calendar state
  const [calDate, setCalDate] = useState('')
  const [calStatus, setCalStatus] = useState('unavailable')
  const [calSaving, setCalSaving] = useState(false)

  useEffect(() => {
    getMyProviderProfile()
      .then(data => {
        setForm({ ...empty, ...data, hourly_rate: data.hourly_rate ?? '' })
        if (data.video_intro_url) setHasExternalVideo(true)
      })
      .catch(error => setError(error.message))
      .finally(() => setLoading(false))
  }, [])

  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))

  const chooseAvatar = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose a JPG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile photo must be smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      set('avatar_url', reader.result)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const save = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        public_slug: form.public_slug?.trim() || null,
        hourly_rate: form.hourly_rate === '' ? null : Number(form.hourly_rate),
        years_experience: Number(form.years_experience),
        video_intro_url: hasExternalVideo ? form.video_intro_url : null
      }
      
      const updated = await updateMyProviderProfile(payload)
      setForm({ ...empty, ...updated, hourly_rate: updated.hourly_rate ?? '' })
      
      const storedUser = JSON.parse(localStorage.getItem('tgm_user') || 'null')
      if (storedUser) {
        localStorage.setItem('tgm_user', JSON.stringify({
          ...storedUser,
          first_name: updated.first_name,
          last_name: updated.last_name,
          avatar_url: updated.avatar_url
        }))
        window.dispatchEvent(new Event('tgm-auth-changed'))
      }
      setMessage('Profile saved successfully.')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (confirmDelete !== 'DELETE') return
    setSaving(true)
    try {
      await deleteMyProviderProfile()
      navigate('/')
    } catch (error) {
      setError(error.message)
      setSaving(false)
    }
  }

  const updateAvailability = async () => {
    if (!calDate) return alert('Select a date')
    setCalSaving(true)
    try {
      const token = JSON.parse(localStorage.getItem('tgm_user')).token
      const res = await fetch(`${API_BASE_URL}/api/provider/availability-slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ date: calDate, status: calStatus })
      })
      if (!res.ok) throw new Error(await res.text())
      alert('Availability updated')
    } catch (e) {
      alert(e.message)
    } finally {
      setCalSaving(false)
    }
  }

  if (loading) return <div className="provider-profile-state"><LoaderCircle className="spinner" />Loading profile…</div>

  return (
    <div className="portal-page provider-layout provider-settings-page">
      <ProviderSidebar />
      <main className="provider-settings-main">
        <header className="provider-settings-header">
          <div>
            <p className="settings-eyebrow">Provider account</p>
            <h1>Public profile settings</h1>
            <span>Your public URL: /provider/{form.public_slug || 'your-slug'}</span>
          </div>
        </header>
        {error && <div className="inline-banner">{error}</div>}
        {message && <div className="inline-banner settings-success"><Check size={16} />{message}</div>}

        <div className="provider-settings-grid">
          <aside className="settings-verification-column">
            <section className="verification-card approved">
              <div className="verification-heading">
                <BadgeCheck size={25} />
                <div>
                  <p className="settings-eyebrow">Verification status</p>
                  <h2>{form.identity_verified ? 'Approved' : 'Pending'}</h2>
                </div>
              </div>
              <p>Identity verification is administered separately from editable public-profile information.</p>
            </section>
            
            <section className="portal-card" style={{ marginTop: '24px' }}>
              <h2>Calendar Blocks</h2>
              <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '16px' }}>Mark specific dates as unavailable for bookings on your profile.</p>
              <Field label="Date">
                <input className="input-field" type="date" value={calDate} onChange={e => setCalDate(e.target.value)} />
              </Field>
              <Field label="Status">
                <select className="input-field" value={calStatus} onChange={e => setCalStatus(e.target.value)}>
                  <option value="unavailable">Unavailable (Blocked)</option>
                  <option value="open">Open (Available)</option>
                </select>
              </Field>
              <button className="btn btn-outline" style={{ width: '100%', marginTop: '8px' }} onClick={updateAvailability} disabled={calSaving}>
                {calSaving ? 'Updating...' : 'Update Availability'}
              </button>
            </section>

            <section className="portal-card provider-account-info" style={{ marginTop: '24px' }}>
              <h2>Provider account lifecycle</h2>
              <p>Accounts are created during authenticated provider onboarding. Edit the public profile here. Deleting removes this provider profile and all its experiences while retaining your traveler login.</p>
            </section>
          </aside>

          <form className="portal-card provider-profile-form" onSubmit={save}>
            <div>
              <p className="settings-eyebrow">Public profile</p>
              <h2>Tell guests about you</h2>
            </div>

            <div className="provider-avatar-editor">
              <div className="settings-avatar settings-avatar-preview">
                {form.avatar_url ? <img src={form.avatar_url} alt="Profile preview" /> : <UserRound size={36} />}
              </div>
              <div>
                <label className="btn btn-outline btn-sm settings-avatar-upload">
                  <Camera size={16} />Choose photo
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseAvatar} />
                </label>
                <small>JPG, PNG, WebP or GIF. Maximum 2 MB.</small>
                {form.avatar_url && <button type="button" className="settings-remove-photo" onClick={() => set('avatar_url', '')}>Remove photo</button>}
              </div>
            </div>

            <div className="listing-field-row">
              <Field label="First name"><input className="input-field" value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></Field>
              <Field label="Last name"><input className="input-field" value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></Field>
            </div>

            <Field label="Business name"><input className="input-field" value={form.business_name || ''} onChange={e => set('business_name', e.target.value)} /></Field>
            <Field label={`Public profile slug${form.avatar_url ? ' (optional with photo)' : ''}`}><input className="input-field" value={form.public_slug || ''} onChange={e => set('public_slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required={!form.avatar_url} /></Field>
            
            <Field label="Bio"><textarea className="input-field" rows="6" minLength="50" maxLength="1000" value={form.bio} onChange={e => set('bio', e.target.value)} required /><span className="input-hint">{form.bio.length}/1000</span></Field>
            <Field label="Location"><input className="input-field" value={form.base_address || ''} onChange={e => set('base_address', e.target.value)} /></Field>
            
            <div className="listing-field-row">
              <Field label="Hourly rate"><input className="input-field" type="number" min="0" step=".01" value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} /></Field>
              <Field label="Currency">
                <select className="input-field" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  <option>USD</option><option>PHP</option><option>EUR</option><option>JPY</option>
                </select>
              </Field>
            </div>
            
            <Field label="Years experience"><input className="input-field" type="number" min="0" value={form.years_experience} onChange={e => set('years_experience', e.target.value)} /></Field>
            
            <Field label="Cover Image URL"><input className="input-field" type="url" value={form.cover_url || ''} onChange={e => set('cover_url', e.target.value)} /></Field>
            
            <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid var(--color-border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', marginBottom: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={hasExternalVideo} onChange={(e) => setHasExternalVideo(e.target.checked)} />
                I have an external video intro (YouTube, Vimeo, etc.)
              </label>
              
              {hasExternalVideo && (
                <Field label="Video URL">
                  <input className="input-field" type="url" placeholder="https://youtube.com/watch?v=..." value={form.video_intro_url || ''} onChange={e => set('video_intro_url', e.target.value)} />
                </Field>
              )}
            </div>

            <Field label="Provider categories">
              <div className="filter-chip-row">
                {['Tour Guide', 'Local Expert', 'Experience Host'].map(value => (
                  <button type="button" key={value} className={`filter-chip ${form.categories.includes(value) ? 'active' : ''}`} onClick={() => set('categories', form.categories.includes(value) ? form.categories.filter(item => item !== value) : [...form.categories, value])}>{value}</button>
                ))}
              </div>
            </Field>

            <Field label="Languages">
              <div className="profile-chip-field">
                <div>
                  {form.languages.map(value => <button type="button" className="chip selected" key={value} onClick={() => set('languages', form.languages.filter(item => item !== value))}>{value}<X size={13} /></button>)}
                </div>
                <div className="settings-inline-add">
                  <input className="input-field" maxLength="10" value={language} onChange={e => setLanguage(e.target.value.toUpperCase())} />
                  <button type="button" className="btn btn-outline" onClick={() => { if (language && !form.languages.includes(language)) set('languages', [...form.languages, language]); setLanguage('') }}><Plus size={15} />Add</button>
                </div>
              </div>
            </Field>

            <Field label="Portfolio image URLs">
              <div className="settings-media-list">
                {form.portfolio_urls.map(url => (
                  <div key={url}><span>{url}</span><button type="button" onClick={() => set('portfolio_urls', form.portfolio_urls.filter(item => item !== url))}><X /></button></div>
                ))}
              </div>
              <div className="settings-inline-add">
                <input className="input-field" type="url" value={portfolio} onChange={e => setPortfolio(e.target.value)} />
                <button type="button" className="btn btn-outline" onClick={() => { if (portfolio) set('portfolio_urls', [...form.portfolio_urls, portfolio]); setPortfolio('') }}><Plus size={15} />Add</button>
              </div>
            </Field>

            <label className="settings-toggle-row">
              <span><strong>Accept custom requests</strong><small>Allow travelers to request direct bookings.</small></span>
              <input className="settings-toggle" type="checkbox" checked={form.is_accepting_custom_requests} onChange={e => set('is_accepting_custom_requests', e.target.checked)} />
            </label>

            <button className="btn btn-primary" disabled={saving}>{saving ? <><LoaderCircle size={16} className="spinner" />Saving…</> : 'Save profile'}</button>

            <section className="settings-danger-zone">
              <Trash2 />
              <div>
                <strong>Delete provider profile</strong>
                <p>Type DELETE to remove the provider profile and all associated experiences.</p>
                <input className="input-field" value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} placeholder="DELETE" />
              </div>
              <button type="button" className="btn btn-outline" disabled={confirmDelete !== 'DELETE' || saving} onClick={remove}>Delete profile</button>
            </section>
          </form>
        </div>
      </main>
    </div>
  )
}

function Field({ label, children }) { return <label className="input-group"><span className="input-label">{label}</span>{children}</label> }
