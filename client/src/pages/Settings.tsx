import React, { useState, useEffect } from 'react';
import { Database, Key, ShieldCheck, Download, RefreshCw, Sun, Moon } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.js';
import { api } from '../api.js';

interface SettingsProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const Settings: React.FC<SettingsProps> = ({ theme, setTheme }) => {
  // Password change states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // DB and Sync status states
  const [dbStatus, setDbStatus] = useState<any>({
    supabaseConfigured: false,
    databaseMode: 'local',
    supabaseUrl: '',
    aiModel: 'local-heuristics'
  });
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchConfigStatus = async () => {
    setStatusLoading(true);
    try {
      const configRes = await fetch('http://localhost:5000/api/settings/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('zenith_auth_token')}`
        }
      });
      if (configRes.ok) {
        const configData = await configRes.json();
        setDbStatus(configData);
      }
    } catch (err) {
      console.error('Failed to get configuration status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigStatus();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPassError('Password must be at least 6 characters.');
      return;
    }

    setPassLoading(true);
    try {
      await api.auth.changePassword({ oldPassword, newPassword });
      setPassSuccess('Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password.');
    } finally {
      setPassLoading(false);
    }
  };

  const handleExportBackup = () => {
    try {
      // Export database file data by fetching the entire logs history and downloading it
      const token = localStorage.getItem('zenith_auth_token');
      fetch('http://localhost:5000/api/productivity/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `zenith_focus_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      });
    } catch (err) {
      alert('Failed to generate export backup.');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Settings Header */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Configuration Console</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          Manage your secure connection keys, update passwords, and backup sessions.
        </p>
      </div>

      {/* Settings Sections Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} id="settings-grid">
        
        {/* Left Column: Database Integration & Backup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* DB & Supabase status */}
          <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                <Database size={18} style={{ color: 'var(--accent-primary)' }} /> Database Sync Engine
              </h3>
              <button
                onClick={fetchConfigStatus}
                disabled={statusLoading}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              >
                <RefreshCw size={16} className={statusLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                background: dbStatus.supabaseConfigured ? 'rgba(16, 185, 129, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                border: `1px solid ${dbStatus.supabaseConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <ShieldCheck size={28} style={{ color: dbStatus.supabaseConfigured ? 'var(--color-working)' : 'var(--accent-primary)' }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  {dbStatus.supabaseConfigured ? 'Supabase Sync Online' : 'Local File Storage Active'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {dbStatus.supabaseConfigured
                    ? 'All work sessions sync immediately to Supabase database.'
                    : 'Backend is saving records to server/data/db.json backup.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Database Mode</span>
                <span style={{ fontWeight: 600 }}>{dbStatus.supabaseConfigured ? 'SUPABASE' : 'LOCAL_JSON'}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Supabase Project URL</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                  {dbStatus.supabaseUrl && dbStatus.supabaseUrl !== 'Not Configured' ? `${dbStatus.supabaseUrl.substring(0, 25)}...` : 'Not Set'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>AI Insight Processor</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                  {dbStatus.aiModel === 'gemini' ? 'Gemini 1.5 Flash' : 'Rule-Based Heuristics (Local)'}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Backup Database */}
          <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
              <Download size={18} style={{ color: 'var(--color-working)' }} /> Local Data Backup
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
              You can download a complete backup export of all your tracked dates, notes, and task checklists. 
              This is stored in a clean JSON schema format that can be easily restored or migrated.
            </p>

            <button onClick={handleExportBackup} className="btn-secondary" style={{ gap: '0.5rem' }}>
              <Download size={16} /> Export Session Backup (.json)
            </button>
          </GlassCard>
        </div>

        {/* Right Column: Authentication Credentials & Theme */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Security Password Changer */}
          <GlassCard>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', marginBottom: '1.25rem' }}>
              <Key size={18} style={{ color: 'var(--color-break)' }} /> Access Protection
            </h3>

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Old password..."
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters..."
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password..."
                  className="form-input"
                />
              </div>

              {passError && <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>{passError}</div>}
              {passSuccess && <div style={{ fontSize: '0.8rem', color: 'var(--color-working)', fontWeight: 500 }}>{passSuccess}</div>}

              <button type="submit" disabled={passLoading} className="btn-primary" style={{ marginTop: '0.5rem' }}>
                {passLoading ? 'Updating Password...' : 'Save Password'}
              </button>
            </form>
          </GlassCard>

          {/* Theme Selector Panel */}
          <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} Appearance Profile
            </h3>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Configure your visual workspace. Switch between light glassmorphic modes and premium dark space backdrops.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                onClick={() => setTheme('light')}
                style={{
                  border: theme === 'light' ? '2px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                  background: theme === 'light' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                <Sun size={20} style={{ color: 'var(--color-break)' }} />
                <span>Light Mode</span>
              </button>
              
              <button
                onClick={() => setTheme('dark')}
                style={{
                  border: theme === 'dark' ? '2px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                  background: theme === 'dark' ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-input)',
                  borderRadius: '10px',
                  padding: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}
              >
                <Moon size={20} style={{ color: 'var(--accent-primary)' }} />
                <span>Dark Mode</span>
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          #settings-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
