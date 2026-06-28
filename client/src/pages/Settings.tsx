import React, { useState, useEffect } from 'react';
import { Database, Key, ShieldCheck, Download, RefreshCw, Sun, Moon, Users, UserPlus, Mail, BellRing } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.js';
import { api } from '../api.js';

interface SettingsProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  role: 'admin' | 'user' | null;
}

export const Settings: React.FC<SettingsProps> = ({ theme, setTheme, role }) => {
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'users'>('config');

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

  // Admin user directory states
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // User edit state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editLoading, setEditLoading] = useState(false);

  // Profile and Email Notification States
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileTimezone, setProfileTimezone] = useState('UTC');
  const [emailVerified, setEmailVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState('');
  const [fallbackOtp, setFallbackOtp] = useState('');
  const [otpWarning, setOtpWarning] = useState('');
  const [prefs, setPrefs] = useState({
    receiveReminderEmails: true,
    receiveTaskEmails: true,
    receiveGoalEmails: true,
    receiveWeeklyReports: true,
    receiveAiReports: true,
    receiveMarketingEmails: false,
    enableDND: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00'
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');

  const fetchUserProfile = async () => {
    try {
      const data = await api.profile.get();
      if (data && data.profile) {
        setProfileName(data.profile.name || '');
        setProfileEmail(data.profile.email || '');
        setProfileTimezone(data.profile.timezone || 'UTC');
        setEmailVerified(data.profile.emailVerified || false);
      }
      if (data && data.preferences) {
        setPrefs(data.preferences);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileLoading(true);
    try {
      const res = await api.profile.update({
        name: profileName,
        email: profileEmail,
        timezone: profileTimezone,
        preferences: prefs
      });
      setProfileSuccess('Profile preferences updated successfully.');
      if (res && res.profile) {
        setEmailVerified(res.profile.emailVerified);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    setOtpError('');
    setOtpSuccess('');
    setOtpValue('');
    setFallbackOtp('');
    
    if (!profileEmail.trim()) {
      alert('Please enter a valid email address first.');
      return;
    }

    try {
      // Auto-save the email to the backend database first so it's not empty
      await api.profile.update({
        name: profileName,
        email: profileEmail.trim(),
        timezone: profileTimezone,
        preferences: prefs
      });

      const res = await api.profile.verifyEmail();
      if (res && res.status === 'pending') {
        if (res.otp) {
          setFallbackOtp(res.otp);
        }
        if (res.warning) {
          setOtpWarning(res.warning);
        }
        setShowOtpModal(true);
      } else {
        alert(res?.message || 'Verification initiated.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to initiate verification.');
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpValue || otpValue.trim().length !== 6) {
      setOtpError('Please enter a valid 6-digit code.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await api.profile.verifyEmail({ otp: otpValue.trim() });
      if (res && res.status === 'verified') {
        setEmailVerified(true);
        setOtpSuccess('Email verified successfully!');
        setTimeout(() => {
          setShowOtpModal(false);
        }, 1500);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const fetchConfigStatus = async () => {
    if (role !== 'admin') return;
    setStatusLoading(true);
    try {
      const configData = await api.settings.getStatus();
      setDbStatus(configData);
    } catch (err) {
      console.error('Failed to get configuration status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchUsersDirectory = async () => {
    if (role !== 'admin') return;
    try {
      const data = await api.admin.getUsers();
      setUsersList(data.users || []);
    } catch (err) {
      console.error('Failed to load users directory:', err);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchConfigStatus();
      fetchUsersDirectory();
    }
  }, [role]);

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

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    if (!newUsername || !newPasswordVal) {
      setCreateError('Username and password are required.');
      return;
    }

    setCreateLoading(true);
    try {
      await api.admin.createUser({
        username: newUsername,
        name: newName || undefined,
        email: newEmail || undefined,
        password: newPasswordVal,
        role: newRole
      });
      setCreateSuccess('User profile provisioned successfully.');
      setNewUsername('');
      setNewName('');
      setNewEmail('');
      setNewPasswordVal('');
      setNewRole('user');
      fetchUsersDirectory(); // Refresh directory list
    } catch (err: any) {
      setCreateError(err.message || 'Failed to provision user profile.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateUserSubmit = async (username: string) => {
    setEditLoading(true);
    try {
      await api.admin.updateUser(username, {
        name: editName,
        email: editEmail,
        role: editRole
      });
      setEditingUser(null);
      fetchUsersDirectory();
    } catch (err: any) {
      alert(err.message || 'Failed to update user details.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const data = await api.productivity.getHistory();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `zenith_focus_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
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

      {/* Admin Tab Switcher */}
      {role === 'admin' && (
        <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
          <button
            onClick={() => setActiveSubTab('config')}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeSubTab === 'config' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeSubTab === 'config' ? 700 : 500,
              fontSize: '1rem',
              cursor: 'pointer',
              paddingBottom: '0.5rem',
              position: 'relative'
            }}
          >
            System Settings
            {activeSubTab === 'config' && (
              <span style={{ position: 'absolute', bottom: '-0.85rem', left: 0, right: 0, height: '3px', background: 'var(--accent-gradient)', borderRadius: '2px' }} />
            )}
          </button>
          
          <button
            onClick={() => {
              setActiveSubTab('users');
              fetchUsersDirectory();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeSubTab === 'users' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeSubTab === 'users' ? 700 : 500,
              fontSize: '1rem',
              cursor: 'pointer',
              paddingBottom: '0.5rem',
              position: 'relative'
            }}
          >
            User Directory
            {activeSubTab === 'users' && (
              <span style={{ position: 'absolute', bottom: '-0.85rem', left: 0, right: 0, height: '3px', background: 'var(--accent-gradient)', borderRadius: '2px' }} />
            )}
          </button>
        </div>
      )}

      {/* Content Rendering */}
      {activeSubTab === 'config' || role !== 'admin' ? (
        /* Configuration Grid view */
        <div style={{ display: 'grid', gridTemplateColumns: role === 'admin' ? '1fr 1fr' : '1fr', maxWidth: role === 'admin' ? '1000px' : '500px', margin: role === 'admin' ? '0' : '0 auto', gap: '1.5rem' }} id="settings-grid">
          
          {/* Left Column: Database Integration & Backup */}
          {role === 'admin' && (
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
          )}

          {/* Right Column: Authentication Credentials & Theme */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* User Profile & Email Notifications */}
            <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', marginBottom: '0.25rem' }}>
                <Mail size={18} style={{ color: 'var(--accent-primary)' }} /> Profile & Notifications
              </h3>

              <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Your name..."
                      className="form-input"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Timezone</label>
                    <select
                      value={profileTimezone}
                      onChange={(e) => setProfileTimezone(e.target.value)}
                      className="form-input"
                      style={{ background: 'var(--bg-input)', padding: '0.6rem' }}
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">EST/EDT (New York)</option>
                      <option value="America/Los_Angeles">PST/PDT (Los Angeles)</option>
                      <option value="Asia/Kolkata">IST (India)</option>
                      <option value="Europe/London">GMT/BST (London)</option>
                      <option value="Europe/Paris">CET/CEST (Paris)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="e.g. you@example.com"
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                    {profileEmail && (
                      emailVerified ? (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '6px 10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-working)', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>Verified</span>
                      ) : (
                        <button type="button" onClick={handleVerifyEmail} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-break)', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer' }}>Verify</button>
                      )
                    )}
                  </div>
                  {!profileEmail && <div style={{ fontSize: '0.65rem', color: '#fbbf24' }}>⚠️ Please add email to enable reminder messages.</div>}
                  {profileEmail && !emailVerified && <div style={{ fontSize: '0.65rem', color: '#fbbf24' }}>⚠️ Verify email before alerts will dispatch.</div>}
                </div>

                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.6rem' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}><BellRing size={14} /> Email Channels</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      { key: 'receiveReminderEmails', label: 'Reminders' },
                      { key: 'receiveTaskEmails', label: 'Tasks Assigned' },
                      { key: 'receiveGoalEmails', label: 'Goals Met' },
                      { key: 'receiveWeeklyReports', label: 'Weekly Summary' },
                      { key: 'receiveAiReports', label: 'Gemini reports' },
                      { key: 'receiveMarketingEmails', label: 'SaaS Updates' }
                    ].map(ch => (
                      <label key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={(prefs as any)[ch.key]}
                          onChange={(e) => setPrefs(prev => ({ ...prev, [ch.key]: e.target.checked }))}
                        />
                        {ch.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.6rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={prefs.enableDND}
                      onChange={(e) => setPrefs(prev => ({ ...prev, enableDND: e.target.checked }))}
                    />
                    Quiet Hours (DND)
                  </label>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={prefs.quietHoursStart}
                      onChange={(e) => setPrefs(prev => ({ ...prev, quietHoursStart: e.target.value }))}
                      placeholder="22:00"
                      style={{ width: '40px', padding: '2px 4px', fontSize: '0.7rem', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.7rem' }}>to</span>
                    <input
                      type="text"
                      className="form-input"
                      value={prefs.quietHoursEnd}
                      onChange={(e) => setPrefs(prev => ({ ...prev, quietHoursEnd: e.target.value }))}
                      placeholder="08:00"
                      style={{ width: '40px', padding: '2px 4px', fontSize: '0.7rem', textAlign: 'center' }}
                    />
                  </div>
                </div>

                {profileSuccess && <div style={{ fontSize: '0.75rem', color: 'var(--color-working)', fontWeight: 500 }}>{profileSuccess}</div>}

                <button type="submit" disabled={profileLoading} className="btn-primary" style={{ padding: '0.6rem', fontSize: '0.8rem' }}>
                  {profileLoading ? 'Saving Preferences...' : 'Save Profile Preferences'}
                </button>
              </form>
            </GlassCard>

            {/* Security Password Changer */}
            <GlassCard>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', marginBottom: '1.25rem' }}>
                <Key size={18} style={{ color: 'var(--color-break)' }} /> Access Protection ({role === 'admin' ? 'Admin' : 'User'})
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
      ) : (
        /* User Directory tab for admin */
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }} id="settings-grid">
          
          {/* User Directory List */}
          <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
              <Users size={18} style={{ color: 'var(--accent-primary)' }} /> Member Profiles Directory
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              View all user accounts currently registered or provisioned in the Zenith database.
            </p>

            <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-glass)', textAlign: 'left', color: 'var(--text-tertiary)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Name</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Username</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Email Address</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>System Access Role</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((userObj, idx) => {
                    const isEditing = editingUser?.username === userObj.username;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editName} 
                              onChange={e => setEditName(e.target.value)} 
                              className="form-input" 
                              style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                            />
                          ) : (
                            <span style={{ fontWeight: 600 }}>{userObj.name}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                          {userObj.username}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {isEditing ? (
                            <input 
                              type="email" 
                              value={editEmail} 
                              onChange={e => setEditEmail(e.target.value)} 
                              className="form-input" 
                              style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                            />
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>{userObj.email || '—'}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {isEditing ? (
                            <select 
                              value={editRole} 
                              onChange={e => setEditRole(e.target.value as any)}
                              className="form-input" 
                              style={{ padding: '2px 6px', fontSize: '0.8rem', background: 'var(--bg-input)' }}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span 
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                background: userObj.role === 'admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                color: userObj.role === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                border: '1px solid var(--border-glass)',
                                textTransform: 'uppercase'
                              }}
                            >
                              {userObj.role}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button 
                                onClick={() => handleUpdateUserSubmit(userObj.username)}
                                disabled={editLoading}
                                style={{ border: 'none', background: 'var(--color-working)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                {editLoading ? 'Saving...' : 'Save'}
                              </button>
                              <button 
                                onClick={() => setEditingUser(null)}
                                style={{ border: 'none', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setEditingUser(userObj);
                                setEditName(userObj.name || '');
                                setEditEmail(userObj.email || '');
                                setEditRole(userObj.role);
                              }}
                              style={{ border: 'none', background: 'rgba(168,85,247,0.1)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {usersList.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-tertiary)' }}>
                        No members provisioned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Provision New User Profile */}
          <GlassCard style={{ height: 'fit-content' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', marginBottom: '1rem' }}>
              <UserPlus size={18} style={{ color: 'var(--color-working)' }} /> Provision Member Account
            </h3>
            
            <form onSubmit={handleCreateUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Username or Email</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. employee1"
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Alice Smith"
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. alice@example.com"
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Access Password</label>
                <input
                  type="password"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="At least 6 characters..."
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Access Permission Level</label>
                <select
                  value={newRole}
                  onChange={(e: any) => setNewRole(e.target.value)}
                  className="form-input"
                  style={{ background: 'var(--bg-input)', cursor: 'pointer' }}
                >
                  <option value="user">Standard User (Scoped Work Log tracking)</option>
                  <option value="admin">Administrator (Full Access & Directory)</option>
                </select>
              </div>

              {createError && <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>{createError}</div>}
              {createSuccess && <div style={{ fontSize: '0.8rem', color: 'var(--color-working)', fontWeight: 500 }}>{createSuccess}</div>}

              <button type="submit" disabled={createLoading} className="btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
                {createLoading ? 'Provisioning Account...' : 'Create Account'}
              </button>
            </form>
          </GlassCard>
        </div>
      )}

      {showOtpModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <GlassCard style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Email Verification</h3>
              <button 
                onClick={() => setShowOtpModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              A 6-digit verification code has been sent to <strong>{profileEmail}</strong>. Please enter the code below to verify your email.
            </p>

            {fallbackOtp && (
              <div style={{
                background: otpWarning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                border: `1px solid ${otpWarning ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: otpWarning ? '#fca5a5' : '#93c5fd',
                textAlign: 'center',
                lineHeight: 1.4
              }}>
                {otpWarning ? (
                  <>
                    ⚠️ <strong>SMTP Error:</strong> {otpWarning}
                    <br />
                    Use testing code: <strong>{fallbackOtp}</strong>
                  </>
                ) : (
                  <>ℹ️ SMTP is not configured. Use testing code: <strong>{fallbackOtp}</strong></>
                )}
              </div>
            )}

            <form onSubmit={handleConfirmOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="text"
                  maxLength={6}
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  style={{
                    padding: '0.8rem',
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    letterSpacing: '8px',
                    fontWeight: 'bold',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    color: 'white'
                  }}
                  required
                />
              </div>

              {otpError && <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500, textAlign: 'center' }}>{otpError}</div>}
              {otpSuccess && <div style={{ fontSize: '0.8rem', color: 'var(--color-working)', fontWeight: 500, textAlign: 'center' }}>{otpSuccess}</div>}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowOtpModal(false)}
                  className="btn-secondary" 
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={otpLoading || otpValue.length !== 6}
                  className="btn-primary" 
                  style={{ flex: 1 }}
                >
                  {otpLoading ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            </form>
            
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Didn't receive a code? <span onClick={handleVerifyEmail} style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>Resend code</span>
            </div>
          </GlassCard>
        </div>
      )}

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
export default Settings;
