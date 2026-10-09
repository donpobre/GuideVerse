import { BriefcaseBusiness, ChevronRight, CircleDollarSign, FileSearch, Gavel, LayoutDashboard, MessageSquareText, Settings, ShieldCheck, UsersRound, MapPin } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Accounts', icon: UsersRound },
  { to: '/admin/kyc', label: 'Verification', icon: ShieldCheck, count: '14' },
  { to: '/admin/moderation', label: 'Moderation', icon: FileSearch, count: '3' },
  { to: '/admin/requests', label: 'Custom requests', icon: MessageSquareText },
  { to: '/admin/destinations', label: 'Destinations', icon: MapPin },
  { to: '/admin/escrow', label: 'Escrow control', icon: CircleDollarSign },
  { to: '/admin/disputes', label: 'Disputes', icon: Gavel, count: '4' },
  { to: '/admin/config', label: 'Platform config', icon: Settings },
]

export default function AdminSidebar({ onNavigate }) {
  const { pathname } = useLocation()

  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-sidebar-brand">
        <span>GV</span>
        <div><strong>GuideVerse</strong><small>Operations console</small></div>
      </div>
      <p className="admin-sidebar-label">MAIN MENU</p>
      <nav>
        {links.map(({ to, label, icon: Icon, count }) => (
          <Link key={to} to={to} onClick={onNavigate} className={pathname === to ? 'active' : ''}>
            <Icon size={18} />
            <span>{label}</span>
            {count && <em>{count}</em>}
            {!count && <ChevronRight className="admin-nav-arrow" size={15} />}
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-footer"><BriefcaseBusiness size={17} /><span><strong>Operations team</strong><small>All systems monitored</small></span></div>
    </aside>
  )
}