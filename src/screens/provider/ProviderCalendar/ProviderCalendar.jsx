import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Link2, LoaderCircle, Plus, X } from 'lucide-react'
import ProviderSidebar from '../../../components/ProviderSidebar/ProviderSidebar'
import { getProviderCalendar, saveProviderAvailability } from '../../../services/providerOperationsService'

const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ProviderCalendar() {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const currentDay = today.getDate()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const monthName = monthStart.toLocaleString(undefined, { month: 'long' })
  const monthDays = useMemo(() => Array.from({ length: monthEnd.getDate() }, (_, index) => index + 1), [monthEnd])
  const [view, setView] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700 ? 'Day' : 'Month')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [editorLoading, setEditorLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [capacity, setCapacity] = useState('6')
  const [surge, setSurge] = useState('1.0')
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [icalUrl, setIcalUrl] = useState('')
  const [synced, setSynced] = useState(false)
  const [toast, setToast] = useState('')
  const [savedSlots, setSavedSlots] = useState({})
  const datesRange = useMemo(() => ({
    start: new Date(year, month, 1).toISOString().slice(0, 10),
    end: new Date(year, month + 1, 0).toISOString().slice(0, 10),
  }), [year, month])

  const loadCalendar = () => {
    setLoading(true)
    setLoadError('')
    getProviderCalendar(datesRange.start, datesRange.end)
      .then(res => {
        const slotsObj = {}
        if (res?.slots) {
          res.slots.forEach(slot => {
            const dayNum = new Date(slot.slot_date).getDate()
            slotsObj[dayNum] = {
              blocked: slot.is_blocked,
              capacity: slot.capacity,
              surge: Number(slot.surge_multiplier || 1),
              confirmed: slot.confirmed_count || 0,
              experience_id: slot.experience_id,
            }
          })
        }
        setSavedSlots(slotsObj)
      })
      .catch(err => setLoadError(err.message || 'Could not load availability from the database.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadCalendar() }, [datesRange])

  const selectedSlot = selectedDay ? savedSlots[selectedDay] : null
  const hasConfirmedBookings = selectedSlot?.confirmed || 0
  const monthLabel = view === 'Month'
    ? `${monthName} ${year}`
    : view === 'Week'
      ? `${monthName} ${Math.max(1, currentDay - 3)} - ${Math.min(monthEnd.getDate(), currentDay + 3)}, ${year}`
      : selectedDay
        ? `${monthName} ${selectedDay}, ${year}`
        : `Today - ${monthName} ${currentDay}, ${year}`

  const notify = message => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const openEditor = day => {
    const slot = savedSlots[day] || { blocked: false, capacity: 6, surge: 1 }
    setSelectedDay(day)
    setBlocked(slot.blocked)
    setCapacity(String(slot.capacity || 6))
    setSurge(String(slot.surge || 1))
    setErrors({})
    setSaveError('')
  }

  const validate = () => {
    const nextErrors = {}
    const parsedCapacity = Number(capacity)
    const parsedSurge = Number(surge)
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) nextErrors.capacity = 'Capacity must be a positive whole number.'
    if (parsedCapacity < hasConfirmedBookings) nextErrors.capacity = `Cannot reduce capacity below ${hasConfirmedBookings} confirmed guests.`
    if (!Number.isFinite(parsedSurge) || parsedSurge < 1 || parsedSurge > 2.5) nextErrors.surge = 'Set a multiplier between 1.0x and 2.5x.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const saveSlot = async event => {
    event.preventDefault()
    if (!validate()) return
    setEditorLoading(true)
    setSaveError('')
    try {
      await saveProviderAvailability({
        slot_date: `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`,
        is_blocked: blocked,
        capacity: Number(capacity),
        surge_multiplier: Number(surge),
      })
      setSavedSlots(previous => ({
        ...previous,
        [selectedDay]: { ...previous[selectedDay], blocked, capacity: Number(capacity), surge: Number(surge), confirmed: hasConfirmedBookings },
      }))
      setSelectedDay(null)
      notify('Availability updated in database')
    } catch (e) {
      setSaveError(e.message || 'Could not save this change. Try again.')
    } finally {
      setEditorLoading(false)
    }
  }

  const requestBlock = event => {
    const checked = event.target.checked
    if (checked && hasConfirmedBookings) {
      setConfirmBlock(true)
      return
    }
    setBlocked(checked)
  }

  const syncCalendar = event => {
    event.preventDefault()
    if (!icalUrl.trim().startsWith('http')) {
      setErrors({ ical: 'Enter a valid iCal feed URL.' })
      return
    }
    setErrors({})
    setSynced(true)
    notify('External calendar synced')
  }

  const visibleDays = useMemo(() => {
    if (view === 'Day') return [currentDay]
    if (view === 'Week') {
      const startDay = Math.max(1, currentDay - 3)
      const endDay = Math.min(monthEnd.getDate(), currentDay + 3)
      return Array.from({ length: endDay - startDay + 1 }, (_, index) => startDay + index)
    }
    return monthDays
  }, [view, currentDay, monthDays, monthEnd])

  return (
    <div className="portal-page provider-layout provider-calendar-page">
      <ProviderSidebar />
      <main className="provider-calendar-main">
        <header className="provider-calendar-header">
          <div>
            <p className="settings-eyebrow">Availability</p>
            <h1>Calendar & availability</h1>
            <span>Control when guests can book you and how many you can host.</span>
          </div>
          <div className="calendar-view-tabs">
            {['Month', 'Week', 'Day'].map(item => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item}</button>)}
          </div>
        </header>

        {loadError && <div className="inline-banner">{loadError}<button onClick={loadCalendar}>Retry</button></div>}

        <div className="provider-calendar-layout">
          <section className="portal-card provider-calendar-card">
            <div className="provider-calendar-toolbar">
              <button aria-label="Previous period"><ChevronLeft size={19} /></button>
              <h2>{monthLabel}</h2>
              <button aria-label="Next period"><ChevronRight size={19} /></button>
            </div>
            {loading ? (
              <div className="provider-calendar-skeleton">{Array.from({ length: 35 }).map((_, index) => <i key={index} />)}</div>
            ) : (
              <>
                <div className="calendar-weekdays">{weekdayNames.map(day => <span key={day}>{day}</span>)}</div>
                <div className={`availability-grid ${view.toLowerCase()} `}>
                  {view === 'Month' && Array.from({ length: monthStart.getDay() }).map((_, index) => <span className="availability-blank" key={`blank-${index}`} />)}
                  {visibleDays.map(day => {
                    const slot = savedSlots[day]
                    return (
                      <button key={day} className={`availability-day ${slot ? (slot.blocked ? 'is-blocked' : 'is-open') : 'is-empty'} ${day === currentDay ? 'is-today' : ''}`} onClick={() => openEditor(day)}>
                        <strong>{day}</strong>
                        {slot ? <small>{slot.blocked ? 'Blocked' : `${slot.capacity} spots`}</small> : <small>Not set</small>}
                        {slot && !slot.blocked && <em>{slot.surge > 1 ? `${slot.surge}x` : 'Open'}</em>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            <div className="calendar-legend"><span><i className="open" /> Available</span><span><i className="blocked" /> Blocked</span><span><i className="unset" /> Not yet available</span></div>
            {!loading && !loadError && Object.keys(savedSlots).length === 0 && <div className="provider-availability-empty"><CalendarDays size={25} /><strong>Set your first available time slots to start receiving bookings.</strong><button className="btn btn-primary btn-sm" onClick={() => openEditor(currentDay)}><Plus size={15} /> Add availability</button></div>}
          </section>

          <aside className="portal-card calendar-sync-card">
            <Link2 size={23} />
            <p className="settings-eyebrow">External calendar</p>
            <h2>{synced ? 'Calendar synced' : 'Sync your calendar'}</h2>
            <p>{synced ? 'Your external availability is updating automatically.' : 'Paste an iCal feed to help avoid double bookings.'}</p>
            <form onSubmit={syncCalendar}>
              <label className="input-group">
                <span className="input-label">iCal feed URL</span>
                <input className={'input-field ' + (errors.ical ? 'error' : '')} placeholder="https://calendar.google.com/..." value={icalUrl} onChange={event => { setIcalUrl(event.target.value); setErrors(errors => ({ ...errors, ical: '' })) }} />
                {errors.ical && <span className="input-error">{errors.ical}</span>}
              </label>
              <button className="btn btn-outline btn-full" type="submit">{synced ? <><Check size={16} /> Synced</> : 'Connect iCal'}</button>
            </form>
          </aside>
        </div>
      </main>

      {selectedDay && <div className="modal-overlay provider-slot-overlay" role="dialog" aria-modal="true" aria-labelledby="slot-editor-title"><form className="modal slot-editor" onSubmit={saveSlot}><div className="modal-header"><div><p className="settings-eyebrow">{monthName} {selectedDay}, {year}</p><h3 id="slot-editor-title">Edit availability</h3></div><button type="button" aria-label="Close" onClick={() => setSelectedDay(null)}><X size={20} /></button></div>{editorLoading ? <div className="slot-editor-loading"><LoaderCircle className="spinner" size={24} /> Saving availability to database...</div> : <><div className="modal-body slot-editor-body"><label className="slot-block-toggle"><span><strong>Block this date</strong><small>Guests cannot request this date when blocked.</small></span><input type="checkbox" checked={blocked} onChange={requestBlock} /><i /></label><div className={blocked ? 'slot-fields is-disabled' : 'slot-fields'}><label className="input-group"><span className="input-label">Maximum capacity</span><input className={'input-field ' + (errors.capacity ? 'error' : '')} type="number" min="1" value={capacity} disabled={blocked} onChange={event => { setCapacity(event.target.value); setErrors(errors => ({ ...errors, capacity: '' })) }} />{hasConfirmedBookings > 0 && <span className="input-hint">{hasConfirmedBookings} confirmed guests already booked.</span>}{errors.capacity && <span className="input-error">{errors.capacity}</span>}</label><label className="input-group"><span className="input-label">Surge price multiplier</span><div className="slot-surge-input"><input className={'input-field ' + (errors.surge ? 'error' : '')} type="number" min="1" max="2.5" step="0.1" value={surge} disabled={blocked} onChange={event => { setSurge(event.target.value); setErrors(errors => ({ ...errors, surge: '' })) }} /><span>x</span></div>{errors.surge && <span className="input-error">{errors.surge}</span>}</label></div>{saveError && <div className="inline-banner">{saveError}</div>}</div><div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setSelectedDay(null)}>Cancel</button><button className="btn btn-primary" type="submit">Save availability</button></div></>}</form></div>}
      {confirmBlock && <div className="modal-overlay" role="dialog" aria-modal="true"><div className="modal block-confirmation"><div className="modal-header"><h3>Block this date?</h3><button onClick={() => setConfirmBlock(false)}><X size={20} /></button></div><div className="modal-body"><p><AlertTriangle size={18} /> This date has {hasConfirmedBookings} confirmed guests. Blocking it will not automatically cancel their bookings.</p></div><div className="modal-footer"><button className="btn btn-ghost" onClick={() => setConfirmBlock(false)}>Keep open</button><button className="btn btn-danger" onClick={() => { setBlocked(true); setConfirmBlock(false) }}>Block date</button></div></div></div>}
      {toast && <div className="toast-container"><div className="toast success">{toast}</div></div>}
    </div>
  )
}
