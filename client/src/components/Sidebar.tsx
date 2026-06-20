import React from 'react';
import {
  Clock,
  LayoutDashboard,
  Calendar,
  ListTodo,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  status: 'Working' | 'On Break' | 'Offline';
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onLogout: () => void;
  role: 'admin' | 'user' | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  status,
  theme,
  setTheme,
  onLogout,
  role
}) => {
  const navItems = [
    { id: 'tracker', label: 'Time Tracker', icon: Clock },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendar', label: 'Calendar View', icon: Calendar },
    { id: 'planner', label: 'Schedule Planner', icon: ListTodo },
    { id: 'settings', label: 'Configuration', icon: SettingsIcon }
  ];

  const handleNavClick = (tabId: string) => {
    setCurrentTab(tabId);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'Working':
        return '#10b981'; // Green
      case 'On Break':
        return '#f59e0b'; // Amber
      default:
        return '#64748b'; // Slate
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="glass-panel"
        style={{
          width: '280px',
          height: 'calc(100vh - 2rem)',
          margin: '1rem',
          display: 'flex',
          flexDirection: 'column',
          padding: '2rem 1.5rem',
          borderRight: '1px solid var(--border-glass)',
          flexShrink: 0
        }}
        id="desktop-sidebar"
      >
        <div style={{ marginBottom: '2.5rem' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '0.25rem'
            }}
          >
            ZENITH FOCUS
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            Personal Productivity Engine
          </p>
          {role && (
            <div
              style={{
                display: 'inline-block',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background: role === 'admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                color: role === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                marginTop: '0.5rem',
                border: '1px solid var(--border-glass)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {role} Mode
            </div>
          )}
        </div>

        {/* Status Indicator */}
        <div
          className="glass-panel"
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'rgba(0, 0, 0, 0.05)',
            border: '1px solid var(--border-glass)'
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(),
              boxShadow: `0 0 8px ${getStatusColor()}`,
              transition: 'background-color 0.3s ease'
            }}
          />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Current State</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{status}</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  width: '100%',
                  padding: '0.85rem 1rem',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: isActive ? 'var(--bg-input-focus)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-title)',
                  fontSize: '0.95rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  textAlign: 'left'
                }}
                className={isActive ? '' : 'sidebar-btn-hover'}
              >
                <Icon size={18} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)' }} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              width: '100%',
              padding: '0.85rem 1rem',
              border: '1px solid var(--border-glass)',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontFamily: 'var(--font-title)'
            }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          
          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              width: '100%',
              padding: '0.85rem 1rem',
              border: 'none',
              borderRadius: '10px',
              backgroundColor: 'transparent',
              color: '#ef4444',
              fontFamily: 'var(--font-title)',
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header Bar & Bottom Nav */}
      <div
        style={{
          display: 'none'
        }}
        id="mobile-navigation"
      >
        {/* Top Header */}
        <header
          className="glass-panel"
          style={{
            position: 'sticky',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            zIndex: 100,
            borderRadius: 0,
            borderLeft: 'none',
            borderRight: 'none',
            borderTop: 'none'
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            ZENITH FOCUS
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {role && (
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  background: role === 'admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                  color: role === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-glass)',
                  textTransform: 'uppercase'
                }}
              >
                {role}
              </span>
            )}
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getStatusColor(),
                boxShadow: `0 0 6px ${getStatusColor()}`
              }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{status}</span>
          </div>
        </header>

        {/* Bottom Tab Bar */}
        <nav
          className="glass-panel"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '65px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            zIndex: 100,
            borderRadius: 0,
            borderBottom: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            padding: '0 0.5rem'
          }}
        >
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-body)',
                  gap: '3px'
                }}
              >
                <Icon size={20} />
                <span>{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
          
          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-body)',
              gap: '3px'
            }}
          >
            <LogOut size={20} />
            <span>Exit</span>
          </button>
        </nav>
      </div>

      <style>{`
        .sidebar-btn-hover:hover {
          background-color: rgba(255, 255, 255, 0.08) !important;
          color: var(--text-primary) !important;
        }
        [data-theme='light'] .sidebar-btn-hover:hover {
          background-color: rgba(0, 0, 0, 0.03) !important;
        }
        
        @media (max-width: 768px) {
          #desktop-sidebar {
            display: none !important;
          }
          #mobile-navigation {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
};
