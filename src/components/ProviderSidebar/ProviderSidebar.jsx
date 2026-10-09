import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, CircleDollarSign, ClipboardList, Gavel, LayoutDashboard, ListPlus, MessageCircle, Settings } from 'lucide-react'

const links = [
  { to: '/app/provider', label: 'Home', icon: LayoutDashboard },
  { to: '/app/provider/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/app/provider/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/provider/listings', label: 'Listings', icon: ListPlus },
  { to: '/app/provider/bids', label: 'Bids', icon: Gavel },
  { to: '/app/provider/messages', label: 'Messages', icon: MessageCircle },
  { to: '/app/provider/earnings', label: 'Earnings', icon: CircleDollarSign },
  { to: '/app/provider/settings', label: 'Settings', icon: Settings },
]

export default function ProviderSidebar() {
  const { pathname } = useLocation()
  return (
    <aside className="provider-sidebar" aria-label="Provider navigation">
      <p className="provider-sidebar-title">Provider Portal</p>
      <nav>
      {links.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={pathname === to || (['/app/provider/listings', '/app/provider/bookings'].includes(to) && pathname.startsWith(`${to}/`)) ? 'active' : ''} aria-current={pathname === to ? 'page' : undefined}><Icon size={20} /><span>{label}</span></Link>
      ))}
      </nav>
    </aside>
  )
}
