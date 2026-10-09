import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';

// Public / shared
import Splash from './screens/Splash/Splash';
import Auth from './screens/Auth/Auth';
import Home from './screens/Home/Home';
import Onboarding from './screens/Onboarding/Onboarding';
import SearchResults from './screens/SearchResults/SearchResults';
import MockupHub from './screens/MockupHub/MockupHub';

// Public detail pages
import ExperienceDetail from './screens/public/ExperienceDetail/ExperienceDetail';
import DestinationHub from './screens/public/DestinationHub/DestinationHub';
import ProviderProfile from './screens/public/ProviderProfile/ProviderProfile';
import StaticPage from './screens/public/StaticPage/StaticPage';
import Notifications from './screens/Notifications/Notifications';

// Traveler portal
import TravelerDashboard from './screens/traveler/TravelerDashboard/TravelerDashboard';
import TripsHub from './screens/traveler/TripsHub/TripsHub';
import TripDetail from './screens/traveler/TripDetail/TripDetail';
import Checkout from './screens/traveler/Checkout/Checkout';
import BookingConfirmation from './screens/traveler/BookingConfirmation/BookingConfirmation';
import AIPlanner from './screens/traveler/AIPlanner/AIPlanner';
import CustomRequests from './screens/traveler/CustomRequests/CustomRequests';
import SavedWishlists from './screens/traveler/SavedWishlists/SavedWishlists';
import TravelerMessages from './screens/traveler/TravelerMessages/TravelerMessages';
import TravelerSettings from './screens/traveler/TravelerSettings/TravelerSettings';

// Provider portal
import ProviderDashboard from './screens/provider/ProviderDashboard/ProviderDashboard';
import ProviderBookings from './screens/provider/ProviderBookings/ProviderBookings';
import ProviderListings from './screens/provider/ProviderListings/ProviderListings';
import ListingBuilder from './screens/provider/ListingBuilder/ListingBuilder';
import ProviderCalendar from './screens/provider/ProviderCalendar/ProviderCalendar';
import ProviderEarnings from './screens/provider/ProviderEarnings/ProviderEarnings';
import BiddingFeed from './screens/provider/BiddingFeed/BiddingFeed';
import ProviderMessages from './screens/provider/ProviderMessages/ProviderMessages';
import ProviderSettings from './screens/provider/ProviderSettings/ProviderSettings';

// Admin portal
import AdminDashboard from './screens/admin/AdminDashboard/AdminDashboard';
import DisputeCenter from './screens/admin/DisputeCenter/DisputeCenter';
import EscrowDesk from './screens/admin/EscrowDesk/EscrowDesk';
import KycDesk from './screens/admin/KycDesk/KycDesk';
import ModerationQueue from './screens/admin/ModerationQueue/ModerationQueue';
import UserManagement from './screens/admin/UserManagement/UserManagement';
import PlatformConfig from './screens/admin/PlatformConfig/PlatformConfig';
import AdminCustomRequests from './screens/admin/CustomRequests/CustomRequests';
import AdminDestinations from './screens/admin/Destinations/Destinations';
import AdminShell from './components/AdminShell/AdminShell';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('tgm_user') || 'null')
  } catch {
    return null
  }
}

function RoleRoute({ role, children }) {
  const user = getStoredUser()
  if (!user?.id) return <Navigate to="/auth" replace />
  if (user.primary_role !== role) return <Navigate to={user.primary_role === 'provider' ? '/app/provider' : '/app/traveler'} replace />
  return children
}

