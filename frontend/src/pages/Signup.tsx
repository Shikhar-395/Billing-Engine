import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authClient, useAuthProviders } from '../lib/auth';

function redirectTo(path: string) {
  if (typeof window !== 'undefined') {
    window.location.assign(path);
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unable to create your account right now.';
}

export default function SignupPage() {
  const { data: providers } = useAuthProviders();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const googleAuthEnabled = providers?.google ?? false;

  const [signedUp, setSignedUp] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setError('');

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Unable to create your account.');
      }

      setSignedUp(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsPending(false);
    }
  };


  const handleGoogle = async () => {
    setIsPending(true);
    setError('');

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
      });
    } catch (socialError) {
      setError(getErrorMessage(socialError));
      setIsPending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        {signedUp ? (
          <>
            <div className="auth-copy">
              <span className="eyebrow">Almost there!</span>
              <h1>Verify your email</h1>
              <p>
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </p>
            </div>
            {import.meta.env.DEV && (
              <div style={{ padding: '12px 16px', background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 'var(--radius-md)', fontSize: 14 }}>
                <strong style={{ color: 'var(--info)' }}>Development mode:</strong>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>
                  Check the <Link to="/dev-mailbox">Dev Mailbox</Link> for the verification link.
                </span>
              </div>
            )}
            <Link to="/login" className="btn btn-secondary auth-submit">Back to Login</Link>
          </>
        ) : (
          <>
        <div className="auth-copy">
          <span className="eyebrow">Create account</span>
          <h1>Create your account, then set up your billing workspace.</h1>
          <p>After sign-up, you will create your company tenant and land in the dashboard.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="signup-name">
            Full name
          </label>
          <input
            id="signup-name"
            className="form-input"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ava Patel"
            required
          />

          <label className="form-label" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            className="form-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />

          <label className="form-label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            className="form-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            required
          />

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="btn btn-primary auth-submit" type="submit" disabled={isPending}>
            {isPending ? <div className="spinner" /> : null}
            Create account
          </button>
        </form>

        {googleAuthEnabled ? (
          <button className="btn btn-secondary auth-submit" type="button" onClick={handleGoogle} disabled={isPending}>
            Continue with Google
          </button>
        ) : null}

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          </>
        )}
      </div>
    </div>
  );
}
