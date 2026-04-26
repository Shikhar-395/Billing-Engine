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
  return 'Unable to sign in right now.';
}

export default function LoginPage() {
  const { data: providers } = useAuthProviders();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const googleAuthEnabled = providers?.google ?? false;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setError('');

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Unable to sign in.');
      }

      redirectTo('/');
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
        <div className="auth-copy">
          <span className="eyebrow">Secure sign in</span>
          <h1>Welcome back to your billing workspace.</h1>
          <p>Sign in to manage plans, subscriptions, invoices, metering, and webhooks.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="form-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />

          <label className="form-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="btn btn-primary auth-submit" type="submit" disabled={isPending}>
            {isPending ? <div className="spinner" /> : null}
            Sign in
          </button>
        </form>

        {googleAuthEnabled ? (
          <button className="btn btn-secondary auth-submit" type="button" onClick={handleGoogle} disabled={isPending}>
            Continue with Google
          </button>
        ) : null}

        <p className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
