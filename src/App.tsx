import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireActive, RequireAdmin, RequireAuth } from './components/ProtectedRoute'
import { AppShell } from './components/AppShell'
import { AdminShell } from './components/AdminShell'
import { Login } from './pages/Login'
import { AuthCallback } from './pages/AuthCallback'
import { PendingActivation } from './pages/PendingActivation'
import { Dashboard } from './pages/Dashboard'
import { Checkout } from './pages/Checkout'
import { QRCodes } from './pages/QRCodes'
import { AdminReps } from './pages/admin/AdminReps'
import { AdminLinks } from './pages/admin/AdminLinks'
import { AdminProducts } from './pages/admin/AdminProducts'
import { AdminAnnouncements } from './pages/admin/AdminAnnouncements'
import { AdminSales } from './pages/admin/AdminSales'

export function App() {
  return (
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
  )
}