function AppContent() {
  const location = useLocation();
  const hideNavbar = ['/', '/home', '/welcome', '/onboarding', '/auth'].includes(location.pathname);
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  return (
    <>
      {!hideNavbar && !isAdminRoute && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/welcome" element={<Splash />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/mockup" element={<MockupHub />} />
        <Route path="/destination/:slug" element={<DestinationHub />} />
        <Route path="/experience/:id" element={<ExperienceDetail />} />
        <Route path="/provider/:id" element={<ProviderProfile />} />
        <Route path="/safety" element={<StaticPage />} />
        <Route path="/about" element={<StaticPage />} />
        <Route path="/help" element={<StaticPage />} />
        <Route path="/legal" element={<StaticPage />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* Traveler portal */}
        <Route path="/app/traveler" element={<RoleRoute role="traveler"><TravelerDashboard /></RoleRoute>} />
        <Route path="/app/traveler/trips" element={<RoleRoute role="traveler"><TripsHub /></RoleRoute>} />
        <Route path="/app/traveler/trips/:id" element={<RoleRoute role="traveler"><TripDetail /></RoleRoute>} />
        <Route path="/app/traveler/checkout/:id" element={<RoleRoute role="traveler"><Checkout /></RoleRoute>} />
        <Route path="/app/traveler/bookings/:bookingId/confirmation" element={<RoleRoute role="traveler"><BookingConfirmation /></RoleRoute>} />
        <Route path="/app/traveler/ai-planner" element={<RoleRoute role="traveler"><AIPlanner /></RoleRoute>} />
        <Route path="/app/traveler/requests" element={<RoleRoute role="traveler"><CustomRequests /></RoleRoute>} />
        <Route path="/app/traveler/wishlists" element={<RoleRoute role="traveler"><SavedWishlists /></RoleRoute>} />
        <Route path="/app/traveler/messages" element={<RoleRoute role="traveler"><TravelerMessages /></RoleRoute>} />
        <Route path="/app/traveler/settings" element={<RoleRoute role="traveler"><TravelerSettings /></RoleRoute>} />

        <Route path="/app/provider" element={<RoleRoute role="provider"><ProviderDashboard /></RoleRoute>} />
        <Route path="/app/provider/bookings" element={<RoleRoute role="provider"><ProviderBookings /></RoleRoute>} />
        <Route path="/app/provider/bookings/:bookingId" element={<RoleRoute role="provider"><ProviderBookings /></RoleRoute>} />
        <Route path="/app/provider/bookings/:bookingId/ticket" element={<RoleRoute role="provider"><BookingConfirmation /></RoleRoute>} />
        <Route path="/app/provider/listings" element={<RoleRoute role="provider"><ProviderListings /></RoleRoute>} />
        <Route path="/app/provider/listings/new" element={<RoleRoute role="provider"><ListingBuilder /></RoleRoute>} />
        <Route path="/app/provider/listings/:id/edit" element={<RoleRoute role="provider"><ListingBuilder /></RoleRoute>} />
        <Route path="/app/provider/calendar" element={<RoleRoute role="provider"><ProviderCalendar /></RoleRoute>} />
        <Route path="/app/provider/earnings" element={<RoleRoute role="provider"><ProviderEarnings /></RoleRoute>} />
        <Route path="/app/provider/bids" element={<RoleRoute role="provider"><BiddingFeed /></RoleRoute>} />
        <Route path="/app/provider/messages" element={<RoleRoute role="provider"><ProviderMessages /></RoleRoute>} />
        <Route path="/app/provider/settings" element={<RoleRoute role="provider"><ProviderSettings /></RoleRoute>} />

        {/* Admin portal */}
        <Route path="/admin" element={<AdminShell><AdminDashboard /></AdminShell>} />
        <Route path="/admin/disputes" element={<AdminShell><DisputeCenter /></AdminShell>} />
        <Route path="/admin/escrow" element={<AdminShell><EscrowDesk /></AdminShell>} />
        <Route path="/admin/kyc" element={<AdminShell><KycDesk /></AdminShell>} />
        <Route path="/admin/moderation" element={<AdminShell><ModerationQueue /></AdminShell>} />
        <Route path="/admin/requests" element={<AdminShell><AdminCustomRequests /></AdminShell>} />
        <Route path="/admin/users" element={<AdminShell><UserManagement /></AdminShell>} />
        <Route path="/admin/destinations" element={<AdminShell><AdminDestinations /></AdminShell>} />
        <Route path="/admin/config" element={<AdminShell><PlatformConfig /></AdminShell>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
