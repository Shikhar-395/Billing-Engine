import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Braces, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { teamApi, setTenantId } from '../lib/api';
import { useAuthSession, authClient } from '../lib/auth';
import type { TenantInvitation } from '../types';

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: session } = useAuthSession();
  const token = searchParams.get('token') ?? '';

  const [invitation, setInvitation] = useState<TenantInvitation | null>(null);
  const [fetchState, setFetchState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fetchError, setFetchError] = useState('');
  const [acceptState, setAcceptState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [acceptError, setAcceptError] = useState('');

  useEffect(() => {
    if (!token) {
      setFetchState('error');
      setFetchError('No invitation token found in the URL.');
      return;
    }
    teamApi.getInvitationByToken(token)
      .then(inv => {
        setInvitation(inv);
        setFetchState('ready');
      })
      .catch(() => {
        setFetchState('error');
        setFetchError('Invitation not found or has already been used.');
      });
  }, [token]);

  const handleAccept = async () => {
    setAcceptState('loading');
    setAcceptError('');
    try {
      const result = await teamApi.acceptInvitation(token);
      // Switch tenant context to the newly joined workspace
      if (result.tenantId) {
        setTenantId(result.tenantId);
      }
      setAcceptState('success');
      // Reload session so memberships update
      await authClient.getSession();
      setTimeout(() => navigate('/'), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to accept invitation';
      setAcceptError(msg);
      setAcceptState('error');
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

        {fetchState === 'loading' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading invitation...</p>
          </div>
        )}

        {fetchState === 'error' && (
          <div className="auth-copy">
            <AlertTriangle size={36} style={{ color: 'var(--danger)' }} />
            <h1 style={{ fontSize: 22 }}>Invalid Invitation</h1>
            <p style={{ color: 'var(--danger)' }}>{fetchError}</p>
            <Link to="/login" className="btn btn-primary" style={{ marginTop: 8 }}>Back to Login</Link>
          </div>
        )}

        {fetchState === 'ready' && invitation && (
          <>
            {acceptState === 'success' ? (
              <div className="auth-copy" style={{ textAlign: 'center' }}>
                <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
                <h1 style={{ fontSize: 22 }}>Welcome aboard!</h1>
                <p>You've joined <strong>{invitation.tenant?.name}</strong>. Redirecting...</p>
              </div>
            ) : (
              <>
                <div className="auth-copy">
                  <UserCheck size={36} style={{ color: 'var(--accent-primary)' }} />
                  <h1 style={{ fontSize: 22 }}>You're invited!</h1>
                  <p>
                    <strong>{invitation.inviter?.name ?? 'Someone'}</strong> has invited you to join{' '}
                    <strong>{invitation.tenant?.name ?? 'a workspace'}</strong> as{' '}
                    <strong>{invitation.role}</strong>.
                  </p>
                </div>

                {invitation.status !== 'PENDING' && (
                  <div style={{ padding: '12px 16px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--warning)' }}>
                    This invitation is {invitation.status.toLowerCase()} and can no longer be accepted.
                  </div>
                )}

                {invitation.status === 'PENDING' && !session && (
                  <div style={{ padding: '12px 16px', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
                    <p style={{ color: 'var(--info)', marginBottom: 12 }}>
                      You need to be signed in to accept this invitation.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Link
                        to={`/login?redirect=${encodeURIComponent(window.location.href)}`}
                        className="btn btn-primary btn-sm"
                      >
                        Sign In
                      </Link>
                      <Link
                        to={`/signup?redirect=${encodeURIComponent(window.location.href)}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Create Account
                      </Link>
                    </div>
                  </div>
                )}

                {invitation.status === 'PENDING' && session && (
                  <>
                    <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
                      Accepting as: <strong>{session.user.email}</strong>
                      {invitation.email !== session.user.email && (
                        <p style={{ color: 'var(--warning)', marginTop: 4, fontSize: 13 }}>
                          ⚠ This invitation was sent to <strong>{invitation.email}</strong>. Sign in with the correct account to accept it.
                        </p>
                      )}
                    </div>

                    {acceptError && <p className="auth-error">{acceptError}</p>}

                    <button
                      className="btn btn-primary auth-submit"
                      id="btn-accept-invitation"
                      onClick={handleAccept}
                      disabled={acceptState === 'loading' || invitation.email !== session.user.email}
                    >
                      {acceptState === 'loading'
                        ? <><div className="spinner" />Accepting...</>
                        : `Join ${invitation.tenant?.name ?? 'Workspace'}`}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
