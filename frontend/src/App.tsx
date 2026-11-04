import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { isAdmin, isManager, isPlatformAdmin, isSales } from "./lib/roles";
import { AppLayout } from "./layout/AppLayout";

const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const TeamPage = lazy(() => import("./pages/TeamPage").then((m) => ({ default: m.TeamPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const LeadsPage = lazy(() => import("./pages/LeadsPage").then((m) => ({ default: m.LeadsPage })));
const LeadDetailPage = lazy(() => import("./pages/LeadDetailPage").then((m) => ({ default: m.LeadDetailPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const VisitsPage = lazy(() => import("./pages/VisitsPage").then((m) => ({ default: m.VisitsPage })));
const VisitDetailPage = lazy(() => import("./pages/VisitDetailPage").then((m) => ({ default: m.VisitDetailPage })));
const SalesPage = lazy(() => import("./pages/SalesPage").then((m) => ({ default: m.SalesPage })));
const MapPage = lazy(() => import("./pages/MapPage").then((m) => ({ default: m.MapPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const BeatPage = lazy(() => import("./pages/BeatPage").then((m) => ({ default: m.BeatPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const RegistrationsPage = lazy(() => import("./pages/RegistrationsPage").then((m) => ({ default: m.RegistrationsPage })));

export function App() {
  const { ready, user } = useAuth();
  if (!ready) return <div className="center muted">Loading…</div>;

  if (!user) {
    return (
      <Suspense fallback={<div className="center muted">Loading…</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (isSales(user.roles)) {
    return (
      <Suspense fallback={<div className="center muted">Loading…</div>}>
        <Routes>
          <Route path="*" element={<LoginPage blocked />} />
        </Routes>
      </Suspense>
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
