import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { isAdmin, isManager, isPlatformAdmin, isSales } from "./lib/roles";
import { AppLayout } from "./layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { TeamPage } from "./pages/TeamPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { VisitsPage } from "./pages/VisitsPage";
import { VisitDetailPage } from "./pages/VisitDetailPage";
import { SalesPage } from "./pages/SalesPage";
import { MapPage } from "./pages/MapPage";
import { ReportsPage } from "./pages/ReportsPage";
import { BeatPage } from "./pages/BeatPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RegistrationsPage } from "./pages/RegistrationsPage";

export function App() {
  const { ready, user } = useAuth();
  if (!ready) return <div className="center muted">Loading…</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (isSales(user.roles)) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage blocked />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/team" element={isManager(user.roles) ? <TeamPage /> : <Navigate to="/registrations" replace />} />
        <Route path="/beat" element={isManager(user.roles) ? <BeatPage /> : <Navigate to="/" replace />} />
        <Route path="/leads" element={isManager(user.roles) ? <LeadsPage /> : <Navigate to="/" replace />} />
        <Route path="/leads/:id" element={isManager(user.roles) ? <LeadDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/visits" element={isManager(user.roles) ? <VisitsPage /> : <Navigate to="/" replace />} />
        <Route path="/visits/:id" element={isManager(user.roles) ? <VisitDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/sales" element={isManager(user.roles) ? <SalesPage /> : <Navigate to="/" replace />} />
        <Route path="/map" element={isManager(user.roles) ? <MapPage /> : <Navigate to="/" replace />} />
        <Route path="/reports" element={isManager(user.roles) ? <ReportsPage /> : <Navigate to="/" replace />} />
        <Route path="/registrations" element={isPlatformAdmin(user) ? <RegistrationsPage /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={isAdmin(user.roles) || isManager(user.roles) ? <SettingsPage /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
