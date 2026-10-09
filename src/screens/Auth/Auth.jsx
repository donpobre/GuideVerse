import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Compass, Eye, EyeOff, ArrowLeft, Mail, Lock, User, CheckCircle2 } from 'lucide-react'
import { completeSocialRole, exchangeSocialLogin, forgotPassword, getSocialProviders, loginUser, resetPassword, signupUser, socialLogin } from '../../services/authService'
import './Auth.css'

export default function Auth() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [socialLoading, setSocialLoading] = useState('')
  const [socialProviders, setSocialProviders] = useState({ google: { configured: false }, facebook: { configured: false } })
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token'))
  const [signupRole, setSignupRole] = useState('')
  const [roleToken, setRoleToken] = useState('')
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors }, reset } = useForm()

  useEffect(() => {
    getSocialProviders().then(setSocialProviders).catch(() => {})
    const params = new URLSearchParams(window.location.search); const loginToken = params.get('login_token'); const oauthError = params.get('oauth_error')
    if (resetToken) setMode('reset')
    if (oauthError) setError('Social sign-in could not be completed. Please try again.')
    if (loginToken) exchangeSocialLogin(loginToken).then(res => { if (res.needs_role) { setRoleToken(res.role_token); setMode('role') } else { localStorage.setItem('tgm_auth', 'true'); localStorage.setItem('tgm_user', JSON.stringify(res.user)); navigate(res.user.primary_role === 'provider' ? '/app/provider' : '/app/traveler') } }).catch(err => setError(err.message))
  }, [])

  const onSubmit = async (data) => {
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      if (mode === 'signin') {
        const res = await loginUser({ email: data.email, password: data.password })
        localStorage.setItem('tgm_auth', 'true')
        localStorage.setItem('tgm_user', JSON.stringify(res.user))
        const params = new URLSearchParams(window.location.search)
        const redirectTo = params.get('redirect')
        if (redirectTo) { navigate(redirectTo); return }
        const intent = sessionStorage.getItem('gv:checkout_intent')
        if (intent) {
          try {
            const { experienceId, date, guests } = JSON.parse(intent)
            sessionStorage.removeItem('gv:checkout_intent')
            navigate(`/app/traveler/checkout/${experienceId}?date=${date}&guests=${guests}`)
            return
          } catch {}
        }
        navigate(res.user.primary_role === 'provider' ? '/app/provider' : '/app/traveler')
      } else if (mode === 'signup') {
        if (!['traveler', 'provider'].includes(signupRole)) throw new Error('Please choose Traveler or Provider before creating your account.')
        const res = await signupUser({ name: data.name, email: data.email, password: data.password, role: signupRole, business_name: data.business_name, bio: data.bio })
        localStorage.setItem('tgm_auth', 'true')
        localStorage.setItem('tgm_user', JSON.stringify(res.user))
        setSuccessMsg('Account created successfully!')
        const intent = sessionStorage.getItem('gv:checkout_intent')
        if (intent) {
          try {
            const { experienceId, date, guests } = JSON.parse(intent)
            sessionStorage.removeItem('gv:checkout_intent')
            setTimeout(() => navigate(`/app/traveler/checkout/${experienceId}?date=${date}&guests=${guests}`), 800)
            return
          } catch {}
        }
        setTimeout(() => navigate(signupRole === 'provider' ? '/app/provider/settings?onboarding=1' : '/app/traveler'), 800)
      } else if (mode === 'forgot') {
        const res = await forgotPassword(data.email)
        if (res.reset_url) { setResetToken(new URL(res.reset_url).searchParams.get('reset_token')); setMode('reset'); reset(); setSuccessMsg('Development reset verified. Choose your new password.') }
        else setSuccessMsg(res.message)
      } else if (mode === 'reset') {
        const res = await resetPassword(resetToken, data.password)
        setSuccessMsg(res.message); setTimeout(() => switchMode('signin'), 800)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your details.')
    } finally {
      setLoading(false)
    }
  }

  const handleSocial = async (provider) => {
    setSocialLoading(provider)
    setError('')
    setSuccessMsg('')
    try {
      const res = await socialLogin(provider)
      window.location.assign(res.authorization_url)
    } catch (err) {
      setError(err.message || `${provider} authentication failed`)
    } finally {
      setSocialLoading('')
    }
  }

  const switchMode = (m) => { setMode(m); reset(); setError(''); setSuccessMsg('') }
  const chooseRole = async role => {
    setError('')
    if (roleToken) {
      setLoading(true)
      try { const res = await completeSocialRole(roleToken, role); localStorage.setItem('tgm_auth', 'true'); localStorage.setItem('tgm_user', JSON.stringify(res.user)); navigate(role === 'provider' ? '/app/provider/settings?onboarding=1' : '/app/traveler') }
      catch (err) { setError(err.message) } finally { setLoading(false) }
    } else { setSignupRole(role); switchMode('signup') }
  }

  return (
    <main className="auth-page" aria-label="Authentication">
      {/* Background */}
      <div className="auth-bg" aria-hidden="true">
        <img src="https://images.unsplash.com/photo-1520466809213-7b9a56adcd45?w=1600&q=80" alt="" />
        <div className="auth-bg-overlay" />
      </div>

      <div className="auth-card-wrap">
        <div className="auth-card" role="region" aria-label={mode === 'signin' ? 'Sign in form' : 'Create account form'}>
          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-logo-icon"><Compass size={20} /></div>
            <span className="auth-logo-text">GetOut</span>
          </div>

          {/* Header */}
          <div className="auth-header">
            <h1 className="auth-title">
              {mode === 'signin' && 'Welcome back'}
              {mode === 'role' && 'Choose your role'}
              {mode === 'signup' && 'Create account'}
              {(mode === 'forgot' || mode === 'reset') && 'Reset password'}
            </h1>
            <p className="auth-subtitle">
              {mode === 'signin' && 'Sign in to your GetOut account'}
              {mode === 'role' && 'How do you want to use GuideVerse?'}
              {mode === 'signup' && `Create your ${signupRole} account`}
              {mode === 'forgot' && 'Enter your email to receive a reset link'}
              {mode === 'reset' && 'Choose a new password for your account'}
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="auth-error-banner" role="alert">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="auth-success-banner" role="status">
              <CheckCircle2 size={16} /> {successMsg}
            </div>
          )}

          {mode === 'role' && <div className="auth-form"><button type="button" className="btn btn-outline btn-full btn-lg" disabled={loading} onClick={() => chooseRole('traveler')}><span>Traveler</span> — Book experiences and local guides</button><button type="button" className="btn btn-outline btn-full btn-lg" disabled={loading} onClick={() => chooseRole('provider')}><span>Provider</span> — List experiences and manage bookings</button></div>}

          {/* Form */}
          {mode !== 'role' && <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {mode === 'signup' && (
              <div className="input-group">
                <label className="input-label" htmlFor="name">
                  Full name <span className="required" aria-hidden="true">*</span>
                </label>
                <div className="input-icon-wrap">
                  <User size={16} className="input-icon" aria-hidden="true" />
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    className={`input-field ${errors.name ? 'error' : ''}`}
                    placeholder="Jane Doe"
                    aria-required="true"
                    aria-describedby={errors.name ? 'name-error' : undefined}
                    {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })}
                  />
                </div>
                {errors.name && <p className="input-error" id="name-error" role="alert">{errors.name.message}</p>}
              </div>
            )}

            {mode === 'signup' && signupRole === 'provider' && <><div className="input-group"><label className="input-label" htmlFor="business_name">Business name</label><input id="business_name" className="input-field" placeholder="Your business or public name" {...register('business_name', { required: 'Business name is required' })} />{errors.business_name && <p className="input-error">{errors.business_name.message}</p>}</div><div className="input-group"><label className="input-label" htmlFor="bio">Provider bio</label><textarea id="bio" className="input-field" rows="3" placeholder="Tell travelers about your expertise" {...register('bio', { required: 'Provider bio is required', minLength: { value: 40, message: 'Write at least 40 characters' } })} />{errors.bio && <p className="input-error">{errors.bio.message}</p>}</div></>}

            {mode !== 'reset' && <div className="input-group">
              <label className="input-label" htmlFor="email">
                Email <span className="required" aria-hidden="true">*</span>
              </label>
              <div className="input-icon-wrap">
                <Mail size={16} className="input-icon" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className={`input-field ${errors.email ? 'error' : ''}`}
                  placeholder="jane@example.com"
                  aria-required="true"
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' }
                  })}
                />
              </div>
              {errors.email && <p className="input-error" id="email-error" role="alert">{errors.email.message}</p>}
            </div>}

            {mode !== 'forgot' && (
              <div className="input-group">
                <label className="input-label" htmlFor="password">
                  Password <span className="required" aria-hidden="true">*</span>
                </label>
                <div className="input-icon-wrap">
                  <Lock size={16} className="input-icon" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className={`input-field auth-pass-input ${errors.password ? 'error' : ''}`}
                    placeholder="••••••••"
                    aria-required="true"
                    aria-describedby={errors.password ? 'pass-error' : undefined}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: ['signup', 'reset'].includes(mode) ? { value: 8, message: 'At least 8 characters' } : undefined
                    })}
                  />
                  <button
                    type="button"
                    className="auth-pass-toggle"
                    onClick={() => setShowPass(s => !s)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="input-error" id="pass-error" role="alert">{errors.password.message}</p>}
              </div>
            )}

            {mode === 'signin' && (
              <button type="button" className="auth-forgot-link" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            )}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} aria-busy={loading}>
              {loading ? <span className="auth-spinner" aria-label="Loading" /> : null}
              {loading ? 'Please wait…' :
                mode === 'signin' ? 'Sign In' :
                mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Update Password'
              }
            </button>
          </form>}

          {/* Divider */}
          {mode !== 'role' && <><div className="auth-divider" aria-hidden="true"><span>or</span></div>

          {/* Social */}
          <div className="auth-social">
            <button className="auth-social-btn" onClick={() => handleSocial('google')} disabled={Boolean(socialLoading) || !socialProviders.google.configured} aria-label="Continue with Google">
              {socialLoading === 'google' ? <span className="auth-spinner dark" /> : <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" width="18" height="18" />}
              Google
            </button>
            <button className="auth-social-btn" onClick={() => handleSocial('facebook')} disabled={Boolean(socialLoading) || !socialProviders.facebook.configured} aria-label="Continue with Facebook">
              {socialLoading === 'facebook' ? <span className="auth-spinner dark" /> : <span style={{ color: '#1877f2', fontWeight: 800, fontSize: 20 }}>f</span>}
              Facebook
            </button>
          </div>
          </>}

          {/* Switch */}
          <p className="auth-switch">
            {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
            <button type="button" className="auth-switch-btn" onClick={() => { if (mode === 'signin') { setRoleToken(''); setSignupRole(''); switchMode('role') } else switchMode('signin') }}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {mode !== 'signin' && (
            <button type="button" className="auth-back" onClick={() => switchMode('signin')}>
              <ArrowLeft size={16} /> Back to Sign In
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
