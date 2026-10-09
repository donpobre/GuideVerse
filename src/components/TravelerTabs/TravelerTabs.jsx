import { Link, useLocation } from 'react-router-dom'
import { Compass, Map, FileText, MessageCircle, User } from 'lucide-react'

const tabs = [
  { to: '/app/traveler', label: 'Explore', icon: Compass },
  { to: '/app/traveler/trips', label: 'Trips', icon: Map },
  { to: '/app/traveler/requests', label: 'Custom', icon: FileText },
  { to: '/app/traveler/messages', label: 'Messages', icon: MessageCircle },
  { to: '/app/traveler/settings', label: 'Profile', icon: User },
]

export default function TravelerTabs() {
  const { pathname } = useLocation()
  return (
    <nav className="traveler-tabs" aria-label="Traveler navigation">
      {tabs.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={pathname === to || pathname.startsWith(to + '/') ? 'active' : ''}>
          <Icon size={20} />
          {label}
        </Link>
      ))}
    </nav>
  )
}
