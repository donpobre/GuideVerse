import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bot, Check, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, LoaderCircle, LocateFixed, MapPin, Plus, Save, Sparkles, Trash2, X } from 'lucide-react'
import ProviderSidebar from '../../../components/ProviderSidebar/ProviderSidebar'
import { createExperience, getProviderExperience, updateExperience } from '../../../services/providerExperienceService'
import { getPublicTourLocations } from '../../../services/tourLocationService'

const steps = ['Category & Info', 'AI Assistant', 'Route & Map', 'Pricing & Policies', 'Media']
const categories = ['Tour Guide', 'Local Expert', 'Experience Host']
const photoSeeds = ['https://images.unsplash.com/photo-1526481280695-3c687fd643ed?w=600&q=80', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80', 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600&q=80']
const initialListing = { title: '', category: '', brief: '', description: '', duration: 180, durationUnit: 'minutes', capacity: 8, destination: '', meetingAddress: '', latitude: '10.3157', longitude: '123.8854', price: '', currency: 'USD', policy: 'moderate', groupType: 'both', activityLevel: 'moderate', isAccessible: false, isInstantBook: false, themes: [], timeOfDay: [], inclusions: '', exclusions: '', requirements: '', photos: [], stops: [], priceGroups: [] }

const durationToMinutes = (value, unit) => Number(value || 0) * (unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1)
const minutesToDuration = minutes => {
  const value = Number(minutes || 0)
  if (value >= 1440 && value % 1440 === 0) return { duration: value / 1440, durationUnit: 'days' }
  if (value >= 60 && value % 60 === 0) return { duration: value / 60, durationUnit: 'hours' }
  return { duration: value, durationUnit: 'minutes' }
}
const timeOfDayOptions = ['Morning', 'Afternoon', 'Evening', 'Whole day']

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
const editorHtml = value => /<\/?(p|h[1-3]|strong|b|ul|ol|li|br)\b/i.test(String(value || '')) ? value : `<p>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`

function RichDescriptionEditor({ value, onChange, error }) {
  const editorRef = useRef(null)
  const initializedRef = useRef(false)
  const selectionRef = useRef(null)

  useEffect(() => {
    if (!editorRef.current || initializedRef.current && (editorRef.current.innerHTML.trim() && String(value || '').trim())) return
    editorRef.current.innerHTML = editorHtml(value)
    initializedRef.current = true
  }, [value])

  const saveSelection = () => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return
    selectionRef.current = selection.getRangeAt(0).cloneRange()
  }

  const restoreSelection = () => {
    if (!selectionRef.current) return
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(selectionRef.current)
  }

  const command = (name, commandValue = null) => {
    restoreSelection()
    editorRef.current?.focus()
    document.execCommand(name, false, commandValue)
    saveSelection()
    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  return <div className="rich-description-editor">
    <div className="rich-description-toolbar" role="toolbar" aria-label="Description formatting">
      <select aria-label="Text style" defaultValue="p" onMouseDown={event => { saveSelection(); event.preventDefault() }} onChange={event => command('formatBlock', event.target.value)}><option value="p">Paragraph</option><option value="h3">Heading</option><option value="h2">Large heading</option></select>
      <button type="button" aria-label="Bold" onMouseDown={event => event.preventDefault()} onClick={() => command('bold')}><strong>B</strong></button>
      <button type="button" aria-label="Italic" onMouseDown={event => event.preventDefault()} onClick={() => command('italic')}><em>I</em></button>
      <button type="button" aria-label="Underline" onMouseDown={event => event.preventDefault()} onClick={() => command('underline')}><u>U</u></button>
      <button type="button" aria-label="Bulleted list" onMouseDown={event => event.preventDefault()} onClick={() => command('insertUnorderedList')}>• List</button>
      <button type="button" aria-label="Numbered list" onMouseDown={event => event.preventDefault()} onClick={() => command('insertOrderedList')}>1. List</button>
      <button type="button" aria-label="Align left" onMouseDown={event => event.preventDefault()} onClick={() => command('justifyLeft')}>左</button>
      <button type="button" aria-label="Align center" onMouseDown={event => event.preventDefault()} onClick={() => command('justifyCenter')}>↔</button>
      <button type="button" aria-label="Add link" onMouseDown={event => event.preventDefault()} onClick={() => { const url = window.prompt('Enter a URL'); if (url) command('createLink', url) }}>Link</button>
      <button type="button" aria-label="Clear formatting" onMouseDown={event => event.preventDefault()} onClick={() => command('removeFormat')}>Clear</button>
    </div>
    <div ref={editorRef} className="rich-description-input" contentEditable role="textbox" aria-multiline="true" onMouseUp={saveSelection} onKeyUp={saveSelection} onInput={event => onChange(event.currentTarget.innerHTML)} />
    {error && <span className="input-error">{error}</span>}
  </div>
}

