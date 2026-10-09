const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const SEARCH_ENDPOINT = `${API_BASE_URL}/api/search/experiences`

export async function searchExperiences({ query, filters, sort, page, signal }) {
  const params = new URLSearchParams({ page: String(page), page_size: '6', sort })
  if (query) params.set('q', query)
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
  if (filters.minTravelers) params.set('min_travelers', String(filters.minTravelers))
  if (filters.dateStart) params.set('date_start', filters.dateStart)
  if (filters.dateEnd) params.set('date_end', filters.dateEnd)
  let response
  try {
    response = await fetch(`${SEARCH_ENDPOINT}?${params}`, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    throw new Error(`Could not reach the search API at ${SEARCH_ENDPOINT}. Make sure the backend server is running and accessible.`)
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not load search results')
  return body
}
