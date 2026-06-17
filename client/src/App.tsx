import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { Login } from './pages/Login.js';
import { Tracker } from './pages/Tracker.js';
import { Dashboard } from './pages/Dashboard.js';
import { CalendarView } from './pages/CalendarView.js';
import { Planner } from './pages/Planner.js';
import { Settings } from './pages/Settings.js';
import { api, getToken, removeToken } from './api.js';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('tracker');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Work session states managed globally
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'Working' | 'On Break' | 'Offline'>('Offline');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Verify token validity on boot
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        await api.auth.validate();
        setIsAuthenticated(true);
        await refreshSession();
      } catch (err) {
        removeToken();
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Sync and fetch active session details
  const refreshSession = async () => {
    try {
      const response = await api.session.getCurrent();
      if (response && response.session) {
        setSession(response.session);
        setStatus(response.session.status);
      } else {
        setSession(null);
        setStatus('Offline');
      }
    } catch (err) {
      console.error('Failed to retrieve current work state:', err);
    }
  };

  // Sync Theme updates
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync status updates from tracking operations
  useEffect(() => {
    if (isAuthenticated) {
      refreshSession();
    }
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    removeToken();
    setIsAuthenticated(false);
    setSession(null);
    setStatus('Offline');
  };

  if (isAuthenticated === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-app)' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>
          Initializing session manager...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render view panel matching active navigation tab
  const renderTabContent = () => {
    switch (currentTab) {
      case 'tracker':
        return (
          <Tracker
            status={status}
            setStatus={setStatus}
            session={session}
            setSession={setSession}
            refreshSession={refreshSession}
          />
        );
      case 'dashboard':
        return <Dashboard />;
      case 'calendar':
        return <CalendarView />;
      case 'planner':
        return <Planner />;
      case 'settings':
        return <Settings theme={theme} setTheme={setTheme} />;
      default:
        return (
          <Tracker
            status={status}
            setStatus={setStatus}
            session={session}
            setSession={setSession}
            refreshSession={refreshSession}
          />
        );
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        status={status}
        theme={theme}
        setTheme={setTheme}
        onLogout={handleLogoutClick}
      />
      <main className="main-content">
        {renderTabContent()}
      </main>

      {showLogoutConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '2rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              textAlign: 'center',
              background: 'var(--bg-card)'
            }}
          >
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1rem', color: '#ef4444' }}>Confirm Sign Out</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Are you sure you want to sign out of Zenith Focus? Your active tracking status will remain saved.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleLogoutConfirm}
                className="btn-primary"
                style={{ flex: 1, background: '#ef4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}
              >
                Sign Out
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
