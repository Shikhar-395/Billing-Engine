import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Braces, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authClient } from '../lib/auth';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-panel" style={{ textAlign: 'center' }}>
          <p className="auth-error">No reset token found. Please request a new password reset link.</p>
          <Link to="/forgot-password" className="btn btn-primary" style={{ marginTop: 16 }}>Request Reset</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setState('loading');
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message ?? 'Failed to reset password. The link may have expired.');
        setState('error');
      } else {
        setState('success');
        setTimeout(() => navigate('/login'), 2500);
      }
    } catch {
      setError('An unexpected error occurred.');
      setState('error');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo-icon">
            <Braces size={20} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>BillFlow</span>
        </div>

        {state === 'success' ? (
          <div className="auth-copy" style={{ textAlign: 'center' }}>
            <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 24 }}>Password Reset!</h1>
            <p>Your password has been updated. Redirecting to login...</p>
          </div>
        ) : (
          <>
            <div className="auth-copy">
              <h1>Set new password</h1>
              <p>Choose a strong password for your account.</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="reset-password">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-password"
                    type={showPw ? 'text' : 'password'}
                    className="form-input"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={8}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    onClick={() => setShowPw(p => !p)}
                    aria-label="Toggle password visibility"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="reset-confirm">Confirm Password</label>
                <input
                  id="reset-confirm"
                  type="password"
                  className="form-input"
                  placeholder="Same password again"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                id="btn-reset-submit"
                disabled={state === 'loading'}
              >
                {state === 'loading' ? <><div className="spinner" />Resetting...</> : 'Reset Password'}
              </button>
            </form>

            <p className="auth-switch">
              <Link to="/login">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
