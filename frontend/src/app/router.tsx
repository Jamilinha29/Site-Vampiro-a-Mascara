import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminShell } from '../components/layout/AdminShell'
import { PlayerShell } from '../components/layout/PlayerShell'
import { RequireAuth, RequirePlayer } from './guards'
import { RequireNarrator } from './adminGuards'
import { PageLoader } from '../components/ui/PageLoader'
import { Error403Page } from '../pages/errors/Error403Page'
import { Error404Page } from '../pages/errors/Error404Page'
import { Error500Page } from '../pages/errors/Error500Page'

const HomePage = lazy(() => import('../pages/public/HomePage'))
const AuthPortalPage = lazy(() => import('../features/auth/AuthPortalPage'))
const RecoverPage = lazy(() => import('../features/auth/RecoverPage'))
const DashboardPage = lazy(() => import('../pages/user/DashboardPage'))
const ProfilePage = lazy(() => import('../pages/user/ProfilePage'))
const SessionsPage = lazy(() => import('../pages/user/SessionsPage'))
const DownloadsPage = lazy(() => import('../pages/user/DownloadsPage'))
const ShopPage = lazy(() => import('../pages/user/ShopPage'))
const ArchivePage = lazy(() => import('../pages/user/ArchivePage'))
const BestiaryPage = lazy(() => import('../pages/user/BestiaryPage'))
const CharacterHubPage = lazy(() => import('../pages/user/CharacterHubPage'))
const PlayerCharactersPage = lazy(() => import('../pages/user/PlayerCharactersPage'))
const VirtualTablePage = lazy(() => import('../pages/user/VirtualTablePage'))
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'))
const AdminCharactersPage = lazy(() => import('../pages/admin/AdminCharactersPage'))
const AdminCharactersNewPage = lazy(() => import('../pages/admin/AdminCharactersNewPage'))
const AdminSessionsPage = lazy(() => import('../pages/admin/AdminSessionsPage'))
const AdminShopPage = lazy(() => import('../pages/admin/AdminShopPage'))
const AdminCatalogPage = lazy(() => import('../pages/admin/AdminCatalogPage'))
const AdminBestiaryPage = lazy(() => import('../pages/admin/AdminBestiaryPage'))
const AdminMesaPage = lazy(() => import('../pages/admin/AdminMesaPage'))
const AdminRewardsPage = lazy(() => import('../pages/admin/AdminRewardsPage'))
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'))
const AdminDownloadsPage = lazy(() => import('../pages/admin/AdminDownloadsPage'))
const AdminProfilePage = lazy(() => import('../pages/admin/AdminProfilePage'))
const AdminSettingsPage = lazy(() => import('../pages/admin/AdminSettingsPage'))
const LineageStepPage = lazy(() => import('../pages/characters/LineageStepPage'))
const IdentityStepPage = lazy(() => import('../pages/characters/IdentityStepPage'))
const ArchetypeStepPage = lazy(() => import('../pages/characters/ArchetypeStepPage'))
const AttributesStepPage = lazy(() => import('../pages/characters/AttributesStepPage'))
const PowersStepPage = lazy(() => import('../pages/characters/PowersStepPage'))
const ReviewStepPage = lazy(() => import('../pages/characters/ReviewStepPage'))
const SettingsPage = lazy(() => import('../pages/user/SettingsPage'))
const CodexHelpPage = lazy(() => import('../pages/public/CodexHelpPage'))

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

