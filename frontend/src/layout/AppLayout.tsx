import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isAdmin, isManager, isPlatformAdmin, roleLabel } from "../lib/roles";

const titles: Record<string, string> = {
  "/": "Overview",
  "/team": "People",
  "/beat": "Beat desk",
  "/leads": "Pipeline",
  "/visits": "Visit proof",
  "/sales": "Sales book",
  "/map": "Live map",
  "/reports": "Reports",
  "/settings": "Company",
  "/registrations": "Managers",
  "/profile": "Account",
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const admin = isAdmin(user?.roles);
  const manager = isManager(user?.roles);
  const platform = isPlatformAdmin(user);
  const title =
    titles[location.pathname] ||
    (location.pathname.startsWith("/visits/") ? "Visit proof" : "SalesTrack Desk");

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="logo">ST</div>
          <div>
            <strong>SalesTrack Desk</strong>
            <div className="muted small">{user?.tenant.name}</div>
          </div>
        </div>
        <nav>
          <NavLink to="/" end>
            Overview
          </NavLink>
          {manager ? <NavLink to="/team">Team</NavLink> : null}
          {manager ? <NavLink to="/beat">Beat desk</NavLink> : null}
          {manager ? <NavLink to="/leads">Pipeline</NavLink> : null}
          {manager ? <NavLink to="/visits">Visit proof</NavLink> : null}
          {manager ? <NavLink to="/sales">Sales book</NavLink> : null}
          {manager ? <NavLink to="/map">Live map</NavLink> : null}
          {manager ? <NavLink to="/reports">Reports</NavLink> : null}
          {platform ? <NavLink to="/registrations">Managers</NavLink> : null}
          {admin || manager ? <NavLink to="/settings">Company</NavLink> : null}
          <NavLink to="/profile">Account</NavLink>
        </nav>
        <div className="side-foot">
          <NavLink to="/profile" className="who">
            <strong>{user?.name}</strong>
            <div className="muted small">{roleLabel(user?.roles)}</div>
          </NavLink>
          <button className="link" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <div className="kicker">Desk portal</div>
            <div className="topbar-title">{title}</div>
          </div>
          <div className="muted small">Same API as the phone · field work stays on mobile</div>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
