import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Eye, EyeOff, User } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.js';
import { api, setToken } from '../api.js';

interface LoginProps {
  onLoginSuccess: (user: { username: string; role: 'admin' | 'user'; name?: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize Google Identity Sign-In
  useEffect(() => {
    const initGoogleSSO = () => {
      if (typeof window !== 'undefined' && (window as any).google) {
        try {
          (window as any).google.accounts.id.initialize({
            // Default Client ID for local development and testing
            client_id: "870634691458-45tfhpeocofmgeflmfeecbcr2eop5109.apps.googleusercontent.com",
            callback: handleGoogleCredentialResponse
          });
          (window as any).google.accounts.id.renderButton(
            document.getElementById("google-signin-btn"),
            { theme: "outline", size: "large", width: 376 }
          );
        } catch (err) {
          console.error("Google SSO initialization error:", err);
        }
      }
    };

    // Give a short delay for script to fully register on window if load is fast
    const timer = setTimeout(initGoogleSSO, 100);
    return () => clearTimeout(timer);
  }, [isSignUp]);

  const handleGoogleCredentialResponse = async (response: any) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.auth.googleLogin(response.credential);
      setToken(data.token);
      onLoginSuccess({
        username: data.username,
        role: data.role,
        name: data.name
      });
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your access password.');
      return;
    }
    if (isSignUp && !username) {
      setError('Please enter a username or email.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Signups default to 'user' role
        const data = await api.auth.signup({ username, name, password });
        setToken(data.token);
        onLoginSuccess({
          username: data.username,
          role: data.role,
          name: data.name
        });
      } else {
        // Supports legacy (only password) or multi-user (username and password) login
        const data = await api.auth.login({ username: username || undefined, password });
        setToken(data.token);
        onLoginSuccess({
          username: data.username,
          role: data.role,
          name: data.name
        });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
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
          {isSignUp ? 'Join Zenith Focus' : 'Zenith Focus'}
        </h1>
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            marginBottom: '2rem'
          }}
        >
          {isSignUp 
            ? 'Create an account to start tracking work hours.' 
            : 'Enter credentials to access your office session database.'}
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', zIndex: 1 }}>
          
          {/* Username / Email field */}
          {(isSignUp || username !== '') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <label
                htmlFor="username-input"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                Username or Email
              </label>
              <input
                id="username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username/email..."
                className="form-input"
                style={{ width: '100%', fontSize: '1rem' }}
              />
            </div>
          )}

          {/* Legacy single-input helper (only display username field if they choose to use username or sign up) */}
          {!isSignUp && username === '' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setUsername('admin')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  textDecoration: 'underline'
                }}
              >
                Sign in with Username instead
              </button>
            </div>
          )}

          {/* Full Name field (Signup only) */}
          {isSignUp && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <label
                htmlFor="name-input"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="form-input"
                  style={{ width: '100%', paddingLeft: '2.5rem', fontSize: '1rem' }}
                />
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              </div>
            </div>
          )}

          {/* Password field */}
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
            {loading ? 'Authenticating...' : isSignUp ? 'Create Account' : 'Sign In'}
            {!loading && <ArrowRight size={18} />}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '1.5rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
            <span style={{ padding: '0 0.75rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
          </div>

          {/* Google Sign-In Container */}
          <div id="google-signin-btn" style={{ width: '100%', display: 'flex', justifyContent: 'center', minHeight: '40px' }} />

        </form>

        <p style={{ marginTop: '1.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', zIndex: 1 }}>
          {isSignUp ? 'Already have an account? ' : 'New to Zenith Focus? '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setUsername('');
              setName('');
              setPassword('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            {isSignUp ? 'Sign In' : 'Register Now'}
          </button>
        </p>
      </GlassCard>
    </div>
  );
};
export default Login;
