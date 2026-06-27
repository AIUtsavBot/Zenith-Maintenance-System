import React from 'react';
import { NotificationBell } from './NotificationBell.js';
import { Wifi, WifiOff, CloudLightning } from 'lucide-react';

interface HeaderProps {
  isOnline: boolean;
  queueLength: number;
  onAddToast: (title: string, desc: string, type: 'success' | 'info' | 'warning') => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ isOnline, queueLength, onAddToast, activeTab }) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'tracker': return 'Time & Flow Tracker';
      case 'dashboard': return 'Productivity Dashboard';
      case 'calendar': return 'Interactive Calendar';
      case 'planner': return 'Daily Schedule Planner';
      case 'groups': return 'Collaborative Workspace';
      case 'settings': return 'Account & Settings';
      default: return 'Zenith Focus';
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border-glass)',
        marginBottom: '2rem',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto 2rem auto',
        flexWrap: 'wrap',
        gap: '1rem'
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {getTabTitle()}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Offline Sync State Pill */}
        {!isOnline ? (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: 'var(--color-break)',
              padding: '6px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            <WifiOff size={14} />
            <span>Offline Mode</span>
            {queueLength > 0 && (
              <span
                style={{
                  background: 'var(--color-break)',
                  color: '#000',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                  marginLeft: '4px'
                }}
              >
                {queueLength} pending
              </span>
            )}
          </div>
        ) : queueLength > 0 ? (
          <div
            style={{
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: 'var(--accent-primary)',
              padding: '6px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            <CloudLightning size={14} style={{ animation: 'spin 2s linear infinite' }} />
            <span>Syncing changes ({queueLength})...</span>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: 'var(--color-working)',
              padding: '6px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            <Wifi size={14} />
            <span>Supabase Sync Active</span>
          </div>
        )}

        {/* Bell dropdown */}
        <NotificationBell onAddToast={onAddToast} />
      </div>
    </header>
  );
};
