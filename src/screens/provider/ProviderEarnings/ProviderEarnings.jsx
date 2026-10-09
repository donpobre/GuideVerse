import { useEffect, useState } from 'react'
import { AlertTriangle, Download, LoaderCircle, RefreshCw, WalletCards } from 'lucide-react'
import ProviderSidebar from '../../../components/ProviderSidebar/ProviderSidebar'
import { getProviderEarnings, savePayoutSchedule } from '../../../services/providerOperationsService'

export default function ProviderEarnings() {
  const today = new Date()
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
  const [loading, setLoading] = useState(true)
  const [payoutFailed, setPayoutFailed] = useState(false)
  const [schedule, setSchedule] = useState('weekly')
  const [connected, setConnected] = useState(true)
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [data, setData] = useState({ escrow_balance: 0, available_balance: 0, transactions: [] })

  const loadEarnings = () => {
    setLoading(true)
    setLoadError('')
    getProviderEarnings(start, end)
      .then(res => {
        if (res) {
          setData(res)
          if (res.payout_settings) {
            setSchedule(res.payout_settings.payout_schedule || 'weekly')
            setConnected(res.payout_settings.account_connected ?? true)
            setPayoutFailed(res.payout_settings.last_payout_failed ?? false)
          }
        }
      })
      .catch(err => setLoadError(err.message || 'Could not load earnings from the database.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEarnings() }, [start, end])

  const handleScheduleChange = async newSchedule => {
    setSchedule(newSchedule)
    try {
      await savePayoutSchedule(newSchedule)
    } catch (e) {
      setError('Could not update payout schedule')
    }
  }

  const exportCsv = () => {
    const diff = (new Date(end) - new Date(start)) / 86400000
    if (!start || !end || diff < 0) return setError('End date cannot precede start date.')
    if (diff > 366) return setError('Export range cannot exceed one year.')
    setError('')
    setExporting(true)
    setTimeout(() => setExporting(false), 750)
  }

  return (
    <div className="portal-page provider-layout earnings-page">
      <ProviderSidebar />
      <main className="earnings-main">
        <header className="earnings-header">
          <div>
            <p className="settings-eyebrow">Payouts & reporting</p>
            <h1>Earnings</h1>
            <span>Track available funds, escrow holds, and transfers.</span>
          </div>
        </header>

        {loadError && <div className="inline-banner">{loadError}<button onClick={loadEarnings}>Retry</button></div>}

        {payoutFailed && (
          <div className="payout-failure">
            <AlertTriangle size={20} />
            <div>
              <strong>Your last payout failed</strong>
              <span>Update your bank details to receive your transfer.</span>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setPayoutFailed(false)}>Update bank details</button>
          </div>
        )}

        <section className="earnings-top">
          <div className="earnings-ledger">
            <article className="portal-card ledger-card escrow">
              <small>Funds in escrow</small>
              {loading ? <i /> : <strong>${Number(data.escrow_balance || 0).toFixed(2)}</strong>}
              <span>Available after T+24h hold</span>
            </article>
            <article className="portal-card ledger-card available">
              <small>Available balance</small>
              {loading ? <i /> : <strong>${Number(data.available_balance || 0).toFixed(2)}</strong>}
              <span>Ready for payout</span>
            </article>
            <button className="btn btn-primary ledger-withdraw"><WalletCards size={16} />Withdraw to bank</button>
          </div>
          <section className="portal-card earnings-chart">
            <div>
              <p className="settings-eyebrow">Last 30 days</p>
              <h2>Earnings over time</h2>
            </div>
            {loading ? <div className="earnings-chart-skeleton" /> : <div className="earnings-lines"><i/><i/><i/><i/><i/><i/><i/></div>}
            <div className="earnings-axis"><span>Aug 20</span><span>Sep 19</span></div>
          </section>
        </section>

        <section className="earnings-bottom">
          <section className="portal-card payout-schedule">
            <div>
              <p className="settings-eyebrow">Stripe Connect</p>
              <h2>Payout schedule</h2>
              <span>Choose when available funds transfer to your bank.</span>
            </div>
            <select className="input-field" value={schedule} disabled={!connected} onChange={event => handleScheduleChange(event.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            {!connected && <small>Connect a payout account to enable automatic transfers.</small>}
            <button className="btn btn-outline btn-sm" onClick={() => setConnected(!connected)}>{connected ? 'Payout account connected' : 'Connect payout account'}</button>
          </section>

          <section className="portal-card export-card">
            <div>
              <p className="settings-eyebrow">Tax & invoices</p>
              <h2>Export records</h2>
            </div>
            <div className="export-dates">
              <label>From<input className="input-field" type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
              <label>To<input className="input-field" type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>
            </div>
            {error && <span className="input-error">{error}</span>}
            <button className="btn btn-outline" onClick={exportCsv} disabled={exporting}>
              {exporting ? <><LoaderCircle size={16} className="spinner" />Generating…</> : <><Download size={16} />Export CSV</>}
            </button>
          </section>
        </section>

        <section className="portal-card transaction-card">
          <div className="transaction-heading">
            <div>
              <p className="settings-eyebrow">Ledger</p>
              <h2>Transaction history</h2>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadEarnings}><RefreshCw size={15}/> Refresh</button>
          </div>
          <div className="transaction-table">
            <div className="transaction-row header">
              <span>Date</span>
              <span>Booking</span>
              <span>Gross</span>
              <span>Fee</span>
              <span>Net</span>
            </div>
            {(data.transactions || []).map(row => (
              <button className="transaction-row" key={row.id || row.booking}>
                <span>{row.created_at ? new Date(row.created_at).toLocaleDateString() : row.date}</span>
                <strong>{row.title || row.booking}<small>{row.status}</small></strong>
                <span>${Number(row.gross_amount || row.gross).toFixed(2)}</span>
                <span>-${Number(row.platform_fee || row.fee).toFixed(2)}</span>
                <b>${Number(row.net_provider_payout || row.net).toFixed(2)}</b>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
