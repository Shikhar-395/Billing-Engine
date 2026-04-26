import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Braces, CheckCircle, XCircle } from 'lucide-react';
import { authClient } from '../lib/auth';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('No verification token found in the URL.');
      return;
    }

    authClient.verifyEmail({ query: { token } })
      .then((result) => {
        if (result.error) {
          setState('error');
          setMessage(result.error.message ?? 'Email verification failed. The link may have expired.');
        } else {
          setState('success');
          setMessage('Your email has been verified!');
          setTimeout(() => navigate('/'), 2500);
        }
      })
      .catch(() => {
        setState('error');
        setMessage('An unexpected error occurred during verification.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="auth-shell">
      <div className="auth-panel" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div className="sidebar-logo-icon">
            <Braces size={20} />
          </div>
        </div>
        <div className="auth-copy">
          <h1 style={{ fontSize: 24 }}>Email Verification</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '12px 0' }}>
          {state === 'loading' && <div className="spinner spinner-lg" />}
          {state === 'success' && <CheckCircle size={48} style={{ color: 'var(--success)' }} />}
          {state === 'error' && <XCircle size={48} style={{ color: 'var(--danger)' }} />}
          <p style={{ color: state === 'error' ? 'var(--danger)' : 'var(--text-secondary)', fontSize: 15 }}>
            {message}
          </p>
          {state === 'success' && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Redirecting to dashboard...</p>
          )}
          {state === 'error' && (
            <a href="/login" className="btn btn-primary">Back to Login</a>
          )}
        </div>
      </div>
    </div>
  );
}
