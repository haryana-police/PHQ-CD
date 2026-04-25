import { ReactNode, useState, createContext, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps { children: ReactNode; }

// ── Nav icons (inline SVG) ──────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    path: '/admin/dashboard', label: 'Dashboard',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  },
  {
    path: '/admin/highlights', label: 'Highlights',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    path: '/admin/reports', label: 'Reports',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  },
  {
    path: '/admin/pending', label: 'Pending',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    path: '/admin/complaints', label: 'Complaints',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    path: '/admin/women-safety', label: 'Women Safety',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  },
  {
    path: '/admin/cctns', label: 'CCTNS Sync',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  },
];

export const ChartContext = createContext<{ expanded: boolean; setExpanded: (v: boolean) => void }>({
  expanded: false, setExpanded: () => {},
});
export const useChartExpand = () => useContext(ChartContext);

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#060d1a' }}>
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: '58px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(10,17,32,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(99,102,241,0.15)',
        boxShadow: '0 1px 0 rgba(99,102,241,0.1), 0 4px 24px rgba(0,0,0,0.4)',
      }}>
        {/* Left: Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ display: 'none', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            className="mobile-menu-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div style={{
            width: '38px', height: '38px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <img src="/PHQlogo.png" alt="Haryana Police" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.2 }}>
              PHQ Complaint Dashboard
            </div>
            <div style={{ fontSize: '10.5px', color: '#475569', letterSpacing: '0.3px' }}>
              Haryana Police Headquarters
            </div>
          </div>
        </div>

        {/* Centre: Module name */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <span style={{
            fontSize: '13px', fontWeight: 600, color: '#818cf8',
            letterSpacing: '1.5px', textTransform: 'uppercase',
            background: 'rgba(99,102,241,0.08)',
            padding: '4px 14px', borderRadius: '20px',
            border: '1px solid rgba(99,102,241,0.15)',
          }}>
            {NAV_ITEMS.find(i => location.pathname.startsWith(i.path))?.label ?? 'Dashboard'}
          </span>
        </div>

        {/* Right: Date/Time + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
            <span style={{ fontSize: '10px', color: '#475569' }}>{dateStr}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '7px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, marginTop: '58px' }}>
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
          {/* Nav section label */}
          <div style={{ padding: '20px 16px 8px', fontSize: '9.5px', color: '#334155', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 700 }}>
            Navigation
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 10px' }}>
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 12px', borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '13px', fontWeight: active ? 600 : 400,
                    color: active ? '#a5b4fc' : '#64748b',
                    background: active
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.07))'
                      : 'transparent',
                    border: active ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                    boxShadow: active ? 'inset 3px 0 0 #6366f1' : 'none',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'transparent'; } }}
                >
                  <span style={{ opacity: active ? 1 : 0.55, flexShrink: 0 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {active && (
                    <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 6px #6366f1' }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom version tag */}
          <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: '10px', color: '#1e293b', textAlign: 'center' }}>
              CMS v2.0 · Haryana Police
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main className="main-content-wrapper">
          <ChartContext.Provider value={{ expanded: chartExpanded, setExpanded: setChartExpanded }}>
            {children}
          </ChartContext.Provider>
        </main>
      </div>
    </div>
  );
};

export const AuthLayout = ({ children }: LayoutProps) => (
  <div className="auth-container">
    <div className="auth-bg"><div className="auth-bg-gradient"/><div className="auth-bg-grid"/></div>
    <div className="auth-content">{children}</div>
  </div>
);