const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function formatDuration(minutes) {
  if (!minutes) return 'Duration not specified'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return [hours && `${hours} ${hours === 1 ? 'hour' : 'hours'}`, remainder && `${remainder} min`]
    .filter(Boolean)
    .join(' ')
}

function initials(firstName = '', lastName = '') {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'GV'
}

// Maps the API's PostgreSQL-shaped response to the UI model. Keeping this here
// prevents database column names from leaking throughout the React components.
export function mapExperience(record) {
  const provider = record.provider || {}
  const user = provider.user || {}
  const media = record.media || []
  const images = media
    .filter(item => !item.media_type || item.media_type === 'image')
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(item => item.url)

  return {
    id: String(record.id),
    title: record.title,
    location: record.destination || record.meeting_address,
    latitude: record.latitude == null ? null : Number(record.latitude),
    longitude: record.longitude == null ? null : Number(record.longitude),
    category: record.category?.name || record.category_name,
    price: Number(record.base_price),
    currency: record.currency || 'USD',
    rating: Number(record.rating ?? provider.trust_score?.average_rating ?? 0),
    reviewCount: Number(record.review_count ?? provider.trust_score?.total_reviews ?? 0),
    duration: formatDuration(record.duration_minutes),
    maxGuests: record.max_capacity,
    image: images[0] || record.image_url,
    images,
    badge: record.badge,
    providerId: String(provider.id || record.provider_id),
    meetingPoint: record.meeting_address,
    description: record.description,
    host: {
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || provider.business_name,
      avatar: initials(user.first_name, user.last_name),
      avatarUrl: user.avatar_url || null,
      subtype: record.category?.name || 'Experience Host',
      trustScore: Number(provider.trust_score?.trust_score ?? 0),
      bio: provider.bio || '',
    },
    groupType: record.group_type || 'private',
    activityLevel: record.activity_level ? `${record.activity_level.charAt(0).toUpperCase()}${record.activity_level.slice(1)}` : 'Minimal',
    isAccessible: Boolean(record.is_accessible),
    themes: Array.isArray(record.themes) ? record.themes : [],
    timeOfDay: Array.isArray(record.time_of_day) ? record.time_of_day : [],
    languages: provider.languages || [],
    inclusions: record.inclusions || [],
    exclusions: record.exclusions || [],
    requirements: record.requirements || [],
    priceGroups: (record.price_groups || []).map(group => ({
      id: String(group.price_id),
      persons: group.number_of_person,
      price: Number(group.base_price),
    })),
    itinerary: (record.itinerary_stops || []).sort((a, b) => a.stop_order - b.stop_order),
    reviews: (record.reviews || []).map(review => ({
      author: [review.traveler?.first_name, review.traveler?.last_name?.[0] && `${review.traveler.last_name[0]}.`].filter(Boolean).join(' '),
      rating: review.rating,
      text: review.comment,
    })),
  }
}

export async function getExperience(id, { signal } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/experiences/${encodeURIComponent(id)}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Experience request failed (${response.status})`)
  return mapExperience(await response.json())
}

export async function getPublicCategories() {
  const res = await fetch(`${API_BASE_URL}/api/public/categories`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  return res.json()
}

export async function getPublicProviders() {
  const res = await fetch(`${API_BASE_URL}/api/public/providers`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  return res.json()
}
