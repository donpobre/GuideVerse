import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock3, Heart, LayoutGrid, Map, MapPin, Minus, Plus, Search, SlidersHorizontal, Sparkles, Star, X, Zap } from 'lucide-react'
import { searchExperiences } from '../../services/searchService'
import './SearchResults.css'

const sortValues = {
  Recommended: 'recommended',
  'Price: Low to High': 'price_asc',
  'Price: High to Low': 'price_desc',
  'Highest Rated': 'rating',
  'Most Popular': 'popular',
}

const durationOptions = ['0-2h', '2-4h', '4-6h', 'fullday']

const initialResult = {
  items: [],
  total: 0,
  page: 1,
  page_size: 6,
  facets: {
    categories: [],
    languages: [],
    themes: [],
    time_of_day: [],
    activity_levels: [],
    group_types: [],
    min_price: 0,
    max_price: 500,
    min_capacity: 1,
    max_capacity: 8,
    locations: [],
  },
}

function createInitialFilters(params) {
  const getAll = key => params.getAll(key)
  return {
    category: getAll('category'),
    language: getAll('language'),
    themes: getAll('themes'),
    timeOfDay: getAll('time_of_day'),
    activityLevel: getAll('activity_level'),
    durationBucket: getAll('duration_bucket'),
    minPrice: params.get('min_price') || '',
    maxPrice: params.get('max_price') || '',
    rating: Number(params.get('rating') || 0),
    groupType: params.get('group_type') || '',
    instant: params.get('instant') === 'true',
    isAccessible: params.get('is_accessible') === 'true',
    minTravelers: Number(params.get('min_travelers') || 1),
    dateStart: params.get('date_start') || '',
    dateEnd: params.get('date_end') || '',
    flexibleDates: params.get('flexible_dates') === 'true',
  }
}

const formatDuration = minutes => {
  if (!minutes) return 'Flexible'
  if (minutes >= 60) {
    const wholeHours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    if (remainder === 30) return `${wholeHours}.5h`
    if (remainder === 0) return `${wholeHours}h`
    return `${wholeHours}h ${remainder}m`
  }
  return `${minutes}m`
}

const formatPrice = (currency, value) => {
  const amount = Number(value || 0).toFixed(0)
  if (currency === 'PHP') return `Php ${amount}`
  if (currency === 'USD') return `$${amount}`
  return `${currency} ${amount}`
}

const durationLabel = value => value === 'fullday' ? 'Full day' : value.replace('-', '–')

