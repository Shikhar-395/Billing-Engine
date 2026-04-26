import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Braces, Mail } from 'lucide-react';
import { authClient } from '../lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setState('loading');
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setError(result.error.message ?? 'Failed to send reset email');
        setState('error');
      } else {
        setState('sent');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
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

        {state === 'sent' ? (
          <>
            <div className="auth-copy">
              <Mail size={36} style={{ color: 'var(--accent-primary)', marginBottom: 8 }} />
              <h1>Check your inbox</h1>
              <p>
                If <strong>{email}</strong> has a BillFlow account, a password reset link has been sent.
              </p>
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
              <strong style={{ color: 'var(--info)' }}>Development mode:</strong>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>
                Check the <a href="/dev-mailbox">Dev Mailbox</a> for the reset link.
              </span>
            </div>
            <Link to="/login" className="btn btn-secondary auth-submit">Back to Login</Link>
          </>
        ) : (
          <>
            <div className="auth-copy">
              <h1>Reset password</h1>
              <p>Enter your email address and we'll send you a reset link.</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="forgot-email">Email Address</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="form-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              {(state === 'error') && error && (
                <p className="auth-error">{error}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                id="btn-forgot-submit"
                disabled={state === 'loading'}
              >
                {state === 'loading' ? <><div className="spinner" />Sending...</> : 'Send Reset Link'}
              </button>
            </form>

            <p className="auth-switch">
              Remember your password?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
