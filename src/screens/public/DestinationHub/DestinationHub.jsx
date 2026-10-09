import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapPin, Clock, CreditCard, Shield, Globe, Zap } from 'lucide-react'
import Footer from '../../../components/Footer/Footer'
import { getDestinationHub } from '../../../services/destinationService'

export default function DestinationHub() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('All')

  useEffect(() => {
    setLoading(true)
    setError('')
    getDestinationHub(slug)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="dh-state">Loading destination...</div>
  if (error)
    return (
      <div className="dh-state">
        <h1>Destination not found</h1>
        <p>{error}</p>
        <Link to="/" className="btn btn-primary">Return Home</Link>
      </div>
    )
  if (!data) return null

  const tabs = ['All', 'Tours & Experiences', 'Free Things To Do', 'Food', 'Nature & Diving', 'History & Culture']
  const filteredHighlights = data.highlights?.filter(h => {
    if (activeTab === 'All') return true
    if (activeTab === 'Free Things To Do') return h.is_free
    const tag = h.tag_native || h.tag_info || ''
    return tag.toLowerCase().includes(activeTab.split(' ')[0].toLowerCase())
  }) || []

  const renderEmergencyNumbers = () => {
    if (!data.emergency_numbers) return null
    return data.emergency_numbers.split('|').map((num, i) => (
      <span key={i}>{num.trim()}</span>
    ))
  }

  return (
    <div className="dh-portal">
      <style>{`
        :root{
          --color-primary:#142B52; --color-primary-600:#1D3A6B; --color-primary-100:#E7ECF4;
          --color-accent:#C9A227; --color-accent-600:#B08F1F; --color-accent-100:#F6EFD6;
          --color-bg:#F7F5F0; --color-surface:#FFFFFF; --color-ink:#16202E; --color-muted:#5B6472; --color-faint:#8A93A2;
          --color-border:#E3E0D6; --color-success:#1E6B4F; --color-success-100:#E9F5EE;
          --color-error:#B3261E; --color-warning:#9A6B00; --color-warning-100:#FBF1DA;
        }
        .dh-portal { background:var(--color-bg); color:var(--color-ink); min-height: 100vh; }
        .dh-state { padding: 100px 20px; text-align: center; }
        .dh-crumbbar{background:var(--color-surface);border-bottom:1px solid var(--color-border)}
        .dh-crumbbar__inner{max-width:1280px;margin:0 auto;padding:13px 28px;display:flex;gap:8px;font-size:12.5px;color:var(--color-faint)}
        .dh-crumbbar__sep{color:var(--color-border)}
        .dh-crumbbar__current{color:var(--color-ink);font-weight:600}
        
        .dh-hero{position:relative;height:340px;display:flex;align-items:flex-end;color:#fff;overflow:hidden}
        .dh-hero__bg{position:absolute;inset:0;background-size:cover;background-position:center}
        .dh-hero__scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,43,82,.15) 0%,rgba(9,15,27,.78) 100%)}
        .dh-hero__inner{position:relative;max-width:1280px;margin:0 auto;padding:0 28px 28px;width:100%}
        .dh-hero h1{font-size:36px;margin:0 0 12px;line-height:1.15; font-weight:700;}
        .dh-hero__facts{display:flex;gap:26px;flex-wrap:wrap;font-size:13px}
        .dh-hero__facts span{display:flex;align-items:center;gap:6px;color:rgba(255,255,255,.9)}
        .dh-hero__facts svg{width:14px;height:14px;stroke:#EBD48A;stroke-width:2;fill:none}
        
        .dh-page{max-width:1280px;margin:0 auto;padding:28px 28px 80px}
        .dh-body-grid{display:grid;grid-template-columns:1fr 340px;gap:32px;align-items:start}
        
        .dh-cat-tabs{display:flex;gap:8px;overflow-x:auto;margin-bottom:22px;padding-bottom:2px}
        .dh-cat-tab{padding:9px 18px;border-radius:999px;border:1px solid var(--color-border);background:#fff;font-size:13px;font-weight:600;color:var(--color-muted);white-space:nowrap; cursor:pointer;}
        .dh-cat-tab.active{background:var(--color-primary);border-color:var(--color-primary);color:#fff}
        
        .dh-section-block{margin-bottom:36px}
        .dh-section-block h2{font-size:22px;margin:0 0 4px; font-weight:700;}
        .dh-section-block__sub{font-size:14px;color:var(--color-muted);margin-bottom:18px}
        .dh-ent-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .dh-ent-card{background:#fff;border:1px solid var(--color-border);border-radius:15px;overflow:hidden;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
        .dh-ent-card:hover{transform:translateY(-4px);box-shadow:0 14px 30px rgba(20,43,82,.14)}
        .dh-ent-card__photo{height:140px;background-size:cover;background-position:center;position:relative}
        .dh-ent-tag{position:absolute;top:9px;left:9px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;padding:4px 8px;border-radius:6px}
        .dh-ent-tag--native{background:rgba(255,255,255,.95);color:var(--color-primary)}
        .dh-ent-tag--info{background:rgba(255,255,255,.95);color:var(--color-muted)}
        .dh-ent-card__body{padding:13px 14px}
        .dh-ent-card__title{font-weight:700;font-size:14.5px;margin-bottom:6px;line-height:1.3}
        .dh-ent-card__meta{font-size:12px;color:var(--color-muted);display:flex;justify-content:space-between;align-items:center}
        .dh-ent-card__price{font-weight:600;color:var(--color-ink);font-size:13.5px}
        .dh-ent-card__free{font-size:12px;font-weight:700;color:var(--color-success)}
        
        .dh-expert-scroll{display:flex;gap:16px;overflow-x:auto;padding-bottom:6px}
        .dh-expert-card{flex-shrink:0;width:190px;background:#fff;border:1px solid var(--color-border);border-radius:15px;padding:18px;text-align:center; cursor:pointer;}
        .dh-expert-card img, .dh-expert-avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0 auto 10px; display:flex; align-items:center; justify-content:center; background:var(--color-primary-100); color:var(--color-primary); font-weight:700; font-size:24px;}
        .dh-expert-card__name{font-weight:700;font-size:14px}
        .dh-expert-card__role{font-size:11.5px;color:var(--color-muted);margin:3px 0 9px}
        .dh-expert-badge{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:var(--color-success);background:var(--color-success-100);padding:3px 9px;border-radius:999px}
        
        .dh-ai-cta{background:linear-gradient(135deg,var(--color-primary) 0%,var(--color-primary-600) 100%);border-radius:20px;padding:32px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:36px}
        .dh-ai-cta__icon{width:46px;height:46px;border-radius:13px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .dh-ai-cta h3{color:#fff;font-size:19px;margin:0 0 5px; font-weight:700;}
        .dh-ai-cta p{font-size:13.5px;color:rgba(255,255,255,.78);margin:0;max-width:440px}
        .dh-ai-cta__btn{padding:13px 26px;border-radius:12px;background:var(--color-accent);color:var(--color-primary);border:none;font-weight:700;font-size:14px;white-space:nowrap; cursor:pointer;}
        
        .dh-editorial-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        .dh-editorial-card{background:#fff;border:1px solid var(--color-border);border-radius:15px;padding:22px}
        .dh-editorial-card h3{font-size:16px;margin:0 0 8px; font-weight:700;}
        .dh-editorial-card p{font-size:13.5px;color:var(--color-muted);line-height:1.65;margin:0}
        
        .dh-intel-panel{background:#fff;border:1px solid var(--color-border);border-radius:16px;padding:22px;position:sticky;top:24px}
        .dh-intel-panel h2{font-size:17px;margin:0 0 16px; font-weight:700;}
        .dh-intel-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--color-border);font-size:13px}
        .dh-intel-row:last-of-type{border-bottom:none}
        .dh-intel-row__label{display:flex;align-items:center;gap:8px;color:var(--color-muted)}
        .dh-intel-row__value{font-weight:600;text-align:right}
        .dh-intel-safety{margin-top:14px;padding:12px 14px;border-radius:11px;background:var(--color-success-100);color:var(--color-success);font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:8px}
        .dh-intel-emergency{margin-top:14px;padding:12px 14px;border-radius:11px;background:var(--color-warning-100);color:var(--color-warning)}
        .dh-intel-emergency div{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
        .dh-intel-emergency span{font-size:12.5px;display:block;margin-bottom:3px}
        
        @media (max-width:900px){.dh-body-grid{grid-template-columns:1fr}.dh-ent-grid,.dh-editorial-grid{grid-template-columns:1fr 1fr}}
        @media (max-width:560px){.dh-ent-grid,.dh-editorial-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="dh-crumbbar">
        <div className="dh-crumbbar__inner">
          <Link to="/">GuideVerse</Link>
          <span className="dh-crumbbar__sep">/</span>
          <Link to="/">Destinations</Link>
          <span className="dh-crumbbar__sep">/</span>
          <span className="dh-crumbbar__current">{data.name}</span>
        </div>
      </div>

      <div className="dh-hero">
        <div className="dh-hero__bg" style={{ backgroundImage: `url(${data.hero_image_url || 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&q=75'})` }}></div>
        <div className="dh-hero__scrim"></div>
        <div className="dh-hero__inner">
          <h1>Things to do in {data.name}</h1>
          <div className="dh-hero__facts">
            {data.weather_summary && (
              <span>
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
                {data.weather_summary}
              </span>
            )}
            {data.best_time_to_visit && (
              <span>
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>
                Best: {data.best_time_to_visit}
              </span>
            )}
            {data.currency_info && (
              <span>
                <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                {data.currency_info.split('·')[0].trim()}
              </span>
            )}
            <span>
              <svg viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/></svg>
              {data.experience_count} experiences · {data.local_experts?.length || 0} local experts
            </span>
          </div>
        </div>
      </div>

      <div className="dh-page">
        <div className="dh-body-grid">
          <div>
            <div className="dh-cat-tabs">
              {tabs.map(t => (
                <button
                  key={t}
                  className={`dh-cat-tab ${activeTab === t ? 'active' : ''}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="dh-section-block">
              <h2>Popular in {data.name} right now</h2>
              <div className="dh-section-block__sub">A mix of bookable local experts and free spots worth your time</div>
              <div className="dh-ent-grid">
                {filteredHighlights.map(h => (
                  <div key={h.id} className="dh-ent-card">
                    <div className="dh-ent-card__photo" style={{ backgroundImage: `url(${h.image_url})` }}>
                      {h.tag_native ? (
                        <span className="dh-ent-tag dh-ent-tag--native">{h.tag_native}</span>
                      ) : h.tag_info ? (
                        <span className="dh-ent-tag dh-ent-tag--info">{h.tag_info}</span>
                      ) : null}
                    </div>
                    <div className="dh-ent-card__body">
                      <div className="dh-ent-card__title">{h.title}</div>
                      <div className="dh-ent-card__meta">
                        <span>{h.meta_info || ''}</span>
                        {h.is_free ? (
                          <span className="dh-ent-card__free">Free</span>
                        ) : (
                          <span className="dh-ent-card__price">{h.price || ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredHighlights.length === 0 && <p>No highlights found for this category.</p>}
              </div>
            </div>

            {data.local_experts && data.local_experts.length > 0 && (
              <div className="dh-section-block">
                <h2>Meet local experts in {data.name}</h2>
                <div className="dh-section-block__sub">Verified, real people you can message before you book</div>
                <div className="dh-expert-scroll">
                  {data.local_experts.map(expert => (
                    <div key={expert.id} className="dh-expert-card" onClick={() => navigate(`/provider/${expert.public_slug || expert.id}`)}>
                      {expert.avatar_url ? (
                        <img src={expert.avatar_url} alt={expert.first_name} />
                      ) : (
                        <div className="dh-expert-avatar">{expert.first_name[0]}{expert.last_name[0]}</div>
                      )}
                      <div className="dh-expert-card__name">{expert.first_name} {expert.last_name}</div>
                      <div className="dh-expert-card__role">{expert.business_name || 'Tour Guide'}</div>
                      {expert.identity_verified && (
                        <span className="dh-expert-badge">✓ {expert.rating > 0 ? Number(expert.rating).toFixed(1) : 'New'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="dh-ai-cta">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="dh-ai-cta__icon">
                  <Zap color="#EBD48A" size={22} strokeWidth={2} />
                </div>
                <div>
                  <h3>Not sure where to start?</h3>
                  <p>Tell the AI Planner what you're into and get a full {data.name} itinerary in seconds.</p>
                </div>
              </div>
              <button className="dh-ai-cta__btn" onClick={() => navigate('/app/traveler/ai-planner')}>Plan my {data.name} trip →</button>
            </div>

            {(data.getting_around_editorial || data.best_time_editorial) && (
              <div className="dh-section-block">
                <h2>Good to know before you go</h2>
                <div className="dh-editorial-grid">
                  {data.getting_around_editorial && (
                    <div className="dh-editorial-card">
                      <h3>Getting around</h3>
                      <p>{data.getting_around_editorial}</p>
                    </div>
                  )}
                  {data.best_time_editorial && (
                    <div className="dh-editorial-card">
                      <h3>Best time to visit</h3>
                      <p>{data.best_time_editorial}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="dh-intel-panel">
            <h2>{data.name} at a glance</h2>
            {data.weather_summary && (
              <div className="dh-intel-row">
                <span className="dh-intel-row__label">
                  <Clock size={15} color="var(--color-accent-600)" />
                  Weather
                </span>
                <span className="dh-intel-row__value">{data.weather_summary}</span>
              </div>
            )}
            {data.currency_info && (
              <div className="dh-intel-row">
                <span className="dh-intel-row__label">
                  <CreditCard size={15} color="var(--color-accent-600)" />
                  Currency
                </span>
                <span className="dh-intel-row__value">{data.currency_info}</span>
              </div>
            )}
            {data.visa_info && (
              <div className="dh-intel-row">
                <span className="dh-intel-row__label">
                  <Shield size={15} color="var(--color-accent-600)" />
                  Entry
                </span>
                <span className="dh-intel-row__value">{data.visa_info}</span>
              </div>
            )}
            {data.languages && (
              <div className="dh-intel-row">
                <span className="dh-intel-row__label">
                  <Globe size={15} color="var(--color-accent-600)" />
                  Language
                </span>
                <span className="dh-intel-row__value">{data.languages}</span>
              </div>
            )}
            {data.timezone && (
              <div className="dh-intel-row">
                <span className="dh-intel-row__label">
                  <Clock size={15} color="var(--color-accent-600)" />
                  Time zone
                </span>
                <span className="dh-intel-row__value">{data.timezone}</span>
              </div>
            )}

            {data.safety_status && (
              <div className="dh-intel-safety">
                <Shield size={15} />
                {data.safety_status}
              </div>
            )}

            {data.emergency_numbers && (
              <div className="dh-intel-emergency">
                <div>Emergency numbers</div>
                {renderEmergencyNumbers()}
              </div>
            )}
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  )
}
