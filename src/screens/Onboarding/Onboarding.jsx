import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import './Onboarding.css'

const steps = [
  {
    id: 'interests',
    title: 'What excites you most?',
    subtitle: 'Choose all that apply – your AI trip planner will use these.',
    type: 'chips',
    options: ['🏔️ Adventure', '🎨 Culture', '🍜 Food & Drink', '🧘 Wellness', '🏛️ History', '🌙 Nightlife', '🌿 Nature', '🏄 Water Sports', '🎭 Arts', '🛍️ Shopping']
  },
  {
    id: 'budget',
    title: 'What\'s your travel budget?',
    subtitle: 'Per person, per day (excluding flights).',
    type: 'chips',
    options: ['💸 Under $50', '💵 $50–$150', '💳 $150–$300', '💎 $300–$500', '🤑 $500+']
  },
  {
    id: 'duration',
    title: 'How long do you typically travel?',
    subtitle: 'We\'ll tailor itinerary lengths to your preference.',
    type: 'chips',
    options: ['🏃 Weekend (1–3 days)', '✈️ Short trip (4–7 days)', '🗺️ Two weeks', '🌍 Month+', '🔁 Varies']
  },
  {
    id: 'style',
    title: 'What\'s your travel style?',
    subtitle: 'Pick your vibe.',
    type: 'chips',
    options: ['🧳 Solo traveller', '👫 Couple', '👨‍👩‍👧 Family', '👯 Friends group', '💼 Business']
  },
  {
    id: 'done',
    title: 'You\'re all set!',
    subtitle: 'Your AI trip planner is ready to create personalised experiences for you.',
    type: 'done'
  }
]

export default function Onboarding() {
  const [step, setStep]       = useState(0)
  const [selections, setSel]  = useState({})
  const [saving, setSaving]   = useState(false)
  const navigate              = useNavigate()

  const current = steps[step]
  const progress = ((step) / (steps.length - 1)) * 100

  const toggle = (option) => {
    setSel(prev => {
      const set = new Set(prev[current.id] || [])
      set.has(option) ? set.delete(option) : set.add(option)
      return { ...prev, [current.id]: [...set] }
    })
  }

  const selected = (option) => (selections[current.id] || []).includes(option)
  const canNext  = current.type === 'chips'
    ? (selections[current.id] || []).length > 0
    : true

  const next = async () => {
    if (step < steps.length - 2) { setStep(s => s + 1); return }
    setSaving(true)
    await new Promise(r => setTimeout(r, 1200))
    localStorage.setItem('tgm_prefs', JSON.stringify(selections))
    localStorage.setItem('tgm_auth', 'true')
    setSaving(false)
    setStep(s => s + 1)
  }

  const finish = () => navigate('/home')

  return (
    <main className="onboarding" aria-label="Travel preference setup">
      {/* Header */}
      <div className="onboarding-header">
        <div className="onboarding-logo">
          <div className="onboarding-logo-icon"><Compass size={18} /></div>
          <span>GetOut</span>
        </div>
        <span className="onboarding-step-label" aria-live="polite">
          {current.type !== 'done' ? `Step ${step + 1} of ${steps.length - 1}` : 'Complete!'}
        </span>
      </div>

      {/* Progress */}
      <div className="onboarding-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="onboarding-card-wrap">
        <div className="onboarding-card">
          {current.type !== 'done' ? (
            <>
              <h1 className="onboarding-title">{current.title}</h1>
              <p className="onboarding-sub">{current.subtitle}</p>

              {/* Chips */}
              <div className="onboarding-chips" role="group" aria-label={current.title}>
                {current.options.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`chip ${selected(opt) ? 'selected' : ''}`}
                    onClick={() => toggle(opt)}
                    aria-pressed={selected(opt)}
                  >
                    {selected(opt) && <Check size={12} />}
                    {opt}
                  </button>
                ))}
              </div>

              {/* Empty state hint */}
              {!canNext && (
                <p className="onboarding-hint" role="alert">
                  Select at least one option to continue.
                </p>
              )}

              {/* Navigation */}
              <div className="onboarding-nav">
                {step > 0 && (
                  <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
                    <ChevronLeft size={18} /> Back
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={next}
                  disabled={!canNext || saving}
                  aria-busy={saving}
                  style={{ marginLeft: 'auto' }}
                >
                  {saving ? <span className="auth-spinner" /> : null}
                  {saving ? 'Saving…' : 'Next'}
                  {!saving && <ChevronRight size={18} />}
                </button>
              </div>
            </>
          ) : (
            /* Done state */
            <div className="onboarding-done">
              <div className="onboarding-done-icon" aria-hidden="true">🎉</div>
              <h1 className="onboarding-title">{current.title}</h1>
              <p className="onboarding-sub">{current.subtitle}</p>
              <button className="btn btn-primary btn-lg" onClick={finish}>
                Start Exploring <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
