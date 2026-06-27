import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { Login } from './pages/Login.js';
import { Tracker } from './pages/Tracker.js';
import { Dashboard } from './pages/Dashboard.js';
import { CalendarView } from './pages/CalendarView.js';
import { Planner } from './pages/Planner.js';
import { Settings } from './pages/Settings.js';
import { GroupWorkspace } from './pages/GroupWorkspace.js';
import { Header } from './components/Header.js';
import { api, getToken, removeToken } from './api.js';
import { initSocketConnection, disconnectSocket, subscribeToSocketEvent } from './services/socketService.js';
import { useOfflineSync } from './hooks/useOfflineSync.js';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ username: string; role: 'admin' | 'user'; name?: string } | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('tracker');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Work session states managed globally
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'Working' | 'On Break' | 'Offline'>('Offline');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Floating Toast State
  const [toasts, setToasts] = useState<{ id: string; title: string; description: string; type: 'success' | 'info' | 'warning' }[]>([]);

  const addToast = (title: string, desc: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, description: desc, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Offline Sync State
  const { isOnline, queueLength, enqueueOfflineMutation } = useOfflineSync(() => {
    addToast('Sync Complete', 'Offline cached modifications uploaded successfully', 'success');
  });

  // Verify token validity on boot
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await api.auth.validate();
        setIsAuthenticated(true);
        setUser({
          username: response.username,
          role: response.role,
          name: response.name
        });
        // Connect Sockets
        initSocketConnection((event, data) => {
          if (event === 'toast_message') {
            addToast(data.title, data.description, data.type || 'info');
          }
        });
        await refreshSession();
      } catch (err) {
        removeToken();
        setIsAuthenticated(false);
        setUser(null);
      }
    };
    checkAuth();
  }, []);

  // Listen for socket notifications
  useEffect(() => {
    if (isAuthenticated) {
      const handleToast = (data: any) => {
        addToast(data.title, data.description, data.type || 'info');
      };
      subscribeToSocketEvent('toast_message', handleToast);
    }
  }, [isAuthenticated]);

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

  const handleLoginSuccess = (userData: { username: string; role: 'admin' | 'user'; name?: string }) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    removeToken();
    disconnectSocket();
    setIsAuthenticated(false);
    setSession(null);
    setStatus('Offline');
    setUser(null);
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
      case 'groups':
        return <GroupWorkspace currentUser={user} enqueueOfflineMutation={enqueueOfflineMutation} isOnline={isOnline} />;
      case 'settings':
        return <Settings theme={theme} setTheme={setTheme} role={user?.role || null} />;
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
        role={user?.role || null}
        name={user?.name || ''}
      />
      <main className="main-content">
        <Header 
          isOnline={isOnline} 
          queueLength={queueLength} 
          onAddToast={addToast} 
          activeTab={currentTab} 
        />
        {renderTabContent()}
      </main>

      {/* Floating Toast Notification Center */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 9999
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="glass-panel"
            style={{
              padding: '12px 18px',
              borderRadius: '10px',
              borderLeft: `4px solid ${toast.type === 'success' ? '#10b981' : toast.type === 'warning' ? '#f59e0b' : 'var(--accent-primary)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              minWidth: '280px',
              maxWidth: '360px',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{toast.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{toast.description}</div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

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
