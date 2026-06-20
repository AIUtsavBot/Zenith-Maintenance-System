import React, { useState } from 'react';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.js';
import { api, setToken } from '../api.js';

interface LoginProps {
  onLoginSuccess: (role: 'admin' | 'user') => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your access password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await api.auth.login(password);
      setToken(data.token);
      onLoginSuccess(data.role || 'user');
    } catch (err: any) {
      setError(err.message || 'Incorrect password. Access Denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        padding: '1.5rem'
      }}
    >
      <GlassCard
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2.5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          overflow: 'hidden'
        }}
        className="glass-panel"
      >
        {/* Glow decoration */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            filter: 'blur(50px)',
            opacity: 0.3,
            zIndex: 0
          }}
        />

        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 20px rgba(168, 85, 247, 0.25)',
            zIndex: 1
          }}
        >
          <Lock size={24} />
        </div>

        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
            textAlign: 'center'
          }}
        >
          Zenith Focus
        </h1>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            marginBottom: '2rem'
          }}
        >
          Enter password to access your office session database.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <label
              htmlFor="password-input"
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="form-input"
                style={{
                  width: '100%',
                  paddingRight: '3rem',
                  fontSize: '1rem'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                fontSize: '0.8rem',
                color: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                textAlign: 'center',
                fontWeight: 500
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.85rem',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </GlassCard>
    </div>
  );
};