function LegacyAppRedirect() {
  const location = useLocation()
  const next = `${location.pathname.replace(/^\/app/, '/user')}${location.search}${location.hash}`
  return <Navigate to={next} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Lazy>
            <HomePage />
          </Lazy>
        }
      />
      <Route
        path="/auth/login"
        element={
          <Lazy>
            <AuthPortalPage mode="login" />
          </Lazy>
        }
      />
      <Route
        path="/auth/register"
        element={
          <Lazy>
            <AuthPortalPage mode="register" />
          </Lazy>
        }
      />
      <Route
        path="/auth/recover"
        element={
          <Lazy>
            <RecoverPage />
          </Lazy>
        }
      />
      <Route
        path="/ajuda/codice"
        element={
          <Lazy>
            <CodexHelpPage />
          </Lazy>
        }
      />

      <Route element={<RequireAuth />}>
        <Route path="/app" element={<Navigate to="/user" replace />} />
        <Route path="/app/*" element={<LegacyAppRedirect />} />
        <Route element={<RequirePlayer />}>
          <Route element={<PlayerShell />}>
            <Route path="/user" element={<Lazy><DashboardPage /></Lazy>} />
            <Route path="/user/profile" element={<Lazy><ProfilePage /></Lazy>} />
            <Route path="/user/users/:userId" element={<Lazy><ProfilePage /></Lazy>} />
            <Route path="/user/sessions" element={<Lazy><SessionsPage /></Lazy>} />
            <Route path="/user/downloads" element={<Lazy><DownloadsPage /></Lazy>} />
            <Route path="/user/shop" element={<Lazy><ShopPage /></Lazy>} />
            <Route path="/user/archive" element={<Lazy><ArchivePage /></Lazy>} />
            <Route path="/user/bestiary" element={<Lazy><BestiaryPage /></Lazy>} />
            <Route path="/user/settings" element={<Lazy><SettingsPage /></Lazy>} />
            <Route path="/user/notifications" element={<Navigate to="/user" replace />} />
            <Route path="/user/characters/new/lineage" element={<Lazy><LineageStepPage /></Lazy>} />
            <Route path="/user/characters/new/identity" element={<Lazy><IdentityStepPage /></Lazy>} />
            <Route path="/user/characters/new/archetype" element={<Lazy><ArchetypeStepPage /></Lazy>} />
            <Route path="/user/characters/new/attributes" element={<Lazy><AttributesStepPage /></Lazy>} />
            <Route path="/user/characters/new/powers" element={<Lazy><PowersStepPage /></Lazy>} />
            <Route path="/user/characters/new/review" element={<Lazy><ReviewStepPage /></Lazy>} />
            <Route path="/user/characters" element={<Lazy><PlayerCharactersPage /></Lazy>} />
            <Route path="/user/characters/:characterId/inventory" element={<Lazy><CharacterHubPage /></Lazy>} />
            <Route path="/user/characters/:characterId" element={<Lazy><CharacterHubPage /></Lazy>} />
            <Route path="/user/sessions/:sessionId/table" element={<Lazy><VirtualTablePage /></Lazy>} />
          </Route>
        </Route>

        <Route element={<RequireNarrator />}>
          <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Lazy><AdminDashboardPage /></Lazy>} />
          <Route path="characters" element={<Lazy><AdminCharactersPage /></Lazy>} />
          <Route path="characters/new" element={<Lazy><AdminCharactersNewPage /></Lazy>} />
          <Route path="sessions" element={<Lazy><AdminSessionsPage /></Lazy>} />
          <Route path="shop" element={<Lazy><AdminShopPage /></Lazy>} />
          <Route path="catalog" element={<Lazy><AdminCatalogPage /></Lazy>} />
          <Route path="bestiary" element={<Lazy><AdminBestiaryPage /></Lazy>} />
          <Route path="mesa" element={<Lazy><AdminMesaPage /></Lazy>} />
          <Route path="mesa/:sessionId" element={<Lazy><AdminMesaPage /></Lazy>} />
          <Route path="rewards" element={<Lazy><AdminRewardsPage /></Lazy>} />
          <Route path="users" element={<Lazy><AdminUsersPage /></Lazy>} />
          <Route path="downloads" element={<Lazy><AdminDownloadsPage /></Lazy>} />
          <Route path="profile" element={<Lazy><AdminProfilePage /></Lazy>} />
          <Route path="settings" element={<Lazy><AdminSettingsPage /></Lazy>} />
          </Route>
        </Route>
      </Route>

      <Route path="/403" element={<Error403Page />} />
      <Route path="/500" element={<Error500Page />} />
      <Route path="*" element={<Error404Page />} />
    </Routes>
  )
}