export default function SearchResults() {
  const navigate = useNavigate()
  const [urlParams, setUrlParams] = useSearchParams()
  const [query, setQuery] = useState(urlParams.get('q') || '')
  const [committedQuery, setCommittedQuery] = useState(urlParams.get('q') || '')
  const [viewMode, setViewMode] = useState(urlParams.get('ai') === 'true' ? 'ai' : 'grid')
  const [sortBy, setSortBy] = useState(urlParams.get('sort') ? Object.keys(sortValues).find(label => sortValues[label] === urlParams.get('sort')) || 'Recommended' : 'Recommended')
  const [page, setPage] = useState(Number(urlParams.get('page') || 1))
  const [filterOpen, setFilterOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftFilters, setDraftFilters] = useState(() => createInitialFilters(urlParams))
  const [filters, setFilters] = useState(() => createInitialFilters(urlParams))
  const [result, setResult] = useState(initialResult)
  const resultItems = Array.isArray(result?.items) ? result.items : []
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiMessages, setAiMessages] = useState([{ role: 'assistant', text: "Tell me what matters most and I'll adjust the results." }])
  const [saved, setSaved] = useState(() => new Set(JSON.parse(localStorage.getItem('guideverse:saved-experiences') || '[]')))

  const dateError = filters.dateStart && filters.dateEnd && filters.dateEnd < filters.dateStart ? 'End date must be after start date' : ''

  useEffect(() => {
    const nextQuery = urlParams.get('q') || ''
    if (nextQuery !== query) setQuery(nextQuery)
  }, [urlParams])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(draftFilters)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [draftFilters])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCommittedQuery(query.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const params = new URLSearchParams()
    if (committedQuery) params.set('q', committedQuery)
    if (page > 1) params.set('page', String(page))
    if (sortBy !== 'Recommended') params.set('sort', sortValues[sortBy])
    if (viewMode === 'ai') params.set('ai', 'true')
    filters.category.forEach(value => params.append('category', value))
    filters.language.forEach(value => params.append('language', value))
    filters.themes.forEach(value => params.append('themes', value))
    filters.timeOfDay.forEach(value => params.append('time_of_day', value))
    filters.activityLevel.forEach(value => params.append('activity_level', value))
    filters.durationBucket.forEach(value => params.append('duration_bucket', value))
    if (filters.minPrice) params.set('min_price', filters.minPrice)
    if (filters.maxPrice) params.set('max_price', filters.maxPrice)
    if (filters.rating) params.set('rating', String(filters.rating))
    if (filters.groupType) params.set('group_type', filters.groupType)
    if (filters.instant) params.set('instant', 'true')
    if (filters.isAccessible) params.set('is_accessible', 'true')
    if (filters.minTravelers > 1) params.set('min_travelers', String(filters.minTravelers))
    if (filters.dateStart) params.set('date_start', filters.dateStart)
    if (filters.dateEnd) params.set('date_end', filters.dateEnd)
    if (filters.flexibleDates) params.set('flexible_dates', 'true')
    setUrlParams(params, { replace: true })
  }, [committedQuery, filters, page, setUrlParams, viewMode, sortBy])

  useEffect(() => {
    if (dateError) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    searchExperiences({ query: committedQuery, filters, sort: sortValues[sortBy], page, signal: controller.signal })
      .then(setResult)
      .catch(caught => {
        if (caught.name !== 'AbortError') setError(caught.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [committedQuery, filters, sortBy, page, dateError])

  const categories = result.facets?.categories || []
  const languages = result.facets?.languages || []
  const themes = result.facets?.themes || []
  const timeOfDayOptions = result.facets?.time_of_day?.length ? result.facets.time_of_day : ['Morning', 'Afternoon', 'Evening']
  const activityOptions = result.facets?.activity_levels?.length ? result.facets.activity_levels.map(value => value.charAt(0).toUpperCase() + value.slice(1)) : ['Minimal', 'Moderate', 'High']
  const groupTypeOptions = ['private', 'group']
  const minFacetPrice = Number(result.facets?.min_price || 0)
  const maxFacetPrice = Number(result.facets?.max_price || 500)
  const minCapacity = Number(result.facets?.min_capacity || 1)
  const maxCapacity = Number(result.facets?.max_capacity || 8)
  const locationLabel = useMemo(() => {
    const normalized = committedQuery.trim().toLowerCase()
    if (normalized.includes('cebu, philippines') || normalized.includes('cebu philippines')) return 'Cebu, Philippines'
    return ''
  }, [committedQuery])
  const pageCount = Math.max(1, Math.ceil((result.total || 0) / (result.page_size || 6)))
  const activeFilterCount = useMemo(() => [
    filters.category.length,
    filters.language.length,
    filters.themes.length,
    filters.timeOfDay.length,
    filters.activityLevel.length,
    filters.durationBucket.length,
    filters.groupType,
    filters.minPrice,
    filters.maxPrice,
    filters.rating,
    filters.instant,
    filters.isAccessible,
    filters.minTravelers > minCapacity,
    filters.dateStart,
    filters.dateEnd,
    filters.flexibleDates,
  ].filter(Boolean).length, [filters, minCapacity])

  const activeSearchContext = useMemo(() => [
    committedQuery && { key: 'query', label: committedQuery, onRemove: () => { setQuery(''); setCommittedQuery('') } },
    ...filters.themes.map(theme => ({ key: `theme-${theme}`, label: theme, onRemove: () => setDraftFilters(previous => ({ ...previous, themes: previous.themes.filter(item => item !== theme) })) })),
    filters.minTravelers > 1 && { key: 'travelers', label: `${filters.minTravelers} travelers`, onRemove: () => setDraftFilters(previous => ({ ...previous, minTravelers: 1 })) },
    filters.flexibleDates && { key: 'flexible-dates', label: 'Flexible dates', onRemove: () => setDraftFilters(previous => ({ ...previous, flexibleDates: false })) },
    !filters.flexibleDates && filters.dateStart && { key: 'date-start', label: `From ${filters.dateStart}`, onRemove: () => setDraftFilters(previous => ({ ...previous, dateStart: '', dateEnd: '' })) },
    !filters.flexibleDates && filters.dateEnd && { key: 'date-end', label: `Until ${filters.dateEnd}`, onRemove: () => setDraftFilters(previous => ({ ...previous, dateEnd: '' })) },
  ].filter(Boolean), [committedQuery, filters])

  const setFilter = (key, value) => setDraftFilters(previous => ({ ...previous, [key]: value }))
  const toggleArray = (key, value) => setDraftFilters(previous => ({
    ...previous,
    [key]: previous[key].includes(value) ? previous[key].filter(item => item !== value) : [...previous[key], value],
  }))
  const cycleGroupType = value => setDraftFilters(previous => ({ ...previous, groupType: previous.groupType === value ? '' : value }))
  const changeTravelers = delta => setDraftFilters(previous => {
    const current = Number(previous.minTravelers || minCapacity)
    const next = Math.max(minCapacity, Math.min(maxCapacity, current + delta))
    return { ...previous, minTravelers: next }
  })
  const resetFilters = () => {
    const reset = { ...createInitialFilters(new URLSearchParams()), minTravelers: minCapacity }
    setDraftFilters(reset)
    setFilters(reset)
    setQuery('')
    setCommittedQuery('')
    setPage(1)
  }

  const handleAi = event => {
    event.preventDefault()
    const prompt = aiPrompt.trim()
    if (!prompt) return
    const lower = prompt.toLowerCase()
    let next = { ...draftFilters }
    const notes = []
    if (lower.includes('private')) { next.groupType = 'private'; notes.push('private guides') }
    if (lower.includes('group')) { next.groupType = 'group'; notes.push('group experiences') }
    if (lower.includes('instant')) { next.instant = true; notes.push('instant booking') }
    if (lower.includes('accessible')) { next.isAccessible = true; notes.push('accessible access') }
    if (lower.includes('top rated') || lower.includes('highly rated')) { next.rating = Math.max(next.rating, 4); notes.push('4★ and up') }
    if (lower.includes('affordable') || lower.includes('budget') || lower.includes('under $100')) { next.maxPrice = '100'; notes.push('under $100') }
    themes.forEach(option => { if (lower.includes(option.toLowerCase()) && !next.themes.includes(option)) next.themes = [...next.themes, option] })
    timeOfDayOptions.forEach(option => { if (lower.includes(option.toLowerCase()) && !next.timeOfDay.includes(option)) next.timeOfDay = [...next.timeOfDay, option] })
    activityOptions.forEach(option => { if (lower.includes(option.toLowerCase()) && !next.activityLevel.includes(option)) next.activityLevel = [...next.activityLevel, option] })
    setAiMessages(messages => [...messages, { role: 'user', text: prompt }, { role: 'assistant', text: notes.length ? `Updated results for ${notes.join(', ')}.` : "I've adjusted the results using your request." }])
    setDraftFilters(next)
    setAiPrompt('')
  }

  const openExperience = slug => {
    sessionStorage.setItem('guideverse:search-scroll', String(window.scrollY))
    navigate(`/experience/${slug}`)
  }

  useEffect(() => {
    const savedScroll = sessionStorage.getItem('guideverse:search-scroll')
    if (!savedScroll) return undefined
    const restore = window.setTimeout(() => {
      window.scrollTo(0, Number(savedScroll))
      sessionStorage.removeItem('guideverse:search-scroll')
    }, 80)
    return () => window.clearTimeout(restore)
  }, [])

  const toggleSaved = (id, event) => {
    event.stopPropagation()
    setSaved(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('guideverse:saved-experiences', JSON.stringify([...next]))
      return next
    })
  }

  return (
    <main className="search-page">
      <div className="search-shell container">
        <header className="page-header search-header">
          <div>
            <h1>Search &amp; AI Matcher</h1>
            <p>{locationLabel ? `${result.total || 212} experiences · ${locationLabel}` : `${result.total || 212} experiences`}</p>
          </div>
        </header>

        <div className="search-query">
          <div className="search-query__box">
            <Search size={16} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search destination, guide, or experience" aria-label="Search experiences" />
          </div>
          <div className="view-toggle search-query-actions">
            <ViewButton active={viewMode === 'grid'} onClick={() => setViewMode('grid')} icon={<LayoutGrid size={13} />}>Grid</ViewButton>
            <ViewButton active={viewMode === 'map'} onClick={() => setViewMode('map')} icon={<Map size={13} />}>Map</ViewButton>
            <ViewButton active={viewMode === 'ai'} onClick={() => setViewMode('ai')} icon={<Sparkles size={13} />}>AI</ViewButton>
          </div>
        </div>

        {activeSearchContext.length > 0 && <div className="active-search-context" aria-label="Active search context">
          <span className="active-search-context__label">Searching for</span>
          {activeSearchContext.map(context => <button key={context.key} type="button" className="active-search-chip" onClick={context.onRemove}>{context.label}<X size={12} /></button>)}
          {filters.flexibleDates && <span className="flexible-search-note">Showing experiences with flexible availability</span>}
        </div>}

        <div className="ai-matcher">
          {viewMode === 'ai' && (
            <section className="ai-matcher__panel" id="ai-matcher-panel">
              <div className="ai-matcher__card">
                <div className="ai-matcher__head">
                  <div>
                    <p className="eyebrow">AI Matcher</p>
                    <h3>Tell me what matters most and I'll adjust the results.</h3>
                  </div>
                </div>
                <div className="ai-thread">
                  {aiMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`ai-bubble ${message.role}`}>{message.text}</div>)}
                </div>
                <form className="ai-form" onSubmit={handleAi}>
                  <input className="input-field" value={aiPrompt} onChange={event => setAiPrompt(event.target.value)} placeholder="Try: private guide food under $100" />
                  <button className="btn btn-primary" type="submit">Ask</button>
                </form>
              </div>
            </section>
          )}
        </div>

        <div className="search-layout search-content">
          {filterOpen && <button className="search-overlay" type="button" onClick={() => setFilterOpen(false)} aria-label="Close filters" />}
          <aside className={`sidebar search-sidebar ${filterOpen ? 'open' : ''}`}>
            <div className="sidebar-head">
              <div>
                <h2>Filters</h2>
                <p>{activeFilterCount ? `${activeFilterCount} filters applied` : 'Tune your search'}</p>
              </div>
              <div className="sidebar-head__actions">
                <button type="button" className="clear-link" onClick={resetFilters}>Clear all</button>
                <button type="button" className="icon-close" onClick={() => setFilterOpen(false)} aria-label="Close filters"><X size={16} /></button>
              </div>
            </div>

            <div className="quick-toggles">
              <button type="button" className={`qt-badge ${draftFilters.instant ? 'active' : ''}`} onClick={() => setFilter('instant', !draftFilters.instant)}>⚡ Instant</button>
              <button type="button" className={`qt-badge ${viewMode === 'ai' ? 'active' : ''}`} onClick={() => setViewMode('ai')}>🛠 Custom</button>
              <button type="button" className={`qt-badge ${draftFilters.minTravelers >= 2 ? 'active' : ''}`} onClick={() => setFilter('minTravelers', draftFilters.minTravelers >= 2 ? minCapacity : Math.min(Math.max(2, minCapacity), maxCapacity))}>👶 Kids</button>
            </div>

            <FilterGroup title="Interests">
              <div className="f-chip-row">{themes.map(option => <Chip key={option} active={draftFilters.themes.includes(option)} onClick={() => toggleArray('themes', option)}>{option}</Chip>)}</div>
            </FilterGroup>

            <FilterGroup title="Category">
              <div className="f-chip-row">{categories.map(option => <Chip key={option} active={draftFilters.category.includes(option)} onClick={() => toggleArray('category', option)}>{option}</Chip>)}</div>
            </FilterGroup>

            <FilterGroup title="Group type">
              <div className="f-toggle-row">{groupTypeOptions.map(option => <button key={option} type="button" className={`f-toggle ${draftFilters.groupType === option ? 'active' : ''}`} onClick={() => cycleGroupType(option)}>{option === 'private' ? 'Private' : 'Group OK'}</button>)}</div>
            </FilterGroup>

            <FilterGroup title="Price range">
              <div className="f-price-row"><label className="f-price-field"><span>Min</span><input type="number" min={minFacetPrice} value={draftFilters.minPrice} onChange={event => setFilter('minPrice', event.target.value)} /></label><label className="f-price-field"><span>Max</span><input type="number" min={minFacetPrice} value={draftFilters.maxPrice} onChange={event => setFilter('maxPrice', event.target.value)} /></label></div>
            </FilterGroup>

            <FilterGroup title="Duration">
              <div className="f-duration-grid">{durationOptions.map(option => <label key={option} className={`f-duration-opt ${draftFilters.durationBucket.includes(option) ? 'active' : ''}`}><input type="checkbox" checked={draftFilters.durationBucket.includes(option)} onChange={() => toggleArray('durationBucket', option)} />{durationLabel(option)}</label>)}</div>
            </FilterGroup>

            <FilterGroup title="Travellers">
              <div className="f-traveller-stepper"><button type="button" onClick={() => changeTravelers(-1)} aria-label="Decrease travelers"><Minus size={14} /></button><strong>{draftFilters.minTravelers}</strong><button type="button" onClick={() => changeTravelers(1)} aria-label="Increase travelers"><Plus size={14} /></button></div>
            </FilterGroup>

            <FilterGroup title="Languages">
              <div className="f-chip-row">{languages.map(option => <Chip key={option} active={draftFilters.language.includes(option)} onClick={() => toggleArray('language', option)}>{option}</Chip>)}</div>
            </FilterGroup>

            <FilterGroup title="Rating">
              <div className="f-stars">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" className={`f-star-btn ${value <= Math.floor(draftFilters.rating || 0) ? 'active' : ''}`} onClick={() => setFilter('rating', draftFilters.rating === value ? 0 : value)} aria-label={`Minimum rating ${value}`}><Star size={18} fill="currentColor" /></button>)}</div>
            </FilterGroup>

            <FilterGroup title="Time of day">
              <div className="f-chip-row">{timeOfDayOptions.map(option => <Chip key={option} active={draftFilters.timeOfDay.includes(option)} onClick={() => toggleArray('timeOfDay', option)}>{option}</Chip>)}</div>
            </FilterGroup>

            <FilterGroup title="Activity & access">
              <div className="f-chip-row">{activityOptions.map(option => <Chip key={option} active={draftFilters.activityLevel.includes(option)} onClick={() => toggleArray('activityLevel', option)}>{option}</Chip>)}<Chip active={draftFilters.isAccessible} onClick={() => setFilter('isAccessible', !draftFilters.isAccessible)}>♿ Accessible</Chip></div>
            </FilterGroup>

            <FilterGroup title="Availability">
              <div className="toggle-stack"><label className="check-toggle"><input type="checkbox" checked={draftFilters.instant} onChange={event => setFilter('instant', event.target.checked)} /> Instant book only</label></div>
              <div className="input-pair input-pair--dates"><label><span>Start</span><input className="input-field" type="date" value={draftFilters.dateStart} onChange={event => setFilter('dateStart', event.target.value)} /></label><label><span>End</span><input className="input-field" type="date" value={draftFilters.dateEnd} onChange={event => setFilter('dateEnd', event.target.value)} /></label></div>
              {dateError && <p className="filter-error">{dateError}</p>}
            </FilterGroup>

            <button className="f-apply-btn" type="button" onClick={() => setFilterOpen(false)}>Apply filters</button>
          </aside>

          <section className="results-main">
            <div className="results-bar">
              <div className="results-count"><strong>{result.total}</strong> results match your filters</div>
              <div className="results-bar__actions">
                <select className="sort-select" value={sortBy} onChange={event => { setSortBy(event.target.value); setPage(1) }}>
                  {Object.keys(sortValues).map(value => <option key={value}>{value}</option>)}
                </select>
                <button className="btn btn-outline btn-sm filters-mobile-btn" type="button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={16} /> Filters</button>
              </div>
            </div>

            {error && <div className="search-error" role="alert"><p>{error}</p><button className="btn btn-primary btn-sm" type="button" onClick={() => setFilters({ ...filters })}>Retry</button></div>}

            {loading ? <div className="results-grid">{[1, 2, 3, 4, 5, 6].map(value => <div key={value} className="tour-card skeleton-card"><div className="tour-card__photo-wrap skeleton-block" /><div className="tour-card__body"><div className="skeleton-line long" /><div className="skeleton-line" /><div className="skeleton-line short" /></div></div>)}</div> : null}

            {!loading && !error && viewMode === 'map' ? (
              <div className="map-layout">
                <div className="results-grid">{resultItems.map(item => <SearchCard key={item.id} item={item} saved={saved.has(item.id)} onToggleSaved={toggleSaved} onOpen={() => openExperience(item.slug)} />)}</div>
                <div className="map-panel"><div className="map-panel__header"><h3>Result locations</h3><span>{resultItems.length} pins</span></div><div className="map-placeholder">{result.items.map(item => <button key={item.id} type="button" onClick={() => navigate(`/experience/${item.slug}`)}><span>{item.title}</span><small>{item.location}</small></button>)}</div></div>
              </div>
            ) : null}

            {!loading && !error && viewMode !== 'map' && resultItems.length ? (
              <>
                <div className="results-grid">{resultItems.map(item => <SearchCard key={item.id} item={item} saved={saved.has(item.id)} onToggleSaved={toggleSaved} onOpen={() => openExperience(item.slug)} />)}</div>
                <nav className="pagination">
                  <button className="page-btn" type="button" disabled={page === 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={14} /></button>
                  <span className="page-info">Page {page} of {pageCount}</span>
                  <button className="page-btn" type="button" disabled={page === pageCount} onClick={() => setPage(current => Math.min(pageCount, current + 1))}><ChevronRight size={14} /></button>
                </nav>
              </>
            ) : null}

            {!loading && !error && !resultItems.length? (
              <div className="empty-state">
                <Search size={28} />
                <h3>No experiences match these filters</h3>
                <p>Try widening the price range, removing a few filters, or searching a broader destination.</p>
                <button className="btn btn-primary" type="button" onClick={resetFilters}>Clear filters</button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}

function SearchCard({ item, saved, onToggleSaved, onOpen }) {
  return (
    <article className="tour-card" onClick={onOpen} onKeyDown={event => event.key === 'Enter' && onOpen()} tabIndex="0">
      <div className="tour-card__photo-wrap">
        {item.image ? <div className="tour-card__photo" style={{ backgroundImage: `url(${item.image})` }} /> : <div className="tour-card__photo tour-card__photo--fallback">GuideVerse</div>}
        <div className="tour-card__photo-scrim" />
        <div className="tour-card__badges">
          {item.is_instant_book && <span className="tc-badge tc-badge--instant"><Zap size={12} /> Instant</span>}
          {item.group_type === 'private' && <span className="tc-badge tc-badge--private">Private</span>}
          {item.group_type === 'group' && <span className="tc-badge tc-badge--group">Group friendly</span>}
          {item.provider_verified && <span className="tc-badge tc-badge--verified">✓ Verified host</span>}
        </div>
        <button type="button" className={`tour-card__heart ${saved ? 'saved' : ''}`} onClick={event => onToggleSaved(item.id, event)} aria-label="Save experience"><Heart size={16} fill={saved ? 'currentColor' : 'none'} /></button>
        <div className="tour-card__price-tag">{formatPrice(item.currency, item.price)}<span>/person</span></div>
      </div>

      <div className="tour-card__body">
        <h3 className="tour-card__title">{item.title}</h3>
        <div className="tour-card__themes">{(item.themes || []).slice(0, 3).map(theme => <span key={theme} className="tc-theme">{theme}</span>)}</div>
        <div className="tour-card__location"><MapPin size={13} /> {item.location || item.destination || 'Location shared after booking'}</div>
        <div className={`tour-card__availability ${item.available_for_dates === false ? 'is-unavailable' : ''}`}>{item.available_for_dates === true ? '✓ Available for selected dates' : item.available_for_dates === false ? 'Check availability for selected dates' : 'Availability varies by date'}</div>
        <div className="tour-card__guide">
          {item.guide_avatar ? <img src={item.guide_avatar} alt={item.guide_name || 'Guide'} /> : <div className="tour-card__guide-avatar">{(item.guide_name || 'G').charAt(0)}</div>}
          <div>
            <span className="tour-card__guide-label">Your guide</span>
            <span className="tour-card__guide-name">{item.guide_name || 'Local host'}</span>
          </div>
        </div>
        <div className="tour-card__divider" />
        <div className="tour-card__meta-row">
          <span className="tour-card__rating"><Star size={13} fill="currentColor" /> {Number(item.rating || 0).toFixed(1)} <small>({item.review_count || 0})</small></span>
          <span className="tour-card__duration"><Clock3 size={13} /> {formatDuration(item.duration_minutes)}</span>
        </div>
      </div>
    </article>
  )
}

function FilterGroup({ title, children }) {
  return <section className="f-group filter-group"><div className="f-group-title">{title}</div>{children}</section>
}

function Chip({ active, onClick, children }) {
  return <button type="button" className={`f-chip ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>
}

function ViewButton({ active, onClick, icon, children }) {
  return <button type="button" className={`view-toggle-btn ${active ? 'active' : ''}`} onClick={onClick}>{icon}{children}</button>
}