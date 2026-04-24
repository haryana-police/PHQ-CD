import { ReactNode, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const menuItems = [
  { path: '/admin/dashboard', label: 'Dashboard' },
  { path: '/admin/highlights', label: 'Highlights' },
  { path: '/admin/reports', label: 'Reports' },
  { path: '/admin/pending', label: 'Pending' },
  { path: '/admin/complaints', label: 'Complaints' },
  { path: '/admin/women-safety', label: 'Women Safety' },
  { path: '/admin/cctns', label: 'CCTNS' },
];

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="app-container">
      <header className="top-header">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="header-brand">
          <img src="/PHQlogo.png" alt="PHQ" className="header-logo" />
          <div className="header-text">
            <span className="header-title">Complaint Monitoring System</span>
            <span className="header-dept">Haryana Police Headquarters</span>
          </div>
        </div>

        <div className="header-right">
          <button className="logout-btn" onClick={handleLogout} title="Sign Out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </header>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className={`sidebar-overlay ${sidebarOpen ? '' : 'hidden'}`} onClick={() => setSidebarOpen(false)} />

      <main className="main-content">
        <ChartContext.Provider value={{ expanded: chartExpanded, setExpanded: setChartExpanded }}>
          {children}
        </ChartContext.Provider>
      </main>
    </div>
  );
};

import { createContext, useContext } from 'react';

export const ChartContext = createContext<{ expanded: boolean; setExpanded: (v: boolean) => void }>({
  expanded: false,
  setExpanded: () => {},
});

export const useChartExpand = () => useContext(ChartContext);

export const AuthLayout = ({ children }: LayoutProps) => {
  return (
    <div className="auth-container">
      <div className="auth-bg">
        <div className="auth-bg-gradient" />
        <div className="auth-bg-grid" />
      </div>
      <div className="auth-content">
        {children}
      </div>
    </div>
  );
};