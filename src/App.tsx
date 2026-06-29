import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireActive, RequireAdmin, RequireAuth } from './components/ProtectedRoute'

const AppShell = lazy(() => import('./components/AppShell').then((m) => ({ default: m.AppShell })))
const AdminShell = lazy(() => import('./components/AdminShell').then((m) => ({ default: m.AdminShell })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const AuthCallback = lazy(() => import('./pages/AuthCallback').then((m) => ({ default: m.AuthCallback })))
const PendingActivation = lazy(() => import('./pages/PendingActivation').then((m) => ({ default: m.PendingActivation })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Checkout = lazy(() => import('./pages/Checkout').then((m) => ({ default: m.Checkout })))
const QRCodes = lazy(() => import('./pages/QRCodes').then((m) => ({ default: m.QRCodes })))
const loadAdminPages = () => import('./pages/admin')
const AdminReps = lazy(() => loadAdminPages().then((m) => ({ default: m.AdminReps })))
const AdminLinks = lazy(() => loadAdminPages().then((m) => ({ default: m.AdminLinks })))
const AdminProducts = lazy(() => loadAdminPages().then((m) => ({ default: m.AdminProducts })))
const AdminAnnouncements = lazy(() => loadAdminPages().then((m) => ({ default: m.AdminAnnouncements })))
const AdminSales = lazy(() => loadAdminPages().then((m) => ({ default: m.AdminSales })))

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Signed in, any activation state */}
        <Route path="pending" element={<RequireAuth />}>
          <Route index element={<PendingActivation />} />
        </Route>

        {/* Signed in + activated -> rep app */}
        <Route path="/" element={<RequireActive />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="qr" element={<QRCodes />} />
          </Route>
        </Route>

        {/* Admins only -> CMS */}
        <Route path="admin" element={<RequireAdmin />}>
          <Route element={<AdminShell />}>
            <Route index element={<AdminReps />} />
            <Route path="links" element={<AdminLinks />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="sales" element={<AdminSales />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function RouteFallback() {
  return (
    <div className="grid min-h-svh place-items-center bg-[#050506] px-6 text-center text-white">
      <div>
        <div className="mx-auto size-10 animate-pulse rounded-[8px] border border-demo-300/30 bg-demo-400/12 shadow-[0_0_40px_rgba(20,229,255,0.16)]" />
        <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-white/46">Loading</p>
      </div>
    </div>
  )
}