export default function ListingBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const [step, setStep] = useState(0)
  const [listing, setListing] = useState(initialListing)
  const [errors, setErrors] = useState({})
  const [aiLoading, setAiLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [status, setStatus] = useState('Draft')
  const [wasPublished, setWasPublished] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [tourLocations, setTourLocations] = useState([])
  const [themesText, setThemesText] = useState('')
  const [destinationText, setDestinationText] = useState('')
  const set = (key, value) => { setListing(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })) }
  const splitList = value => value.split(',').map(item => item.trim()).filter(Boolean)
  const addDestination = value => {
    const additions = splitList(value)
    if (!additions.length) return
    const destinations = [...new Set([...splitList(listing.destination), ...additions])]
    set('destination', destinations.join(', '))
    setDestinationText('')
  }
  const uploadPhotos = event => {
    const files = [...(event.target.files || [])]
    if (!files.length) return
    const available = Math.max(0, 6 - listing.photos.length)
    const selected = files.slice(0, available)
    if (files.some(file => !file.type.startsWith('image/'))) return setPublishError('Choose image files only.')
    if (selected.some(file => file.size > 2 * 1024 * 1024)) return setPublishError('Each photo must be smaller than 2 MB.')
    Promise.all(selected.map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })))
      .then(images => { set('photos', [...listing.photos, ...images]); setPublishError(''); event.target.value = '' })
      .catch(() => setPublishError('One of the photos could not be read.'))
  }
  const useCurrentLocation = () => {
    if (!navigator.geolocation) return setPublishError('Location services are not supported by this browser.')
    navigator.geolocation.getCurrentPosition(position => { setListing(current => ({ ...current, latitude: position.coords.latitude.toFixed(6), longitude: position.coords.longitude.toFixed(6) })); setErrors(current => ({ ...current, coordinates: '' })); setPublishError('') }, error => { const message = error?.code === 1 ? 'Location permission was declined. Enter latitude and longitude manually or allow location access in your browser.' : 'Location could not be detected. Enter latitude and longitude manually or try again.'; setPublishError(message) }, { enableHighAccuracy: true, timeout: 10000 })
  }

  useEffect(() => {
    getPublicTourLocations().then(locations => setTourLocations(locations.map(location => location.name))).catch(() => {})
  }, [])

  useEffect(() => {
    if (!editing) return
    setPublishing(true)
    getProviderExperience(id).then(item => {
      const mainDuration = minutesToDuration(item.duration_minutes)
      setListing({
        title: item.title, category: item.category, brief: '', description: item.description,
        ...mainDuration, capacity: item.max_capacity,
        destination: item.destination || item.meeting_address || '', meetingAddress: item.meeting_address, latitude: item.latitude, longitude: item.longitude,
        price: item.base_price, currency: item.currency, policy: item.cancellation_policy,
        groupType: item.group_type || 'both', activityLevel: item.activity_level || 'moderate',
        isAccessible: Boolean(item.is_accessible), isInstantBook: Boolean(item.is_instant_book),
        themes: Array.isArray(item.themes) ? item.themes : [], timeOfDay: Array.isArray(item.time_of_day) ? item.time_of_day : [],
        inclusions: (item.inclusions || []).join(', '), exclusions: (item.exclusions || []).join(', '), requirements: (item.requirements || []).join(', '),
        photos: item.media_urls || [],
        stops: (item.itinerary_stops || []).map(stop => ({ title: stop.title, description: stop.description || '', ...minutesToDuration(stop.duration_minutes) })),
        priceGroups: (item.price_groups || []).map(group => ({ persons: group.number_of_person, price: group.base_price })),
      })
      setThemesText(Array.isArray(item.themes) ? item.themes.join(', ') : '')
      setDestinationText('')
      setStatus(item.is_published ? 'Published' : 'Draft')
      setWasPublished(item.is_published)
    }).catch(error => setPublishError(error.message || 'Could not load this experience. Check that it belongs to your provider account and that the listing still exists.')).finally(() => setPublishing(false))
  }, [editing, id])

  const valid = target => {
    const e = {}
    if (target === 0) {
      if (listing.title.trim().length < 10) e.title = 'Use at least 10 characters.'
      if (!listing.category) e.category = 'Choose a category.'
      if (!listing.destination.trim()) e.destination = 'Enter the destination or trip area.'
      if (!Number(listing.duration)) e.duration = 'Enter the duration.'
      if (!Number(listing.capacity)) e.capacity = 'Enter the maximum capacity.'
    }
    if (target === 1 && listing.description.trim().length < 20) e.description = 'Add a description of at least 20 characters.'
    if (target === 2) {
      if (!listing.meetingAddress.trim()) e.meetingAddress = 'Enter the meeting address.'
      const latitude = Number(listing.latitude), longitude = Number(listing.longitude)
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) e.coordinates = 'Enter valid latitude and longitude coordinates.'
    }
    if (target === 3) {
      if (!Number(listing.price)) e.price = 'Enter a positive base price.'
      if (listing.priceGroups.some(group => !group.persons || !Number(group.price))) e.priceGroups = 'Complete or remove unfinished group prices.'
    }
    if (target === 4 && listing.photos.length < 1) e.photos = 'Add at least one hosted image URL.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const validateAll = () => {
    for (const target of [0, 1, 2, 3, 4]) {
      if (!valid(target)) { setStep(target); return false }
    }
    return true
  }
  const next = () => valid(step) && setStep(current => Math.min(4, current + 1))
  const generate = () => {
    setAiLoading(true)
    setPublishError('')
    window.setTimeout(() => {
      setListing(current => {
        const brief = current.brief.trim()
        const destination = current.destination.trim() || 'the destination'
        const generatedTitle = current.title.trim() || `${destination.split(',')[0]} local experience`
        const generatedDescription = brief.length >= 20
          ? `<p>${escapeHtml(brief)}</p><h3>What to expect</h3><ul><li>Local guidance and thoughtful pacing</li><li>Memorable stops shaped around your interests</li><li>Clear meeting instructions before the experience</li></ul>`
          : `<p>Explore ${escapeHtml(destination)} with a local expert who brings the route, stories, and small details to life.</p><h3>What to expect</h3><ul><li>Local guidance and thoughtful pacing</li><li>Memorable stops shaped around your interests</li><li>Clear meeting instructions before the experience</li></ul>`
        return { ...current, title: generatedTitle, description: generatedDescription }
      })
      setAiLoading(false)
    }, 500)
  }
  const save = async isPublished => {
    if (!validateAll()) return setPublishError(`Complete the highlighted fields before ${isPublished ? 'publishing' : 'saving the database draft'}.`)
    setPublishing(true); setPublishError('')
    try {
      const payload = {
        title: listing.title, description: listing.description, category: listing.category,
         duration_minutes: durationToMinutes(listing.duration, listing.durationUnit), max_capacity: Number(listing.capacity),
        base_price: Number(listing.price), currency: listing.currency, cancellation_policy: listing.policy,
         destination: listing.destination, meeting_address: listing.meetingAddress, latitude: Number(listing.latitude), longitude: Number(listing.longitude),
        inclusions: splitList(listing.inclusions), exclusions: splitList(listing.exclusions), requirements: splitList(listing.requirements),
         itinerary_stops: listing.stops.map(stop => ({ title: stop.title, description: stop.description || null, duration_minutes: durationToMinutes(stop.duration, stop.durationUnit) })),
        price_groups: listing.priceGroups.map(group => ({ number_of_person: group.persons, base_price: Number(group.price) })),
        media_urls: listing.photos.filter(Boolean), is_published: isPublished || wasPublished,
        group_type: listing.groupType, activity_level: listing.activityLevel,
        is_accessible: listing.isAccessible, is_instant_book: listing.isInstantBook,
         themes: splitList(themesText), time_of_day: listing.timeOfDay,
      }
      const created = editing ? await updateExperience(id, payload) : await createExperience(payload)
      setStatus(isPublished || wasPublished ? 'Published' : 'Draft saved')
      setWasPublished(isPublished || wasPublished)
      if (isPublished) navigate(`/experience/${created.slug}`)
      else if (!editing) navigate(`/app/provider/listings/${created.id}/edit`)
    } catch (error) { setPublishError(error.message) } finally { setPublishing(false) }
  }

  return <div className="portal-page provider-layout listing-page"><ProviderSidebar /><main className="listing-main">
    <header className="listing-header"><div><p className="settings-eyebrow">Experience listing</p><h1>{editing ? 'Edit experience' : 'Create an experience'}</h1><span>PostgreSQL record · {status}</span></div><button className="btn btn-outline btn-sm" disabled={publishing} onClick={() => save(false)}><Save size={15} /> {editing ? 'Save changes' : 'Save draft'}</button></header>
    <div className="listing-stepper">{steps.map((name, index) => <button key={name} className={index === step ? 'active' : index < step ? 'done' : ''} onClick={() => setStep(index)}><b>{index < step ? <Check size={14} /> : index + 1}</b><span>{name}</span></button>)}</div>
    {publishError && <div className="inline-banner listing-publish-error">{publishError}</div>}
    <section className="portal-card listing-card"><p className="settings-eyebrow">Step {step + 1} of 5</p><h2>{steps[step]}</h2>
      {step === 0 && <div className="listing-fields">
        <Field label="Experience title" error={errors.title}><input className="input-field" value={listing.title} onChange={e => set('title', e.target.value)} placeholder="Sunset Sailing Tour in Cebu Bay" /></Field>
        <Field label="Category" error={errors.category}><select className="input-field" value={listing.category} onChange={e => set('category', e.target.value)}><option value="">Select category</option>{categories.map(category => <option key={category}>{category}</option>)}</select></Field>
        <Field label="Destination or trip area *" error={errors.destination}><div className="destination-picker"><div className="destination-picker__input"><select className="input-field" value="" onChange={e => addDestination(e.target.value)}><option value="">Select a saved location…</option>{tourLocations.filter(location => !splitList(listing.destination).includes(location)).map(location => <option key={location} value={location}>{location}</option>)}</select><input className="input-field" list="provider-tour-locations" value={destinationText} onChange={e => setDestinationText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDestination(destinationText) } }} placeholder="Or type a new destination" /><button type="button" className="btn btn-outline btn-sm" onClick={() => addDestination(destinationText)}><Plus size={15}/> Add</button></div><datalist id="provider-tour-locations">{tourLocations.map(location => <option key={location} value={location} />)}</datalist><div className="destination-chip-row">{splitList(listing.destination).map(destination => <span className="destination-chip" key={destination}>{destination}<button type="button" aria-label={`Remove ${destination}`} onClick={() => set('destination', splitList(listing.destination).filter(item => item !== destination).join(', '))}><X size={13}/></button></span>)}</div><small className="listing-help">Select a saved location or type a new one, then click Add. Remove any destination with ×.</small></div></Field>
        <div className="listing-field-row listing-duration-row"><Field label="Duration" error={errors.duration}><div className="listing-unit-field"><input className="input-field" type="number" min="1" value={listing.duration} onChange={e => set('duration', e.target.value)} /><select className="input-field" value={listing.durationUnit} onChange={e => set('durationUnit', e.target.value)}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div><small className="listing-help">Converted to minutes for booking and availability.</small></Field><Field label="Maximum guests" error={errors.capacity}><input className="input-field" type="number" min="1" value={listing.capacity} onChange={e => set('capacity', e.target.value)} /></Field></div>
        <div className="listing-field-row"><Field label="Group type"><select className="input-field" value={listing.groupType} onChange={e => set('groupType', e.target.value)}><option value="both">Private and group</option><option value="private">Private only</option><option value="group">Group only</option></select></Field><Field label="Activity level"><select className="input-field" value={listing.activityLevel} onChange={e => set('activityLevel', e.target.value)}><option value="minimal">Minimal</option><option value="moderate">Moderate</option><option value="high">High</option></select></Field></div>
        <div className="listing-field-row listing-themes-row"><Field label="Themes / interests"><input className="input-field" value={themesText} onChange={e => { setThemesText(e.target.value); set('themes', splitList(e.target.value)) }} placeholder="Food, History, Photography" /><small className="listing-help">Use commas to add more than one interest.</small></Field><Field label="Time of day"><div className="listing-chip-row">{timeOfDayOptions.map(option => <button type="button" key={option} className={`listing-chip ${listing.timeOfDay.includes(option) ? 'active' : ''}`} onClick={() => set('timeOfDay', listing.timeOfDay.includes(option) ? listing.timeOfDay.filter(item => item !== option) : [...listing.timeOfDay, option])}>{option}</button>)}</div></Field></div>
        <div className="listing-toggle-row"><label className="listing-check"><input type="checkbox" checked={listing.isInstantBook} onChange={e => set('isInstantBook', e.target.checked)} /> Instant booking</label><label className="listing-check"><input type="checkbox" checked={listing.isAccessible} onChange={e => set('isAccessible', e.target.checked)} /> Accessible experience</label></div>
      </div>}
      {step === 1 && <div className="listing-fields"><Field label="Tell AI about your experience"><textarea className="input-field" rows="3" value={listing.brief} onChange={e => set('brief', e.target.value)} /></Field><button className="btn btn-primary listing-ai" onClick={generate} disabled={aiLoading}>{aiLoading ? <><LoaderCircle size={16} className="spinner" /> Generating…</> : <><Bot size={16} /> Generate with AI</>}</button><Field label="Description" error={errors.description}><RichDescriptionEditor value={listing.description} onChange={value => set('description', value)} error={errors.description} /></Field><Field label="Inclusions (comma separated)"><input className="input-field" value={listing.inclusions} onChange={e => set('inclusions', e.target.value)} /></Field><Field label="Exclusions (comma separated)"><input className="input-field" value={listing.exclusions} onChange={e => set('exclusions', e.target.value)} /></Field><Field label="Guest requirements (comma separated)"><input className="input-field" value={listing.requirements} onChange={e => set('requirements', e.target.value)} /></Field></div>}
      {step === 2 && <div className="listing-route"><div className="listing-map"><iframe title="Exact meeting location on Google Maps" src={`https://www.google.com/maps?q=${encodeURIComponent(`${listing.latitude || 0},${listing.longitude || 0}`)}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><div className="listing-map-actions"><button type="button" className="btn btn-outline btn-sm" onClick={useCurrentLocation}><LocateFixed size={15}/>Use current location</button><a className="btn btn-outline btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${listing.latitude},${listing.longitude}`)}`} target="_blank" rel="noreferrer"><ExternalLink size={15}/>Open in Google Maps</a></div></div><Field label="Meeting Address" error={errors.meetingAddress}><input className="input-field" value={listing.meetingAddress} onChange={e => set('meetingAddress', e.target.value)} placeholder="Enter the exact meeting address" /></Field><div className="listing-field-row"><Field label="Latitude"><input className="input-field" type="number" min="-90" max="90" step="any" value={listing.latitude} onChange={e => set('latitude', e.target.value)} /></Field><Field label="Longitude" error={errors.coordinates}><input className="input-field" type="number" min="-180" max="180" step="any" value={listing.longitude} onChange={e => set('longitude', e.target.value)} /></Field></div><p className="listing-help">The embedded map previews your coordinates. If browser location access is unavailable, enter latitude and longitude manually or use Open in Google Maps to copy coordinates.</p>{publishError && <div className="listing-location-help"><MapPin size={15}/><span>{publishError}</span></div>}<div className="listing-stops">{listing.stops.map((stop, index) => <div key={index} className="listing-stop-row"><b>{index + 1}</b><input className="input-field" placeholder="Stop title" value={stop.title} onChange={e => set('stops', listing.stops.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} /><input className="input-field" placeholder="Description (optional)" value={stop.description || ''} onChange={e => set('stops', listing.stops.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} /><div className="listing-unit-field listing-stop-duration"><input className="input-field" type="number" min="1" value={stop.duration} onChange={e => set('stops', listing.stops.map((item, i) => i === index ? { ...item, duration: e.target.value } : item))} /><select className="input-field" value={stop.durationUnit || 'minutes'} onChange={e => set('stops', listing.stops.map((item, i) => i === index ? { ...item, durationUnit: e.target.value } : item))}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div><button type="button" className="btn btn-outline btn-sm" onClick={() => set('stops', listing.stops.filter((_, i) => i !== index))}><Trash2 size={15}/></button></div>)}<button type="button" className="btn btn-outline btn-sm" onClick={() => set('stops', [...listing.stops, { title: '', description: '', duration: 30, durationUnit: 'minutes' }])}><Plus size={15}/> Add stop</button></div></div>}
      {step === 3 && <div className="listing-fields"><div className="listing-field-row"><Field label="Base price per person" error={errors.price}><input className="input-field" type="number" min="1" step="0.01" value={listing.price} onChange={e => set('price', e.target.value)} /></Field><Field label="Currency"><select className="input-field" value={listing.currency} onChange={e => set('currency', e.target.value)}><option>USD</option><option>PHP</option><option>EUR</option><option>JPY</option></select></Field></div><Field label="Cancellation policy"><select className="input-field" value={listing.policy} onChange={e => set('policy', e.target.value)}><option value="flexible">Flexible</option><option value="moderate">Moderate</option><option value="strict">Strict</option></select></Field><h3>Group prices</h3><p className="listing-help">Use an exact count such as 2 or a range such as 3-5. Price per person in this range.</p>{listing.priceGroups.map((group, index) => <div className="listing-field-row" key={index}><input className="input-field" placeholder="Persons (e.g. 3-5)" value={group.persons} onChange={e => set('priceGroups', listing.priceGroups.map((item, i) => i === index ? { ...item, persons: e.target.value } : item))} /><input className="input-field" type="number" min="1" step="0.01" placeholder="Price per person" value={group.price} onChange={e => set('priceGroups', listing.priceGroups.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} /><button onClick={() => set('priceGroups', listing.priceGroups.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>)}<button className="btn btn-outline" onClick={() => set('priceGroups', [...listing.priceGroups, { persons: '', price: '' }])}><Plus size={16} /> Add group price</button>{errors.priceGroups && <span className="input-error">{errors.priceGroups}</span>}</div>}
      {step === 4 && <div className="listing-media"><label className="listing-uploader"><ImagePlus size={30}/><strong>Upload experience photos</strong><span>Choose up to 6 JPG, PNG, WebP, or GIF images. Maximum 2 MB each.</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={uploadPhotos}/></label><button className="btn btn-outline btn-sm" onClick={() => set('photos', [...new Set([...listing.photos, ...photoSeeds])].slice(0, 6))}><Sparkles size={15}/>Add sample photos</button><Field label="Or add an image URL"><div className="listing-url-add"><input id="listing-image-url" className="input-field" placeholder="https://…"/><button className="btn btn-outline" onClick={() => { const input = document.getElementById('listing-image-url'); if (input.value && listing.photos.length < 6) { set('photos', [...listing.photos, input.value]); input.value = '' } }}>Add</button></div></Field><div className="listing-photo-grid">{listing.photos.map((src, index) => <div key={`${src.slice(0, 40)}-${index}`}><img src={src} alt={`Experience photo ${index + 1}`}/><button aria-label={`Remove photo ${index + 1}`} onClick={() => set('photos', listing.photos.filter((_, i) => i !== index))}><X size={15}/></button></div>)}</div><span className="listing-photo-count">{listing.photos.length}/6 photos</span>{errors.photos && <span className="input-error">{errors.photos}</span>}</div>}
    </section>
    <footer className="listing-actions"><button className="btn btn-ghost" disabled={!step} onClick={() => setStep(current => current - 1)}><ChevronLeft size={16} /> Back</button>{step < 4 ? <button className="btn btn-primary" onClick={next}>Next <ChevronRight size={16} /></button> : <button className="btn btn-primary" onClick={() => save(true)} disabled={publishing}>{publishing ? <><LoaderCircle size={16} className="spinner" /> Publishing…</> : 'Publish experience'}</button>}</footer>
  </main></div>
}

function Field({ label, error, children }) { return <label className="input-group"><span className="input-label">{label}</span>{children}{error && <span className="input-error">{error}</span>}</label> }
